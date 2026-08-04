import React, { useState } from 'react';
import { ContextPanel } from './panels/ContextPanel';
import { BehaviorPanel } from './panels/BehaviorPanel';
import { AlignmentPanel } from './panels/AlignmentPanel';
import { ProblemNodePanel } from './panels/ProblemNodePanel';
import { SolutionNodePanel } from './panels/SolutionNodePanel';
import { ValueNodePanel } from './panels/ValueNodePanel';
import { ChevronRight } from 'lucide-react';
import { ScenarioData, TaskSequence } from '../App';

interface InspectorPanelProps {
  selectedNode: string | null;
  onToggleCollapse: () => void;
  scenarios: ScenarioData[];
  onScenariosChange: (scenarios: ScenarioData[]) => void;
  knowledgeBase: any[];
  onTaskStatsChange: (stats: any) => void;
  taskSequences: TaskSequence[];
  onTaskSequencesChange: (sequences: TaskSequence[]) => void;
}

export function InspectorPanel({ 
  selectedNode, 
  onToggleCollapse, 
  scenarios, 
  onScenariosChange,
  knowledgeBase,
  onTaskStatsChange,
  taskSequences,
  onTaskSequencesChange
}: InspectorPanelProps) {
  if (!selectedNode) return null;

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

  return (
    <div className="w-[480px] bg-white border-l border-gray-200 flex flex-col overflow-hidden">
      {/* Panel Header */}
      <div className="h-14 border-b border-gray-200 flex items-center justify-between px-6">
        <h2 className="text-gray-900">{getNodeTitle(selectedNode)}</h2>
        <button
          onClick={onToggleCollapse}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="收起侧边栏"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto">
        {nodeType === 'context' && (
          <ContextPanel 
            scenarios={scenarios}
            onScenariosChange={onScenariosChange}
            knowledgeBase={knowledgeBase}
          />
        )}
        {nodeType === 'behavior' && (
          <BehaviorPanel 
            scenarios={scenarios}
            onTaskStatsChange={onTaskStatsChange}
            taskSequences={taskSequences}
            onTaskSequencesChange={onTaskSequencesChange}
          />
        )}
        {nodeType === 'alignment' && (
          <AlignmentPanel 
            onAnalysisComplete={(deviations) => {
              onTaskStatsChange((prev: any) => ({
                ...prev,
                alignment: { analyzed: true, deviations }
              }));
            }}
            knowledgeBase={knowledgeBase}
            taskSequences={taskSequences}
          />
        )}
        {nodeType === 'problem' && <ProblemNodePanel />}
        {nodeType === 'solution' && <SolutionNodePanel />}
        {nodeType === 'value' && <ValueNodePanel />}
      </div>
    </div>
  );
}