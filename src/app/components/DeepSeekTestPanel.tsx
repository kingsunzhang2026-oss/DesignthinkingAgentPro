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
    <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
      {/* 标题 */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-node-behavior to-node-behavior flex items-center justify-center">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-foreground">DeepSeek API 测试面板</h2>
          <p className="text-xs text-muted-foreground mt-0.5">测试 Supabase 后端代理连接</p>
        </div>
      </div>

      {/* 连接状态 */}
      <div className="space-y-4">
        {/* 测试连接按钮 */}
        <div>
          <button
            onClick={handleTestConnection}
            disabled={connectionStatus === 'testing'}
            className="w-full px-4 py-3 bg-node-behavior hover:bg-node-behavior/80 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          <div className="bg-node-context/10 border border-node-context/20 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-node-context flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm text-node-context">{testResult}</div>
              <div className="text-xs text-node-context mt-1">
                后端 URL: <code className="bg-node-context/15 px-1 rounded">https://sgxkplfbptwdohjjnlzd.supabase.co/functions/v1/deepseek-proxy</code>
              </div>
            </div>
          </div>
        )}

        {connectionStatus === 'error' && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm text-destructive mb-1">❌ 连接失败</div>
              <div className="text-xs text-destructive">{connectionError}</div>
              <div className="text-xs text-destructive mt-3 space-y-1">
                <p className="font-medium">💡 故障排查：</p>
                <p>1. 确认 Supabase Edge Function <code className="bg-destructive/15 px-1 rounded">deepseek-proxy</code> 已部署</p>
                <p>2. 确认环境变量 <code className="bg-destructive/15 px-1 rounded">DEEPSEEK_API_KEY</code> 已配置</p>
                <p>3. 检查 Supabase 控制台日志 (Logs → Edge Functions)</p>
              </div>
            </div>
          </div>
        )}

        {/* 功能测试区 */}
        {connectionStatus === 'success' && (
          <div className="pt-4 border-t border-border space-y-3">
            <h3 className="text-sm text-foreground mb-3">🧪 功能测试</h3>
            
            {/* 非流式测试 */}
            <button
              onClick={handleNonStreamTest}
              disabled={isStreamTest}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-node-value to-node-value hover:opacity-90 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
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
              className="w-full px-4 py-2.5 bg-gradient-to-r from-node-solution to-node-solution hover:opacity-90 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
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
              <div className="bg-muted border border-border rounded-lg p-4 mt-4">
                <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-node-context/100 animate-pulse"></div>
                  AI 响应：
                </div>
                <div className="text-sm text-foreground whitespace-pre-wrap">{streamContent}</div>
              </div>
            )}

            {/* 错误信息 */}
            {connectionError && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mt-4">
                <div className="text-xs text-destructive">{connectionError}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 技术信息 */}
      <div className="mt-6 pt-4 border-t border-border">
        <div className="text-xs text-muted-foreground space-y-1">
          <p>📡 <span className="font-medium">代理端点:</span> deepseek-proxy</p>
          <p>🔑 <span className="font-medium">认证方式:</span> Supabase Anon Key</p>
          <p>🤖 <span className="font-medium">模型:</span> deepseek-chat</p>
          <p>⚙️ <span className="font-medium">环境变量:</span> DEEPSEEK_API_KEY</p>
        </div>
      </div>
    </div>
  );
}
