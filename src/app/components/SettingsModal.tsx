import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, Trash2, Key, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { getApiKey, saveApiKey, clearApiKey, testApiKey } from '../services/llm';
import { DeepSeekTestPanel } from './DeepSeekTestPanel';
import { uploadKnowledgeDoc, getKnowledgeDocs, deleteKnowledgeDoc, KnowledgeDoc } from '../services/storage';

interface SettingsModalProps {
  onClose: () => void;
  knowledgeBase: any[];
  onKnowledgeBaseChange: (kb: any[]) => void;
}

interface KbEntry {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string;
  uploadedAt: string;
  doc?: KnowledgeDoc; // 数据库记录（用于删除时定位 storage_path）
}

export function SettingsModal({ onClose, knowledgeBase, onKnowledgeBaseChange }: SettingsModalProps) {
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(true);

  // 挂载时从数据库加载已上传的知识库文档
  useEffect(() => {
    (async () => {
      try {
        const docs = await getKnowledgeDocs();
        const mapped: KbEntry[] = docs.map((d) => ({
          id: d.id,
          name: d.name,
          size: d.size,
          type: d.type,
          content: '[已上传知识库文档，可在 AI 分析时引用]',
          uploadedAt: d.uploaded_at,
          doc: d,
        }));
        onKnowledgeBaseChange(mapped);
      } catch (e) {
        console.error('加载知识库失败', e);
      } finally {
        setLoadingDocs(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingFiles(true);
    try {
      const newEntries: KbEntry[] = [];
      for (const file of Array.from(files)) {
        try {
          const doc = await uploadKnowledgeDoc(file);
          newEntries.push({
            id: doc.id,
            name: doc.name,
            size: doc.size,
            type: doc.type,
            content: '[已上传知识库文档，可在 AI 分析时引用]',
            uploadedAt: doc.uploaded_at,
            doc,
          });
        } catch (err: any) {
          alert(`文件「${file.name}」上传失败：${err?.message || err}`);
        }
      }
      if (newEntries.length > 0) {
        onKnowledgeBaseChange([...knowledgeBase, ...newEntries]);
      }
    } catch (error) {
      console.error('文件处理失败:', error);
      alert('部分文件处理失败，请检查文件格式');
    } finally {
      setIsProcessingFiles(false);
      e.target.value = '';
    }
  };

  const handleRemoveFile = async (entry: KbEntry) => {
    if (entry.doc) {
      try {
        await deleteKnowledgeDoc(entry.doc);
      } catch (err: any) {
        alert('删除失败：' + (err?.message || err));
        return;
      }
    }
    onKnowledgeBaseChange(knowledgeBase.filter((f) => f.id !== entry.id));
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
                上传国标、行标、设计规范等参考文档，文件将保存到云端（Supabase Storage），用于 AI 生成场景和分析报告
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
                  {isProcessingFiles ? (
                    <Loader2 className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-spin" />
                  ) : (
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  )}
                  <p className="text-sm text-gray-600">
                    {isProcessingFiles ? '上传并保存中…' : '点击上传或拖拽文件到此处'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    支持 PDF、DOCX、TXT、MD 等格式（云端持久化，刷新不丢失）
                  </p>
                </div>
              </label>

              {/* Files List */}
              {loadingDocs ? (
                <p className="mt-4 text-xs text-gray-400">加载知识库…</p>
              ) : (
                knowledgeBase.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="text-xs text-gray-600 mb-2">
                      已上传 {knowledgeBase.length} 个文档
                    </div>
                    {knowledgeBase.map((file: any) => (
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
                          onClick={() => handleRemoveFile(file)}
                          className="p-1.5 hover:bg-red-100 rounded transition-colors flex-shrink-0 ml-2"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    ))}
                  </div>
                )
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
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
