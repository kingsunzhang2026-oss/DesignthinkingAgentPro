-- ============================================================
-- Designthinking Agent Pro — 数据库与存储初始化
-- 幂等：可重复执行，已存在则跳过（MVP 宽松 RLS：允许 anon 读写）
-- ============================================================

-- 1) kv_store_f477e18e（现有 make-server 函数兼容）
create table if not exists kv_store_f477e18e (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz default now()
);

-- 2) documents（知识库）
create table if not exists documents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid,
  name         text not null,
  type         text,
  size         bigint,
  storage_path text,
  storage_url  text,
  content_text text,
  uploaded_at  timestamptz default now()
);

-- 3) prototype_assets（方案节点原型资产）
create table if not exists prototype_assets (
  id           uuid primary key default gen_random_uuid(),
  node_id      text,
  project_id   text,
  name         text not null,
  type         text,
  version      text,
  storage_path text,
  storage_url  text,
  source       text,
  created_at   timestamptz default now()
);

-- 4) generated_models（Tripo3D 生成记录）
create table if not exists generated_models (
  id           uuid primary key default gen_random_uuid(),
  asset_id     uuid,
  task_id      text,
  mode         text,
  tier         text,
  status       text,
  model_url    text,
  storage_path text,
  created_at   timestamptz default now()
);

-- 3 个 Storage bucket（public，便于前端直接读取 GLB / 下载文档）
insert into storage.buckets (id, name, public)
values
  ('knowledge-base',   'knowledge-base',   true),
  ('prototype-assets', 'prototype-assets', true),
  ('generated-models', 'generated-models', true)
on conflict (id) do nothing;

-- 开启 RLS
alter table kv_store_f477e18e enable row level security;
alter table documents         enable row level security;
alter table prototype_assets  enable row level security;
alter table generated_models  enable row level security;

-- 宽松版 RLS（MVP：允许 anon 读写；上线前务必改为按 auth.uid() 隔离）
drop policy if exists anon_kv_all         on kv_store_f477e18e;
create policy anon_kv_all         on kv_store_f477e18e for all to anon using (true) with check (true);

drop policy if exists anon_documents_all  on documents;
create policy anon_documents_all  on documents        for all to anon using (true) with check (true);

drop policy if exists anon_prototype_all  on prototype_assets;
create policy anon_prototype_all  on prototype_assets for all to anon using (true) with check (true);

drop policy if exists anon_generated_all  on generated_models;
create policy anon_generated_all  on generated_models for all to anon using (true) with check (true);

-- Storage objects 宽松 RLS
drop policy if exists anon_storage_all on storage.objects;
create policy anon_storage_all on storage.objects for all to anon using (true) with check (true);
