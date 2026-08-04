# LLM API 集成说明

## 概述

本应用已集成 DeepSeek API，用于 AI 场景生成功能。所有实现都采用轻量级设计，避免 WASM 错误。

## 功能特性

### 1. API 密钥管理
- ✅ 本地安全存储（localStorage）
- ✅ API 密钥测试验证
- ✅ 一键清除功能

### 2. AI 场景生成
- ✅ 基于设备名称生成长尾场景
- ✅ 支持知识库文档上下文
- ✅ 实时进度反馈
- ✅ 错误处理和重试

### 3. 知识库管理
- ✅ 支持 TXT、MD 文件完整解析
- ⚠️ PDF、DOCX 显示占位符（避免 WASM 库）
- ✅ 文件内容自动提取
- ✅ 批量上传处理

## 使用步骤

### 第一步：配置 API 密钥

1. 点击左侧边栏的「设置」按钮（齿轮图标）
2. 在「API 密钥」区域输入您的 DeepSeek API 密钥
3. 点击「测试 API 密钥」验证密钥有效性
4. 看到「✅ API 密钥有效」提示后，点击「保存设置」

**获取 API 密钥：**
- 访问 https://platform.deepseek.com
- 注册/登录账号
- 在控制台创建 API Key
- 复制密钥并粘贴到应用中

### 第二步：上传知识库文档（可选）

1. 在设置页面的「AI 知识库」区域
2. 点击上传区域或拖拽文件
3. 支持的格式：
   - **TXT** - 完整解析 ✅
   - **MD** - 完整解析 ✅
   - **PDF** - 占位符 ⚠️（建议转换为 TXT/MD）
   - **DOCX** - 占位符 ⚠️（建议转换为 TXT/MD）

**最佳实践：**
- 上传国标、行标、设计规范等参考文档
- 将 PDF/DOCX 文档另存为 TXT 或 MD 格式以获得完整解析
- 单个文档建议不超过 5MB

### 第三步：生成 AI 场景

1. 在「情境扩展节点」面板中
2. 输入设备名称（默认：小钳智能双极电刀）
3. 点击「AI 模拟长尾场景」按钮
4. 等待生成完成（约 5-15 秒）
5. 查看生成的 2-3 个长尾场景
6. 选择需要的场景加入验证清单

## 技术架构

### 轻量级设计原则

为避免 WASM 错误，本应用采用以下设计：

1. **原生 Fetch API**
   - 不使用 axios、got 等库
   - 直接使用 `fetch()` 进行 HTTP 请求
   - 手动处理 SSE 流式响应

2. **避免重量级文档解析库**
   - 不使用 pdf.js（WASM）
   - 不使用 mammoth（WASM）
   - 仅支持文本文件的完整解析

3. **简化的流式输出**
   - 使用回调函数而非 async generator
   - 手动解析 SSE 数据流
   - 避免复杂的流处理库

### 文件结构

```
/services/
  ├── llm.ts              # DeepSeek API 集成
  ├── documents.ts        # 文档读取服务
  ├── aiScenarios.ts      # AI 场景生成
  └── debug.ts            # 调试工具

/components/
  ├── SettingsModal.tsx   # 设置页面（API 密钥 + 知识库）
  └── panels/
      └── ContextPanel.tsx # 情境节点（AI 生成）
```

## API 使用示例

### 基础调用

```typescript
import { callLLM } from './services/llm';

const messages = [
  { role: 'system', content: '你是一位医疗器械专家' },
  { role: 'user', content: '生成一个长尾场景' }
];

const response = await callLLM(messages);
console.log(response);
```

### 流式调用

```typescript
import { callLLMStream } from './services/llm';

await callLLMStream(
  messages,
  (chunk) => {
    if (!chunk.done) {
      console.log(chunk.content);
    }
  }
);
```

### 场景生成

```typescript
import { generateScenarios } from './services/aiScenarios';

const scenarios = await generateScenarios(
  '小钳智能双极电刀',
  knowledgeBase,
  (progress) => console.log(progress)
);
```

## 故障排查

### 问题：API 密钥测试失败

**可能原因：**
1. 密钥格式错误
2. 密钥已过期或被撤销
3. 网络连接问题
4. API 服务暂时不可用

**解决方法：**
1. 检查密钥是否完整复制
2. 在 DeepSeek 控制台确认密钥状态
3. 检查网络连接
4. 稍后重试

### 问题：AI 生成失败

**可能原因：**
1. 未配置 API 密钥
2. API 配额用尽
3. 请求超时
4. 响应格式解析错误

**解决方法：**
1. 确认已配置有效的 API 密钥
2. 检查 DeepSeek 账户余额
3. 重试生成
4. 查看浏览器控制台错误信息

### 问题：WASM 错误

**如果仍然遇到 WASM 错误：**

1. **打开 Source Map**
   ```javascript
   // 在浏览器控制台运行
   localStorage.setItem('debug', 'true');
   location.reload();
   ```

2. **查看错误堆栈**
   - 打开开发者工具 → Console
   - 查找 `wasm-function[XXXX]` 引用
   - 确定是哪个依赖导致的

3. **内存检查**
   ```javascript
   // 在浏览器控制台运行
   import { logMemoryUsage } from './services/debug';
   logMemoryUsage();
   ```

4. **环境检查**
   ```javascript
   // 在浏览器控制台运行
   import { performStartupCheck } from './services/debug';
   performStartupCheck();
   ```

## 性能优化

### 文档大小限制

- 单个文档建议不超过 5MB
- 知识库总大小建议不超过 20MB
- 自动截断过长的上下文（8000 字符）

### Token 优化

- 每次生成约消耗 2000-4000 tokens
- 包含知识库时约消耗 10000-15000 tokens
- 可通过精简文档减少 token 消耗

### 缓存策略

- API 密钥本地缓存
- 文档内容内存缓存
- 场景结果不缓存（确保每次生成都是新的）

## 安全说明

### API 密钥安全

- ✅ 仅存储在本地 localStorage
- ✅ 不会发送到任何第三方服务器
- ✅ 仅在 HTTPS 连接下使用
- ⚠️ 不要在公共设备上保存密钥

### 数据隐私

- ✅ 所有数据处理在前端完成
- ✅ 文档内容不会上传到服务器
- ⚠️ AI 生成的场景会发送到 DeepSeek API
- ⚠️ 不建议上传包含敏感信息的文档

## 未来改进

### 短期计划

- [ ] 支持更多 LLM 提供商（OpenAI、Claude 等）
- [ ] 流式输出的实时显示
- [ ] 场景生成的自定义参数
- [ ] 批量场景生成

### 长期计划

- [ ] 后端 PDF 解析服务
- [ ] 向量数据库集成（知识库检索）
- [ ] 场景生成历史记录
- [ ] 导出场景报告

## 支持

如有问题或建议，请联系开发团队。

---

**最后更新：** 2024-12-22  
**版本：** v1.0.0
