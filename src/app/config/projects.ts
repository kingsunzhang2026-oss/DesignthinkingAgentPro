import { NodeData, Connection } from '../App';

export interface ProjectConfig {
  id: string;
  name: string;
  version: string;
  initialNodes: NodeData[];
  initialConnections: Connection[];
}

export const PROJECTS: ProjectConfig[] = [
  {
    id: 'forceps-v2',
    name: '智能双极电刀',
    version: 'V2',
    initialNodes: [
      { id: 'context', type: 'context', label: '情境扩展', shortLabel: 'C', position: { x: 100, y: 200 }, status: 'validated' },
      { id: 'behavior', type: 'behavior', label: '行为SOP', shortLabel: 'B1', position: { x: 380, y: 200 }, status: 'active' },
      { id: 'alignment', type: 'alignment', label: '人机对齐报告', shortLabel: 'B2', position: { x: 660, y: 200 }, status: 'pending' }
    ],
    initialConnections: [
      { id: 'conn-1', from: 'context', to: 'behavior' },
      { id: 'conn-2', from: 'behavior', to: 'alignment' }
    ]
  },
  {
    id: 'stapler-v3',
    name: '智能电动切割吻合器',
    version: 'V3',
    initialNodes: [
      { id: 'context', type: 'context', label: '情境扩展', shortLabel: 'C', position: { x: 100, y: 100 }, status: 'validated' },
      { id: 'behavior', type: 'behavior', label: '行为SOP', shortLabel: 'B1', position: { x: 380, y: 100 }, status: 'active' },
      { id: 'alignment', type: 'alignment', label: '人机对齐报告', shortLabel: 'B2', position: { x: 660, y: 100 }, status: 'pending' },
      { id: 'problem', type: 'problem', label: '设计问题', shortLabel: 'P', position: { x: 100, y: 350 }, status: 'validated' },
      { id: 'solution', type: 'solution', label: '解决方案', shortLabel: 'S', position: { x: 380, y: 350 }, status: 'active' }
    ],
    initialConnections: [
      { id: 'conn-s1-1', from: 'context', to: 'behavior' },
      { id: 'conn-s1-2', from: 'behavior', to: 'alignment' },
      { id: 'conn-s2-1', from: 'problem', to: 'solution' }
    ]
  }
];
