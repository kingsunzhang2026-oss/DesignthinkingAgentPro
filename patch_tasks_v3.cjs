const fs = require('fs');
const filePath = 'src/app/components/panels/BehaviorPanel.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldFuncStart = content.indexOf('  const generateTasksForScenario = (scenario: ScenarioData): Task[] => {');
const oldFuncEnd = content.indexOf('  // Update stats when tasks change', oldFuncStart);

const newFunc = `  const generateTasksForScenario = (scenario: ScenarioData): Task[] => {
    // --------------------------------------------------------
    // stapler-v3 腹腔镜用智能电动吻合器V3
    // --------------------------------------------------------
    
    // 【SOP-0】通用术前自检
    const sop0: Task = {
      id: \`sop0-\${scenario.id}\`,
      code: 'SOP-0',
      title: '通用术前自检（独立篇）',
      description: \`适用范围：威克医疗一次性腔镜用直线型全电动切割吻合器及钉仓组件的所有使用场景。
• 步骤 1：包装完整性检查。取出无菌包装，检查外包装有无破损、受潮、污染痕迹；核对灭菌有效期。
• 步骤 2：设备装配确认。确认吻合器手柄与钉仓组件型号匹配，检查无松动裂缝。
• 步骤 3：开机。按下电源键开机，观察显示屏是否亮起并进入待机界面。
• 步骤 4：系统自检确认。观察显示屏无故障代码，电量充足。
• 步骤 5：双侧按键功能测试。分别轻按手柄左右两侧按键，确认清晰的机械"咔嗒"反馈、按键回弹正常。
• 步骤 6：钉仓装载与识别。确认钉仓卡入到位（听到到位声）。观察显示屏是否自动识别型号/颜色。
• 步骤 7：空载击发测试。未夹组织执行一次空载击发，确认电机运转声音正常无卡顿。
• 步骤 8：功能复位。完成自检后，确认钳口闭合复位，偏转角归零。\`,
      illustration: 'M20,20 L60,20 L60,60 L20,60 Z M30,40 L45,40 M45,40 L40,35 M45,40 L40,45', 
      recordPoints: [
        { id: 'rp0-1', label: '开机自检时长', value: '', editable: true, unit: 's', range: '1-5', recommended: '<3', guidance: '步骤3-4：按下电源键到进入待机界面的时间' },
        { id: 'rp0-2', label: '双侧按键按压力', value: '', editable: true, unit: 'N', guidance: '步骤5：侧边辅助按键操作舒适度测量' },
        { id: 'rp0-3', label: '钉仓识别速度', value: '', editable: true, unit: 's', recommended: '<1', guidance: '步骤6：装载卡入到显示屏识别的时间' },
        { id: 'rp0-4', label: '空载击发声音', value: '', editable: true, unit: 'dB', guidance: '步骤7：电机运转噪音，建议<65dB' }
      ],
      status: 'pending' as const
    };

    if (scenario.id === 'stapler-scene-1') {
      return [
        sop0,
        {
          id: 'sop1-s1', code: 'S1-1', title: '阶段一：入路与定位',
          description: \`• 步骤 1：通过 Trocar 置入器械头端，保持钳口闭合状态，避免损伤组织。确认头端完整进入腔体。
• 步骤 2：在显示屏确认初始偏转角度为 0°，避免未察觉的偏转导致误伤。
• 步骤 3：直视下将钳口缓慢推进至目标组织，全程保持钳口平行于组织平面，确认无阻力、无组织钩挂。\`,
          illustration: 'M10,40 L70,40',
          recordPoints: [
            { id: 'rp1-1', label: '置入阻力感知', value: '', editable: true, guidance: '主管评分 1-10 (1=极轻松)' },
            { id: 'rp1-1b', label: '推进对准时间', value: '', editable: true, unit: 's', guidance: '从入路到对准目标的时间' }
          ],
          status: 'pending' as const
        },
        {
          id: 'sop1-s2', code: 'S1-2', title: '阶段二：大角度偏转与到位',
          description: \`• 步骤 4：单手拇指操作偏转控制，缓慢增大偏转角，逐级偏转，每 10°-15° 停顿观察一次。
• 步骤 5：到达目标角度（如 45°-60°）后锁定偏转机构，确认显示屏指示出现。
• 步骤 6：微调器械整体位置，利用偏转与轴向旋转组合，使钳口对准预定切割线。
• 步骤 7：确认钳口已完全包绕目标组织，组织全部进入钳口、无部分脱出。\`,
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
          description: \`• 步骤 8：按下闭合控制，闭合钳口，观察组织是否均匀压入。
• 步骤 9：检查显示屏组织厚度读数，确认与所选钉仓适配。
• 步骤 10：360° 观察钳口周边，确认无误夹。
• 步骤 11：按下击发按键启动电动击发，保持器械稳定不移动，观察显示屏进度。
• 步骤 12：观察击发完成反馈，进度条 100% 且出现完成提示音。
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
          description: \`• 步骤 14：检查切割线是否平直、无成钉不良。
• 步骤 15：检查吻合口有无活动性出血或渗血。
• 步骤 16：确认周边组织无撕裂、无灼伤。
【意外分支SOP】
• 偏转角度不足 → 重新选择 Trocar 位置或改用手动辅助定位。
• 钳口无法完全包绕 → 撤出重新定位，禁止强行击发。
• 组织厚度超限 → 松开钳口，更换更大规格钉仓。
• 击发中卡顿 → 立即停止，电动回刀，查明原因。\`,
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
          description: \`• 步骤 1：直视下评估目标组织厚度，预估压缩后厚度。
• 步骤 2：选择适配钉仓，厚组织选绿色或黑色钉仓。
• 步骤 3：装载所选钉仓，确认显示屏识别。
• 步骤 4：显示屏核对钉仓与组织匹配度，不匹配则更换。\`,
          illustration: 'M20,20 L60,20 M20,60 L60,60 M20,40 L60,40',
          recordPoints: [
            { id: 'rp2-1', label: '组织预估厚度', value: '', editable: true, unit: 'mm' },
            { id: 'rp2-1b', label: '显示屏读数延迟', value: '', editable: true, unit: 's' }
          ],
          status: 'pending' as const
        },
        {
          id: 'sop2-s2', code: 'S2-2', title: '阶段二：钳口闭合与智能压榨',
          description: \`• 步骤 5：钳口对准并完全包绕厚组织，确保组织均匀分布。
• 步骤 6：按下闭合控制，缓慢均匀施压，避免组织挤出。
• 步骤 7：启动智能压榨等待，让组织液充分重新分布，观察倒计时。
• 步骤 8：观察压榨状态反馈，压榨时间满足后出现声音与屏幕双重提示。
• 步骤 9：若为薄组织，术者可视情况跳过压榨等待。\`,
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
          description: \`• 步骤 10：确认压榨充分、组织厚度读数稳定（数值稳定 2 秒以上）。
• 步骤 11：启动电动击发，保持匀速，不额外手动施力。
• 步骤 12：全程观察，出现组织滑脱立即停止。
• 步骤 13：击发完成，等待双重确认。
• 步骤 14：松开钳口，检查成钉质量，确认无浮钉歪钉。\`,
          illustration: 'M10,40 L70,40 M40,20 L40,60',
          recordPoints: [
            { id: 'rp2-4', label: '厚度读数稳定期', value: '', editable: true, unit: 's', recommended: '>2' },
            { id: 'rp2-5', label: '击发后震动感', value: '', editable: true, guidance: '手柄传递震动主观评分' }
          ],
          status: 'pending' as const
        },
        {
          id: 'sop2-s4', code: 'S2-4', title: '阶段四：止血确认与意外分支',
          description: \`• 步骤 15：观察吻合口 30 秒，确认无活动性出血。
• 步骤 16：如有渗血，评估是否需补针或电凝。
• 步骤 17：记录出血情况。
【意外分支SOP】
• 压榨后组织仍过厚 → 松开，考虑更换更厚规格钉仓。
• 压榨中组织外溢 → 立即停止闭合，重新定位钳口。
• 击发中组织滑脱 → 停止击发，电动回刀，重新操作。
• 成钉不良（浮钉）→ 评估是否需补缝，记录原因。\`,
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
          description: \`• 步骤 1：规划整体切割路径，评估切割线长度与所需钉仓数量。
• 步骤 2：确定分段击发策略，超过单钉仓长度时规划 2—3 次击发。
• 步骤 3：准备足量钉仓（含备用，通常需 2—4 个）。
• 步骤 4：若需多次击发，规划钉仓颜色梯度。\`,
          illustration: 'M10,40 L30,40 M35,40 L55,40 M60,40 L80,40',
          recordPoints: [
            { id: 'rp3-1', label: '总切割长度', value: '', editable: true, unit: 'mm' },
            { id: 'rp3-1b', label: '规划耗时', value: '', editable: true, unit: 's' }
          ],
          status: 'pending' as const
        },
        {
          id: 'sop3-s2', code: 'S3-2', title: '阶段二：分段击发循环',
          description: \`• 步骤 5：第一段，对准切割线起点，留出 2—3mm 起始重叠。
• 步骤 6：闭合钳口，确认组织均匀，观察显示屏厚度读数。
• 步骤 7：充分压榨后电动击发第一段，确认进度 100%。
• 步骤 8：松开钳口，检查第一段完整。
• 步骤 9：第二段，钳口与第一段末端重叠 2—3mm。
• 步骤 10-11：重复闭合-压榨-击发流程，依次完成后续分段。
• 步骤 12：最后一段留出 2—3mm 末端安全边距。\`,
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
          description: \`• 步骤 13：逐段检查切割线，重点检查每段交界处。
• 步骤 14：检查钉线连续性，确认无漏钉或间隙。
• 步骤 15：观察全程吻合口 60 秒，确认无活动性出血。
• 步骤 16：标记渗血高发区（分段交界处）。
• 步骤 17：必要时对渗血点补针或电凝止血。\`,
          illustration: 'M20,40 L40,60 L70,20',
          recordPoints: [
            { id: 'rp3-4', label: '交界处渗血率', value: '', editable: true, unit: '%' },
            { id: 'rp3-4b', label: '吻合口面积评估', value: '', editable: true, unit: 'mm²' }
          ],
          status: 'pending' as const
        },
        {
          id: 'sop3-s4', code: 'S3-4', title: '阶段四：术后记录与意外分支',
          description: \`• 步骤 18：记录击发次数、钉仓类型。
• 步骤 19：记录出血情况。
• 步骤 20：一次性器械按规范废弃处理。
【意外分支SOP】
• 段间钉线断裂或间隙 → 评估是否需补缝，记录位置。
• 段间交界处出血 → 电凝或补针止血，必要时追加击发。
• 组织厚度不均匀 → 分段更换适配钉仓。
• 击发中器械移位 → 停止击发，重新定位该段。
• 钉仓耗尽 → 及时补充，避免术中断供。\`,
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
