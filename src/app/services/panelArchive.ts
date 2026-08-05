/**
 * 节点面板存档服务 —— 让每个节点面板的 state 写入 Supabase，刷新不丢失。
 *
 * 用法（任意面板）：
 *   const { data, save, loading, lastSavedAt } = usePanelArchive({
 *     projectId: 'default',
 *     nodeId: 'behavior-123',
 *     panelType: 'behavior',
 *   });
 *   // data 是上次存档的 JSON；save(data) 触发 upsert。
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../utils/supabase/client';

export type PanelType = 'context' | 'behavior' | 'alignment' | 'problem' | 'solution' | 'value';

export interface UsePanelArchiveOpts {
  projectId?: string;
  nodeId: string;
  panelType: PanelType;
  /** 初始默认值，load 失败或无存档时使用 */
  initial?: any;
  /** load 后是否立即用 initial 覆盖（默认 false，保留存档） */
  preferInitial?: boolean;
}

export interface UsePanelArchiveResult<T = any> {
  data: T | undefined;
  loading: boolean;
  saving: boolean;
  lastSavedAt: string | null;
  save: (next: T) => Promise<void>;
  reset: () => Promise<void>;
}

export async function loadPanelState<T = any>(
  projectId: string,
  nodeId: string,
  panelType: PanelType,
): Promise<{ data: T | null; updatedAt: string | null }> {
  const { data, error } = await supabase
    .from('node_panel_data')
    .select('data, updated_at')
    .eq('project_id', projectId)
    .eq('node_id', nodeId)
    .eq('panel_type', panelType)
    .maybeSingle();
  if (error) {
    console.warn('loadPanelState error', error);
    return { data: null, updatedAt: null };
  }
  if (!data) return { data: null, updatedAt: null };
  return { data: data.data as T, updatedAt: data.updated_at as string };
}

export async function savePanelState<T = any>(
  projectId: string,
  nodeId: string,
  panelType: PanelType,
  payload: T,
): Promise<string> {
  const { data, error } = await supabase
    .from('node_panel_data')
    .upsert(
      {
        project_id: projectId,
        node_id: nodeId,
        panel_type: panelType,
        data: payload as any,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_id,node_id,panel_type' },
    )
    .select('updated_at')
    .single();
  if (error) throw new Error('存档失败: ' + error.message);
  return data?.updated_at || new Date().toISOString();
}

export async function deletePanelState(
  projectId: string,
  nodeId: string,
  panelType: PanelType,
): Promise<void> {
  const { error } = await supabase
    .from('node_panel_data')
    .delete()
    .eq('project_id', projectId)
    .eq('node_id', nodeId)
    .eq('panel_type', panelType);
  if (error) throw new Error('删除存档失败: ' + error.message);
}

export interface PanelStateRow {
  project_id: string;
  node_id: string;
  panel_type: PanelType;
  data: any;
  updated_at: string;
}

/** 加载某项目下所有节点存档（用于导出设计报告时汇总） */
export async function loadAllPanelStates(projectId: string): Promise<PanelStateRow[]> {
  const { data, error } = await supabase
    .from('node_panel_data')
    .select('project_id, node_id, panel_type, data, updated_at')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error('加载存档失败: ' + error.message);
  return (data || []) as PanelStateRow[];
}

export function usePanelArchive<T = any>(opts: UsePanelArchiveOpts): UsePanelArchiveResult<T> {
  const { projectId = 'default', nodeId, panelType, initial } = opts;
  const [data, setData] = useState<T | undefined>(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const loadOnce = useRef(false);

  // Load on mount / nodeId change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadPanelState<T>(projectId, nodeId, panelType).then((res) => {
      if (cancelled) return;
      if (res.data != null) {
        setData(res.data);
      } else if (initial !== undefined) {
        setData(initial);
      }
      setLastSavedAt(res.updatedAt);
      setLoading(false);
      loadOnce.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, nodeId, panelType]);

  const save = useCallback(
    async (next: T) => {
      setSaving(true);
      try {
        const ts = await savePanelState(projectId, nodeId, panelType, next);
        setData(next);
        setLastSavedAt(ts);
      } finally {
        setSaving(false);
      }
    },
    [projectId, nodeId, panelType],
  );

  const reset = useCallback(async () => {
    await deletePanelState(projectId, nodeId, panelType);
    setData(initial);
    setLastSavedAt(null);
  }, [projectId, nodeId, panelType]);

  return { data, loading, saving, lastSavedAt, save, reset };
}