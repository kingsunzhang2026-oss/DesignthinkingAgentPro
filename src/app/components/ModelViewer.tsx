/**
 * ModelViewer —— 3D 模型查看器
 * 基于开源 @google/model-viewer（Web Component）。
 * 用 React.createElement 渲染 <model-viewer>，避免 JSX 自定义元素的 TS / React 属性问题。
 *
 * CDN 多源回退：unpkg → jsdelivr（unpkg 在国内网络可能加载失败，失败自动换源），
 * 全部失败时给出明确错误提示，而不是无限"加载中"。
 *
 * 跨域 GLB 会自动经 Tripo 代理加载（调用方传入已代理的 URL 即可）。
 */
import React, { useEffect, useState } from 'react';

interface ModelViewerProps {
  src: string; // GLB 地址（建议用已转存到 Storage 的公开 URL，或经代理的 URL）
  poster?: string;
  alt?: string;
  height?: number | string;
}

const CDN_SOURCES = [
  'https://unpkg.com/@google/model-viewer@4.3.1/dist/model-viewer.min.js',
  'https://cdn.jsdelivr.net/npm/@google/model-viewer@4.3.1/dist/model-viewer.min.js',
];

const placeStyle: React.CSSProperties = {
  width: '100%',
  height: 360,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--muted-foreground)',
  fontSize: 13,
  background: 'var(--muted)',
  borderRadius: 12,
  gap: 6,
};

/** 模型区背景：卡片底色 + 顶部方案主题色（橙色）氛围光晕，与界面融合且突出产品色 */
const viewerBg = [
  'radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--node-solution) 14%, transparent) 0%, transparent 55%)',
  'var(--card)',
].join(', ');

export function ModelViewer({ src, poster, alt, height = 360 }: ModelViewerProps) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [failed, setFailed] = useState(false);

  // 加载 model-viewer Web Component（多源回退，仅首次挂载执行一次）
  useEffect(() => {
    let cancelled = false;
    const setSafe = (s: 'loading' | 'ready' | 'error') => { if (!cancelled) setState(s); };

    if (customElements.get('model-viewer')) {
      setSafe('ready');
      return;
    }

    const tryLoad = (idx: number) => {
      if (idx >= CDN_SOURCES.length) {
        console.error('[ModelViewer] model-viewer 脚本全部 CDN 加载失败');
        setSafe('error');
        return;
      }
      // 移除上一个失败的 script 再注入新源
      document.querySelectorAll('script[data-mv-cdn]').forEach((s) => s.remove());
      const script = document.createElement('script');
      script.type = 'module';
      script.dataset.mvCdn = '1';
      script.src = CDN_SOURCES[idx];
      script.onload = () => {
        // module script 加载完不保证已注册组件，用 whenDefined 兜底；注册失败则换源
        customElements.whenDefined('model-viewer').then(() => {
          setSafe('ready');
        }).catch(() => tryLoad(idx + 1));
      };
      script.onerror = () => {
        console.warn(`[ModelViewer] CDN ${idx} 加载失败，尝试下一个源`);
        tryLoad(idx + 1);
      };
      document.head.appendChild(script);
    };
    tryLoad(0);

    return () => { cancelled = true; };
  }, []);

  // src 变化：重置错误标记
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (state !== 'ready') {
    return (
      <div style={{ ...placeStyle, height }}>
        <span>正在加载 3D 查看器…</span>
        {state === 'error' && (
          <span style={{ color: '#c0392b', fontSize: 12, padding: '0 12px', textAlign: 'center' }}>
            3D 查看器加载失败（CDN 不可达），请检查网络后刷新页面重试
          </span>
        )}
      </div>
    );
  }

  const props: any = {
    src,
    'camera-controls': true,
    'auto-rotate': true,
    'shadow-intensity': '1',
    'environment-image': 'neutral',
    'exposure': '1',
    'ar': true,
    'ar-modes': 'webxr scene-viewer quick-look',
    style: {
      width: '100%',
      height,
      background: viewerBg,
      borderRadius: 12,
      '--poster-color': 'var(--card)',
    } as React.CSSProperties,
  };
  if (poster) props.poster = poster;
  if (alt) props.alt = alt;

  // model-viewer 加载失败兜底提示
  const onError = () => setFailed(true);

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {React.createElement('model-viewer', { ...props, onError })}
      {failed && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--destructive)',
            fontSize: 13,
            background: 'color-mix(in srgb, var(--card) 92%, transparent)',
            borderRadius: 12,
          }}
        >
          模型加载失败，请检查网络或 GLB 地址
        </div>
      )}
    </div>
  );
}
