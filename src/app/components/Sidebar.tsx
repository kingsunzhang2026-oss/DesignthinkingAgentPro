import React, { useState, useEffect } from 'react';
import { Folder, Settings, ChevronLeft, Box, HelpCircle, Lightbulb, TrendingUp, LogIn, LogOut, User } from 'lucide-react';
import { LoginModal } from './LoginModal';
import { supabase } from '../utils/supabase/client';

interface SidebarProps {
  onToggleCollapse: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({ onToggleCollapse, onOpenSettings }: SidebarProps) {
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
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
    { id: 'context', icon: Box, label: '情境节点', color: '#34C759' },
    { id: 'behavior', icon: TrendingUp, label: '行为节点', color: '#007AFF' },
    { id: 'alignment', icon: Box, label: '对齐节点', color: '#8E8E93' },
    { id: 'problem', icon: HelpCircle, label: '问题节点', color: '#FF3B30' },
    { id: 'solution', icon: Lightbulb, label: '方案节点', color: '#FF9500' },
    { id: 'value', icon: TrendingUp, label: '价值节点', color: '#5856D6' },
  ];

  const handleDragStart = (e: React.DragEvent, nodeType: string) => {
    e.dataTransfer.setData('nodeType', nodeType);
    setDraggedNode(nodeType);
  };

  const handleDragEnd = () => {
    setDraggedNode(null);
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Header with collapse button */}
      <div className="h-14 p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-sm text-gray-500">项目列表</h2>
        <button
          onClick={onToggleCollapse}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="收起侧边栏"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
      </div>
      
      {/* Projects */}
      <nav className="p-3 space-y-1 border-b border-gray-200">
        <div className="px-3 py-2 rounded-lg bg-[#007AFF]/10 border border-[#007AFF]/20">
          <div className="flex items-center gap-2 mb-1">
            <Folder className="w-4 h-4 text-[#007AFF]" />
            <span className="text-sm text-gray-900">小钳智能双极电刀 V2</span>
          </div>
          <span className="text-xs text-gray-500 ml-6">当前项目</span>
        </div>

        <div className="px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer opacity-60">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">腔镜剪 V1</span>
          </div>
        </div>

        <div className="px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer opacity-60">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">持针器原型</span>
          </div>
        </div>
      </nav>

      {/* Node Library */}
      <div className="flex-1 overflow-y-auto p-3">
        <h3 className="text-xs text-gray-500 mb-2 px-2">节点库</h3>
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
                } bg-white border-gray-200 hover:border-gray-300`}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-6 h-6 rounded flex items-center justify-center"
                    style={{ backgroundColor: node.color }}
                  >
                    <Icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-sm text-gray-700">{node.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-xs text-gray-700 mb-1">💡 操作提示</div>
          <div className="text-xs text-gray-600 space-y-1">
            <p>• 拖拽节点到画布创建</p>
            <p>• 拖拽端口连接节点</p>
            <p>• 框选同类节点可组合</p>
            <p>• 按Delete删除选中节点</p>
          </div>
        </div>
      </div>

      {/* Settings & Auth */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        <button 
          onClick={onOpenSettings}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 cursor-pointer w-full p-2 hover:bg-gray-50 rounded"
        >
          <Settings className="w-4 h-4" />
          <span>设置</span>
        </button>

        {user ? (
           <div className="flex flex-col gap-1">
             <div className="flex items-center gap-2 px-2 py-1 text-xs text-gray-500 overflow-hidden">
                <User className="w-3 h-3 flex-shrink-0" />
                <span className="truncate" title={user.email}>{user.email}</span>
             </div>
             <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 cursor-pointer w-full p-2 hover:bg-red-50 rounded"
             >
                <LogOut className="w-4 h-4" />
                <span>退出登录</span>
             </button>
           </div>
        ) : (
           <button 
            onClick={() => setShowLogin(true)}
            className="flex items-center gap-2 text-sm text-[#007AFF] hover:text-[#0051D5] cursor-pointer w-full p-2 hover:bg-blue-50 rounded"
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
    </div>
  );
}
