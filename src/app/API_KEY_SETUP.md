# 🔑 DeepSeek API 密钥设置指南

## ⚡ 快速开始

你的应用现在使用 **Supabase 后端代理** 来调用 DeepSeek API，这样可以避免 CORS 跨域问题。

### 第 1 步：获取 DeepSeek API 密钥

1. 访问 **[platform.deepseek.com](https://platform.deepseek.com)**
2. 注册/登录账号
3. 导航到 **API Keys** 页面
4. 点击 **Create new secret key**
5. 复制密钥（格式类似：`sk-xxxxxxxxxxxxxxxxxxxxxxxx`）

> ⚠️ **重要**：密钥只显示一次，请立即复制保存！

### 第 2 步：在 Supabase 中配置环境变量

#### 方法 A：通过 Supabase Dashboard（推荐）

1. 打开你的 Supabase 项目控制台
2. 点击左侧菜单 **Settings** → **Edge Functions**
3. 选择 **Secrets** 标签页
4. 点击 **Add Secret**
5. 填写信息：
   - **Name**: `DEEPSEEK_API_KEY`
   - **Value**: 粘贴你的 DeepSeek API 密钥（sk-xxx...）
6. 点击 **Save**
7. 重新部署你的 Edge Function（如果需要）

#### 方法 B：通过 Supabase CLI

如果你安装了 Supabase CLI：

```bash
supabase secrets set DEEPSEEK_API_KEY=sk-your-actual-api-key-here
```

### 第 3 步：验证配置

1. 在你的应用中，打开 **设置**（齿轮图标）
2. 在 LLM API 配置部分，点击 **测试连接** 按钮
3. 如果显示 ✅ **连接成功**，说明配置正确！

## 📍 你的 Supabase 信息

```
Project ID: sgxkplfbptwdohjjnlzd
Edge Function URL: https://sgxkplfbptwdohjjnlzd.supabase.co/functions/v1/make-server-f477e18e
```

## 🔍 故障排查

### ❌ "DEEPSEEK_API_KEY environment variable is not set"

**问题**：后端找不到 API 密钥

**解决方案**：
1. 确认你在 Supabase Dashboard 中正确设置了 `DEEPSEEK_API_KEY`
2. 检查密钥名称拼写是否完全匹配（区分大小写）
3. 尝试重新部署 Edge Function

### ❌ "API密钥无效"

**问题**：DeepSeek 拒绝了你的 API 密钥

**解决方案**：
1. 检查密钥是否正确复制（没有多余空格）
2. 确认密钥格式是否正确（应以 `sk-` 开头）
3. 登录 [platform.deepseek.com](https://platform.deepseek.com) 验证密钥是否有效
4. 检查账户余额是否充足

### ❌ "账户余额不足"

**问题**：DeepSeek 账户没有余额

**解决方案**：
1. 访问 [platform.deepseek.com](https://platform.deepseek.com)
2. 充值账户余额
3. 重新测试连接

### ❌ "后端响应错误: 500"

**问题**：Supabase Edge Function 内部错误

**解决方案**：
1. 查看 Supabase Logs：Dashboard → Edge Functions → Logs
2. 检查网络连接
3. 联系支持团队并提供日志信息

## 💡 测试 API 调用

你可以在应用中测试以下功能：

### 1. 情境扩展节点
- 选择"情境扩展"节点
- 点击 **生成长尾场景**
- 观察 AI 是否正常生成场景

### 2. 人机对齐节点
- 选择"人机对齐"节点
- 点击 **AI对齐分析**
- 检查是否能看到流式输出的分析结果

## 📊 API 使用监控

### DeepSeek 控制台
访问 [platform.deepseek.com](https://platform.deepseek.com) 查看：
- API 调用次数
- Token 使用量
- 剩余额度
- 调用历史

### Supabase 日志
访问 Supabase Dashboard → Edge Functions → Logs 查看：
- 请求成功/失败记录
- 错误详情
- 性能指标

## 🎯 最佳实践

1. **保护密钥安全**
   - ✅ 存储在 Supabase 环境变量中（后端）
   - ❌ 不要提交到 Git 仓库
   - ❌ 不要在前端代码中硬编码
   - ❌ 不要分享给他人

2. **监控使用量**
   - 定期检查 DeepSeek 账户余额
   - 设置使用量警报（如果可用）
   - 监控异常调用模式

3. **错误处理**
   - 应用已内置完善的错误处理
   - 查看控制台日志获取详细信息
   - 保留错误截图用于排查

## ✅ 配置完成清单

- [ ] 获取 DeepSeek API 密钥
- [ ] 在 Supabase 中设置 `DEEPSEEK_API_KEY` 环境变量
- [ ] 测试连接成功
- [ ] 测试情境扩展节点 AI 生成
- [ ] 测试人机对齐节点 AI 分析
- [ ] 验证流式输出正常工作

## 🆘 需要帮助？

如果遇到问题：
1. 检查浏览器控制台错误信息
2. 查看 Supabase Edge Functions 日志
3. 参考 `/BACKEND_MIGRATION_GUIDE.md` 详细文档
4. 确认网络连接正常

---

**配置完成后，你的应用将拥有完整的 AI 能力！** 🚀
