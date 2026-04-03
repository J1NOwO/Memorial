// ImageViewer.jsx - 이미지 풀스크린 뷰어
//
// Props:
//   urls         : string[]  - 표시할 이미지 URL 배열
//   initialIndex : number    - 처음 보여줄 이미지 인덱스
//   onClose      : fn        - 닫기 콜백

import { useState, useEffect } from 'react';
import { useT } from '../hooks/useT';

export default function ImageViewer({ urls = [], initialIndex = 0, onClose }) {
  const t = useT();
  const [current, setCurrent] = useState(initialIndex);

  // 키보드 방향키 + ESC 처리
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape')      onClose();
      if (e.key === 'ArrowLeft')   setCurrent(p => Math.max(0, p - 1));
      if (e.key === 'ArrowRight')  setCurrent(p => Math.min(urls.length - 1, p + 1));
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [urls.length, onClose]);

  if (!urls.length) return null;

  return (
    <div style={S.overlay} onClick={onClose}>
      {/* 이미지 (클릭 전파 차단) */}
      <img
        src={urls[current]}
        alt={t.img_alt(current + 1)}
        style={S.img}
        onClick={e => e.stopPropagation()}
      />

      {/* 닫기 버튼 */}
      <button
        style={S.closeBtn}
        onClick={onClose}
        aria-label={t.img_close}
      >×</button>

      {/* 이전 버튼 */}
      {current > 0 && (
        <button
          style={{ ...S.arrowBtn, left: 12 }}
          onClick={e => { e.stopPropagation(); setCurrent(p => p - 1); }}
          aria-label={t.img_prev}
        >‹</button>
      )}

      {/* 다음 버튼 */}
      {current < urls.length - 1 && (
        <button
          style={{ ...S.arrowBtn, right: 12 }}
          onClick={e => { e.stopPropagation(); setCurrent(p => p + 1); }}
          aria-label={t.img_next}
        >›</button>
      )}

      {/* 페이지 표시 (2장 이상) */}
      {urls.length > 1 && (
        <div style={S.pageIndicator}>
          {urls.map((_, i) => (
            <span
              key={i}
              style={{ ...S.dot, ...(i === current ? S.dotActive : {}) }}
              onClick={e => { e.stopPropagation(); setCurrent(i); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.92)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  img: {
    maxWidth: '94vw',
    maxHeight: '85vh',
    objectFit: 'contain',
    borderRadius: 8,
    userSelect: 'none',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    color: '#fff',
    border: 'none',
    fontSize: 24,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-sans)',
  },
  arrowBtn: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 44,
    height: 44,
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    color: '#fff',
    border: 'none',
    fontSize: 30,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-sans)',
  },
  pageIndicator: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.35)',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  dotActive: {
    backgroundColor: '#fff',
  },
};
