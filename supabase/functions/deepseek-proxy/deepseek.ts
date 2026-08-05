/**
 * DeepSeek API 代理服务
 * 处理所有 DeepSeek API 调用，避免前端 CORS 问题
 */

const DEEPSEEK_API_BASE = 'https://api.deepseek.com/v1';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

/**
 * 获取 DeepSeek API 密钥
 */
function getDeepSeekApiKey(): string {
  const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY environment variable is not set');
  }
  return apiKey;
}

/**
 * 调用 DeepSeek Chat Completions API (非流式)
 */
export async function chatCompletion(
  request: ChatCompletionRequest
): Promise<Response> {
  const apiKey = getDeepSeekApiKey();

  const requestBody = {
    model: request.model || 'deepseek-chat',
    messages: request.messages,
    temperature: request.temperature ?? 0.7,
    max_tokens: request.max_tokens || 4000,
    stream: false,
  };

  console.log('[DeepSeek Proxy] 调用非流式 API:', {
    model: requestBody.model,
    messageCount: request.messages.length,
    temperature: requestBody.temperature,
    maxTokens: requestBody.max_tokens,
  });

  try {
    const response = await fetch(`${DEEPSEEK_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[DeepSeek Proxy] API 错误:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      
      return new Response(
        JSON.stringify({
          error: {
            message: errorData.error?.message || `API调用失败: ${response.status}`,
            code: response.status,
          },
        }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await response.json();
    console.log('[DeepSeek Proxy] ✓ 调用成功');
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[DeepSeek Proxy] 网络错误:', error);
    return new Response(
      JSON.stringify({
        error: {
          message: error instanceof Error ? error.message : '网络连接失败',
          code: 'NETWORK_ERROR',
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * 调用 DeepSeek Chat Completions API (流式)
 */
export async function chatCompletionStream(
  request: ChatCompletionRequest
): Promise<Response> {
  const apiKey = getDeepSeekApiKey();

  const requestBody = {
    model: request.model || 'deepseek-chat',
    messages: request.messages,
    temperature: request.temperature ?? 0.7,
    max_tokens: request.max_tokens || 4000,
    stream: true,
  };

  console.log('[DeepSeek Proxy] 调用流式 API:', {
    model: requestBody.model,
    messageCount: request.messages.length,
    temperature: requestBody.temperature,
    maxTokens: requestBody.max_tokens,
  });

  try {
    const response = await fetch(`${DEEPSEEK_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[DeepSeek Proxy] API 错误:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      
      return new Response(
        JSON.stringify({
          error: {
            message: errorData.error?.message || `API调用失败: ${response.status}`,
            code: response.status,
          },
        }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[DeepSeek Proxy] ✓ 流式调用启动');

    // 直接转发流式响应
    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[DeepSeek Proxy] 网络错误:', error);
    return new Response(
      JSON.stringify({
        error: {
          message: error instanceof Error ? error.message : '网络连接失败',
          code: 'NETWORK_ERROR',
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
