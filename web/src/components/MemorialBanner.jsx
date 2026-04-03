// MemorialBanner.jsx - 추모 모드 상단 고정 배너
import { useT } from '../hooks/useT';

export default function MemorialBanner() {
  const t = useT();
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'min(390px, 100vw)',
      zIndex: 200,
      backgroundColor: '#0d0d1a',
      color: '#c8b8d8',
      textAlign: 'center',
      fontSize: 12,
      fontWeight: 600,
      padding: '0 16px',
      borderBottom: '1px solid rgba(200,184,216,0.2)',
      letterSpacing: 1,
      fontFamily: 'var(--font-sans)',
      height: 33,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    }}>
      <span style={{ opacity: 0.7 }}>†</span>
      {t.rip_message}
      <span style={{ opacity: 0.7 }}>†</span>
    </div>
  );
}
