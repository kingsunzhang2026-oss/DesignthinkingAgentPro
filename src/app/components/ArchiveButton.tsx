/**
 * 通用存档按钮 —— 各面板 header 用，点击触发 onSave(data)
 * 显示"上次存档于"时间戳和保存中状态。
 */
import React from 'react';
import { Save, Check, Loader2, RotateCcw } from 'lucide-react';

interface ArchiveButtonProps {
  data: any;                          // 当前要存档的对象（父组件持有 state）
  onSave: (data: any) => Promise<void>;
  onReset?: () => Promise<void>;
  saving?: boolean;
  lastSavedAt?: string | null;
  label?: string;
  className?: string;
}

export function ArchiveButton({
  data,
  onSave,
  onReset,
  saving,
  lastSavedAt,
  label = '存档',
  className = '',
}: ArchiveButtonProps) {
  const [justSaved, setJustSaved] = React.useState(false);

  const handleClick = async () => {
    try {
      await onSave(data);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } catch (e: any) {
      alert('存档失败：' + (e?.message || e));
    }
  };

  const tsText = lastSavedAt
    ? new Date(lastSavedAt).toLocaleString('zh-CN', { hour12: false })
    : '未存档';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-[10px] text-muted-foreground" title={tsText}>
        {tsText}
      </span>
      {onReset && (
        <button
          onClick={() => {
            if (confirm('确认清空当前节点的存档数据？')) onReset();
          }}
          className="px-2 py-1 text-xs text-muted-foreground hover:bg-accent rounded"
          title="清空存档"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      )}
      <button
        onClick={handleClick}
        disabled={saving}
        className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded border transition-colors disabled:opacity-50 ${
          justSaved
            ? 'bg-node-context/10 text-node-context border-node-context/20'
            : 'bg-node-behavior text-white border-node-behavior hover:bg-node-behavior/80'
        }`}
      >
        {saving ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : justSaved ? (
          <Check className="w-3 h-3" />
        ) : (
          <Save className="w-3 h-3" />
        )}
        {justSaved ? '已存档' : saving ? '存档中…' : label}
      </button>
    </div>
  );
}