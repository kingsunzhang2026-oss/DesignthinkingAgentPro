/**
 * DesignThinking 全局共享 Store
 * ----------------------------------------------------------------
 * 职责（解耦、不硬编码节点行为）：
 *  1. 节点输出注册表（registerOutput / getOutput）
 *     —— 已挂载的面板实时把自己的"产出数据"登记进来，供连线投递时读取。
 *  2. 连线触发的数据投递（notifyConnection / useDelivery）
 *     —— 连线成功时，按声明式 CONNECTION_DELIVERY 映射表把源节点产出
 *        变换后推送给目标节点面板，目标面板订阅后自动接收。
 *  3. 全屏方案对比视图开关（openCompare / closeCompare）。
 *
 * 映射表是"数据流"的唯一真理来源，新增节点连线类型只需在此登记一条，
 * 而不必改动任何面板或画布代码。
 */
import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { loadPanelState, PanelType } from './panelArchive';

const ARCHIVE_PROJECT_ID = 'default';

export interface Delivery {
  fromNodeId: string;
  fromType: string;
  toNodeId: string;
  toType: string;
  /** 变换后的目标荷载（类型相关） */
  data: any;
  /** 每次投递自增，作为消费者 effect 的依赖，确保重复投递能再次触发 */
  token: number;
  at: string;
}

interface DesignStoreValue {
  /** 面板实时登记自己的产出数据 */
  registerOutput: (nodeId: string, panelType: string, output: any) => void;
  /** 读取某节点最新登记的产出（连线投递时优先用） */
  getOutput: (nodeId: string) => any | undefined;

  /** 连线成功时调用：自动投递源节点数据到目标节点 */
  notifyConnection: (
    fromNodeId: string,
    fromType: string,
    toNodeId: string,
    toType: string,
  ) => Promise<void>;

  /** 订阅某目标节点的最新投递 */
  useDelivery: (toNodeId: string) => Delivery | undefined;
  /** 主动清除某目标节点的待处理投递（用于"忽略"按钮） */
  clearDelivery: (toNodeId: string) => void;

  /** 全屏方案对比视图 */
  compareNodeId: string | null;
  openCompare: (nodeId: string) => void;
  closeCompare: () => void;
}

const DesignStoreContext = createContext<DesignStoreValue | null>(null);

/**
 * 连线数据流声明式映射表。
 * key = `${fromType}->${toType}`，value = (sourceOutput, ctx) => targetPayload | undefined
 * 返回 undefined 表示不需要投递（保持静默）。
 */
const CONNECTION_DELIVERY: Record<string, (source: any, ctx: { fromNodeId: string; toNodeId: string }) => any | undefined> = {
  // 问题节点 → 方案节点：把自动生成的结构化提示词注入方案节点的文生3D输入框
  'problem->solution': (src) => {
    if (!src || !src.generatedPrompt) return undefined;
    return { prompt: src.generatedPrompt };
  },
  // 情境节点 → 问题节点：把设备名 + 已选场景清单交给问题节点，
  // 问题节点据此可一键"基于情境生成设计目标"
  'context->problem': (src) => {
    if (!src) return undefined;
    const scenarios = Array.isArray(src.scenarios)
      ? src.scenarios.filter((s: any) => s.selected).map((s: any) => s.title)
      : [];
    return {
      deviceName: src.deviceName || '',
      scenarios,
    };
  },
  // 方案节点 → 行为节点：把生成的 ID 外观方案（variants A/B/C...）投递到行为面板
  // 行为面板据此切换为"ID方案模式"：tabs = 各 variant，任务 = T1基本握持/T2精准操作/T3智能UI界面(可选)
  // 即使 variants 为空也返回 {} 数组，行为面板据此显示"等待方案生成"空态
  'solution->behavior': (src) => {
    if (!src) return undefined;
    const variants = Array.isArray(src.variants)
      ? src.variants
          .filter((v: any) => v && (v.id || v.label))
          .map((v: any) => ({
            id: v.id,
            label: v.label,
            prompt: v.prompt,
            previewUrl: v.previewUrl,
            assetId: v.assetId,
          }))
      : [];
    return { variants };
  },
};

export function DesignProvider({ children }: { children: React.ReactNode }) {
  // 节点产出注册表（用 ref，避免频繁 setState 触发全局重渲染）
  const outputsRef = useRef<Record<string, any>>({});

  const [deliveries, setDeliveries] = useState<Record<string, Delivery>>({});
  const [compareNodeId, setCompareNodeId] = useState<string | null>(null);

  const registerOutput = useCallback((nodeId: string, _panelType: string, output: any) => {
    outputsRef.current[nodeId] = output;
  }, []);

  const getOutput = useCallback((nodeId: string) => outputsRef.current[nodeId], []);

  const notifyConnection = useCallback(
    async (fromNodeId: string, fromType: string, toNodeId: string, toType: string) => {
      const key = `${fromType}->${toType}`;
      const transformer = CONNECTION_DELIVERY[key];
      if (!transformer) return; // 该连线类型未定义数据流，静默跳过

      // 优先用实时登记数据；面板未挂载时回退到存档库
      let source = getOutput(fromNodeId);
      if (source === undefined) {
        try {
          const res = await loadPanelState(ARCHIVE_PROJECT_ID, fromNodeId, fromType as PanelType);
          source = res.data ?? undefined;
        } catch {
          source = undefined;
        }
      }

      const payload = transformer(source, { fromNodeId, toNodeId });
      // transformer 未产出业务数据时，也投递最小连接标记，让目标面板能感知"已连线"
      // （例如方案节点尚未生成 variants 时，行为面板仍可切换为 ID 方案模式并显示空态）
      setDeliveries((prev) => ({
        ...prev,
        [toNodeId]: {
          fromNodeId,
          fromType,
          toNodeId,
          toType,
          data: payload === undefined || payload === null ? { connected: true } : payload,
          token: (prev[toNodeId]?.token ?? 0) + 1,
          at: new Date().toISOString(),
        },
      }));
    },
    [getOutput],
  );

  const useDelivery = (toNodeId: string) => deliveries[toNodeId];

  const clearDelivery = useCallback((toNodeId: string) => {
    setDeliveries((prev) => {
      if (!prev[toNodeId]) return prev;
      const next = { ...prev };
      delete next[toNodeId];
      return next;
    });
  }, []);

  const openCompare = useCallback((nodeId: string) => setCompareNodeId(nodeId), []);
  const closeCompare = useCallback(() => setCompareNodeId(null), []);

  const value: DesignStoreValue = {
    registerOutput,
    getOutput,
    notifyConnection,
    useDelivery,
    clearDelivery,
    compareNodeId,
    openCompare,
    closeCompare,
  };

  return <DesignStoreContext.Provider value={value}>{children}</DesignStoreContext.Provider>;
}

export function useDesignStore(): DesignStoreValue {
  const ctx = useContext(DesignStoreContext);
  if (!ctx) throw new Error('useDesignStore 必须在 DesignProvider 内使用');
  return ctx;
}
