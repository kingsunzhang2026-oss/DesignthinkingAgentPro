/**
 * Supabase Storage + 数据库持久化服务
 * 负责：知识库文档、方案节点原型资产、Tripo 生成 GLB 的上传/读取/删除。
 *
 * 表：documents / prototype_assets / generated_models
 * Bucket（均 public）：knowledge-base / prototype-assets / generated-models
 *
 * 重要：所有 Storage/DB 操作统一走「匿名 client」（supabaseAnon）。
 * 原因：prototype-assets 等 bucket 的 RLS 仅放行 anon 角色，用登录身份的
 *       authenticated 角色反而会被拦截（录音上传曾因此失败，已修复为 anon 直传）。
 *       这里同样处理，保证登录/未登录都能读写。
 */
import { supabase } from '../utils/supabase/client';
import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../utils/supabase/info';

// 匿名客户端：规避"已登录用户(authenticated)被 storage RLS 拦截"导致上传失败。
// 所有 bucket 为 public 且 anon 已验证可写/可读；登录/未登录均以此身份操作。
// 导出供 panelArchive 等其它服务复用（node_panel_data 等表 RLS 同样只放行 anon）。
export const supabaseAnon = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// 当前为单项目原型，固定项目标识；后续接入多项目时改为动态
export const PROJECT_ID = 'xiaojian-bipolar-v2';

export interface KnowledgeDoc {
  id: string;
  name: string;
  type: string;
  size: number;
  storage_path: string;
  storage_url: string;
  uploaded_at: string;
}

/** 原型资产类型 */
export type AssetType = 'cad_step' | 'reference_image' | 'generated_glb' | 'uploaded_glb';

export interface PrototypeAsset {
  id: string;
  node_id: string | null;
  project_id: string | null;
  name: string;
  type: AssetType;
  version: string | null;
  storage_path: string | null;
  storage_url: string | null;
  source: string | null;
  created_at: string;
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// ---------- 知识库文档 ----------

export async function uploadKnowledgeDoc(file: File): Promise<KnowledgeDoc> {
  const path = `${Date.now()}_${sanitize(file.name)}`;
  const { error: upErr } = await supabaseAnon.storage
    .from('knowledge-base')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (upErr) throw new Error('文档上传失败: ' + upErr.message);

  const { data: urlData } = supabaseAnon.storage.from('knowledge-base').getPublicUrl(path);

  const { data, error: dbErr } = await supabaseAnon
    .from('documents')
    .insert({
      name: file.name,
      type: file.type || file.name.split('.').pop() || 'unknown',
      size: file.size,
      storage_path: path,
      storage_url: urlData.publicUrl,
    })
    .select()
    .single();
  if (dbErr) throw new Error('文档元数据写入失败: ' + dbErr.message);
  return data as KnowledgeDoc;
}

export async function getKnowledgeDocs(): Promise<KnowledgeDoc[]> {
  const { data, error } = await supabaseAnon
    .from('documents')
    .select('*')
    .order('uploaded_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as KnowledgeDoc[];
}

export async function deleteKnowledgeDoc(doc: KnowledgeDoc): Promise<void> {
  if (doc.storage_path) {
    await supabaseAnon.storage.from('knowledge-base').remove([doc.storage_path]);
  }
  const { error } = await supabaseAnon.from('documents').delete().eq('id', doc.id);
  if (error) throw new Error(error.message);
}

// ---------- 方案节点原型资产 ----------

/**
 * 上传任意原型资产文件（STP / GLB / 图片），写入 prototype_assets 表
 */
export async function uploadPrototypeAsset(params: {
  file: File;
  nodeId: string;
  name?: string;
  version?: string;
  type: AssetType;
  source?: string;
}): Promise<PrototypeAsset> {
  const path = `${params.nodeId}/${Date.now()}_${sanitize(params.file.name)}`;
  const { error: upErr } = await supabaseAnon.storage
    .from('prototype-assets')
    .upload(path, params.file, { cacheControl: '3600', upsert: false });
  if (upErr) throw new Error('资产上传失败: ' + upErr.message);

  const { data: urlData } = supabaseAnon.storage.from('prototype-assets').getPublicUrl(path);

  const { data, error: dbErr } = await supabaseAnon
    .from('prototype_assets')
    .insert({
      node_id: params.nodeId,
      project_id: PROJECT_ID,
      name: params.name || params.file.name,
      type: params.type,
      version: params.version || null,
      storage_path: path,
      storage_url: urlData.publicUrl,
      source: params.source || null,
    })
    .select()
    .single();
  if (dbErr) throw new Error('资产元数据写入失败: ' + dbErr.message);
  return data as PrototypeAsset;
}

/**
 * 上传一张参考图，返回公开 URL（用于作为 Tripo 图生/多视图生成的输入）
 */
export async function uploadReferenceImageGetUrl(file: File, nodeId: string): Promise<string> {
  const path = `${nodeId}/refs/${Date.now()}_${sanitize(file.name)}`;
  const { error: upErr } = await supabaseAnon.storage
    .from('prototype-assets')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (upErr) throw new Error('参考图上传失败: ' + upErr.message);
  return supabaseAnon.storage.from('prototype-assets').getPublicUrl(path).data.publicUrl;
}

/**
 * 将 Tripo 生成的 GLB 转存到 Storage（优先 generated-models bucket；若该 bucket 未创建
 * 或写入失败，自动回退 prototype-assets，保证生成模型可持久化），
 * 同时写入 generated_models 审计表 + prototype_assets 资产表。
 * 返回可直接在 <model-viewer> 中加载的公开 URL。
 */
export async function saveGeneratedModel(params: {
  nodeId: string;
  taskId: string;
  mode: string;
  tier: string;
  glbArrayBuffer: ArrayBuffer;
  fileName: string;
}): Promise<PrototypeAsset> {
  const stamp = Date.now();
  const safeName = sanitize(params.fileName);
  const uploadOpts = {
    cacheControl: '3600',
    upsert: false,
    contentType: 'model/gltf-binary',
  };

  // 优先 generated-models，失败（bucket 缺失 / RLS）回退 prototype-assets
  let bucket = 'generated-models';
  let path = `${params.nodeId}/generated/${stamp}_${safeName}`;
  const first = await supabaseAnon.storage.from(bucket).upload(path, params.glbArrayBuffer, uploadOpts);
  if (first.error) {
    console.warn(`[storage] ${bucket} 上传失败，回退 prototype-assets:`, first.error.message);
    bucket = 'prototype-assets';
    path = `${params.nodeId}/generated/${stamp}_${safeName}`;
    const fb = await supabaseAnon.storage.from(bucket).upload(path, params.glbArrayBuffer, uploadOpts);
    if (fb.error) throw new Error('GLB 转存失败: ' + fb.error.message);
  }

  const { data: urlData } = supabaseAnon.storage.from(bucket).getPublicUrl(path);

  // 审计记录（bucket 缺失时也记录，避免插表失败阻断主流程）
  const audErr = await supabaseAnon.from('generated_models').insert({
    task_id: params.taskId,
    mode: params.mode,
    tier: params.tier,
    status: 'success',
    model_url: urlData.publicUrl,
    storage_path: path,
    storage_bucket: bucket,
  });
  if (audErr.error) console.warn('[storage] generated_models 审计写入失败:', audErr.error.message);

  // 资产记录（面板展示用）
  const { data, error: dbErr } = await supabaseAnon
    .from('prototype_assets')
    .insert({
      node_id: params.nodeId,
      project_id: PROJECT_ID,
      name: params.fileName,
      type: 'generated_glb',
      version: 'tripo-' + params.tier,
      storage_path: path,
      storage_url: urlData.publicUrl,
      source: 'tripo',
    })
    .select()
    .single();
  if (dbErr) throw new Error('生成资产写入失败: ' + dbErr.message);
  return data as PrototypeAsset;
}

export async function getPrototypeAssets(nodeId: string): Promise<PrototypeAsset[]> {
  const { data, error } = await supabaseAnon
    .from('prototype_assets')
    .select('*')
    .eq('node_id', nodeId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as PrototypeAsset[];
}

/** 获取全部原型资产（存档中心集中查看用） */
export async function getAllPrototypeAssets(limit = 500): Promise<PrototypeAsset[]> {
  const { data, error } = await supabaseAnon
    .from('prototype_assets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []) as PrototypeAsset[];
}

export async function deletePrototypeAsset(asset: PrototypeAsset): Promise<void> {
  if (asset.storage_path) {
    // generated_glb 可能落在 generated-models 或回退的 prototype-assets，两个 bucket 都尝试删除
    const buckets = asset.type === 'generated_glb'
      ? ['generated-models', 'prototype-assets']
      : ['prototype-assets'];
    for (const b of buckets) {
      await supabaseAnon.storage.from(b).remove([asset.storage_path]);
    }
  }
  const { error } = await supabaseAnon.from('prototype_assets').delete().eq('id', asset.id);
  if (error) throw new Error(error.message);
}

/**
 * 上传现场测试的出声报告录音（现已在前端转码为 wav），返回公开访问 URL。
 * 复用 prototype-assets public bucket（anon 可读写），作为测试记录附件，不写资产表。
 */
export async function uploadAudioReport(file: File, scenarioId: string): Promise<string> {
  const safeName = sanitize(file.name || 'report.wav');
  const path = `audio-reports/${scenarioId}/${Date.now()}_${safeName}`;
  const { error: upErr } = await supabaseAnon.storage
    .from('prototype-assets')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'audio/wav',
    });
  if (upErr) throw new Error('录音上传失败: ' + upErr.message);
  return supabaseAnon.storage.from('prototype-assets').getPublicUrl(path).data.publicUrl;
}
