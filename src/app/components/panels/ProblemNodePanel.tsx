import React, { useState, useEffect } from 'react';
import { Plus, X, Sparkles, FileText, Loader2, Copy, Check, AlertCircle, Upload } from 'lucide-react';
import { callLLM } from '../../services/llm';
import { usePanelArchive } from '../../services/panelArchive';
import { ArchiveButton } from '../ArchiveButton';

interface ProblemNodePanelProps {
  nodeId: string;
}

export interface DesignGoal {
  id: string;
  title: string;
  description: string;
  priority: '高' | '中' | '低';
  source: 'manual' | 'document' | 'context';
}

interface ProblemPanelData {
  goals: DesignGoal[];
  generatedPrompt: string;
}

const MAX_GOALS = 20;
const MIN_GOALS = 2;

export function ProblemNodePanel({ nodeId }: ProblemNodePanelProps) {
  const { data: archived, save, saving, lastSavedAt, loading } = usePanelArchive<ProblemPanelData>({
    projectId: 'default',
    nodeId,
    panelType: 'problem',
    initial: { goals: [], generatedPrompt: '' },
  });

  const [goals, setGoals] = useState<DesignGoal[]>([]);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newGoal, setNewGoal] = useState({ title: '', description: '', priority: '中' as const });
  const [aiParsing, setAiParsing] = useState(false);
  const [aiError, setAiError] = useState('');
  const [copied, setCopied] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 加载存档回填
  useEffect(() => {
    if (!loading && archived) {
      setGoals(archived.goals || []);
      setGeneratedPrompt(archived.generatedPrompt || '');
    }
  }, [archived, loading]);

  // ---- 设计目标增删改 ----
  const addGoal = () => {
    if (!newGoal.title) return;
    if (goals.length >= MAX_GOALS) {
      alert(`最多 ${MAX_GOALS} 个设计目标`);
      return;
    }
    const goal: DesignGoal = {
      id: Date.now().toString(),
      ...newGoal,
      source: 'manual',
    };
    setGoals([...goals, goal]);
    setNewGoal({ title: '', description: '', priority: '中' });
    setShowAddForm(false);
  };

  const removeGoal = (id: string) => {
    setGoals(goals.filter((g) => g.id !== id));
  };

  const updateGoalPriority = (id: string, priority: '高' | '中' | '低') => {
    setGoals(goals.map((g) => (g.id === id ? { ...g, priority } : g)));
  };

  // ---- AI 拆解文档 → 设计目标 ----
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (fileInputRef.current) fileInputRef.current.value = '';

    setAiParsing(true);
    setAiError('');
    try {
      // 读取文件文本（简单方案：直接读 text；PDF/DOCX 暂不支持真实解析，只取文件名+占位）
      let docText = '';
      if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        docText = await file.text();
      } else {
        // 非 txt 文件：用文件名+类型作为提示
        docText = `文档名称：${file.name}\n文档类型：${file.type || '未知'}\n（注：当前仅支持纯文本文件的真实内容解析，PDF/DOCX 需在知识库中上传后由系统解析）`;
      }

      const systemPrompt = `你是一个产品设计专家。请从以下文档内容中提取 2-${MAX_GOALS} 个设计目标。
每个目标包含：title（简短标题）、description（详细描述）、priority（高/中/低）。
严格返回 JSON 数组格式，不要其他文字。例如：
[{"title":"减少手部疲劳","description":"连续操作3小时以上无明显不适","priority":"高"}]`;

      const userContent = `文档内容：\n${docText.substring(0, 8000)}\n\n请提取设计目标。`;

      const response = await callLLM(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        { temperature: 0.3, maxTokens: 2000 }
      );

      // 解析 JSON
      let parsed: any[] = [];
      try {
        const match = response.match(/\[[\s\S]*\]/);
        parsed = match ? JSON.parse(match[0]) : JSON.parse(response);
      } catch {
        throw new Error('AI 返回格式异常，无法解析为设计目标列表');
      }

      const aiGoals: DesignGoal[] = parsed.slice(0, MAX_GOALS - goals.length).map((g: any, i: number) => ({
        id: `ai-${Date.now()}-${i}`,
        title: g.title || `目标${i + 1}`,
        description: g.description || '',
        priority: (['高', '中', '低'].includes(g.priority) ? g.priority : '中') as '高' | '中' | '低',
        source: 'document' as const,
      }));

      if (aiGoals.length === 0) throw new Error('AI 未能从文档中提取到设计目标');
      setGoals([...goals, ...aiGoals]);
    } catch (e: any) {
      setAiError(e?.message || 'AI 拆解失败');
    } finally {
      setAiParsing(false);
    }
  };

  // ---- 生成结构化 prompt ----
  const generatePrompt = () => {
    if (goals.length < MIN_GOALS) {
      alert(`至少需要 ${MIN_GOALS} 个设计目标才能生成 prompt`);
      return;
    }
    const sorted = [...goals].sort((a, b) => {
      const order = { 高: 0, 中: 1, 低: 2 };
      return order[a.priority] - order[b.priority];
    });
    const prompt = `请基于以下设计目标，生成一个符合人体工程学的医疗器械（小钳智能双极电刀 V2）3D模型。

设计目标：
${sorted.map((g, i) => `${i + 1}. [${g.priority}] ${g.title} — ${g.description}`).join('\n')}

要求：
- 模型应重点体现上述设计目标的关键特征
- 握把部分需符合人体工程学，适合长时间手术操作
- 结构紧凑，便于 sterilization（灭菌）
- 材质质感：医用级不锈钢 + 绝缘手柄`;

    setGeneratedPrompt(prompt);
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSave = async () => {
    await save({ goals, generatedPrompt });
  };

  const goalCount = goals.length;
  const canGenerate = goalCount >= MIN_GOALS && goalCount <= MAX_GOALS;

  return (
    <div className="flex flex-col h-full">
      {/* 顶部存档栏 */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-2 flex items-center justify-end">
        <ArchiveButton
          data={{ goals, generatedPrompt }}
          onSave={handleSave}
          saving={saving}
          lastSavedAt={lastSavedAt}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <h3 className="text-sm text-gray-900 mb-1">问题节点</h3>
          <p className="text-xs text-gray-600 mb-4">
            定义 {MIN_GOALS}-{MAX_GOALS} 个设计目标，可手动添加或上传文档由 AI 自动拆解
          </p>
        </div>

        {/* 设计目标 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm text-gray-700">设计目标</h4>
              <span className={`text-[10px] px-2 py-0.5 rounded ${
                goalCount < MIN_GOALS ? 'bg-red-100 text-red-600' :
                goalCount >= MAX_GOALS ? 'bg-orange-100 text-orange-600' :
                'bg-green-100 text-green-600'
              }`}>
                {goalCount} / {MIN_GOALS}-{MAX_GOALS}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* AI 拆解文档 */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.text,text/*"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={aiParsing || goalCount >= MAX_GOALS}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white text-gray-700 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                {aiParsing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                {aiParsing ? 'AI 拆解中…' : '上传文档拆解'}
              </button>
              <button
                onClick={() => setShowAddForm(true)}
                disabled={goalCount >= MAX_GOALS}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#FF3B30] text-white rounded hover:bg-red-600 disabled:opacity-50"
              >
                <Plus className="w-3 h-3" />
                添加目标
              </button>
            </div>
          </div>

          {aiError && (
            <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded p-2 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span className="break-all">{aiError}</span>
            </div>
          )}

          {showAddForm && (
            <div className="mb-4 border border-[#FF3B30] rounded-lg p-4 bg-red-50">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">目标标题</label>
                  <input
                    type="text"
                    value={newGoal.title}
                    onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#FF3B30]"
                    placeholder="例如：减少手部疲劳"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">目标描述</label>
                  <textarea
                    value={newGoal.description}
                    onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#FF3B30]"
                    rows={2}
                    placeholder="详细描述设计目标"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">优先级</label>
                  <select
                    value={newGoal.priority}
                    onChange={(e) => setNewGoal({ ...newGoal, priority: e.target.value as '高' | '中' | '低' })}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#FF3B30]"
                  >
                    <option>高</option>
                    <option>中</option>
                    <option>低</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={addGoal}
                    disabled={!newGoal.title}
                    className="flex-1 bg-[#FF3B30] hover:bg-red-600 text-white px-3 py-2 rounded text-sm disabled:opacity-50"
                  >
                    确认
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {goals.length === 0 && !showAddForm && (
              <p className="text-xs text-gray-400 text-center py-6">
                尚无设计目标。点击"添加目标"手动输入，或"上传文档拆解"由 AI 自动提取。
              </p>
            )}
            {goals.map((goal, index) => (
              <div key={goal.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] text-gray-400 font-mono">#{index + 1}</span>
                      <h5 className="text-sm text-gray-900">{goal.title}</h5>
                      <select
                        value={goal.priority}
                        onChange={(e) => updateGoalPriority(goal.id, e.target.value as '高' | '中' | '低')}
                        className={`text-[10px] px-2 py-0.5 rounded border-none cursor-pointer ${
                          goal.priority === '高' ? 'bg-red-100 text-red-700' :
                          goal.priority === '中' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}
                      >
                        <option>高</option>
                        <option>中</option>
                        <option>低</option>
                      </select>
                      {goal.source !== 'manual' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                          {goal.source === 'document' ? '文档' : '情境'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600">{goal.description}</p>
                  </div>
                  <button
                    onClick={() => removeGoal(goal.id)}
                    className="p-1 hover:bg-gray-100 rounded flex-shrink-0 ml-2"
                  >
                    <X className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 生成结构化 prompt */}
        <div className="border border-[#FF9500] rounded-lg p-4 bg-orange-50/40">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-[#FF9500]" />
            <h4 className="text-sm text-gray-800">结构化提示词（用于文生 3D）</h4>
          </div>
          <p className="text-xs text-gray-600 mb-3">
            将设计目标组合为一段结构化提示词，可复制到方案节点的 Tripo3D 文生 3D 输入框
          </p>
          <button
            onClick={generatePrompt}
            disabled={!canGenerate}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-[#FF9500] hover:bg-[#E68600] text-white rounded disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            生成提示词
          </button>
          {!canGenerate && goalCount > 0 && goalCount < MIN_GOALS && (
            <p className="mt-2 text-xs text-red-500">至少需要 {MIN_GOALS} 个设计目标</p>
          )}
          {generatedPrompt && (
            <div className="mt-3 relative">
              <pre className="w-full p-3 bg-white border border-gray-200 rounded text-xs text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {generatedPrompt}
              </pre>
              <button
                onClick={copyPrompt}
                className="absolute top-2 right-2 p-1.5 bg-white border border-gray-200 rounded hover:bg-gray-50"
                title="复制"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}