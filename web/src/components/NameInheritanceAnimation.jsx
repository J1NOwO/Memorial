// NameInheritanceAnimation.jsx — 이름 계승 풀스크린 애니메이션 (~25초)
//
// 타임라인:
//  0s  ~ 3s   : 완전한 어둠
//  3s  ~ 6s   : 별 30개 하나씩 등장
//  6s  ~ 9s   : Doll 아바타 아래서 올라옴
//  9s  ~ 11s  : 기존 이름 페이드인
//  11s ~ 13.5s: 기존 이름 위로 스르륵 사라짐 + 별 어두워짐
//  13.5s~14s  : 정적
//  14s ~ 16s  : † 천천히 등장
//  16s ~ 18.5s: 고인 이름 — 빛 속에서 서서히 선명하게 나타남 (blur dissolve + letter-spacing)
//  18.5s~20s  : 아바타 발광 + 별 최대 밝기
//  20s ~ 22s  : 완료 문구 두 줄 순차 페이드인
//  22s ~ 25s  : 전체 페이드아웃
//  25s        : onDone()

import { useState, useEffect, useRef, useMemo } from 'react';
import DollAvatar from './DollAvatar';
import { apiCall } from '../utils/api';
import { useT } from '../hooks/useT';

const TOTAL_STARS = 50;

export default function NameInheritanceAnimation({ visible, providerName, onDone }) {
  const t = useT();
  const [doll, setDoll]               = useState(null);
  const [phase, setPhase]             = useState(0);
  const [visibleStars, setVisibleStars] = useState(0);
  const [starBright, setStarBright]   = useState('normal');
  const [nameVisible, setNameVisible] = useState(false);  // 이름 fade-in 트리거
  const [showMsg1, setShowMsg1]       = useState(false);
  const [showMsg2, setShowMsg2]       = useState(false);
  const [dollGlow, setDollGlow]       = useState(false);
  const [fadeout, setFadeout]         = useState(false);

  const onDoneRef  = useRef(onDone);
  const starIvRef  = useRef(null);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  // 별 50개 미리 생성
  const stars = useMemo(() =>
    Array.from({ length: TOTAL_STARS }, (_, i) => ({
      id:           i,
      left:         `${(Math.random() * 90 + 5).toFixed(1)}%`,
      top:          `${(Math.random() * 86 + 7).toFixed(1)}%`,
      size:         +(Math.random() * 3 + 1).toFixed(1),
      twinkleDur:   `${(Math.random() * 3 + 2).toFixed(1)}s`,
      twinkleDelay: `${(Math.random() * 5).toFixed(1)}s`,
      isShooting:   i < 5,
      shootDur:     `${(Math.random() * 8 + 10).toFixed(1)}s`,
      shootDelay:   `${(Math.random() * 12).toFixed(1)}s`,
    })), []
  );

  // visible 변경 시 초기화 + Doll 로드
  useEffect(() => {
    clearInterval(starIvRef.current);
    if (!visible) {
      setPhase(0); setVisibleStars(0); setStarBright('normal');
      setNameVisible(false); setShowMsg1(false); setShowMsg2(false);
      setDollGlow(false); setFadeout(false);
      return;
    }
    setPhase(0); setVisibleStars(0); setStarBright('normal');
    setNameVisible(false); setShowMsg1(false); setShowMsg2(false);
    setDollGlow(false); setFadeout(false);

    apiCall('GET', '/api/doll/me')
      .then(r => { if (r?.doll) setDoll(r.doll); })
      .catch(() => {});
  }, [visible]);

  // 메인 타임라인
  useEffect(() => {
    if (!visible || !doll) return;

    const timers = [];
    const t = (fn, ms) => timers.push(setTimeout(fn, ms));

    // 3s: 별 등장 시작
    t(() => {
      setPhase(1);
      let count = 0;
      clearInterval(starIvRef.current);
      starIvRef.current = setInterval(() => {
        count++;
        setVisibleStars(count);
        if (count >= 30) clearInterval(starIvRef.current);
      }, 100);
    }, 3000);

    // 6s: Doll 등장
    t(() => setPhase(2), 6000);

    // 9s: 기존 이름 나타남
    t(() => setPhase(3), 9000);

    // 11s: 기존 이름 위로 스르륵 사라짐 + 별 어두워짐
    t(() => { setPhase(4); setStarBright('dim'); }, 11000);

    // 13.5s: 정적
    t(() => setPhase(5), 13500);

    // 14s: † 등장, 별 복귀
    t(() => { setPhase(6); setStarBright('normal'); }, 14000);

    // 16s: 이름 — 빛 속에서 선명하게 나타남
    t(() => {
      setPhase(7);
      setNameVisible(true);
    }, 16000);

    // 18.5s: 이름 완전히 나타난 후 아바타 발광 + 별 최대
    t(() => {
      setDollGlow(true);
      setVisibleStars(TOTAL_STARS);
      setStarBright('bright');
    }, 18500);
    t(() => setDollGlow(false), 22000);

    // 22s: 완료 문구 등장
    t(() => setShowMsg1(true), 22000);
    t(() => setShowMsg2(true), 23500);

    // 28s: 페이드아웃
    t(() => setFadeout(true), 28000);

    // 31s: 완료
    t(() => onDoneRef.current?.(), 31000);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(starIvRef.current);
    };
  }, [visible, doll]);

  if (!visible) return null;

  const nameToShow = providerName || doll?.name || '';

  function starOpacity(i) {
    if (i >= visibleStars) return 0;
    if (starBright === 'dim')    return 0.15;
    if (starBright === 'bright') return 0.95;
    return 0.65;
  }

  function dollTransform() {
    if (phase <= 1)                  return 'translateY(44px)';
    if (phase === 4 || phase === 5)  return 'translateY(8px)';
    return 'translateY(0)';
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      backgroundColor: '#000',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      opacity: fadeout ? 0 : 1,
      transition: fadeout ? 'opacity 3s ease' : 'none',
      overflow: 'hidden',
      pointerEvents: fadeout ? 'none' : 'all',
    }}>

      {/* ── 별 ── */}
      {stars.map((s, i) => (
        <div key={s.id} style={{
          position: 'absolute',
          left: s.left, top: s.top,
          width: `${s.size}px`, height: `${s.size}px`,
          borderRadius: '50%',
          backgroundColor: 'white',
          opacity: starOpacity(i),
          transition: 'opacity 1.8s ease',
          animation: i < visibleStars && phase >= 2
            ? s.isShooting
              ? `shootingstar ${s.shootDur} linear ${s.shootDelay} infinite`
              : `twinkle ${s.twinkleDur} ease-in-out ${s.twinkleDelay} infinite`
            : 'none',
          pointerEvents: 'none',
        }} />
      ))}

      {/* ── 메인 콘텐츠 ── */}
      {doll && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 28,
          position: 'relative', zIndex: 1,
          padding: '0 40px', textAlign: 'center',
        }}>

          {/* 아바타 */}
          <div style={{
            opacity: phase >= 2 ? 1 : 0,
            transform: dollTransform(),
            transition: phase === 2
              ? 'opacity 2s ease, transform 2.2s cubic-bezier(0.25,0.46,0.45,0.94)'
              : 'opacity 0.8s ease, transform 1s ease',
          }}>
            <div style={{
              filter: dollGlow
                ? 'drop-shadow(0 0 50px rgba(255,255,255,0.95)) drop-shadow(0 0 100px rgba(200,184,216,0.6))'
                : phase >= 6
                ? 'drop-shadow(0 0 18px rgba(200,184,216,0.45))'
                : 'none',
              transition: dollGlow ? 'filter 0.3s ease' : 'filter 2.2s ease',
            }}>
              <DollAvatar appearance={doll.appearance || {}} size={130} animated />
            </div>
          </div>

          {/* 이름 영역 */}
          <div style={{ position: 'relative', width: 300, height: 72 }}>

            {/* 기존 Doll 이름 → 위로 스르륵 사라짐 */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 22, color: 'rgba(255,255,255,0.8)',
              fontWeight: 400, letterSpacing: 4,
              opacity: phase === 3 ? 1 : 0,
              transform: phase >= 4 ? 'translateY(-32px)' : 'translateY(0)',
              transition: phase <= 3
                ? 'opacity 1.5s ease'
                : 'opacity 2.8s ease, transform 2.8s cubic-bezier(0.4,0,0.2,1)',
              pointerEvents: 'none',
            }}>
              {doll.name}
            </div>

            {/* † 심볼 */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Cormorant Garamond', 'Noto Serif KR', serif",
              fontSize: 28, color: '#c8b8d8',
              opacity: phase >= 6 && !nameVisible ? 0.7 : 0,
              transform: phase >= 6 ? 'translateY(0)' : 'translateY(12px)',
              transition: 'opacity 2.5s ease, transform 2.5s ease',
              textShadow: '0 0 24px rgba(200,184,216,0.6)',
              pointerEvents: 'none',
            }}>
              †
            </div>

            {/* 새 이름 — 빛 속에서 서서히 선명하게 */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 26, fontWeight: 700,
              color: nameVisible ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0)',
              letterSpacing: nameVisible ? '5px' : '18px',
              filter: nameVisible ? 'blur(0px)' : 'blur(10px)',
              opacity: nameVisible ? 1 : 0,
              textShadow: nameVisible
                ? '0 0 30px rgba(200,184,216,0.7), 0 0 60px rgba(200,184,216,0.3)'
                : 'none',
              transition: nameVisible
                ? 'opacity 2.5s ease-out, filter 2.5s ease-out, letter-spacing 2.5s cubic-bezier(0.4,0,0.2,1), text-shadow 2.5s ease-out, color 2.5s ease-out'
                : 'none',
              pointerEvents: 'none',
            }}>
              <span style={{ color: '#c8b8d8', marginRight: 4 }}>†</span>
              <span>{nameToShow}</span>
            </div>
          </div>

          {/* 완료 문구 두 줄 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginTop: 8 }}>
            <p style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 14, color: '#c8b8d8',
              letterSpacing: 2.5, lineHeight: 2, margin: 0,
              opacity: showMsg1 ? 1 : 0,
              transform: showMsg1 ? 'translateY(0)' : 'translateY(14px)',
              transition: 'opacity 2s ease, transform 2s ease',
            }}>
              {t.animation_text1}
            </p>
            <p style={{
              fontFamily: "'Noto Serif KR', serif",
              fontSize: 14, color: '#c8b8d8',
              letterSpacing: 2.5, lineHeight: 2, margin: 0,
              opacity: showMsg2 ? 1 : 0,
              transform: showMsg2 ? 'translateY(0)' : 'translateY(14px)',
              transition: 'opacity 2s ease, transform 2s ease',
            }}>
              {t.animation_text2}
            </p>
          </div>
        </div>
      )}

      {/* 건너뛰기 */}
      <button
        onClick={() => onDoneRef.current?.()}
        style={{
          position: 'absolute', bottom: 28, right: 20,
          background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.25)', fontSize: 12,
          cursor: 'pointer', fontFamily: 'var(--font-sans)',
          padding: '8px 12px', letterSpacing: 0.5,
          transition: 'color 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
      >
        {t.animation_skip}
      </button>

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.12; transform: scale(0.7); }
          50%       { opacity: 1;    transform: scale(1.4); }
        }
        @keyframes shootingstar {
          0%   { transform: translateY(0) translateX(0); opacity: 0.9; }
          20%  { opacity: 0.85; }
          100% { transform: translateY(160px) translateX(-50px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
