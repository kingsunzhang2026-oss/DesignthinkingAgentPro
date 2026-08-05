/**
 * Tripo3D 前端服务
 * 对接 Supabase Edge Function: tripo3d-proxy
 *   POST /functions/v1/tripo3d-proxy/generate  { mode, tier, prompt?, imageUrls? }
 *   GET  /functions/v1/tripo3d-proxy/task?taskId=xxx
 *   GET  /functions/v1/tripo3d-proxy/proxy?url=<tripo_glb_url>   (CORS 转发 GLB)
 *
 * 注意：所有 Tripo API Key 都在服务端（Edge Function）持有，前端只调代理。
 */
import { projectId } from '../utils/supabase/info';

const FN_BASE = `https://${projectId}.supabase.co/functions/v1/tripo3d-proxy`;

export type TripoMode = 'text_to_model' | 'image_to_model' | 'multiview_to_model';
export type TripoTier = 'H' | 'P';

export interface TaskStatus {
  ok: boolean;
  taskId: string;
  status: string; // queued | running | success | failed | cancelled | banned
  progress?: number | null;
  modelUrl?: string | null;
  raw?: any;
  error?: string;
}

/**
 * 提交一个 Tripo 生成任务，返回 taskId（用于轮询）
 */
export async function generateModel(opts: {
  mode: TripoMode;
  tier: TripoTier;
  prompt?: string;
  imageUrls?: string[];
}): Promise<string> {
  const res = await fetch(`${FN_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error('Tripo 生成提交失败: ' + (data.error || res.status));
  }
  if (!data.taskId) {
    throw new Error('Tripo 未返回 taskId: ' + JSON.stringify(data));
  }
  return data.taskId;
}

/**
 * 查询单个任务状态
 */
export async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  const res = await fetch(`${FN_BASE}/task?taskId=${encodeURIComponent(taskId)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error('查询任务失败: ' + (data.error || res.status));
  }
  return data as TaskStatus;
}

/**
 * 把 Tripo 的 GLB 签名 URL 转成经我们代理的地址，绕开浏览器 CORS 限制
 */
export function getProxiedUrl(modelUrl: string): string {
  return `${FN_BASE}/proxy?url=${encodeURIComponent(modelUrl)}`;
}

/**
 * 轮询任务直到 success（或失败/超时）。每 3 秒一次，最多 ~6 分钟。
 * 返回成功时的远程 GLB 地址（生产预览建议再用 saveGeneratedModel 转存到 Storage）。
 */
export async function pollUntilDone(
  taskId: string,
  onTick?: (s: TaskStatus) => void
): Promise<string> {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 120; i++) {
    const s = await getTaskStatus(taskId);
    onTick?.(s);
    if (s.status === 'success' && s.modelUrl) return s.modelUrl;
    if (s.status === 'failed' || s.status === 'cancelled' || s.status === 'banned') {
      throw new Error('Tripo 任务失败: ' + s.status + (s.error ? ` (${s.error})` : ''));
    }
    await sleep(3000);
  }
  throw new Error('Tripo 生成超时（超过 6 分钟）');
}

/**
 * 经代理下载 GLB 二进制（用于转存到 Supabase Storage，规避签名 URL 过期 / CORS）
 */
export async function fetchGlbArrayBuffer(modelUrl: string): Promise<ArrayBuffer> {
  const proxied = getProxiedUrl(modelUrl);
  const res = await fetch(proxied);
  if (!res.ok) throw new Error('GLB 下载失败: ' + res.status);
  return await res.arrayBuffer();
}
