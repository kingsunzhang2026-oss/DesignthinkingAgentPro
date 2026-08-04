/**
 * 测试脚本 - 用于验证LLM集成是否正常工作
 * 
 * 在浏览器控制台运行:
 * import { runTests } from './services/test';
 * runTests();
 */

import { callLLM, getApiKey, testApiKey, hasApiKey } from './llm';
import { extractDocumentContent } from './documents';
import { generateScenarios } from './aiScenarios';
import { performStartupCheck, logMemoryUsage, PerformanceMonitor } from './debug';

/**
 * 测试 API 密钥功能
 */
export async function testApiKeyFunctions(): Promise<void> {
  console.log('=== 测试 API 密钥功能 ===');
  
  // 检查是否已配置密钥
  const hasKey = hasApiKey();
  console.log('✓ hasApiKey():', hasKey);
  
  if (hasKey) {
    const key = getApiKey();
    console.log('✓ getApiKey():', key ? `${key.slice(0, 10)}...` : 'null');
    
    // 测试密钥有效性
    console.log('正在测试密钥有效性...');
    const result = await testApiKey(key!);
    console.log('✓ testApiKey():', result);
  } else {
    console.log('⚠️ 未配置 API 密钥');
  }
  
  console.log('');
}

/**
 * 测试 LLM 调用
 */
export async function testLLMCall(): Promise<void> {
  console.log('=== 测试 LLM 调用 ===');
  
  if (!hasApiKey()) {
    console.log('⚠️ 跳过：未配置 API 密钥');
    console.log('');
    return;
  }
  
  try {
    const monitor = new PerformanceMonitor('LLM 调用');
    
    const response = await callLLM([
      { role: 'system', content: '你是一个测试助手' },
      { role: 'user', content: '请回复"测试成功"' }
    ], {
      maxTokens: 50
    });
    
    monitor.end();
    
    console.log('✓ LLM 响应:', response);
  } catch (error) {
    console.error('✗ LLM 调用失败:', error);
  }
  
  console.log('');
}

/**
 * 测试文档处理
 */
export async function testDocumentProcessing(): Promise<void> {
  console.log('=== 测试文档处理 ===');
  
  // 创建测试文本文件
  const testContent = '这是一个测试文档\n包含医疗器械相关信息\n国标要求：...\n行标规范：...';
  const blob = new Blob([testContent], { type: 'text/plain' });
  const file = new File([blob], 'test.txt', { type: 'text/plain' });
  
  try {
    const document = await extractDocumentContent(file);
    console.log('✓ 文档提取成功:', {
      name: document.name,
      size: document.size,
      contentLength: document.content.length,
      error: document.error
    });
    console.log('✓ 文档内容:', document.content.substring(0, 100) + '...');
  } catch (error) {
    console.error('✗ 文档处理失败:', error);
  }
  
  console.log('');
}

/**
 * 测试场景生成
 */
export async function testScenarioGeneration(): Promise<void> {
  console.log('=== 测试场景生成 ===');
  
  if (!hasApiKey()) {
    console.log('⚠️ 跳过：未配置 API 密钥');
    console.log('');
    return;
  }
  
  try {
    const monitor = new PerformanceMonitor('场景生成');
    
    const scenarios = await generateScenarios(
      '测试医疗设备',
      [], // 空知识库
      (progress) => console.log('进度:', progress)
    );
    
    monitor.end();
    
    console.log('✓ 生成场景数量:', scenarios.length);
    scenarios.forEach((s, i) => {
      console.log(`场景 ${i + 1}:`, {
        type: s.type,
        title: s.title,
        parametersCount: s.parameters.length
      });
    });
  } catch (error) {
    console.error('✗ 场景生成失败:', error);
  }
  
  console.log('');
}

/**
 * 测试内存使用
 */
export function testMemoryUsage(): void {
  console.log('=== 测试内存监控 ===');
  
  logMemoryUsage('初始状态');
  
  // 创建一些测试数据
  const testData = Array(1000).fill(null).map((_, i) => ({
    id: i,
    content: `测试数据 ${i} `.repeat(100)
  }));
  
  logMemoryUsage('创建测试数据后');
  
  // 清理
  testData.length = 0;
  
  console.log('');
}

/**
 * 运行所有测试
 */
export async function runAllTests(): Promise<void> {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║   LLM 集成测试套件                     ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  
  // 环境检查
  performStartupCheck();
  console.log('');
  
  // 内存测试
  testMemoryUsage();
  
  // API 密钥测试
  await testApiKeyFunctions();
  
  // 文档处理测试
  await testDocumentProcessing();
  
  // LLM 调用测试
  await testLLMCall();
  
  // 场景生成测试（最耗时）
  await testScenarioGeneration();
  
  console.log('╔════════════════════════════════════════╗');
  console.log('║   测试完成                             ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
}

/**
 * 快速健康检查
 */
export async function healthCheck(): Promise<boolean> {
  console.log('🔍 执行健康检查...');
  
  const checks = {
    localStorage: false,
    fetch: false,
    apiKey: false,
    apiValid: false
  };
  
  // 检查 localStorage
  try {
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
    checks.localStorage = true;
    console.log('✓ localStorage 可用');
  } catch (e) {
    console.error('✗ localStorage 不可用');
  }
  
  // 检查 fetch
  checks.fetch = typeof fetch !== 'undefined';
  console.log(checks.fetch ? '✓ fetch API 可用' : '✗ fetch API 不可用');
  
  // 检查 API 密钥
  checks.apiKey = hasApiKey();
  console.log(checks.apiKey ? '✓ 已配置 API 密钥' : '⚠️ 未配置 API 密钥');
  
  // 测试 API 密钥（如果已配置）
  if (checks.apiKey) {
    try {
      const result = await testApiKey(getApiKey()!);
      checks.apiValid = result.valid;
      console.log(checks.apiValid ? '✓ API 密钥有效' : '✗ API 密钥无效');
    } catch (e) {
      console.error('✗ API 密钥测试失败');
    }
  }
  
  const allHealthy = checks.localStorage && checks.fetch && checks.apiKey && checks.apiValid;
  
  console.log('');
  console.log(allHealthy ? '✅ 系统健康' : '⚠️ 系统存在问题');
  console.log('');
  
  return allHealthy;
}

// 导出便捷函数
export const tests = {
  all: runAllTests,
  apiKey: testApiKeyFunctions,
  llm: testLLMCall,
  document: testDocumentProcessing,
  scenario: testScenarioGeneration,
  memory: testMemoryUsage,
  health: healthCheck
};

// 如果在控制台直接导入，提供使用提示
if (typeof window !== 'undefined') {
  (window as any).__llmTests = tests;
  console.log('💡 测试工具已加载！在控制台运行:');
  console.log('  __llmTests.health()    - 快速健康检查');
  console.log('  __llmTests.all()       - 运行所有测试');
  console.log('  __llmTests.apiKey()    - 测试 API 密钥');
  console.log('  __llmTests.llm()       - 测试 LLM 调用');
  console.log('  __llmTests.document()  - 测试文档处理');
  console.log('  __llmTests.scenario()  - 测试场景生成');
  console.log('  __llmTests.memory()    - 测试内存监控');
}
