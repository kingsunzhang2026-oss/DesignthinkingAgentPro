/**
 * tripo3d-proxy Edge Function
 * 代理 Tripo3D v3 API：提交生成任务 / 轮询任务状态 / CORS 代理 GLB。
 * 前端调用：
 *   POST /functions/v1/tripo3d-proxy/generate  { mode, tier, prompt?, imageUrls? }
 *   GET  /functions/v1/tripo3d-proxy/task?taskId=xxx
 *   GET  /functions/v1/tripo3d-proxy/proxy?url=<tripo_glb_url>
 *
 * 注意：Supabase 把 slug 保留在路径里，handler 看到的是 /tripo3d-proxy、/tripo3d-proxy/generate 等，
 *       因此用通配路由，在内部按 pathname 分发。
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Hono } from "npm:hono@3";
import { cors } from "npm:hono/cors";

const app = new Hono();
app.use("*", cors());

const TRIPO_BASE_URL = (Deno.env.get("TRIPO_BASE_URL") || "https://openapi.tripo3d.ai").replace(/\/+$/, "");
const TRIPO_API_KEY = Deno.env.get("TRIPO_API_KEY") || "";

async function tripoFetch(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${TRIPO_BASE_URL}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${TRIPO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-json response */ }
  return { status: res.status, json, text };
}

// Tripo 统一返回 { code, message, data }；code !== 0 视为业务错误
class TripoError extends Error {
  constructor(message: string, public rawJson: any) {
    super(message);
  }
}
function unwrap(json: any) {
  if (json && typeof json === "object" && "code" in json) {
    if (json.code !== 0) throw new TripoError(json.message || "tripo business error", json);
    return json.data;
  }
  return json;
}

app.get("*", async (c) => {
  const url = new URL(c.req.url);
  const p = url.pathname;

  // 健康检查（不调用 Tripo）
  if (!p.endsWith("/task") && !p.endsWith("/proxy")) {
    return c.json({ ok: true, function: "tripo3d-proxy", baseUrl: TRIPO_BASE_URL, keySet: !!TRIPO_API_KEY });
  }

  // 轮询任务状态：GET /v3/tasks/{task_id}
  if (p.endsWith("/task")) {
    const taskId = url.searchParams.get("taskId");
    if (!taskId) return c.json({ ok: false, error: "taskId required" }, 400);
    try {
      const { status, json } = await tripoFetch(`/v3/tasks/${taskId}`);
      if (!json) return c.json({ ok: false, error: "bad response", httpStatus: status }, 502);
      const data = unwrap(json);
      const output = data?.output || data?.result || {};
      // GLB 地址多位置兜底（Tripo v3 实际返回 output.model / output.pbr_model）
      const candidates: (string | undefined)[] = [
        output.pbr_model,
        output.model,
        output.base_model,
        output.model_url,
        output.glb?.url,
        output.glb_url,
        data?.result?.model_url,
        data?.result?.glb_url,
      ];
      const modelUrl = candidates.find((u) => typeof u === "string" && u.startsWith("http")) || null;
      return c.json({
        ok: true,
        taskId,
        status: data?.status || data?.state || "unknown",
        progress: data?.progress ?? null,
        modelUrl,
        raw: data,
      });
    } catch (e: any) {
      return c.json({ ok: false, error: e.message, tripDetail: e.rawJson || undefined }, 400);
    }
  }

  // CORS 代理 GLB / 贴图（绕开 Tripo 签名 URL 的跨域限制）
  if (p.endsWith("/proxy")) {
    const target = url.searchParams.get("url");
    if (!target) return c.json({ ok: false, error: "url required" }, 400);
    const allowed = [".tripo3d.ai", ".tripo3d.com", ".data.tripo3d.com"];
    if (!allowed.some((s) => target.includes(s))) {
      return c.json({ ok: false, error: "domain not allowed" }, 403);
    }
    try {
      const r = await fetch(target);
      const buf = await r.arrayBuffer();
      return new Response(buf, {
        status: r.status,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600",
          "Content-Type": r.headers.get("Content-Type") || "application/octet-stream",
        },
      });
    } catch (e: any) {
      return c.json({ ok: false, error: e.message }, 502);
    }
  }

  return c.json({ ok: true });
});

app.post("*", async (c) => {
  const url = new URL(c.req.url);
  if (!url.pathname.endsWith("/generate")) {
    return c.json({ ok: false, error: "not found" }, 404);
  }
  let body: any;
  try { body = await c.req.json(); } catch { return c.json({ ok: false, error: "invalid json" }, 400); }

  const { mode, tier, prompt, imageUrls } = body || {};
  if (!["text_to_model", "image_to_model", "multiview_to_model"].includes(mode)) {
    return c.json({ ok: false, error: "invalid mode" }, 400);
  }

  // 模型版本：H 系列高保真几何体+纹理+PBR；P 系列低多边形优化
  const model = tier === "P" ? "P1-20260311" : "v3.1-20260211";
  const payload: any = { model, texture: true, pbr: true };
  if (tier === "P") payload.face_limit = 5000;

  let endpoint = "";
  if (mode === "text_to_model") {
    if (!prompt) return c.json({ ok: false, error: "prompt required" }, 400);
    endpoint = "/v3/generation/text-to-model";
    payload.prompt = prompt;
  } else if (mode === "image_to_model") {
    const input = Array.isArray(imageUrls) ? imageUrls[0] : imageUrls;
    if (!input) return c.json({ ok: false, error: "imageUrls required" }, 400);
    endpoint = "/v3/generation/image-to-model";
    payload.input = input;
  } else if (mode === "multiview_to_model") {
    // 归一化到 { front/left/back/right: url }（兼容对象、[{type,url}]、位置数组三种入参）
    let byView: Record<string, string> = {};
    if (Array.isArray(imageUrls)) {
      const posOrder = ["front", "left", "back", "right"]; // Tripo 官方位置顺序
      imageUrls.forEach((u: any, i: number) => {
        const type = (u && typeof u === "object" && u.type) ? String(u.type) : posOrder[i];
        const url = typeof u === "string" ? u : u?.url;
        if (type && url) byView[type] = url;
      });
    } else if (imageUrls && typeof imageUrls === "object") {
      byView = imageUrls;
    }
    // Tripo v3 legacy positional：恰好 4 个字符串，顺序 [front, left, back, right]，空串跳过该视图
    // （接口白名单只有这四个正交视图，不支持 top/透视；front 必填，至少 2 张）
    const inputs = ["front", "left", "back", "right"].map((k) => byView[k] || "");
    if (!inputs.some(Boolean)) return c.json({ ok: false, error: "imageUrls required" }, 400);
    if (!inputs[0]) return c.json({ ok: false, error: "front view is required by Tripo" }, 400);
    endpoint = "/v3/generation/multiview-to-model";
    payload.inputs = inputs;
  }

  try {
    const { status, json } = await tripoFetch(endpoint, "POST", payload);
    if (!json) return c.json({ ok: false, error: "bad response", httpStatus: status }, 502);
    const data = unwrap(json);
    const taskId = data?.task_id || data?.taskId || data?.id || null;
    if (!taskId) return c.json({ ok: false, error: "no task_id in response", raw: data }, 502);
    return c.json({ ok: true, taskId, raw: data });
  } catch (e: any) {
    return c.json({ ok: false, error: e.message, tripDetail: e.rawJson || undefined }, 400);
  }
});

serve(app.fetch);
