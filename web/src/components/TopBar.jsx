// TopBar.jsx - 상단 헤더 (뒤로가기 + 타이틀 + 💎 재화 표시)
import { useAuth } from '../context/AuthContext';
import { useMemorial } from '../context/MemorialContext';
import { useT } from '../hooks/useT';

export default function TopBar({ title, onBack, rightIcon, onRightClick, noBorder }) {
  const { userProfile } = useAuth();
  const { isMemorial } = useMemorial();
  const t = useT();
  const gems = userProfile?.gems ?? null;

  const memorialStyle = isMemorial ? {
    backgroundColor: 'rgba(22,33,62,0.97)',
    borderBottomColor: '#2d2d4e',
    boxShadow: 'none',
  } : {};

  return (
    <header style={{ ...S.header, ...(noBorder ? { borderBottom: 'none', boxShadow: 'none' } : {}), ...memorialStyle }}>
      {/* 왼쪽 */}
      <div style={S.side}>
        {onBack ? (
          <button onClick={onBack} style={S.iconBtn} aria-label={t.aria_back}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
        ) : null}
      </div>

      {/* 중앙 타이틀 */}
      <span style={S.title}>{title}</span>

      {/* 오른쪽: gems 표시 또는 커스텀 아이콘 */}
      <div style={{ ...S.side, justifyContent: 'flex-end' }}>
        {onRightClick ? (
          <button onClick={onRightClick} style={S.iconBtn} aria-label={t.aria_menu}>
            {rightIcon || '⋯'}
          </button>
        ) : gems !== null ? (
          <div style={S.gemsBadge}>
            <span style={{ fontSize: 13, lineHeight: 1 }}>💎</span>
            <span style={S.gemsNum}>{gems}</span>
          </div>
        ) : null}
      </div>
    </header>
  );
}

const S = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: 'rgba(255,253,249,0.92)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderBottom: '1px solid var(--border-light)',
    position: 'sticky',
    top: 0,
    zIndex: 50,
    flexShrink: 0,
    boxShadow: '0 1px 8px rgba(92,74,58,0.05)',
  },
  side: {
    width: 60,
    display: 'flex',
    alignItems: 'center',
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: '50%',
    background: 'var(--bg)', border: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text-mid)', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
  },
  title: {
    fontFamily: 'var(--font-serif)',
    fontSize: 17,
    color: 'var(--primary)',
    fontWeight: 600,
    letterSpacing: 0.5,
    flex: 1,
    textAlign: 'center',
  },
  gemsBadge: {
    display: 'flex', alignItems: 'center', gap: 4,
    backgroundColor: 'var(--accent-pale)',
    border: '1.5px solid var(--accent-light)',
    borderRadius: 20, padding: '5px 10px',
  },
  gemsNum: {
    fontSize: 13, fontWeight: 800, color: 'var(--accent)', lineHeight: 1,
  },
};
