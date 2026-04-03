// BottomNav.jsx - 하단 탭바 (홈 / Doll / 기억 / 가족)
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMemorial } from '../context/MemorialContext';
import { useT } from '../hooks/useT';

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { isMemorial } = useMemorial();
  const t = useT();

  const TABS_PROVIDER = [
    { path: '/dashboard', icon: '🏠', label: t.nav_home },
    { path: '/doll',      icon: '🪆', label: t.nav_doll },
    { path: '/memories',  icon: '📚', label: t.nav_memory },
    { path: '/diary',     icon: '📓', label: t.nav_diary },
    { path: '/shop',      icon: '💎', label: t.nav_shop },
    { path: '/family',    icon: '👨‍👩‍👧', label: t.nav_family },
  ];

  const TABS_PROVIDER_MEMORIAL = [
    { path: '/dashboard',     icon: '🏠', label: t.nav_home },
    { path: '/doll',          icon: '🪆', label: t.nav_doll },
    { path: '/memories',      icon: '📚', label: t.nav_memory },
    { path: '/diary',         icon: '📓', label: t.nav_diary },
    { path: '/memorial-book', icon: '🕯️', label: t.nav_memorial },
    { path: '/family',        icon: '👨‍👩‍👧', label: t.nav_family },
  ];

  const TABS_FAMILY = [
    { path: '/dashboard', icon: '🏠', label: t.nav_home },
    { path: '/memories',  icon: '📚', label: t.nav_memory },
    { path: '/family',    icon: '👨‍👩‍👧', label: t.nav_family },
  ];

  const tabs = userProfile?.role === 'family'
    ? TABS_FAMILY
    : isMemorial ? TABS_PROVIDER_MEMORIAL : TABS_PROVIDER;

  function isActive(path) {
    if (path === '/doll') return location.pathname.startsWith('/doll');
    return location.pathname === path;
  }

  const navBg   = isMemorial ? 'rgba(13,13,26,0.97)'  : 'rgba(255,253,249,0.96)';
  const activeC = isMemorial ? '#7b6fa0'               : 'var(--accent)';
  const inactC  = isMemorial ? '#4a4a6a'               : 'var(--text-muted)';
  const indicC  = isMemorial ? '#7b6fa0'               : 'var(--accent)';

  return (
    <nav style={{ ...S.nav, backgroundColor: navBg }}>
      {tabs.map((tab) => {
        const active = isActive(tab.path);
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={S.tab}
          >
            <span style={{ fontSize: 22, lineHeight: 1, filter: active ? 'none' : 'grayscale(0.5) opacity(0.6)' }}>
              {tab.icon}
            </span>
            <span style={{ ...S.label, color: active ? activeC : inactC, fontWeight: active ? 700 : 500 }}>
              {tab.label}
            </span>
            {active && <div style={{ ...S.indicator, backgroundColor: indicC }} />}
          </button>
        );
      })}
    </nav>
  );
}

const S = {
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    maxWidth: 390,
    margin: '0 auto',
    height: 64,
    backgroundColor: 'rgba(255,253,249,0.96)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderTop: '1px solid var(--border-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 100,
    paddingBottom: 'env(safe-area-inset-bottom)',
    boxShadow: '0 -4px 24px rgba(92,74,58,0.06)',
  },
  tab: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    flex: 1,
    padding: '8px 4px 6px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    fontFamily: 'var(--font-sans)',
    transition: 'transform 0.15s',
  },
  label: {
    fontSize: 10,
    lineHeight: 1,
    transition: 'color 0.15s',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    width: 24,
    height: 3,
    borderRadius: '0 0 3px 3px',
    backgroundColor: 'var(--accent)',
  },
};
