import React, { useState, useRef, useEffect } from 'react';
import { ContextPanel } from './panels/ContextPanel';
import { BehaviorPanel } from './panels/BehaviorPanel';
import { AlignmentPanel } from './panels/AlignmentPanel';
import { ProblemNodePanel } from './panels/ProblemNodePanel';
import { SolutionNodePanel } from './panels/SolutionNodePanel';
import { ValueNodePanel } from './panels/ValueNodePanel';
import { ChevronRight } from 'lucide-react';
import { ScenarioData, TaskSequence } from '../App';
import { supabase } from '../utils/supabase/client';
import { uploadAudioReport } from '../services/storage';
import { transcribeAudio } from '../services/asr';
import { savePanelState } from '../services/panelArchive';

/** 一段出声报告录音（跨节点切换持久化，挂在 InspectorPanel 上） */
export interface Recording {
  id: string;
  url: string;          // 本地可播（webm）或云端（wav）地址
  scenarioId: string;
  at: number;
  uploading?: boolean;
  localOnly?: boolean;
  transcribing?: boolean;
  transcript?: string;
  transcriptError?: string;
  account?: string;     // 登录账号（邮箱）；未登录为 "未登录"
  sessionId?: string;   // 一次实验会话（用户登录态变化时重新生成）
}

/**
 * 浏览器录制的 webm/opus → 16-bit PCM WAV。
 * 火山 AUC 极速版按 format:"wav" 解码最稳定（已实测 wav 可识别），
 * 而 MediaRecorder 默认产出 webm，故上传/转写前先转码。
 */
async function webmToWav(webm: Blob): Promise<Blob> {
  const arrayBuffer = await webm.arrayBuffer();
  const AC: typeof AudioContext =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) throw new Error('当前浏览器不支持 AudioContext');
  const ctx = new AC();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const numCh = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const frames = audioBuffer.length;
    const bytesPerSample = 2;
    const blockAlign = numCh * bytesPerSample;
    const dataSize = frames * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    const writeStr = (off: number, s: string) => {
      for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numCh, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 8 * bytesPerSample, true);
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);
    // 交错写入 16-bit PCM
    const channels: Float32Array[] = [];
    for (let c = 0; c < numCh; c++) channels.push(audioBuffer.getChannelData(c));
    let offset = 44;
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < numCh; c++) {
        let s = Math.max(-1, Math.min(1, channels[c][i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }
    }
    return new Blob([buffer], { type: 'audio/wav' });
  } finally {
    ctx.close();
  }
}

interface InspectorPanelProps {
  activeProjectId: string;
  selectedNode: string | null;
  onToggleCollapse: () => void;
  scenarios: any[];
  onScenariosChange: (scenarios: any[]) => void;
  knowledgeBase: any[];
  onTaskStatsChange: (stats: any) => void;
  taskStats: any;
  taskSequences: any[];
  onTaskSequencesChange: (sequences: any[]) => void;
}

export function InspectorPanel({ 
  activeProjectId,
  selectedNode, 
  onToggleCollapse, 
  scenarios, 
  onScenariosChange,
  knowledgeBase,
  onTaskStatsChange,
  taskStats,
  taskSequences,
  onTaskSequencesChange
}: InspectorPanelProps) {
  if (!selectedNode) return null;

  // —— 出声报告录音：整套挂在 InspectorPanel（切节点不卸载，故历史不丢、录制不中断）——
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTask, setRecordingTask] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [currentRecIdx, setCurrentRecIdx] = useState(0);

  // 一次实验会话：用户登录态（含登出/登录不同账号）变化时重新生成
  const [loginSessionId, setLoginSessionId] = useState(() => crypto.randomUUID());
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      setLoginSessionId(crypto.randomUUID());
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // 录音记录落库（含转写/账号/会话/时间戳）：写入 node_panel_data(records/global)，存档中心集中查看
  useEffect(() => {
    if (recordings.length === 0) return;
    const t = setTimeout(() => {
      savePanelState('default', 'global', 'records', {
        recordings: recordings.map((r) => ({
          id: r.id,
          scenarioId: r.scenarioId,
          account: r.account || '未登录',
          sessionId: r.sessionId || '',
          at: r.at,
          url: r.url,
          transcript: r.transcript || '',
          status: r.transcript ? 'done' : r.transcribing ? 'transcribing' : r.localOnly ? 'local' : r.uploading ? 'uploading' : 'uploaded',
        })),
      }).catch((e) => console.warn('录音记录落库失败', e));
    }, 900);
    return () => clearTimeout(t);
  }, [recordings]);

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
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const webmBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const localUrl = URL.createObjectURL(webmBlob);
        const sid = scenarioId;
        const recId = crypto.randomUUID();

        // 追加到列表（不覆盖），并把当前段切到最新一段
        const { data: { session } } = await supabase.auth.getSession();
        const account = session?.user?.email || '未登录';
        setRecordings((prev) => {
          const next = [...prev, { id: recId, url: localUrl, scenarioId: sid, at: Date.now(), uploading: true, account, sessionId: loginSessionId }];
          setCurrentRecIdx(next.length - 1);
          return next;
        });

        // webm → wav（用于云端存储与转写，匹配 format:"wav"）
        let uploadBlob: Blob = webmBlob;
        try {
          const wav = await webmToWav(webmBlob);
          uploadBlob = wav;
        } catch (e) {
          console.warn('webm→wav 转换失败，将用原始 webm 上传:', e);
        }

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            setRecordings((prev) => prev.map((r) => (r.id === recId ? { ...r, uploading: false, localOnly: true } : r)));
            alert('录音已本地保存可播放，但上传云端需先登录：点击左侧栏「登录账号」（演示账号 admin@make.com / admin123）。');
            return;
          }
          const file = new File([uploadBlob], `report_${Date.now()}.wav`, { type: uploadBlob.type || 'audio/wav' });
          const publicUrl = await uploadAudioReport(file, sid);
          setRecordings((prev) => prev.map((r) => (r.id === recId ? { ...r, url: publicUrl, uploading: false, transcribing: true } : r)));
          try {
            const text = await transcribeAudio(publicUrl, 'zh-CN');
            setRecordings((prev) => prev.map((r) => (r.id === recId ? { ...r, transcribing: false, transcript: text } : r)));
          } catch (e: any) {
            console.error('转写失败:', e);
            setRecordings((prev) => prev.map((r) => (r.id === recId ? { ...r, transcribing: false, transcriptError: e.message } : r)));
          }
        } catch (err: any) {
          console.error('录音上传失败:', err);
          alert('录音上传失败: ' + err.message + '\n（已保留本地播放，刷新页面前仍可收听）');
          setRecordings((prev) => prev.map((r) => (r.id === recId ? { ...r, uploading: false } : r)));
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

  const getNodeTitle = (nodeId: string) => {
    const type = nodeId.split('-')[0];
    const titles: Record<string, string> = {
      context: '情境语义扩展节点',
      behavior: '行为序列SOP节点',
      alignment: '人机工程对齐节点',
      problem: '问题节点',
      solution: '方案节点',
      value: '价值节点'
    };
    return titles[type] || '节点属性';
  };

  const getNodeType = (nodeId: string) => {
    if (nodeId === 'context' || nodeId === 'behavior' || nodeId === 'alignment') {
      return nodeId;
    }
    return nodeId.split('-')[0];
  };

  const nodeType = getNodeType(selectedNode);

  const activeKnowledgeBase = knowledgeBase.filter(doc => !doc.projectId || doc.projectId === activeProjectId);

  return (
    <div className="w-[480px] bg-card border-l border-border flex flex-col overflow-hidden">
      {/* Panel Header */}
      <div className="h-14 border-b border-border flex items-center justify-between px-6">
        <h2 className="text-foreground">{getNodeTitle(selectedNode)}</h2>
        <button
          onClick={onToggleCollapse}
          className="p-1 hover:bg-accent rounded transition-colors"
          title="收起侧边栏"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto">
        {nodeType === 'context' && (
          <ContextPanel 
            scenarios={scenarios}
            onScenariosChange={onScenariosChange}
            knowledgeBase={activeKnowledgeBase}
          />
        )}
        {nodeType === 'behavior' && (
          <BehaviorPanel
            activeProjectId={activeProjectId}
            nodeId={selectedNode}
            scenarios={scenarios}
            onTaskStatsChange={onTaskStatsChange}
            taskStats={taskStats}
            taskSequences={taskSequences}
            onTaskSequencesChange={onTaskSequencesChange}
            recordings={recordings}
            setRecordings={setRecordings}
            currentRecIdx={currentRecIdx}
            setCurrentRecIdx={setCurrentRecIdx}
            isRecording={isRecording}
            recordingTask={recordingTask}
            startRecording={startRecording}
            stopRecording={stopRecording}
          />
        )}
        {nodeType === 'alignment' && (
          <AlignmentPanel 
            onAnalysisComplete={(deviations) => {
              onTaskStatsChange((prev: any) => ({
                ...prev,
                alignment: { analyzed: true, deviations: deviations.length, deviationItems: deviations }
              }));
              // 对齐分析结果落库（node_panel_data, alignment 类型），刷新/跨会话保留
              if (selectedNode) {
                savePanelState('default', selectedNode, 'alignment', {
                  deviationItems: deviations,
                  analyzedAt: new Date().toISOString(),
                }).catch((e) => console.warn('对齐分析落库失败', e));
              }
            }}
            knowledgeBase={activeKnowledgeBase}
            taskSequences={taskSequences}
          />
        )}
        {nodeType === 'problem' && <ProblemNodePanel nodeId={selectedNode} />}
        {nodeType === 'solution' && <SolutionNodePanel nodeId={selectedNode} />}
        {nodeType === 'value' && <ValueNodePanel />}
      </div>
    </div>
  );
}
