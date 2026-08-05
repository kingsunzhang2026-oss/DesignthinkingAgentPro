import React, { useState, useEffect, useRef } from 'react';
import { Upload, X, File, Box, Image as ImageIcon, Loader2, Sparkles, Trash2, Download, Eye } from 'lucide-react';
import { ModelViewer } from '../ModelViewer';
import {
  generateModel,
  pollUntilDone,
  fetchGlbArrayBuffer,
  getProxiedUrl,
  TripoMode,
  TripoTier,
  TaskStatus,
} from '../../services/tripo3d';
import {
  uploadPrototypeAsset,
  uploadReferenceImageGetUrl,
  saveGeneratedModel,
  getPrototypeAssets,
  deletePrototypeAsset,
  PrototypeAsset,
  AssetType,
} from '../../services/storage';

interface SolutionNodePanelProps {
  nodeId: string;
}

const GEN_MODES: { key: TripoMode; label: string; hint: string }[] = [
  { key: 'text_to_model', label: '文生 3D', hint: '输入文字描述直接生成' },
  { key: 'image_to_model', label: '图生 3D', hint: '上传一张参考图生成' },
  { key: 'multiview_to_model', label: '多视图 3D', hint: '上传前/后/左/右四视图生成' },
];

const VIEWS = ['front', 'back', 'left', 'right'] as const;
const VIEW_LABEL: Record<string, string> = { front: '前', back: '后', left: '左', right: '右' };

function assetTypeLabel(t: AssetType): { text: string; cls: string } {
  switch (t) {
    case 'generated_glb':
      return { text: 'AI 生成', cls: 'bg-purple-100 text-purple-700' };
    case 'uploaded_glb':
      return { text: 'GLB 模型', cls: 'bg-blue-100 text-blue-700' };
    case 'reference_image':
      return { text: '参考图', cls: 'bg-green-100 text-green-700' };
    case 'cad_step':
      return { text: 'CAD/STP', cls: 'bg-orange-100 text-[#FF9500]' };
    default:
      return { text: '文件', cls: 'bg-gray-100 text-gray-600' };
  }
}

function assetIsViewable(t: AssetType): boolean {
  return t === 'generated_glb' || t === 'uploaded_glb';
}

export function SolutionNodePanel({ nodeId }: SolutionNodePanelProps) {
  // ---- 原型资产 ----
  const [assets, setAssets] = useState<PrototypeAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);

  // ---- 预览 ----
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>('');

  // ---- 生成相关 ----
  const [genMode, setGenMode] = useState<TripoMode>('text_to_model');
  const [tier, setTier] = useState<TripoTier>('H');
  const [prompt, setPrompt] = useState('');
  const [singleImage, setSingleImage] = useState<File | null>(null);
  const [singlePreview, setSinglePreview] = useState<string>('');
  const [multiview, setMultiview] = useState<Record<string, File | null>>({
    front: null, back: null, left: null, right: null,
  });
  const [multiviewPreviews, setMultiviewPreviews] = useState<Record<string, string>>({});

  const [generating, setGenerating] = useState(false);
  const [genStatusText, setGenStatusText] = useState('');
  const [genProgress, setGenProgress] = useState<number | null>(null);

  // ---- 资产上传 ----
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载该节点已有资产
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

  useEffect(() => {
    loadAssets();
    // 切换节点时清空预览与生成表单
    setPreviewUrl(null);
    setPreviewName('');
    setPrompt('');
    setSingleImage(null);
    setSinglePreview('');
    setMultiview({ front: null, back: null, left: null, right: null });
    setMultiviewPreviews({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  // ---------- 生成流程 ----------
  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    setGenStatusText('提交生成任务…');
    setGenProgress(null);
    try {
      let imageUrls: string[] | undefined;
      if (genMode === 'image_to_model') {
        if (!singleImage) throw new Error('请先上传一张参考图');
        setGenStatusText('上传参考图…');
        imageUrls = [await uploadReferenceImageGetUrl(singleImage, nodeId)];
      } else if (genMode === 'multiview_to_model') {
        const missing = VIEWS.filter((v) => !multiview[v]);
        if (missing.length > 0) throw new Error('请上传缺失的视图：' + missing.map((v) => VIEW_LABEL[v]).join('、'));
        setGenStatusText('上传多视图…');
        imageUrls = await Promise.all(
          VIEWS.map((v) => uploadReferenceImageGetUrl(multiview[v]!, nodeId))
        );
      } else {
        if (!prompt.trim()) throw new Error('请输入生成描述');
      }

      const taskId = await generateModel({ mode: genMode, tier, prompt: prompt.trim() || undefined, imageUrls });
      setGenStatusText('Tripo 生成中（排队/计算）…');

      const remoteModelUrl = await pollUntilDone(taskId, (s: TaskStatus) => {
        setGenStatusText(`Tripo 生成中：${statusText(s.status)}` + (s.progress != null ? ` ${Math.round(s.progress * 100)}%` : ''));
        setGenProgress(s.progress ?? null);
      });

      // 转存 GLB 到 Storage（规避签名 URL 过期/CORS），失败则回退到代理地址预览
      setGenStatusText('模型完成，正在转存…');
      let finalUrl = '';
      try {
        const buf = await fetchGlbArrayBuffer(remoteModelUrl);
        const asset = await saveGeneratedModel({
          nodeId, taskId, mode: genMode, tier, glbArrayBuffer: buf, fileName: `tripo_${taskId}.glb`,
        });
        finalUrl = asset.storage_url || '';
        setAssets((prev) => [asset, ...prev]);
      } catch (e) {
        console.warn('GLB 转存失败，回退到代理预览', e);
        finalUrl = getProxiedUrl(remoteModelUrl);
      }

      if (finalUrl) {
        setPreviewUrl(finalUrl);
        setPreviewName('Tripo AI 生成模型');
      }
      setGenStatusText('生成完成 ✅');
    } catch (e: any) {
      console.error(e);
      alert('生成失败：' + (e?.message || e));
      setGenStatusText('生成失败');
    } finally {
      setGenerating(false);
    }
  };

  // ---------- 资产上传（STP/GLB/图片） ----------
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
      if (previewUrl === asset.storage_url) {
        setPreviewUrl(null);
        setPreviewName('');
      }
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

  // 单图选择预览
  const onSingleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setSingleImage(f);
    if (singlePreview) URL.revokeObjectURL(singlePreview);
    setSinglePreview(f ? URL.createObjectURL(f) : '');
  };

  // 多视图选择预览
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
    <div className="p-6 space-y-6">
      {/* 标题 */}
      <div>
        <h3 className="text-sm text-gray-900 mb-1">方案节点</h3>
        <p className="text-xs text-gray-600 mb-4">通过 Tripo3D 生成 3D 原型并管理原型资产</p>
      </div>

      {/* ===== Tripo3D 生成 ===== */}
      <div className="border border-purple-200 rounded-lg p-4 bg-purple-50/40">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <h4 className="text-sm text-gray-800">Tripo3D AI 生成 3D 原型</h4>
        </div>

        {/* 模式切换 */}
        <div className="flex gap-2 mb-3">
          {GEN_MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setGenMode(m.key)}
              className={`flex-1 px-2 py-2 rounded text-xs border transition-colors ${
                genMode === m.key
                  ? 'border-purple-500 bg-purple-500 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-purple-300'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* 模型质量 */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs text-gray-600">质量：</span>
          <button
            onClick={() => setTier('H')}
            className={`px-3 py-1 rounded text-xs border ${
              tier === 'H' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-500'
            }`}
          >
            H 高保真
          </button>
          <button
            onClick={() => setTier('P')}
            className={`px-3 py-1 rounded text-xs border ${
              tier === 'P' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-500'
            }`}
          >
            P 低多边形
          </button>
        </div>

        {/* 各模式输入 */}
        {genMode === 'text_to_model' && (
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-400"
            placeholder="例如：小钳智能双极电刀 V2 的握把与钳头，符合人体工程学"
          />
        )}

        {genMode === 'image_to_model' && (
          <div>
            <input type="file" accept="image/*" onChange={onSingleImageChange} className="hidden" id="single-img" />
            <label htmlFor="single-img" className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-4 cursor-pointer hover:border-purple-400 text-gray-500 text-xs">
              {singlePreview ? (
                <img src={singlePreview} alt="ref" className="h-16 w-16 object-cover rounded" />
              ) : (
                <><ImageIcon className="w-5 h-5" /> 点击上传单张参考图</>
              )}
            </label>
          </div>
        )}

        {genMode === 'multiview_to_model' && (
          <div className="grid grid-cols-4 gap-2">
            {VIEWS.map((v) => (
              <div key={v}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onMultiviewChange(v, e)}
                  className="hidden"
                  id={`mv-${v}`}
                />
                <label htmlFor={`mv-${v}`} className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 rounded-lg p-2 cursor-pointer hover:border-purple-400 text-gray-500">
                  {multiviewPreviews[v] ? (
                    <img src={multiviewPreviews[v]} alt={v} className="h-12 w-12 object-cover rounded" />
                  ) : (
                    <ImageIcon className="w-4 h-4" />
                  )}
                  <span className="text-[10px]">{VIEW_LABEL[v]}视图</span>
                </label>
              </div>
            ))}
          </div>
        )}

        {/* 生成按钮 + 状态 */}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm flex items-center justify-center gap-2"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? '生成中…' : '开始生成'}
          </button>
        </div>
        {genStatusText && (
          <p className="mt-2 text-xs text-gray-600">
            {genStatusText}
            {genProgress != null && (
              <span className="ml-2 inline-block w-full max-w-[120px] h-1.5 bg-gray-200 rounded overflow-hidden align-middle">
                <span className="block h-full bg-purple-500" style={{ width: `${Math.round(genProgress * 100)}%` }} />
              </span>
            )}
          </p>
        )}
        <p className="mt-1 text-[10px] text-gray-400">
          提示：STP/STEP 不能直接生成 3D，可作为原型存档；图生/多视图需先上传图片。生成消耗 Tripo 额度。
        </p>
      </div>

      {/* ===== 3D 模型预览 ===== */}
      <div>
        <h4 className="text-sm text-gray-700 mb-2 flex items-center gap-2">
          <Box className="w-4 h-4 text-[#FF9500]" /> 3D 模型预览
        </h4>
        {previewUrl ? (
          <div>
            <ModelViewer src={previewUrl} alt={previewName} height={360} />
            <p className="mt-1 text-xs text-gray-500 truncate">{previewName}</p>
          </div>
        ) : (
          <div className="border border-dashed border-gray-300 rounded-lg h-[200px] flex items-center justify-center text-gray-400 text-xs">
            暂无模型可预览（生成或选择 GLB 资产后在此显示）
          </div>
        )}
      </div>

      {/* ===== 原型资产 ===== */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm text-gray-700">原型资产</h4>
          <label className="text-sm text-[#007AFF] hover:text-[#0051D5] cursor-pointer flex items-center gap-1">
            <Upload className="w-3.5 h-3.5" />
            {uploading ? '上传中…' : '上传文件'}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".stp,.step,.glb,.gltf,.png,.jpg,.jpeg,.webp,.bmp"
              className="hidden"
              onChange={(e) => handleAssetUpload(e.target.files)}
            />
          </label>
        </div>

        {loadingAssets ? (
          <p className="text-xs text-gray-400">加载资产中…</p>
        ) : assets.length === 0 ? (
          <p className="text-xs text-gray-400">尚无原型资产，可上传 STP / GLB / 图片，或用上方 Tripo3D 生成。</p>
        ) : (
          <div className="space-y-3">
            {assets.map((a) => {
              const tl = assetTypeLabel(a.type);
              const viewable = assetIsViewable(a.type);
              return (
                <div key={a.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-orange-100 rounded flex items-center justify-center flex-shrink-0">
                        {a.type === 'reference_image' ? (
                          <ImageIcon className="w-5 h-5 text-green-600" />
                        ) : viewable ? (
                          <Box className="w-5 h-5 text-blue-600" />
                        ) : (
                          <File className="w-5 h-5 text-[#FF9500]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="text-sm text-gray-900 truncate">{a.name}</h5>
                          <span className={`text-[10px] px-2 py-0.5 rounded ${tl.cls}`}>{tl.text}</span>
                          {a.version && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600">{a.version}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {new Date(a.created_at).toLocaleString()}
                        </p>
                        {/* 参考图缩略图 */}
                        {a.type === 'reference_image' && a.storage_url && (
                          <img src={a.storage_url} alt={a.name} className="mt-2 h-16 rounded border border-gray-200" />
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveAsset(a)}
                      className="p-1 hover:bg-red-100 rounded flex-shrink-0 ml-2"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                  {/* 操作 */}
                  <div className="flex gap-3 mt-2 pl-[52px]">
                    {viewable && a.storage_url && (
                      <button
                        onClick={() => handlePreviewAsset(a)}
                        className="text-xs text-[#007AFF] hover:text-[#0051D5] flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> 预览
                      </button>
                    )}
                    {a.storage_url && (
                      <a
                        href={a.storage_url}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                      >
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

      {/* ===== 方案对比 ===== */}
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <h4 className="text-sm text-gray-700 mb-2">方案对比</h4>
        <p className="text-xs text-gray-600">将多个原型资产连接到对齐节点进行横向对比评估</p>
      </div>
    </div>
  );
}

function statusText(s: string): string {
  const map: Record<string, string> = {
    queued: '排队中',
    running: '计算中',
    success: '完成',
    failed: '失败',
    cancelled: '已取消',
    banned: '已封禁',
  };
  return map[s] || s;
}
