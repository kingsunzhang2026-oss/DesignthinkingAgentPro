const fs = require('fs');
const filePath = 'src/app/components/panels/BehaviorPanel.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldFuncStart = content.indexOf('  const generateTasksForScenario = (scenario: ScenarioData): Task[] => {');
const oldFuncEnd = content.indexOf('  // Update stats when tasks change', oldFuncStart);

const newFunc = `  const generateTasksForScenario = (scenario: ScenarioData): Task[] => {
    // --------------------------------------------------------
    // stapler-v3 腹腔镜用智能电动吻合器V3
    // --------------------------------------------------------
    
    const sop0: Task = {
      id: \`sop0-\${scenario.id}\`,
      code: 'SOP-0',
      title: '通用术前自检（独立篇）',
      description: \`适用范围：一次性腔镜用全电动切割吻合器及钉仓组件。
• 步骤 1：检查包装完整性与有效期。
• 步骤 2：确认设备装配，无松动裂缝。
• 步骤 3：开机，确认显示屏亮起。
• 步骤 4：确认系统自检正常，电量充足。
• 步骤 5：轻按双侧按键，确认机械反馈。
• 步骤 6：装载钉仓，确认设备自动识别。
• 步骤 7：空载击发一次，确认电机运转正常。
• 步骤 8：钳口闭合复位，偏转角归零。\`,
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
          description: \`• 步骤 1：经穿刺器置入器械，保持钳口闭合。
• 步骤 2：确认初始偏转角度为 0°。
• 步骤 3：直视下平稳推进至目标组织，避免钩挂。\`,
          illustration: 'M10,40 L70,40',
          recordPoints: [
            { id: 'rp1-1', label: '置入阻力感知', value: '', editable: true, guidance: '主管评分 1-10 (1=极轻松)' },
            { id: 'rp1-1b', label: '推进对准时间', value: '', editable: true, unit: 's', guidance: '从入路到对准目标的时间' }
          ],
          status: 'pending' as const
        },
        {
          id: 'sop1-s2', code: 'S1-2', title: '阶段二：大角度偏转与到位',
          description: \`• 步骤 4：单手操作偏转，逐级增大角度并观察。
• 步骤 5：到达目标角度后锁定偏转。
• 步骤 6：微调器械，使钳口对准切割线。
• 步骤 7：确认钳口完全包绕目标组织。\`,
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
          description: \`• 步骤 8：闭合钳口，观察组织均匀压入。
• 步骤 9：检查厚度读数，确认与钉仓适配。
• 步骤 10：确认无周边组织被误夹。
• 步骤 11：启动电动击发，保持器械稳定。
• 步骤 12：等待进度条 100% 及完成提示。
• 步骤 13：松开钳口，缓慢退出器械。\`,
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
          description: \`• 步骤 14：检查切割线平直、成钉良好。
• 步骤 15：检查无活动性出血。
• 步骤 16：确认周边组织无损伤。
【意外处理】偏转不足→重定位；厚度超限→换钉仓；卡顿→电动回刀。\`,
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
          description: \`• 步骤 1：直视评估目标组织厚度。
• 步骤 2：选择适配钉仓。
• 步骤 3：装载钉仓并确认设备识别。
• 步骤 4：核对匹配度，不匹配则更换。\`,
          illustration: 'M20,20 L60,20 M20,60 L60,60 M20,40 L60,40',
          recordPoints: [
            { id: 'rp2-1', label: '组织预估厚度', value: '', editable: true, unit: 'mm' },
            { id: 'rp2-1b', label: '显示屏读数延迟', value: '', editable: true, unit: 's' }
          ],
          status: 'pending' as const
        },
        {
          id: 'sop2-s2', code: 'S2-2', title: '阶段二：钳口闭合与智能压榨',
          description: \`• 步骤 5：钳口完全包绕组织，均匀分布。
• 步骤 6：缓慢施压闭合，观察压力指示。
• 步骤 7：启动智能压榨等待倒计时。
• 步骤 8：等待压榨完成的双重提示。
• 步骤 9：(薄组织可酌情跳过压榨)。\`,
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
          description: \`• 步骤 10：确认厚度读数稳定(>2秒)。
• 步骤 11：匀速电动击发，勿手动施力。
• 步骤 12：如遇组织滑脱立即停止。
• 步骤 13：等待击发完成双重确认。
• 步骤 14：松开钳口，检查成钉质量。\`,
          illustration: 'M10,40 L70,40 M40,20 L40,60',
          recordPoints: [
            { id: 'rp2-4', label: '厚度读数稳定期', value: '', editable: true, unit: 's', recommended: '>2' },
            { id: 'rp2-5', label: '击发后震动感', value: '', editable: true, guidance: '手柄传递震动主观评分' }
          ],
          status: 'pending' as const
        },
        {
          id: 'sop2-s4', code: 'S2-4', title: '阶段四：止血确认与意外分支',
          description: \`• 步骤 15：观察 30 秒确认无活动出血。
• 步骤 16：评估渗血，必要时处理。
• 步骤 17：记录出血情况。
【意外处理】组织过厚/外溢→重定位或换仓；浮钉→补缝。\`,
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
          description: \`• 步骤 1：规划切割路径与钉仓数量。
• 步骤 2：制定分段击发策略。
• 步骤 3：准备足量适配钉仓。
• 步骤 4：规划过渡区钉仓颜色梯度。\`,
          illustration: 'M10,40 L30,40 M35,40 L55,40 M60,40 L80,40',
          recordPoints: [
            { id: 'rp3-1', label: '总切割长度', value: '', editable: true, unit: 'mm' },
            { id: 'rp3-1b', label: '规划耗时', value: '', editable: true, unit: 's' }
          ],
          status: 'pending' as const
        },
        {
          id: 'sop3-s2', code: 'S3-2', title: '阶段二：分段击发循环',
          description: \`• 步骤 5：首段对准起点，留起始重叠。
• 步骤 6：闭合钳口并检查厚度。
• 步骤 7：压榨后击发首段，确认 100%。
• 步骤 8：松开检查首段完整。
• 步骤 9：次段与前段重叠 2-3mm。
• 步骤 10-11：重复闭合-压榨-击发。
• 步骤 12：末段预留安全边距。\`,
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
          description: \`• 步骤 13：逐段检查切割线及交界处。
• 步骤 14：确认钉线连续无漏钉。
• 步骤 15：观察 60 秒确认无活动出血。
• 步骤 16：标记交界处渗血高发区。
• 步骤 17：必要时电凝或补针。\`,
          illustration: 'M20,40 L40,60 L70,20',
          recordPoints: [
            { id: 'rp3-4', label: '交界处渗血率', value: '', editable: true, unit: '%' },
            { id: 'rp3-4b', label: '吻合口面积评估', value: '', editable: true, unit: 'mm²' }
          ],
          status: 'pending' as const
        },
        {
          id: 'sop3-s4', code: 'S3-4', title: '阶段四：术后记录与意外分支',
          description: \`• 步骤 18：记录击发次数与钉仓。
• 步骤 19：记录出血情况。
• 步骤 20：器械按规范废弃。
【意外处理】钉线断裂/出血→电凝补缝/追加击发；移位→重新定位。\`,
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
        id: \`t1-\${scenario.id}\`,
        code: 'T1',
        title: '场景默认任务',
        description: '请描述在该场景下的核心人机交互任务',
        illustration: 'M30,30 h20 v20 h-20 z',
        recordPoints: [
          { id: \`rp1-\${scenario.id}\`, label: '关键指标测量', value: '', editable: true }
        ],
        status: 'pending' as const,
        isCustom: true
      }
    ];
  };
`;

content = content.substring(0, oldFuncStart) + newFunc + content.substring(oldFuncEnd);
fs.writeFileSync(filePath, content);
console.log('done updating detailed scenarios to clean up brands and simplify');
