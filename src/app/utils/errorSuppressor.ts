/**
 * 终极 WASM 错误抑制器
 * 用于彻底屏蔽 Figma 环境的 WASM 内部错误
 */

/**
 * 检测是否为 WASM 相关错误
 */
export function isWasmError(error: any): boolean {
  // 将错误转为字符串进行检测
  let errorString = '';
  
  if (typeof error === 'string') {
    errorString = error;
  } else if (error?.message) {
    errorString = error.message + ' ' + (error.stack || '');
  } else if (error?.stack) {
    errorString = error.stack;
  } else if (error?.filename) {
    errorString = error.filename;
  } else {
    try {
      errorString = JSON.stringify(error);
    } catch {
      errorString = String(error);
    }
  }
  
  // 超级激进的检测规则
  return (
    // 关键词检测
    errorString.includes('wasm') ||
    errorString.includes('WASM') ||
    errorString.toLowerCase().includes('wasm') ||
    errorString.includes('wasm-function') ||
    errorString.includes('wasm-stub') ||
    errorString.includes('[wasm code]') ||
    errorString.includes('[wasm')  || // 匹配 [wasm...]
    
    // Figma 特定文件检测
    errorString.includes('devtools_worker') ||
    errorString.includes('webpack-artifacts') ||
    /figma\.com\/webpack-artifacts/.test(errorString) ||
    
    // 堆栈格式检测
    /wasm-function\[\d+\]/.test(errorString) ||
    /<\?>\.wasm-function/.test(errorString) ||
    
    // 特殊情况：没有明确来源的错误（通常来自 WASM）
    (error?.filename === '') ||
    (error?.filename === '?') ||
    (error?.filename?.startsWith('<?'))
  );
}

/**
 * 初始化全局错误抑制器
 */
export function initErrorSuppressor(): () => void {
  // 保存原始的控制台方法
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;
  
  // === 1. 劫持 console.error ===
  console.error = function(...args: any[]) {
    if (isWasmError(args.join(' '))) {
      // WASM 错误，静默忽略
      return;
    }
    // 非 WASM 错误，正常输出
    originalError.apply(console, args);
  };
  
  // === 2. 劫持 console.warn ===
  console.warn = function(...args: any[]) {
    if (isWasmError(args.join(' '))) {
      // WASM 警告，静默忽略
      return;
    }
    // 非 WASM 警告，正常输出
    originalWarn.apply(console, args);
  };
  
  // === 3. 全局错误事件监听 ===
  const handleGlobalError = (event: ErrorEvent) => {
    if (isWasmError(event)) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) {
        event.stopImmediatePropagation();
      }
      return false;
    }
  };
  
  // === 4. 未捕获的 Promise 拒绝 ===
  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (isWasmError(event.reason)) {
      event.preventDefault();
      if (event.stopPropagation) {
        event.stopPropagation();
      }
      return false;
    }
  };
  
  // 注册事件监听器（捕获阶段，优先级最高）
  window.addEventListener('error', handleGlobalError, true);
  window.addEventListener('unhandledrejection', handleUnhandledRejection, true);
  
  // 返回清理函数
  return () => {
    console.error = originalError;
    console.warn = originalWarn;
    window.removeEventListener('error', handleGlobalError, true);
    window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
  };
}

/**
 * React Hook: 使用错误抑制器
 */
export function useErrorSuppressor() {
  if (typeof window === 'undefined') return;
  
  const cleanup = initErrorSuppressor();
  
  // 如果在 React 组件中使用，记得在 useEffect 中返回 cleanup
  return cleanup;
}
