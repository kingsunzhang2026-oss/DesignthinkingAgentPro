// ============================================================================
// tripo3d-proxy — Supabase Edge Function
// 作用：代理 Tripo3D v3 API，避免前端暴露 TRIPO_API_KEY，并解决 GLB 跨域
// 部署：functions/tripo3d-proxy → 路由 /functions/v1/tripo3d-proxy
// 依赖 secrets：TRIPO_API_KEY（必填）、TRIPO_BASE_URL（可选）
//               SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY（Supabase 自动注入）
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Hono } from "npm:hono@3";
import { cors } from "npm:hono/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();
app.use("*", cors());

// ---------------------------------------------------------------------------
// Tripo 配置
// ---------------------------------------------------------------------------
const TRIPO_BASE_URL = Deno.env.get("TRIPO_BASE_URL") || "https://openapi.tripo3d.ai";
// 模型版本
const MODEL_H = "v3.1-20260211"; // 高保真几何体+纹理+PBR
const MODEL_P = "P1-20260311";   // 低多边形/清晰拓扑

// 统一请求函数：Tripo 返回 { code, message, data }，code!==0 视为业务错误
async function tripoFetch<T>(path: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const apiKey = Deno.env.get("TRIPO_API_KEY");
  if (!apiKey) return { ok: false, error: "TRIPO_API_KEY 未配置" };

  try {
    const res = await fetch(`${TRIPO_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        ...(init?.headers || {}),
      },
    });
    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch { return { ok: false, error: `非 JSON 响应: ${text.slice(0, 200)}` }; }

    if (json.code !== 0) return { ok: false, error: json.message || `业务错误 code=${json.code}` };
    return { ok: true, data: json.data as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "网络错误" };
  }
}

// 端点映射
const ENDPOINT: Record<string, string> = {
  text_to_model: "/v3/generation/text-to-model",
  image_to_model: "/v3/generation/image-to-model",
  multiview_to_model: "/v3/generation/multiview-to-model",
};

interface GenerateBody {
  mode: "text_to_model" | "image_to_model" | "multiview_to_model";
  tier?: "P" | "H";
  prompt?: string;
  imageUrl?: string;   // image_to_model 单图
  imageUrls?: string[]; // multiview_to_model：[front, left, back, right]
}

app.post("/generate", async (c) => {
  try {
    const body = await c.req.json<GenerateBody>();
    const { mode, tier = "H", prompt, imageUrl, imageUrls } = body;

    if (!ENDPOINT[mode]) return c.json({ ok: false, error: "未知 mode" }, 400);

    const model = tier === "P" ? MODEL_P : MODEL_H;
    let payload: any = { model, texture: true, pbr: true };
    if (tier === "P") payload.face_limit = 5000;

    if (mode === "text_to_model") {
      if (!prompt) return c.json({ ok: false, error: "text_to_model 需要 prompt" }, 400);
      payload.prompt = prompt;
    } else if (mode === "image_to_model") {
      if (!imageUrl) return c.json({ ok: false, error: "image_to_model 需要 imageUrl" }, 400);
      payload.input = imageUrl;
    } else if (mode === "multiview_to_model") {
      if (!imageUrls || imageUrls.length < 1) return c.json({ ok: false, error: "multiview_to_model 需要 imageUrls" }, 400);
      const types = ["front", "left", "back", "right"];
      payload.inputs = imageUrls.map((u, i) => ({ type: types[i] || `view${i}`, url: u }));
    }

    const r = await tripoFetch<{ task_id: string }>(ENDPOINT[mode], {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!r.ok) return c.json({ ok: false, error: r.error }, 502);

    const taskId = r.data.task_id || (r.data as any).taskId || (r.data as any).id;
    return c.json({ ok: true, taskId });
  } catch (e) {
    return c.json({ ok: false, error: e instanceof Error ? e.message : "生成失败" }, 500);
  }
});

// 轮询任务状态；persist=1 时把 GLB 转存到 Supabase Storage 返回稳定 URL
app.get("/task", async (c) => {
  try {
    const taskId = c.req.query("taskId");
    const persist = c.req.query("persist");
    if (!taskId) return c.json({ ok: false, error: "缺 taskId" }, 400);

    const r = await tripoFetch<any>(`/v3/tasks/${taskId}`, { method: "GET" });
    if (!r.ok) return c.json({ ok: false, error: r.error }, 502);

    const d = r.data;
    // 状态归一（兼容 task.status / output.state）
    const rawStatus = d.status || d.output?.state || d.state || "running";
    const status = ["queued", "running", "success", "failed"].includes(rawStatus) ? rawStatus : "running";

    // 模型地址多位置兜底
    const modelUrl =
      d.output?.model_url || d.output?.glb?.url ||
      d.result?.model_url || d.result?.glb_url || null;

    if (status === "success" && modelUrl && persist === "1") {
      const persisted = await persistToStorage(taskId, modelUrl);
      if (persisted.ok) {
        return c.json({ ok: true, status, modelUrl: persisted.url, persisted: true });
      }
      // 转存失败则退回原始 URL（前端走 /proxy）
      return c.json({ ok: true, status, modelUrl, persisted: false, warn: persisted.error });
    }

    return c.json({ ok: true, status, modelUrl, progress: d.progress ?? null });
  } catch (e) {
    return c.json({ ok: false, error: e instanceof Error ? e.message : "轮询失败" }, 500);
  }
});

// 把 Tripo GLB 下载后转存到 Supabase Storage（避免签名 URL 过期）
async function persistToStorage(taskId: string, modelUrl: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );
    const bytes = await (await fetch(modelUrl)).arrayBuffer();
    const path = `tripo/${taskId}.glb`;
    const { error } = await supabase.storage
      .from("generated-models")
      .upload(path, bytes, { contentType: "model/gltf-binary", upsert: true });
    if (error) return { ok: false, error: error.message };
    const { data } = supabase.storage.from("generated-models").getPublicUrl(path);
    return { ok: true, url: data.publicUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "转存失败" };
  }
}

// CORS 代理：绕开 Tripo GLB 跨域；仅允许 tripo 域名（防开放代理滥用）
const ALLOWED_HOSTS = ["tripo3d.com", "tripo3d.ai", "data.tripo3d.com"];
app.get("/proxy", async (c) => {
  const url = c.req.query("url");
  if (!url) return c.json({ ok: false, error: "缺 url" }, 400);
  try {
    const u = new URL(url);
    if (!ALLOWED_HOSTS.some(h => u.hostname.endsWith(h))) {
      return c.json({ ok: false, error: "域名不在白名单" }, 403);
    }
    const upstream = await fetch(url);
    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: upstream.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": upstream.headers.get("Content-Type") || "model/gltf-binary",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return c.json({ ok: false, error: e instanceof Error ? e.message : "代理失败" }, 502);
  }
});

serve(app.fetch);
