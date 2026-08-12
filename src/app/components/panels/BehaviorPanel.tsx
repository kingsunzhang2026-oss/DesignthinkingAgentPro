import React, { useState, useEffect, useRef } from 'react';
import { Smartphone, Circle, Save, Plus, Trash2, Sparkles, AlertTriangle, FileText, CloudUpload, Download, Users, Loader2, Mic, Square } from 'lucide-react';
import { ScenarioData, TaskSequence, Task, RecordPoint } from '../../App';
import { generateExtendedTask } from '../../services/aiScenarios';
import { supabase } from '../../utils/supabase/client';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface BehaviorPanelProps {
  activeProjectId: string;
  scenarios: any[];
  onTaskStatsChange: (stats: any) => void;
  taskSequences: any[];
  onTaskSequencesChange: (sequences: any[]) => void;
}

export function BehaviorPanel({ 
  activeProjectId,
  scenarios, 
  onTaskStatsChange,
  taskSequences,
  onTaskSequencesChange
}: BehaviorPanelProps) {
  const [activeTab, setActiveTab] = useState(0);
  // taskSequences state is now managed by parent
  const [selectedHotspot, setSelectedHotspot] = useState<string | null>(null);
  const [editingRecordPoint, setEditingRecordPoint] = useState<string | null>(null);
  
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
    // --------------------------------------------------------
    // stapler-v3 腹腔镜用智能电动吻合器V3
    // --------------------------------------------------------
    
    const sop0: Task = {
      id: `sop0-${scenario.id}`,
      code: 'SOP-0',
      title: '通用术前自检（独立篇）',
      description: `适用范围：一次性腔镜用全电动切割吻合器及钉仓组件。
• 步骤 1：检查包装完整性与有效期。
• 步骤 2：确认设备装配，无松动裂缝。
• 步骤 3：开机，确认显示屏亮起。
• 步骤 4：确认系统自检正常，电量充足。
• 步骤 5：轻按双侧按键，确认机械反馈。
• 步骤 6：装载钉仓，确认设备自动识别。
• 步骤 7：空载击发一次，确认电机运转正常。
• 步骤 8：钳口闭合复位，偏转角归零。`,
      illustration: 'M20,20 L60,20 L60,60 L20,60 Z M30,40 L45,40 M45,40 L40,35 M45,40 L40,45', 
      recordPoints: [
        { id: 'rp0-1', label: '开机自检时长', value: '', editable: true, unit: 's', range: '1-5', recommended: '<3', guidance: '按下电源键到进入待机界面的时间' },
        { id: 'rp0-2', label: '双侧按键反馈', value: '', editable: true, guidance: '确认机械"咔嗒"声与回弹，记录是否清晰' },
        { id: 'rp0-3', label: '钉仓识别速度', value: '', editable: true, unit: 's', recommended: '<1', guidance: '装载卡入到显示屏识别的时间' },
        { id: 'rp0-4', label: '空载测试电音', value: '', editable: true, guidance: '评估电机运转声音无卡顿' }
      ],
      status: 'pending' as const
    };

    if (scenario.id === 'stapler-scene-1') {
      return [
        sop0,
        {
          id: 'sop1-s1', code: 'S1-1', title: '阶段一：入路与定位',
          description: `• 步骤 1：经穿刺器置入器械，保持钳口闭合。
• 步骤 2：确认初始偏转角度为 0°。
• 步骤 3：直视下平稳推进至目标组织，避免钩挂。`,
          illustration: 'M10,40 L70,40',
          recordPoints: [
            { id: 'rp1-1', label: '置入阻力感知', value: '', editable: true, guidance: '主管评分 1-10 (1=极轻松)' },
            { id: 'rp1-1b', label: '推进对准时间', value: '', editable: true, unit: 's', guidance: '从入路到对准目标的时间' }
          ],
          status: 'pending' as const
        },
        {
          id: 'sop1-s2', code: 'S1-2', title: '阶段二：大角度偏转与到位',
          description: `• 步骤 4：单手操作偏转，逐级增大角度并观察。
• 步骤 5：到达目标角度后锁定偏转。
• 步骤 6：微调器械，使钳口对准切割线。
• 步骤 7：确认钳口完全包绕目标组织。`,
          illustration: 'M10,40 L40,40 L60,20',
          recordPoints: [
            { id: 'rp1-2', label: '最大偏转角', value: '', editable: true, unit: '°', range: '0-60' },
            { id: 'rp1-3', label: '单手拨轮舒适度', value: '', editable: true, guidance: '拇指操作疲劳度 (RPE 1-10)' },
            { id: 'rp1-3b', label: '锁定操作时间', value: '', editable: true, unit: 's' }
          ],
          status: 'pending' as const
        },
        {
          id: 'sop1-s3', code: 'S1-3', title: '阶段三：闭合与击发',
          description: `• 步骤 8：闭合钳口，观察组织均匀压入。
• 步骤 9：检查厚度读数，确认与钉仓适配。
• 步骤 10：确认无周边组织被误夹。
• 步骤 11：启动电动击发，保持器械稳定。
• 步骤 12：等待进度条 100% 及完成提示。
• 步骤 13：松开钳口，缓慢退出器械。`,
          illustration: 'M20,30 L60,30 M20,50 L60,50',
          recordPoints: [
            { id: 'rp1-4', label: '两段式扳机力', value: '', editable: true, unit: 'N', guidance: '触发击发的按压力度' },
            { id: 'rp1-5', label: '屏幕信息获取时间', value: '', editable: true, unit: 's', guidance: '读取厚度与进度条的时间' },
            { id: 'rp1-5b', label: '击发稳定性', value: '', editable: true, unit: 'mm', guidance: '击发时枪管轴向位移' }
          ],
          status: 'pending' as const
        },
        {
          id: 'sop1-s4', code: 'S1-4', title: '阶段四：术后检查与意外分支',
          description: `• 步骤 14：检查切割线平直、成钉良好。
• 步骤 15：检查无活动性出血。
• 步骤 16：确认周边组织无损伤。
【意外处理】偏转不足→重定位；厚度超限→换钉仓；卡顿→电动回刀。`,
          illustration: 'M25,40 L35,50 L55,25',
          recordPoints: [
            { id: 'rp1-6', label: '成钉不良率', value: '', editable: true, unit: '%' },
            { id: 'rp1-6b', label: '意外分支触发', value: '', editable: true, guidance: '记录是否触发任何意外分支及处理耗时' }
          ],
          status: 'pending' as const
        }
      ];
    }
    
    if (scenario.id === 'stapler-scene-2') {
      return [
        sop0,
        {
          id: 'sop2-s1', code: 'S2-1', title: '阶段一：组织评估与钉仓选择',
          description: `• 步骤 1：直视评估目标组织厚度。
• 步骤 2：选择适配钉仓。
• 步骤 3：装载钉仓并确认设备识别。
• 步骤 4：核对匹配度，不匹配则更换。`,
          illustration: 'M20,20 L60,20 M20,60 L60,60 M20,40 L60,40',
          recordPoints: [
            { id: 'rp2-1', label: '组织预估厚度', value: '', editable: true, unit: 'mm' },
            { id: 'rp2-1b', label: '显示屏读数延迟', value: '', editable: true, unit: 's' }
          ],
          status: 'pending' as const
        },
        {
          id: 'sop2-s2', code: 'S2-2', title: '阶段二：钳口闭合与智能压榨',
          description: `• 步骤 5：钳口完全包绕组织，均匀分布。
• 步骤 6：缓慢施压闭合，观察压力指示。
• 步骤 7：启动智能压榨等待倒计时。
• 步骤 8：等待压榨完成的双重提示。
• 步骤 9：(薄组织可酌情跳过压榨)。`,
          illustration: 'M30,20 L50,20 L40,40 Z',
          recordPoints: [
            { id: 'rp2-2', label: '闭合压力读数', value: '', editable: true, unit: 'kPa' },
            { id: 'rp2-3', label: '压榨等待时间', value: '', editable: true, unit: 's', guidance: '实际耗时' },
            { id: 'rp2-3b', label: '视听反馈清晰度', value: '', editable: true, guidance: '评分 1-5' }
          ],
          status: 'pending' as const
        },
        {
          id: 'sop2-s3', code: 'S2-3', title: '阶段三：击发与成钉',
          description: `• 步骤 10：确认厚度读数稳定(>2秒)。
• 步骤 11：匀速电动击发，勿手动施力。
• 步骤 12：如遇组织滑脱立即停止。
• 步骤 13：等待击发完成双重确认。
• 步骤 14：松开钳口，检查成钉质量。`,
          illustration: 'M10,40 L70,40 M40,20 L40,60',
          recordPoints: [
            { id: 'rp2-4', label: '厚度读数稳定期', value: '', editable: true, unit: 's', recommended: '>2' },
            { id: 'rp2-5', label: '击发后震动感', value: '', editable: true, guidance: '手柄传递震动主观评分' }
          ],
          status: 'pending' as const
        },
        {
          id: 'sop2-s4', code: 'S2-4', title: '阶段四：止血确认与意外分支',
          description: `• 步骤 15：观察 30 秒确认无活动出血。
• 步骤 16：评估渗血，必要时处理。
• 步骤 17：记录出血情况。
【意外处理】组织过厚/外溢→重定位或换仓；浮钉→补缝。`,
          illustration: 'M20,40 Q40,10 60,40 Q40,70 20,40',
          recordPoints: [
            { id: 'rp2-6', label: '渗血点数量', value: '', editable: true, unit: '个' },
            { id: 'rp2-6b', label: '意外分支触发', value: '', editable: true, guidance: '记录发生的意外情况与补救用时' }
          ],
          status: 'pending' as const
        }
      ];
    }
    
    if (scenario.id === 'stapler-scene-3') {
      return [
        sop0,
        {
          id: 'sop3-s1', code: 'S3-1', title: '阶段一：切割线规划',
          description: `• 步骤 1：规划切割路径与钉仓数量。
• 步骤 2：制定分段击发策略。
• 步骤 3：准备足量适配钉仓。
• 步骤 4：规划过渡区钉仓颜色梯度。`,
          illustration: 'M10,40 L30,40 M35,40 L55,40 M60,40 L80,40',
          recordPoints: [
            { id: 'rp3-1', label: '总切割长度', value: '', editable: true, unit: 'mm' },
            { id: 'rp3-1b', label: '规划耗时', value: '', editable: true, unit: 's' }
          ],
          status: 'pending' as const
        },
        {
          id: 'sop3-s2', code: 'S3-2', title: '阶段二：分段击发循环',
          description: `• 步骤 5：首段对准起点，留起始重叠。
• 步骤 6：闭合钳口并检查厚度。
• 步骤 7：压榨后击发首段，确认 100%。
• 步骤 8：松开检查首段完整。
• 步骤 9：次段与前段重叠 2-3mm。
• 步骤 10-11：重复闭合-压榨-击发。
• 步骤 12：末段预留安全边距。`,
          illustration: 'M20,30 L60,30 L40,60 Z',
          recordPoints: [
            { id: 'rp3-2', label: '段间重叠精度', value: '', editable: true, unit: 'mm', recommended: '2-3' },
            { id: 'rp3-3', label: '连续击发手部疲劳', value: '', editable: true, guidance: 'Borg评分1-10' },
            { id: 'rp3-3b', label: '单次击发周期耗时', value: '', editable: true, unit: 's' }
          ],
          status: 'pending' as const
        },
        {
          id: 'sop3-s3', code: 'S3-3', title: '阶段三：全程止血评估',
          description: `• 步骤 13：逐段检查切割线及交界处。
• 步骤 14：确认钉线连续无漏钉。
• 步骤 15：观察 60 秒确认无活动出血。
• 步骤 16：标记交界处渗血高发区。
• 步骤 17：必要时电凝或补针。`,
          illustration: 'M20,40 L40,60 L70,20',
          recordPoints: [
            { id: 'rp3-4', label: '交界处渗血率', value: '', editable: true, unit: '%' },
            { id: 'rp3-4b', label: '吻合口面积评估', value: '', editable: true, unit: 'mm²' }
          ],
          status: 'pending' as const
        },
        {
          id: 'sop3-s4', code: 'S3-4', title: '阶段四：术后记录与意外分支',
          description: `• 步骤 18：记录击发次数与钉仓。
• 步骤 19：记录出血情况。
• 步骤 20：器械按规范废弃。
【意外处理】钉线断裂/出血→电凝补缝/追加击发；移位→重新定位。`,
          illustration: 'M30,20 L50,20 L50,60 L30,60 Z',
          recordPoints: [
            { id: 'rp3-5', label: '使用钉仓总数', value: '', editable: true, unit: '个' },
            { id: 'rp3-5b', label: '意外分支触发', value: '', editable: true, guidance: '记录是否发生上述异常及补救操作' }
          ],
          status: 'pending' as const
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
          status: 'pending' as const
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
          status: 'pending' as const
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
          status: 'pending' as const
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
          status: 'pending' as const
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
          status: 'pending' as const
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
          status: 'pending' as const
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
        isCustom: true
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

  const currentSequence = taskSequences[activeTab];

  const [isUploading, setIsUploading] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTask, setRecordingTask] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- Audio Recording Functions (Stage 1) ---
  const startRecording = async (scenarioId: string) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('当前环境或浏览器不支持麦克风录音。');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        if (window.confirm("出声报告录音结束。是否将该录音音频转写为文字并自动记录？（将调用火山引擎豆包语音识别）")) {
           const audio = new Audio(audioUrl);
           audio.play();
           alert("准备调用豆包语音 API... (在开发环境中)");
        }
      };

      mediaRecorder.start();
      setRecordingTask(scenarioId);
      setIsRecording(true);
    } catch (error: any) {
      console.error('Error accessing microphone:', error);
      if (error.name === 'NotAllowedError' || error.message.includes('Permission denied')) {
        alert('权限被拒绝：请在本地运行 (npm run dev) 或在真实网页中测试此出声报告功能。');
      } else {
        alert(`无法访问麦克风: ${error.message}`);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      setRecordingTask(null);
    }
  };

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
                  ? 'bg-red-100 text-red-700 animate-pulse border border-red-200 shadow-sm'
                  : 'bg-[#007AFF]/10 text-[#007AFF] hover:bg-[#007AFF]/20'
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
                    <div className="flex items-center gap-2">
                      <div className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wide ${
                        task.status === 'active' ? 'bg-blue-100 text-[#007AFF]' :
                        task.status === 'completed' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {task.status === 'active' ? 'Active' : task.status === 'completed' ? 'Done' : 'Pending'}
                      </div>
                    </div>
                  </div>
                  {task.description.includes('•') ? (
                    <details className="mt-2 group">
                      <summary className="text-[10px] font-medium text-[#007AFF] cursor-pointer outline-none select-none hover:underline">
                        展开/折叠详细操作步骤
                      </summary>
                      <div className="text-[10px] text-gray-600 whitespace-pre-line mt-1.5 bg-gray-50 p-2.5 rounded border border-gray-100 leading-relaxed">
                        {task.description}
                      </div>
                    </details>
                  ) : (
                    <div className="text-[10px] text-gray-600 whitespace-pre-line mt-2 bg-gray-50 p-2 rounded border border-gray-100">
                      {task.description}
                    </div>
                  )}
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

        {/* Hand Anatomy Heatmap */}
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <h3 className="text-sm text-gray-700 mb-3">手部解剖热力图</h3>
          <p className="text-xs text-gray-600 mb-4">
            点击图中位置记录压痛点或接触区域
          </p>

          <div className="relative w-full aspect-square max-w-xs mx-auto bg-gradient-to-br from-blue-50 to-gray-50 rounded-lg border border-gray-200">
            {/* Simplified Hand Shape */}
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {/* Palm */}
              <ellipse cx="40" cy="60" rx="20" ry="25" fill="#E8F4FF" stroke="#007AFF" strokeWidth="0.5" opacity="0.6" />
              
              {/* Thumb */}
              <ellipse cx="30" cy="40" rx="8" ry="15" fill="#E8F4FF" stroke="#007AFF" strokeWidth="0.5" opacity="0.6" transform="rotate(-30 30 40)" />
              
              {/* Fingers */}
              <ellipse cx="50" cy="25" rx="5" ry="18" fill="#E8F4FF" stroke="#007AFF" strokeWidth="0.5" opacity="0.6" />
              <ellipse cx="60" cy="30" rx="5" ry="20" fill="#E8F4FF" stroke="#007AFF" strokeWidth="0.5" opacity="0.6" />
              <ellipse cx="68" cy="38" rx="4" ry="18" fill="#E8F4FF" stroke="#007AFF" strokeWidth="0.5" opacity="0.6" />
              <ellipse cx="75" cy="48" rx="4" ry="15" fill="#E8F4FF" stroke="#007AFF" strokeWidth="0.5" opacity="0.6" />

              {/* Hotspot markers */}
              {hotspots.map((hotspot) => (
                <g key={hotspot.id}>
                  <circle
                    cx={hotspot.x}
                    cy={hotspot.y}
                    r="4"
                    fill={selectedHotspot === hotspot.id ? '#FF9500' : '#007AFF'}
                    opacity={selectedHotspot === hotspot.id ? '1' : '0.7'}
                    className="cursor-pointer hover:opacity-100 transition-opacity"
                    onClick={() => handleHotspotClick(hotspot)}
                  />
                  {selectedHotspot === hotspot.id && (
                    <circle
                      cx={hotspot.x}
                      cy={hotspot.y}
                      r="8"
                      fill="none"
                      stroke="#FF9500"
                      strokeWidth="1.5"
                      opacity="0.5"
                    >
                      <animate attributeName="r" from="4" to="12" dur="1s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.8" to="0" dur="1s" repeatCount="indefinite" />
                    </circle>
                  )}
                </g>
              ))}
            </svg>
          </div>

          {/* Selected Hotspot Info */}
          {selectedHotspot && (
            <div className="mt-4 p-3 bg-orange-50 border border-[#FF9500] rounded-lg animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-900">
                  已添加: {hotspots.find(h => h.id === selectedHotspot)?.label}压痛
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-[#FF9500] text-white">
                  已记录
                </span>
              </div>
              <p className="text-xs text-gray-600">
                该记录点已自动添加到当前任务列表中，请补充疼痛评分。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
