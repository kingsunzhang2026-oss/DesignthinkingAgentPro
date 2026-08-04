import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

export function ProblemNodePanel() {
  const [designGoals, setDesignGoals] = useState([
    { id: '1', title: '减少手部疲劳', description: '连续操作3小时以上无明显不适', priority: '高' },
    { id: '2', title: '提升操作精度', description: '误差控制在±0.5mm以内', priority: '中' }
  ]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newGoal, setNewGoal] = useState({ title: '', description: '', priority: '中' });

  const addGoal = () => {
    if (newGoal.title) {
      setDesignGoals([...designGoals, { id: Date.now().toString(), ...newGoal }]);
      setNewGoal({ title: '', description: '', priority: '中' });
      setShowAddForm(false);
    }
  };

  const removeGoal = (id: string) => {
    setDesignGoals(designGoals.filter(g => g.id !== id));
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-sm text-gray-900 mb-2">问题节点</h3>
        <p className="text-xs text-gray-600 mb-4">
          定义设计目标和需要解决的用户痛点
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm text-gray-700">设计目标</h4>
          <button
            onClick={() => setShowAddForm(true)}
            className="text-sm text-[#007AFF] hover:text-[#0051D5]"
          >
            + 添加目标
          </button>
        </div>

        {showAddForm && (
          <div className="mb-4 border border-[#FF3B30] rounded-lg p-4 bg-red-50">
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">目标标题</label>
                <input
                  type="text"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#FF3B30]"
                  placeholder="例如：减少手部疲劳"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">目标描述</label>
                <textarea
                  value={newGoal.description}
                  onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#FF3B30]"
                  rows={2}
                  placeholder="详细描述设计目标"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">优先级</label>
                <select
                  value={newGoal.priority}
                  onChange={(e) => setNewGoal({ ...newGoal, priority: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#FF3B30]"
                >
                  <option>高</option>
                  <option>中</option>
                  <option>低</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addGoal}
                  className="flex-1 bg-[#FF3B30] hover:bg-red-600 text-white px-3 py-2 rounded text-sm"
                >
                  确认
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {designGoals.map((goal) => (
            <div key={goal.id} className="border border-gray-200 rounded-lg p-3 bg-white">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h5 className="text-sm text-gray-900">{goal.title}</h5>
                    <span className={`text-[10px] px-2 py-0.5 rounded ${
                      goal.priority === '高' ? 'bg-red-100 text-red-700' :
                      goal.priority === '中' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {goal.priority}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">{goal.description}</p>
                </div>
                <button
                  onClick={() => removeGoal(goal.id)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
