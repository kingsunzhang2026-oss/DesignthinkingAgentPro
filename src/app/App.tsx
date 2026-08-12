import React, { useState, useEffect } from 'react';
import { NodeCanvas } from './components/NodeCanvas';
import { Sidebar } from './components/Sidebar';
import { InspectorPanel } from './components/InspectorPanel';
import { SettingsModal } from './components/SettingsModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SolutionCompareView } from './components/SolutionCompareView';
import { DesignProvider } from './services/designStore';
import { performStartupCheck } from './services/debug';
import { PROJECTS } from './config/projects';

export interface ScenarioData {
  id: string;
  type: string;
  title: string;
  description: string;
  parameters: { label: string; value: string }[];
  selected: boolean;
}

export interface RecordPoint {
  id: string;
  label: string;
  value: string;
  editable: boolean;
  unit?: string;
  range?: string;
  recommended?: string;
  guidance?: string;
  risk?: string;
}

export interface Task {
  id: string;
  code: string;
  title: string;
  description: string;
  recordPoints: RecordPoint[];
  status: 'completed' | 'active' | 'pending';
  illustration: string;
  isCustom?: boolean;
}

export interface TaskSequence {
  scenarioId: string;
  scenarioTitle: string;
  scenarioDescription: string;
  tasks: Task[];
}

export interface NodeData {
  id: string;
  type: string;
  label: string;
  shortLabel: string;
  position: { x: number; y: number };
  status: 'pending' | 'active' | 'validated';
  properties?: any;
  isGroup?: boolean;
  groupNodes?: string[];
}

export interface Connection {
  id: string;
  from: string;
  to: string;
  fromPort?: string;
  toPort?: string;
}

export default function App() {
  const [activeProjectId, setActiveProjectId] = useState<string>(PROJECTS[0].id);
  const currentProject = PROJECTS.find(p => p.id === activeProjectId) || PROJECTS[0];

  const [nodes, setNodes] = useState<NodeData[]>(currentProject.initialNodes);
  const [connections, setConnections] = useState<Connection[]>(currentProject.initialConnections);

  // When activeProject changes, reset nodes and connections
  useEffect(() => {
    const project = PROJECTS.find(p => p.id === activeProjectId) || PROJECTS[0];
    setNodes(project.initialNodes);
    setConnections(project.initialConnections);
    // Auto-select first node of the new project
    setSelectedNode(project.initialNodes.length > 0 ? project.initialNodes[0].id : null);
    
    // Clear scenarios and tasks when switching projects to avoid data leaking
    if (project.id === 'forceps-v2') {
      setScenarios([
        {
          id: 'standard',
          type: '常规临床场景',
          title: '标准化缝合场景',
          description: '模拟标准化缝合，室内光照充足',
          parameters: [
            { label: '光照强度', value: '500-750 lux' },
            { label: '环境温度', value: '22-24°C' },
            { label: '操作时长', value: '< 1小时' }
          ],
          selected: true
        },
        {
          id: 'fatigue',
          type: '长尾临床场景 1',
          title: '疲劳试验场景',
          description: '模拟连续手术第3小时，大鱼际肌群力量衰减 15%',
          parameters: [
            { label: '操作时长', value: '连续3小时' },
            { label: '肌群力量', value: '衰减15%' },
            { label: '精细控制', value: '降低' }
          ],
          selected: true
        },
        {
          id: 'extreme',
          type: '长尾临床场景 2',
          title: '极端环境场景',
          description: '模拟手套被生理盐水润湿，摩擦系数从 0.6 降至 0.2',
          parameters: [
            { label: '表面摩擦', value: 'μ=0.2' },
            { label: '抓握稳定性', value: '极易滑脱' }
          ],
          selected: false
        }
      ]);
    } else if (project.id === 'stapler-v3') {
      setScenarios([
        {
          id: 'stapler-scene-1',
          type: '胸腔镜肺叶切除',
          title: '狭小空间大角度偏转场景',
          description: '模拟胸腔镜下肺叶切除，操作空间狭小，需要大角度偏转钳口',
          parameters: [
            { label: '空间限制', value: '极度狭小' },
            { label: '偏转角度', value: '需60°' },
            { label: '组织厚度', value: '中等' }
          ],
          selected: true
        },
        {
          id: 'stapler-scene-2',
          type: '腹腔镜胃肠切除',
          title: '厚组织智能压榨场景',
          description: '模拟腹腔镜胃肠切除，组织较厚，需要芯片感知与智能压榨等待',
          parameters: [
            { label: '组织厚度', value: '偏厚' },
            { label: '智能感知', value: '必须' },
            { label: '出血风险', value: '高' }
          ],
          selected: true
        },
        {
          id: 'stapler-scene-3',
          type: '袖状胃切除术',
          title: '长切割线高止血要求场景',
          description: '长切割线，要求3D立体成钉以降低出血干预率',
          parameters: [
            { label: '切割线长度', value: '长' },
            { label: '成钉要求', value: '3D立体' },
            { label: '干预率期望', value: '↓23%' }
          ],
          selected: false
        }
      ]);
    } else {
      setScenarios([]);
    }

    setTaskSequences([]);
    setTaskCompletionStats({
      context: { 
        total: project.id === 'forceps-v2' ? 3 : (project.id === 'stapler-v3' ? 3 : 0), 
        selected: project.id === 'forceps-v2' ? 2 : (project.id === 'stapler-v3' ? 2 : 0) 
      },
      behavior: { total: 0, completed: 0 },
      alignment: { analyzed: false, deviations: 0 }
    });
  }, [activeProjectId]);

  const [selectedNode, setSelectedNode] = useState<string | null>('context');
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [knowledgeBase, setKnowledgeBase] = useState<any[]>([]);

  // 启动时环境检查（安全执行）
  useEffect(() => {
    try {
      performStartupCheck();
    } catch (e) {
      console.log('✅ Designthinking Agent Pro 已启动');
    }
    
    // 【增强版】全局错误处理器，捕获并抑制Figma环境的WASM错误
    const handleGlobalError = (event: ErrorEvent) => {
      const errorMsg = event.message || '';
      const errorFilename = event.filename || '';
      const errorStack = event.error?.stack || '';
      
      // 检测WASM相关错误（扩展检测模式）
      const isWasmError = 
        errorMsg.includes('wasm') || 
        errorMsg.includes('WASM') ||
        errorMsg.includes('wasm-function') ||
        errorFilename.includes('devtools_worker') ||
        errorFilename.includes('.wasm') ||
        errorFilename.includes('[wasm code]') ||
        errorStack.includes('wasm-function') ||
        errorStack.includes('[wasm code]') ||
        errorStack.includes('devtools_worker') ||
        // 新增：检测特定的 Figma webpack 文件
        errorFilename.includes('webpack-artifacts') ||
        errorStack.includes('webpack-artifacts');
      
      if (isWasmError) {
        // Figma环境的内部WASM错误，不影响应用功能
        console.debug('⚠️ Figma环境WASM警告（已忽略）:', errorMsg.substring(0, 100));
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) {
          event.stopImmediatePropagation();
        }
        return false;
      }
    };
    
    // 处理未捕获的Promise拒绝（可能来自WASM）
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.toString() || '';
      const stack = event.reason?.stack || '';
      
      // 检测WASM相关的Promise错误（扩展检测模式）
      const isWasmError = 
        reason.includes('wasm') ||
        reason.includes('WASM') ||
        stack.includes('devtools_worker') ||
        stack.includes('[wasm code]') ||
        stack.includes('wasm-function') ||
        stack.includes('webpack-artifacts');
      
      if (isWasmError) {
        console.debug('⚠️ Figma环境WASM Promise警告（已忽略）');
        event.preventDefault();
        if (event.stopPropagation) {
          event.stopPropagation();
        }
        return false;
      }
    };
    
    // 【新增】控制台错误拦截器 - 拦截 console.error 中的 WASM 错误
    const originalConsoleError = console.error;
    console.error = function(...args: any[]) {
      const errorString = args.join(' ');
      
      // 检测并过滤WASM相关的控制台错误
      const isWasmError = 
        errorString.includes('wasm') ||
        errorString.includes('WASM') ||
        errorString.includes('wasm-function') ||
        errorString.includes('[wasm code]') ||
        errorString.includes('devtools_worker') ||
        errorString.includes('webpack-artifacts');
      
      if (isWasmError) {
        console.debug('⚠️ Figma环境控制台WASM警告（已忽略）');
        return;
      }
      
      // 非WASM错误，正常输出
      originalConsoleError.apply(console, args);
    };
    
    // 【新增】控制台警告拦截器 - 拦截 console.warn 中的 WASM 警告
    const originalConsoleWarn = console.warn;
    console.warn = function(...args: any[]) {
      const warnString = args.join(' ');
      
      // 检测并过滤WASM相关的警告
      const isWasmWarn = 
        warnString.includes('wasm') ||
        warnString.includes('WASM') ||
        warnString.includes('wasm-function') ||
        warnString.includes('[wasm code]') ||
        warnString.includes('devtools_worker') ||
        warnString.includes('webpack-artifacts');
      
      if (isWasmWarn) {
        console.debug('⚠️ Figma环境控制台WASM警告（已忽略）');
        return;
      }
      
      // 非WASM警告，正常输出
      originalConsoleWarn.apply(console, args);
    };
    
    // 注册所有错误处理器（使用捕获阶段优先拦截）
    window.addEventListener('error', handleGlobalError, true);
    window.addEventListener('unhandledrejection', handleUnhandledRejection, true);
    
    // 清理函数
    return () => {
      window.removeEventListener('error', handleGlobalError, true);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
      
      // 恢复原始控制台方法
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
    };
  }, []);
  
  // Shared state for scenarios
  const [scenarios, setScenarios] = useState<ScenarioData[]>(currentProject.id === 'forceps-v2' ? [
    {
      id: 'standard',
      type: '常规临床场景',
      title: '标准化缝合场景',
      description: '模拟标准化缝合，室内光照充足',
      parameters: [
        { label: '光照强度', value: '500-750 lux' },
        { label: '环境温度', value: '22-24°C' },
        { label: '操作时长', value: '< 1小时' }
      ],
      selected: true
    },
    {
      id: 'fatigue',
      type: '长尾临床场景 1',
      title: '疲劳试验场景',
      description: '模拟连续手术第3小时，大鱼际肌群力量衰减 15%',
      parameters: [
        { label: '操作时长', value: '连续3小时' },
        { label: '肌群力量', value: '衰减15%' },
        { label: '精细控制', value: '降低' }
      ],
      selected: true
    },
    {
      id: 'extreme',
      type: '长尾临床场景 2',
      title: '极端环境场景',
      description: '模拟手套被生理盐水润湿，摩擦系数从 0.6 降至 0.2',
      parameters: [
        { label: '表面摩擦', value: 'μ=0.2' },
        { label: '抓握稳定性', value: '极易滑脱' }
      ],
      selected: false
    }
  ] : []);

  const [taskSequences, setTaskSequences] = useState<TaskSequence[]>([]);

  const [taskCompletionStats, setTaskCompletionStats] = useState({
    context: { total: 3, selected: 2 },
    behavior: { total: 6, completed: 0 },
    alignment: { analyzed: false, deviations: 0 }
  });

  return (
    <ErrorBoundary>
      <DesignProvider>
        <div className="flex h-screen bg-[#F5F5F7] text-gray-900 overflow-hidden">
        {/* Left Sidebar */}
        {!leftSidebarCollapsed && (
          <Sidebar 
            activeProjectId={activeProjectId}
            onProjectChange={setActiveProjectId}
            onToggleCollapse={() => setLeftSidebarCollapsed(true)}
            onOpenSettings={() => setShowSettings(true)}
          />
        )}

        {/* Center Canvas */}
        <div className="flex-1 flex flex-col">
          <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#007AFF]"></div>
              <h1 className="tracking-tight text-gray-900">Designthinking Agent Pro</h1>
              <span className="text-sm text-gray-500">/ {currentProject.name} {currentProject.version}</span>
            </div>
          </header>
          
          <NodeCanvas 
            nodes={nodes}
            setNodes={setNodes}
            connections={connections}
            setConnections={setConnections}
            selectedNode={selectedNode} 
            onSelectNode={setSelectedNode}
            leftSidebarCollapsed={leftSidebarCollapsed}
            onExpandLeftSidebar={() => setLeftSidebarCollapsed(false)}
            rightSidebarCollapsed={rightSidebarCollapsed}
            onExpandRightSidebar={() => setRightSidebarCollapsed(false)}
            taskStats={taskCompletionStats}
          />
        </div>

        {/* Right Inspector Panel */}
        {!rightSidebarCollapsed && (
          <InspectorPanel 
            activeProjectId={activeProjectId}
            selectedNode={selectedNode}
            onToggleCollapse={() => setRightSidebarCollapsed(true)}
            scenarios={scenarios}
            onScenariosChange={setScenarios}
            knowledgeBase={knowledgeBase}
            onTaskStatsChange={setTaskCompletionStats}
            taskSequences={taskSequences}
            onTaskSequencesChange={setTaskSequences}
          />
        )}

        {/* Settings Modal */}
        {showSettings && (
          <SettingsModal
            activeProjectId={activeProjectId}
            onClose={() => setShowSettings(false)}
            knowledgeBase={knowledgeBase}
            onKnowledgeBaseChange={setKnowledgeBase}
          />
        )}
        {/* 全屏方案对比视图（双击方案节点触发） */}
        <SolutionCompareView />
      </div>
      </DesignProvider>
    </ErrorBoundary>
  );
}