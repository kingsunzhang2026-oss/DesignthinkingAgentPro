import React, { useState, useEffect } from 'react';
import { Smartphone, Circle, Save, Plus, Trash2, Sparkles, AlertTriangle, FileText, CloudUpload, Download, Users, Loader2 } from 'lucide-react';
import { ScenarioData, TaskSequence, Task, RecordPoint } from '../../App';
import { generateExtendedTask } from '../../services/aiScenarios';
import { supabase } from '../../utils/supabase/client';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { usePanelArchive } from '../../services/panelArchive';
import { ArchiveButton } from '../ArchiveButton';

interface BehaviorPanelProps {
  scenarios: ScenarioData[];
  onTaskStatsChange: (callback: (prev: any) => any) => void;
  taskSequences: TaskSequence[];
  onTaskSequencesChange: (sequences: TaskSequence[]) => void;
}

export function BehaviorPanel({ 
  scenarios, 
  onTaskStatsChange,
  taskSequences,
  onTaskSequencesChange
}: BehaviorPanelProps) {
  const [activeTab, setActiveTab] = useState(0);
  // taskSequences state is now managed by parent
  const [editingRecordPoint, setEditingRecordPoint] = useState<string | null>(null);

  // 22 个手部分区打分 (a-v) —— 接入 node_panel_data 存档（按当前激活的 scenarioId 分存档）
  const currentSequence = taskSequences[activeTab];
  const behaviorNodeId = currentSequence
    ? `behavior-${currentSequence.scenarioId}`
    : 'behavior-default';
  const {
    save: saveRegionScores,
    saving: savingArchive,
    lastSavedAt: regionArchivedAt,
    data: archivedRegionScores,
    loading: loadingArchive,
  } = usePanelArchive<Record<string, number>>({
    projectId: 'default',
    nodeId: behaviorNodeId,
    panelType: 'behavior',
    initial: {},
  });

  const [regionScores, setRegionScores] = useState<Record<string, number>>({});

  // 加载到的存档回填到本地 state
  useEffect(() => {
    if (!loadingArchive && archivedRegionScores && Object.keys(archivedRegionScores).length > 0) {
      setRegionScores(archivedRegionScores);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivedRegionScores, loadingArchive]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  
  // New State for Task Management
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: '',
    description: '',
    recordPoints: []
  });

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
    // Standard scenario tasks
    if (scenario.id === 'standard') {
      return [
        {
          id: 't1-standard',
          code: 'T1',
          title: '基础握持测试',
          description: '评估标准握持姿势的人机工效（参考 GB 10000/GB/T 14775）',
          illustration: 'M10,40 L30,20 L50,40 L30,60 Z', // Diamond shape - hand grip
          recordPoints: [
            { 
              id: 'rp1', 
              label: '手柄握持直径', 
              value: '', 
              editable: true,
              unit: 'mm',
              range: '15-35',
              recommended: '20-30',
              guidance: 'GB 10000 成年人手部尺寸推荐值 20-30mm',
              risk: '<15mm导致局部压强过大，>35mm导致无法完全握持增加疲劳'
            },
            { 
              id: 'rp2', 
              label: '操纵力 (指尖)', 
              value: '', 
              editable: true,
              unit: 'N',
              range: '1-20',
              recommended: '<10',
              guidance: '估算参考：轻松(握笔)≈5-10N；中等(握门把)≈15-25N；用力(拧瓶盖)≈30+N。GB/T 14775 频繁操作建议<10N。',
              risk: '>20N 易导致手指疲劳或操作失误'
            }
          ],
          status: 'pending'
        },
        {
          id: 't2-standard',
          code: 'T2',
          title: '精准操作测试',
          description: '评估细微动作控制能力',
          illustration: 'M30,15 L30,65 M15,40 L45,40', // Crosshair - precision
          recordPoints: [
            { 
              id: 'rp3', 
              label: '操作精度', 
              value: '', 
              editable: true,
              unit: 'mm',
              range: '0.1-1.0',
              recommended: '<0.5',
              guidance: '输入值时确保<0.5mm，避免精度误差导致医疗实验失败',
              risk: '>1.0mm可能引起误操作，增加实验风险'
            },
            { 
              id: 'rp4', 
              label: '精细旋钮直径', 
              value: '', 
              editable: true,
              unit: 'mm',
              range: '10-25',
              recommended: '15-20',
              guidance: '指尖捏持旋钮建议直径 10-25mm',
              risk: '尺寸不当将降低精细调节的准确性'
            }
          ],
          status: 'pending'
        }
      ];
    }
    
    // Fatigue scenario tasks
    if (scenario.id === 'fatigue') {
      return [
        {
          id: 't1-fatigue',
          code: 'T1',
          title: '长时握持耐力测试',
          description: '连续握持 3-12 小时后的性能评估（模拟长台手术）',
          illustration: 'M20,20 Q30,10 40,20 T60,20', // Wavy line - fatigue
          recordPoints: [
            { 
              id: 'rp5', 
              label: '主观疲劳度 (RPE)', 
              value: '', 
              editable: true, 
              unit: '级',
              range: '1-10',
              recommended: '<4',
              guidance: 'Borg量表：1(极轻松)-10(力竭)。12小时测试建议每小时记录。',
              risk: '>6 表示过高负荷，需强制休息，避免肌肉损伤'
            },
            { 
              id: 'rp6', 
              label: '手部震颤幅值', 
              value: '', 
              editable: true, 
              unit: 'mm',
              range: '0-5',
              recommended: '<0.5',
              guidance: '测量指尖在静止状态下的位移幅值（医疗操作扩展指标）',
              risk: '>1.0mm 严重影响显微手术精度，实验需终止'
            },
            {
              id: 'rp6-b',
              label: '握力衰减率',
              value: '',
              editable: true,
              unit: '%',
              range: '0-100',
              recommended: '<15',
              guidance: '操作前后最大握力变化',
              risk: '>20% 肌肉明显疲劳'
            }
          ],
          status: 'pending'
        },
        {
          id: 't2-fatigue',
          code: 'T2',
          title: '动态锁止耐力',
          description: '疲劳状态下的棘齿反馈评估',
          illustration: 'M20,30 L25,25 L30,35 L35,25 L40,35 L45,25 L50,30', // Zigzag - repeated action
          recordPoints: [
            { 
              id: 'rp7', 
              label: '反馈力矩', 
              value: '', 
              editable: true, 
              unit: 'N·m',
              range: '0.1-2.0',
              recommended: '0.2-0.8',
              guidance: 'GB/T 14775：触觉反馈需清晰。疲劳状态下需更明确的反馈。',
              risk: '<0.15N·m 疲劳时无法感知锁止，导致误操作'
            },
            { id: 'rp8', label: '锁止确定性', value: '', editable: true, guidance: '记录是否发生假锁止（是/否）' }
          ],
          status: 'pending'
        },
        {
          id: 't3-fatigue',
          code: 'T3',
          title: '精度退化测试',
          description: '疲劳后操作精度变化',
          illustration: 'M30,15 A15,15 0 1,1 30,65 A15,15 0 1,1 30,15', // Circle - target
          recordPoints: [
            { 
              id: 'rp10', 
              label: '精度误差变化', 
              value: '', 
              editable: true, 
              unit: '%', 
              guidance: '(疲劳后误差 - 初始误差) / 初始误差' 
            },
            { 
              id: 'rp11', 
              label: '误操作次数', 
              value: '', 
              editable: true,
              unit: '次',
              range: '0-10',
              recommended: '0',
              risk: '>1次需评估设计安全性'
            }
          ],
          status: 'pending'
        }
      ];
    }
    
    // Extreme environment scenario tasks
    if (scenario.id === 'extreme') {
      return [
        {
          id: 't1-extreme',
          code: 'T1',
          title: '湿手/污染握持',
          description: '模拟血液/生理盐水污染后的防滑性能',
          illustration: 'M20,40 Q25,30 30,40 Q35,50 40,40 Q45,30 50,40', // Water drops
          recordPoints: [
            { 
              id: 'rp12', 
              label: '最大滑移距离', 
              value: '', 
              editable: true, 
              unit: 'mm',
              range: '0-20', 
              recommended: '<2',
              guidance: '施加额定操作力时的手部相对位移',
              risk: '>5mm 导致失控风险，需改进表面纹理'
            },
            { 
              id: 'rp13', 
              label: '抓握力增加比例', 
              value: '', 
              editable: true, 
              unit: '%',
              range: '0-100',
              recommended: '<20',
              guidance: '防滑设计不足会导致用户不自觉增加握力',
              risk: '>30% 加速疲劳'
            }
          ],
          status: 'pending'
        },
        {
          id: 't2-extreme',
          code: 'T2',
          title: '环境干扰压力测试',
          description: '高温(32°C)/低光(50Lux)/噪声(65dB)环境适应性',
          illustration: 'M20,40 L30,35 L40,45 L50,40 L60,35', // Slide pattern
          recordPoints: [
            { 
              id: 'rp14', 
              label: '环境光照度', 
              value: '', 
              editable: true, 
              unit: 'Lux',
              range: '50-500',
              recommended: '150-300',
              guidance: '估算参考：正常办公室≈300-500 Lux；黄昏/路灯下≈50 Lux (阅读困难)。手机相机自动模式曝光时间长=光弱。',
              risk: '<50 Lux 极易导致视觉误差；<100 Lux 需辅助照明'
            },
            { 
              id: 'rp15', 
              label: '环境温度', 
              value: '', 
              editable: true,
              unit: '°C',
              range: '20-40',
              recommended: '22-26',
              guidance: '填写 30-35°C 模拟穿戴防护服后的体感温度。',
              risk: '>32°C 引起手部出汗，影响握持稳定性'
            },
             { 
              id: 'rp15-b', 
              label: '噪声干扰级', 
              value: '', 
              editable: true,
              unit: 'dB',
              range: '40-90',
              recommended: '<60',
              guidance: '估算参考：正常谈话≈60dB；繁忙办公室/空调风扇声≈65dB；吸尘器≈75dB。',
              risk: '>65dB 分散注意力，增加认知负荷'
            }
          ],
          status: 'pending'
        },
        {
          id: 't3-extreme',
          code: 'T3',
          title: '极限角度操作',
          description: '受限空间下的手腕极限操作（GB 10000 关节活动度）',
          illustration: 'M30,30 Q40,20 50,30 Q40,40 30,30', // Rotation arrow
          recordPoints: [
            { 
              id: 'rp16', 
              label: '手腕尺/桡偏角', 
              value: '', 
              editable: true,
              unit: '°',
              range: '0-50',
              recommended: '<25',
              guidance: '尺偏最大30°/桡偏最大20° (GB 10000)',
              risk: '>30° 长期操作导致腕管综合征风险'
            },
            { 
              id: 'rp17', 
              label: '操作准确率', 
              value: '', 
              editable: true,
              unit: '%',
              range: '0-100',
              recommended: '>95',
              risk: '<90% 需调整器械手柄角度'
            }
          ],
          status: 'pending'
        }
      ];
    }
    
    // Default tasks for custom scenarios (including AI generated ones)
    return [
      {
        id: `t1-${scenario.id}`,
        code: 'T1',
        title: '场景适应性操作测试',
        description: '评估该长尾场景下的基本操作与人机工效',
        illustration: 'M25,25 L35,25 L35,55 L25,55 Z', // Simple square
        recordPoints: [
          { 
            id: `rp-${scenario.id}-1`, 
            label: '操作顺畅度', 
            value: '', 
            editable: true,
            unit: '分',
            range: '1-10',
            recommended: '>8',
            guidance: '主观评分：1(极卡顿)-10(极顺畅)。请重点关注摩擦力/光照/阻力对操作的影响。',
            risk: '<6 分表明场景对操作有严重干扰'
          },
          { 
            id: `rp-${scenario.id}-2`, 
            label: '用户反馈/观察', 
            value: '', 
            editable: true,
            guidance: '请记录操作者的口语反馈或异常行为（如皱眉、调整姿态等）。'
          },
          {
            id: `rp-${scenario.id}-3`,
            label: '场景关键参数测量',
            value: '',
            editable: true,
            unit: '自定义',
            guidance: '请根据场景特性记录关键环境或生理参数（如Lux, dB, BPM等）。'
          }
        ],
        status: 'pending'
      }
    ];
  };

  const handleAddTask = () => {
    if (!newTask.title) return;
    
    const seqIndex = activeTab;
    // Don't modify state directly
    const newSequences = [...taskSequences];
    
    // Create standard medical record points for custom task
    const standardPoints: RecordPoint[] = [
      {
        id: `rp-custom-${Date.now()}-1`,
        label: '操作力/力矩',
        value: '',
        editable: true,
        unit: 'N/N·m',
        guidance: '请参考GB/T 14775填写',
        recommended: '<10N'
      },
      {
        id: `rp-custom-${Date.now()}-2`,
        label: '操作精度/误差',
        value: '',
        editable: true,
        unit: 'mm/%',
        range: 'Min-Max',
        risk: '请填写偏离预期的风险'
      }
    ];

    const taskToAdd: Task = {
      id: `custom-${Date.now()}`,
      code: 'CX',
      title: newTask.title || '自定义任务',
      description: newTask.description || '用户自定义测试任务',
      recordPoints: standardPoints,
      status: 'pending',
      illustration: 'M20,20 L60,20 L60,60 L20,60 Z', // Box
      isCustom: true
    };

    newSequences[seqIndex].tasks.push(taskToAdd);
    onTaskSequencesChange(newSequences);
    
    // Reset form
    setNewTask({ title: '', description: '', recordPoints: [] });
    setShowAddForm(false);
  };

  const handleDeleteTask = (taskId: string) => {
    if (!window.confirm('确认删除此测试任务吗？')) return;
    
    const newSequences = [...taskSequences];
    newSequences[activeTab].tasks = newSequences[activeTab].tasks.filter(t => t.id !== taskId);
    onTaskSequencesChange(newSequences);
  };

  const handleAIExpand = async () => {
    const currentSeq = taskSequences[activeTab];
    setIsGenerating(true);
    try {
      const taskTitles = currentSeq.tasks.map(t => t.title);
      const aiTaskData = await generateExtendedTask(
        currentSeq.scenarioTitle,
        currentSeq.scenarioDescription,
        taskTitles
      );
      
      const aiTask: Task = {
        id: `ai-ext-${Date.now()}`,
        code: aiTaskData.code || 'AI',
        title: aiTaskData.title,
        description: aiTaskData.description,
        illustration: aiTaskData.illustration || 'M40,40 m-20,0 a20,20 0 1,0 40,0 a20,20 0 1,0 -40,0',
        recordPoints: aiTaskData.recordPoints || [],
        status: 'pending',
        isCustom: true
      };

      const newSequences = [...taskSequences];
      newSequences[activeTab].tasks.push(aiTask);
      onTaskSequencesChange(newSequences);
    } catch (error) {
      alert('AI扩展任务失败，请检查网络或Key配置');
    } finally {
      setIsGenerating(false);
    }
  };

  // 22 个手部分区 (a-v，按原图位置排布；viewBox 0 0 1139 896)
  const HAND_REGIONS: { id: string; label: string; cx: number; cy: number; polygon: string; desc: string }[] = [
    { id: 'v',  label: '拇指尖',      cx: 145, cy: 470, polygon: '95,380 200,400 200,540 95,540',     desc: '拇指远端' },
    { id: 'u',  label: '拇指中段',    cx: 200, cy: 470, polygon: '160,400 245,420 245,530 160,520', desc: '拇指中段（腕掌关节附近）' },
    { id: 't',  label: '大鱼际',      cx: 345, cy: 530, polygon: '275,460 415,470 415,590 275,585', desc: '拇指根部掌侧肌肉群' },
    { id: 'c',  label: '食指指尖',    cx: 540, cy: 105, polygon: '510,55 575,75 575,150 505,140',   desc: '食指远端' },
    { id: 'd',  label: '食指第一节',  cx: 540, cy: 195, polygon: '505,150 575,180 565,240 505,225', desc: '食指第一指节' },
    { id: 'h',  label: '食指第二节',  cx: 540, cy: 280, polygon: '505,235 575,250 575,320 505,320', desc: '食指第二指节' },
    { id: 'l',  label: '食指根部',    cx: 540, cy: 360, polygon: '505,320 580,335 575,395 505,395', desc: '食指掌指关节' },
    { id: 'p',  label: '食指根部(小鱼际侧)', cx: 525, cy: 425, polygon: '470,380 580,400 580,460 470,460', desc: '食指根部小鱼际侧' },
    { id: 'b',  label: '中指指尖',    cx: 650, cy: 105, polygon: '625,55 685,75 685,150 620,140',   desc: '中指远端' },
    { id: 'f',  label: '中指第一节',  cx: 650, cy: 195, polygon: '620,150 690,170 690,225 620,225', desc: '中指第一指节' },
    { id: 'g1', label: '中指第二节',  cx: 650, cy: 280, polygon: '620,225 690,240 690,320 620,320', desc: '中指第二指节（上方g）' },
    { id: 'k',  label: '中指根部',    cx: 660, cy: 360, polygon: '620,320 705,330 700,395 620,395', desc: '中指掌指关节' },
    { id: 's',  label: '中指根部(掌心侧)', cx: 625, cy: 435, polygon: '545,400 705,420 705,470 545,470', desc: '中指根部掌侧' },
    { id: 'o',  label: '无名/中指连接', cx: 650, cy: 365, polygon: '595,335 705,345 700,395 595,395', desc: '无名指与中指根连接处' },
    { id: 'g2', label: '无名指第一节',cx: 740, cy: 195, polygon: '685,225 800,240 800,320 685,320', desc: '无名指第一/二节相邻区（下方g）' },
    { id: 'n',  label: '无名指根部',  cx: 750, cy: 360, polygon: '700,330 805,345 805,395 700,395', desc: '无名指掌指关节' },
    { id: 'm',  label: '无名/小指根', cx: 910, cy: 360, polygon: '870,320 955,335 955,395 870,395', desc: '无名指与小指根连接处' },
    { id: 'a',  label: '小指指尖',    cx: 900, cy: 105, polygon: '875,55 935,75 935,150 870,140',   desc: '小指远端' },
    { id: 'e',  label: '小指第一节',  cx: 900, cy: 195, polygon: '870,150 940,170 940,225 870,225', desc: '小指第一指节' },
    { id: 'i',  label: '小指第二节',  cx: 905, cy: 280, polygon: '870,225 945,240 945,320 870,320', desc: '小指第二指节' },
    { id: 'q',  label: '小指根(小鱼际)', cx: 830, cy: 435, polygon: '740,395 925,415 925,470 740,470', desc: '小指根部小鱼际' },
    { id: 'r',  label: '掌心中央',    cx: 600, cy: 530, polygon: '430,470 770,490 770,580 430,580', desc: '掌心中央' },
  ];

  // 0-10 打分 → 颜色（0 透明，10 深红；蓝→黄→红渐变）
  const scoreColor = (s: number) => {
    if (s <= 0) return 'rgba(255,255,255,0)';
    const t = Math.min(1, s / 10);
    let r: number, g: number, b: number;
    if (t < 0.5) {
      const u = t / 0.5;
      r = Math.round(0 + 255 * u);
      g = Math.round(120 + (200 - 120) * u);
      b = Math.round(255 + (0 - 255) * u);
    } else {
      const u = (t - 0.5) / 0.5;
      r = Math.round(255 + (220 - 255) * u);
      g = Math.round(200 + (40 - 200) * u);
      b = Math.round(0 + 40 * u);
    }
    return `rgba(${r},${g},${b},${0.35 + t * 0.4})`;
  };

  const handleRegionClick = (id: string) => setSelectedRegion(id);
  const handleRegionScore = (id: string, score: number) =>
    setRegionScores((prev) => ({ ...prev, [id]: score }));

  const handleUpdateRecordPoint = (taskId: string, recordPointId: string, value: string) => {
    onTaskSequencesChange(taskSequences.map((seq, idx) => 
      idx === activeTab ? {
        ...seq,
        tasks: seq.tasks.map(task => {
          if (task.id === taskId) {
            const updatedTask = {
              ...task,
              recordPoints: task.recordPoints.map(rp =>
                rp.id === recordPointId ? { ...rp, value } : rp
              )
            };
            // Check if all record points are filled
            const allFilled = updatedTask.recordPoints.every(rp => rp.value.trim() !== '');
            if (allFilled && updatedTask.status === 'pending') {
              updatedTask.status = 'completed';
            }
            return updatedTask;
          }
          return task;
        })
      } : seq
    ));
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
        alert('请先登录以保存数据');
        setIsUploading(false);
        return;
      }

      // Prepare payload with ALL sequences
      const payload = {
        access_token: session.access_token,
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
                access_token: session.access_token
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
                access_token: session.access_token
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

  if (taskSequences.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-500">
          <p>请先在情境扩展节点中选择场景</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="flex overflow-x-auto">
          {taskSequences.map((seq, index) => (
            <button
              key={seq.scenarioId}
              onClick={() => setActiveTab(index)}
              className={`px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${
                activeTab === index
                  ? 'border-[#007AFF] text-[#007AFF] bg-white'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {seq.scenarioTitle}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Mobile Test Interface Header */}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            <span>现场测试指南 - {currentSequence?.scenarioTitle}</span>
          </div>
          <div className="flex gap-2">
             <button
              onClick={handleCloudSubmit}
              disabled={isUploading}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 disabled:opacity-50 transition-all"
              title="并发安全上传"
            >
              {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CloudUpload className="w-3 h-3" />}
              云端同步
              {cloudCount !== null && (
                <span className="ml-1 bg-green-200 text-green-800 text-[10px] px-1.5 rounded-full font-medium">
                  {cloudCount}
                </span>
              )}
            </button>
            <div className="h-6 w-px bg-gray-300 mx-1"></div>
            <button
              onClick={handleExportMyRecords}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs bg-white text-gray-700 border border-gray-200 rounded hover:bg-gray-50 ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={user ? "下载我的记录 (JSON)" : "请先登录"}
              disabled={!user}
            >
              <Download className="w-3 h-3" />
              导出个人
            </button>
            
            {user?.email === 'admin@make.com' && (
              <button
                onClick={handleExportAllRecords}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100"
                title="管理员：批量导出所有被试数据"
              >
                <Users className="w-3 h-3" />
                导出全员
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mb-2">
             <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white text-gray-700 border border-gray-200 rounded hover:bg-gray-50"
            >
              <Plus className="w-3 h-3" />
              自定义任务
            </button>
             <button
              onClick={handleAIExpand}
              disabled={isGenerating}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100 disabled:opacity-50"
            >
              <Sparkles className="w-3 h-3" />
              {isGenerating ? '生成中...' : 'AI扩展任务'}
            </button>
        </div>

        {/* Add Task Form */}
        {showAddForm && (
          <div className="border border-[#007AFF] bg-blue-50/50 rounded-lg p-3 mb-3 animate-in fade-in slide-in-from-top-2">
            <input
              type="text"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="输入任务标题..."
              className="w-full text-sm px-3 py-2 border border-blue-200 rounded mb-2 focus:outline-none focus:border-[#007AFF]"
              autoFocus
            />
            <textarea
               value={newTask.description}
               onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
               placeholder="任务描述..."
               className="w-full text-xs px-3 py-2 border border-blue-200 rounded mb-2 focus:outline-none focus:border-[#007AFF] min-h-[60px]"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded"
              >
                取消
              </button>
              <button
                onClick={handleAddTask}
                disabled={!newTask.title}
                className="px-3 py-1.5 text-xs bg-[#007AFF] text-white rounded hover:bg-[#0051D5] disabled:opacity-50"
              >
                添加任务
              </button>
            </div>
          </div>
        )}

        {/* Task List */}
        <div className="space-y-3">
          <h3 className="text-sm text-gray-700">测试任务流</h3>
          {currentSequence?.tasks.map((task) => (
            <div
              key={task.id}
              className={`border rounded-lg p-4 ${
                task.status === 'active' 
                  ? 'border-[#007AFF] bg-blue-50' 
                  : task.status === 'completed'
                  ? 'border-green-200 bg-green-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                {/* Task Code Badge */}
                <div className={`w-10 h-10 rounded flex items-center justify-center text-xs text-white flex-shrink-0 ${
                  task.status === 'active' ? 'bg-[#007AFF]' :
                  task.status === 'completed' ? 'bg-green-500' :
                  'bg-gray-400'
                }`}>
                  {task.code}
                </div>

                {/* Task Illustration */}
                <div className="w-16 h-16 flex-shrink-0 border border-gray-200 rounded bg-white">
                  <svg viewBox="0 0 80 80" className="w-full h-full p-2">
                    <path
                      d={task.illustration}
                      fill="none"
                      stroke={task.status === 'completed' ? '#34C759' : '#007AFF'}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                {/* Task Info */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="text-sm text-gray-900">{task.title}</h4>
                    <div className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wide ml-2 ${
                      task.status === 'active' ? 'bg-blue-100 text-[#007AFF]' :
                      task.status === 'completed' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {task.status === 'active' ? 'Active' : task.status === 'completed' ? 'Done' : 'Pending'}
                    </div>
                  </div>
                  <p className="text-xs text-gray-600">{task.description}</p>
                </div>
              </div>

              {/* Record Points */}
              <div className="pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-600 mb-2">记录点 (填写完成后自动标记为Done):</div>
                <div className="space-y-2">
                  {task.recordPoints.map((point) => (
                    <div key={point.id} className="flex items-center gap-2">
                      <Circle className="w-2 h-2 text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-700 min-w-[100px]">{point.label}</span>
                      {editingRecordPoint === point.id ? (
                        <div className="flex-1">
                          <div className="flex items-center gap-1">
                            <div className="relative flex-1">
                              <input
                                type="text"
                                value={point.value}
                                onChange={(e) => handleUpdateRecordPoint(task.id, point.id, e.target.value)}
                                className={`w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-[#007AFF] ${
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
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                                  {point.unit}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => setEditingRecordPoint(null)}
                              className="p-1 hover:bg-gray-200 rounded flex-shrink-0"
                            >
                              <Save className="w-3 h-3 text-green-600" />
                            </button>
                          </div>
                          
                          {/* Guidance Panel */}
                          {(point.guidance || point.range || point.risk) && (
                            <div className="mt-2 p-2 bg-blue-50/50 border border-blue-100 rounded text-[10px] space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                              <div className="flex gap-4">
                                {point.range && (
                                  <span className="text-gray-500">
                                    范围: <span className="font-medium text-gray-700">{point.range} {point.unit}</span>
                                  </span>
                                )}
                                {point.recommended && (
                                  <span className="text-blue-600 font-medium">
                                    推荐: {point.recommended} {point.unit}
                                  </span>
                                )}
                              </div>
                              {point.guidance && (
                                <div className="text-gray-600 leading-tight">
                                  💡 {point.guidance}
                                </div>
                              )}
                              {point.risk && (
                                <div className="text-orange-600 leading-tight flex items-start gap-1">
                                  <span>⚠️</span>
                                  <span>{point.risk}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div 
                          className="flex items-center gap-2 flex-1 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded group transition-colors"
                          onClick={() => setEditingRecordPoint(point.id)}
                        >
                          <span className={`text-xs flex-1 ${point.value ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                            {point.value ? (
                              <span>
                                {point.value} <span className="text-gray-500 text-[10px]">{point.unit}</span>
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
            </div>
          ))}
        </div>

        {/* Hand Anatomy Heatmap (a-v 共 22 区，0-10 打分) */}
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <h3 className="text-sm text-gray-700">手部解剖热力图 <span className="text-xs text-gray-400">(a-v 共 22 区)</span></h3>
            <ArchiveButton
              data={regionScores}
              onSave={saveRegionScores}
              saving={savingArchive}
              lastSavedAt={regionArchivedAt}
              label="存档"
            />
          </div>
          <p className="text-xs text-gray-600 mb-3">
            点击分区录入 0-10 不舒适度（参照 IH vs OH/SH 对比研究）
          </p>

          <div className="relative w-full max-w-md mx-auto bg-white rounded-lg border border-gray-200">
            <svg viewBox="0 0 1139 896" className="w-full h-auto">
              {/* 原图作为底图 */}
              <image href="/hand-anatomy.png" x="0" y="0" width="1139" height="896" preserveAspectRatio="xMidYMid meet" />
              {/* 22 个分区 hit area */}
              {HAND_REGIONS.map((r) => {
                const score = regionScores[r.id] || 0;
                const isSelected = selectedRegion === r.id;
                return (
                  <polygon
                    key={r.id}
                    points={r.polygon}
                    fill={scoreColor(score)}
                    stroke={isSelected ? '#007AFF' : 'rgba(0,0,0,0.15)'}
                    strokeWidth={isSelected ? 3 : 1}
                    className="cursor-pointer transition-all"
                    onClick={() => handleRegionClick(r.id)}
                  >
                    <title>{r.label}（当前 {score}/10）</title>
                  </polygon>
                );
              })}
              {/* 字母标签（始终可见，加白色描边便于在彩色背景上看清） */}
              {HAND_REGIONS.map((r) => (
                <text
                  key={`lbl-${r.id}`}
                  x={r.cx}
                  y={r.cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="28"
                  fontWeight="600"
                  fill="#1a1a1a"
                  stroke="#ffffff"
                  strokeWidth="3"
                  paintOrder="stroke"
                  style={{ pointerEvents: 'none' }}
                >
                  {r.id}
                </text>
              ))}
              {/* 选中区域右上角显示分数 */}
              {selectedRegion && (() => {
                const r = HAND_REGIONS.find((x) => x.id === selectedRegion);
                if (!r) return null;
                const s = regionScores[r.id] || 0;
                return (
                  <g>
                    <circle cx={r.cx + 35} cy={r.cy - 35} r="22" fill="#007AFF" stroke="#fff" strokeWidth="2" />
                    <text x={r.cx + 35} y={r.cy - 35} textAnchor="middle" dominantBaseline="central" fontSize="20" fontWeight="700" fill="#fff" style={{ pointerEvents: 'none' }}>
                      {s}
                    </text>
                  </g>
                );
              })()}
            </svg>
          </div>

          {/* 选中区域的 0-10 滑块 */}
          {selectedRegion && (() => {
            const r = HAND_REGIONS.find((x) => x.id === selectedRegion);
            if (!r) return null;
            const score = regionScores[r.id] || 0;
            return (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm text-gray-900 font-medium">{r.id} · {r.label}</span>
                    <span className="text-xs text-gray-500 ml-2">({r.desc})</span>
                  </div>
                  <button
                    onClick={() => setSelectedRegion(null)}
                    className="text-xs text-gray-400 hover:text-gray-700"
                    title="关闭"
                  >✕</button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={score}
                    onChange={(e) => handleRegionScore(r.id, Number(e.target.value))}
                    className="flex-1 accent-[#007AFF]"
                  />
                  <div
                    className="w-10 h-8 rounded flex items-center justify-center text-white text-sm font-medium"
                    style={{ background: scoreColor(score).replace(/rgba\(([^)]+)\)/, (_m, c) => {
                      // 把 alpha 改为 1 让数字清晰
                      const parts = c.split(',');
                      parts[3] = '1';
                      return `rgb(${parts.slice(0,3).join(',')})`;
                    }) }}
                  >
                    {score}
                  </div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>0 无不适</span>
                  <span>5 明显不适</span>
                  <span>10 剧痛</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <button
                      key={n}
                      onClick={() => handleRegionScore(r.id, n)}
                      className={`w-7 h-7 rounded text-xs border transition-colors ${
                        score === n
                          ? 'bg-[#007AFF] text-white border-[#007AFF]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#007AFF]'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* 22 区分数总览（已打分的） */}
          {Object.keys(regionScores).length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-gray-500 mb-1">已记录：</div>
              <div className="flex flex-wrap gap-1">
                {HAND_REGIONS.filter((r) => (regionScores[r.id] || 0) > 0).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRegion(r.id)}
                    className="px-2 py-0.5 rounded text-[11px] border"
                    style={{
                      background: scoreColor(regionScores[r.id]).replace(/rgba\(([^)]+)\)/, (_m, c) => {
                        const parts = c.split(',');
                        parts[3] = '0.9';
                        return `rgba(${parts.join(',')})`;
                      }),
                      borderColor: 'rgba(0,0,0,0.1)',
                    }}
                    title={`${r.label}：${regionScores[r.id]}/10`}
                  >
                    <span className="font-medium">{r.id}</span> {regionScores[r.id]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
