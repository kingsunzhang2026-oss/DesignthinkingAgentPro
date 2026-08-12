import React, { useState, useEffect, useRef } from 'react';
import { Smartphone, Circle, Save, Plus, Trash2, Sparkles, AlertTriangle, FileText, CloudUpload, Download, Users, Loader2, Mic, Square } from 'lucide-react';
import { ScenarioData, TaskSequence, Task, RecordPoint, BranchCard } from '../../App';
import { generateExtendedTask } from '../../services/aiScenarios';
import { supabase } from '../../utils/supabase/client';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

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
  // 食指（最左长指）
  { id: 'd', finger: '食指', section: '远节', label: '食指 DIP（远节指间）', points: '258,30 295,30 295,82 258,82', centerX: 276, centerY: 56 },
  { id: 'h', finger: '食指', section: '中节', label: '食指 PIP（中节指间）', points: '258,82 295,82 295,182 258,182', centerX: 276, centerY: 132 },
  { id: 'l', finger: '食指', section: '近节', label: '食指近节指骨', points: '258,182 295,182 295,278 258,278', centerX: 276, centerY: 230 },
  { id: 'p', finger: '食指', section: '掌指', label: '食指掌指关节区', points: '220,278 295,278 295,348 220,348', centerX: 257, centerY: 313 },
  // 中指（中间）
  { id: 'c', finger: '中指', section: '远节', label: '中指 DIP（远节）', points: '330,12 380,12 380,90 330,90', centerX: 355, centerY: 51 },
  { id: 'g', finger: '中指', section: '中节', label: '中指 PIP（中节）', points: '330,90 380,90 380,202 330,202', centerX: 355, centerY: 146 },
  { id: 'k', finger: '中指', section: '近节', label: '中指近节', points: '325,202 380,202 380,290 325,290', centerX: 352, centerY: 246 },
  { id: 'o', finger: '中指', section: '掌指', label: '中指掌指关节区', points: '305,290 380,290 380,362 305,362', centerX: 342, centerY: 326 },
  // 无名指
  { id: 'b', finger: '无名指', section: '远节', label: '无名指 DIP', points: '415,35 460,35 460,115 415,115', centerX: 437, centerY: 75 },
  { id: 'f', finger: '无名指', section: '中节', label: '无名指 PIP', points: '415,115 460,115 460,218 415,218', centerX: 437, centerY: 166 },
  { id: 'g2', finger: '无名指', section: '近节', label: '无名指近节', points: '390,218 448,218 448,298 390,298', centerX: 419, centerY: 258 },
  // 小指（最右短指）
  { id: 'a', finger: '小指', section: '远节', label: '小指 DIP', points: '475,85 515,85 515,180 475,180', centerX: 495, centerY: 132 },
  { id: 'e', finger: '小指', section: '中节', label: '小指 PIP', points: '478,180 515,180 515,288 478,288', centerX: 496, centerY: 234 },
  { id: 'i', finger: '小指', section: '近节', label: '小指近节', points: '455,288 505,288 505,362 455,362', centerX: 480, centerY: 325 },
  { id: 'm', finger: '小指', section: '掌指', label: '小指掌指关节区', points: '405,362 510,362 510,418 405,418', centerX: 457, centerY: 390 },
  // 拇指（左侧外伸）
  { id: 'v', finger: '拇指', section: '远节', label: '拇指远节（IP）', points: '35,338 115,338 115,410 35,410', centerX: 75, centerY: 374 },
  { id: 'u', finger: '拇指', section: '近节', label: '拇指近节（掌指）', points: '95,410 175,410 175,478 95,478', centerX: 135, centerY: 444 },
  // 掌部
  { id: 't', finger: '掌部', section: '大鱼际', label: '大鱼际肌（拇指球肌）', points: '95,478 270,478 270,625 95,625', centerX: 182, centerY: 552 },
  { id: 's', finger: '掌部', section: '根部', label: '拇指根部过渡区', points: '200,365 305,365 305,472 200,472', centerX: 252, centerY: 418 },
  { id: 'r', finger: '掌部', section: '掌心', label: '掌心中央', points: '270,365 440,365 440,625 270,625', centerX: 355, centerY: 495 },
  { id: 'n', finger: '掌部', section: '无名指下', label: '无名指下方过渡区', points: '380,305 450,305 450,382 380,382', centerX: 415, centerY: 343 },
  { id: 'q', finger: '掌部', section: '小鱼际', label: '小鱼际肌（小指球肌）', points: '430,400 525,400 525,625 430,625', centerX: 477, centerY: 512 },
  // 腕部（手腕横纹区，参考手掌下沿）
  { id: 'w', finger: '掌部', section: '腕部', label: '腕部（桡腕关节）', points: '180,625 480,625 480,700 180,700', centerX: 330, centerY: 662 },
];

// Borg CR10 评分颜色梯度（0=白/无疲劳 → 10=深红/极度疲劳）
const SCORE_COLOR: Record<number, string> = {
  0: '#FFFFFF',
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
                  {task.description && task.description.includes('•') ? (
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

              {/* Branch Cards (意外分支 SOP 可事后添加补充记录) */}
              <div className="pt-3 border-t border-gray-200 mt-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-xs text-gray-700 font-medium">异常分支 SOP 卡片</span>
                </div>
                {task.branchCards && task.branchCards.length > 0 ? (
                  <div className="space-y-2">
                    {task.branchCards.map((card) => (
                      <div key={card.id} className="border border-orange-200 bg-orange-50/40 rounded p-2.5 group">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 text-[11px]">
                            <div className="text-orange-700 font-medium">触发：{card.trigger}</div>
                            <div className="text-gray-600 mt-0.5">处理：{card.action}</div>
                          </div>
                          <button
                            onClick={() => handleDeleteBranchCard(task.id, card.id)}
                            className="p-1 hover:bg-orange-100 rounded flex-shrink-0"
                            title="删除该分支卡片"
                          >
                            <Trash2 className="w-3 h-3 text-orange-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-gray-400 mb-2">暂无异常分支卡片</div>
                )}
                <button
                  onClick={() => handleAddBranchCard(task.id)}
                  className="mt-2 flex items-center gap-1 px-2.5 py-1.5 text-[11px] bg-orange-50 text-orange-600 border border-orange-200 rounded hover:bg-orange-100 w-full justify-center"
                >
                  <Plus className="w-3 h-3" />
                  添加意外分支 SOP 卡片
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Hand Anatomy Heatmap — 23 个解剖分区 0-10 疲劳打分 */}
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm text-gray-700">手部解剖热力图 · 疲劳评分</h3>
            <span className="text-[10px] text-gray-500">Borg CR10</span>
          </div>
          <p className="text-xs text-gray-600 mb-3">
            点击任意解剖分区（a-v 共 23 区，指关节/掌部/大鱼际/小鱼际），按 0(无疲劳) — 10(极度疲劳) 评分。
          </p>

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
                const fill = score != null ? SCORE_COLOR[score] : 'transparent';
                const isSelected = selectedRegion === region.id;
                return (
                  <g key={region.id}>
                    <polygon
                      points={region.points}
                      fill={fill}
                      fillOpacity={score != null ? 0.55 : 0}
                      stroke={isSelected ? '#FF9500' : 'transparent'}
                      strokeWidth={isSelected ? 2 : 0}
                      className="cursor-pointer transition-colors"
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
                        fontSize="14"
                        fontWeight="700"
                        fill="#1A1A1A"
                      >
                        {score}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* 评分操作面板 */}
          {selectedRegion && (
            <div className="mt-3 p-3 bg-orange-50 border border-[#FF9500] rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-[#FF9500] text-white text-xs font-bold">
                    {HAND_REGIONS.find(r => r.id === selectedRegion)?.id}
                  </span>
                  <span className="text-sm text-gray-900">
                    {HAND_REGIONS.find(r => r.id === selectedRegion)?.label}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedRegion(null)}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <div className="text-xs text-gray-600 mb-2">
                疲劳评分（0-10 Borg CR10）：
                <span className="ml-2 font-bold text-[#FF9500] text-base">
                  {regionScores[selectedRegion] ?? '—'}
                </span>
              </div>
              <div className="grid grid-cols-11 gap-1 mb-2">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => handleRegionScore(selectedRegion, n)}
                    className={`py-1.5 text-xs rounded border transition-all ${
                      regionScores[selectedRegion] === n
                        ? 'border-[#FF9500] text-white font-bold shadow'
                        : 'border-gray-200 text-gray-700 hover:border-[#FF9500] hover:bg-orange-50'
                    }`}
                    style={regionScores[selectedRegion] === n ? { backgroundColor: SCORE_COLOR[n] } : {}}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-500">
                <span>0=无疲劳</span>
                <span>5=中等</span>
                <span>10=极度</span>
              </div>
              {(regionScores[selectedRegion] != null || regionNotes[selectedRegion]) && (
                <button
                  onClick={() => handleClearRegion(selectedRegion)}
                  className="mt-2 w-full py-1 text-xs text-gray-500 hover:text-red-600 border border-gray-200 rounded hover:border-red-300"
                >
                  清除该区域评分
                </button>
              )}
            </div>
          )}

          {/* 评分汇总表 */}
          {Object.keys(regionScores).length > 0 && (
            <div className="mt-3 p-2 bg-gray-50 border border-gray-200 rounded text-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-medium text-gray-700">已评分区域</span>
                <span className="text-gray-500">
                  {Object.keys(regionScores).length} / 23 区
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {HAND_REGIONS.filter(r => regionScores[r.id] != null).map(r => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-white"
                    style={{ backgroundColor: SCORE_COLOR[regionScores[r.id]] }}
                  >
                    <strong>{r.id}</strong>
                    <span>{regionScores[r.id]}</span>
                  </span>
                ))}
              </div>
              <button
                onClick={handleClearAllRegions}
                className="mt-2 w-full py-1 text-[10px] text-gray-500 hover:text-red-600"
              >
                清除全部评分
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
