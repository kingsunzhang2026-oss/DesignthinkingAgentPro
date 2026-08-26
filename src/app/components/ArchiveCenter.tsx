/**
 * 存档中心 —— 集中查看 / 删除 / 导出所有云端存档
 * 数据源：
 *  - node_panel_data 表（loadAllPanelStates）：各节点面板存档 + 录音记录(records/global)
 *  - prototype_assets 表（getAllPrototypeAssets）：数字资产（参考图/上传 GLB/STP/AI 生成 GLB）
 *  - documents 表（getKnowledgeDocs）：知识库文档
 * 每条目标注类型 + 用户信息 + 时间戳；支持单条删除 / 整组清空 / JSON 全量导出 / Word 清单导出。
 */
import React, { useState, useEffect, useCallback } from 'react';
import { X, Download, Trash2, Database, FileText, Box, Loader2, FolderOpen, AlertTriangle } from 'lucide-react';
import { loadAllPanelStates, deletePanelState, PanelStateRow } from '../services/panelArchive';
import {
  getAllPrototypeAssets, deletePrototypeAsset, getKnowledgeDocs, deleteKnowledgeDoc,
  PrototypeAsset, KnowledgeDoc,
} from '../services/storage';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

interface ArchiveCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Entry {
  key: string;
  group: '面板存档' | '录音记录' | '数字资产' | '知识库';
  label: string;
  detail: string;
  user: string;
  at: string;
  /** 删除动作 */
  onDelete?: () => Promise<void>;
}

function fmtTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}

function summarize(v: any, max = 60): string {
  if (v == null) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > max ? s.slice(0, max) + '…' : s;
}

const TYPE_LABEL: Record<string, string> = {
  context: '情境', behavior: '行为', alignment: '对齐', problem: '问题', solution: '方案', value: '价值', records: '录音',
};

export function ArchiveCenter({ isOpen, onClose }: ArchiveCenterProps) {
  const [panelStates, setPanelStates] = useState<PanelStateRow[]>([]);
  const [assets, setAssets] = useState<PrototypeAsset[]>([]);
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'json' | 'docx' | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [ps, as, ds] = await Promise.all([
        loadAllPanelStates('default'),
        getAllPrototypeAssets(500),
        getKnowledgeDocs(),
      ]);
      setPanelStates(ps);
      setAssets(as);
      setDocs(ds);
    } catch (e) {
      console.error('加载存档失败', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) reload();
  }, [isOpen, reload]);

  // —— 构建统一条目 ——
  const entries: Entry[] = [];

  // 录音记录（records/global）
  const recRows = panelStates.filter((p) => p.panel_type === 'records' && p.node_id === 'global');
  for (const row of recRows) {
    const recs = Array.isArray(row.data?.recordings) ? row.data.recordings : [];
    const metaUser = row.data?._meta?.user;
    entries.push({
      key: `rec-${row.panel_type}-${row.node_id}`,
      group: '录音记录',
      label: `录音记录（${recs.length} 段）`,
      detail: recs
        .slice(0, 3)
        .map((r: any) => `${r.scenarioId || ''}${r.transcript ? '·已转写' : ''}`)
        .join('、') || summarize(row.data, 50),
      user: metaUser || recs[0]?.account || '—',
      at: row.updated_at,
      onDelete: () => deletePanelState('default', row.node_id, row.panel_type as any),
    });
  }

  // 面板存档（其余 node_panel_data）
  const panelRows = panelStates.filter((p) => !(p.panel_type === 'records' && p.node_id === 'global'));
  for (const row of panelRows) {
    entries.push({
      key: `panel-${row.panel_type}-${row.node_id}`,
      group: '面板存档',
      label: `${TYPE_LABEL[row.panel_type] || row.panel_type}节点 · ${row.node_id}`,
      detail: summarize(row.data, 80),
      user: row.data?._meta?.user || '—',
      at: row.updated_at,
      onDelete: () => deletePanelState('default', row.node_id, row.panel_type as any),
    });
  }

  // 数字资产
  for (const a of assets) {
    entries.push({
      key: `asset-${a.id}`,
      group: '数字资产',
      label: a.name || a.id,
      detail: `${a.type}${a.node_id ? ` · ${a.node_id}` : ''}`,
      user: '—',
      at: a.created_at,
      onDelete: () => deletePrototypeAsset(a),
    });
  }

  // 知识库文档
  for (const d of docs) {
    entries.push({
      key: `doc-${d.id}`,
      group: '知识库',
      label: d.name || d.id,
      detail: `${d.type || ''} · ${Math.round((d.size || 0) / 1024)}KB`,
      user: '—',
      at: d.uploaded_at,
      onDelete: () => deleteKnowledgeDoc(d),
    });
  }

  const groups: { title: string; icon: React.ReactNode; entries: Entry[] }[] = [
    { title: '📋 面板存档', icon: null, entries: entries.filter((e) => e.group === '面板存档') },
    { title: '🎙 录音记录', icon: null, entries: entries.filter((e) => e.group === '录音记录') },
    { title: '📦 数字资产', icon: null, entries: entries.filter((e) => e.group === '数字资产') },
    { title: '📚 知识库', icon: null, entries: entries.filter((e) => e.group === '知识库') },
  ].filter((g) => g.entries.length > 0);

  const removeEntry = async (e: Entry) => {
    if (!e.onDelete) return;
    if (!confirm(`确认删除「${e.label}」？${e.group === '数字资产' ? '对应存储文件将一并删除。' : ''}`)) return;
    setBusyKey(e.key);
    try {
      await e.onDelete();
      await reload();
    } catch (err: any) {
      alert('删除失败：' + (err?.message || err));
    } finally {
      setBusyKey(null);
    }
  };

  const clearGroup = async (g: { title: string; entries: Entry[] }) => {
    if (g.entries.length === 0) return;
    if (!confirm(`确认清空「${g.title}」全部 ${g.entries.length} 条？此操作不可恢复。`)) return;
    setBusyKey('clear-' + g.title);
    try {
      for (const e of g.entries) {
        if (e.onDelete) await e.onDelete();
      }
      await reload();
    } catch (err: any) {
      alert('清空失败：' + (err?.message || err));
    } finally {
      setBusyKey(null);
    }
  };

  const clearAll = async () => {
    if (entries.length === 0) return;
    if (!confirm(`确认清空全部存档（${entries.length} 条，含面板存档/录音/资产/知识库）？此操作不可恢复。`)) return;
    setBusyKey('clear-all');
    try {
      for (const e of entries) if (e.onDelete) await e.onDelete();
      await reload();
    } catch (err: any) {
      alert('清空失败：' + (err?.message || err));
    } finally {
      setBusyKey(null);
    }
  };

  // —— 导出 ——
  const exportJson = async () => {
    setExporting('json');
    try {
      const blob = new Blob(
        [JSON.stringify({ exportedAt: new Date().toISOString(), panelStates, assets, docs }, null, 2)],
        { type: 'application/json' },
      );
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `存档全量导出_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExporting(null);
    }
  };

  const exportDocx = async () => {
    setExporting('docx');
    try {
      const children: any[] = [
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('设计思维智能体 · 存档清单')] }),
        new Paragraph({ children: [new TextRun(`导出时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`)] }),
        new Paragraph({ children: [new TextRun(`共 ${entries.length} 条存档记录`) ] }),
      ];
      for (const g of groups) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(g.title)] }));
        for (const e of g.entries) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `• ${e.label}`, bold: true }),
                new TextRun({ text: `　类型：${e.group}` }),
                new TextRun({ text: `　用户：${e.user}` }),
                new TextRun({ text: `　时间：${fmtTime(e.at)}` }),
                new TextRun({ text: `　内容：${e.detail}` }),
              ],
            }),
          );
        }
      }
      const doc = new Document({ sections: [{ properties: {}, children }] });
      const blob = await Packer.toBlob(doc);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `存档清单_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.docx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err: any) {
      alert('Word 导出失败：' + (err?.message || err));
    } finally {
      setExporting(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-card border border-border rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-sm text-foreground flex items-center gap-2">
            <Database className="w-4 h-4 text-node-solution" /> 存档中心
            <span className="text-[11px] text-muted-foreground">共 {entries.length} 条</span>
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-accent rounded text-muted-foreground" title="关闭">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border flex-wrap">
          <button
            onClick={exportJson}
            disabled={exporting !== null}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-node-solution text-white rounded hover:bg-node-solution/80 disabled:opacity-50"
          >
            {exporting === 'json' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            导出全量 JSON
          </button>
          <button
            onClick={exportDocx}
            disabled={exporting !== null}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-node-solution text-white rounded hover:bg-node-solution/80 disabled:opacity-50"
          >
            {exporting === 'docx' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            导出 Word 清单
          </button>
          <div className="flex-1" />
          <button
            onClick={clearAll}
            disabled={entries.length === 0 || busyKey !== null}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-destructive border border-destructive/30 rounded hover:bg-destructive/10 disabled:opacity-40"
          >
            <AlertTriangle className="w-3.5 h-3.5" /> 清空全部
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> 加载存档…
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">暂无存档记录</div>
          ) : (
            groups.map((g) => (
              <div key={g.title}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs text-foreground flex items-center gap-1.5">{g.title}</h3>
                  <button
                    onClick={() => clearGroup(g)}
                    disabled={busyKey !== null}
                    className="text-[11px] text-muted-foreground hover:text-destructive disabled:opacity-40 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> 清空本组
                  </button>
                </div>
                <div className="space-y-1.5">
                  {g.entries.map((e) => (
                    <div key={e.key} className="flex items-start justify-between gap-2 border border-border rounded-lg px-3 py-2 bg-muted/40">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-foreground font-medium truncate">{e.label}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-node-solution/10 text-node-solution">{e.group}</span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Box className="w-2.5 h-2.5" /> {e.user}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{fmtTime(e.at)}</span>
                        </div>
                        {e.detail && <div className="mt-0.5 text-[11px] text-muted-foreground truncate">{e.detail}</div>}
                      </div>
                      <button
                        onClick={() => removeEntry(e)}
                        disabled={busyKey !== null}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded flex-shrink-0 disabled:opacity-40"
                        title="删除该条"
                      >
                        {busyKey === e.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-2.5 border-t border-border flex items-center gap-2 text-[11px] text-muted-foreground">
          <FolderOpen className="w-3.5 h-3.5" />
          删除条目会同步清除 Supabase 中的对应记录与存储文件，用于释放存储空间。
        </div>
      </div>
    </div>
  );
}
