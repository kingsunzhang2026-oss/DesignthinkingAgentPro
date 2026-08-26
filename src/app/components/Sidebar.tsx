import React, { useState, useEffect } from 'react';
import { Folder, Settings, ChevronLeft, Box, HelpCircle, Lightbulb, TrendingUp, LogIn, LogOut, User, Database } from 'lucide-react';
import { LoginModal } from './LoginModal';
import { ArchiveCenter } from './ArchiveCenter';
import { supabase } from '../utils/supabase/client';
import { PROJECTS } from '../config/projects';

interface SidebarProps {
  activeProjectId: string;
  onProjectChange: (id: string) => void;
  onToggleCollapse: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({ activeProjectId, onProjectChange, onToggleCollapse, onOpenSettings }: SidebarProps) {
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };


  const nodeLibrary = [
    { id: 'context', icon: Box, label: '情境节点', color: '#4ADE80' },
    { id: 'behavior', icon: TrendingUp, label: '行为节点', color: '#60A5FA' },
    { id: 'alignment', icon: Box, label: '对齐节点', color: '#A1A1AA' },
    { id: 'problem', icon: HelpCircle, label: '问题节点', color: '#F87171' },
    { id: 'solution', icon: Lightbulb, label: '方案节点', color: '#FB923C' },
    { id: 'value', icon: TrendingUp, label: '价值节点', color: '#A78BFA' },
  ];

  const handleDragStart = (e: React.DragEvent, nodeType: string) => {
    e.dataTransfer.setData('nodeType', nodeType);
    setDraggedNode(nodeType);
  };

  const handleDragEnd = () => {
    setDraggedNode(null);
  };

  return (
    <div className="w-64 bg-sidebar border-r border-border flex flex-col">
      {/* Header with collapse button */}
      <div className="h-14 p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-sm text-muted-foreground">项目列表</h2>
        <button
          onClick={onToggleCollapse}
          className="p-1 hover:bg-accent rounded transition-colors"
          title="收起侧边栏"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      
      {/* Projects */}
      <nav className="p-3 space-y-1 border-b border-border">
        {PROJECTS.map(project => (
          <div 
            key={project.id}
            onClick={() => onProjectChange(project.id)}
            className={`px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              activeProjectId === project.id 
                ? 'bg-node-behavior/10 border border-node-behavior/20' 
                : 'hover:bg-muted opacity-60'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Folder className={`w-4 h-4 ${activeProjectId === project.id ? 'text-node-behavior' : 'text-muted-foreground'}`} />
              <span className={`text-sm ${activeProjectId === project.id ? 'text-foreground' : 'text-muted-foreground'}`}>
                {project.name} {project.version}
              </span>
            </div>
            {activeProjectId === project.id && (
              <span className="text-xs text-muted-foreground ml-6">当前项目</span>
            )}
          </div>
        ))}
      </nav>

      {/* Node Library */}
      <div className="flex-1 overflow-y-auto p-3">
        <h3 className="text-xs text-muted-foreground mb-2 px-2">节点库</h3>
        <div className="space-y-1">
          {nodeLibrary.map((node) => {
            const Icon = node.icon;
            return (
              <div
                key={node.id}
                draggable
                onDragStart={(e) => handleDragStart(e, node.id)}
                onDragEnd={handleDragEnd}
                className={`px-3 py-2 rounded-lg border cursor-move hover:shadow-md transition-all ${
                  draggedNode === node.id ? 'opacity-50' : 'opacity-100'
                } bg-card border-border hover:border-[#2A2A35]`}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-6 h-6 rounded flex items-center justify-center"
                    style={{ backgroundColor: node.color }}
                  >
                    <Icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-sm text-foreground">{node.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3 bg-node-behavior/10 border border-node-behavior/20 rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">💡 操作提示</div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• 拖拽节点到画布创建</p>
            <p>• 拖拽端口连接节点</p>
            <p>• 框选同类节点可组合</p>
            <p>• 按Delete删除选中节点</p>
          </div>
        </div>
      </div>

      {/* Settings & Auth */}
      <div className="p-4 border-t border-border space-y-2">
        <button
          onClick={() => setShowArchive(true)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer w-full p-2 hover:bg-accent rounded"
        >
          <Database className="w-4 h-4 text-node-solution" />
          <span>存档中心</span>
        </button>
        <button 
          onClick={onOpenSettings}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer w-full p-2 hover:bg-accent rounded"
        >
          <Settings className="w-4 h-4" />
          <span>设置</span>
        </button>

        {user ? (
           <div className="flex flex-col gap-1">
             <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground overflow-hidden">
                <User className="w-3 h-3 flex-shrink-0" />
                <span className="truncate" title={user.email}>{user.email}</span>
             </div>
             <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-destructive hover:opacity-80 cursor-pointer w-full p-2 hover:bg-destructive/10 rounded"
             >
                <LogOut className="w-4 h-4" />
                <span>退出登录</span>
             </button>
           </div>
        ) : (
           <button 
            onClick={() => setShowLogin(true)}
            className="flex items-center gap-2 text-sm text-node-behavior hover:text-blue-400 cursor-pointer w-full p-2 hover:bg-node-behavior/10 rounded"
           >
            <LogIn className="w-4 h-4" />
            <span>登录账号</span>
           </button>
        )}
      </div>

      <LoginModal 
        isOpen={showLogin} 
        onClose={() => setShowLogin(false)} 
        onLoginSuccess={() => setShowLogin(false)}
      />
      <ArchiveCenter isOpen={showArchive} onClose={() => setShowArchive(false)} />
    </div>
  );
}
