import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, X, File, Box, Image as ImageIcon, Loader2, Sparkles, Trash2,
  Download, Eye, AlertCircle, Layers, Maximize2, Mic, Square, Save,
} from 'lucide-react';
import { ModelViewer } from '../ModelViewer';
import {
  generateModel, pollUntilDone, fetchGlbArrayBuffer, getProxiedUrl,
  TripoMode, TripoTier, TaskStatus,
} from '../../services/tripo3d';
import {
  uploadPrototypeAsset, uploadReferenceImageGetUrl, saveGeneratedModel,
  getPrototypeAssets, deletePrototypeAsset, PrototypeAsset, AssetType,
} from '../../services/storage';
import { usePanelArchive } from '../../services/panelArchive';
import { ArchiveButton } from '../ArchiveButton';
import { useDesignStore } from '../../services/designStore';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';

interface SolutionNodePanelProps {
  nodeId: string;
}

/** 复合方案：每个 variant 是一个独立子智能体，各自生成 3D */
interface VariantDef {
  id: string;
  label: string;            // 方案 A / B / C ...
  prompt: string;
  status: 'idle' | 'generating' | 'done' | 'error';
  previewUrl?: string;
  assetId?: string;
  error?: string;
}

interface SolutionPanelData {
  basePrompt: string;
  genMode: TripoMode;
  tier: TripoTier;
  variantCount: number;     // 1 | 3 | 5
  strategy: 'concurrent' | 'sequential';
  variants: { id: string; label: string; prompt: string; assetId?: string }[];
}

const VARIANT_LABELS = ['A', 'B', 'C', 'D', 'E'];
const VARIANT_HINTS = [
  '',
  '差异化方向：极致轻量化，减少金属用量与整体重量',
  '差异化方向：强化握持人体工学，重点防疲劳',
  '差异化方向：模块化结构，便于拆卸与高温消毒',
  '差异化方向：低成本可量产，简化制造工艺',
];

const GEN_MODES: { key: TripoMode; label: string; hint: string }[] = [
  { key: 'text_to_model', label: '文生 3D', hint: '输入文字描述直接生成' },
  { key: 'image_to_model', label: '图生 3D', hint: '上传一张参考图生成' },
  { key: 'multiview_to_model', label: '多视图 3D', hint: '上传前/后/左/右四视图生成' },
];

const VIEWS = ['front', 'back', 'left', 'right'] as const;
const VIEW_LABEL: Record<string, string> = { front: '前', back: '后', left: '左', right: '右' };

function assetTypeLabel(t: AssetType): { text: string; cls: string } {
  switch (t) {
    case 'generated_glb': return { text: 'AI 生成', cls: 'bg-node-solution/10 text-node-solution' };
    case 'uploaded_glb': return { text: 'GLB 模型', cls: 'bg-node-behavior/10 text-node-behavior' };
    case 'reference_image': return { text: '参考图', cls: 'bg-node-context/10 text-node-context' };
    case 'cad_step': return { text: 'CAD/STP', cls: 'bg-node-solution/10 text-node-solution' };
    default: return { text: '文件', cls: 'bg-muted text-muted-foreground' };
  }
}
function assetIsViewable(t: AssetType): boolean {
  return t === 'generated_glb' || t === 'uploaded_glb';
}
function seedPrompt(base: string, idx: number): string {
  const hint = VARIANT_HINTS[idx] || '';
  return base + (hint ? `\n${hint}` : '');
}

export function SolutionNodePanel({ nodeId }: SolutionNodePanelProps) {
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const { useDelivery, openCompare, registerOutput, getOutput } = useDesignStore();
  const delivery = useDelivery(nodeId);

  // ---- 存档 ----
  const {
    data: archived, save, saving, lastSavedAt, loading: archLoading,
  } = usePanelArchive<SolutionPanelData>({
    projectId: 'default', nodeId, panelType: 'solution',
    initial: { basePrompt: '', genMode: 'text_to_model', tier: 'P', variantCount: 1, strategy: 'concurrent', variants: [] },
  });

  // ---- runtime state ----
  const [basePrompt, setBasePrompt] = useState('');
  const [genMode, setGenMode] = useState<TripoMode>('text_to_model');
  const [tier, setTier] = useState<TripoTier>('P');
  const [variantCount, setVariantCount] = useState<number>(1);
  const [strategy, setStrategy] = useState<'concurrent' | 'sequential'>('concurrent');
  const [variants, setVariants] = useState<VariantDef[]>([]);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [deliveryBanner, setDeliveryBanner] = useState<string | null>(null);

  const [assets, setAssets] = useState<PrototypeAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>('');

  const [singleImage, setSingleImage] = useState<File | null>(null);
  const [singlePreview, setSinglePreview] = useState<string>('');
  const [multiview, setMultiview] = useState<Record<string, File | null>>({ front: null, back: null, left: null, right: null });
  const [multiviewPreviews, setMultiviewPreviews] = useState<Record<string, string>>({});

  const [uploading, setUploading] = useState(false);
  const [genStatusText, setGenStatusText] = useState('');
  const [genError, setGenError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 重建 variant 数组以匹配选定数量（保留已有的 prompt / 成果）
  const reconcileVariants = useCallback((count: number, base: string, prev: VariantDef[]) => {
    const labels = VARIANT_LABELS.slice(0, count);
    const byLabel = new Map(prev.map((v) => [v.label, v]));
    return labels.map((label) => {
      const existing = byLabel.get(label);
      if (existing) return existing;
      const idx = VARIANT_LABELS.indexOf(label);
      return {
        id: `var-${nodeId}-${label}-${Date.now()}`,
        label,
        prompt: base ? seedPrompt(base, idx) : '',
        status: 'idle' as const,
      };
    });
  }, [nodeId]);

  // 载入存档
  useEffect(() => {
    if (!archLoading && archived) {
      setBasePrompt(archived.basePrompt || '');
      setGenMode(archived.genMode || 'text_to_model');
      setTier(archived.tier || 'P');
      setVariantCount(archived.variantCount || 1);
      setStrategy(archived.strategy || 'concurrent');
      const restored: VariantDef[] = (archived.variants || []).map((v) => ({
        id: v.id, label: v.label, prompt: v.prompt || '',
        status: v.assetId ? 'done' : 'idle', assetId: v.assetId,
      }));
      if (restored.length > 0) {
        setVariants(restored);
      } else {
        // 无存档方案：按数量自动播种方案卡片，保证一进来就有可操作的「生成」按钮
        const cnt = archived.variantCount || 1;
        setVariants(reconcileVariants(cnt, archived.basePrompt || '', []));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archived, archLoading]);

  // 切换节点：重置表单 + 载入资产
  useEffect(() => {
    setPreviewUrl(null); setPreviewName('');
    setSingleImage(null); setSinglePreview('');
    setMultiview({ front: null, back: null, left: null, right: null });
    setMultiviewPreviews({});
    loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  // 收到连线投递（problem → solution）：注入提示词并播种各方案
  useEffect(() => {
    if (!delivery || delivery.toType !== 'solution') return;
    const p = delivery.data?.prompt;
    if (p && p !== basePrompt) {
      setBasePrompt(p);
      setVariants((prev) => prev.map((v) => {
        const idx = VARIANT_LABELS.indexOf(v.label);
        return { ...v, prompt: v.prompt.trim() === '' ? seedPrompt(p, idx) : v.prompt };
      }));
      setDeliveryBanner('已从问题节点接收结构化提示词，已填入各方案输入框');
      setTimeout(() => setDeliveryBanner(null), 6000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery?.token]);

  // 将当前 variants 持续登记到 store，供"方案→行为"连线投递时读取
  useEffect(() => {
    registerOutput(nodeId, 'solution', {
      variants: variants.map((v) => ({
        id: v.id, label: v.label, prompt: v.prompt, previewUrl: v.previewUrl, assetId: v.assetId,
      })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, variants]);

  // 资产加载后，把已存档的 variant 成果映射回预览地址
  useEffect(() => {
    if (assets.length === 0) return;
    setVariants((prev) => prev.map((v) => {
      if (v.assetId) {
        const a = assets.find((x) => x.id === v.assetId);
        if (a?.storage_url) return { ...v, previewUrl: a.storage_url, status: 'done' };
      }
      return v;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets]);

  const loadAssets = async () => {
    setLoadingAssets(true);
    try {
      const list = await getPrototypeAssets(nodeId);
      setAssets(list);
    } catch (e: any) {
      console.error('加载资产失败', e);
    } finally {
      setLoadingAssets(false);
    }
  };

  const handleSave = async () => {
    await save({
      basePrompt,
      genMode,
      tier,
      variantCount,
      strategy,
      variants: variants.map((v) => ({ id: v.id, label: v.label, prompt: v.prompt, assetId: v.assetId })),
    });
  };

  // ---------- 单个 variant 生成 ----------
  // 生成进度/结果主动发布到全局 store（组件卸载后仍生效，行为节点能同步到最新方案），并自动存档
  const publishVariants = useCallback((vid: string, patch: Partial<VariantDef>) => {
    const cur = getOutput(nodeId);
    const base = (cur?.variants && Array.isArray(cur.variants) && cur.variants.length > 0 ? cur.variants : variants) as VariantDef[];
    const next = base.map((v) => (v.id === vid ? { ...v, ...patch } : v));
    registerOutput(nodeId, 'solution', {
      variants: next.map((v) => ({ id: v.id, label: v.label, prompt: v.prompt, previewUrl: v.previewUrl, assetId: v.assetId })),
    });
    save({
      basePrompt, genMode, tier, variantCount, strategy,
      variants: next.map((v) => ({ id: v.id, label: v.label, prompt: v.prompt, assetId: v.assetId })),
    }).catch(() => {});
  }, [nodeId, getOutput, registerOutput, variants, basePrompt, genMode, tier, variantCount, strategy, save]);

  const generateVariant = async (variantId: string) => {
    const v = variants.find((x) => x.id === variantId);
    if (!v) return;
    setVariants((prev) => prev.map((x) => x.id === variantId ? { ...x, status: 'generating', error: undefined } : x));
    publishVariants(variantId, { status: 'generating', error: undefined });
    setGenError('');
    try {
      if (genMode === 'text_to_model' && !v.prompt.trim()) throw new Error(`方案 ${v.label} 请输入生成描述`);

      let imageUrls: string[] | undefined;
      if (genMode === 'image_to_model') {
        if (!singleImage) throw new Error('请先上传一张参考图');
        imageUrls = [await uploadReferenceImageGetUrl(singleImage, nodeId)];
      } else if (genMode === 'multiview_to_model') {
        const missing = VIEWS.filter((vw) => !multiview[vw]);
        if (missing.length > 0) throw new Error('请上传缺失的视图：' + missing.map((vw) => VIEW_LABEL[vw]).join('、'));
        imageUrls = await Promise.all(VIEWS.map((vw) => uploadReferenceImageGetUrl(multiview[vw]!, nodeId)));
      }

      setGenStatusText(`方案 ${v.label}：提交生成任务…`);
      const taskId = await generateModel({ mode: genMode, tier, prompt: v.prompt.trim() || undefined, imageUrls });
      setGenStatusText(`方案 ${v.label}：Tripo 生成中…`);
      const remoteModelUrl = await pollUntilDone(taskId, (s: TaskStatus) => {
        setGenStatusText(`方案 ${v.label}：${statusText(s.status)}` + (s.progress != null ? ` ${Math.round(s.progress * 100)}%` : ''));
      });

      setGenStatusText(`方案 ${v.label}：模型完成，正在转存…`);
      let finalUrl = '';
      try {
        const buf = await fetchGlbArrayBuffer(remoteModelUrl);
        const asset = await saveGeneratedModel({
          nodeId, taskId, mode: genMode, tier, glbArrayBuffer: buf,
          fileName: `tripo_${taskId}_${v.label}.glb`,
        });
        finalUrl = asset.storage_url || '';
        setAssets((prev) => [asset, ...prev]);
        setVariants((prev) => prev.map((x) => x.id === variantId ? { ...x, assetId: asset.id, previewUrl: finalUrl, status: 'done' } : x));
        publishVariants(variantId, { assetId: asset.id, previewUrl: finalUrl, status: 'done' });
      } catch (e) {
        console.warn('GLB 转存失败，回退代理预览', e);
        finalUrl = getProxiedUrl(remoteModelUrl);
        setVariants((prev) => prev.map((x) => x.id === variantId ? { ...x, previewUrl: finalUrl, status: 'done' } : x));
        publishVariants(variantId, { previewUrl: finalUrl, status: 'done' });
      }

      if (finalUrl) {
        setPreviewUrl(finalUrl);
        setPreviewName(`方案 ${v.label} · Tripo AI 生成`);
      }
      setGenStatusText(`方案 ${v.label} 生成完成 ✅`);
    } catch (e: any) {
      console.error(e);
      const errMsg = e?.message || String(e);
      setVariants((prev) => prev.map((x) => x.id === variantId ? { ...x, status: 'error', error: errMsg } : x));
      publishVariants(variantId, { status: 'error', error: errMsg });
      setGenError(`方案 ${v.label}：${errMsg}`);
      setGenStatusText('生成失败');
    }
  };

  // ---------- 生成全部（并发 / 顺序）----------
  const generateAll = async () => {
    if (generatingAll) return;
    if (variants.length === 0) {
      setGenError('请先在上方选择方案数量（1 / 3 / 5 个）生成方案卡片，再点击「生成全部方案」');
      return;
    }
    setGeneratingAll(true);
    try {
      if (strategy === 'concurrent') {
        await Promise.all(variants.map((v) => generateVariant(v.id)));
      } else {
        for (const v of variants) {
          // eslint-disable-next-line no-await-in-loop
          await generateVariant(v.id);
        }
      }
    } finally {
      setGeneratingAll(false);
    }
  };

  // ---------- 资产上传 ----------
  const handleAssetUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        let type: AssetType = 'reference_image';
        if (ext === 'step' || ext === 'stp') type = 'cad_step';
        else if (ext === 'glb' || ext === 'gltf') type = 'uploaded_glb';
        else if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)) type = 'reference_image';
        else type = 'reference_image';

        const asset = await uploadPrototypeAsset({ file, nodeId, type, source: 'upload' });
        setAssets((prev) => [asset, ...prev]);
        if (assetIsViewable(type)) {
          setPreviewUrl(asset.storage_url || '');
          setPreviewName(asset.name);
        }
      }
    } catch (e: any) {
      console.error(e);
      alert('上传失败：' + (e?.message || e));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAsset = async (asset: PrototypeAsset) => {
    if (!confirm(`确认删除资产「${asset.name}」？`)) return;
    try {
      await deletePrototypeAsset(asset);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      setVariants((prev) => prev.map((v) => v.assetId === asset.id ? { ...v, assetId: undefined, previewUrl: undefined, status: 'idle' } : v));
      if (previewUrl === asset.storage_url) { setPreviewUrl(null); setPreviewName(''); }
    } catch (e: any) {
      alert('删除失败：' + (e?.message || e));
    }
  };

  const handlePreviewAsset = (asset: PrototypeAsset) => {
    if (assetIsViewable(asset.type) && asset.storage_url) {
      setPreviewUrl(asset.storage_url);
      setPreviewName(asset.name);
    }
  };

  // 将某个资产"保存"：绑定到方案卡片（优先未绑定的 variant）并立即写入节点存档
  const handleSaveAssetToArchive = (asset: PrototypeAsset) => {
    if (!asset.storage_url) { alert('该资产暂无云端地址，无法保存'); return; }
    const target = variants.find((v) => !v.assetId) || variants[0];
    if (!target) {
      setGenError('请先在上方选择方案数量（1/3/5 个）生成方案卡片，再保存资产');
      return;
    }
    const updated = variants.map((v) =>
      v.id === target.id
        ? { ...v, assetId: asset.id, previewUrl: asset.storage_url || undefined, status: 'done' as const, error: undefined }
        : v
    );
    setVariants(updated);
    publishVariants(target.id, { assetId: asset.id, previewUrl: asset.storage_url || undefined, status: 'done' });
    setPreviewUrl(asset.storage_url);
    setPreviewName(`${asset.name} · 已绑定方案 ${target.label}`);
    setGenStatusText(`已将「${asset.name}」绑定到方案 ${target.label} 并保存到存档 ✅`);
    setGenError('');
  };

  const onSingleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setSingleImage(f);
    if (singlePreview) URL.revokeObjectURL(singlePreview);
    setSinglePreview(f ? URL.createObjectURL(f) : '');
  };
  const onMultiviewChange = (view: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setMultiview((prev) => ({ ...prev, [view]: f }));
    setMultiviewPreviews((prev) => {
      const next = { ...prev };
      if (prev[view]) URL.revokeObjectURL(prev[view]);
      next[view] = f ? URL.createObjectURL(f) : '';
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* 顶部存档栏 */}
      <div className="border-b border-border bg-muted px-6 py-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">方案节点</span>
        <ArchiveButton data={{ basePrompt, genMode, tier, variantCount, strategy, variants }} onSave={handleSave} saving={saving} lastSavedAt={lastSavedAt} />
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm text-foreground">方案节点</h3>
            <button
              onClick={() => isRecording ? stopRecording() : startRecording()}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded transition-all ${
                isRecording
                  ? 'bg-destructive/10 text-destructive animate-pulse border border-destructive/30 shadow-sm'
                  : 'bg-node-behavior/10 text-node-behavior hover:bg-node-behavior/20'
              }`}
              title="用于在构思方案时收集口语报告记录"
            >
              {isRecording ? (
                <><Square className="w-3 h-3 fill-current" /> 停止报告</>
              ) : (
                <><Mic className="w-3 h-3" /> 出声报告</>
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            通过 Tripo3D 生成 3D 原型；支持 1/3/5 个复合方案，可并发或顺序生成后全屏对比
          </p>
        </div>

        {/* 连线投递提示 */}
        {deliveryBanner && (
          <div className="flex items-center gap-2 px-3 py-2 bg-node-solution/10 border border-node-solution/20 rounded-lg text-xs text-foreground">
            <Sparkles className="w-3.5 h-3.5 text-node-solution" />
            <span>{deliveryBanner}</span>
          </div>
        )}

        {/* ===== Tripo3D 生成 ===== */}
        <div className="border border-node-solution/20 rounded-lg p-4 bg-node-solution/10">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-node-solution" />
            <h4 className="text-sm text-foreground">Tripo3D AI 生成 3D 原型</h4>
          </div>

          {/* 复合方案数量 */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-muted-foreground">方案数量：</span>
            {[1, 3, 5].map((n) => (
              <button
                key={n}
                onClick={() => {
                  setVariantCount(n);
                  setVariants((prev) => reconcileVariants(n, basePrompt, prev));
                }}
                className={`px-3 py-1 rounded text-xs border ${
                  variantCount === n ? 'border-node-solution bg-node-solution text-white' : 'border-border bg-card text-muted-foreground hover:border-node-solution'
                }`}
              >
                {n} 个
              </button>
            ))}
            <span className="text-xs text-muted-foreground">（每个为一独立子智能体）</span>
          </div>

          {/* 模式切换 */}
          <div className="flex gap-2 mb-3">
            {GEN_MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setGenMode(m.key)}
                className={`flex-1 px-2 py-2 rounded text-xs border transition-colors ${
                  genMode === m.key ? 'border-node-solution bg-node-solution text-white' : 'border-border bg-card text-muted-foreground hover:border-node-solution'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* 质量 */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-muted-foreground">质量：</span>
            <button onClick={() => setTier('H')} className={`px-3 py-1 rounded text-xs border ${tier === 'H' ? 'border-node-solution bg-node-solution/10 text-node-solution' : 'border-border text-muted-foreground'}`}>H 高保真</button>
            <button onClick={() => setTier('P')} className={`px-3 py-1 rounded text-xs border ${tier === 'P' ? 'border-node-solution bg-node-solution/10 text-node-solution' : 'border-border text-muted-foreground'}`}>P 低多边形</button>
          </div>

          {/* 基础提示词（播种各方案） */}
          {genMode === 'text_to_model' && (
            <div className="mb-3">
              <label className="block text-xs text-muted-foreground mb-1">基础提示词（自动播种到各方案，可单独修改）</label>
              <textarea
                value={basePrompt}
                onChange={(e) => {
                  const v = e.target.value;
                  setBasePrompt(v);
                  setVariants((prev) => prev.map((x, i) => ({ ...x, prompt: v ? seedPrompt(v, VARIANT_LABELS.indexOf(x.label)) : '' })));
                }}
                rows={2}
                className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-2 focus:ring-node-solution"
                placeholder="例如：小钳智能双极电刀 V2 的握把与钳头，符合人体工程学"
              />
            </div>
          )}

          {genMode === 'image_to_model' && (
            <div className="mb-3">
              <input type="file" accept="image/*" onChange={onSingleImageChange} className="hidden" id="single-img" />
              <label htmlFor="single-img" className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-node-solution text-muted-foreground text-xs">
                {singlePreview ? <img src={singlePreview} alt="ref" className="h-16 w-16 object-cover rounded" /> : <><ImageIcon className="w-5 h-5" /> 点击上传单张参考图</>}
              </label>
            </div>
          )}

          {genMode === 'multiview_to_model' && (
            <div className="grid grid-cols-4 gap-2 mb-3">
              {VIEWS.map((vw) => (
                <div key={vw}>
                  <input type="file" accept="image/*" onChange={(e) => onMultiviewChange(vw, e)} className="hidden" id={`mv-${vw}`} />
                  <label htmlFor={`mv-${vw}`} className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-border rounded-lg p-2 cursor-pointer hover:border-node-solution text-muted-foreground">
                    {multiviewPreviews[vw] ? <img src={multiviewPreviews[vw]} alt={vw} className="h-12 w-12 object-cover rounded" /> : <ImageIcon className="w-4 h-4" />}
                    <span className="text-[10px]">{VIEW_LABEL[vw]}视图</span>
                  </label>
                </div>
              ))}
            </div>
          )}

          {/* 各方案卡片 */}
          <div className="space-y-2">
            {variants.map((v) => (
              <div key={v.id} className="border border-border rounded-lg p-3 bg-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-node-solution text-white text-xs flex items-center justify-center font-medium">{v.label}</span>
                    <span className="text-xs text-muted-foreground">方案 {v.label}</span>
                    {v.status === 'generating' && <Loader2 className="w-3.5 h-3.5 animate-spin text-node-solution" />}
                    {v.status === 'done' && <span className="text-[10px] px-2 py-0.5 rounded bg-node-context/10 text-node-context">已完成</span>}
                    {v.status === 'error' && <span className="text-[10px] px-2 py-0.5 rounded bg-destructive/10 text-destructive">失败</span>}
                  </div>
                  <button
                    onClick={() => generateVariant(v.id)}
                    disabled={v.status === 'generating' || generatingAll}
                    className="text-xs px-2.5 py-1 rounded bg-node-solution text-white hover:bg-node-solution/80 disabled:opacity-50"
                  >
                    生成
                  </button>
                </div>
                {genMode === 'text_to_model' && (
                  <textarea
                    value={v.prompt}
                    onChange={(e) => setVariants((prev) => prev.map((x) => x.id === v.id ? { ...x, prompt: e.target.value } : x))}
                    rows={2}
                    className="w-full px-2 py-1.5 text-xs border border-border rounded focus:outline-none focus:ring-1 focus:ring-node-solution"
                    placeholder={`方案 ${v.label} 的描述`}
                  />
                )}
                {v.error && <p className="mt-1 text-[10px] text-destructive">{v.error}</p>}
              </div>
            ))}
          </div>

          {/* 生成全部 + 对比 */}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={generateAll}
              disabled={generatingAll}
              className="flex-1 bg-node-solution hover:bg-node-solution/80 disabled:opacity-50 text-white px-3 py-2 rounded text-sm flex items-center justify-center gap-2"
            >
              {generatingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
              {generatingAll ? '生成中…' : '生成全部方案'}
            </button>
            <button
              onClick={() => openCompare(nodeId)}
              title="全屏对比多个模型"
              className="px-3 py-2 rounded text-sm border border-node-solution text-node-solution hover:bg-node-solution/10 flex items-center gap-1"
            >
              <Maximize2 className="w-4 h-4" /> 对比
            </button>
          </div>

          {genStatusText && (
            <p className="mt-2 text-xs text-muted-foreground">{genStatusText}</p>
          )}
          {genError && (
            <div className="mt-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded p-2 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span className="break-all">{genError}</span>
            </div>
          )}
          <p className="mt-1 text-[10px] text-muted-foreground">
            提示：STP/STEP 不能直接生成 3D，可作为原型存档；图生/多视图需先上传图片。生成消耗 Tripo 额度。双击画布中的方案节点也可进入全屏对比。
          </p>
        </div>

        {/* ===== 3D 模型预览 ===== */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm text-foreground flex items-center gap-2">
              <Box className="w-4 h-4 text-node-solution" /> 3D 模型预览
            </h4>
            {previewUrl && (
              <button
                onClick={() => { setPreviewUrl(null); setPreviewName(''); }}
                className="flex items-center gap-1 px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded hover:bg-accent"
                title="关闭预览窗口"
              >
                <X className="w-3.5 h-3.5" /> 关闭
              </button>
            )}
          </div>
          {previewUrl ? (
            <div>
              <ModelViewer src={previewUrl} alt={previewName} height={320} />
              <p className="mt-1 text-xs text-muted-foreground truncate">{previewName}</p>
            </div>
          ) : (
            <div className="border border-dashed border-border rounded-lg h-[180px] flex items-center justify-center text-muted-foreground text-xs">
              暂无模型可预览（生成、选择 GLB 资产，或点击资产卡片的「预览」切换到此窗口）
            </div>
          )}
        </div>

        {/* ===== 原型资产 ===== */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm text-foreground">原型资产</h4>
            <label className="text-sm text-node-behavior hover:text-node-behavior/80 cursor-pointer flex items-center gap-1">
              <Upload className="w-3.5 h-3.5" />
              {uploading ? '上传中…' : '上传文件'}
              <input ref={fileInputRef} type="file" multiple accept=".stp,.step,.glb,.gltf,.png,.jpg,.jpeg,.webp,.bmp" className="hidden" onChange={(e) => handleAssetUpload(e.target.files)} />
            </label>
          </div>

          {loadingAssets ? (
            <p className="text-xs text-muted-foreground">加载资产中…</p>
          ) : assets.length === 0 ? (
            <p className="text-xs text-muted-foreground">尚无原型资产，可上传 STP / GLB / 图片，或用上方 Tripo3D 生成。</p>
          ) : (
            <div className="space-y-3">
              {assets.map((a) => {
                const tl = assetTypeLabel(a.type);
                const viewable = assetIsViewable(a.type);
                return (
                  <div key={a.id} className="border border-border rounded-lg p-3 bg-card">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-node-solution/10 rounded flex items-center justify-center flex-shrink-0">
                          {a.type === 'reference_image' ? <ImageIcon className="w-5 h-5 text-node-context" />
                            : viewable ? <Box className="w-5 h-5 text-node-behavior" />
                              : <File className="w-5 h-5 text-node-solution" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="text-sm text-foreground truncate">{a.name}</h5>
                            <span className={`text-[10px] px-2 py-0.5 rounded ${tl.cls}`}>{tl.text}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{new Date(a.created_at).toLocaleString()}</p>
                          {a.type === 'reference_image' && a.storage_url && <img src={a.storage_url} alt={a.name} className="mt-2 h-16 rounded border border-border" />}
                        </div>
                      </div>
                      <button onClick={() => handleRemoveAsset(a)} className="p-1 hover:bg-destructive/10 rounded flex-shrink-0 ml-2" title="删除">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                    <div className="flex gap-3 mt-2 pl-[52px]">
                      {viewable && a.storage_url && (
                        <button onClick={() => handlePreviewAsset(a)} className="text-xs text-node-behavior hover:text-node-behavior/80 flex items-center gap-1" title="在上方预览窗口查看此模型（可随时切换）">
                          <Eye className="w-3.5 h-3.5" /> 预览
                        </button>
                      )}
                      {a.storage_url && (
                        <button onClick={() => handleSaveAssetToArchive(a)} className="text-xs text-node-solution hover:text-node-solution/80 flex items-center gap-1" title="绑定到方案卡片并写入节点存档">
                          <Save className="w-3.5 h-3.5" /> 保存
                        </button>
                      )}
                      {a.storage_url && (
                        <a href={a.storage_url} target="_blank" rel="noreferrer" download className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                          <Download className="w-3.5 h-3.5" /> 下载
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function statusText(s: string): string {
  const map: Record<string, string> = {
    queued: '排队中', running: '计算中', success: '完成', failed: '失败', cancelled: '已取消', banned: '已封禁',
  };
  return map[s] || s;
}
