const fs = require('fs');

const data = fs.readFileSync('src/app/components/panels/BehaviorPanel.tsx', 'utf8');

const newGenerateTasks = `
  const generateTasksForScenario = (scenario: ScenarioData): Task[] => {
    // --------------------------------------------------------
    // stapler-v3 腹腔镜用智能电动吻合器V3 - 核心预设
    // --------------------------------------------------------
    
    // 【SOP-0】通用术前自检 (所有吻合器场景前置)
    const sop0: Task = {
      id: \`sop0-\${scenario.id}\`,
      code: 'SOP-0',
      title: '通用术前自检',
      description: '任何手术操作前必须完整执行包装、装配、开机、自检及空载测试',
      illustration: 'M20,20 L60,20 L60,60 L20,60 Z M30,40 L45,40 M45,40 L40,35 M45,40 L40,45', 
      recordPoints: [
        { id: 'rp0-1', label: '开机自检时长', value: '', editable: true, unit: 's', range: '1-5', recommended: '<3', guidance: '按下电源键到进入待机界面的时间' },
        { id: 'rp0-2', label: '双侧按键反馈', value: '', editable: true, guidance: '确认机械"咔嗒"声与回弹，记录是否清晰' },
        { id: 'rp0-3', label: '钉仓识别速度', value: '', editable: true, unit: 's', recommended: '<1', guidance: '装载卡入到显示屏识别的时间' },
        { id: 'rp0-4', label: '空载测试电音', value: '', editable: true, guidance: '评估电机运转声音无卡顿' }
      ],
      status: 'pending'
    };

    if (scenario.id === 'stapler-scene-1') {
      return [
        sop0,
        {
          id: 'sop1-s1', code: 'S1-1', title: '入路与定位',
          description: '通过 Trocar 置入，保持钳口闭合，初始偏转角 0°，直视下推进',
          illustration: 'M10,40 L70,40',
          recordPoints: [
            { id: 'rp1-1', label: '置入阻力感知', value: '', editable: true, guidance: '主管评分 1-5' }
          ],
          status: 'pending'
        },
        {
          id: 'sop1-s2', code: 'S1-2', title: '大角度偏转与到位',
          description: '单手拇指操作铰接拨轮，到达45°-60°锁定，确认组织完全包绕',
          illustration: 'M10,40 L40,40 L60,20',
          recordPoints: [
            { id: 'rp1-2', label: '最大偏转角', value: '', editable: true, unit: '°', range: '0-60' },
            { id: 'rp1-3', label: '单手拨轮舒适度', value: '', editable: true, guidance: '是否能在不改变握姿下完成' }
          ],
          status: 'pending'
        },
        {
          id: 'sop1-s3', code: 'S1-3', title: '闭合与击发',
          description: '闭合钳口检查厚度，确认无误夹后按下主扳机击发',
          illustration: 'M20,30 L60,30 M20,50 L60,50',
          recordPoints: [
            { id: 'rp1-4', label: '两段式扳机力', value: '', editable: true, unit: 'N', guidance: '触发击发的按压力度' },
            { id: 'rp1-5', label: '进度条识别度', value: '', editable: true, guidance: '盲操作/余光是否能感知击发完成' }
          ],
          status: 'pending'
        },
        {
          id: 'sop1-s4', code: 'S1-4', title: '术后检查',
          description: '退出器械，检查切割线平直、无出血无撕裂',
          illustration: 'M25,40 L35,50 L55,25',
          recordPoints: [
            { id: 'rp1-6', label: '成钉不良率', value: '', editable: true, unit: '%' }
          ],
          status: 'pending'
        }
      ];
    }
    
    if (scenario.id === 'stapler-scene-2') {
      return [
        sop0,
        {
          id: 'sop2-s1', code: 'S2-1', title: '组织评估与钉仓选择',
          description: '直视预估厚度，选择黑/绿钉仓，显示屏核对匹配度',
          illustration: 'M20,20 L60,20 M20,60 L60,60 M20,40 L60,40',
          recordPoints: [
            { id: 'rp2-1', label: '显示屏读数延迟', value: '', editable: true, unit: 's' }
          ],
          status: 'pending'
        },
        {
          id: 'sop2-s2', code: 'S2-2', title: '钳口闭合与智能压榨',
          description: '均匀施压闭合，启动压榨倒计时，等待组织液重新分布',
          illustration: 'M30,20 L50,20 L40,40 Z',
          recordPoints: [
            { id: 'rp2-2', label: '闭合压力读数', value: '', editable: true, unit: 'kPa' },
            { id: 'rp2-3', label: '压榨等待提示', value: '', editable: true, guidance: '视听双重反馈的清晰度' }
          ],
          status: 'pending'
        },
        {
          id: 'sop2-s3', code: 'S2-3', title: '击发与成钉',
          description: '确认厚度稳定，匀速电动击发，不额外手动施力',
          illustration: 'M10,40 L70,40 M40,20 L40,60',
          recordPoints: [
            { id: 'rp2-4', label: '厚度读数稳定期', value: '', editable: true, unit: 's', recommended: '>2' },
            { id: 'rp2-5', label: '击发后震动感', value: '', editable: true, guidance: '手柄传递的震动是否影响稳定性' }
          ],
          status: 'pending'
        },
        {
          id: 'sop2-s4', code: 'S2-4', title: '止血确认',
          description: '观察30s无活动出血，记录渗血并酌情电凝',
          illustration: 'M20,40 Q40,10 60,40 Q40,70 20,40',
          recordPoints: [
            { id: 'rp2-6', label: '渗血点数量', value: '', editable: true, unit: '个' }
          ],
          status: 'pending'
        }
      ];
    }
    
    if (scenario.id === 'stapler-scene-3') {
      return [
        sop0,
        {
          id: 'sop3-s1', code: 'S3-1', title: '切割线规划',
          description: '评估长度，规划2-3次分段击发，准备足量颜色梯度钉仓',
          illustration: 'M10,40 L30,40 M35,40 L55,40 M60,40 L80,40',
          recordPoints: [
            { id: 'rp3-1', label: '总切割长度', value: '', editable: true, unit: 'mm' }
          ],
          status: 'pending'
        },
        {
          id: 'sop3-s2', code: 'S3-2', title: '分段击发循环',
          description: '每段重叠2-3mm，重复闭合-压榨-击发，全程连续',
          illustration: 'M20,30 L60,30 L40,60 Z',
          recordPoints: [
            { id: 'rp3-2', label: '段间重叠精度', value: '', editable: true, unit: 'mm', recommended: '2-3' },
            { id: 'rp3-3', label: '单手连续击发疲劳', value: '', editable: true, guidance: 'Borg评分1-10' }
          ],
          status: 'pending'
        },
        {
          id: 'sop3-s3', code: 'S3-3', title: '全程止血评估',
          description: '逐段检查重叠区与交界处，观察60秒',
          illustration: 'M20,40 L40,60 L70,20',
          recordPoints: [
            { id: 'rp3-4', label: '交界处渗血率', value: '', editable: true, unit: '%' }
          ],
          status: 'pending'
        },
        {
          id: 'sop3-s4', code: 'S3-4', title: '术后记录与器械处理',
          description: '记录钉仓使用量，器械规范废弃',
          illustration: 'M30,20 L50,20 L50,60 L30,60 Z',
          recordPoints: [
            { id: 'rp3-5', label: '使用钉仓总数', value: '', editable: true, unit: '个' }
          ],
          status: 'pending'
        }
      ];
    }

    // --------------------------------------------------------
    // forceps-v2 小钳智能双极电刀 - 老项目保留
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
          status: 'pending'
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
          status: 'pending'
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
          status: 'pending'
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
          status: 'pending'
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
          status: 'pending'
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
          status: 'pending'
        }
      ];
    }
    
    // Default or custom scenario tasks
    return [
      {
        id: \`t1-\${scenario.id}\`,
        code: 'T1',
        title: '场景默认任务',
        description: '请描述在该场景下的核心人机交互任务',
        illustration: 'M30,30 h20 v20 h-20 z',
        recordPoints: [
          { id: \`rp1-\${scenario.id}\`, label: '关键指标测量', value: '', editable: true }
        ],
        status: 'pending',
        isCustom: true
      }
    ];
  };
`;

const startIndex = data.indexOf('const generateTasksForScenario = (scenario: ScenarioData): Task[] => {');
const endIndex = data.indexOf('// --- Audio Recording Functions (Stage 1 & 3) ---');

if (startIndex > -1 && endIndex > -1) {
  // We need to carefully slice out the old function and replace it.
  // The old function ends right before // --- Audio Recording Functions... ?
  // Actually, we can just replace everything from `const generateTasksForScenario` up to `// Update stats when tasks change` or similar? No, the original code had `// --- Audio Recording Functions` way below.
  // Let's use regex to find the generateTasksForScenario body and replace it.
  
  // It's safer to read the file, split by lines, and replace the block.
}
