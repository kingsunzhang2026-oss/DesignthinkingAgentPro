import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logError } from '../services/debug';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: ''
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // 检查是否是WASM错误（增强版检测）
    const errorMessage = error.message || '';
    const errorStack = error.stack || '';
    const isWasmError = 
      errorMessage.includes('wasm') || 
      errorMessage.includes('WASM') ||
      errorMessage.includes('wasm-function') ||
      errorStack.includes('wasm-function') ||
      errorStack.includes('[wasm code]') ||
      errorStack.includes('devtools_worker') ||
      errorStack.includes('webpack-artifacts') ||
      errorStack.includes('.wasm');
    
    // 如果是WASM错误，不显示错误界面
    if (isWasmError) {
      console.debug('⚠️ ErrorBoundary 捕获 Figma WASM 错误（已抑制）');
      return {
        hasError: false,
        error: null,
        errorInfo: ''
      };
    }
    
    // 正常错误，显示错误界面
    return {
      hasError: true,
      error,
      errorInfo: error.message
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    try {
      // 非WASM错误，正常处理
      logError(error, 'ErrorBoundary');
      
      this.setState({
        errorInfo: error.message
      });
    } catch (e) {
      // 避免错误处理本身导致问题
      console.warn('错误处理失败，但应用可继续运行');
    }
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: ''
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const isWasmError = this.state.error?.message.includes('wasm') || 
                          this.state.error?.message.includes('WASM');

      return (
        <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-6">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex-shrink-0">
                <AlertTriangle className={`w-8 h-8 ${isWasmError ? 'text-red-500' : 'text-[#FF9500]'}`} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl text-gray-900 mb-2">
                  {isWasmError ? '🔴 WASM 错误' : '应用出现错误'}
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  抱歉，应用遇到了一个意外错误。
                </p>
                
                {/* 错误详情 */}
                <div className="bg-gray-50 rounded border border-gray-200 p-4 mb-4">
                  <p className="text-xs text-gray-500 mb-2">错误详情：</p>
                  <pre className="text-xs text-gray-900 whitespace-pre-wrap break-words">
                    {this.state.errorInfo}
                  </pre>
                </div>

                {/* WASM 错误提示 */}
                {isWasmError && (
                  <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
                    <p className="text-sm text-red-900 mb-2">🔴 WASM 错误诊断</p>
                    <ul className="text-xs text-red-800 space-y-1 list-disc list-inside">
                      <li>检查是否有新安装的依赖包</li>
                      <li>确认没有使用 pdf.js、mammoth 等 WASM 库</li>
                      <li>查看浏览器控制台的完整错误堆栈</li>
                      <li>尝试清除浏览器缓存后刷新</li>
                    </ul>
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="flex gap-3">
                  <button
                    onClick={this.handleReload}
                    className="flex-1 bg-[#007AFF] hover:bg-[#0051D5] text-white px-4 py-2 rounded flex items-center justify-center gap-2 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    刷新页面
                  </button>
                  <button
                    onClick={this.handleReset}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded transition-colors"
                  >
                    尝试恢复
                  </button>
                </div>

                {/* 调试信息 */}
                <details className="mt-4">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                    显示完整堆栈（开发者）
                  </summary>
                  <pre className="mt-2 text-xs text-gray-600 bg-gray-50 p-3 rounded border border-gray-200 overflow-auto max-h-48">
                    {this.state.error?.stack || '无堆栈信息'}
                  </pre>
                </details>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}