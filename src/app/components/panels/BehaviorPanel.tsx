import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Smartphone, Circle, Save, Plus, Trash2, Sparkles, AlertTriangle, FileText, CloudUpload, Download, Users, Loader2, Mic, Square, FileJson, FileSpreadsheet, Cloud, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { ScenarioData, TaskSequence, Task, RecordPoint, BranchCard } from '../../App';
import type { Recording } from '../InspectorPanel';
import { generateExtendedTask } from '../../services/aiScenarios';
import { supabase } from '../../utils/supabase/client';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { transcribeAudio } from '../../services/asr';
import { exportRecordingsByAccount, exportFullReport } from '../../services/docExport';
import { loadPanelState, savePanelState } from '../../services/panelArchive';
import { useDesignStore } from '../../services/designStore';

// 23 个手部解剖分区（与 /public/hand-anatomy.png 中 a-v 标注一一对应）
// 坐标系：viewBox 0 0 582 720（图片实际像素 582×720）
// 手指顺序：拇指 / 食指 / 中指 / 无名指 / 小指
// 手指三段：远节指间(DIP) / 近侧指间(PIP) / 掌指(MCP)；加掌心区和大鱼际/小鱼际
interface HandRegion {
  id: string;          // 图中字母 a-v
  finger: string;      // 所属手指
  section: string;     // 解剖节段
  label: string;       // 中文全称
  points: string;      // SVG polygon points（覆盖分区）
  centerX: number;     // 分数标签中心 x
  centerY: number;     // 分数标签中心 y
}

const HAND_REGIONS: HandRegion[] = [
  // ========== 坐标已按新底图 (582×720) a-v 字母位置精准校准 ==========
  // 食指（指尖到掌指）— 第二指（左起），x≈190-260
  { id: 'd', finger: '食指', section: '远节', label: '食指 DIP（远节指间）', points: '190,115 258,115 258,158 190,158', centerX: 224, centerY: 136 },
  { id: 'h', finger: '食指', section: '中节', label: '食指 PIP（中节指间）', points: '190,158 258,158 258,215 190,215', centerX: 224, centerY: 186 },
  { id: 'l', finger: '食指', section: '近节', label: '食指近节指骨',       points: '190,215 258,215 258,290 190,290', centerX: 224, centerY: 252 },
  { id: 'p', finger: '食指', section: '掌指', label: '食指掌指关节区',     points: '190,290 275,290 275,355 190,355', centerX: 232, centerY: 322 },
  // 中指 — 最长，x≈278-345
  { id: 'c', finger: '中指', section: '远节', label: '中指 DIP（远节）',   points: '278,78 345,78 345,130 278,130', centerX: 311, centerY: 104 },
  { id: 'g', finger: '中指', section: '中节', label: '中指 PIP（中节）',   points: '278,130 345,130 345,195 278,195', centerX: 311, centerY: 162 },
  { id: 'k', finger: '中指', section: '近节', label: '中指近节',           points: '278,195 345,195 345,280 278,280', centerX: 311, centerY: 237 },
  { id: 'o', finger: '中指', section: '掌指', label: '中指掌指关节区',     points: '278,280 345,280 345,345 278,345', centerX: 311, centerY: 312 },
  // 无名指 — x≈345-410
  { id: 'b', finger: '无名指', section: '远节', label: '无名指 DIP',        points: '345,115 410,115 410,160 345,160', centerX: 377, centerY: 137 },
  { id: 'f', finger: '无名指', section: '中节', label: '无名指 PIP',        points: '345,160 410,160 410,220 345,220', centerX: 377, centerY: 190 },
  { id: 'j', finger: '无名指', section: '近节', label: '无名指近节',        points: '345,220 410,220 410,300 345,300', centerX: 377, centerY: 260 },
  // 小指 — x≈425-488
  { id: 'a', finger: '小指', section: '远节', label: '小指 DIP',            points: '425,162 488,162 488,212 425,212', centerX: 456, centerY: 187 },
  { id: 'e', finger: '小指', section: '中节', label: '小指 PIP',            points: '425,212 488,212 488,272 425,272', centerX: 456, centerY: 242 },
  { id: 'i', finger: '小指', section: '近节', label: '小指近节',            points: '425,272 488,272 488,335 425,335', centerX: 456, centerY: 303 },
  { id: 'm', finger: '小指', section: '掌指', label: '小指掌指关节区',       points: '410,335 488,335 488,400 410,400', centerX: 449, centerY: 367 },
  // 拇指 — 左侧外伸，x≈55-200
  { id: 'v', finger: '拇指', section: '远节', label: '拇指远节（IP）',       points: '55,340 145,340 145,400 55,400', centerX: 100, centerY: 370 },
  { id: 'u', finger: '拇指', section: '近节', label: '拇指近节（掌指）',     points: '115,400 200,400 200,455 115,455', centerX: 157, centerY: 427 },
  // 掌部
  { id: 't', finger: '掌部', section: '大鱼际', label: '大鱼际肌（拇指球肌）', points: '115,400 275,400 275,495 115,495', centerX: 195, centerY: 447 },
  { id: 's', finger: '掌部', section: '根部',  label: '食指根部过渡区',       points: '195,355 280,355 280,405 195,405', centerX: 237, centerY: 380 },
  { id: 'r', finger: '掌部', section: '掌心',  label: '掌心中央',             points: '280,345 430,345 430,495 280,495', centerX: 355, centerY: 420 },
  { id: 'n', finger: '掌部', section: '无名指下', label: '无名指下方过渡区',  points: '345,300 425,300 425,350 345,350', centerX: 385, centerY: 325 },
  { id: 'q', finger: '掌部', section: '小鱼际',  label: '小鱼际肌（小指球肌）', points: '420,395 525,395 525,535 420,535', centerX: 472, centerY: 465 },
  // 腕部
  { id: 'w', finger: '掌部', section: '腕部',  label: '腕部（桡腕关节）',     points: '200,615 470,615 470,695 200,695', centerX: 335, centerY: 655 },
];

// Borg CR10 评分颜色梯度（0=白/无疲劳 → 10=深红/极度疲劳）
// 兼容旧 SCORE_COLOR[数字] 查表（docExport.ts 仍在用 0-10 全色表）
const SCORE_COLOR: Record<number, string> = {
  0: '#222630',
  1: '#C6E0B4',
  2: '#9CC2E6',
  3: '#67AB9F',
  4: '#4FA8C5',
  5: '#7FB8E8',
  6: '#A2C9A1',
  7: '#D7E58A',
  8: '#F4D86A',
  9: '#F0995A',
  10: '#E84C3D',
};

// 手部热力图渲染专用色阶：每 2 分一档（共 5 档），遵循 Borg CR10 临床分级
// 0-2 无/极轻 → 2-4 轻度 → 4-6 中度 → 6-8 较重 → 8-10 极重
// 选用色彩在白底/深底/打印均清晰可辨（与 #2C3A4E 深底地图正面对比度高）
const SCORE_BAND: Array<{ range: [number, number]; fill: string; text: string; label: string }> = [
  { range: [0,  2], fill: '#5E8FD3', text: '#FFFFFF', label: '极轻 / 无疲劳' },
  { range: [2,  4], fill: '#7FCFA1', text: '#0F2A18', label: '轻度' },
  { range: [4,  6], fill: '#F4D86A', text: '#332B00', label: '中度' },
  { range: [6,  8], fill: '#F08A3C', text: '#FFFFFF', label: '较重' },
  { range: [8, 11], fill: '#E84C3D', text: '#FFFFFF', label: '极重' }, // 上界开区间到 11 容错
];
const getRegionBand = (score: number) =>
  SCORE_BAND.find((b) => score >= b.range[0] && score < b.range[1]) || SCORE_BAND[SCORE_BAND.length - 1];

// ID 模式兜底：方案节点尚未生成时，默认给 1 个方案起点（保证行为节点始终有 tab）
const DEFAULT_ID_VARIANT = { id: 'default', label: '默认', prompt: '', previewUrl: undefined as string | undefined, assetId: undefined as string | undefined };

interface BehaviorPanelProps {
  activeProjectId: string;
  nodeId: string;
  scenarios: any[];
  onTaskStatsChange: (stats: any) => void;
  taskStats: any;
  taskSequences: any[];
  onTaskSequencesChange: (sequences: any[]) => void;
  // 录音相关整套由 InspectorPanel 托管（切节点不丢、不中断）
  recordings: Recording[];
  setRecordings: React.Dispatch<React.SetStateAction<Recording[]>>;
  currentRecIdx: number;
  setCurrentRecIdx: React.Dispatch<React.SetStateAction<number>>;
  isRecording: boolean;
  recordingTask: string | null;
  startRecording: (scenarioId: string) => void;
  stopRecording: () => void;
}

export function BehaviorPanel({
  activeProjectId,
  nodeId,
  scenarios, 
  onTaskStatsChange,
  taskStats,
  taskSequences,
  onTaskSequencesChange,
  recordings,
  setRecordings,
  currentRecIdx,
  setCurrentRecIdx,
  isRecording,
  recordingTask,
  startRecording,
  stopRecording
}: BehaviorPanelProps) {
  const [activeTab, setActiveTab] = useState(0);
  // taskSequences state is now managed by parent
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [regionScores, setRegionScores] = useState<Record<string, number>>({});
  const [regionNotes, setRegionNotes] = useState<Record<string, string>>({});
  const [editingRecordPoint, setEditingRecordPoint] = useState<string | null>(null);
  
  // New State for Task Management
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: '',
    description: '',
    recordPoints: []
  });
  // 录音分组折叠：key = 账号__会话
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  // === 方案→行为 连线：ID 外观方案模式（替代 SOP 场景分类卡片模式）===
  const { useDelivery, getOutput } = useDesignStore();
  const delivery = useDelivery(nodeId);
  // 只要收到来自 solution 的投递（哪怕是空的 connected 标记）即视为已连线
  const isConnectedToSolution = !!delivery && delivery.fromType === 'solution';
  const [overrideSop, setOverrideSop] = useState(false);
  const idMode = isConnectedToSolution && !overrideSop;
  // 投递时方案可能还没生成 → 从方案节点实时输出（getOutput）同步，并支持手动刷新
  const [syncedVariants, setSyncedVariants] = useState<Array<{ id?: string; label: string; prompt?: string; previewUrl?: string; assetId?: string }> | null>(null);
  useEffect(() => {
    if (!delivery || delivery.fromType !== 'solution') { setSyncedVariants(null); return; }
    const out = getOutput(delivery.fromNodeId);
    if (out && Array.isArray(out.variants) && out.variants.length > 0) setSyncedVariants(out.variants);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery?.token, delivery?.fromNodeId]);
  const refreshIdVariants = () => {
    if (!delivery || delivery.fromType !== 'solution') return;
    const out = getOutput(delivery.fromNodeId);
    if (out && Array.isArray(out.variants) && out.variants.length > 0) {
      setSyncedVariants(out.variants);
    } else {
      alert('方案节点还没有可用的 ID 方案，请先在方案节点面板用 Tripo3D 生成 1/3/5 个方案，再回来同步。');
    }
  };
  // 方案生成可能发生在连线之后（甚至方案节点已卸载）：轮询方案节点实时输出自动同步，无需手动刷新
  useEffect(() => {
    if (!delivery || delivery.fromType !== 'solution') return;
    const fromNodeId = delivery.fromNodeId;
    const timer = setInterval(() => {
      const out = getOutput(fromNodeId);
      const list = out && Array.isArray(out.variants) ? out.variants : [];
      if (list.length === 0) {
        // 方案节点输出为空（新节点/未生成）：清空实时值，避免残留旧节点方案
        setSyncedVariants((prev) => (prev ? null : prev));
        return;
      }
      setSyncedVariants((prev) => {
        const sig = (arr: any[]) => arr.map((v: any) => `${v.id}|${v.label}|${v.assetId || ''}|${(v.previewUrl || '').slice(0, 80)}`).join('\n');
        return sig(list) === sig(prev || []) ? prev : list;
      });
    }, 1500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivery?.fromNodeId]);
  const deliveredVariants: Array<{ id?: string; label: string; prompt?: string; previewUrl?: string; assetId?: string }> | undefined = delivery?.data?.variants;
  // 优先使用实时同步值（轮询 getOutput，含连线后添加/重新生成的方案），连线快照仅兜底
  const idVariants = idMode
    ? (syncedVariants && syncedVariants.length > 0 ? syncedVariants : (deliveredVariants && deliveredVariants.length > 0 ? deliveredVariants : null)) ?? null
    : null;
  // 实际用于渲染的 variants：无真实方案时兜底 1 个默认方案，保证行为节点始终有 tab
  const effectiveVariants = useMemo(() => {
    if (!idMode) return null;
    return idVariants && idVariants.length > 0 ? idVariants : [DEFAULT_ID_VARIANT];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idMode, idVariants]);
  // T3（智能UI界面）启用开关：每 variant 独立
  const [t3Enabled, setT3Enabled] = useState<Record<string, boolean>>({});
  const toggleT3 = (vid: string) => setT3Enabled((p) => ({ ...p, [vid]: !p[vid] }));
  // ID 模式合成 taskSequences（结构对齐 sop，便于复用任务卡 / 统计 / 录音管线）
  const idSequences = useMemo(() => {
    if (!effectiveVariants) return [];
    return effectiveVariants.map((v) => {
      const sid = v.id || `var-${v.label}`;
      const t3On = !!t3Enabled[sid];
      const tasks: Task[] = [
        { code: 'T1', title: '基本握持', description: '评估 ID 方案的握持贴合度与疲劳度（可配合手部热力图）', recordPoints: [] },
        { code: 'T2', title: '精准操作', description: '评估 ID 方案在精细捏取 / 操作下的可控性与精度', recordPoints: [] },
      ];
      if (t3On) tasks.push({ code: 'T3', title: '智能UI界面', description: '（可选）评估配套 UI 界面的可达性与清晰度', recordPoints: [] });
      return { scenarioId: `variant-${sid}`, scenarioTitle: `ID 方案 ${v.label}`, tasks };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveVariants, t3Enabled]);
  const effectiveSequences = idMode ? idSequences : taskSequences;
  // 提前到此处：heatmapNodeId 需要访问 currentSequence，避免 TDZ
  const currentSequence = effectiveSequences[activeTab];
  // 手部热力图：ID 模式按方案节点+variant 隔离；SOP 模式按 scenario
  const heatmapNodeId = idMode
    ? `behavior-idmode-${delivery!.fromNodeId}-${effectiveVariants?.[activeTab]?.id || effectiveVariants?.[activeTab]?.label || String(activeTab)}`
    : (currentSequence?.scenarioId ? `behavior-heatmap-${currentSequence.scenarioId}` : 'behavior-heatmap-default');
  // 模式切换 / variant 数量变化时，钳制 activeTab 到合法范围
  useEffect(() => {
    if (activeTab >= effectiveSequences.length && effectiveSequences.length > 0) setActiveTab(0);
  }, [effectiveSequences.length]);
  const [archiveSaving, setArchiveSaving] = useState(false);
  const [archiveSavedAt, setArchiveSavedAt] = useState<string | null>(null);
  const heatmapLoadedRef = useRef(false);
  // 已评分列表折叠（默认折叠，避免视觉冗余）
  const [scoredListOpen, setScoredListOpen] = useState(false);

  // 加载云端存档（仅在 scenarioId 切换时拉一次）
  useEffect(() => {
    let cancelled = false;
    heatmapLoadedRef.current = false;
    loadPanelState<{ regionScores: Record<string, number>; regionNotes: Record<string, string> }>(
      activeProjectId, heatmapNodeId, 'behavior',
    ).then((res) => {
      if (cancelled) return;
      if (res?.data?.regionScores && Object.keys(res.data.regionScores).length > 0) {
        setRegionScores(res.data.regionScores);
      }
      if (res?.data?.regionNotes && Object.keys(res.data.regionNotes).length > 0) {
        setRegionNotes(res.data.regionNotes);
      }
      setArchiveSavedAt(res?.updatedAt || null);
      heatmapLoadedRef.current = true;
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId, heatmapNodeId]);

  // Generate task sequences based on selected scenarios
  useEffect(() => {
    // Only initialize if empty or scenarios changed significantly
    const selectedScenarios = scenarios.filter(s => s.selected);
    
    // Check if we already have sequences for these IDs to preserve state
    // Create new sequences only for scenarios that don't have one yet
    const newSequences = selectedScenarios.map(scenario => {
      const existing = taskSequences.find(ts => ts.scenarioId === scenario.id);
      if (existing) return existing;

      return {
        scenarioId: scenario.id,
        scenarioTitle: scenario.title,
        scenarioDescription: scenario.description,
        tasks: generateTasksForScenario(scenario)
      };
    });

    // Check if sequences actually changed to avoid infinite loop
    const isDifferent = JSON.stringify(newSequences.map(s => s.scenarioId)) !== JSON.stringify(taskSequences.map(s => s.scenarioId));
    
    if (isDifferent) {
        onTaskSequencesChange(newSequences);
        
        // Reset active tab if it's out of bounds
        if (activeTab >= newSequences.length && newSequences.length > 0) {
          setActiveTab(0);
        }
    }
  }, [scenarios]);

  // Effect to update stats whenever taskSequences changes
  useEffect(() => {
    const totalTasks = taskSequences.reduce((sum, seq) => sum + seq.tasks.length, 0);
    const completedTasks = taskSequences.reduce((sum, seq) => 
      sum + seq.tasks.filter(t => t.status === 'completed').length, 0);
    
    onTaskStatsChange((prev: any) => ({
      ...prev,
      behavior: { total: totalTasks, completed: completedTasks }
    }));
  }, [taskSequences, onTaskStatsChange]);

  const generateTasksForScenario = (scenario: ScenarioData): Task[] => {
    // --------------------------------------------------------
    // 威克医疗 一次性腔镜用直线型全电动切割吻合器及钉仓组件
    // --------------------------------------------------------
    
    const sop0: Task = {
      id: `sop0-${scenario.id}`,
      code: 'SOP-0',
      title: '通用术前自检（独立篇）',
      description: `适用范围：威克医疗一次性腔镜用直线型全电动切割吻合器及钉仓组件的所有使用场景，任何手术操作前必须完整执行。

步骤 1：包装完整性检查
取出无菌包装，检查外包装有无破损、受潮、污染痕迹；核对灭菌有效期未过期、批号清晰可追溯。破损、过期、受潮者一律弃用，不得使用。

步骤 2：设备装配确认
确认吻合器手柄与钉仓组件型号匹配，检查各连接部位无松动、无裂缝、无异物附着。

步骤 3：开机
按下电源键开机，观察显示屏是否亮起并进入待机界面。若屏幕不亮，检查电池装配是否正确、电池触点是否清洁。

步骤 4：系统自检确认
观察显示屏自检信息：电量显示充足、系统状态正常、无故障代码。电量不足或出现故障代码时，更换电池或更换设备。

步骤 5：双侧按键功能测试
空载状态下分别轻按手柄左右两侧按键，确认双侧按键均有清晰的机械"咔嗒"反馈、按键回弹正常。若单侧无反馈或卡滞，更换设备。

步骤 6：钉仓装载与识别
装载适配钉仓，确认钉仓卡入到位（听到到位声或触到到位手感）。观察显示屏是否自动识别并显示钉仓型号/颜色。无法识别时，重新装载；仍无法识别则更换钉仓或设备。

步骤 7：空载击发测试
在钳口空载（未夹任何组织）状态下执行一次空载击发，确认电机运转声音正常、无卡顿、击发与回刀动作流畅。异常则更换设备。

步骤 8：功能复位
完成自检后，确认钳口处于闭合或复位状态，偏转角度归零，设备进入待机待用状态，方可进入手术操作流程。

自检通过标准：上述 8 步全部通过，显示屏状态正常、双侧按键正常、钉仓识别正常、空载击发正常。`,
      illustration: 'M20,20 L60,20 L60,60 L20,60 Z M30,40 L45,40 M45,40 L40,35 M45,40 L40,45', 
      recordPoints: [
        { id: 'rp0-1', label: '开机自检时长', value: '', editable: true, unit: 's', range: '1-5', recommended: '<3', guidance: '按下电源键到进入待机界面的时间' },
        { id: 'rp0-2', label: '双侧按键反馈', value: '', editable: true, guidance: '确认机械"咔嗒"声与回弹，记录是否清晰' },
        { id: 'rp0-3', label: '钉仓识别速度', value: '', editable: true, unit: 's', recommended: '<1', guidance: '装载卡入到显示屏识别的时间' },
        { id: 'rp0-4', label: '空载测试电音', value: '', editable: true, guidance: '评估电机运转声音无卡顿' }
      ],
      status: 'pending' as const,
      branchCards: []
    };

    if (scenario.id === 'stapler-scene-1') {
      return [
        sop0,
        {
          id: 'sop1-s1', code: 'S1-1', title: '阶段一：入路与定位',
          description: `• 步骤 1：通过 Trocar 置入器械头端，保持钳口闭合状态，避免损伤组织。确认头端完整进入腔体。
• 步骤 2：在显示屏确认初始偏转角度为 0°，避免未察觉的偏转导致误伤。
• 步骤 3：直视下将钳口缓慢推进至目标组织，全程保持钳口平行于组织平面，确认无阻力、无组织钩挂。`,
          illustration: 'M10,40 L70,40',
          recordPoints: [
            { id: 'rp1-1', label: '置入阻力感知', value: '', editable: true, guidance: '主管评分 1-10 (1=极轻松)' },
            { id: 'rp1-1b', label: '推进对准时间', value: '', editable: true, unit: 's', guidance: '从入路到对准目标的时间' }
          ],
          status: 'pending' as const,
          branchCards: []
        },
        {
          id: 'sop1-s2', code: 'S1-2', title: '阶段二：大角度偏转与到位',
          description: `• 步骤 4：单手拇指操作偏转控制，缓慢增大偏转角，逐级偏转，每 10°—15° 停顿观察一次，显示屏实时显示角度读数。
• 步骤 5：到达目标角度（如 45°—60°）后锁定偏转机构，确认显示屏偏转锁定指示出现。
• 步骤 6：微调器械整体位置，利用偏转与轴向旋转组合，使钳口对准预定切割线，确认钳口与切割线完全平行。
• 步骤 7：确认钳口已完全包绕目标组织，组织全部进入钳口、无部分脱出，钳口末端可见组织。`,
          illustration: 'M10,40 L40,40 L60,20',
          recordPoints: [
            { id: 'rp1-2', label: '最大偏转角', value: '', editable: true, unit: '°', range: '0-60' },
            { id: 'rp1-3', label: '单手拨轮舒适度', value: '', editable: true, guidance: '拇指操作疲劳度 (RPE 1-10)' },
            { id: 'rp1-3b', label: '锁定操作时间', value: '', editable: true, unit: 's' }
          ],
          status: 'pending' as const,
          branchCards: []
        },
        {
          id: 'sop1-s3', code: 'S1-3', title: '阶段三：闭合与击发',
          description: `• 步骤 8：按下闭合控制，闭合钳口，观察组织是否均匀压入，确认显示屏显示闭合到位。
• 步骤 9：检查显示屏组织厚度读数，确认与所选钉仓适配；厚度超限则松开钳口更换钉仓。
• 步骤 10：360° 观察钳口周边，确认无邻近组织或血管被误夹。
• 步骤 11：按下击发按键启动电动击发，保持器械稳定不移动，观察显示屏击发进度条前进。
• 步骤 12：观察击发完成反馈，进度条 100% 且出现完成提示音。
• 步骤 13：松开钳口，缓慢退出器械，确认切割线完整、无出血。`,
          illustration: 'M20,30 L60,30 M20,50 L60,50',
          recordPoints: [
            { id: 'rp1-4', label: '两段式扳机力', value: '', editable: true, unit: 'N', guidance: '触发击发的按压力度' },
            { id: 'rp1-5', label: '屏幕信息获取时间', value: '', editable: true, unit: 's', guidance: '读取厚度与进度条的时间' },
            { id: 'rp1-5b', label: '击发稳定性', value: '', editable: true, unit: 'mm', guidance: '击发时枪管轴向位移' }
          ],
          status: 'pending' as const,
          branchCards: []
        },
        {
          id: 'sop1-s4', code: 'S1-4', title: '阶段四：术后检查',
          description: `• 步骤 14：检查切割线是否平直、无成钉不良。
• 步骤 15：检查吻合口有无活动性出血或渗血。
• 步骤 16：确认周边组织无撕裂、无灼伤。`,
          illustration: 'M25,40 L35,50 L55,25',
          recordPoints: [
            { id: 'rp1-6', label: '成钉不良率', value: '', editable: true, unit: '%' },
            { id: 'rp1-6b', label: '意外分支触发', value: '', editable: true, guidance: '记录是否触发任何意外分支及处理耗时' }
          ],
          status: 'pending' as const,
          branchCards: [
            { id: 'bc1-1', trigger: '偏转角度不足', action: '重新选择 Trocar 位置或改用手动辅助定位' },
            { id: 'bc1-2', trigger: '钳口无法完全包绕', action: '撤出重新定位，禁止强行击发' },
            { id: 'bc1-3', trigger: '组织厚度超限', action: '松开钳口，更换更大规格钉仓' },
            { id: 'bc1-4', trigger: '击发中卡顿', action: '立即停止，电动回刀，查明原因' }
          ]
        }
      ];
    }
    
    if (scenario.id === 'stapler-scene-2') {
      return [
        sop0,
        {
          id: 'sop2-s1', code: 'S2-1', title: '阶段一：组织评估与钉仓选择',
          description: `• 步骤 1：直视下评估目标组织厚度，预估组织压缩后厚度。
• 步骤 2：根据厚度选择适配钉仓，厚组织选绿色或黑色钉仓，核对钉仓规格标识。
• 步骤 3：装载所选钉仓，确认钉仓卡到位，显示屏识别钉仓型号。
• 步骤 4：显示屏核对钉仓与组织匹配度，不匹配则更换钉仓。`,
          illustration: 'M20,20 L60,20 M20,60 L60,60 M20,40 L60,40',
          recordPoints: [
            { id: 'rp2-1', label: '组织预估厚度', value: '', editable: true, unit: 'mm' },
            { id: 'rp2-1b', label: '显示屏读数延迟', value: '', editable: true, unit: 's' }
          ],
          status: 'pending' as const,
          branchCards: []
        },
        {
          id: 'sop2-s2', code: 'S2-2', title: '阶段二：钳口闭合与智能压榨',
          description: `• 步骤 5：钳口对准并完全包绕厚组织，确保组织均匀分布，钳口末端可见组织。
• 步骤 6：按下闭合控制，缓慢闭合钳口，缓慢均匀施压，避免组织挤出，观察显示屏闭合压力指示。
• 步骤 7：启动智能压榨等待，让组织液充分重新分布，观察显示屏压榨倒计时或进度。
• 步骤 8：观察压榨状态反馈，压榨时间满足后出现声音与屏幕双重提示。
• 步骤 9：若为薄组织，术者可视情况跳过压榨等待，直接进入击发。`,
          illustration: 'M30,20 L50,20 L40,40 Z',
          recordPoints: [
            { id: 'rp2-2', label: '闭合压力读数', value: '', editable: true, unit: 'kPa' },
            { id: 'rp2-3', label: '压榨等待时间', value: '', editable: true, unit: 's', guidance: '实际耗时' },
            { id: 'rp2-3b', label: '视听反馈清晰度', value: '', editable: true, guidance: '评分 1-5' }
          ],
          status: 'pending' as const,
          branchCards: []
        },
        {
          id: 'sop2-s3', code: 'S2-3', title: '阶段三：击发与成钉',
          description: `• 步骤 10：确认压榨充分、组织厚度读数稳定（数值稳定 2 秒以上）。
• 步骤 11：启动电动击发，保持匀速电动击发、不额外手动施力，观察显示屏进度条。
• 步骤 12：全程观察击发进度与组织状态，出现组织滑脱立即停止。
• 步骤 13：击发完成，等待声音与屏幕双重确认。
• 步骤 14：松开钳口，检查成钉质量，确认钉成型完整、无浮钉或歪钉。`,
          illustration: 'M10,40 L70,40 M40,20 L40,60',
          recordPoints: [
            { id: 'rp2-4', label: '厚度读数稳定期', value: '', editable: true, unit: 's', recommended: '>2' },
            { id: 'rp2-5', label: '击发后震动感', value: '', editable: true, guidance: '手柄传递震动主观评分' }
          ],
          status: 'pending' as const,
          branchCards: []
        },
        {
          id: 'sop2-s4', code: 'S2-4', title: '阶段四：止血确认',
          description: `• 步骤 15：观察吻合口 30 秒，确认无活动性出血。
• 步骤 16：如有渗血，评估是否需补针或电凝，轻微渗血可观察、活动性出血须处理。
• 步骤 17：记录出血情况，用于术后质量评估。`,
          illustration: 'M20,40 Q40,10 60,40 Q40,70 20,40',
          recordPoints: [
            { id: 'rp2-6', label: '渗血点数量', value: '', editable: true, unit: '个' },
            { id: 'rp2-6b', label: '意外分支触发', value: '', editable: true, guidance: '记录发生的意外情况与补救用时' }
          ],
          status: 'pending' as const,
          branchCards: [
            { id: 'bc2-1', trigger: '压榨后组织仍过厚', action: '松开，考虑更换更厚规格钉仓' },
            { id: 'bc2-2', trigger: '压榨中组织外溢', action: '立即停止闭合，重新定位钳口' },
            { id: 'bc2-3', trigger: '击发中组织滑脱', action: '停止击发，电动回刀，重新操作' },
            { id: 'bc2-4', trigger: '成钉不良（浮钉）', action: '评估是否需补缝，记录原因' }
          ]
        }
      ];
    }
    
    if (scenario.id === 'stapler-scene-3') {
      return [
        sop0,
        {
          id: 'sop3-s1', code: 'S3-1', title: '阶段一：切割线规划',
          description: `• 步骤 1：规划整体切割路径，评估切割线长度与所需钉仓数量。
• 步骤 2：确定分段击发策略，切割线超过单钉仓长度时规划 2—3 次击发，每段重叠 2—3mm。
• 步骤 3：准备足量钉仓（含备用），长切割线通常需 2—4 个钉仓。
• 步骤 4：若需多次击发，规划钉仓颜色梯度，厚薄组织过渡区选适配钉仓。`,
          illustration: 'M10,40 L30,40 M35,40 L55,40 M60,40 L80,40',
          recordPoints: [
            { id: 'rp3-1', label: '总切割长度', value: '', editable: true, unit: 'mm' },
            { id: 'rp3-1b', label: '规划耗时', value: '', editable: true, unit: 's' }
          ],
          status: 'pending' as const,
          branchCards: []
        },
        {
          id: 'sop3-s2', code: 'S3-2', title: '阶段二：分段击发循环',
          description: `• 步骤 5：第一段，钳口对准切割线起点，留出 2—3mm 起始重叠，确认起点定位准确。
• 步骤 6：闭合钳口，确认组织均匀，观察显示屏厚度读数（长切割线组织厚度可能不均）。
• 步骤 7：充分压榨后电动击发第一段，保持器械轴线稳定，确认击发进度 100%。
• 步骤 8：松开钳口，检查第一段钉线完整、无出血。
• 步骤 9：第二段，钳口与第一段末端重叠 2—3mm，确保钉线连续无间隙，确认重叠区到位。
• 步骤 10：重复"闭合→压榨→击发"流程，与第一段操作一致，确认进度 100%。
• 步骤 11：依次完成后续各分段，每段均重叠前一末端，全程钉线连续。
• 步骤 12：最后一段，留出 2—3mm 末端安全边距，避免切割至组织边缘。`,
          illustration: 'M20,30 L60,30 L40,60 Z',
          recordPoints: [
            { id: 'rp3-2', label: '段间重叠精度', value: '', editable: true, unit: 'mm', recommended: '2-3' },
            { id: 'rp3-3', label: '连续击发手部疲劳', value: '', editable: true, guidance: 'Borg评分1-10' },
            { id: 'rp3-3b', label: '单次击发周期耗时', value: '', editable: true, unit: 's' }
          ],
          status: 'pending' as const,
          branchCards: []
        },
        {
          id: 'sop3-s3', code: 'S3-3', title: '阶段三：全程止血评估',
          description: `• 步骤 13：逐段检查切割线，重点检查每段交界处，确认无段间出血。
• 步骤 14：检查钉线连续性，确认重叠区无漏钉或间隙。
• 步骤 15：观察全程吻合口 60 秒，确认无活动性出血。
• 步骤 16：评估有无渗血点，分段交界处为渗血高发区，标记渗血点。
• 步骤 17：必要时对渗血点补针或电凝止血，活动性出血必须处理。`,
          illustration: 'M20,40 L40,60 L70,20',
          recordPoints: [
            { id: 'rp3-4', label: '交界处渗血率', value: '', editable: true, unit: '%' },
            { id: 'rp3-4b', label: '吻合口面积评估', value: '', editable: true, unit: 'mm²' }
          ],
          status: 'pending' as const,
          branchCards: []
        },
        {
          id: 'sop3-s4', code: 'S3-4', title: '阶段四：术后记录与器械处理',
          description: `• 步骤 18：记录击发次数、钉仓类型，用于质量追溯。
• 步骤 19：记录出血情况，纳入止血并发症监控。
• 步骤 20：一次性器械按规范废弃处理，严禁重复使用。`,
          illustration: 'M30,20 L50,20 L50,60 L30,60 Z',
          recordPoints: [
            { id: 'rp3-5', label: '使用钉仓总数', value: '', editable: true, unit: '个' },
            { id: 'rp3-5b', label: '意外分支触发', value: '', editable: true, guidance: '记录是否发生上述异常及补救操作' }
          ],
          status: 'pending' as const,
          branchCards: [
            { id: 'bc3-1', trigger: '段间钉线断裂或间隙', action: '评估是否需补缝，记录位置' },
            { id: 'bc3-2', trigger: '段间交界处出血', action: '电凝或补针止血，必要时追加击发' },
            { id: 'bc3-3', trigger: '组织厚度不均匀', action: '分段更换适配钉仓' },
            { id: 'bc3-4', trigger: '击发中器械移位', action: '停止击发，重新定位该段' },
            { id: 'bc3-5', trigger: '钉仓耗尽', action: '及时补充，避免术中断供' }
          ]
        }
      ];
    }

    // --------------------------------------------------------
    // forceps-v2 小钳智能双极电刀
    // --------------------------------------------------------
    if (scenario.id === 'standard') {
      return [
        {
          id: 't1-standard',
          code: 'T1',
          title: '基础握持测试',
          description: '评估标准握持姿势的人机工效（参考 GB 10000/GB/T 14775）',
          illustration: 'M10,40 L30,20 L50,40 L30,60 Z', 
          recordPoints: [
            { id: 'rp1', label: '手柄握持直径', value: '', editable: true, unit: 'mm', range: '15-35', recommended: '20-30', guidance: 'GB 10000 成年人手部尺寸推荐值 20-30mm', risk: '<15mm导致局部压强过大，>35mm导致无法完全握持增加疲劳' },
            { id: 'rp2', label: '操纵力 (指尖)', value: '', editable: true, unit: 'N', range: '1-20', recommended: '<10', guidance: '估算参考：轻松(握笔)≈5-10N；中等(握门把)≈15-25N；用力(拧瓶盖)≈30+N。GB/T 14775 频繁操作建议<10N。', risk: '>20N 易导致手指疲劳或操作失误' }
          ],
          status: 'pending' as const,
          branchCards: []
        },
        {
          id: 't2-standard',
          code: 'T2',
          title: '精准操作测试',
          description: '评估细微动作控制能力',
          illustration: 'M30,15 L30,65 M15,40 L45,40', 
          recordPoints: [
            { id: 'rp3', label: '操作精度', value: '', editable: true, unit: 'mm', range: '0.1-1.0', recommended: '<0.5', guidance: '输入值时确保<0.5mm，避免精度误差导致医疗实验失败', risk: '>1.0mm可能引起误操作，增加实验风险' },
            { id: 'rp4', label: '精细旋钮直径', value: '', editable: true, unit: 'mm', range: '10-25', recommended: '15-20', guidance: '指尖捏持旋钮建议直径 10-25mm', risk: '尺寸不当将降低精细调节的准确性' }
          ],
          status: 'pending' as const,
          branchCards: []
        }
      ];
    }
    
    if (scenario.id === 'fatigue') {
      return [
        {
          id: 't1-fatigue',
          code: 'T1',
          title: '长时握持耐力测试',
          description: '连续握持 3-12 小时后的性能评估（模拟长台手术）',
          illustration: 'M20,20 Q30,10 40,20 T60,20', 
          recordPoints: [
            { id: 'rp5', label: '主观疲劳度 (RPE)', value: '', editable: true, unit: '级', range: '1-10', recommended: '<4', guidance: 'Borg量表：1(极轻松)-10(力竭)。12小时测试建议每小时记录。', risk: '>6 表示过高负荷，需强制休息，避免肌肉损伤' },
            { id: 'rp6', label: '手部震颤幅值', value: '', editable: true, unit: 'mm', range: '0-5', recommended: '<0.5', guidance: '测量指尖在静止状态下的位移幅值（医疗操作扩展指标）', risk: '>1.0mm 严重影响显微手术精度，实验需终止' },
            { id: 'rp6-b', label: '握力衰减率', value: '', editable: true, unit: '%', range: '0-100', recommended: '<15', guidance: '操作前后最大握力变化', risk: '>20% 肌肉明显疲劳' }
          ],
          status: 'pending' as const,
          branchCards: []
        },
        {
          id: 't2-fatigue',
          code: 'T2',
          title: '动态锁止耐力',
          description: '疲劳状态下的棘齿反馈评估',
          illustration: 'M20,30 L25,25 L30,35 L35,25 L40,35 L45,25 L50,30', 
          recordPoints: [
            { id: 'rp7', label: '反馈力矩', value: '', editable: true, unit: 'N·m', range: '0.1-2.0', recommended: '0.2-0.8', guidance: 'GB/T 14775：触觉反馈需清晰。疲劳状态下需更明确的反馈。', risk: '<0.15N·m 疲劳时无法感知锁止，导致误操作' },
            { id: 'rp8', label: '锁止确定性', value: '', editable: true, guidance: '记录是否发生假锁止（是/否）' }
          ],
          status: 'pending' as const,
          branchCards: []
        },
        {
          id: 't3-fatigue',
          code: 'T3',
          title: '精度退化测试',
          description: '疲劳后操作精度变化',
          illustration: 'M30,15 A15,15 0 1,1 30,65 A15,15 0 1,1 30,15',
          recordPoints: [
            { id: 'rp10', label: '精度误差变化', value: '', editable: true, unit: '%', guidance: '(疲劳后误差 - 初始误差) / 初始误差' }
          ],
          status: 'pending' as const,
          branchCards: []
        }
      ];
    }
    
    if (scenario.id === 'extreme') {
      return [
        {
          id: 't1-extreme',
          code: 'T1',
          title: '低摩擦抓握测试',
          description: '模拟液体润湿手套表面后的摩擦系数下降',
          illustration: 'M20,40 L60,40 M40,20 L40,60', 
          recordPoints: [
            { id: 'rp11', label: '滑脱发生次数', value: '', editable: true, unit: '次', range: '0-5', recommended: '0', guidance: '记录在特定操作时间内滑脱的次数。' }
          ],
          status: 'pending' as const,
          branchCards: []
        }
      ];
    }
    
    return [
      {
        id: `t1-${scenario.id}`,
        code: 'T1',
        title: '场景默认任务',
        description: '请描述在该场景下的核心人机交互任务',
        illustration: 'M30,30 h20 v20 h-20 z',
        recordPoints: [
          { id: `rp1-${scenario.id}`, label: '关键指标测量', value: '', editable: true }
        ],
        status: 'pending' as const,
        isCustom: true,
        branchCards: []
      }
    ];
  };
  // Update stats when tasks change
  useEffect(() => {
    const totalTasks = taskSequences.reduce((sum, seq) => sum + seq.tasks.length, 0);
    const completedTasks = taskSequences.reduce((sum, seq) => 
      sum + seq.tasks.filter(t => t.status === 'completed').length, 0);
    
    onTaskStatsChange((prev: any) => ({
      ...prev,
      behavior: { total: totalTasks, completed: completedTasks }
    }));
  }, [taskSequences]);

  const [isUploading, setIsUploading] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const [cloudCount, setCloudCount] = useState<number | null>(null);

  // Cloud Sync & Export Functions
  const handleCloudSubmit = async () => {
    if (taskSequences.length === 0) return;
    setIsUploading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('请先登录后再保存：点击左侧栏底部的「登录账号」按钮（演示账号 admin@make.com / admin123）。');
        setIsUploading(false);
        return;
      }

      // Prepare payload with ALL sequences
      const payload = {
        access_token: session.access_token,
        businessProjectId: activeProjectId,
        allSequences: taskSequences
      };

      // Use fetch for maximum control and debuggability
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-5590af4c/submit-record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}` // Pass Gateway
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        // Try to read the error text from backend
        const errorText = await response.text();
        console.error('Upload failed:', response.status, errorText);
        
        if (response.status === 401) {
             throw new Error('鉴权失败：您的登录会话可能已过期，请重新登录。');
        }
        throw new Error(`服务器错误 (${response.status}): ${errorText}`);
      }
      
      const resData = await response.json();
      setCloudCount(resData.totalUserRecords);
      alert(`✅ 全量数据同步成功！\n本次保存：${resData.savedCount} 个场景\n您的云端总记录数：${resData.totalUserRecords}`);
    } catch (e: any) {
      console.error('Cloud submit error:', e);
      alert('❌ 同步失败: ' + e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleExportMyRecords = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert('请先登录');
      return;
    }
    
    try {
        // Change to POST to send token in body (avoid URL length limits or logging sensitive data)
        const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-5590af4c/export/my-records`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${publicAnonKey}`, // Use Anon Key to pass Gateway
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                access_token: session.access_token,
                businessProjectId: activeProjectId
            })
        });
        
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Server responded with ${res.status}: ${text}`);
        }
        
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `my_records_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (e: any) {
        console.error('Export failed:', e);
        alert('导出失败: ' + e.message);
    }
  };

  const handleExportAllRecords = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert('请先登录');
      return;
    }
    
    // In a real app, this link would only work for admins (enforced by backend)
    const confirmed = window.confirm('管理员操作：导出所有被试数据？');
    if (confirmed) {
       try {
        const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-5590af4c/export/all-records`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${publicAnonKey}`, // Use Anon Key to pass Gateway
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                access_token: session.access_token,
                businessProjectId: activeProjectId
            })
        });
        
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Server responded with ${res.status}: ${text}`);
        }
        
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `all_participants_data_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (e: any) {
          console.error('Export failed:', e);
          alert('导出失败: ' + e.message);
      }
    }
  };

  // —— Word 导出（前端 docx 生成，按用户需求统一 Word 格式）——
  const PROJECT_NAME_MAP: Record<string, string> = {
    'forceps-v2': '小钳智能双极电刀 V2',
    'stapler-v3': '威克医疗一次性腔镜用直线型全电动切割吻合器',
  };

  // 出声报告：按「账号 + 登录会话」分组导出（满足 A/B 按账号区分、拆分导出）
  const handleExportVocalReport = () => {
    try {
      exportRecordingsByAccount(recordings as any);
    } catch (e: any) {
      console.error('导出出声报告失败:', e);
      alert('导出出声报告失败: ' + e.message);
    }
  };

  // 整体测试记录报告：SOP 完成度 / 量化记录点 / 手部工效评分 / 录音转写 / 人机对齐分析
  const handleExportFullReport = () => {
    try {
      const regionLabelMap = HAND_REGIONS.reduce((m: Record<string, string>, r: any) => {
        m[r.id] = r.label;
        return m;
      }, {});
      exportFullReport({
        projectName: PROJECT_NAME_MAP[activeProjectId] || activeProjectId,
        taskSequences: (taskSequences as any) || [],
        regionScores,
        regionNotes,
        regionLabelMap,
        recordings: recordings as any,
        deviationItems: (taskStats?.alignment?.deviationItems as any) || [],
        alignmentAnalyzed: !!taskStats?.alignment?.analyzed,
      });
    } catch (e: any) {
      console.error('导出整体报告失败:', e);
      alert('导出整体报告失败: ' + e.message);
    }
  };

  // --- State Update Handlers (previously referenced but undefined, now implemented) ---

  const updateSequences = (updater: (seq: TaskSequence) => TaskSequence) => {
    const updated = taskSequences.map(seq => updater(seq as TaskSequence));
    onTaskSequencesChange(updated);
  };

  // 保存记录点：填写完成后自动将该任务标记为 Done
  const handleUpdateRecordPoint = (taskId: string, pointId: string, value: string) => {
    updateSequences((seq) => ({
      ...seq,
      tasks: seq.tasks.map((task) => {
        if (task.id !== taskId) return task;
        const recordPoints: RecordPoint[] = task.recordPoints.map((rp) =>
          rp.id === pointId ? { ...rp, value } : rp
        );
        const allFilled = recordPoints.length > 0 &&
          recordPoints.every((rp) => rp.value && rp.value.trim() !== '');
        return {
          ...task,
          recordPoints,
          status: allFilled ? 'completed' : task.status
        };
      })
    }));
  };

  // 自定义任务添加
  const handleAddTask = () => {
    if (!newTask.title || !currentSequence) return;
    const task: Task = {
      id: `custom-${Date.now()}`,
      code: 'CUSTOM',
      title: newTask.title,
      description: newTask.description || '（自定义任务）',
      recordPoints: newTask.recordPoints || [],
      status: 'pending' as const,
      illustration: 'M30,30 h20 v20 h-20 z',
      isCustom: true,
      branchCards: []
    };
    updateSequences((seq) =>
      seq.scenarioId === currentSequence.scenarioId
        ? { ...seq, tasks: [...seq.tasks, task] }
        : seq
    );
    setNewTask({ title: '', description: '', recordPoints: [] });
    setShowAddForm(false);
  };

  // AI 扩展任务（调用 DeepSeek 生成高危/关键测试任务）
  const handleAIExpand = async () => {
    if (!currentSequence) return;
    if (!user) {
      alert('请先登录后再使用 AI 扩展任务：点击左侧栏底部的「登录账号」（演示账号 admin@make.com / admin123）。');
      return;
    }
    setIsGenerating(true);
    try {
      const currentTasks = currentSequence.tasks.map((t: Task) => t.title);
      const aiTask = await generateExtendedTask(
        currentSequence.scenarioTitle,
        currentSequence.scenarioDescription,
        currentTasks
      );
      const task: Task = {
        id: `ai-${Date.now()}`,
        code: aiTask.code || 'AI',
        title: aiTask.title || 'AI 扩展任务',
        description: aiTask.description || '',
        recordPoints: (aiTask.recordPoints || []).map((rp: any) => ({
          ...rp,
          value: '',
          editable: true
        })),
        status: 'pending' as const,
        illustration: aiTask.illustration || 'M30,30 h20 v20 h-20 z',
        isCustom: true,
        branchCards: []
      };
      updateSequences((seq) =>
        seq.scenarioId === currentSequence.scenarioId
          ? { ...seq, tasks: [...seq.tasks, task] }
          : seq
      );
    } catch (e: any) {
      alert('AI 扩展失败: ' + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // 事后添加意外分支 SOP 卡片
  const handleAddBranchCard = (taskId: string) => {
    const trigger = window.prompt('意外分支触发条件（例如：击发中卡顿）');
    if (trigger === null) return;
    const action = window.prompt('处理动作（例如：立即停止，电动回刀，查明原因）');
    if (action === null) return;
    if (!trigger.trim() && !action.trim()) return;
    const card: BranchCard = {
      id: `bc-${Date.now()}`,
      trigger: trigger.trim(),
      action: action.trim(),
      recordPoints: []
    };
    updateSequences((seq) => ({
      ...seq,
      tasks: seq.tasks.map((task) =>
        task.id === taskId
          ? { ...task, branchCards: [...(task.branchCards || []), card] }
          : task
      )
    }));
  };

  // 删除意外分支 SOP 卡片
  const handleDeleteBranchCard = (taskId: string, cardId: string) => {
    updateSequences((seq) => ({
      ...seq,
      tasks: seq.tasks.map((task) =>
        task.id === taskId
          ? { ...task, branchCards: (task.branchCards || []).filter((c) => c.id !== cardId) }
          : task
      )
    }));
  };

  // 手部解剖热力图：点击分区 → 记录 0-10 疲劳评分（Borg CR10）
  const handleRegionScore = (regionId: string, score: number) => {
    setRegionScores((prev) => ({ ...prev, [regionId]: score }));
  };

  const handleClearRegion = (regionId: string) => {
    setRegionScores((prev) => {
      const next = { ...prev };
      delete next[regionId];
      return next;
    });
    setRegionNotes((prev) => {
      const next = { ...prev };
      delete next[regionId];
      return next;
    });
  };

  const handleClearAllRegions = () => {
    setRegionScores({});
    setRegionNotes({});
    setSelectedRegion(null);
  };

  // === 手部热力图：存档 + JSON/CSV 本地导出 ===
  const handleArchiveHeatmap = async () => {
    setArchiveSaving(true);
    try {
      const ts = await savePanelState(
        activeProjectId, heatmapNodeId, 'behavior',
        { regionScores, regionNotes },
      );
      setArchiveSavedAt(ts);
    } catch (e: any) {
      alert('存档失败：' + (e?.message || e));
    } finally {
      setArchiveSaving(false);
    }
  };

  // 通用：构造行（手部打分 → 表格）
  const buildHeatmapRows = () => {
    const ts = new Date().toISOString();
    return HAND_REGIONS.map((r) => {
      const score = regionScores[r.id];
      const band = score != null ? getRegionBand(score) : null;
      return {
        region_id: r.id,
        finger: r.finger,
        section: r.section,
        label: r.label,
        score: score ?? '',
        band: band?.label ?? '',
        band_fill: band?.fill ?? '',
        note: regionNotes[r.id] ?? '',
        updated_at: ts,
      };
    });
  };

  const downloadBlob = (filename: string, mime: string, content: string) => {
    const blob = new Blob([content], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 100);
  };

  const handleExportHeatmapJSON = () => {
    if (Object.keys(regionScores).length === 0) {
      alert('暂无评分，先点击手部分区打分吧。'); return;
    }
    const rows = buildHeatmapRows();
    const payload = {
      scenarioId: currentSequence?.scenarioId,
      scenarioTitle: currentSequence?.scenarioTitle,
      archivedAt: archiveSavedAt,
      exportedAt: new Date().toISOString(),
      scale: 'Borg CR10, 5 bands per 2 points',
      scoredCount: Object.keys(regionScores).length,
      totalRegions: HAND_REGIONS.length,
      rows,
    };
    downloadBlob(
      `hand-fatigue-${(currentSequence?.scenarioTitle || 'scenario').replace(/[^\w-]/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json',
      JSON.stringify(payload, null, 2),
    );
  };

  const handleExportHeatmapCSV = () => {
    if (Object.keys(regionScores).length === 0) {
      alert('暂无评分，先点击手部分区打分吧。'); return;
    }
    const rows = buildHeatmapRows();
    const header = ['region_id', 'finger', 'section', 'label', 'score', 'band', 'band_fill', 'note', 'updated_at'];
    const esc = (s: any) => {
      const v = s == null ? '' : String(s);
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    };
    const csv = '\ufeff' + [header.join(','), ...rows.map((r) => header.map((h) => esc((r as any)[h]).replace(/\n/g, '\\n')).join(','))].join('\n');
    downloadBlob(
      `hand-fatigue-${(currentSequence?.scenarioTitle || 'scenario').replace(/[^\w-]/g, '_')}-${new Date().toISOString().slice(0, 10)}.csv`,
      'text/csv',
      csv,
    );
  };

  // ID 模式下即使无场景也可渲染（空态由下方处理）；非 ID 模式且无场景时给引导
  if (!idMode && taskSequences.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">
          <p>请先在情境扩展节点中选择场景</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ID 方案模式徽标 + 切回 SOP（仅当存在方案→行为投递时显示） */}
      {isConnectedToSolution && delivery && (
        <div className="px-4 py-2 bg-node-solution/5 border-b border-node-solution/20 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-node-solution">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="font-medium">ID 外观方案模式</span>
            <span className="text-muted-foreground">· 来自方案节点 {delivery.fromNodeId}</span>
            <span className="text-muted-foreground">
              · {idVariants?.length ?? 0} 个方案{idMode && (!idVariants || idVariants.length === 0) ? '（默认起点）' : ''}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {idMode && (
              <button onClick={refreshIdVariants} className="flex items-center gap-1 text-node-solution hover:underline">
                <RefreshCw className="w-3 h-3" /> 刷新方案
              </button>
            )}
            {idMode ? (
              <button onClick={() => setOverrideSop(true)} className="text-muted-foreground hover:text-foreground underline">
                查看 SOP 场景模式
              </button>
            ) : (
              <button onClick={() => setOverrideSop(false)} className="text-node-solution hover:underline">
                ← 回到 ID 方案模式
              </button>
            )}
          </div>
        </div>
      )}

      {/* ID 模式默认方案提示：方案节点尚未生成时，当前为默认起点 */}
      {idMode && (!idVariants || idVariants.length === 0) && (
        <div className="flex items-start gap-2 px-4 py-2.5 bg-node-solution/10 border-b border-node-solution/20 text-xs text-foreground">
          <Sparkles className="w-3.5 h-3.5 text-node-solution flex-shrink-0 mt-0.5" />
          <span>
            当前为<strong>默认方案起点</strong>（tab「ID 方案 默认」）。在「方案节点」用 Tripo3D 生成 3D 方案后，点顶部「刷新方案」替换为真实方案。
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border bg-muted">
        <div className="flex overflow-x-auto">
          {effectiveSequences.map((seq, index) => (
            <button
              key={seq.scenarioId}
              onClick={() => setActiveTab(index)}
              className={`px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${
                activeTab === index
                  ? 'border-node-behavior text-node-behavior bg-card'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {seq.scenarioTitle}
              {idMode && effectiveVariants && effectiveVariants[index]?.previewUrl && (
                <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-node-context align-middle" title="该方案已生成 3D" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Mobile Test Interface Header */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            <span>现场测试指南 - {currentSequence?.scenarioTitle}</span>
            <button
              onClick={() => {
                if (isRecording && recordingTask === currentSequence?.scenarioId) {
                  stopRecording();
                } else if (currentSequence?.scenarioId) {
                  startRecording(currentSequence.scenarioId);
                }
              }}
              className={`ml-3 flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded transition-all ${
                isRecording && recordingTask === currentSequence?.scenarioId
                  ? 'bg-destructive/10 text-destructive animate-pulse border border-destructive/30 shadow-sm'
                  : 'bg-node-behavior/10 text-node-behavior hover:bg-node-behavior/20'
              }`}
              title="用于实验过程中收集放声思考法(Think-aloud)录音数据"
            >
              {isRecording && recordingTask === currentSequence?.scenarioId ? (
                <><Square className="w-3 h-3 fill-current" /> 停止报告</>
              ) : (
                <><Mic className="w-3 h-3" /> 出声报告</>
              )}
            </button>
          </div>
          <div className="flex gap-2">
             {!user && (
              <span className="flex items-center gap-1 text-[11px] text-node-solution mr-1 px-2 py-1.5">
                <AlertTriangle className="w-3 h-3" /> 未登录
              </span>
             )}
             <button
              onClick={handleCloudSubmit}
              disabled={isUploading || !user}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-node-context/10 text-node-context border border-node-context/20 rounded hover:bg-node-context/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              title={user ? "并发安全上传" : "请先登录"}
            >
              {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CloudUpload className="w-3 h-3" />}
              云端同步
              {cloudCount !== null && (
                <span className="ml-1 bg-node-context/10 text-node-context text-[10px] px-1.5 rounded-full font-medium">
                  {cloudCount}
                </span>
              )}
            </button>
            <div className="h-6 w-px bg-border mx-1"></div>
            <button
              onClick={handleExportVocalReport}
              disabled={recordings.length === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-card text-foreground border border-border rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
              title={recordings.length ? "按账号分组导出出声报告(Word)" : "暂无录音"}
            >
              <FileText className="w-3 h-3" />
              导出出声报告
            </button>
            <button
              onClick={handleExportFullReport}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-node-behavior/10 text-node-behavior border border-node-behavior/20 rounded hover:bg-node-behavior/10"
              title="汇总导出整体测试记录报告(Word)"
            >
              <FileText className="w-3 h-3" />
              导出整体报告
            </button>
          </div>
        </div>

        {/* 出声报告录音：按「账号 + 登录会话」分组，可折叠，支持单条删除 / 整组清空 */}
        {recordings.length > 0 && (() => {
          const groupKey = (r: Recording) => `${r.account || '未登录'}__${r.sessionId || 'default'}`;
          const groups: Record<string, Recording[]> = {};
          recordings.forEach((r) => { (groups[groupKey(r)] ||= []).push(r); });
          const groupList = Object.entries(groups).sort((a, b) => b[1][0].at - a[1][0].at);
          return (
            <div className="mb-3 space-y-2">
              {groupList.map(([key, recs]) => {
                const first = recs[0];
                const collapsed = !!collapsedGroups[key];
                const label = first.account && first.account !== '未登录' ? first.account : '未登录用户';
                const sessionTime = new Date(first.at).toLocaleString();
                return (
                  <div key={key} className="border border-border rounded-lg bg-muted overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted">
                      <button
                        onClick={() => setCollapsedGroups((p) => ({ ...p, [key]: !collapsed }))}
                        className="flex items-center gap-1 text-xs font-medium text-foreground min-w-0"
                      >
                        <span className="shrink-0">{collapsed ? '▶' : '▼'}</span>
                        <span className="truncate">{label}</span>
                        <span className="text-[11px] text-muted-foreground shrink-0">· {sessionTime}</span>
                        <span className="ml-1 text-[11px] text-muted-foreground shrink-0">（{recs.length} 段）</span>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`确认清空该会话的全部 ${recs.length} 段录音？`)) {
                            setRecordings((prev) => prev.filter((r) => groupKey(r) !== key));
                          }
                        }}
                        className="text-[11px] text-destructive hover:underline shrink-0 ml-2"
                      >清空本组</button>
                    </div>
                    {!collapsed && (
                      <div className="p-2 space-y-2">
                        {recs.map((rec, i) => (
                          <div key={rec.id} className="border border-border rounded p-2 bg-card">
                            <div className="flex items-center justify-between mb-1 gap-2">
                              <span className="text-[11px] text-muted-foreground">
                                #{i + 1}
                                {rec.uploading
                                  ? <span className="ml-2 text-node-behavior">上传中…</span>
                                  : rec.localOnly
                                  ? <span className="ml-2 text-node-solution">仅本地</span>
                                  : <span className="ml-2 text-node-context">已存云端</span>}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] text-muted-foreground">{new Date(rec.at).toLocaleTimeString()}</span>
                                <button
                                  onClick={() => setRecordings((prev) => prev.filter((r) => r.id !== rec.id))}
                                  className="text-[11px] text-destructive hover:underline"
                                >删除</button>
                              </div>
                            </div>
                            <audio controls src={rec.url} className="w-full" key={rec.id} />
                            <div className="mt-1 flex items-center gap-2">
                              <a href={rec.url} target="_blank" rel="noreferrer"
                                className="text-[11px] text-node-behavior break-all truncate flex-1">{rec.url}</a>
                              <button onClick={() => navigator.clipboard?.writeText(rec.url)}
                                className="text-[11px] text-muted-foreground hover:text-foreground underline shrink-0">复制</button>
                            </div>
                            {rec.transcribing && (
                              <div className="mt-1 text-[11px] text-node-behavior flex items-center gap-1">
                                <span className="inline-block w-2 h-2 rounded-full bg-node-behavior/100 animate-pulse" />豆包 ASR 转写中…</div>
                            )}
                            {rec.transcript && (
                              <div className="mt-1 p-2 bg-muted border border-border rounded text-[12px] text-foreground leading-relaxed">
                                <span className="text-[11px] text-muted-foreground">转写：</span>{rec.transcript}</div>
                            )}
                            {rec.transcriptError && (
                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-[11px] text-destructive">转写失败：{rec.transcriptError}</span>
                                <button onClick={async () => {
                                  setRecordings((prev) => prev.map((r) => (r.id === rec.id ? { ...r, transcribing: true, transcriptError: undefined } : r)));
                                  try {
                                    const t = await transcribeAudio(rec.url, 'zh-CN');
                                    setRecordings((prev) => prev.map((r) => (r.id === rec.id ? { ...r, transcribing: false, transcript: t } : r)));
                                  } catch (e: any) {
                                    setRecordings((prev) => prev.map((r) => (r.id === rec.id ? { ...r, transcribing: false, transcriptError: e.message } : r)));
                                  }
                                }} className="text-[11px] text-node-behavior hover:underline">重试</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        <div className="flex items-center justify-end gap-2 mb-2">
             <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-card text-foreground border border-border rounded hover:bg-accent"
            >
              <Plus className="w-3 h-3" />
              自定义任务
            </button>
             <button
              onClick={handleAIExpand}
              disabled={isGenerating || !user}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-node-value/10 text-node-value border border-node-value/20 rounded hover:bg-node-value/10 disabled:opacity-50 disabled:cursor-not-allowed"
              title={user ? "调用AI生成高危测试任务" : "请先登录"}
            >
              <Sparkles className="w-3 h-3" />
              {isGenerating ? '生成中...' : 'AI扩展任务'}
            </button>
        </div>

        {/* Add Task Form */}
        {showAddForm && (
          <div className="border border-node-behavior bg-node-behavior/10 rounded-lg p-3 mb-3 animate-in fade-in slide-in-from-top-2">
            <input
              type="text"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="输入任务标题..."
              className="w-full text-sm px-3 py-2 border border-node-behavior/20 rounded mb-2 focus:outline-none focus:border-node-behavior"
              autoFocus
            />
            <textarea
               value={newTask.description}
               onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
               placeholder="任务描述..."
               className="w-full text-xs px-3 py-2 border border-node-behavior/20 rounded mb-2 focus:outline-none focus:border-node-behavior min-h-[60px]"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary rounded"
              >
                取消
              </button>
              <button
                onClick={handleAddTask}
                disabled={!newTask.title}
                className="px-3 py-1.5 text-xs bg-node-behavior text-white rounded hover:bg-node-behavior/80 disabled:opacity-50"
              >
                添加任务
              </button>
            </div>
          </div>
        )}

        {/* T3 智能UI界面 启用开关（ID 模式，每 variant 独立） */}
        {idMode && effectiveVariants && (() => {
          const cur = effectiveVariants[activeTab];
          const sid = cur?.id || `var-${cur?.label}`;
          const on = !!t3Enabled[sid];
          return (
            <div className="flex items-center justify-between px-3 py-2 bg-node-solution/5 border border-node-solution/20 rounded-lg text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-foreground">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 accent-node-solution"
                  checked={on}
                  onChange={() => toggleT3(sid)}
                />
                <Sparkles className="w-3.5 h-3.5 text-node-solution" />
                <span>本方案启用 T3 智能UI界面测试</span>
                <span className="text-muted-foreground">（可选）</span>
              </label>
              <span className="text-muted-foreground">
                {on ? 'T3 已加入任务流' : '仅 T1 基本握持 + T2 精准操作'}
              </span>
            </div>
          );
        })()}

        {/* Task List */}
        <div className="space-y-3">
          <h3 className="text-sm text-foreground">测试任务流</h3>
          {currentSequence?.tasks.map((task) => (
            <div
              key={task.id}
              className={`border rounded-lg p-4 ${
                task.status === 'active' 
                  ? 'border-node-behavior bg-node-behavior/10' 
                  : task.status === 'completed'
                  ? 'border-node-context/20 bg-node-context/10'
                  : 'border-border bg-card'
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                {/* Task Code Badge */}
                <div className={`w-10 h-10 rounded flex items-center justify-center text-xs text-white flex-shrink-0 ${
                  task.status === 'active' ? 'bg-node-behavior' :
                  task.status === 'completed' ? 'bg-node-context' :
                  'bg-secondary'
                }`}>
                  {task.code}
                </div>

                {/* Task Illustration */}
                <div className="w-16 h-16 flex-shrink-0 border border-border rounded bg-card">
                  <svg viewBox="0 0 80 80" className="w-full h-full p-2">
                    <path
                      d={task.illustration}
                      fill="none"
                      stroke={task.status === 'completed' ? '#4ADE80' : '#60A5FA'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                {/* Task Info */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="text-sm text-foreground">{task.title}</h4>
                    <div className="flex items-center gap-2">
                      <div className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wide ${
                        task.status === 'active' ? 'bg-node-behavior/10 text-node-behavior' :
                        task.status === 'completed' ? 'bg-node-context/10 text-node-context' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {task.status === 'active' ? 'Active' : task.status === 'completed' ? 'Done' : 'Pending'}
                      </div>
                    </div>
                  </div>
                  {task.description && task.description.includes('•') ? (
                    <details className="mt-2 group">
                      <summary className="text-[10px] font-medium text-node-behavior cursor-pointer outline-none select-none hover:underline">
                        展开/折叠详细操作步骤
                      </summary>
                      <div className="text-[10px] text-muted-foreground whitespace-pre-line mt-1.5 bg-muted p-2.5 rounded border border-border leading-relaxed">
                        {task.description}
                      </div>
                    </details>
                  ) : (
                    <div className="text-[10px] text-muted-foreground whitespace-pre-line mt-2 bg-muted p-2 rounded border border-border">
                      {task.description}
                    </div>
                  )}
                </div>
              </div>

              {/* Record Points */}
              <div className="pt-3 border-t border-border">
                <div className="text-xs text-muted-foreground mb-2">记录点 (填写完成后自动标记为Done):</div>
                <div className="space-y-2">
                  {task.recordPoints.map((point) => (
                    <div key={point.id} className="flex items-center gap-2">
                      <Circle className="w-2 h-2 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-foreground min-w-[100px]">{point.label}</span>
                      {editingRecordPoint === point.id ? (
                        <div className="flex-1">
                          <div className="flex items-center gap-1">
                            <div className="relative flex-1">
                              <input
                                type="text"
                                value={point.value}
                                onChange={(e) => handleUpdateRecordPoint(task.id, point.id, e.target.value)}
                                className={`w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-node-behavior ${
                                  point.unit ? 'pr-8' : ''
                                }`}
                                placeholder={point.range ? `范围 ${point.range}` : '请输入...'}
                                autoFocus
                                onBlur={() => {
                                  // Small delay to allow save button click
                                  setTimeout(() => setEditingRecordPoint(null), 150);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    setEditingRecordPoint(null);
                                  }
                                }}
                              />
                              {point.unit && (
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                                  {point.unit}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => setEditingRecordPoint(null)}
                              className="p-1 hover:bg-secondary rounded flex-shrink-0"
                            >
                              <Save className="w-3 h-3 text-node-context" />
                            </button>
                          </div>
                          
                          {/* Guidance Panel */}
                          {(point.guidance || point.range || point.risk) && (
                            <div className="mt-2 p-2 bg-node-behavior/10 border border-blue-100 rounded text-[10px] space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                              <div className="flex gap-4">
                                {point.range && (
                                  <span className="text-muted-foreground">
                                    范围: <span className="font-medium text-foreground">{point.range} {point.unit}</span>
                                  </span>
                                )}
                                {point.recommended && (
                                  <span className="text-node-behavior font-medium">
                                    推荐: {point.recommended} {point.unit}
                                  </span>
                                )}
                              </div>
                              {point.guidance && (
                                <div className="text-muted-foreground leading-tight">
                                  💡 {point.guidance}
                                </div>
                              )}
                              {point.risk && (
                                <div className="text-node-solution leading-tight flex items-start gap-1">
                                  <span>⚠️</span>
                                  <span>{point.risk}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div 
                          className="flex items-center gap-2 flex-1 cursor-pointer hover:bg-accent px-2 py-1 rounded group transition-colors"
                          onClick={() => setEditingRecordPoint(point.id)}
                        >
                          <span className={`text-xs flex-1 ${point.value ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                            {point.value ? (
                              <span>
                                {point.value} <span className="text-muted-foreground text-[10px]">{point.unit}</span>
                              </span>
                            ) : (
                              '点击填写...'
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Branch Cards (意外分支 SOP 可事后添加补充记录) */}
              <div className="pt-3 border-t border-border mt-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-node-solution" />
                  <span className="text-xs text-foreground font-medium">异常分支 SOP 卡片</span>
                </div>
                {task.branchCards && task.branchCards.length > 0 ? (
                  <div className="space-y-2">
                    {task.branchCards.map((card) => (
                      <div key={card.id} className="border border-node-solution/20 bg-node-solution/10 rounded p-2.5 group">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 text-[11px]">
                            <div className="text-node-solution font-medium">触发：{card.trigger}</div>
                            <div className="text-muted-foreground mt-0.5">处理：{card.action}</div>
                          </div>
                          <button
                            onClick={() => handleDeleteBranchCard(task.id, card.id)}
                            className="p-1 hover:bg-node-solution/10 rounded flex-shrink-0"
                            title="删除该分支卡片"
                          >
                            <Trash2 className="w-3 h-3 text-node-solution" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-muted-foreground mb-2">暂无异常分支卡片</div>
                )}
                <button
                  onClick={() => handleAddBranchCard(task.id)}
                  className="mt-2 flex items-center gap-1 px-2.5 py-1.5 text-[11px] bg-node-solution/10 text-node-solution border border-node-solution/20 rounded hover:bg-node-solution/10 w-full justify-center"
                >
                  <Plus className="w-3 h-3" />
                  添加意外分支 SOP 卡片
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Hand Anatomy Heatmap — 23 个解剖分区，Borg CR10（每 2 分一档共 5 档）轮廓内直涂 */}
        <div className="border border-border rounded-lg p-4 bg-background">
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-sm text-foreground whitespace-nowrap">手部解剖热力图 · 疲劳评分</h3>
              <span className="text-[10px] text-muted-foreground">
                {Object.keys(regionScores).length} / {HAND_REGIONS.length} 已评
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px]">
              <span className="text-muted-foreground hidden sm:inline-flex items-center gap-1" title={archiveSavedAt ? `云端存档：${new Date(archiveSavedAt).toLocaleString('zh-CN', { hour12: false })}` : '云端尚未存档'}>
                <Cloud className="w-3 h-3" />
                {archiveSavedAt
                  ? new Date(archiveSavedAt).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).slice(2)
                  : '未存档'}
              </span>
              <button
                onClick={handleArchiveHeatmap}
                disabled={archiveSaving || Object.keys(regionScores).length === 0}
                className="flex items-center gap-1 px-2 py-1 rounded bg-node-behavior text-white hover:opacity-90 disabled:opacity-40 transition-all"
                title="把当前 23 区评分同步到云端（panel_archive 表），刷新页面不丢"
              >
                {archiveSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                存档
              </button>
              <button
                onClick={handleExportHeatmapJSON}
                disabled={Object.keys(regionScores).length === 0}
                className="flex items-center gap-1 px-2 py-1 rounded border border-border text-foreground hover:bg-accent disabled:opacity-40 transition-all"
                title="导出 JSON（含全部元数据，研究分析用）"
              >
                <FileJson className="w-3 h-3" />JSON
              </button>
              <button
                onClick={handleExportHeatmapCSV}
                disabled={Object.keys(regionScores).length === 0}
                className="flex items-center gap-1 px-2 py-1 rounded border border-border text-foreground hover:bg-accent disabled:opacity-40 transition-all"
                title="导出 CSV（直接进 Excel / SPSS）"
              >
                <FileSpreadsheet className="w-3 h-3" />CSV
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            点击任意解剖分区（a-v 共 23 区，指关节 / 掌部 / 大鱼际 / 小鱼际），按 0(无疲劳) — 10(极度疲劳) 评分。
            <span className="text-foreground/80">色阶：每 2 分一档，共 5 档（极轻 / 轻度 / 中度 / 较重 / 极重），直接在对应区域的轮廓内部直涂。</span>
          </p>

          {/* 5 档色阶图例（深底+彩徽，保证可读性） */}
          <div className="flex flex-wrap items-center gap-1 mb-3 text-[10px]">
            {SCORE_BAND.map((b) => (
              <span
                key={b.label}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 text-white font-medium"
                title={`${b.range[0]}–${b.range[1] === 11 ? 10 : b.range[1] - 1} 分 · ${b.label}`}
              >
                <span className="inline-block w-2.5 h-2.5 rounded-sm shadow" style={{ backgroundColor: b.fill }} />
                {b.range[0]}–{b.range[1] === 11 ? 10 : b.range[1] - 1}
                <span className="opacity-70 font-normal">{b.label}</span>
              </span>
            ))}
          </div>

          <div className="relative w-full max-w-[280px] mx-auto aspect-[582/720]">
            <img
              src="/hand-anatomy.png"
              alt="手部解剖分区图"
              className="absolute inset-0 w-full h-full select-none pointer-events-none"
              draggable={false}
            />
            <svg
              viewBox="0 0 582 720"
              className="absolute inset-0 w-full h-full"
              onClick={() => setSelectedRegion(null)}
            >
              {HAND_REGIONS.map((region) => {
                const score = regionScores[region.id];
                const band = score != null ? getRegionBand(score) : null;
                const fill = band?.fill ?? 'transparent';
                const text = band?.text ?? '#F5F5F7';
                const isSelected = selectedRegion === region.id;
                return (
                  <g key={region.id}>
                    {/* 选中区域：双层描边（外光晕 + 内实线） */}
                    {isSelected && (
                      <polygon
                        points={region.points}
                        fill="none"
                        stroke="#FB923C"
                        strokeOpacity={0.45}
                        strokeWidth={8}
                        className="pointer-events-none"
                      />
                    )}
                    <polygon
                      points={region.points}
                      fill={fill}
                      fillOpacity={score != null ? 0.85 : 0}
                      stroke={isSelected ? '#FB923C' : 'transparent'}
                      strokeWidth={isSelected ? 2.5 : 0}
                      className="cursor-pointer transition-all hover:fill-opacity-90"
                      style={{ filter: isSelected ? 'drop-shadow(0 0 4px rgba(251,146,60,0.6))' : undefined }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRegion(region.id);
                      }}
                    />
                    {score != null && (
                      <text
                        x={region.centerX}
                        y={region.centerY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="pointer-events-none select-none"
                        fontSize="13"
                        fontWeight="800"
                        fill="#FFFFFF"
                        stroke="#0F172A"
                        strokeOpacity={0.9}
                        strokeWidth={2.5}
                        paintOrder="stroke"
                      >
                        {score}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* 浮动评分框：精准锚定到选中 polygon，自适应上下左右 */}
            {selectedRegion && (() => {
              const reg = HAND_REGIONS.find((r) => r.id === selectedRegion);
              if (!reg) return null;
              const score = regionScores[reg.id];
              const band = score != null ? getRegionBand(score) : null;
              // 横向：右半区往左弹，左半区往右弹；纵向：上半区往下弹，下半区往上弹
              const isRight = reg.centerX > 582 / 2;
              const isTop = reg.centerY < 720 / 3;
              const leftPct = (reg.centerX / 582) * 100;
              const topPct = (reg.centerY / 720) * 100;
              const dx = isRight ? 'calc(-100% - 10px)' : '10px';
              const dy = isTop ? '8px' : 'calc(-100% - 10px)';
              return (
                <div
                  className="absolute z-20 w-[230px] rounded-lg shadow-2xl border-2 bg-white"
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    transform: `translate(${dx}, ${dy})`,
                    borderColor: band?.fill ?? '#FB923C',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className="px-3 py-2 rounded-t-md flex items-center justify-between"
                    style={{
                      backgroundColor: band?.fill ?? '#0F172A',
                      color: '#FFFFFF',
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-white/25 text-current text-xs font-black shrink-0">
                        {reg.id}
                      </span>
                      <span className="text-sm font-bold truncate" title={reg.label}>{reg.label}</span>
                    </div>
                    <button
                      onClick={() => setSelectedRegion(null)}
                      className="text-white/80 hover:text-white text-xs leading-none"
                      aria-label="关闭"
                    >✕</button>
                  </div>

                  <div className="px-3 py-2">
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-[11px] text-muted-foreground">Borg CR10</span>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-black tabular-nums text-slate-900 leading-none">
                          {score != null ? score : '—'}
                        </span>
                        {band && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold"
                          >
                            <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: band.fill }} />
                            {band.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-11 gap-0.5 mb-1.5">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                        const b = getRegionBand(n);
                        const active = score === n;
                        return (
                          <button
                            key={n}
                            onClick={() => handleRegionScore(selectedRegion!, n)}
                            className={`py-1 text-[10px] rounded border tabular-nums font-bold transition-all ${
                              active
                                ? 'border-slate-900 text-white bg-slate-900 shadow ring-2 ring-slate-900/30 scale-110'
                                : 'border-border text-slate-900 bg-white hover:scale-105 hover:border-slate-900'
                            }`}
                            style={active ? { boxShadow: `0 0 0 2px ${b.fill}` } : undefined}
                            title={`${n} 分 · ${b.label}`}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                      <span>0=无疲劳</span>
                      <span>5=中等</span>
                      <span>10=极度</span>
                    </div>
                    {(regionScores[selectedRegion] != null || regionNotes[selectedRegion]) && (
                      <button
                        onClick={() => handleClearRegion(selectedRegion!)}
                        className="mt-2 w-full py-1 text-[10px] text-muted-foreground hover:text-destructive border border-border rounded hover:border-destructive/30"
                      >
                        清除该区域评分
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 评分汇总表（默认折叠，summary 一行展示） */}
          {(() => {
            const entries = HAND_REGIONS.filter(r => regionScores[r.id] != null);
            const scoredCount = entries.length;
            const avg = scoredCount > 0
              ? (entries.reduce((s, r) => s + (regionScores[r.id] || 0), 0) / scoredCount).toFixed(2)
              : '0';
            const heavyCount = entries.filter(r => (regionScores[r.id] ?? 0) >= 6).length;
            const lightCount = entries.filter(r => (regionScores[r.id] ?? 0) <= 2).length;
            return scoredCount > 0 ? (
              <div className="mt-3 border border-border rounded overflow-hidden text-xs">
                <button
                  onClick={() => setScoredListOpen(o => !o)}
                  className="w-full flex items-center justify-between px-3 py-1.5 bg-muted hover:bg-accent transition"
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-medium text-foreground">已评分汇总</span>
                    <span className="text-muted-foreground tabular-nums">{scoredCount} / {HAND_REGIONS.length}</span>
                    <span className="text-muted-foreground">· 均分 <strong className="text-foreground tabular-nums">{avg}</strong></span>
                    <span className="text-muted-foreground">· 极重 <strong className="text-destructive tabular-nums">{heavyCount}</strong></span>
                    <span className="text-muted-foreground">· 极轻 <strong className="text-node-context tabular-nums">{lightCount}</strong></span>
                  </div>
                  {scoredListOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {scoredListOpen && (
                  <div className="p-2 bg-background border-t border-border">
                    <div className="flex flex-wrap gap-1 mb-2">
                      {entries.map(r => {
                        const b = getRegionBand(regionScores[r.id]);
                        return (
                          <span
                            key={r.id}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10px]"
                          >
                            <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: b.fill }} />
                            <strong>{r.id}</strong>
                            <span className="tabular-nums font-bold">{regionScores[r.id]}</span>
                            <span className="opacity-70 font-normal">{b.label}</span>
                          </span>
                        );
                      })}
                    </div>
                    <button
                      onClick={handleClearAllRegions}
                      className="w-full py-1 text-[10px] text-muted-foreground hover:text-destructive border border-border rounded hover:border-destructive/30"
                    >
                      清除全部评分
                    </button>
                  </div>
                )}
              </div>
            ) : null;
          })()}
        </div>
      </div>
    </div>
  );
}
