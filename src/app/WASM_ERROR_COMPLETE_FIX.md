# 🛡️ WASM 错误完全修复指南

## 📋 问题描述

Figma Make 环境中会出现来自 Figma 内部 WASM 模块的错误，这些错误不影响应用功能，但会污染控制台。典型错误格式：

```
<?>.wasm-function[4314]@[wasm code]
<?>.wasm-function[4301]@[wasm code]
@https://www.figma.com/webpack-artifacts/assets/devtools_worker-8cc87c2e8669f46b.min.js.br
```

---

## ✅ 已实施的修复方案

### 1. 专用错误抑制工具 (`/utils/errorSuppressor.ts`)

**功能**:
- ✅ 智能检测 WASM 相关错误
- ✅ 过滤 Figma 特定文件路径
- ✅ 劫持 console.error/warn
- ✅ 拦截全局错误事件
- ✅ 处理未捕获的 Promise 拒绝

**检测规则**:
```typescript
- 关键词: wasm, WASM, wasm-function, wasm-stub, [wasm code]
- 文件路径: devtools_worker, webpack-artifacts, figma.com/webpack-artifacts
- 堆栈格式: wasm-function[数字], <?>.wasm-function
- 特殊情况: filename === '' 或 '?' 或 '<?...'
```

### 2. 应用级集成 (`/App.tsx`)

**实现**:
```typescript
import { initErrorSuppressor } from './utils/errorSuppressor';

useEffect(() => {
  // 初始化错误抑制器
  initErrorSuppressor();
}, []);
```

### 3. 三层防御体系

```
层级 1: 控制台劫持
├── console.error 拦截
├── console.warn 拦截
└── 过滤 WASM 错误输出

层级 2: 事件拦截
├── window.addEventListener('error')
├── window.addEventListener('unhandledrejection')
└── 使用捕获阶段（true）优先级最高

层级 3: 智能检测
├── 关键词检测
├── 文件路径检测
├── 堆栈格式检测
└── 特殊情况处理
```

---

## 🧪 验证方法

### 方法 1: 打开浏览器控制台

1. 按 `F12` 打开开发者工具
2. 切换到 **Console** 标签
3. 查看是否还有 WASM 错误输出

**预期结果**: 
- ❌ 不应出现任何 `wasm-function` 相关错误
- ❌ 不应出现 `devtools_worker` 相关错误
- ✅ 只显示应用自身的日志

### 方法 2: 触发错误事件

```javascript
// 在控制台粘贴以下代码，应该被静默拦截：
console.error('Test wasm-function[123] error');
window.dispatchEvent(new ErrorEvent('error', { 
  message: 'wasm-function test',
  filename: 'devtools_worker.js'
}));
```

**预期结果**: 
- ❌ 不应在控制台显示这些测试错误

### 方法 3: 正常错误测试

```javascript
// 正常错误应该正常显示：
console.error('This is a normal error');
throw new Error('This should be visible');
```

**预期结果**:
- ✅ 正常错误应该正常显示

---

## 🔍 故障排查

### 问题 1: 仍然看到 WASM 错误

**可能原因**:
- 错误抑制器未正确初始化
- 浏览器缓存未清除

**解决方案**:
1. 硬刷新页面（Ctrl + Shift + R / Cmd + Shift + R）
2. 清除浏览器缓存
3. 检查 `/App.tsx` 中是否调用了 `initErrorSuppressor()`
4. 检查浏览器控制台是否有初始化错误

### 问题 2: 正常错误也被过滤了

**可能原因**:
- 检测规则过于激进
- 错误信息包含 "wasm" 关键词

**解决方案**:
1. 检查错误信息是否意外包含 WASM 关键词
2. 修改 `/utils/errorSuppressor.ts` 中的检测规则
3. 添加白名单机制

### 问题 3: 错误抑制器影响性能

**可能原因**:
- 过度的字符串检测
- 事件监听器过多

**解决方案**:
1. 这种影响通常可以忽略不计
2. 如需优化，可以添加缓存机制
3. 减少不必要的 string.includes() 调用

---

## 📊 技术细节

### 错误检测流程

```
1. 错误发生
   ↓
2. 事件监听器捕获（捕获阶段）
   ↓
3. 调用 isWasmError() 检测
   ↓
4. 检测结果？
   ├─ 是 WASM 错误 → 阻止传播 → 静默
   └─ 不是 WASM → 正常处理 → 显示
```

### 控制台劫持机制

```typescript
// 保存原始方法
const originalError = console.error;

// 劫持方法
console.error = function(...args) {
  if (isWasmError(args)) {
    // 静默忽略
    return;
  }
  // 调用原始方法
  originalError.apply(console, args);
};
```

### 事件拦截优先级

```javascript
// 使用捕获阶段（true），优先级最高
window.addEventListener('error', handler, true);
                                        // ^^^^
                                        // 捕获阶段
```

---

## 🎯 最佳实践

### ✅ 推荐做法

1. **在应用启动时立即初始化**
   ```typescript
   useEffect(() => {
     initErrorSuppressor();
   }, []);
   ```

2. **只过滤明确的 WASM 错误**
   - 使用保守的检测规则
   - 避免误伤正常错误

3. **保留调试日志**
   ```typescript
   if (isWasmError) {
     // 可选：输出调试信息
     console.debug('Suppressed WASM error:', errorMsg);
     return;
   }
   ```

### ❌ 不推荐做法

1. **过度抑制所有错误**
   ```typescript
   // 不要这样做！
   console.error = () => {};
   ```

2. **在多个地方初始化**
   ```typescript
   // 不要在多个组件中重复初始化
   // 只在 App.tsx 中初始化一次
   ```

3. **忽略清理函数**
   ```typescript
   // 如果在组件中使用，记得清理
   useEffect(() => {
     const cleanup = initErrorSuppressor();
     return cleanup; // 清理
   }, []);
   ```

---

## 📖 相关文件

- `/utils/errorSuppressor.ts` - 错误抑制工具
- `/App.tsx` - 应用入口（初始化位置）
- `/components/ErrorBoundary.tsx` - React 错误边界

---

## 🔄 更新日志

### v3.0 - 2024-12-23
- ✅ 创建专用 `errorSuppressor.ts` 工具
- ✅ 实现三层防御体系
- ✅ 添加智能 WASM 检测规则
- ✅ 优化检测性能
- ✅ 完善文档

### v2.0 - 之前版本
- ✅ 在 App.tsx 中内联错误处理
- ✅ 基本的 WASM 检测

### v1.0 - 初始版本
- ✅ 简单的错误拦截

---

## 💡 扩展建议

### 可选增强功能

1. **错误统计**
   ```typescript
   let suppressedCount = 0;
   if (isWasmError) {
     suppressedCount++;
     console.debug(`Suppressed ${suppressedCount} WASM errors`);
   }
   ```

2. **白名单机制**
   ```typescript
   const errorWhitelist = ['specific-error-message'];
   if (errorWhitelist.some(msg => errorString.includes(msg))) {
     // 强制显示此错误
     return false;
   }
   ```

3. **开发模式切换**
   ```typescript
   const isDev = process.env.NODE_ENV === 'development';
   if (isDev) {
     // 开发模式下显示更多信息
     console.debug('WASM Error Details:', error);
   }
   ```

---

## 🎓 学习资源

- [MDN: GlobalEventHandlers.onerror](https://developer.mozilla.org/en-US/docs/Web/API/GlobalEventHandlers/onerror)
- [Event Capturing and Bubbling](https://javascript.info/bubbling-and-capturing)
- [Console API](https://developer.mozilla.org/en-US/docs/Web/API/Console)

---

## 📞 支持

如果仍有问题：

1. 检查浏览器控制台是否有初始化错误
2. 查看 `/utils/errorSuppressor.ts` 实现
3. 验证 App.tsx 中的调用
4. 尝试硬刷新或清除缓存

---

**最后更新**: 2024年12月23日  
**状态**: ✅ 完全修复  
**兼容性**: Chrome, Firefox, Safari, Edge
