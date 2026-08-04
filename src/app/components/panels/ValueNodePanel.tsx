import React, { useState } from 'react';
import { TrendingUp, Percent } from 'lucide-react';

export function ValueNodePanel() {
  const [roiMetrics, setRoiMetrics] = useState([
    { id: '1', name: '减少手术时间', weight: 0.35, impact: '高', value: '+15%' },
    { id: '2', name: '降低培训成本', weight: 0.25, impact: '中', value: '-30%' },
    { id: '3', name: '提升用户满意度', weight: 0.40, impact: '高', value: '+40%' }
  ]);

  const [editingMetric, setEditingMetric] = useState<string | null>(null);

  const updateWeight = (id: string, weight: number) => {
    setRoiMetrics(roiMetrics.map(m => 
      m.id === id ? { ...m, weight } : m
    ));
  };

  const totalWeight = roiMetrics.reduce((sum, m) => sum + m.weight, 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-sm text-gray-900 mb-2">价值节点</h3>
        <p className="text-xs text-gray-600 mb-4">
          评估设计方案的投资回报率（ROI）和价值权重
        </p>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm text-gray-700">ROI 权重配置</h4>
          <div className={`text-sm px-2 py-1 rounded ${
            Math.abs(totalWeight - 1) < 0.01 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            总权重: {(totalWeight * 100).toFixed(0)}%
          </div>
        </div>

        <div className="space-y-4">
          {roiMetrics.map((metric) => (
            <div key={metric.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#5856D6]" />
                  <span className="text-sm text-gray-900">{metric.name}</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded ${
                  metric.impact === '高' ? 'bg-purple-100 text-purple-700' :
                  metric.impact === '中' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {metric.impact}影响
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-600 min-w-[60px]">权重:</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={metric.weight}
                    onChange={(e) => updateWeight(metric.id, parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <div className="flex items-center gap-1 min-w-[60px]">
                    <Percent className="w-3 h-3 text-gray-500" />
                    <span className="text-sm text-gray-900">{(metric.weight * 100).toFixed(0)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-xs text-gray-600 min-w-[60px]">预期值:</label>
                  {editingMetric === metric.id ? (
                    <input
                      type="text"
                      value={metric.value}
                      onChange={(e) => setRoiMetrics(roiMetrics.map(m => 
                        m.id === metric.id ? { ...m, value: e.target.value } : m
                      ))}
                      onBlur={() => setEditingMetric(null)}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#5856D6]"
                      autoFocus
                    />
                  ) : (
                    <div
                      className="flex-1 px-2 py-1 text-sm cursor-pointer hover:bg-white rounded"
                      onClick={() => setEditingMetric(metric.id)}
                    >
                      {metric.value}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {Math.abs(totalWeight - 1) >= 0.01 && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
            ⚠️ 权重总和应为 100%，当前为 {(totalWeight * 100).toFixed(0)}%
          </div>
        )}
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <h4 className="text-sm text-gray-700 mb-2">综合评分</h4>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-6 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#5856D6] to-purple-400 transition-all"
              style={{ width: `${totalWeight * 85}%` }}
            />
          </div>
          <span className="text-lg text-[#5856D6] min-w-[60px] text-right">
            {(totalWeight * 85).toFixed(0)}/100
          </span>
        </div>
        <p className="text-xs text-gray-600 mt-2">
          基于设定的权重和预期值自动计算综合评分
        </p>
      </div>
    </div>
  );
}
