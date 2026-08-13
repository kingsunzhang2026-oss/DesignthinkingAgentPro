/**
 * asr-proxy Edge Function
 * 代理火山引擎豆包语音 ASR（录音文件识别极速版 / flash）。
 *
 * 前端调用：
 *   POST /functions/v1/asr-proxy/transcribe  { audioUrl, language? }
 *   GET  /functions/v1/asr-proxy             （健康检查，返回 keySet 状态）
 *
 * 凭证通过 Supabase Secrets 注入（绝不进前端 / 代码仓库）：
 *   ASR_APP_ID      = 火山语音 APP ID
 *   ASR_ACCESS_KEY  = 火山语音 Access Token
 *   ASR_RESOURCE_ID = 资源 ID（默认 volc.bigasr.auc_turbo，极速版）
 *
 * 已实测：本地合成中文音频 → 上传 Supabase Storage 公开 URL → 本函数 → 火山，
 * 返回「今天天气很好，我们测试一下语音识别功能是否正常工作。」识别正确。
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Hono } from "npm:hono@3";
import { cors } from "npm:hono/cors";

const app = new Hono();
app.use("*", cors());

const ASR_APP_ID = Deno.env.get("ASR_APP_ID") || "";
const ASR_ACCESS_KEY = Deno.env.get("ASR_ACCESS_KEY") || "";
const ASR_RESOURCE_ID = Deno.env.get("ASR_RESOURCE_ID") || "volc.bigasr.auc_turbo";
const ASR_BASE = "https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash";

app.get("*", async (c) => {
  const p = new URL(c.req.url).pathname;
  if (!p.endsWith("/transcribe")) {
    return c.json({
      ok: true,
      function: "asr-proxy",
      appIdSet: !!ASR_APP_ID,
      keySet: !!ASR_ACCESS_KEY,
      resourceId: ASR_RESOURCE_ID,
    });
  }
  return c.json({ ok: true });
});

app.post("*", async (c) => {
  const p = new URL(c.req.url).pathname;
  if (!p.endsWith("/transcribe")) {
    return c.json({ ok: false, error: "not found" }, 404);
  }
  if (!ASR_APP_ID || !ASR_ACCESS_KEY) {
    return c.json(
      {
        ok: false,
        error:
          "ASR 凭证未配置：请在 Supabase 控制台 → Edge Functions → asr-proxy → Secrets 设置 ASR_APP_ID / ASR_ACCESS_KEY",
      },
      500,
    );
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid json" }, 400);
  }
  const { audioUrl, language = "zh-CN", format = "wav" } = body || {};
  if (!audioUrl) return c.json({ ok: false, error: "audioUrl required" }, 400);

  const reqId = crypto.randomUUID();
  try {
    const res = await fetch(ASR_BASE, {
      method: "POST",
      headers: {
        "X-Api-App-Key": ASR_APP_ID,
        "X-Api-Access-Key": ASR_ACCESS_KEY,
        "X-Api-Resource-Id": ASR_RESOURCE_ID,
        "X-Api-Request-Id": reqId,
        "X-Api-Sequence": "-1",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ audio: { url: audioUrl }, format, language }),
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* 非 JSON 响应 */
    }
    if (!res.ok) {
      return c.json(
        { ok: false, error: "ASR upstream error", httpStatus: res.status, detail: json || text },
        502,
      );
    }
    const result = json?.result || {};
    const transcript =
      result?.text || (result?.utterances?.map((u: any) => u.text).join("") ?? "");
    return c.json({ ok: true, transcript, audioInfo: json?.audio_info || null });
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500);
  }
});

serve(app.fetch);
