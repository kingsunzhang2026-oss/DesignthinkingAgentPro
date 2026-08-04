/**
 * 调试工具 - 用于排查WASM和内存问题
 */

/**
 * 获取当前内存使用情况（如果浏览器支持）
 */
export function getMemoryUsage(): { used: number; limit: number } | null {
  try {
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      return {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
        limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024)  // MB
      };
    }
  } catch (e) {
    // 在某些环境中可能无法访问
  }
  return null;
}

/**
 * 记录内存使用情况
 */
export function logMemoryUsage(label: string = 'Memory'): void {
  try {
    const memory = getMemoryUsage();
    if (memory) {
      console.log(`[${label}] 内存使用: ${memory.used}MB / ${memory.limit}MB (${Math.round(memory.used / memory.limit * 100)}%)`);
    }
  } catch (e) {
    // 静默失败，避免在某些环境中出错
  }
}

/**
 * 检查是否有WASM模块加载
 * @deprecated 在Figma环境中可能导致问题，已禁用
 */
export function checkWasmModules(): void {
  // 禁用此功能以避免Figma环境中的WASM冲突
  // console.log('✅ WASM检查已禁用（Figma环境兼容性）');
}

/**
 * 创建错误边界日志
 */
export function logError(error: Error, context: string): void {
  const errorInfo = {
    context,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    memory: getMemoryUsage()
  };

  console.error('❌ 错误详情:', errorInfo);

  // 检查是否是WASM相关错误
  if (error.message.includes('wasm') || error.message.includes('WASM')) {
    console.error('🔴 WASM错误！这可能是由以下原因导致的：');
    console.error('1. 某个依赖包使用了WASM模块');
    console.error('2. 内存不足');
    console.error('3. WASM模块初始化失败');
    console.error('建议：检查最近安装的依赖，移除使用WASM的库');
  }
}

/**
 * 安全的异步函数包装器
 */
export function safeAsync<T>(
  fn: () => Promise<T>,
  fallback: T,
  context: string = 'Unknown'
): Promise<T> {
  return fn().catch(error => {
    logError(error, context);
    return fallback;
  });
}

/**
 * 创建性能监控
 */
export class PerformanceMonitor {
  private startTime: number;
  private label: string;

  constructor(label: string) {
    this.label = label;
    this.startTime = performance.now();
    logMemoryUsage(`[开始] ${label}`);
  }

  end(): void {
    const duration = performance.now() - this.startTime;
    console.log(`[${this.label}] 耗时: ${duration.toFixed(2)}ms`);
    logMemoryUsage(`[结束] ${this.label}`);
  }
}

/**
 * 检查浏览器功能支持
 */
export function checkBrowserSupport(): {
  fetch: boolean;
  localStorage: boolean;
  fileReader: boolean;
  streams: boolean;
  wasm: boolean;
} {
  return {
    fetch: typeof fetch !== 'undefined',
    localStorage: typeof localStorage !== 'undefined',
    fileReader: typeof FileReader !== 'undefined',
    streams: typeof ReadableStream !== 'undefined',
    wasm: typeof WebAssembly !== 'undefined'
  };
}

/**
 * 启动时的环境检查
 */
export function performStartupCheck(): void {
  try {
    console.log('🔍 Designthinking Agent Pro - 系统就绪');
    
    // 简化的浏览器支持检查
    const support = checkBrowserSupport();
    const hasRequiredFeatures = support.fetch && support.localStorage;
    
    if (hasRequiredFeatures) {
      console.log('✅ 核心功能可用');
    } else {
      console.warn('⚠️ 部分功能可能不可用');
    }
    
    // 移除可能导致问题的WASM检查
    // checkWasmModules();
  } catch (e) {
    // 静默失败，避免阻塞应用启动
  }
}