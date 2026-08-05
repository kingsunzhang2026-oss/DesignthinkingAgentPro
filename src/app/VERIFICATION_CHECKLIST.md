# ✅ 验证清单

## 立即验证（无需配置）

### 1. WASM 错误已修复 ✅

**验证步骤**:
1. 打开 Figma Make 应用
2. 按 `F12` 打开浏览器控制台
3. 查看 Console 标签

**✅ 成功标志**:
- 不应看到任何包含 `wasm-function` 的错误
- 不应看到任何包含 `devtools_worker` 的错误
- 不应看到任何包含 `webpack-artifacts` 的错误

**❌ 如果仍有错误**:
1. 硬刷新页面：`Ctrl + Shift + R` (Windows) 或 `Cmd + Shift + R` (Mac)
2. 清除浏览器缓存
3. 查看 `/WASM_ERROR_COMPLETE_FIX.md` 故障排查部分

---

### 2. 错误抑制器工作正常 ✅

**验证步骤**:
1. 打开 `/test-wasm-suppressor.html` 文件
2. 点击 "初始化错误抑制器"
3. 点击各个测试按钮

**✅ 成功标志**:
- WASM 错误按钮：控制台不显示错误（被拦截）
- 正常错误按钮：控制台正常显示错误（红色）

---

### 3. 前端代码集成正确 ✅

**验证文件**:

| 文件 | 检查内容 | 状态 |
|------|----------|------|
| `/App.tsx` | 导入 `initErrorSuppressor` | ✅ |
| `/App.tsx` | 调用 `initErrorSuppressor()` | ✅ |
| `/utils/errorSuppressor.ts` | 文件存在 | ✅ |
| `/services/llm.ts` | 后端 URL 正确 | ✅ |
| `/components/DeepSeekTestPanel.tsx` | 文件存在 | ✅ |
| `/components/SettingsModal.tsx` | 包含测试面板 | ✅ |

**快速检查命令**（在项目根目录）:
```bash
# 检查关键文件是否存在
ls -la /utils/errorSuppressor.ts
ls -la /components/DeepSeekTestPanel.tsx
```

---

## 需要配置后验证

### 4. DeepSeek 后端连接 ⏳

⚠️ **前置条件**: 必须先在 Supabase 中配置 `DEEPSEEK_API_KEY`

**配置步骤**:
1. 访问 https://platform.deepseek.com
2. 创建 API 密钥
3. 打开 https://supabase.com/dashboard
4. 项目: `sgxkplfbptwdohjjnlzd`
5. Settings → Edge Functions → Secrets
6. 添加: `DEEPSEEK_API_KEY` = `sk-你的密钥`

**验证步骤**:
1. 打开 Figma Make 应用
2. 点击左侧 ⚙️ 设置图标
3. 在 "DeepSeek API 测试面板" 中点击 "🔌 测试后端连接"

**✅ 成功标志**:
```
✅ 后端连接成功！DeepSeek API 工作正常。
```

**❌ 失败标志**:
```
❌ 连接失败: DEEPSEEK_API_KEY not configured
❌ 连接失败: 后端响应错误: 401
```

**故障排查**:
- 参考 `/DEEPSEEK_PROXY_SETUP.md`
- 查看 Supabase 控制台日志

---

### 5. 非流式调用测试 ⏳

**前置条件**: 后端连接成功

**验证步骤**:
1. 在 DeepSeek API 测试面板中
2. 点击 "📝 测试非流式调用"
3. 等待响应

**✅ 成功标志**:
- 显示 "✅ 非流式调用成功！"
- 显示 AI 生成的文本响应

**控制台日志**:
```
[LLM] 调用非流式 API: https://sgxkplfbptwdohjjnlzd.supabase.co/functions/v1/deepseek-proxy
[LLM] ✓ 调用成功
```

---

### 6. 流式调用测试 ⏳

**前置条件**: 后端连接成功

**验证步骤**:
1. 在 DeepSeek API 测试面板中
2. 点击 "⚡ 测试流式调用"
3. 观察实时输出

**✅ 成功标志**:
- 文本逐字显示（打字机效果）
- 显示 "✅ 流式调用完成！"

**控制台日志**:
```
[LLM] 调用流式 API: https://sgxkplfbptwdohjjnlzd.supabase.co/functions/v1/deepseek-proxy
[LLM] ✓ 流式调用完成
```

---

## 独立测试工具验证

### 7. 独立连接测试页面 ✅

**验证步骤**:
1. 在浏览器中打开 `/test-deepseek-connection.html`
2. 点击 "🔌 测试后端连接"

**✅ 成功标志**:
- 显示 "✅ 后端连接成功！"
- 响应内容正常显示

---

### 8. 独立错误抑制测试页面 ✅

**验证步骤**:
1. 在浏览器中打开 `/test-wasm-suppressor.html`
2. 按照页面指引操作

**✅ 成功标志**:
- WASM 错误被拦截（控制台不显示）
- 正常错误正常显示（控制台显示）

---

## 浏览器控制台快速测试

### 9. 手动 API 调用测试 ⏳

**前置条件**: 已配置 `DEEPSEEK_API_KEY`

在浏览器控制台粘贴以下代码：

```javascript
fetch('https://sgxkplfbptwdohjjnlzd.supabase.co/functions/v1/deepseek-proxy', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpaGxzbWZ4eWZicGllcXBnY3F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0NTM5NjEsImV4cCI6MjA4MjAyOTk2MX0.jX61rIz7-YlRP3fRlzDYAgfW6R6iG2rNSURYgDu261k'
  },
  body: JSON.stringify({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: '你好' }],
    max_tokens: 20,
    stream: false
  })
})
.then(response => response.json())
.then(data => {
  console.log('✅ API 调用成功:', data);
  console.log('📝 响应内容:', data.choices[0]?.message?.content);
})
.catch(error => {
  console.error('❌ API 调用失败:', error);
});
```

**✅ 成功标志**:
```javascript
✅ API 调用成功: { id: "...", choices: [...], ... }
📝 响应内容: 你好！有什么我可以帮助你的吗？
```

---

## 完整验证流程

### 🎯 推荐验证顺序

```
1. ✅ 打开应用 → 检查控制台无 WASM 错误
   ↓
2. ✅ 打开 /test-wasm-suppressor.html → 验证抑制器工作
   ↓
3. ⏳ 在 Supabase 配置 DEEPSEEK_API_KEY
   ↓
4. ⏳ 在应用中测试后端连接
   ↓
5. ⏳ 测试非流式调用
   ↓
6. ⏳ 测试流式调用
   ↓
7. 🎉 所有功能验证完成！
```

---

## 验证结果模板

复制以下模板，填写验证结果：

```
## 验证结果

日期: ___________
验证人: ___________

### WASM 错误修复
- [ ] 控制台无 WASM 错误
- [ ] 错误抑制器测试通过
- [ ] 正常错误正常显示

### DeepSeek 后端集成
- [ ] Supabase 环境变量已配置
- [ ] 后端连接测试成功
- [ ] 非流式调用测试成功
- [ ] 流式调用测试成功

### 独立测试工具
- [ ] test-deepseek-connection.html 测试通过
- [ ] test-wasm-suppressor.html 测试通过

### 控制台日志
- [ ] 无异常错误输出
- [ ] LLM 日志正常显示
- [ ] 调试信息清晰可读

### 总体评估
状态: [ ] 完全正常 [ ] 部分正常 [ ] 需要修复

备注:
___________________________________________
___________________________________________
```

---

## 故障排查快速链接

| 问题 | 参考文档 |
|------|----------|
| WASM 错误仍存在 | `/WASM_ERROR_COMPLETE_FIX.md` |
| DeepSeek 连接失败 | `/DEEPSEEK_PROXY_SETUP.md` |
| 快速测试指南 | `/QUICK_TEST_GUIDE.md` |
| 完整集成报告 | `/INTEGRATION_COMPLETE.md` |
| 最终修复总结 | `/FINAL_FIX_SUMMARY.md` |

---

**图例**:
- ✅ 可立即验证（无需配置）
- ⏳ 需要配置后验证
- 🎉 全部完成

---

**最后更新**: 2024年12月23日  
**下一步**: 完成 Supabase API 密钥配置，开始验证后端功能
