# DeepSeek Proxy 后端配置指南

## 📋 概述

本应用使用 Supabase Edge Function 作为 DeepSeek API 的安全代理，避免前端直接调用 API 带来的 CORS 问题和安全风险。

**后端 URL**: `https://lihlsmfxyfbpieqpgcqu.supabase.co/functions/v1/deepseek-proxy`

---

## 🔑 步骤 1: 获取 DeepSeek API 密钥

1. 访问 [DeepSeek 开放平台](https://platform.deepseek.com)
2. 注册/登录账号
3. 进入 **API Keys** 页面
4. 点击 **Create API Key**
5. 复制生成的密钥（格式：`sk-xxxxxxxxxxxxxxxx...`）

⚠️ **重要**: 保存好密钥，它只会显示一次！

---

## ⚙️ 步骤 2: 在 Supabase 中配置环境变量

### 2.1 进入 Supabase Dashboard

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择项目: `lihlsmfxyfbpieqpgcqu`

### 2.2 设置 Secret 环境变量

1. 导航到: **Project Settings** → **Edge Functions** → **Secrets**
2. 点击 **Add new secret**
3. 填写以下信息:
   - **Secret Name**: `DEEPSEEK_API_KEY`
   - **Secret Value**: `sk-你的DeepSeek密钥`
4. 点击 **Save**

---

## 🚀 步骤 3: 部署 Edge Function

### 3.1 确认 Edge Function 代码

确保你的 Supabase 项目中已部署名为 `deepseek-proxy` 的 Edge Function，代码应包含以下功能：

```typescript
// supabase/functions/deepseek-proxy/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const DEEPSEEK_API_BASE = "https://api.deepseek.com/v1";

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 获取环境变量中的 API 密钥
    const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: { message: "DEEPSEEK_API_KEY not configured" } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 解析请求体
    const body = await req.json();
    const { model, messages, temperature, max_tokens, stream } = body;

    // 转发请求到 DeepSeek API
    const response = await fetch(`${DEEPSEEK_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "deepseek-chat",
        messages,
        temperature: temperature ?? 0.7,
        max_tokens: max_tokens || 4000,
        stream: stream || false,
      }),
    });

    // 返回 DeepSeek 响应
    if (stream) {
      // 流式响应
      return new Response(response.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    } else {
      // 非流式响应
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: { message: error.message } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### 3.2 CORS 配置文件

创建 `supabase/functions/_shared/cors.ts`:

```typescript
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
```

### 3.3 部署命令

```bash
# 使用 Supabase CLI 部署
supabase functions deploy deepseek-proxy

# 查看部署日志
supabase functions logs deepseek-proxy
```

---

## ✅ 步骤 4: 测试连接

### 4.1 在应用中测试

1. 打开 Figma Make 应用
2. 点击左侧边栏的 **⚙️ 设置** 图标
3. 在弹出的 **系统设置** 对话框中，找到 **DeepSeek API 测试面板**
4. 点击 **🔌 测试后端连接** 按钮

### 4.2 预期结果

**成功**:
```
✅ 后端连接成功！DeepSeek API 工作正常。
```

**失败**:
```
❌ 连接失败
后端响应错误: 401
```

### 4.3 功能测试

连接成功后，可以测试以下功能：

1. **📝 测试非流式调用**: 发送一个简单问题，等待完整响应
2. **⚡ 测试流式调用**: 发送问题，观察 AI 逐字输出

---

## 🔍 故障排查

### 问题 1: `DEEPSEEK_API_KEY not configured`

**原因**: 环境变量未设置或未生效

**解决**:
1. 确认已在 Supabase Dashboard 中添加 `DEEPSEEK_API_KEY`
2. 重新部署 Edge Function: `supabase functions deploy deepseek-proxy`
3. 等待 1-2 分钟让配置生效

### 问题 2: `后端响应错误: 401`

**原因**: API 密钥无效或已过期

**解决**:
1. 检查密钥是否正确复制（包含 `sk-` 前缀）
2. 在 [DeepSeek 平台](https://platform.deepseek.com) 确认密钥状态
3. 如需要，重新生成密钥并更新 Supabase Secret

### 问题 3: `后端响应错误: 429`

**原因**: API 请求频率超限

**解决**:
1. 等待几分钟后重试
2. 检查 DeepSeek 账户配额
3. 考虑升级 API 套餐

### 问题 4: `后端响应错误: 402`

**原因**: DeepSeek 账户余额不足

**解决**:
1. 登录 [DeepSeek 平台](https://platform.deepseek.com)
2. 前往 **Billing** 充值账户

### 问题 5: CORS 错误

**原因**: CORS 配置缺失或不正确

**解决**:
1. 确认 `_shared/cors.ts` 文件存在
2. 确认 Edge Function 正确处理 OPTIONS 请求
3. 重新部署 Edge Function

---

## 📊 查看日志

### Supabase Dashboard 日志

1. 进入 **Logs** → **Edge Functions**
2. 选择 `deepseek-proxy` 函数
3. 查看实时日志输出

### 前端控制台日志

打开浏览器开发者工具（F12），查看 Console 标签：

```
[LLM Test] 通过后端测试 API 密钥...
[LLM Test] 后端 URL: https://lihlsmfxyfbpieqpgcqu.supabase.co/functions/v1/deepseek-proxy
[LLM Test] ✓ API密钥验证成功
```

---

## 🎯 测试流程总结

```
1. 获取 DeepSeek API 密钥
   ↓
2. 在 Supabase 中配置 DEEPSEEK_API_KEY
   ↓
3. 部署 deepseek-proxy Edge Function
   ↓
4. 在 Figma Make 应用中点击"测试后端连接"
   ↓
5. 测试非流式和流式调用
   ↓
6. 开始使用 AI 功能！
```

---

## 📖 相关文档

- [DeepSeek API 文档](https://platform.deepseek.com/docs)
- [Supabase Edge Functions 文档](https://supabase.com/docs/guides/functions)
- [Deno 部署指南](https://deno.land/manual/getting_started/first_steps)

---

## 💡 安全最佳实践

✅ **应该做**:
- 在 Supabase Secret 中存储 API 密钥
- 使用 Edge Function 代理所有 API 调用
- 定期轮换 API 密钥
- 监控 API 使用量和成本

❌ **不应该做**:
- 将 API 密钥硬编码到前端代码
- 在 Git 仓库中提交密钥
- 使用个人密钥进行生产环境调用
- 忽略 API 速率限制警告

---

**最后更新**: 2024年12月23日
**维护者**: Designthinking Agent Pro 团队
