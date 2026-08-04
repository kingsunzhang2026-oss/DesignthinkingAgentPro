import React, { useState } from 'react';
import { Sparkles, CheckCircle2, Plus, MoreVertical, Edit2, Trash2, Loader2 } from 'lucide-react';
import { ScenarioData } from '../../App';
import { generateScenarios } from '../../services/aiScenarios';
import { hasApiKey } from '../../services/llm';

interface ContextPanelProps {
  scenarios: ScenarioData[];
  onScenariosChange: (scenarios: ScenarioData[]) => void;
  knowledgeBase: any[];
}

export function ContextPanel({ scenarios, onScenariosChange, knowledgeBase }: ContextPanelProps) {
  const [deviceName, setDeviceName] = useState('小钳智能双极电刀');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingScenario, setEditingScenario] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [generationError, setGenerationError] = useState('');

  const [newScenario, setNewScenario] = useState({
    type: '自定义场景',
    title: '',
    description: '',
    parameters: [{ label: '', value: '' }]
  });

  const toggleScenario = (id: string) => {
    onScenariosChange(scenarios.map(s => 
      s.id === id ? { ...s, selected: !s.selected } : s
    ));
  };

  const handleAIGenerate = async () => {
    // 检查是否配置了API密钥
    if (!hasApiKey()) {
      setGenerationError('请先在设置中配置DeepSeek API密钥');
      setTimeout(() => setGenerationError(''), 3000);
      return;
    }

    setIsGenerating(true);
    setGenerationProgress('正在准备...');
    setGenerationError('');

    try {
      const newScenarios = await generateScenarios(
        deviceName,
        knowledgeBase,
        (progress) => setGenerationProgress(progress)
      );

      onScenariosChange([...scenarios, ...newScenarios]);
      setGenerationProgress('生成完成！');
      setTimeout(() => {
        setGenerationProgress('');
      }, 2000);
    } catch (error) {
      console.error('AI生成场景失败:', error);
      setGenerationError(error instanceof Error ? error.message : 'AI生成失败，请重试');
      setTimeout(() => setGenerationError(''), 5000);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddScenario = () => {
    if (newScenario.title && newScenario.description) {
      const scenario: ScenarioData = {
        id: `custom-${Date.now()}`,
        type: newScenario.type,
        title: newScenario.title,
        description: newScenario.description,
        parameters: newScenario.parameters.filter(p => p.label && p.value),
        selected: true
      };
      onScenariosChange([...scenarios, scenario]);
      setNewScenario({
        type: '自定义场景',
        title: '',
        description: '',
        parameters: [{ label: '', value: '' }]
      });
      setShowAddForm(false);
    }
  };

  const handleDeleteScenario = (id: string) => {
    onScenariosChange(scenarios.filter(s => s.id !== id));
    setOpenMenu(null);
  };

  const addParameter = () => {
    setNewScenario({
      ...newScenario,
      parameters: [...newScenario.parameters, { label: '', value: '' }]
    });
  };

  const updateParameter = (index: number, field: 'label' | 'value', value: string) => {
    const updated = [...newScenario.parameters];
    updated[index][field] = value;
    setNewScenario({ ...newScenario, parameters: updated });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Device Input */}
      <div>
        <label className="block text-sm text-gray-700 mb-2">设备名称</label>
        <input
          type="text"
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:border-transparent"
        />
      </div>

      {/* AI Generate Button */}
      <button 
        onClick={handleAIGenerate}
        className="w-full bg-[#007AFF] hover:bg-[#0051D5] text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
      >
        {isGenerating ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Sparkles className="w-5 h-5" />
        )}
        <span>AI 模拟长尾场景</span>
      </button>

      {generationProgress && (
        <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded border border-blue-200">
          💡 {generationProgress}
        </div>
      )}

      {generationError && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
          💡 {generationError}
        </div>
      )}

      {knowledgeBase.length > 0 && (
        <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded border border-blue-200">
          💡 基于 {knowledgeBase.length} 个知识库文档生成场景
        </div>
      )}

      {/* Scenarios */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm text-gray-700">生成的场景清单</h3>
          <button
            onClick={() => setShowAddForm(true)}
            className="text-sm text-[#007AFF] hover:text-[#0051D5] flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            新增场景
          </button>
        </div>

        {/* Add New Scenario Form */}
        {showAddForm && (
          <div className="mb-4 border border-[#007AFF] rounded-lg p-4 bg-blue-50">
            <h4 className="text-sm text-gray-900 mb-3">新增场景</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">场景类型</label>
                <input
                  type="text"
                  value={newScenario.type}
                  onChange={(e) => setNewScenario({ ...newScenario, type: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:border-transparent"
                  placeholder="例如：长尾临床场景 3"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">场景标题</label>
                <input
                  type="text"
                  value={newScenario.title}
                  onChange={(e) => setNewScenario({ ...newScenario, title: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:border-transparent"
                  placeholder="例如：低温环境场景"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">场景描述</label>
                <textarea
                  value={newScenario.description}
                  onChange={(e) => setNewScenario({ ...newScenario, description: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:border-transparent"
                  rows={2}
                  placeholder="详细描述场景特点"
                />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs text-gray-600">参数设置</label>
                  <button
                    onClick={addParameter}
                    className="text-xs text-[#007AFF] hover:text-[#0051D5]"
                  >
                    + 添加参数
                  </button>
                </div>
                {newScenario.parameters.map((param, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={param.label}
                      onChange={(e) => updateParameter(idx, 'label', e.target.value)}
                      className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
                      placeholder="参数名"
                    />
                    <input
                      type="text"
                      value={param.value}
                      onChange={(e) => updateParameter(idx, 'value', e.target.value)}
                      className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#007AFF]"
                      placeholder="参数值"
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleAddScenario}
                  className="flex-1 bg-[#007AFF] hover:bg-[#0051D5] text-white px-3 py-2 rounded text-sm transition-colors"
                >
                  确认添加
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scenario List */}
        <div className="space-y-4">
          {scenarios.map((scenario) => (
            <div
              key={scenario.id}
              className={`border rounded-lg p-4 transition-all relative ${
                scenario.selected 
                  ? 'border-[#007AFF] bg-blue-50' 
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {/* Menu Button */}
              <div className="absolute top-3 right-3">
                <button
                  onClick={() => setOpenMenu(openMenu === scenario.id ? null : scenario.id)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                >
                  <MoreVertical className="w-4 h-4 text-gray-500" />
                </button>
                {openMenu === scenario.id && (
                  <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
                    <button
                      onClick={() => {
                        setEditingScenario(scenario.id);
                        setOpenMenu(null);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Edit2 className="w-3 h-3" />
                      编辑
                    </button>
                    <button
                      onClick={() => handleDeleteScenario(scenario.id)}
                      className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Trash2 className="w-3 h-3" />
                      删除
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-start justify-between mb-3 pr-8">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600 uppercase tracking-wide">
                      {scenario.type}
                    </span>
                  </div>
                  <h4 className="text-sm text-gray-900 mb-1">{scenario.title}</h4>
                  <p className="text-xs text-gray-600">{scenario.description}</p>
                </div>
                <button
                  onClick={() => toggleScenario(scenario.id)}
                  className={`ml-3 transition-colors ${
                    scenario.selected ? 'text-[#007AFF]' : 'text-gray-300 hover:text-gray-400'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                </button>
              </div>

              {/* Parameters */}
              <div className="space-y-1.5">
                {scenario.parameters.map((param, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">{param.label}</span>
                    <span className="text-gray-900">{param.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">已加入验证清单</span>
          <span className="text-[#007AFF]">
            {scenarios.filter(s => s.selected).length} / {scenarios.length}
          </span>
        </div>
      </div>
    </div>
  );
}