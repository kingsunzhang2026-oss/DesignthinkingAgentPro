/**
 * deepseek-proxy Edge Function (入口)
 * 前端 llm.ts 将 POST 请求发到函数根路径，由 body.stream 区分流式 / 非流式。
 * 注意：Supabase Edge Function 传给处理器的路径会保留 slug，
 * 即调用 /functions/v1/deepseek-proxy 时，handler 看到的 path 是 /deepseek-proxy。
 * 因此这里用通配路由，兼容 / 与 /deepseek-proxy。
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Hono } from "npm:hono@3";
import { cors } from "npm:hono/cors";
import { chatCompletion, chatCompletionStream } from "./deepseek.ts";

const app = new Hono();

app.use('*', cors());

// 前端所有调用（测试 / 非流式 / 流式）都 POST 到根路径（path = /deepseek-proxy 或 /）
app.post('*', async (c) => {
  try {
    const body = await c.req.json();
    if (body && body.stream === true) {
      return await chatCompletionStream(body);
    }
    return await chatCompletion(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : '请求解析失败';
    return new Response(
      JSON.stringify({ error: { message, code: 'BAD_REQUEST' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

// 健康检查（便于排查部署是否成功）
app.get('*', (c) => c.json({ ok: true, function: 'deepseek-proxy' }));

serve(app.fetch);
