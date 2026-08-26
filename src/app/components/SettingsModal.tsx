import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, Trash2, Key, CheckCircle2, AlertCircle } from 'lucide-react';
import { getApiKey, saveApiKey, clearApiKey, testApiKey } from '../services/llm';
import { extractMultipleDocuments, DocumentContent } from '../services/documents';
import { DeepSeekTestPanel } from './DeepSeekTestPanel';

import { PROJECTS } from '../config/projects';

interface SettingsModalProps {
  activeProjectId: string;
  onClose: () => void;
  knowledgeBase: any[];
  onKnowledgeBaseChange: (kb: any[]) => void;
}

export function SettingsModal({ activeProjectId, onClose, knowledgeBase, onKnowledgeBaseChange }: SettingsModalProps) {
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [activeTab, setActiveTab] = useState<'global' | 'project'>('global');
  const currentProject = PROJECTS.find(p => p.id === activeProjectId) || PROJECTS[0];

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
        projectId: activeTab === 'project' ? activeProjectId : undefined,
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
      <div className="bg-card rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-foreground">系统设置</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* DeepSeek API 测试面板 */}
            <DeepSeekTestPanel />

            {/* Knowledge Base Section */}
            <div>
              <h3 className="text-sm text-foreground mb-2">AI 知识库</h3>
              
              {/* Tabs for Global / Project Knowledge Base */}
              <div className="flex space-x-1 border-b border-border mb-4">
                <button
                  className={`px-4 py-2 text-sm font-medium ${activeTab === 'global' ? 'text-node-behavior border-b-2 border-node-behavior' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setActiveTab('global')}
                >
                  全局共享知识库 (国标/行标等)
                </button>
                <button
                  className={`px-4 py-2 text-sm font-medium ${activeTab === 'project' ? 'text-node-behavior border-b-2 border-node-behavior' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => setActiveTab('project')}
                >
                  当前项目专属 ({currentProject.name})
                </button>
              </div>

              <p className="text-xs text-muted-foreground mb-4">
                {activeTab === 'global' ? '上传所有项目共享的底层原则、标准文档。' : `上传专属 ${currentProject.name} 的性能说明书、设计特化文档等。`}
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
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-node-behavior hover:bg-node-behavior/10 transition-colors">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">点击上传或拖拽文件到此处</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    支持 PDF、DOCX、TXT、MD 等格式
                  </p>
                </div>
              </label>

              {/* Files List */}
              {knowledgeBase.filter(f => activeTab === 'global' ? !f.projectId : f.projectId === activeProjectId).length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs text-muted-foreground mb-2">
                    当前分类下有 {knowledgeBase.filter(f => activeTab === 'global' ? !f.projectId : f.projectId === activeProjectId).length} 个文档
                  </div>
                  {knowledgeBase.filter(f => activeTab === 'global' ? !f.projectId : f.projectId === activeProjectId).map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 bg-muted rounded border border-border">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)} · {new Date(file.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(file.id)}
                        className="p-1.5 hover:bg-destructive/10 rounded transition-colors flex-shrink-0 ml-2"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-foreground hover:bg-accent rounded transition-colors"
          >
            取消
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-node-behavior hover:bg-node-behavior/80 text-white rounded transition-colors"
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
}