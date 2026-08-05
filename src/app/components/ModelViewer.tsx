/**
 * ModelViewer —— 3D 模型查看器
 * 基于开源 @google/model-viewer（Web Component），通过 index.html 的 CDN <script> 注册。
 * 用 React.createElement 渲染 <model-viewer>，避免 JSX 自定义元素的 TS / React 属性问题。
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

export function ModelViewer({ src, poster, alt, height = 360 }: ModelViewerProps) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (customElements.get('model-viewer')) {
      setReady(true);
      return;
    }
    customElements.whenDefined('model-viewer').then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div
        style={{
          width: '100%',
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
          fontSize: 13,
          background: '#f5f5f7',
          borderRadius: 12,
        }}
      >
        正在加载 3D 查看器…
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
      backgroundColor: '#f5f5f7',
      borderRadius: 12,
      '--poster-color': '#f5f5f7',
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
            color: '#c0392b',
            fontSize: 13,
            background: 'rgba(245,245,247,0.9)',
            borderRadius: 12,
          }}
        >
          模型加载失败，请检查网络或 GLB 地址
        </div>
      )}
    </div>
  );
}
