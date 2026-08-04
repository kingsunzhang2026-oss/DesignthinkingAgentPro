/**
 * AI场景生成服务
 * 使用DeepSeek API生成医疗器械使用场景
 */

import { callLLM, LLMMessage, hasApiKey } from './llm';
import { mergeDocumentContents, truncateText, DocumentContent } from './documents';
import { ScenarioData } from '../App';

/**
 * 生成系统提示词
 */
function getSystemPrompt(deviceName: string, knowledgeContext: string): string {
  const basePrompt = `你是一位专业的医疗器械人机交互设计专家，擅长分析长尾使用场景。

任务：为"${deviceName}"生成2-3个真实且具有挑战性的长尾临床使用场景。

长尾场景定义：
- 非标准化操作环境（光照、温度、湿度等异常）
- 医护人员疲劳、压力等人因状态
- 设备在极端条件下的使用
- 特殊患者群体或操作需求
- 突发情况下的应急使用

要求：
1. 每个场景必须真实、具体、可测试
2. 提供量化的环境参数和操作条件
3. 突出对人机交互的挑战
4. 场景之间应有明显差异

输出格式（严格JSON数组）：
[
  {
    "type": "长尾临床场景类型",
    "title": "场景标题（8-12字）",
    "description": "详细描述（30-50字）",
    "parameters": [
      {"label": "参数名称", "value": "具体数值/状态"},
      {"label": "参数名称", "value": "具体数值/状态"}
    ]
  }
]`;

  if (knowledgeContext) {
    return `${basePrompt}\n\n参考知识库：\n${knowledgeContext}\n\n请基于以上知识库内容，结合国标、行标要求生成场景。`;
  }

  return basePrompt;
}

/**
 * 扩展场景任务生成
 * 为特定场景生成额外的关键测试任务
 */
export async function generateExtendedTask(
  scenarioTitle: string,
  scenarioDescription: string,
  currentTasks: string[]
): Promise<any> {
  if (!hasApiKey()) {
    throw new Error('未配置API密钥');
  }

  const systemPrompt = `你是一位医疗器械人机交互测试专家。
任务：基于给定的医疗场景，生成 1 个高危/关键的扩展测试任务。
目标：发现现有测试任务中遗漏的严重人机工效隐患。

严格要求：
1. 引用标准：必须参考 GB 10000 (人体尺寸) 或 GB/T 14775 (操纵器工效)。
2. 关键性：只生成针对可能导致"医疗事故"或"操作失败"的关键任务。
3. 格式：返回严格的JSON对象。
4. 内容：
   - 记录点必须包含 unit(单位), range(范围), recommended(推荐值), risk(风险提示)。
   - illustration 必须是一个简单的 SVG path 字符串 (适合 viewBox="0 0 80 80")。

输出JSON结构：
{
  "code": "EX",
  "title": "任务标题",
  "description": "任务描述（含标准引用）",
  "illustration": "SVG_PATH_DATA",
  "recordPoints": [
    {
      "id": "rp_new_1",
      "label": "参数名",
      "value": "",
      "editable": true,
      "unit": "mm/N/°/Lux",
      "range": "Min-Max",
      "recommended": "Value",
      "guidance": "操作指导",
      "risk": "风险提示"
    }
  ]
}`;

  const userMessage = `场景：${scenarioTitle}
描述：${scenarioDescription}
现有任务：${currentTasks.join(', ')}

请生成一个补充的关键测试任务。`;

  try {
    const response = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ], { temperature: 0.7, maxTokens: 1000 });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI返回格式错误');
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('任务扩展失败:', error);
    throw error;
  }
}

/**
 * 解析AI返回的JSON数据
 */
function parseAIResponse(response: string): Partial<ScenarioData>[] {
  try {
    // 提取JSON数组（可能被```json包裹）
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('未找到有效的JSON数组');
    }

    const scenarios = JSON.parse(jsonMatch[0]);
    
    if (!Array.isArray(scenarios)) {
      throw new Error('响应不是有效的数组');
    }

    return scenarios.map((s, index) => ({
      type: s.type || `长尾场景 ${index + 1}`,
      title: s.title || '未命名场景',
      description: s.description || '',
      parameters: Array.isArray(s.parameters) ? s.parameters : [],
    }));
  } catch (error) {
    console.error('解析AI响应失败:', error);
    throw new Error('AI响应格式错误，请重试');
  }
}

/**
 * 使用AI生成场景
 */
export async function generateScenarios(
  deviceName: string,
  knowledgeBase: DocumentContent[],
  onProgress?: (message: string) => void
): Promise<ScenarioData[]> {
  // 检查API密钥
  if (!hasApiKey()) {
    throw new Error('未配置API密钥，请先在设置中配置DeepSeek API密钥');
  }

  try {
    onProgress?.('正在准备知识库上下文...');

    // 准备知识库上下文（限制长度避免超过token限制）
    let knowledgeContext = '';
    if (knowledgeBase.length > 0) {
      const mergedContent = mergeDocumentContents(knowledgeBase);
      // 限制上下文长度为约8000字符（~12000 tokens）
      knowledgeContext = truncateText(mergedContent, 8000);
    }

    onProgress?.('正在调用AI生成场景...');

    // 构建消息
    const systemPrompt = getSystemPrompt(deviceName, knowledgeContext);
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: knowledgeContext 
          ? `请基于知识库内容，为"${deviceName}"生成2-3个长尾临床场景。`
          : `请为"${deviceName}"生成2-3个长尾临床场景。`
      }
    ];

    // 调用LLM
    const response = await callLLM(messages, {
      temperature: 0.8, // 稍高的温度以获得更多样化的场景
      maxTokens: 2000
    });

    onProgress?.('正在解析生成结果...');

    // 解析响应
    const scenarioData = parseAIResponse(response);

    // 转换为完整的ScenarioData格式
    const scenarios: ScenarioData[] = scenarioData.map((data, index) => ({
      id: `ai-${Date.now()}-${index}`,
      type: data.type || `长尾场景 ${index + 1}`,
      title: data.title || '未命名场景',
      description: data.description || '',
      parameters: data.parameters || [],
      selected: false
    }));

    onProgress?.(`成功生成 ${scenarios.length} 个场景`);

    return scenarios;
  } catch (error) {
    console.error('AI场景生成失败:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('场景生成失败，请重试');
  }
}

/**
 * 生成场景的流式版本（用于实时显示生成过程）
 */
export async function generateScenariosStream(
  deviceName: string,
  knowledgeBase: DocumentContent[],
  onChunk: (content: string) => void,
  onProgress?: (message: string) => void
): Promise<ScenarioData[]> {
  // 检查API密钥
  if (!hasApiKey()) {
    throw new Error('未配置API密钥，请先在设置中配置DeepSeek API密钥');
  }

  try {
    onProgress?.('正在准备知识库上下文...');

    // 准备知识库上下文
    let knowledgeContext = '';
    if (knowledgeBase.length > 0) {
      const mergedContent = mergeDocumentContents(knowledgeBase);
      knowledgeContext = truncateText(mergedContent, 8000);
    }

    onProgress?.('正在调用AI生成场景...');

    // 构建消息
    const systemPrompt = getSystemPrompt(deviceName, knowledgeContext);
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: knowledgeContext 
          ? `请基于知识库内容，为"${deviceName}"生成2-3个长尾临床场景。`
          : `请为"${deviceName}"生成2-3个长尾临床场景。`
      }
    ];

    // 使用callLLM（非流式）以避免复杂度
    // 流式版本主要用于进度显示
    const response = await callLLM(messages, {
      temperature: 0.8,
      maxTokens: 2000
    });

    // 模拟流式输出（分批显示）
    const chunks = response.match(/.{1,50}/g) || [response];
    for (const chunk of chunks) {
      onChunk(chunk);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    onProgress?.('正在解析生成结果...');

    // 解析响应
    const scenarioData = parseAIResponse(response);

    // 转换为完整的ScenarioData格式
    const scenarios: ScenarioData[] = scenarioData.map((data, index) => ({
      id: `ai-${Date.now()}-${index}`,
      type: data.type || `长尾场景 ${index + 1}`,
      title: data.title || '未命名场景',
      description: data.description || '',
      parameters: data.parameters || [],
      selected: false
    }));

    onProgress?.(`成功生成 ${scenarios.length} 个场景`);

    return scenarios;
  } catch (error) {
    console.error('AI场景生成失败:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('场景生成失败，请重试');
  }
}
