import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X, Sparkles, FileText, Loader2, Copy, Check, AlertCircle, Upload, Mic, Square } from 'lucide-react';
import { callLLM } from '../../services/llm';
import { usePanelArchive } from '../../services/panelArchive';
import { ArchiveButton } from '../ArchiveButton';
import { useDesignStore } from '../../services/designStore';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';

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
  contextRef?: {
    deviceName: string;
    scenarios: string[];
  } | null;
}

const MAX_GOALS = 20;
const MIN_GOALS = 2;

export function ProblemNodePanel({ nodeId }: ProblemNodePanelProps) {
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
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
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 连线投递：情境节点 → 问题节点
  const { registerOutput, useDelivery } = useDesignStore();
  const delivery = useDelivery(nodeId);
  const [contextRef, setContextRef] = useState<ProblemPanelData['contextRef']>(null);
  const [deliveryBanner, setDeliveryBanner] = useState<string | null>(null);

  // 加载存档回填
  useEffect(() => {
    if (!loading && archived) {
      setGoals(archived.goals || []);
      setGeneratedPrompt(archived.generatedPrompt || '');
      setContextRef(archived.contextRef || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archived, loading]);

  // 实时登记产出（含自动生成的提示词），供连线到方案节点时自动投递
  useEffect(() => {
    registerOutput(nodeId, 'problem', { goals, generatedPrompt });
  }, [nodeId, goals, generatedPrompt, registerOutput]);

  // 接收情境节点投递：记录情境来源并显示提示
  useEffect(() => {
    if (!delivery || delivery.toType !== 'problem') return;
    const d = delivery.data || {};
    setContextRef({ deviceName: d.deviceName || '', scenarios: d.scenarios || [] });
    setDeliveryBanner(
      `已接入情境节点输出：${d.deviceName || '设备'}（已选 ${Array.isArray(d.scenarios) ? d.scenarios.length : 0} 个场景）`,
    );
    setTimeout(() => setDeliveryBanner(null), 6000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery?.token]);

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

  // ---- AI 拆解文本 → 设计目标（文档 / 情境 共用）----
  const GOALS_SYSTEM_PROMPT = `你是一个产品设计专家。请从以下内容中提取 2-${MAX_GOALS} 个设计目标。
每个目标包含：title（简短标题）、description（详细描述）、priority（高/中/低）。
严格返回 JSON 数组格式，不要其他文字。例如：
[{"title":"减少手部疲劳","description":"连续操作3小时以上无明显不适","priority":"高"}]`;

  const parseGoalsFromResponse = (response: string): any[] => {
    const match = response.match(/\[[\s\S]*\]/);
    const json = match ? match[0] : response;
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) throw new Error('AI 返回格式异常');
    return parsed;
  };

  const runGoalExtraction = async (text: string, source: DesignGoal['source']) => {
    setAiParsing(true);
    setAiError('');
    try {
      const response = await callLLM(
        [
          { role: 'system', content: GOALS_SYSTEM_PROMPT },
          { role: 'user', content: `待分析内容：\n${text.substring(0, 8000)}\n\n请提取设计目标。` },
        ],
        { temperature: 0.3, maxTokens: 2000 },
      );

      const parsed = parseGoalsFromResponse(response);
      const aiGoals: DesignGoal[] = parsed
        .slice(0, Math.max(0, MAX_GOALS - goals.length))
        .map((g: any, i: number) => ({
          id: `${source}-${Date.now()}-${i}`,
          title: g.title || `目标${i + 1}`,
          description: g.description || '',
          priority: (['高', '中', '低'].includes(g.priority) ? g.priority : '中') as '高' | '中' | '低',
          source,
        }));

      if (aiGoals.length === 0) throw new Error('AI 未能提取到设计目标');
      setGoals([...goals, ...aiGoals]);
    } catch (e: any) {
      setAiError(e?.message || 'AI 拆解失败');
    } finally {
      setAiParsing(false);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (fileInputRef.current) fileInputRef.current.value = '';

    // 读取文件文本（PDF/DOCX 暂不支持真实解析，只取文件名+占位）
    let docText = '';
    if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      docText = await file.text();
    } else {
      docText = `文档名称：${file.name}\n文档类型：${file.type || '未知'}\n（注：当前仅支持纯文本文件的真实内容解析，PDF/DOCX 需在知识库中上传后由系统解析）`;
    }
    await runGoalExtraction(docText, 'document');
  };

  // 基于已接入的情境节点输出，一键生成设计目标
  const generateFromContext = async () => {
    if (!contextRef) return;
    const ctxText = `设备名称：${contextRef.deviceName}
已选临床场景：\n${contextRef.scenarios.map((s, i) => `${i + 1}. ${s}`).join('\n')}

请针对上述设备及其临床场景，推导对应的产品设计目标。`;
    await runGoalExtraction(ctxText, 'context');
  };

  // ---- 生成结构化 prompt（后台自动生成，无需手动触发）----
  const buildPrompt = useCallback(() => {
    if (goals.length < MIN_GOALS) return '';
    const sorted = [...goals].sort((a, b) => {
      const order = { 高: 0, 中: 1, 低: 2 };
      return order[a.priority] - order[b.priority];
    });
    return `请基于以下设计目标，生成一个符合人体工程学的医疗器械（小钳智能双极电刀 V2）3D模型。

设计目标：
${sorted.map((g, i) => `${i + 1}. [${g.priority}] ${g.title} — ${g.description}`).join('\n')}

要求：
- 模型应重点体现上述设计目标的关键特征
- 握把部分需符合人体工程学，适合长时间手术操作
- 结构紧凑，便于 sterilization（灭菌）
- 材质质感：医用级不锈钢 + 绝缘手柄`;
  }, [goals]);

  // 目标变化后自动重新生成提示词（防抖 500ms）
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const newPrompt = buildPrompt();
      setGeneratedPrompt(newPrompt);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [buildPrompt]);

  const handleSave = async () => {
    await save({ goals, generatedPrompt, contextRef });
  };

  const goalCount = goals.length;

  return (
    <div className="flex flex-col h-full">
      {/* 顶部存档栏 */}
      <div className="border-b border-border bg-muted px-6 py-2 flex items-center justify-end">
        <ArchiveButton
          data={{ goals, generatedPrompt, contextRef }}
          onSave={handleSave}
          saving={saving}
          lastSavedAt={lastSavedAt}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm text-foreground">问题节点</h3>
            <button
              onClick={() => isRecording ? stopRecording() : startRecording()}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded transition-all ${
                isRecording
                  ? 'bg-destructive/10 text-destructive animate-pulse border border-destructive/30 shadow-sm'
                  : 'bg-node-behavior/10 text-node-behavior hover:bg-node-behavior/20'
              }`}
              title="用于在定义问题时收集口语报告记录"
            >
              {isRecording ? (
                <><Square className="w-3 h-3 fill-current" /> 停止报告</>
              ) : (
                <><Mic className="w-3 h-3" /> 出声报告</>
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            定义 {MIN_GOALS}-{MAX_GOALS} 个设计目标，可手动添加或上传文档由 AI 自动拆解
          </p>
        </div>

        {/* 连线投递提示 */}
        {deliveryBanner && (
          <div className="flex items-center gap-2 px-3 py-2 bg-node-value/10 border border-node-value/20 rounded-lg text-xs text-foreground">
            <Sparkles className="w-3.5 h-3.5 text-node-value" />
            <span>{deliveryBanner}</span>
          </div>
        )}

        {/* 情境节点接入（连线 context→problem 后出现） */}
        {contextRef && (contextRef.deviceName || (contextRef.scenarios || []).length > 0) && (
          <div className="border border-node-value/20 bg-node-value/10 rounded-lg p-3 flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              <span className="text-node-value font-medium">已接入情境节点</span>
              ：{contextRef.deviceName || '设备'}
              {(contextRef.scenarios || []).length > 0 && ` · 已选 ${contextRef.scenarios.length} 个场景`}
            </div>
            <button
              onClick={generateFromContext}
              disabled={aiParsing || goalCount >= MAX_GOALS}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-node-value text-white rounded hover:bg-node-value/80 disabled:opacity-50 flex-shrink-0"
            >
              {aiParsing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              基于情境生成目标
            </button>
          </div>
        )}

        {/* 设计目标 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm text-foreground">设计目标</h4>
              <span className={`text-[10px] px-2 py-0.5 rounded ${
                goalCount < MIN_GOALS ? 'bg-destructive/10 text-destructive' :
                goalCount >= MAX_GOALS ? 'bg-node-solution/10 text-node-solution' :
                'bg-node-context/10 text-node-context'
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
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-card text-foreground border border-border rounded hover:bg-accent disabled:opacity-50"
              >
                {aiParsing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                {aiParsing ? 'AI 拆解中…' : '上传文档拆解'}
              </button>
              <button
                onClick={() => setShowAddForm(true)}
                disabled={goalCount >= MAX_GOALS}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-node-problem text-white rounded hover:bg-node-problem/80 disabled:opacity-50"
              >
                <Plus className="w-3 h-3" />
                添加目标
              </button>
            </div>
          </div>

          {aiError && (
            <div className="mb-3 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded p-2 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span className="break-all">{aiError}</span>
            </div>
          )}

          {showAddForm && (
            <div className="mb-4 border border-node-problem rounded-lg p-4 bg-destructive/10">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">目标标题</label>
                  <input
                    type="text"
                    value={newGoal.title}
                    onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-2 focus:ring-node-problem"
                    placeholder="例如：减少手部疲劳"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">目标描述</label>
                  <textarea
                    value={newGoal.description}
                    onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                    className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-2 focus:ring-node-problem"
                    rows={2}
                    placeholder="详细描述设计目标"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">优先级</label>
                  <select
                    value={newGoal.priority}
                    onChange={(e) => setNewGoal({ ...newGoal, priority: e.target.value as '高' | '中' | '低' })}
                    className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-2 focus:ring-node-problem"
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
                    className="flex-1 bg-node-problem hover:bg-node-problem/80 text-white px-3 py-2 rounded text-sm disabled:opacity-50"
                  >
                    确认
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 bg-muted hover:bg-secondary text-foreground px-3 py-2 rounded text-sm"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {goals.length === 0 && !showAddForm && (
              <p className="text-xs text-muted-foreground text-center py-6">
                尚无设计目标。点击"添加目标"手动输入，或"上传文档拆解"由 AI 自动提取。
              </p>
            )}
            {goals.map((goal, index) => (
              <div key={goal.id} className="border border-border rounded-lg p-3 bg-card">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] text-muted-foreground font-mono">#{index + 1}</span>
                      <h5 className="text-sm text-foreground">{goal.title}</h5>
                      <select
                        value={goal.priority}
                        onChange={(e) => updateGoalPriority(goal.id, e.target.value as '高' | '中' | '低')}
                        className={`text-[10px] px-2 py-0.5 rounded border-none cursor-pointer ${
                          goal.priority === '高' ? 'bg-destructive/10 text-destructive' :
                          goal.priority === '中' ? 'bg-node-solution/10 text-node-solution' :
                          'bg-muted text-muted-foreground'
                        }`}
                      >
                        <option>高</option>
                        <option>中</option>
                        <option>低</option>
                      </select>
                      {goal.source !== 'manual' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-node-behavior/10 text-node-behavior">
                          {goal.source === 'document' ? '文档' : '情境'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{goal.description}</p>
                  </div>
                  <button
                    onClick={() => removeGoal(goal.id)}
                    className="p-1 hover:bg-accent rounded flex-shrink-0 ml-2"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 结构化提示词状态指示（后台自动生成） */}
        {generatedPrompt && (
          <div className="flex items-center gap-2 px-3 py-2 bg-node-solution/10 border border-node-solution/20 rounded-lg text-xs text-muted-foreground">
            <Sparkles className="w-3.5 h-3.5 text-node-solution" />
            <span>已自动生成结构化提示词（{goals.length} 个目标 → {generatedPrompt.length} 字），连线到方案节点后自动传递</span>
          </div>
        )}
      </div>
    </div>
  );
}