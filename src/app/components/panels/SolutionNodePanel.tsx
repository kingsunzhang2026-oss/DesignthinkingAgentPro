import React, { useState } from 'react';
import { Upload, X, File } from 'lucide-react';

export function SolutionNodePanel() {
  const [prototypes, setPrototypes] = useState([
    { id: '1', name: '原型 A - 人机工程改进版', version: 'v1.2', file: '原型A_CAD.step' },
    { id: '2', name: '原型 B - 轻量化版本', version: 'v1.0', file: '原型B_3D.stl' }
  ]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPrototype, setNewPrototype] = useState({ name: '', version: '', file: '' });

  const addPrototype = () => {
    if (newPrototype.name && newPrototype.version) {
      setPrototypes([...prototypes, { id: Date.now().toString(), ...newPrototype }]);
      setNewPrototype({ name: '', version: '', file: '' });
      setShowAddForm(false);
    }
  };

  const removePrototype = (id: string) => {
    setPrototypes(prototypes.filter(p => p.id !== id));
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-sm text-gray-900 mb-2">方案节点</h3>
        <p className="text-xs text-gray-600 mb-4">
          管理原型资产和设计方案迭代
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm text-gray-700">原型资产</h4>
          <button
            onClick={() => setShowAddForm(true)}
            className="text-sm text-[#007AFF] hover:text-[#0051D5]"
          >
            + 添加原型
          </button>
        </div>

        {showAddForm && (
          <div className="mb-4 border border-[#FF9500] rounded-lg p-4 bg-orange-50">
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">原型名称</label>
                <input
                  type="text"
                  value={newPrototype.name}
                  onChange={(e) => setNewPrototype({ ...newPrototype, name: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#FF9500]"
                  placeholder="例如：原型 C - 优化版"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">版本号</label>
                <input
                  type="text"
                  value={newPrototype.version}
                  onChange={(e) => setNewPrototype({ ...newPrototype, version: e.target.value })}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#FF9500]"
                  placeholder="v1.0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">关联文件</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPrototype.file}
                    onChange={(e) => setNewPrototype({ ...newPrototype, file: e.target.value })}
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#FF9500]"
                    placeholder="文件名或路径"
                  />
                  <label className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded cursor-pointer flex items-center gap-1 text-sm">
                    <Upload className="w-3.5 h-3.5" />
                    上传
                    <input type="file" className="hidden" />
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addPrototype}
                  className="flex-1 bg-[#FF9500] hover:bg-orange-600 text-white px-3 py-2 rounded text-sm"
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
          {prototypes.map((prototype) => (
            <div key={prototype.id} className="border border-gray-200 rounded-lg p-3 bg-white">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-10 h-10 bg-orange-100 rounded flex items-center justify-center flex-shrink-0">
                    <File className="w-5 h-5 text-[#FF9500]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h5 className="text-sm text-gray-900">{prototype.name}</h5>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                        {prototype.version}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 truncate">{prototype.file}</p>
                  </div>
                </div>
                <button
                  onClick={() => removePrototype(prototype.id)}
                  className="p-1 hover:bg-gray-100 rounded flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <h4 className="text-sm text-gray-700 mb-3">方案对比</h4>
        <p className="text-xs text-gray-600">
          将多个原型资产连接到对齐节点进行横向对比评估
        </p>
      </div>
    </div>
  );
}
