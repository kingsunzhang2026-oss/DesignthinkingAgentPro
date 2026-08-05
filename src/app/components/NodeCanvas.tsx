import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, ZoomIn, ZoomOut, Maximize2, Trash2 } from 'lucide-react';
import { NodeData, Connection } from '../App';
import { useDesignStore } from '../services/designStore';

interface NodeCanvasProps {
  selectedNode: string | null;
  onSelectNode: (nodeId: string) => void;
  leftSidebarCollapsed: boolean;
  onExpandLeftSidebar: () => void;
  rightSidebarCollapsed: boolean;
  onExpandRightSidebar: () => void;
  taskStats: any;
}

export function NodeCanvas({ 
  selectedNode, 
  onSelectNode, 
  leftSidebarCollapsed, 
  onExpandLeftSidebar,
  rightSidebarCollapsed,
  onExpandRightSidebar,
  taskStats
}: NodeCanvasProps) {
  const [nodes, setNodes] = useState<NodeData[]>([
    { 
      id: 'context', 
      type: 'context',
      label: '情境扩展', 
      shortLabel: 'C',
      position: { x: 100, y: 200 },
      status: 'validated'
    },
    { 
      id: 'behavior', 
      type: 'behavior',
      label: '行为SOP', 
      shortLabel: 'B1',
      position: { x: 380, y: 200 },
      status: 'active'
    },
    { 
      id: 'alignment', 
      type: 'alignment',
      label: '人机对齐报告', 
      shortLabel: 'B2',
      position: { x: 660, y: 200 },
      status: 'pending'
    }
  ]);

  const [connections, setConnections] = useState<Connection[]>([
    { id: 'conn-1', from: 'context', to: 'behavior' },
    { id: 'conn-2', from: 'behavior', to: 'alignment' }
  ]);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; port: 'output' } | null>(null);
  const [tempConnection, setTempConnection] = useState<{ x: number; y: number } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ start: { x: number; y: number }, end: { x: number; y: number } } | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);

  const canvasRef = useRef<HTMLDivElement>(null);

  const { notifyConnection, openCompare } = useDesignStore();

  const getNodeColor = (type: string) => {
    const colors: Record<string, string> = {
      context: '#34C759',
      behavior: '#007AFF',
      alignment: '#8E8E93',
      problem: '#FF3B30',
      solution: '#FF9500',
      value: '#5856D6'
    };
    return colors[type] || '#8E8E93';
  };

  const getStatusBg = (status: string) => {
    switch(status) {
      case 'validated': return 'bg-green-50 border-green-200';
      case 'active': return 'bg-blue-50 border-[#007AFF]';
      case 'pending': return 'bg-gray-50 border-gray-300';
      default: return 'bg-gray-50 border-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch(status) {
      case 'validated': return 'Validated';
      case 'active': return 'Active';
      case 'pending': return 'Pending';
      default: return 'Pending';
    }
  };

  // Handle canvas panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
    } else if (e.button === 0 && e.shiftKey) {
      // Start selection box
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (e.clientX - rect.left - pan.x) / zoom;
        const y = (e.clientY - rect.top - pan.y) / zoom;
        setSelectionBox({ start: { x, y }, end: { x, y } });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    } else if (draggingNode) {
      const node = nodes.find(n => n.id === draggingNode);
      if (node) {
        setNodes(nodes.map(n => 
          n.id === draggingNode 
            ? { 
                ...n, 
                position: { 
                  x: (e.clientX - dragOffset.x - pan.x) / zoom, 
                  y: (e.clientY - dragOffset.y - pan.y) / zoom 
                } 
              }
            : n
        ));
      }
    } else if (connectingFrom && tempConnection) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setTempConnection({
          x: (e.clientX - rect.left - pan.x) / zoom,
          y: (e.clientY - rect.top - pan.y) / zoom
        });
      }
    } else if (selectionBox) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (e.clientX - rect.left - pan.x) / zoom;
        const y = (e.clientY - rect.top - pan.y) / zoom;
        setSelectionBox({ ...selectionBox, end: { x, y } });
        
        // Update selected nodes
        const minX = Math.min(selectionBox.start.x, x);
        const maxX = Math.max(selectionBox.start.x, x);
        const minY = Math.min(selectionBox.start.y, y);
        const maxY = Math.max(selectionBox.start.y, y);
        
        const selected = nodes.filter(node => 
          node.position.x + 110 > minX &&
          node.position.x + 110 < maxX &&
          node.position.y + 60 > minY &&
          node.position.y + 60 < maxY
        ).map(n => n.id);
        
        setSelectedNodes(selected);
      }
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNode(null);
    setConnectingFrom(null);
    setTempConnection(null);
    
    if (selectionBox && selectedNodes.length > 1) {
      // Check if all selected nodes are of the same type
      const types = new Set(selectedNodes.map(id => nodes.find(n => n.id === id)?.type));
      if (types.size === 1) {
        const shouldGroup = window.confirm(`创建包含 ${selectedNodes.length} 个节点的组合节点？`);
        if (shouldGroup) {
          createGroupNode(selectedNodes);
        }
      } else {
        alert('只能将相同类型的节点组合在一起');
      }
    }
    
    setSelectionBox(null);
    setSelectedNodes([]);
  };

  const createGroupNode = (nodeIds: string[]) => {
    const groupedNodes = nodes.filter(n => nodeIds.includes(n.id));
    const type = groupedNodes[0].type;
    const avgX = groupedNodes.reduce((sum, n) => sum + n.position.x, 0) / groupedNodes.length;
    const avgY = groupedNodes.reduce((sum, n) => sum + n.position.y, 0) / groupedNodes.length;
    
    const newGroupNode: NodeData = {
      id: `group-${Date.now()}`,
      type: type,
      label: `${groupedNodes[0].label}组合`,
      shortLabel: `${groupedNodes[0].shortLabel}×${groupedNodes.length}`,
      position: { x: avgX, y: avgY },
      status: 'pending',
      isGroup: true,
      groupNodes: nodeIds
    };
    
    // Remove grouped nodes and add group node
    setNodes([...nodes.filter(n => !nodeIds.includes(n.id)), newGroupNode]);
    // Remove connections to/from grouped nodes
    setConnections(connections.filter(c => !nodeIds.includes(c.from) && !nodeIds.includes(c.to)));
  };

  // Handle zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.max(0.25, Math.min(2, prev * delta)));
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(2, prev * 1.2));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(0.25, prev / 1.2));
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Handle node dragging
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (e.button === 0 && !e.altKey && !e.shiftKey) {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        setDraggingNode(nodeId);
        setDragOffset({
          x: e.clientX - node.position.x * zoom - pan.x,
          y: e.clientY - node.position.y * zoom - pan.y
        });
        e.stopPropagation();
      }
    }
  };

  // Handle port connection
  const handlePortMouseDown = (e: React.MouseEvent, nodeId: string, port: 'output') => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setConnectingFrom({ nodeId, port });
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setTempConnection({
          x: (e.clientX - rect.left - pan.x) / zoom,
          y: (e.clientY - rect.top - pan.y) / zoom
        });
      }
    }
  };

  const handlePortMouseUp = (e: React.MouseEvent, nodeId: string, port: 'input') => {
    e.stopPropagation();
    if (connectingFrom && connectingFrom.nodeId !== nodeId) {
      const fromNode = nodes.find((n) => n.id === connectingFrom.nodeId);
      const toNode = nodes.find((n) => n.id === nodeId);
      if (fromNode && toNode) {
        const newConnection: Connection = {
          id: `conn-${Date.now()}`,
          from: fromNode.id,
          to: toNode.id,
        };
        setConnections([...connections, newConnection]);
        // 连线成功 → 触发节点间数据自动投递（context→problem / problem→solution 等）
        notifyConnection(fromNode.id, fromNode.type, toNode.id, toNode.type);
      }
    }
    setConnectingFrom(null);
    setTempConnection(null);
  };

  // 拖拽到节点体内（左半区）吸附连线：松手即连到该节点输入
  const handleNodeMouseUp = (e: React.MouseEvent, nodeId: string) => {
    if (connectingFrom && connectingFrom.nodeId !== nodeId) {
      e.stopPropagation();
      const fromNode = nodes.find((n) => n.id === connectingFrom.nodeId);
      const toNode = nodes.find((n) => n.id === nodeId);
      if (fromNode && toNode) {
        const newConnection: Connection = {
          id: `conn-${Date.now()}`,
          from: fromNode.id,
          to: toNode.id,
        };
        setConnections([...connections, newConnection]);
        notifyConnection(fromNode.id, fromNode.type, toNode.id, toNode.type);
      }
      setConnectingFrom(null);
      setTempConnection(null);
    }
  };

  // Handle connection deletion
  const handleConnectionClick = (connId: string) => {
    if (window.confirm('删除此连线？')) {
      setConnections(connections.filter(c => c.id !== connId));
    }
  };

  // Handle node deletion
  const handleDeleteNode = (nodeId: string) => {
    if (window.confirm('删除此节点？')) {
      setNodes(nodes.filter(n => n.id !== nodeId));
      setConnections(connections.filter(c => c.from !== nodeId && c.to !== nodeId));
      if (selectedNode === nodeId) {
        onSelectNode(nodes[0]?.id || null);
      }
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedNode) {
        handleDeleteNode(selectedNode);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode]);

  // Handle drop from node library
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('nodeType');
    if (nodeType) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (e.clientX - rect.left - pan.x) / zoom;
        const y = (e.clientY - rect.top - pan.y) / zoom;
        
        const typeLabels: Record<string, string> = {
          context: '情境',
          behavior: '行为',
          alignment: '对齐',
          problem: '问题',
          solution: '方案',
          value: '价值'
        };
        
        const newNode: NodeData = {
          id: `${nodeType}-${Date.now()}`,
          type: nodeType,
          label: typeLabels[nodeType] || nodeType,
          shortLabel: nodeType.charAt(0).toUpperCase(),
          position: { x, y },
          status: 'pending',
          properties: {}
        };
        
        setNodes([...nodes, newNode]);
        onSelectNode(newNode.id);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Calculate connection path
  const getConnectionPath = (fromNode: NodeData, toNode: NodeData) => {
    const fromX = fromNode.position.x + 200;
    const fromY = fromNode.position.y + 60;
    const toX = toNode.position.x + 20;
    const toY = toNode.position.y + 60;
    
    const midX = (fromX + toX) / 2;
    
    return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
  };

  // Get node stats
  const getNodeStats = (node: NodeData) => {
    if (node.type === 'context') {
      return (
        <>
          <div className="flex items-center justify-between">
            <span>场景数量</span>
            <span className="text-gray-900">{taskStats.context.total}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>已选中</span>
            <span className="text-[#007AFF]">{taskStats.context.selected}</span>
          </div>
        </>
      );
    } else if (node.type === 'behavior') {
      return (
        <>
          <div className="flex items-center justify-between">
            <span>测试任务</span>
            <span className="text-gray-900">{taskStats.behavior.total}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>已完成</span>
            <span className="text-[#007AFF]">{taskStats.behavior.completed}/{taskStats.behavior.total}</span>
          </div>
        </>
      );
    } else if (node.type === 'alignment') {
      return (
        <>
          <div className="flex items-center justify-between">
            <span>对齐度</span>
            <span className="text-gray-900">{taskStats.alignment.analyzed ? '已分析' : '待分析'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>偏差项</span>
            <span className={taskStats.alignment.deviations > 0 ? 'text-[#FF9500]' : 'text-gray-400'}>
              {taskStats.alignment.analyzed ? taskStats.alignment.deviations : '--'}
            </span>
          </div>
        </>
      );
    }
    return null;
  };

  return (
    <div 
      ref={canvasRef}
      className="flex-1 relative bg-[#FAFAFA] overflow-hidden cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Grid Background */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)
          `,
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`
        }}
      />

      {/* Expandable sidebar buttons */}
      {leftSidebarCollapsed && (
        <button
          onClick={onExpandLeftSidebar}
          className="absolute top-4 left-4 p-2 bg-white border border-gray-200 rounded-lg shadow-md hover:bg-gray-50 transition-colors z-10"
          title="展开左侧边栏"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      )}

      {rightSidebarCollapsed && (
        <button
          onClick={onExpandRightSidebar}
          className="absolute top-4 right-4 p-2 bg-white border border-gray-200 rounded-lg shadow-md hover:bg-gray-50 transition-colors z-10"
          title="展开右侧边栏"
        >
          <ChevronRight className="w-4 h-4 text-gray-600 rotate-180" />
        </button>
      )}

      {/* Canvas content with transform */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          width: '100%',
          height: '100%',
          position: 'relative'
        }}
      >
        {/* SVG for connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#007AFF" />
            </marker>
          </defs>
          
          {/* Connection lines */}
          {connections.map((conn) => {
            const fromNode = nodes.find(n => n.id === conn.from);
            const toNode = nodes.find(n => n.id === conn.to);
            if (fromNode && toNode) {
              return (
                <path
                  key={conn.id}
                  d={getConnectionPath(fromNode, toNode)}
                  stroke="#007AFF"
                  strokeWidth="2"
                  fill="none"
                  markerEnd="url(#arrowhead)"
                  className="pointer-events-auto cursor-pointer hover:stroke-[#FF9500] transition-colors"
                  onClick={() => handleConnectionClick(conn.id)}
                />
              );
            }
            return null;
          })}

          {/* Temporary connection line */}
          {connectingFrom && tempConnection && (() => {
            const fromNode = nodes.find(n => n.id === connectingFrom.nodeId);
            if (fromNode) {
              const fromX = fromNode.position.x + 200;
              const fromY = fromNode.position.y + 60;
              const midX = (fromX + tempConnection.x) / 2;
              return (
                <path
                  d={`M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${tempConnection.y}, ${tempConnection.x} ${tempConnection.y}`}
                  stroke="#007AFF"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                  fill="none"
                  opacity="0.6"
                />
              );
            }
            return null;
          })()}

          {/* Input/Output ports */}
          {nodes.map((node) => (
            <g key={node.id}>
              {/* Output port (right side) */}
              <circle
                cx={node.position.x + 200}
                cy={node.position.y + 60}
                r="6"
                fill={getNodeColor(node.type)}
                stroke="white"
                strokeWidth="2"
                className="pointer-events-auto cursor-pointer hover:r-8 transition-all"
                onMouseDown={(e) => handlePortMouseDown(e as any, node.id, 'output')}
              />
              {/* Input port (left side) */}
              <circle
                cx={node.position.x + 20}
                cy={node.position.y + 60}
                r="6"
                fill={getNodeColor(node.type)}
                stroke="white"
                strokeWidth="2"
                className="pointer-events-auto cursor-pointer hover:r-8 transition-all"
                onMouseUp={(e) => handlePortMouseUp(e as any, node.id, 'input')}
              />
            </g>
          ))}
        </svg>

        {/* Selection box */}
        {selectionBox && (
          <div
            className="absolute border-2 border-[#007AFF] bg-[#007AFF]/10 pointer-events-none"
            style={{
              left: Math.min(selectionBox.start.x, selectionBox.end.x),
              top: Math.min(selectionBox.start.y, selectionBox.end.y),
              width: Math.abs(selectionBox.end.x - selectionBox.start.x),
              height: Math.abs(selectionBox.end.y - selectionBox.start.y)
            }}
          />
        )}

        {/* Nodes */}
        {nodes.map((node) => (
          <div
            key={node.id}
            className={`absolute cursor-move transition-shadow ${
              selectedNode === node.id ? 'ring-2 ring-[#007AFF] shadow-lg' : 'shadow-md hover:shadow-lg'
            } ${selectedNodes.includes(node.id) ? 'ring-2 ring-green-500' : ''} ${getStatusBg(node.status)}`}
            style={{
              left: node.position.x,
              top: node.position.y,
              width: '220px',
              borderRadius: '8px',
              border: '1.5px solid',
            }}
            onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
            onMouseUp={(e) => handleNodeMouseUp(e, node.id)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (node.type === 'solution') openCompare(node.id);
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectNode(node.id);
            }}
          >
            {/* Node Header */}
            <div className="p-3 border-b border-gray-200 bg-white/50 relative">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-8 h-8 rounded flex items-center justify-center text-white text-xs"
                    style={{ backgroundColor: getNodeColor(node.type) }}
                  >
                    {node.shortLabel}
                  </div>
                  <span className="text-sm text-gray-900">{node.label}</span>
                </div>
                {node.id !== 'context' && node.id !== 'behavior' && node.id !== 'alignment' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNode(node.id);
                    }}
                    className="p-1 hover:bg-red-100 rounded transition-colors"
                    title="删除节点"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wide ${
                  node.status === 'validated' ? 'bg-green-100 text-green-700' :
                  node.status === 'active' ? 'bg-blue-100 text-[#007AFF]' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {getStatusLabel(node.status)}
                </div>
                {node.isGroup && (
                  <div className="text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                    组合节点
                  </div>
                )}
              </div>
            </div>

            {/* Node Body */}
            <div className="p-3 bg-white">
              <div className="text-xs text-gray-600 space-y-1">
                {getNodeStats(node)}
                {!['context', 'behavior', 'alignment'].includes(node.type) && (
                  <div className="text-xs text-gray-500 italic pt-2 border-t border-gray-200">
                    点击查看详情配置属性
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Control Panel */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-white border border-gray-200 rounded-lg shadow-md hover:bg-gray-50 transition-colors"
          title="放大"
        >
          <ZoomIn className="w-4 h-4 text-gray-600" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-white border border-gray-200 rounded-lg shadow-md hover:bg-gray-50 transition-colors"
          title="缩小"
        >
          <ZoomOut className="w-4 h-4 text-gray-600" />
        </button>
        <button
          onClick={handleResetView}
          className="p-2 bg-white border border-gray-200 rounded-lg shadow-md hover:bg-gray-50 transition-colors"
          title="重置视图"
        >
          <Maximize2 className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Canvas Info */}
      <div className="absolute bottom-4 left-4 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200 text-xs text-gray-600">
        <div>缩放: {(zoom * 100).toFixed(0)}% · 中键平移 · Ctrl+滚轮缩放 · Shift+框选 · 拖端口连线 · 双击方案节点对比
      </div>
      </div>
    </div>
  );
}
