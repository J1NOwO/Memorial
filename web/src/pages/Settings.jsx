// Settings.jsx - 앱 설정 페이지
// 앱 버전을 7번 연속 탭하면 개발자 모드 진입

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../contexts/LanguageContext';
import { useT } from '../hooks/useT';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';

const APP_VERSION = '1.0.0';

export default function Settings() {
  const navigate = useNavigate();
  const { userProfile, logout } = useAuth();
  const { lang, toggleLang } = useLang();
  const t = useT();

  const [toast, setToast]     = useState('');
  const tapCount              = useRef(0);
  const tapTimer              = useRef(null);

  function handleVersionTap() {
    tapCount.current += 1;
    clearTimeout(tapTimer.current);

    if (tapCount.current >= 7) {
      tapCount.current = 0;
      setToast(t.dev_mode_unlocked);
      setTimeout(() => { setToast(''); navigate('/dev'); }, 1200);
      return;
    }

    if (tapCount.current >= 3) {
      setToast(t.dev_mode_tap_hint(7 - tapCount.current));
    }

    tapTimer.current = setTimeout(() => {
      tapCount.current = 0;
      setToast('');
    }, 2000);
  }

  async function handleLogout() {
    try { await logout(); navigate('/'); } catch {}
  }

  return (
    <div style={S.page}>
      <TopBar title={t.settings} onBack={() => navigate(-1)} />

      <main style={S.main}>

        {/* ── 언어 선택 ── */}
        <section style={S.section}>
          <p style={S.sectionLabel}>{t.language}</p>
          <div style={S.card}>
            <div style={S.langRow}>
              <button
                style={{ ...S.langBtn, ...(lang === 'ko' ? S.langBtnActive : {}) }}
                onClick={() => toggleLang('ko')}
              >
                <span style={S.langFlag}>🇰🇷</span>
                <span style={{ ...S.langLabel, ...(lang === 'ko' ? S.langLabelActive : {}) }}>한국어</span>
              </button>
              <button
                style={{ ...S.langBtn, ...(lang === 'en' ? S.langBtnActive : {}) }}
                onClick={() => toggleLang('en')}
              >
                <span style={S.langFlag}>🇺🇸</span>
                <span style={{ ...S.langLabel, ...(lang === 'en' ? S.langLabelActive : {}) }}>English</span>
              </button>
            </div>
          </div>
        </section>

        {/* ── 계정 정보 ── */}
        <section style={S.section}>
          <p style={S.sectionLabel}>{t.settings_account}</p>
          <div style={S.card}>
            <Row label={t.settings_name}  value={userProfile?.name || '-'} />
            <Divider />
            <Row label={t.email} value={userProfile?.email || '-'} />
            <Divider />
            <Row label={t.settings_role}  value={
              userProfile?.role === 'provider'
                ? t.role_provider_label
                : t.role_family_label
            } />
          </div>
        </section>

        {/* ── 앱 정보 ── */}
        <section style={S.section}>
          <p style={S.sectionLabel}>{t.settings_app_info}</p>
          <div style={S.card}>
            <Row label={t.settings_service_label} value="Memorial" />
            <Divider />
            {/* 버전 텍스트 7번 탭 → 개발자 모드 */}
            <button style={S.versionRow} onClick={handleVersionTap}>
              <span style={S.rowLabel}>{t.settings_version}</span>
              <span style={S.rowValue}>{APP_VERSION}</span>
            </button>
          </div>
        </section>

        {/* ── 로그아웃 ── */}
        <section style={S.section}>
          <div style={S.card}>
            <button style={S.dangerRow} onClick={handleLogout}>
              {t.logout}
            </button>
          </div>
        </section>

      </main>

      {/* 토스트 */}
      {toast && (
        <div style={S.toast}>{toast}</div>
      )}

      <BottomNav />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={S.row}>
      <span style={S.rowLabel}>{label}</span>
      <span style={S.rowValue}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, backgroundColor: 'var(--border-light)', margin: '0 16px' }}/>;
}

const S = {
  page: { minHeight: '100dvh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)' },
  main: { padding: '16px 20px 100px', display: 'flex', flexDirection: 'column', gap: 24 },
  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  sectionLabel: { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.5, paddingLeft: 4 },
  card: {
    backgroundColor: 'var(--card)', borderRadius: 16,
    border: '1px solid var(--border-light)', overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
  },
  // 언어 선택
  langRow: {
    display: 'flex', gap: 10, padding: '14px 16px',
  },
  langBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '12px 16px', borderRadius: 12,
    border: '1.5px solid var(--border)', backgroundColor: 'var(--bg)',
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
    transition: 'all 0.2s',
  },
  langBtnActive: {
    borderColor: 'var(--accent)', backgroundColor: 'var(--accent-pale)',
    boxShadow: '0 2px 8px rgba(196,149,106,0.2)',
  },
  langFlag: { fontSize: 20 },
  langLabel: { fontSize: 14, fontWeight: 600, color: 'var(--text-mid)' },
  langLabelActive: { color: 'var(--accent)' },
  row: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 16px',
  },
  versionRow: {
    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  rowLabel: { fontSize: 14, color: 'var(--text)', fontWeight: 500 },
  rowValue: { fontSize: 14, color: 'var(--text-muted)' },
  dangerRow: {
    width: '100%', padding: '14px 16px', background: 'none', border: 'none',
    textAlign: 'left', fontSize: 14, color: '#c0392b', fontWeight: 600,
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
  },
  toast: {
    position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
    backgroundColor: '#3d2e22', color: 'white', fontSize: 13, fontWeight: 600,
    padding: '10px 20px', borderRadius: 20, zIndex: 300,
    whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
  },
};
