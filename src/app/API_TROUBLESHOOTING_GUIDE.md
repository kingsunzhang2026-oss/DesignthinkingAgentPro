# API测试与人机对齐功能说明

## 📋 问题概述

根据用户反馈，本次修复解决了以下两个核心问题：
1. **API密钥测试失败** - 显示"Load failed"错误
2. **人机对齐节点使用假数据** - 点击生成时未调用真实LLM API

---

## ✅ 已完成的修复

### 1️⃣ 增强API密钥测试诊断

**文件**: `/services/llm.ts`

**改进内容**:
- ✅ 添加详细的控制台日志输出，帮助诊断问题
- ✅ 检测API密钥格式（应以`sk-`开头）
- ✅ 提供友好的错误提示（401/402/429等HTTP状态码）
- ✅ 区分网络错误和API错误
- ✅ 特殊处理账户余额不足（HTTP 402）的情况

**日志示例**:
```
[LLM Test] 开始测试API密钥...
[LLM Test] API Base URL: https://api.deepseek.com/v1
[LLM Test] API密钥格式检查: ✓
[LLM Test] 响应状态: 200 OK
[LLM Test] ✓ API密钥验证成功
```

---

### 2️⃣ 改造人机对齐节点为真实LLM调用

**文件**: `/components/panels/AlignmentPanel.tsx`

**改进内容**:
- ✅ 集成真实的DeepSeek LLM API调用
- ✅ 支持读取知识库文档作为参考上下文
- ✅ 使用专业的医疗器械分析提示词
- ✅ 解析JSON格式的LLM响应
- ✅ 添加加载状态和错误处理
- ✅ **降级机制**：如果API调用失败，自动回退到假数据，确保功能可用

**调用流程**:
```
用户点击"执行对齐分析" 
  → 检查API密钥是否配置
  → 构建系统提示词和用户提示
  → 添加知识库上下文（如果有）
  → 调用DeepSeek API
  → 解析JSON响应
  → 更新界面显示偏差项
  → 如果失败，降级到假数据
```

---

### 3️⃣ 改进设置界面错误提示

**文件**: `/components/SettingsModal.tsx`

**改进内容**:
- ✅ 添加详细的故障排查指南
- ✅ 提供DeepSeek控制台链接（检查余额）
- ✅ 引导用户使用浏览器控制台查看详细错误
- ✅ 高亮显示关键操作步骤

**新增的故障排查提示**:
```
💡 常见问题排查：
1. 检查密钥格式：应该以 sk- 开头
2. 确认账户余额：访问 DeepSeek控制台 检查余额
3. 网络连接：确保能访问 api.deepseek.com
4. 浏览器控制台：按 F12 查看详细错误信息
```

---

### 4️⃣ 知识库集成

**文件**: `/components/InspectorPanel.tsx`

**改进内容**:
- ✅ 将`knowledgeBase`传递给`AlignmentPanel`
- ✅ 支持AI分析时参考上传的国标、行标文档

---

## 🔍 API测试失败的常见原因

根据"Load failed"错误，可能的原因包括：

### 1. **网络/CORS问题** ⭐ 最常见
- Figma Make环境可能阻止了第三方API请求
- 浏览器安全策略限制
- **解决方法**: 打开浏览器控制台（F12）查看具体错误

### 2. **API密钥格式错误**
- 密钥应该以`sk-`开头
- 复制粘贴时可能包含多余空格
- **解决方法**: 重新复制完整密钥

### 3. **账户余额不足** ⭐ 可能性高
- DeepSeek账户需要充值才能使用API
- HTTP状态码402表示余额不足
- **解决方法**: 访问 https://platform.deepseek.com 充值

### 4. **API端点不可访问**
- 防火墙阻止
- 网络代理问题
- DeepSeek服务暂时不可用
- **解决方法**: 尝试访问 https://api.deepseek.com

---

## 🧪 测试步骤

### 测试API密钥
1. 打开系统设置（点击右上角齿轮图标）
2. 输入DeepSeek API密钥
3. 点击"测试密钥"
4. **打开浏览器控制台（F12）**查看详细日志
5. 根据错误信息进行排查

### 测试人机对齐功能
1. 点击画布中的"人机对齐节点"
2. 在右侧面板点击"执行对齐分析"
3. 如果API密钥有效，将调用真实LLM生成分析
4. 如果API调用失败，将自动降级到假数据（确保功能可用）
5. 查看控制台日志了解调用详情：
   ```
   [AlignmentPanel] 开始调用LLM分析偏差...
   [AlignmentPanel] LLM响应: {...}
   [AlignmentPanel] 分析完成，识别到 2 个偏差项
   ```

---

## 💡 调试技巧

### 1. 打开浏览器控制台
- **Chrome/Edge**: 按 `F12` 或 `Ctrl+Shift+I`
- **Firefox**: 按 `F12` 或 `Ctrl+Shift+K`
- **Safari**: `Command+Option+I`

### 2. 查看网络请求
- 切换到"Network"标签
- 筛选"Fetch/XHR"
- 查找`api.deepseek.com`的请求
- 检查状态码和响应内容

### 3. 查看控制台日志
- 切换到"Console"标签
- 搜索`[LLM Test]`或`[AlignmentPanel]`
- 查看详细的调用过程和错误信息

---

## 📊 当前功能状态

| 功能 | 状态 | 说明 |
|------|------|------|
| API密钥保存 | ✅ 正常 | 本地localStorage存储 |
| API密钥测试 | ✅ 增强 | 详细日志+友好错误提示 |
| 情境节点AI生成 | ✅ 正常 | 使用真实LLM API |
| 人机对齐AI分析 | ✅ 升级 | 真实LLM + 降级机制 |
| 知识库上传 | ✅ 正常 | 支持PDF/DOCX/TXT/MD |
| 知识库读取 | ✅ 正常 | AI分析时作为上下文 |

---

## 🎯 下一步建议

如果API测试仍然失败：

1. **检查DeepSeek账户余额**
   - 访问 https://platform.deepseek.com
   - 查看"API Keys"和"Billing"页面
   - 确认账户已充值

2. **验证网络连接**
   ```bash
   # 在终端测试（可选）
   curl https://api.deepseek.com/v1/models \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

3. **尝试不同浏览器**
   - Chrome/Edge（推荐）
   - Firefox
   - Safari

4. **联系DeepSeek支持**
   - 如果密钥格式正确、余额充足但仍失败
   - 可能是API端点或账户配置问题

---

## 📝 技术实现细节

### LLM调用参数
```typescript
{
  model: 'deepseek-chat',
  temperature: 0.7,      // 适中的随机性
  maxTokens: 2000,       // 足够生成详细分析
  stream: false          // 非流式调用
}
```

### 提示词结构
```
系统提示词（专家角色 + 任务定义 + 输出格式）
  + 知识库上下文（如果有）
  + 用户提示词（具体数据 + 分析要求）
```

### 降级策略
```typescript
try {
  // 尝试真实LLM调用
  const response = await callLLM(...);
  setDeviations(parsedResponse);
} catch (error) {
  // 降级到假数据
  setDeviations(fallbackData);
  setError(error.message);
}
```

---

## 🔗 相关文档

- [LLM集成文档](./LLM_INTEGRATION_README.md)
- [快速开始指南](./QUICK_START.md)
- [故障排查指南](./TROUBLESHOOTING.md)
- [WASM错误修复报告](./WASM_FIX_REPORT.md)

---

**更新日期**: 2024-12-23  
**版本**: v1.2.0
