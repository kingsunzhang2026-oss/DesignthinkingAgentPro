-- ============================================================================
-- Designthinking Agent Pro — 数据库初始化 SQL
-- 适用项目：sgxkplfbptwdohjjnlzd
-- 用法：登录 Supabase 控制台 → SQL Editor → 粘贴全文 → Run
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. 兼容现有 Edge Function 的 kv_store 表（不建会导致 submit-record 等函数报错）
--    来源：src/app/supabase/functions/server/kv_store.tsx 引用的 kv_store_f477e18e
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kv_store_f477e18e (
  key  TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL
);

-- ----------------------------------------------------------------------------
-- 1. 知识库文档表（设置页上传的 PDF / DOCX / TXT / MD）
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  name        TEXT NOT NULL,
  type        TEXT,
  size        BIGINT,
  storage_path TEXT,          -- Supabase Storage 内部路径
  storage_url  TEXT,          -- 公开/可访问 URL
  content_text TEXT,          -- 解析后的纯文本（供 AI 检索，可选）
  source      TEXT DEFAULT 'upload',
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. 方案节点原型资产表（SolutionNodePanel 里的原型资产）
--    类型：cad_step(STP) / reference_image / uploaded_glb / generated_glb
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prototype_assets (
  id           TEXT PRIMARY KEY,
  node_id      TEXT NOT NULL,
  project_id   TEXT DEFAULT '小钳智能双极电刀V2',
  name         TEXT NOT NULL,
  version      TEXT,
  asset_type   TEXT NOT NULL,          -- cad_step | reference_image | uploaded_glb | generated_glb
  storage_path TEXT,
  storage_url  TEXT,
  source       TEXT,                    -- 上传来源：upload | tripo_generate
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. Tripo3D 生成记录表
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS generated_models (
  id           TEXT PRIMARY KEY,
  asset_id     TEXT,
  task_id      TEXT,
  mode         TEXT,                    -- text_to_model | image_to_model | multiview_to_model
  tier         TEXT,                    -- P | H
  status       TEXT DEFAULT 'queued',  -- queued | running | success | failed
  model_url    TEXT,
  storage_path TEXT,
  prompt       TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. Storage Buckets（blob 存储，必须用，不能只靠数据库表）
--    public=true：前端可直接用公开 URL 预览/下载，省去代理
--    ⚠️ 内部工具用；若对外发布需改 private + 签名 URL + 收紧策略
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('knowledge-base',   'knowledge-base',   true),
  ('prototype-assets', 'prototype-assets', true),
  ('generated-models', 'generated-models', true)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. RLS 策略（MVP 宽松版：允许 anon 角色全量读写）
--    ⚠️ 生产环境应改为基于 auth.uid() 的按用户隔离
-- ----------------------------------------------------------------------------

-- 表级 RLS
ALTER TABLE kv_store_f477e18e ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE prototype_assets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_models   ENABLE ROW LEVEL SECURITY;

-- 表策略：允许 anon 全量读写（MVP）
DROP POLICY IF EXISTS anon_all_kv          ON kv_store_f477e18e;
DROP POLICY IF EXISTS anon_all_documents   ON documents;
DROP POLICY IF EXISTS anon_all_assets      ON prototype_assets;
DROP POLICY IF EXISTS anon_all_generated   ON generated_models;

CREATE POLICY anon_all_kv        ON kv_store_f477e18e FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_all_documents ON documents          FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_all_assets    ON prototype_assets   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY anon_all_generated ON generated_models   FOR ALL TO anon USING (true) WITH CHECK (true);

-- Storage 对象策略：允许 anon 读写三个 bucket
DROP POLICY IF EXISTS anon_rw_knowledge_base   ON storage.objects;
DROP POLICY IF EXISTS anon_rw_prototype_assets ON storage.objects;
DROP POLICY IF EXISTS anon_rw_generated_models ON storage.objects;

CREATE POLICY anon_rw_knowledge_base
  ON storage.objects FOR ALL TO anon
  USING ( bucket_id = 'knowledge-base' )
  WITH CHECK ( bucket_id = 'knowledge-base' );

CREATE POLICY anon_rw_prototype_assets
  ON storage.objects FOR ALL TO anon
  USING ( bucket_id = 'prototype-assets' )
  WITH CHECK ( bucket_id = 'prototype-assets' );

CREATE POLICY anon_rw_generated_models
  ON storage.objects FOR ALL TO anon
  USING ( bucket_id = 'generated-models' )
  WITH CHECK ( bucket_id = 'generated-models' );

-- ----------------------------------------------------------------------------
-- 完成
-- ----------------------------------------------------------------------------
-- 验证：SELECT * FROM storage.buckets; 应看到 3 个 bucket
--      SELECT tablename FROM pg_tables WHERE schemaname='public';
--      应看到 documents / prototype_assets / generated_models / kv_store_f477e18e
