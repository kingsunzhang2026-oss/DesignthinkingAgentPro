import React, { useState } from 'react';
import { Play, CheckCircle2, AlertCircle, Loader2, Zap } from 'lucide-react';
import { callLLM, callLLMStream, testApiKey, LLMMessage } from '../services/llm';

export function DeepSeekTestPanel() {
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connectionError, setConnectionError] = useState('');
  const [testResult, setTestResult] = useState('');
  const [isStreamTest, setIsStreamTest] = useState(false);
  const [streamContent, setStreamContent] = useState('');

  // 测试连接
  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setConnectionError('');
    setTestResult('');

    try {
      const result = await testApiKey();
      if (result.valid) {
        setConnectionStatus('success');
        setTestResult('✅ 后端连接成功！DeepSeek API 工作正常。');
      } else {
        setConnectionStatus('error');
        setConnectionError(result.error || '连接失败');
      }
    } catch (error) {
      setConnectionStatus('error');
      setConnectionError(error instanceof Error ? error.message : '未知错误');
    }
  };

  // 测试非流式调用
  const handleNonStreamTest = async () => {
    setIsStreamTest(true);
    setStreamContent('');
    setConnectionError('');

    const messages: LLMMessage[] = [
      { role: 'system', content: '你是一个友好的AI助手。' },
      { role: 'user', content: '请用一句话介绍你自己。' }
    ];

    try {
      console.log('[Test] 开始非流式调用测试...');
      const response = await callLLM(messages, { maxTokens: 50 });
      setStreamContent(response);
      console.log('[Test] ✓ 非流式调用成功:', response);
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : '调用失败');
      console.error('[Test] ✗ 非流式调用失败:', error);
    } finally {
      setIsStreamTest(false);
    }
  };

  // 测试流式调用
  const handleStreamTest = async () => {
    setIsStreamTest(true);
    setStreamContent('');
    setConnectionError('');

    const messages: LLMMessage[] = [
      { role: 'system', content: '你是一个医疗器械设计专家。' },
      { role: 'user', content: '请简要说明小钳智能双极电刀的人机交互设计要点。' }
    ];

    try {
      console.log('[Test] 开始流式调用测试...');
      await callLLMStream(
        messages,
        (chunk) => {
          if (!chunk.done && chunk.content) {
            setStreamContent(prev => prev + chunk.content);
          } else if (chunk.done) {
            console.log('[Test] ✓ 流式调用完成');
          }
        },
        { maxTokens: 200 }
      );
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : '流式调用失败');
      console.error('[Test] ✗ 流式调用失败:', error);
    } finally {
      setIsStreamTest(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      {/* 标题 */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-gray-900">DeepSeek API 测试面板</h2>
          <p className="text-xs text-gray-500 mt-0.5">测试 Supabase 后端代理连接</p>
        </div>
      </div>

      {/* 连接状态 */}
      <div className="space-y-4">
        {/* 测试连接按钮 */}
        <div>
          <button
            onClick={handleTestConnection}
            disabled={connectionStatus === 'testing'}
            className="w-full px-4 py-3 bg-[#007AFF] hover:bg-[#0051D5] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {connectionStatus === 'testing' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                测试连接中...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                🔌 测试后端连接
              </>
            )}
          </button>
        </div>

        {/* 连接结果 */}
        {connectionStatus === 'success' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm text-green-900">{testResult}</div>
              <div className="text-xs text-green-700 mt-1">
                后端 URL: <code className="bg-green-100 px-1 rounded">https://sgxkplfbptwdohjjnlzd.supabase.co/functions/v1/deepseek-proxy</code>
              </div>
            </div>
          </div>
        )}

        {connectionStatus === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm text-red-900 mb-1">❌ 连接失败</div>
              <div className="text-xs text-red-700">{connectionError}</div>
              <div className="text-xs text-red-600 mt-3 space-y-1">
                <p className="font-medium">💡 故障排查：</p>
                <p>1. 确认 Supabase Edge Function <code className="bg-red-100 px-1 rounded">deepseek-proxy</code> 已部署</p>
                <p>2. 确认环境变量 <code className="bg-red-100 px-1 rounded">DEEPSEEK_API_KEY</code> 已配置</p>
                <p>3. 检查 Supabase 控制台日志 (Logs → Edge Functions)</p>
              </div>
            </div>
          </div>
        )}

        {/* 功能测试区 */}
        {connectionStatus === 'success' && (
          <div className="pt-4 border-t border-gray-200 space-y-3">
            <h3 className="text-sm text-gray-900 mb-3">🧪 功能测试</h3>
            
            {/* 非流式测试 */}
            <button
              onClick={handleNonStreamTest}
              disabled={isStreamTest}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              {isStreamTest ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  调用中...
                </>
              ) : (
                '📝 测试非流式调用'
              )}
            </button>

            {/* 流式测试 */}
            <button
              onClick={handleStreamTest}
              disabled={isStreamTest}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              {isStreamTest ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  流式输出中...
                </>
              ) : (
                '⚡ 测试流式调用'
              )}
            </button>

            {/* 响应内容 */}
            {streamContent && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
                <div className="text-xs text-gray-600 mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  AI 响应：
                </div>
                <div className="text-sm text-gray-900 whitespace-pre-wrap">{streamContent}</div>
              </div>
            )}

            {/* 错误信息 */}
            {connectionError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
                <div className="text-xs text-red-900">{connectionError}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 技术信息 */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-500 space-y-1">
          <p>📡 <span className="font-medium">代理端点:</span> deepseek-proxy</p>
          <p>🔑 <span className="font-medium">认证方式:</span> Supabase Anon Key</p>
          <p>🤖 <span className="font-medium">模型:</span> deepseek-chat</p>
          <p>⚙️ <span className="font-medium">环境变量:</span> DEEPSEEK_API_KEY</p>
        </div>
      </div>
    </div>
  );
}
