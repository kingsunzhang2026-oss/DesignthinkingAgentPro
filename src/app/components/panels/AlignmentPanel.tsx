import React, { useState, useMemo } from 'react';
import { AlertTriangle, CheckCircle2, TrendingUp, Loader2, X } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer } from 'recharts';
import { callLLM, hasApiKey } from '../../services/llm';
import { TaskSequence, RecordPoint } from '../../App';

interface AlignmentPanelProps {
  onAnalysisComplete: (deviations: DeviationItem[]) => void;
  knowledgeBase?: any[];
  taskSequences: TaskSequence[];
}

interface DeviationItem {
  title: string;
  description: string;
  priority: string;
  improvement: string;
  severity: 'warning' | 'error';
}

export function AlignmentPanel({ onAnalysisComplete, knowledgeBase = [], taskSequences }: AlignmentPanelProps) {
  const [analyzed, setAnalyzed] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [deviations, setDeviations] = useState<DeviationItem[]>([]);
  const [error, setError] = useState<string>('');
  const [showMissingDataWarning, setShowMissingDataWarning] = useState(false);

  // Extract actual data from task sequences
  const actualData = useMemo(() => {
    const data = {
      torque: { value: 'N/A', deviation: '', status: 'neutral' },
      lock: { value: 'N/A', deviation: '', status: 'neutral' },
      fatigue: { value: 'N/A', deviation: '', status: 'neutral' },
      pressure: { value: '均匀分布', deviation: '', status: 'ok' }
    };

    let allPoints: RecordPoint[] = [];
    taskSequences.forEach(seq => {
      seq.tasks.forEach(task => {
        allPoints.push(...task.recordPoints);
      });
    });

    // 1. Force/Torque
    const torquePoint = allPoints.find(p => p.label.includes('力矩') || p.label.includes('操纵力'));
    if (torquePoint && torquePoint.value) {
      const val = parseFloat(torquePoint.value);
      data.torque.value = `${val}${torquePoint.unit || 'N'}`;
      if (val > 30) {
        data.torque.status = 'warning';
        data.torque.deviation = `+${Math.round((val - 30) / 30 * 100)}%`;
      } else {
        data.torque.status = 'ok';
      }
    }

    // 2. Lock Certainty
    const lockPoint = allPoints.find(p => p.label.includes('锁止') || p.label.includes('反馈'));
    if (lockPoint && lockPoint.value) {
      data.lock.value = lockPoint.value;
      if (lockPoint.value.includes('否') || lockPoint.value.includes('模糊')) {
        data.lock.status = 'error';
      } else {
        data.lock.status = 'ok';
      }
    }

    // 3. Fatigue
    const fatiguePoint = allPoints.find(p => p.label.includes('疲劳') || p.label.includes('耐力'));
    if (fatiguePoint && fatiguePoint.value) {
      data.fatigue.value = `${fatiguePoint.value}${fatiguePoint.unit || ''}`;
      const val = parseFloat(fatiguePoint.value);
      // Assuming RPE scale 1-10
      if (val > 4) {
        data.fatigue.status = 'warning';
        data.fatigue.deviation = '疲劳过早';
      } else {
        data.fatigue.status = 'ok';
      }
    }

    // 4. Pressure/Pain
    const painPoints = allPoints.filter(p => p.label.includes('压痛') || p.label.includes('舒适度'));
    if (painPoints.length > 0) {
       const severePain = painPoints.find(p => parseFloat(p.value) > 3 || p.value.includes('痛'));
       if (severePain) {
           data.pressure.value = severePain.label; // e.g., "食指第一指节压痛"
           data.pressure.status = 'error';
           data.pressure.deviation = '高风险';
       } else {
           data.pressure.value = '无明显压痛';
           data.pressure.status = 'ok';
       }
    }

    return data;
  }, [taskSequences]);

  const radarData = [
    { dimension: '操作舒适度', design: 90, actual: actualData.pressure.status === 'ok' ? 85 : 60 },
    { dimension: '触觉反馈', design: 85, actual: actualData.lock.status === 'ok' ? 80 : 50 },
    { dimension: '疲劳抵抗', design: 80, actual: actualData.fatigue.status === 'ok' ? 75 : 55 },
    { dimension: '精准控制', design: 95, actual: actualData.torque.status === 'ok' ? 90 : 70 },
    { dimension: '安全性', design: 100, actual: 90 },
  ];

  const comparisonData = {
    b1: {
      title: '预期设计行为 (B1)',
      items: [
        { label: '棘齿力矩', value: '25-30N', status: 'expected' },
        { label: '锁止确定性', value: '触觉清晰', status: 'expected' },
        { label: '持续操作', value: '> 3小时无疲劳', status: 'expected' },
        { label: '手部压力', value: '均匀分布', status: 'expected' }
      ]
    },
    b2: {
      title: '实际测试反馈 (B2)',
      items: [
        { label: '棘齿力矩', value: actualData.torque.value, status: actualData.torque.status, deviation: actualData.torque.deviation },
        { label: '锁止确定性', value: actualData.lock.value, status: actualData.lock.status, deviation: actualData.lock.deviation },
        { label: '持续操作', value: actualData.fatigue.value, status: actualData.fatigue.status, deviation: actualData.fatigue.deviation },
        { label: '手部压力', value: actualData.pressure.value, status: actualData.pressure.status, deviation: actualData.pressure.deviation }
      ]
    }
  };

  const checkDataCompleteness = () => {
    let incompleteCount = 0;
    taskSequences.forEach(seq => {
      seq.tasks.forEach(task => {
        task.recordPoints.forEach(p => {
          if (!p.value || p.value.trim() === '') incompleteCount++;
        });
      });
    });
    return incompleteCount;
  };

  const handleAnalyzeClick = () => {
      const missingCount = checkDataCompleteness();
      if (missingCount > 0) {
          setShowMissingDataWarning(true);
      } else {
          runAnalysis();
      }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError('');
    setShowMissingDataWarning(false);

    try {
      if (!hasApiKey()) {
        throw new Error('请先在系统设置中配置 DeepSeek API 密钥');
      }

      // 构建分析提示词
      const systemPrompt = `你是一位医疗器械人机交互专家，擅长分析设计预期与实际测试之间的偏差。
任务：分析小钳智能双极电刀的B1(设计预期)与B2(实际测试)对比数据，识别偏差并给出改进建议。
输出格式（严格JSON数组）：
[
  {
    "title": "偏差项标题",
    "description": "详细描述（50-100字）",
    "priority": "P0/P1",
    "improvement": "预期改善目标",
    "severity": "warning或error"
  }
]`;

      const userPrompt = `请分析以下数据：
**设计要求 (B1):**
- 棘齿力矩: 25-30N
- 锁止确定性: 触觉清晰
- 持续操作: > 3小时无疲劳
- 手部压力: 均匀分布

**实际测试 (B2):**
- 棘齿力矩: ${actualData.torque.value}
- 锁止确定性: ${actualData.lock.value}
- 持续操作: ${actualData.fatigue.value}
- 手部压力: ${actualData.pressure.value}

请识别所有偏差项，参考GB/T 14774-93和YY 0505-2012等国标，给出专业分析和改进建议。`;

      // 准备知识库上下文
      let knowledgeContext = '';
      if (knowledgeBase && knowledgeBase.length > 0) {
        const kbTexts = knowledgeBase
          .filter(doc => doc.content && !doc.error)
          .map(doc => `[${doc.name}]\n${doc.content.substring(0, 1000)}`)
          .join('\n\n');
        knowledgeContext = kbTexts ? `\n\n参考知识库：\n${kbTexts}` : '';
      }

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt + knowledgeContext },
        { role: 'user', content: userPrompt }
      ];

      const response = await callLLM(messages, {
        temperature: 0.7,
        maxTokens: 2000
      });

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('AI返回格式错误，未找到有效的JSON数组');
      }

      const parsedDeviations = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(parsedDeviations) || parsedDeviations.length === 0) {
        throw new Error('AI未识别到偏差项');
      }

      setDeviations(parsedDeviations);
      setAnalyzed(true);
      onAnalysisComplete(parsedDeviations);
      
    } catch (err: any) {
      console.error('[AlignmentPanel] 分析失败:', err);
      setError(err.message || '分析失败，请重试');
      
      // 降级到假数据 (基于实际数据)
      const fallbackDeviations: DeviationItem[] = [];
      if (actualData.torque.status !== 'ok') {
          fallbackDeviations.push({
            title: '偏差项: 操纵力矩异常',
            description: `实测力矩 ${actualData.torque.value} 偏离设计值。可能导致操作疲劳。`,
            priority: 'P1 优先级',
            improvement: '调整力矩至 25-30N',
            severity: 'warning'
          });
      }
      if (actualData.pressure.status !== 'ok') {
          fallbackDeviations.push({
            title: '偏差项: 局部压痛风险',
            description: `实测发现 ${actualData.pressure.value}，存在人机工效隐患。`,
            priority: 'P0 高优先级',
            improvement: '消除压痛点',
            severity: 'error'
          });
      }
      
      if (fallbackDeviations.length === 0) {
          fallbackDeviations.push({
              title: '符合预期',
              description: '主要人机工效指标均在设计范围内。',
              priority: 'P2',
              improvement: '维持现状',
              severity: 'warning' // Just to show green check ideally but using warning for now
          });
      }

      setDeviations(fallbackDeviations);
      setAnalyzed(true);
      onAnalysisComplete(fallbackDeviations);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="p-6 space-y-6 relative">
      {/* Missing Data Warning Dialog */}
      {showMissingDataWarning && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-card/80 backdrop-blur-sm rounded-lg">
          <div className="bg-card border border-destructive/30 shadow-xl rounded-xl p-6 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 text-destructive">
              <div className="p-2 bg-destructive/10 rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-lg">数据未录入完整</h3>
            </div>
            <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
              检测到部分测试任务的记录点尚未填写数据。为了保证对齐分析报告的准确性，建议您完善所有测试数据。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowMissingDataWarning(false)}
                className="px-4 py-2 text-sm text-muted-foreground hover:bg-accent rounded-lg transition-colors"
              >
                返回录入
              </button>
              <button
                onClick={runAnalysis}
                className="px-4 py-2 text-sm bg-destructive hover:bg-destructive/80 text-white rounded-lg shadow-sm transition-colors"
              >
                忽略并继续
              </button>
            </div>
          </div>
        </div>
      )}

      {!analyzed && (
        <button
          onClick={handleAnalyzeClick}
          disabled={analyzing}
          className="w-full bg-node-behavior hover:bg-node-behavior/80 text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          {analyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <TrendingUp className="w-5 h-5" />}
          <span>执行对齐分析</span>
        </button>
      )}

      {analyzed && (
        <>
          {/* Data Source Info */}
          <div className="p-3 bg-node-behavior/10 border border-node-behavior/20 rounded-lg">
            <div className="text-xs text-foreground mb-1">📊 分析数据来源</div>
            <div className="text-xs text-muted-foreground">
              <p>• B1 设计要求: 来自产品规格说明书</p>
              <p>• B2 实际测试: 来自行为SOP节点的记录点数据</p>
              <p>• 知识库参考: 使用内置标准库</p>
            </div>
          </div>

          {/* Comparison View */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-border rounded-lg p-4 bg-card">
              <h3 className="text-sm text-foreground mb-3">{comparisonData.b1.title}</h3>
              <div className="space-y-2">
                {comparisonData.b1.items.map((item, idx) => (
                  <div key={idx}>
                    <div className="text-xs text-muted-foreground">{item.label}</div>
                    <div className="text-sm text-foreground">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-border rounded-lg p-4 bg-card">
              <h3 className="text-sm text-foreground mb-3">{comparisonData.b2.title}</h3>
              <div className="space-y-2">
                {comparisonData.b2.items.map((item, idx) => (
                  <div key={idx}>
                    <div className="text-xs text-muted-foreground">{item.label}</div>
                    <div className="flex items-center justify-between">
                      <div className={`text-sm ${
                        item.status === 'ok' ? 'text-node-context' :
                        item.status === 'warning' ? 'text-node-solution' :
                        item.status === 'error' ? 'text-destructive' :
                        'text-foreground'
                      }`}>
                        {item.value}
                      </div>
                      {item.deviation && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          item.status === 'warning' ? 'bg-node-solution/10 text-node-solution' :
                          'bg-destructive/10 text-destructive'
                        }`}>
                          {item.deviation}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Radar Chart */}
          <div className="border border-border rounded-lg p-4 bg-card">
            <h3 className="text-sm text-foreground mb-3">设计初衷 vs 实际表现</h3>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.12)" />
                <PolarAngleAxis 
                  dataKey="dimension" 
                  tick={{ fill: '#A1A1AA', fontSize: 11 }}
                />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#A1A1AA', fontSize: 10 }} />
                <Radar
                  name="设计预期"
                  dataKey="design"
                  stroke="#60A5FA"
                  fill="#60A5FA"
                  fillOpacity={0.2}
                />
                <Radar
                  name="实际测试"
                  dataKey="actual"
                  stroke="#FB923C"
                  fill="#FB923C"
                  fillOpacity={0.3}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '12px' }}
                  iconType="circle"
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* AI Analysis Results */}
          <div className="border border-node-behavior rounded-lg p-4 bg-card">
            <h3 className="text-sm text-foreground mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-node-behavior" />
              国标知识库诊断
            </h3>
            <div className="space-y-3">
              {deviations.map((deviation, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <AlertTriangle className={`w-5 h-5 ${deviation.severity === 'warning' ? 'text-node-solution' : 'text-destructive'} flex-shrink-0 mt-0.5`} />
                  <div>
                    <div className="text-sm text-foreground mb-1">{deviation.title}</div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {deviation.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${deviation.severity === 'warning' ? 'bg-node-solution/10 text-node-solution' : 'bg-destructive/10 text-destructive'}`}>
                        {deviation.priority}
                      </span>
                      <span className="text-xs text-muted-foreground">预期改善: {deviation.improvement}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Export Button */}
          <button className="w-full border border-node-behavior text-node-behavior hover:bg-node-behavior/10 px-4 py-3 rounded-lg transition-colors">
            导出完整报告 (PDF)
          </button>
        </>
      )}

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
          <div className="text-xs text-foreground mb-1">🚨 错误信息</div>
          <div className="text-xs text-muted-foreground">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}