/**
 * Supabase Storage + 数据库持久化服务
 * 负责：知识库文档、方案节点原型资产、Tripo 生成 GLB 的上传/读取/删除。
 *
 * 表：documents / prototype_assets / generated_models
 * Bucket（均 public）：knowledge-base / prototype-assets / generated-models
 *
 * RLS 为 MVP 宽松版（anon 可读写），上线前务必改为按 auth.uid() 隔离。
 */
import { supabase } from '../utils/supabase/client';

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
  const { error: upErr } = await supabase.storage
    .from('knowledge-base')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (upErr) throw new Error('文档上传失败: ' + upErr.message);

  const { data: urlData } = supabase.storage.from('knowledge-base').getPublicUrl(path);

  const { data, error: dbErr } = await supabase
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
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('uploaded_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as KnowledgeDoc[];
}

export async function deleteKnowledgeDoc(doc: KnowledgeDoc): Promise<void> {
  if (doc.storage_path) {
    await supabase.storage.from('knowledge-base').remove([doc.storage_path]);
  }
  const { error } = await supabase.from('documents').delete().eq('id', doc.id);
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
  const { error: upErr } = await supabase.storage
    .from('prototype-assets')
    .upload(path, params.file, { cacheControl: '3600', upsert: false });
  if (upErr) throw new Error('资产上传失败: ' + upErr.message);

  const { data: urlData } = supabase.storage.from('prototype-assets').getPublicUrl(path);

  const { data, error: dbErr } = await supabase
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
  const { error: upErr } = await supabase.storage
    .from('prototype-assets')
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (upErr) throw new Error('参考图上传失败: ' + upErr.message);
  return supabase.storage.from('prototype-assets').getPublicUrl(path).data.publicUrl;
}

/**
 * 将 Tripo 生成的 GLB 转存到 generated-models bucket（规避签名 URL 过期/CORS），
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
  const path = `${params.nodeId}/generated/${Date.now()}_${sanitize(params.fileName)}`;
  const { error: upErr } = await supabase.storage
    .from('generated-models')
    .upload(path, params.glbArrayBuffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'model/gltf-binary',
    });
  if (upErr) throw new Error('GLB 转存失败: ' + upErr.message);

  const { data: urlData } = supabase.storage.from('generated-models').getPublicUrl(path);

  // 审计记录
  await supabase.from('generated_models').insert({
    task_id: params.taskId,
    mode: params.mode,
    tier: params.tier,
    status: 'success',
    model_url: urlData.publicUrl,
    storage_path: path,
  });

  // 资产记录（面板展示用）
  const { data, error: dbErr } = await supabase
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
  const { data, error } = await supabase
    .from('prototype_assets')
    .select('*')
    .eq('node_id', nodeId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as PrototypeAsset[];
}

export async function deletePrototypeAsset(asset: PrototypeAsset): Promise<void> {
  if (asset.storage_path) {
    const bucket = asset.type === 'generated_glb' ? 'generated-models' : 'prototype-assets';
    await supabase.storage.from(bucket).remove([asset.storage_path]);
  }
  const { error } = await supabase.from('prototype_assets').delete().eq('id', asset.id);
  if (error) throw new Error(error.message);
}
