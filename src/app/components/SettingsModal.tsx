import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, Trash2, Key, CheckCircle2, AlertCircle } from 'lucide-react';
import { getApiKey, saveApiKey, clearApiKey, testApiKey } from '../services/llm';
import { extractMultipleDocuments, DocumentContent } from '../services/documents';
import { DeepSeekTestPanel } from './DeepSeekTestPanel';

interface SettingsModalProps {
  onClose: () => void;
  knowledgeBase: any[];
  onKnowledgeBaseChange: (kb: any[]) => void;
}

export function SettingsModal({ onClose, knowledgeBase, onKnowledgeBaseChange }: SettingsModalProps) {
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingFiles(true);

    try {
      // 提取文档内容
      const documents = await extractMultipleDocuments(Array.from(files));

      // 转换为知识库格式
      const newFiles = documents.map(doc => ({
        id: doc.id,
        name: doc.name,
        size: doc.size,
        type: doc.type,
        content: doc.content,
        error: doc.error,
        uploadedAt: new Date().toISOString()
      }));

      onKnowledgeBaseChange([...knowledgeBase, ...newFiles]);
    } catch (error) {
      console.error('文件处理失败:', error);
      alert('部分文件处理失败，请检查文件格式');
    } finally {
      setIsProcessingFiles(false);
    }
  };

  const handleRemoveFile = (id: string) => {
    onKnowledgeBaseChange(knowledgeBase.filter(f => f.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-gray-900">系统设置</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* DeepSeek API 测试面板 */}
            <DeepSeekTestPanel />

            {/* Knowledge Base Section */}
            <div>
              <h3 className="text-sm text-gray-900 mb-2">AI 知识库</h3>
              <p className="text-xs text-gray-600 mb-4">
                上传国标、行标、设计规范等参考文档，用于 AI 生成场景和分析报告
              </p>

              {/* Upload Area */}
              <label className="block">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.md"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-[#007AFF] hover:bg-blue-50 transition-colors">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">点击上传或拖拽文件到此处</p>
                  <p className="text-xs text-gray-500 mt-1">
                    支持 PDF、DOCX、TXT、MD 等格式
                  </p>
                </div>
              </label>

              {/* Files List */}
              {knowledgeBase.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs text-gray-600 mb-2">
                    已上传 {knowledgeBase.length} 个文档
                  </div>
                  {knowledgeBase.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(file.size)} · {new Date(file.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(file.id)}
                        className="p-1.5 hover:bg-red-100 rounded transition-colors flex-shrink-0 ml-2"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
          >
            取消
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-[#007AFF] hover:bg-[#0051D5] text-white rounded transition-colors"
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
}