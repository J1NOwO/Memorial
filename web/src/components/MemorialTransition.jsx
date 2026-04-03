// MemorialTransition.jsx - isDeceased 활성화 순간 전환 애니메이션
// 검정 페이드 인 → 십자가 등장 → 페이드 아웃 → 추모 테마 노출
import { useState, useEffect } from 'react';

export default function MemorialTransition({ visible, onDone, lang }) {
  const [phase, setPhase] = useState('hidden'); // hidden | fadein | cross | fadeout

  useEffect(() => {
    if (!visible) return;
    setPhase('fadein');
    const t1 = setTimeout(() => setPhase('cross'),   900);
    const t2 = setTimeout(() => setPhase('fadeout'), 2600);
    const t3 = setTimeout(() => { setPhase('hidden'); onDone(); }, 3900);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [visible, onDone]);

  if (phase === 'hidden') return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: '#000',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20,
      opacity: phase === 'fadeout' ? 0 : 1,
      transition: phase === 'fadein'
        ? 'opacity 0.9s ease'
        : phase === 'fadeout'
        ? 'opacity 1.3s ease'
        : 'none',
      pointerEvents: phase === 'fadeout' ? 'none' : 'all',
    }}>
      {/* 십자가 */}
      <div style={{
        fontSize: 80,
        color: 'rgba(200,184,216,0.9)',
        opacity: phase === 'cross' ? 1 : 0,
        transform: phase === 'cross' ? 'scale(1) translateY(0)' : 'scale(0.4) translateY(24px)',
        transition: 'opacity 0.8s ease, transform 0.8s cubic-bezier(0.25,0.46,0.45,0.94)',
        fontFamily: "'Cormorant Garamond', serif",
        textShadow: '0 0 60px rgba(200,184,216,0.5)',
        userSelect: 'none',
        lineHeight: 1,
      }}>
        †
      </div>
      {/* 문구 */}
      <p style={{
        color: 'rgba(200,184,216,0.7)',
        fontSize: 14,
        fontFamily: 'var(--font-sans)',
        letterSpacing: 2,
        fontWeight: 400,
        opacity: phase === 'cross' ? 1 : 0,
        transition: 'opacity 0.8s ease 0.3s',
      }}>
        {lang === 'en' ? 'May they rest in peace' : '삼가 고인의 명복을 빕니다'}
      </p>
    </div>
  );
}
