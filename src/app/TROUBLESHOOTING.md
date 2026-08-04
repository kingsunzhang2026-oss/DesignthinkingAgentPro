# 故障排查指南

## WASM 错误诊断

### ⚠️ 重要提示：Figma 环境 WASM 警告

**如果你在控制台看到 `wasm-function[XXXX]` 错误，但应用功能正常运行，这是 Figma 开发环境的内部警告，可以安全忽略。**

应用已经实施了以下保护措施：
- ✅ 全局错误处理器自动捕获和抑制 Figma 环境的 WASM 错误
- ✅ 错误边界会识别 WASM 错误并提供友好的提示
- ✅ 所有调试工具都有错误保护，不会因环境问题而崩溃

### 判断 WASM 错误是否影响应用

**不影响应用的情况（可以忽略）：**
- ❓ 错误堆栈包含 `devtools_worker` 
- ❓ 错误来自 `figma.com/webpack-artifacts`
- ❓ 所有功能（场景生成、文档上传、节点操作）都正常工作
- ❓ 控制台显示 `⚠️ 检测到Figma环境WASM警告（已忽略）`

**需要处理的情况（影响功能）：**
- 🔴 应用界面完全不显示
- 🔴 点击按钮无响应
- 🔴 无法输入文本或上传文件
- 🔴 错误边界显示错误页面且无法恢复

### 如果 WASM 错误真的影响了功能

如果遇到 `wasm-function[XXXX]` 错误且影响应用功能，请按以下步骤排查：

### 1. 开启 Source Map

在浏览器控制台运行：

```javascript
localStorage.setItem('debug', 'true');
location.reload();
```

### 2. 查看完整错误堆栈

1. 打开开发者工具（F12）
2. 切换到 Console 标签
3. 查找红色错误信息
4. 展开错误堆栈，找到第一个非 node_modules 的文件

### 3. 检查内存使用

在控制台运行（Chrome/Edge）：

```javascript
// 查看当前内存使用
if (performance.memory) {
  console.log('已用内存:', Math.round(performance.memory.usedJSHeapSize / 1024 / 1024), 'MB');
  console.log('内存限制:', Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024), 'MB');
}
```

如果内存使用接近限制（>90%），可能是内存泄漏。

### 4. 清除缓存

```javascript
// 清除所有本地存储
localStorage.clear();
sessionStorage.clear();

// 刷新页面
location.reload();
```

### 5. 检查依赖包

查看是否有以下可能导致 WASM 错误的包：

```bash
# 在项目目录运行
npm list pdfjs-dist
npm list mammoth
npm list docxtemplater
npm list office-text-extractor
```

如果发现这些包，考虑移除它们。

## 常见问题

### Q1: API 密钥测试失败

**症状：** 点击"测试 API 密钥"后显示"API 密钥无效"

**解决方案：**

1. **检查密钥格式**
   - 确保完整复制了密钥
   - 密钥不应包含空格或换行符
   - 确认密钥以 `sk-` 开头

2. **验证密钥状态**
   - 登录 https://platform.deepseek.com
   - 检查密钥是否已被撤销
   - 确认账户余额充足

3. **检查网络连接**
   - 在浏览器控制台查看 Network 标签
   - 查找 `https://api.deepseek.com/v1/chat/completions` 请求
   - 检查响应状态码和错误信息

4. **CORS 问题**
   - 如果看到 CORS 错误，这是正常的（浏览器限制）
   - DeepSeek API 支持跨域请求，确保请求头正确

### Q2: AI 生成场景失败

**症状：** 点击"AI 模拟长尾场景"后显示错误

**可能原因及解决方案：**

1. **未配置 API 密钥**
   - 错误信息：`未配置API密钥`
   - 解决：先在设置中配置密钥

2. **API 配额用尽**
   - 错误信息：`insufficient_quota` 或类似
   - 解决：在 DeepSeek 控制台充值

3. **请求超时**
   - 错误信息：`fetch failed` 或 `timeout`
   - 解决：检查网络连接，重试生成

4. **响应格式错误**
   - 错误信息：`AI响应格式错误`
   - 解决：这通常是 AI 返回的内容不符合预期格式
   - 重试通常可以解决

5. **知识库文档过大**
   - 症状：生成时间很长或失败
   - 解决：减少上传的文档数量或大小
   - 建议：单个文档 < 5MB，总大小 < 20MB

### Q3: 文档上传后无法读取

**症状：** 上传文档后，AI 生成的场景没有使用文档内容

**解决方案：**

1. **PDF/DOCX 文档**
   - 当前版本对 PDF/DOCX 仅显示占位符
   - **最佳方案：** 将文档另存为 .txt 或 .md 格式
   
   如何转换：
   - **PDF → TXT**: 在 Adobe Reader 中 "文件 → 另存为文本"
   - **DOCX → TXT**: 在 Word 中 "文件 → 另存为 → 纯文本"
   - **在线转换**: 使用 https://www.zamzar.com 等在线工具

2. **检查文档内容**
   - 在设置页面查看已上传的文档
   - 点击文档查看是否正确提取了内容
   - 如果显示 `[PDF文档: xxx]`，说明内容未提取

3. **文件编码问题**
   - TXT 文件建议使用 UTF-8 编码
   - 如果内容乱码，重新保存为 UTF-8 格式

### Q4: 应用加载缓慢或卡顿

**症状：** 页面响应慢，操作延迟

**解决方案：**

1. **检查内存使用**
   ```javascript
   // 在控制台运行
   if (performance.memory) {
     const used = performance.memory.usedJSHeapSize / 1024 / 1024;
     const limit = performance.memory.jsHeapSizeLimit / 1024 / 1024;
     console.log(`内存: ${used.toFixed(0)}MB / ${limit.toFixed(0)}MB`);
   }
   ```

2. **清理知识库**
   - 删除不需要的文档
   - 建议保留 < 10 个常用文档

3. **清理浏览器缓存**
   - Chrome: Ctrl+Shift+Delete
   - 选择"缓存的图片和文件"
   - 清除后刷新页面

4. **关闭其他标签页**
   - 浏览器标签页过多会占用内存
   - 关闭不需要的标签页

### Q5: 场景生成的内容不符合预期

**症状：** AI 生成的场景质量不高或不相关

**优化方法：**

1. **优化设备名称**
   - 使用具体的设备名称
   - 例如："小钳智能双极电刀 V2" 比 "电刀" 更好

2. **上传相关文档**
   - 上传该设备的说明书
   - 上传相关的国标、行标
   - 上传设计规范文档

3. **重试生成**
   - AI 生成有随机性
   - 如果结果不满意，可以多次生成并选择最佳的

4. **手动编辑**
   - 使用"新增场景"功能手动创建
   - 或者基于 AI 生成的结果进行编辑

## 调试工具

### 启动环境检查

应用启动时会自动运行环境检查（开发模式），查看控制台输出：

```
🔍 系统环境检查
================
浏览器功能支持: { fetch: true, localStorage: true, ... }
[启动时] 内存使用: XXX MB / XXX MB
✅ 未检测到WASM库
================
```

### 手动运行检查

```javascript
// 在控制台运行
import { performStartupCheck } from './services/debug';
performStartupCheck();
```

### 性能监控

```javascript
// 在控制台运行
import { PerformanceMonitor } from './services/debug';

const monitor = new PerformanceMonitor('场景生成');
// ... 执行操作 ...
monitor.end();
```

## 错误边界

应用包含错误边界，会捕获所有运行时错误。如果看到错误页面：

1. **查看错误详情** - 页面会显示错误信息
2. **检查是否 WASM 错误** - 如果是，页面会特别标注
3. **尝试恢复** - 点击"尝试恢复"按钮
4. **刷新页面** - 点击"刷新页面"按钮
5. **查看完整堆栈** - 展开"显示完整堆栈"查看详细信息

## 联系支持

如果以上方法都无法解决问题：

1. 打开开发者工具（F12）
2. 切换到 Console 标签
3. 复制所有错误信息
4. 截图错误页面
5. 联系开发团队并提供：
   - 错误信息
   - 截图
   - 操作步骤
   - 浏览器版本
   - 操作系统版本

## 最佳实践

为避免问题，建议遵循以下最佳实践：

### 文档管理

- ✅ 使用 TXT/MD 格式的文档
- ✅ 单个文档 < 5MB
- ✅ 总文档数 < 10 个
- ❌ 避免上传大型 PDF/DOCX

### API 使用

- ✅ 定期检查 API 配额
- ✅ 保存好 API 密钥
- ✅ 不要在公共设备上保存密钥
- ❌ 不要分享 API 密钥

### 性能优化

- ✅ 定期清理不用的场景
- ✅ 关闭不用的浏览器标签
- ✅ 使用最新版本的浏览器
- ❌ 避免同时打开多个应用实例

### 数据安全

- ✅ 定期导出重要数据
- ✅ 不要上传敏感信息
- ✅ 使用 HTTPS 连接
- ❌ 不要在不安全的网络环境下使用

---

**最后更新：** 2024-12-22  
**适用版本：** v1.0.0