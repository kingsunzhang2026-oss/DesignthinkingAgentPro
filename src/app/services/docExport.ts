/**
 * 测试记录 Word 导出服务
 * - 出声报告（按账号 + 登录会话分组）导出
 * - 整体测试记录报告（SOP 完成度 / 量化记录点 / 手部工效评分 / 录音转写 / 人机对齐分析）
 *
 * 使用 docx 库在浏览器端生成 .docx 并触发下载，无需后端。
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from 'docx';

/** 一段出声报告录音（字段与 InspectorPanel.Recording 对齐） */
export interface ExportRecording {
  id: string;
  url: string;
  scenarioId: string;
  at: number;
  uploading?: boolean;
  localOnly?: boolean;
  transcript?: string;
  transcriptError?: string;
  account?: string;
  sessionId?: string;
}

interface ExportTask {
  code: string;
  title: string;
  status: 'completed' | 'active' | 'pending';
  description: string;
  recordPoints?: { label: string; value: string; unit?: string }[];
  branchCards?: { trigger: string; action: string }[];
}

interface ExportSequence {
  scenarioTitle: string;
  scenarioDescription: string;
  tasks: ExportTask[];
}

interface DeviationItem {
  title: string;
  description: string;
  priority: string;
  improvement: string;
  severity: 'warning' | 'error';
}

const FONT = '微软雅黑';

function statusText(s: string): string {
  return s === 'completed' ? '已完成' : s === 'active' ? '进行中' : '未开始';
}

// 简单的中文友好单元格边框
const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' } as const;
const tableBorders = {
  top: cellBorder,
  bottom: cellBorder,
  left: cellBorder,
  right: cellBorder,
  insideHorizontal: cellBorder,
  insideVertical: cellBorder,
};

function p(text: string, opts: { size?: number; bold?: boolean; color?: string; italic?: boolean } = {}) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        font: FONT,
        size: (opts.size ?? 21) * 2, // docx 用半磅单位
        bold: opts.bold ?? false,
        color: opts.color ?? '000000',
        italics: opts.italic ?? false,
      }),
    ],
  });
}

function heading(text: string, level: 1 | 2 | 3 = 1) {
  const sizes = { 1: 32, 2: 26, 3: 23 } as const;
  return new Paragraph({
    heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({ text, font: FONT, size: sizes[level] * 2, bold: true, color: '1F4E79' }),
    ],
  });
}

function cell(text: string, opts: { bold?: boolean; width?: number; color?: string } = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    borders: tableBorders,
    children: [
      new Paragraph({
        children: [
          new TextRun({ text, font: FONT, size: 20, bold: opts.bold ?? false, color: opts.color ?? '000000' }),
        ],
      }),
    ],
  });
}

// ——————————————————————————————————————————————
// 分组工具
// ——————————————————————————————————————————————
function groupRecordings(recordings: ExportRecording[]) {
  const groups: Record<string, { account: string; at: number; items: ExportRecording[] }> = {};
  recordings.forEach((r) => {
    const key = `${r.account || '未登录'}__${r.sessionId || 'default'}`;
    if (!groups[key]) groups[key] = { account: r.account || '未登录', at: r.at, items: [] };
    groups[key].items.push(r);
  });
  return Object.values(groups).sort((a, b) => b.at - a.at);
}

function ts(t: number): string {
  try { return new Date(t).toLocaleString('zh-CN'); } catch { return String(t); }
}

// ——————————————————————————————————————————————
// 下载
// ——————————————————————————————————————————————
function download(doc: Document, filename: string) {
  Packer.toBlob(doc).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

// ——————————————————————————————————————————————
// 导出一：出声报告（按账号分组）
// ——————————————————————————————————————————————
export function exportRecordingsByAccount(recordings: ExportRecording[]) {
  const groups = groupRecordings(recordings);
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: '出声报告录音转写', font: FONT, size: 36, bold: true, color: '1F4E79' })],
    })
  );
  children.push(p(`导出时间：${ts(Date.now())}`, { size: 18, color: '666666' }));
  children.push(p(`共 ${recordings.length} 段录音，按「账号 + 登录会话」分为 ${groups.length} 组。`, { size: 18, color: '666666' }));

  if (groups.length === 0) {
    children.push(p('（暂无录音记录）'));
  }

  groups.forEach((g, gi) => {
    children.push(heading(`第 ${gi + 1} 组 · ${g.account}`, 2));
    children.push(p(`会话开始时间：${ts(g.at)}`, { size: 18, color: '666666' }));
    g.items.forEach((r, i) => {
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 40 },
          children: [
            new TextRun({ text: `#${i + 1}  [${ts(r.at)}]`, font: FONT, size: 21, bold: true, color: '2E75B6' }),
          ],
        })
      );
      if (r.transcript) {
        children.push(p(`转写内容：${r.transcript}`));
      } else if (r.transcriptError) {
        children.push(p(`转写失败：${r.transcriptError}`, { color: 'C00000' }));
      } else if (r.localOnly) {
        children.push(p('（仅本地录音，未上传云端，无法转写）', { color: 'BF8F00' }));
      } else {
        children.push(p('（暂未转写）', { color: '666666' }));
      }
      children.push(p(`音频地址：${r.url}`, { size: 16, color: '808080' }));
    });
  });

  const doc = new Document({ sections: [{ children }] });
  const date = new Date().toISOString().slice(0, 10);
  download(doc, `出声报告_分组_${date}.docx`);
}

// ——————————————————————————————————————————————
// 导出二：整体测试记录报告
// ——————————————————————————————————————————————
export function exportFullReport(opts: {
  projectName: string;
  taskSequences: ExportSequence[];
  regionScores: Record<string, number>;
  regionNotes: Record<string, string>;
  regionLabelMap: Record<string, string>;
  recordings: ExportRecording[];
  deviationItems: DeviationItem[];
  alignmentAnalyzed: boolean;
}) {
  const { projectName, taskSequences, regionScores, regionNotes, regionLabelMap, recordings, deviationItems, alignmentAnalyzed } = opts;
  const children: Paragraph[] = [];

  // 封面
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: '医疗器械工效学测试记录报告', font: FONT, size: 44, bold: true, color: '1F4E79' })],
    })
  );
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: projectName, font: FONT, size: 28, bold: true })] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: `生成时间：${ts(Date.now())}`, font: FONT, size: 20, color: '666666' })] }));

  // 一、SOP 任务完成度
  children.push(heading('一、SOP 行为序列任务完成度', 1));
  if (taskSequences.length === 0) {
    children.push(p('（暂无 SOP 任务数据）'));
  }
  taskSequences.forEach((seq) => {
    children.push(heading(`${seq.scenarioTitle}`, 2));
    if (seq.scenarioDescription) children.push(p(seq.scenarioDescription, { size: 19, color: '444444' }));
    const rows = [
      new TableRow({ children: [cell('步骤编码', { bold: true }), cell('任务', { bold: true }), cell('状态', { bold: true }), cell('说明', { bold: true })] }),
    ];
    seq.tasks.forEach((t) => {
      rows.push(
        new TableRow({
          children: [cell(t.code), cell(t.title), cell(statusText(t.status)), cell(t.description)],
        })
      );
    });
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
  });

  // 二、量化记录点汇总
  children.push(heading('二、量化记录点汇总', 1));
  const rpRows = [new TableRow({ children: [cell('所属场景', { bold: true }), cell('记录点', { bold: true }), cell('实测值', { bold: true })] })];
  let rpCount = 0;
  taskSequences.forEach((seq) => {
    seq.tasks.forEach((t) => {
      (t.recordPoints || []).forEach((rp) => {
        rpCount++;
        const val = rp.value ? `${rp.value}${rp.unit || ''}` : '（未填写）';
        rpRows.push(new TableRow({ children: [cell(t.title), cell(rp.label), cell(val)] }));
      });
      (t.branchCards || []).forEach((bc) => {
        // 异常分支卡片若有记录点可在此扩展
        void bc;
      });
    });
  });
  if (rpCount === 0) {
    children.push(p('（暂无量化记录点数据）'));
  } else {
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: rpRows }));
  }

  // 三、手部工效疲劳评分（Borg CR10）
  children.push(heading('三、手部工效疲劳评分（Borg CR10，0–10）', 1));
  const scoredKeys = Object.keys(regionScores).filter((k) => regionScores[k] != null);
  if (scoredKeys.length === 0) {
    children.push(p('（暂无手部热区评分数据）'));
  } else {
    const hRows = [new TableRow({ children: [cell('手部区域', { bold: true }), cell('疲劳评分(0-10)', { bold: true }), cell('备注', { bold: true })] })];
    scoredKeys.forEach((k) => {
      hRows.push(new TableRow({ children: [cell(regionLabelMap[k] || k), cell(String(regionScores[k])), cell(regionNotes[k] || '—')] }));
    });
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: hRows }));
    const avg = (scoredKeys.reduce((s, k) => s + (regionScores[k] || 0), 0) / scoredKeys.length).toFixed(1);
    children.push(p(`已评 ${scoredKeys.length} 个区域，平均疲劳评分 ${avg} / 10。`, { size: 19, bold: true }));
  }

  // 四、出声报告录音转写
  children.push(heading('四、出声报告录音转写', 1));
  const groups = groupRecordings(recordings);
  if (groups.length === 0) {
    children.push(p('（暂无录音记录）'));
  }
  groups.forEach((g, gi) => {
    children.push(heading(`第 ${gi + 1} 组 · ${g.account}`, 3));
    children.push(p(`会话开始时间：${ts(g.at)}`, { size: 18, color: '666666' }));
    g.items.forEach((r, i) => {
      children.push(p(`#${i + 1} [${ts(r.at)}]`, { bold: true, color: '2E75B6' }));
      if (r.transcript) children.push(p(`转写：${r.transcript}`));
      else if (r.transcriptError) children.push(p(`转写失败：${r.transcriptError}`, { color: 'C00000' }));
      else children.push(p(r.localOnly ? '（仅本地，未上传）' : '（暂未转写）', { color: '666666' }));
    });
  });

  // 五、人机对齐分析报告
  children.push(heading('五、人机工程对齐分析报告', 1));
  if (!alignmentAnalyzed) {
    children.push(p('（尚未执行对齐分析，请先在「人机工程对齐节点」点击「执行对齐分析」）'));
  } else if (deviationItems.length === 0) {
    children.push(p('分析完成：未识别到显著偏差项。'));
  } else {
    const dRows = [
      new TableRow({ children: [cell('偏差项', { bold: true }), cell('说明', { bold: true }), cell('优先级', { bold: true }), cell('改进建议', { bold: true })] }),
    ];
    deviationItems.forEach((d) => {
      dRows.push(new TableRow({ children: [cell(d.title), cell(d.description), cell(d.priority), cell(d.improvement)] }));
    });
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: dRows }));
  }

  const doc = new Document({ sections: [{ children }] });
  const date = new Date().toISOString().slice(0, 10);
  download(doc, `整体测试记录报告_${date}.docx`);
}
