/**
 * 全屏方案对比视图
 * 双击画布中的方案节点（或方案面板"对比"按钮）触发。
 * - 1×2 / 2×2 / 2×3 三种窗口排布
 * - 首格固定为"基准产品模型"（可空，可上传）
 * - 其余格为方案节点生成的 GLB 模型，支持拖拽重排
 */
import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Download, Box, GripVertical, RotateCcw } from 'lucide-react';
import { ModelViewer } from './ModelViewer';
import { useDesignStore } from '../services/designStore';
import {
  getPrototypeAssets, uploadPrototypeAsset, deletePrototypeAsset,
  PrototypeAsset,
} from '../services/storage';

const LAYOUTS = [
  { n: 2, cols: 2, label: '1×2' },
  { n: 4, cols: 2, label: '2×2' },
  { n: 6, cols: 3, label: '2×3' },
];

export function SolutionCompareView() {
  const { compareNodeId, closeCompare } = useDesignStore();
  const [assets, setAssets] = useState<PrototypeAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [layoutN, setLayoutN] = useState(4);
  const [order, setOrder] = useState<string[]>([]); // 非基准模型的 asset id 顺序
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const baseInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!compareNodeId) return;
    let cancelled = false;
    setLoading(true);
    getPrototypeAssets(compareNodeId)
      .then((list) => {
        if (cancelled) return;
        setAssets(list);
      })
      .catch((e) => console.error('加载对比资产失败', e))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [compareNodeId]);

  // 非基准可预览模型
  const baseline = assets.find((a) => a.version === 'baseline' && (a.type === 'generated_glb' || a.type === 'uploaded_glb'));
  const others = assets.filter(
    (a) => (a.type === 'generated_glb' || a.type === 'uploaded_glb') && a.version !== 'baseline',
  );

  // 同步拖拽顺序：保证 order 与 others 一致（按现有顺序保留已排，新增追加）
  useEffect(() => {
    setOrder((prev) => {
      const existing = prev.filter((id) => others.some((a) => a.id === id));
      const added = others.filter((a) => !existing.includes(a.id)).map((a) => a.id);
      return [...existing, ...added];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [others.map((a) => a.id).join(',')]);

  if (!compareNodeId) return null;

  const cols = LAYOUTS.find((l) => l.n === layoutN)?.cols ?? 2;
  const slotCount = layoutN - 1; // 扣除首格基准
  const orderedOthers = order
    .map((id) => others.find((a) => a.id === id))
    .filter((a): a is PrototypeAsset => Boolean(a));
  const restCells: (PrototypeAsset | null)[] = [
    ...orderedOthers.slice(0, slotCount),
    ...Array(Math.max(0, slotCount - orderedOthers.length)).fill(null),
  ];

  const handleBaselineUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !compareNodeId) return;
    try {
      const file = files[0];
      const asset = await uploadPrototypeAsset({
        file, nodeId: compareNodeId, type: 'uploaded_glb', version: 'baseline', source: 'baseline',
      });
      setAssets((prev) => [asset, ...prev]);
    } catch (e: any) {
      alert('基准模型上传失败：' + (e?.message || e));
    }
  };

  const handleRemove = async (asset: PrototypeAsset) => {
    if (!confirm(`确认删除模型「${asset.name}」？`)) return;
    try {
      await deletePrototypeAsset(asset);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      setOrder((prev) => prev.filter((id) => id !== asset.id));
    } catch (e: any) {
      alert('删除失败：' + (e?.message || e));
    }
  };

  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    setOrder((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F5F5F7] text-gray-900 flex flex-col">
      {/* 顶部工具栏 */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <Box className="w-4 h-4 text-[#FF9500]" />
          <h2 className="text-sm">方案对比视图 · {compareNodeId}</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">布局</span>
          {LAYOUTS.map((l) => (
            <button
              key={l.n}
              onClick={() => setLayoutN(l.n)}
              className={`px-2.5 py-1 rounded text-xs border ${
                layoutN === l.n ? 'border-[#FF9500] bg-[#FF9500] text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {l.label}
            </button>
          ))}
          <button onClick={closeCompare} className="p-1.5 rounded hover:bg-gray-100" title="关闭">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 模型网格 */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">加载模型中…</div>
        ) : (
          <div
            className="grid gap-4 h-full"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {/* 首格：基准产品模型 */}
            <div className="relative rounded-xl border border-dashed border-gray-300 bg-white flex flex-col items-center justify-center overflow-hidden">
              <span className="absolute top-2 left-3 text-[10px] px-2 py-0.5 rounded bg-[#5856D6] text-white">基准</span>
              {baseline?.storage_url ? (
                <>
                  <ModelViewer src={baseline.storage_url} alt="基准模型" height={260} />
                  <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] text-gray-500">
                    <span className="truncate">{baseline.name}</span>
                    <div className="flex gap-2">
                      <a href={baseline.storage_url} target="_blank" rel="noreferrer" download className="hover:text-gray-700"><Download className="w-3.5 h-3.5" /></a>
                      <button onClick={() => handleRemove(baseline)} className="hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </>
              ) : (
                <label className="cursor-pointer flex flex-col items-center gap-2 text-gray-400 hover:text-gray-600">
                  <input ref={baseInputRef} type="file" accept=".glb,.gltf" className="hidden" onChange={(e) => handleBaselineUpload(e.target.files)} />
                  <Upload className="w-7 h-7" />
                  <span className="text-xs">上传基准产品模型（GLB）</span>
                </label>
              )}
            </div>

            {/* 其余方案模型格 */}
            {restCells.map((asset, i) => (
              <div
                key={asset?.id || `empty-${i}`}
                draggable={Boolean(asset)}
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
                onDrop={(e) => { e.preventDefault(); if (dragIdx !== null) reorder(dragIdx, i); setDragIdx(null); setOverIdx(null); }}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                className={`relative rounded-xl border bg-white flex flex-col items-center justify-center overflow-hidden transition-colors ${
                  overIdx === i && dragIdx !== null ? 'border-[#FF9500]' : 'border-gray-200'
                }`}
              >
                {asset ? (
                  <>
                    <span className="absolute top-2 left-3 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-[#FF9500] text-white">
                      <GripVertical className="w-3 h-3 cursor-grab" /> 方案 {i + 1}
                    </span>
                    <ModelViewer src={asset.storage_url || ''} alt={asset.name} height={260} />
                    <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] text-gray-500">
                      <span className="truncate">{asset.name}</span>
                      <div className="flex gap-2">
                        <a href={asset.storage_url || ''} target="_blank" rel="noreferrer" download className="hover:text-gray-700"><Download className="w-3.5 h-3.5" /></a>
                        <button onClick={() => handleRemove(asset)} className="hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-gray-400 text-xs flex flex-col items-center gap-1">
                    <RotateCcw className="w-5 h-5" />
                    空位（生成更多方案或拖入模型）
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div className="h-9 flex items-center px-6 border-t border-gray-200 bg-white text-[11px] text-gray-500">
        首格为基准产品模型（可上传 GLB）；其余格为方案节点生成的模型，可拖拽重排对比。
      </div>
    </div>
  );
}
