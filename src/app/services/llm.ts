/**
 * LLM Service - DeepSeek API Integration (通过 Supabase 后端代理)
 * 使用 Supabase Edge Function 代理 API 调用，避免 CORS 问题
 */

import { projectId, publicAnonKey } from '../utils/supabase/info';

// 后端代理 API 地址 - 使用 deepseek-proxy Edge Function
const SERVER_BASE_URL = `https://${projectId}.supabase.co/functions/v1/deepseek-proxy`;

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMStreamChunk {
  content: string;
  done: boolean;
}

/**
 * API 密钥现在存储在 Supabase 环境变量中
 * 这些函数保留用于向后兼容，但现在它们只是占位符
 */
export function saveApiKey(apiKey: string): void {
  console.warn('API 密钥现在由后端管理，请使用 Supabase 环境变量 DEEPSEEK_API_KEY');
}

export function getApiKey(): string | null {
  console.warn('API 密钥现在由后端管理');
  return 'backend-managed';
}

export function clearApiKey(): void {
  console.warn('API 密钥现在由后端管理');
}

export function hasApiKey(): boolean {
  // 总是返回 true，因为密钥由后端管理
  return true;
}

/**
 * 非流式调用DeepSeek API
 */
export async function callLLM(
  messages: LLMMessage[],
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  const requestBody = {
    model: options?.model || 'deepseek-chat',
    messages: messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens || 4000,
    stream: false
  };

  try {
    console.log('[LLM] 调用非流式 API:', SERVER_BASE_URL);
    const response = await fetch(SERVER_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || 
        `API调用失败: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log('[LLM] ✓ 调用成功');
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('LLM调用错误:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('LLM调用失败，请检查网络连接和后端服务');
  }
}

/**
 * 流式调用DeepSeek API
 * 使用回调函数处理流式输出，避免使用async generator（可能导致WASM问题）
 */
export async function callLLMStream(
  messages: LLMMessage[],
  onChunk: (chunk: LLMStreamChunk) => void,
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<void> {
  const requestBody = {
    model: options?.model || 'deepseek-chat',
    messages: messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens || 4000,
    stream: true
  };

  try {
    console.log('[LLM] 调用流式 API:', SERVER_BASE_URL);
    const response = await fetch(SERVER_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || 
        `API调用失败: ${response.status} ${response.statusText}`
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应流');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        onChunk({ content: '', done: true });
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // 保留最后一行（可能不完整）
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine === 'data: [DONE]') {
          continue;
        }

        if (trimmedLine.startsWith('data: ')) {
          try {
            const jsonStr = trimmedLine.slice(6); // 移除 "data: " 前缀
            const data = JSON.parse(jsonStr);
            const content = data.choices[0]?.delta?.content;
            
            if (content) {
              onChunk({ content, done: false });
            }
          } catch (error) {
            console.warn('解析SSE数据失败:', trimmedLine, error);
          }
        }
      }
    }
    console.log('[LLM] ✓ 流式调用完成');
  } catch (error) {
    console.error('LLM流式调用错误:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('LLM流式调用失败，请检查网络连接和后端服务');
  }
}

/**
 * 测试API密钥是否有效
 * 现在通过后端测试
 */
export async function testApiKey(apiKey?: string): Promise<{ valid: boolean; error?: string }> {
  try {
    console.log('[LLM Test] 通过后端测试 API 密钥...');
    console.log('[LLM Test] 后端 URL:', SERVER_BASE_URL);
    
    // 发送一个简单的测试请求
    const testRequestBody = {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: '测试连接' }],
      temperature: 0.7,
      max_tokens: 10,
      stream: false
    };
    
    const response = await fetch(SERVER_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify(testRequestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `后端响应错误: ${response.status}`;
      
      console.error('[LLM Test] API密钥验证失败:', errorMessage);
      return {
        valid: false,
        error: errorMessage
      };
    }

    const result = await response.json();
    
    // 检查响应格式是否正确
    if (result.choices && result.choices[0]?.message?.content) {
      console.log('[LLM Test] ✓ API密钥验证成功');
      return { valid: true };
    } else {
      console.error('[LLM Test] 响应格式异常:', result);
      return {
        valid: false,
        error: '后端响应格式异常'
      };
    }
  } catch (error) {
    console.error('[LLM Test] 测试失败:', error);
    
    let errorMessage = '测试失败';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return { 
      valid: false, 
      error: errorMessage
    };
  }
}