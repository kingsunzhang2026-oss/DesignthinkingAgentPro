import React, { useState } from 'react';
import { supabase } from '../utils/supabase/client';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { X, Loader2, User, Lock, Server } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // 1. Try to login
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      console.error('Login failed:', loginError);
      if (loginError.message.includes('Invalid login credentials')) {
        setError(`账号或密码错误。(${loginError.message})`);
      } else {
        setError(loginError.message);
      }
      setIsLoading(false);
    } else {
      console.log('Login successful:', data);
      setIsLoading(false);
      onLoginSuccess();
      onClose();
    }
  };

  const handleInitDemoUsers = async () => {
    setIsInitializing(true);
    setError(null);
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-5590af4c/init-demo-users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server responded with ${res.status}: ${text}`);
      }

      const data = await res.json();
      console.log('Init results:', data);
      
      // Check for errors in the summary
      const errors = data.summary?.filter((item: any) => 
        item.status.startsWith('error') || item.status.includes('failed')
      );
      
      if (errors && errors.length > 0) {
          const errorMsg = errors.map((e: any) => `${e.email}: ${e.status} - ${e.msg || ''}`).join('\n');
          setError(`部分账号初始化异常:\n${errorMsg}\n\n请尝试再次点击初始化，或联系管理员。`);
      } else {
          const verifiedCount = data.summary?.filter((item: any) => item.status.includes('verified')).length;
          alert(`账号初始化/重置成功！\n已服务端验证 ${verifiedCount} 个账号登录正常。\n\n请使用新密码登录：\nAdmin: admin123\nOperator: 123456`);
          // Clear any previous errors
          setError(null);
      }
    } catch (err: any) {
      console.error('Init error:', err);
      setError('初始化请求失败: ' + err.message);
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted">
          <h3 className="text-lg font-semibold text-foreground">用户登录</h3>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 border border-border rounded-md">
                {error}
              </div>
            )}
            
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">账号 (Email)</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@make.com"
                  className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-node-behavior focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="admin123"
                  className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-node-behavior focus:border-transparent"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || isInitializing}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-node-behavior text-white text-sm font-medium rounded-md hover:bg-node-behavior/80 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              登录
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-border">
             <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                <p className="font-medium">演示账号说明:</p>
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted p-2 rounded border border-border">
                        <span className="block font-semibold text-foreground">管理员</span>
                        账号: admin@make.com<br/>
                        密码: admin123
                    </div>
                    <div className="bg-muted p-2 rounded border border-border">
                        <span className="block font-semibold text-foreground">操作员 (1-10)</span>
                        账号: operator1@make.com<br/>
                        密码: 123456
                    </div>
                </div>
                
                <button 
                  type="button"
                  onClick={handleInitDemoUsers}
                  disabled={isInitializing}
                  className="mt-2 flex items-center justify-center gap-1.5 w-full py-2 bg-node-value/10 text-node-value hover:bg-node-value/20 border border-node-value/30 rounded transition-colors"
                >
                    {isInitializing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Server className="w-3 h-3" />}
                    更新/重置演示账号 (使用新密码)
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
