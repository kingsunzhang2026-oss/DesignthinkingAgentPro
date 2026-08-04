/**
 * 文档处理服务 - 知识库文档读取
 * 轻量级实现，支持常见文档格式
 */

export interface DocumentContent {
  id: string;
  name: string;
  content: string;
  type: string;
  size: number;
  error?: string;
}

/**
 * 读取文本文件内容
 */
async function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      resolve(content || '');
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * 简单的PDF文本提取（使用原生方法）
 * 注意：这是一个简化版本，只能提取纯文本PDF
 */
async function extractTextFromPDF(file: File): Promise<string> {
  // 由于完整的PDF解析库可能导致WASM问题
  // 这里返回一个占位提示，实际使用时需要后端支持或使用轻量级库
  return `[PDF文档: ${file.name}]\n\n注意：完整的PDF文本提取需要后端支持。\n当前显示为占位符。\n\n如需使用PDF内容，请考虑：\n1. 将PDF转换为TXT或MD格式后上传\n2. 使用后端API进行PDF解析\n3. 手动复制PDF内容到TXT文件`;
}

/**
 * 从文件中提取文本内容
 */
export async function extractDocumentContent(file: File): Promise<DocumentContent> {
  const document: DocumentContent = {
    id: `${Date.now()}-${file.name}`,
    name: file.name,
    content: '',
    type: file.type,
    size: file.size
  };

  try {
    // 根据文件类型选择处理方式
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      document.content = await readTextFile(file);
    } else if (file.name.endsWith('.md')) {
      document.content = await readTextFile(file);
    } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      document.content = await extractTextFromPDF(file);
      document.error = 'PDF内容为占位符，建议转换为TXT/MD格式';
    } else if (
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.name.endsWith('.docx')
    ) {
      document.content = `[Word文档: ${file.name}]\n\n注意：DOCX文档解析需要额外的库支持。\n建议将文档另存为TXT或MD格式后上传。`;
      document.error = 'DOCX内容为占位符，建议转换为TXT/MD格式';
    } else {
      // 尝试作为文本读取
      try {
        document.content = await readTextFile(file);
      } catch {
        document.content = `[不支持的文件格式: ${file.type}]`;
        document.error = '不支持的文件格式';
      }
    }

    return document;
  } catch (error) {
    document.error = error instanceof Error ? error.message : '文件处理失败';
    document.content = `[文件处理失败: ${document.error}]`;
    return document;
  }
}

/**
 * 批量处理文档
 */
export async function extractMultipleDocuments(files: File[]): Promise<DocumentContent[]> {
  const results = await Promise.allSettled(
    files.map(file => extractDocumentContent(file))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        id: `error-${Date.now()}-${index}`,
        name: files[index].name,
        content: '[处理失败]',
        type: files[index].type,
        size: files[index].size,
        error: result.reason?.message || '未知错误'
      };
    }
  });
}

/**
 * 合并多个文档内容为单一上下文
 */
export function mergeDocumentContents(documents: DocumentContent[]): string {
  if (documents.length === 0) {
    return '';
  }

  const sections = documents.map(doc => {
    return `=== 文档: ${doc.name} ===\n\n${doc.content}\n`;
  });

  return sections.join('\n---\n\n');
}

/**
 * 截断文本到指定长度（保留完整句子）
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  // 在最大长度附近查找句子结束符
  const truncated = text.substring(0, maxLength);
  const lastPeriod = Math.max(
    truncated.lastIndexOf('。'),
    truncated.lastIndexOf('！'),
    truncated.lastIndexOf('？'),
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf('!'),
    truncated.lastIndexOf('?')
  );

  if (lastPeriod > maxLength * 0.8) {
    return truncated.substring(0, lastPeriod + 1);
  }

  return truncated + '...';
}

/**
 * 计算文本的近似token数（简单估算）
 */
export function estimateTokens(text: string): number {
  // 中文字符：约1.5 token/字
  // 英文单词：约1.3 token/词
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const otherChars = text.length - chineseChars;
  
  return Math.ceil(chineseChars * 1.5 + englishWords * 1.3 + otherChars * 0.5);
}
