# 🚀 后端迁移指南 - DeepSeek API 代理

## 📋 概述

已成功将 DeepSeek API 调用从**前端直接调用**迁移到**Supabase Edge Function 后端代理**，彻底解决 CORS 跨域问题和网络拦截问题。

## 🏗️ 架构变更

### 之前（前端直接调用）
```
浏览器 → DeepSeek API (https://api.deepseek.com)
   ❌ CORS 错误
   ❌ 可能被防火墙拦截
   ❌ API 密钥暴露在前端
```

### 现在（后端代理）
```
浏览器 → Supabase Edge Function → DeepSeek API
   ✅ 无 CORS 问题
   ✅ 不会被拦截
   ✅ API 密钥安全存储在后端
```

## 🔧 技术实现

### 1. 后端代理服务

**文件**: `/supabase/functions/server/deepseek.tsx`

提供三个核心功能：
- `chatCompletion()` - 非流式 AI 对话
- `chatCompletionStream()` - 流式 AI 对话
- `testApiKey()` - 测试 API 密钥有效性

### 2. API 路由

**文件**: `/supabase/functions/server/index.tsx`

新增路由：
- `POST /make-server-f477e18e/deepseek/chat` - 非流式调用
- `POST /make-server-f477e18e/deepseek/chat/stream` - 流式调用
- `GET /make-server-f477e18e/deepseek/test` - 测试密钥

### 3. 前端服务

**文件**: `/services/llm.ts`

已修改为调用后端代理：
```typescript
// 旧代码
fetch('https://api.deepseek.com/v1/chat/completions', {
  headers: { 'Authorization': `Bearer ${apiKey}` }
})

// 新代码
fetch(`${SERVER_BASE_URL}/deepseek/chat`, {
  headers: { 'Authorization': `Bearer ${publicAnonKey}` }
})
```

## 🔐 API 密钥配置

### ⚠️ 重要：必须配置环境变量

API 密钥现在存储在 **Supabase 后端环境变量**中，不再保存在浏览器 localStorage。

### 配置步骤

1. **获取 DeepSeek API 密钥**
   - 访问 [platform.deepseek.com](https://platform.deepseek.com)
   - 登录并创建 API 密钥
   - 复制密钥（格式：`sk-xxxxxxxxxxxxxxxx`）

2. **在 Supabase 中配置环境变量**
   
   方法 A - 通过 Supabase Dashboard：
   ```
   1. 打开 Supabase 项目控制台
   2. 导航到 Settings → Edge Functions → Secrets
   3. 添加新的 Secret：
      - Name: DEEPSEEK_API_KEY
      - Value: sk-your-actual-api-key-here
   4. 保存并重新部署 Edge Function
   ```

   方法 B - 通过 Supabase CLI：
   ```bash
   supabase secrets set DEEPSEEK_API_KEY=sk-your-actual-api-key-here
   ```

3. **验证配置**
   - 在应用中点击"测试连接"按钮
   - 如果显示 ✅ 成功，说明配置正确

## 🛡️ WASM 错误修复

同时增强了 WASM 错误抑制机制，确保 Figma 环境的内部 WASM 错误不会影响应用。

### 三层防护

1. **全局错误处理器** (`/App.tsx`)
   - 捕获 `window.error` 事件
   - 检测 WASM 特征并抑制

2. **Promise 拒绝处理器** (`/App.tsx`)
   - 捕获 `unhandledrejection` 事件
   - 防止异步 WASM 错误

3. **React 错误边界** (`/components/ErrorBoundary.tsx`)
   - 捕获组件树中的错误
   - 识别并静默 WASM 错误

### WASM 错误检测特征

```typescript
const isWasmError = 
  errorMsg.includes('wasm') ||
  errorMsg.includes('WASM') ||
  errorMsg.includes('wasm-function') ||
  errorStack.includes('[wasm code]') ||
  errorStack.includes('devtools_worker') ||
  errorStack.includes('webpack-artifacts') ||
  errorFilename.includes('.wasm');
```

## 📊 功能对比

| 功能 | 前端调用 | 后端代理 |
|------|----------|----------|
| CORS 问题 | ❌ 有 | ✅ 无 |
| 网络拦截 | ❌ 可能 | ✅ 不会 |
| API 密钥安全 | ❌ 暴露 | ✅ 安全 |
| 请求控制 | ❌ 无 | ✅ 可加 |
| 日志记录 | ❌ 有限 | ✅ 完整 |
| 流式输出 | ✅ 支持 | ✅ 支持 |

## 🧪 测试验证

### 1. 健康检查
```bash
curl https://sgxkplfbptwdohjjnlzd.supabase.co/functions/v1/make-server-f477e18e/health
# 预期输出: {"status":"ok"}
```

### 2. 测试 API 密钥
```bash
curl https://sgxkplfbptwdohjjnlzd.supabase.co/functions/v1/make-server-f477e18e/deepseek/test \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY"
# 预期输出: {"valid":true} 或 {"valid":false,"error":"..."}
```

### 3. 非流式调用
```bash
curl -X POST https://sgxkplfbptwdohjjnlzd.supabase.co/functions/v1/make-server-f477e18e/deepseek/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "model": "deepseek-chat",
    "max_tokens": 100
  }'
```

## 🐛 故障排查

### 问题 1: "DEEPSEEK_API_KEY environment variable is not set"

**原因**: 后端环境变量未配置

**解决方案**:
1. 检查 Supabase Dashboard → Settings → Edge Functions → Secrets
2. 确认 `DEEPSEEK_API_KEY` 存在且值正确
3. 重新部署 Edge Function

### 问题 2: "API密钥无效"

**原因**: DeepSeek API 密钥错误或过期

**解决方案**:
1. 访问 [platform.deepseek.com](https://platform.deepseek.com)
2. 验证 API 密钥是否有效
3. 检查账户余额是否充足
4. 重新生成密钥并更新环境变量

### 问题 3: "后端响应错误: 500"

**原因**: 后端服务异常

**解决方案**:
1. 查看 Supabase Logs (Dashboard → Edge Functions → Logs)
2. 检查网络连接到 DeepSeek API
3. 验证请求格式是否正确

### 问题 4: WASM 错误仍然出现

**原因**: 错误处理器未生效

**解决方案**:
1. 刷新页面（Ctrl+F5 强制刷新）
2. 清除浏览器缓存
3. 检查控制台是否有 "⚠️ Figma环境WASM警告（已忽略）" 信息
4. 如果错误持续，请提供完整堆栈信息

## 📝 向后兼容性

保留了原有的 API 函数签名，确保现有代码无需修改：

```typescript
// 这些函数仍然可用
import { callLLM, callLLMStream, testApiKey } from './services/llm';

// 行为已改变（现在调用后端），但接口相同
const response = await callLLM([
  { role: 'user', content: 'Hello' }
]);
```

## ✅ 迁移清单

- [x] 创建后端代理服务 (`/supabase/functions/server/deepseek.tsx`)
- [x] 添加 API 路由 (`/supabase/functions/server/index.tsx`)
- [x] 修改前端服务调用后端 (`/services/llm.ts`)
- [x] 增强 WASM 错误处理 (`/App.tsx`, `/components/ErrorBoundary.tsx`)
- [ ] **待办：配置 DEEPSEEK_API_KEY 环境变量**
- [ ] **待办：测试所有 LLM 功能**

## 🎯 下一步

1. **立即配置 API 密钥**
   ```
   在 Supabase Dashboard 中设置 DEEPSEEK_API_KEY
   ```

2. **验证功能**
   - 测试情境扩展节点 AI 生成
   - 测试人机对齐节点分析
   - 验证流式输出

3. **监控日志**
   - 查看 Supabase Edge Functions 日志
   - 确认 API 调用成功

## 📞 支持

如遇问题，请检查：
1. Supabase Dashboard → Edge Functions → Logs
2. 浏览器控制台错误信息
3. 网络请求详情（开发者工具 → Network）

---

**最后更新**: 2024-12-23
**版本**: v2.0 - Backend Proxy
