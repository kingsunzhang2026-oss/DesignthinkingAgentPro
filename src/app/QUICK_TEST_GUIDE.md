# ⚡ DeepSeek 后端快速测试指南

## 🚀 一分钟快速测试

### 步骤 1: 配置环境变量（一次性）

1. 打开 https://supabase.com/dashboard
2. 选择项目 `lihlsmfxyfbpieqpgcqu`
3. Settings → Edge Functions → Secrets
4. 添加 Secret:
   - Name: `DEEPSEEK_API_KEY`
   - Value: `sk-你的DeepSeek密钥`
5. 点击 Save

### 步骤 2: 测试连接

**在应用中测试**:
1. 打开 Figma Make 应用
2. 点击左侧 ⚙️ 设置图标
3. 点击 "🔌 测试后端连接"

**或在浏览器中测试**:
1. 打开 `/test-deepseek-connection.html`
2. 点击 "🔌 测试后端连接"

---

## ✅ 成功标志

```
✅ 后端连接成功！DeepSeek API 工作正常。
```

---

## ❌ 失败？快速排查

### 错误 1: `DEEPSEEK_API_KEY not configured`
**解决**: 在 Supabase 中添加环境变量（见步骤 1）

### 错误 2: `后端响应错误: 401`
**解决**: API 密钥无效，重新生成并更新

### 错误 3: `后端响应错误: 404`
**解决**: Edge Function 未部署，需要部署 `deepseek-proxy`

---

## 📞 需要帮助？

查看完整文档:
- `/DEEPSEEK_PROXY_SETUP.md` - 详细配置指南
- `/INTEGRATION_COMPLETE.md` - 集成完成报告

---

## 🔗 关键链接

- DeepSeek 平台: https://platform.deepseek.com
- Supabase Dashboard: https://supabase.com/dashboard
- 后端 URL: `https://lihlsmfxyfbpieqpgcqu.supabase.co/functions/v1/deepseek-proxy`

---

**提示**: 所有测试都会在浏览器控制台输出详细日志，按 F12 查看！
