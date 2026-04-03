// Dashboard.jsx - 메인 대시보드 (모바일 우선)

import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useT } from '../hooks/useT';
import { useLang } from '../contexts/LanguageContext';
import { apiCall } from '../utils/api';
import DollAvatar from '../components/DollAvatar';
import BottomNav from '../components/BottomNav';
import { useMemorial } from '../context/MemorialContext';

function getTimeGreeting(t) {
  const h = new Date().getHours();
  if (h < 6)  return `${t.greeting_night} 🌙`;
  if (h < 11) return `${t.greeting_morning} ☀️`;
  if (h < 14) return `${t.greeting_afternoon} 🌤`;
  if (h < 18) return `${t.greeting_afternoon} 🌿`;
  if (h < 22) return `${t.greeting_evening} 🌆`;
  return `${t.greeting_night} 🌙`;
}

export default function Dashboard() {
  const { user, userProfile, logout } = useAuth();
  const t = useT();
  const { lang } = useLang();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [pendingInvite, setPendingInvite] = useState(null);
  const [retryLoading, setRetryLoading]   = useState(false);
  const [retryError, setRetryError]       = useState('');
  const [retrySuccess, setRetrySuccess]   = useState(false);

  const [isTrustedFamily, setIsTrustedFamily] = useState(false);
  const [providerDeceased, setProviderDeceased] = useState(false);

  const [doll, setDoll]               = useState(null);
  const [dollGreeting, setDollGreeting] = useState('');
  const [todayCount, setTodayCount]   = useState(0);
  const DAILY_Q = 3;

  useEffect(() => {
    if (location.state?.pendingInvite) setPendingInvite(location.state);
  }, [location.state]);

  // 유족: 연결 정보 로드
  useEffect(() => {
    if (!user || userProfile?.role !== 'family') return;
    async function loadFamily() {
      try {
        const q = query(collection(db,'connections'), where('familyId','==',user.uid), where('status','==','accepted'));
        const snap = await getDocs(q);
        if (snap.empty) return;
        const conn = snap.docs[0].data();
        setIsTrustedFamily(conn.isTrusted === true);
        const pSnap = await getDoc(doc(db,'users',conn.providerId));
        if (pSnap.exists()) setProviderDeceased(pSnap.data().isDeceased === true);
      } catch {}
    }
    loadFamily();
  }, [user, userProfile]);

  // 제공자: Doll + 오늘 질문 진행률 로드
  useEffect(() => {
    if (!user || userProfile?.role !== 'provider') return;
    async function loadDoll() {
      try {
        const r = await apiCall('GET', '/api/doll/me');
        if (r?.doll) {
          setDoll(r.doll);
          const gr = await apiCall('GET', `/api/doll/greeting?dollId=${r.doll.id}&lang=${lang}`);
          setDollGreeting(gr?.greeting || '');
        }
      } catch {}
    }
    async function loadTodayProgress() {
      try {
        // createdAt 범위 필터는 복합 인덱스 필요 → userId만 쿼리 후 클라이언트에서 날짜 필터
        const snap = await getDocs(
          query(collection(db, 'answers'), where('userId', '==', user.uid))
        );
        const today = new Date().toISOString().split('T')[0];
        const count = snap.docs.filter((d) => {
          const ts = d.data().createdAt?.toDate?.();
          return ts && ts.toISOString().split('T')[0] === today;
        }).length;
        setTodayCount(count);
      } catch {}
    }
    loadDoll();
    loadTodayProgress();
  }, [user, userProfile]);

  async function handleLogout() {
    try { await logout(); navigate('/'); } catch { alert(t.error_logout); }
  }

  async function handleRetryJoin() {
    if (!pendingInvite) return;
    setRetryLoading(true); setRetryError('');
    try {
      await apiCall('POST', '/api/connections/join', { inviteCode: pendingInvite.pendingInvite, relation: pendingInvite.relation });
      setRetrySuccess(true); setPendingInvite(null);
    } catch (e) {
      setRetryError(e.message || t.connect_error);
    } finally { setRetryLoading(false); }
  }

  const { isMemorial, providerName } = useMemorial();
  const [showMemorialQModal, setShowMemorialQModal] = useState(false);
  const isProvider = userProfile?.role === 'provider';
  const isFamily   = userProfile?.role === 'family';
  const name       = userProfile?.name || user?.displayName?.split(' ')[0] || t.me;
  const progressPct = Math.min((todayCount / DAILY_Q) * 100, 100);

  if (showMemorialQModal) return (
    <div style={S.modalOverlay}>
      <span style={S.modalCross}>†</span>
      <h2 style={S.modalTitle}>{t.dashboard_memorial_complete}</h2>
      <p style={S.modalSub}>{t.dashboard_memorial_complete_desc}</p>
      <button style={S.modalBtn} onClick={() => setShowMemorialQModal(false)}>← {t.back}</button>
    </div>
  );

  return (
    <div style={S.page}>
      {/* 배경 장식 */}
      <div style={S.bgBlob}/>

      {/* ── 상단 로고 바 ── */}
      <header style={{
        ...S.header,
        ...(isMemorial ? {
          backgroundColor: 'rgba(22,33,62,0.97)',
          borderBottomColor: '#2d2d4e',
        } : {}),
      }}>
        <span style={{ ...S.logo, ...(isMemorial ? { color: '#c8b8d8' } : {}) }}>Memorial</span>
        <button onClick={() => navigate('/settings')} style={S.settingsBtn}>⚙️</button>
      </header>

      <main style={S.main} className="pb-nav">

        {/* ── 인사말 ── */}
        <div style={S.hero} className="anim-up">
          {isMemorial ? (
            <>
              <h1 style={{ ...S.greeting, fontSize: 24, letterSpacing: 0.5 }}>
                † {providerName}
              </h1>
              <p style={S.subText}>{t.rip_message}</p>
            </>
          ) : (
            <>
              <p style={S.timeGreet}>{getTimeGreeting(t)}</p>
              <h1 style={S.greeting}>{t.greeting_hello(name)}</h1>
              <p style={S.subText}>
                {isProvider ? t.dashboard_subtext_provider : t.dashboard_subtext_family}
              </p>
            </>
          )}
        </div>

        {/* ── 재시도 배너 ── */}
        {pendingInvite && !retrySuccess && (
          <div style={S.banner} className="anim-up">
            <p style={{ fontSize: 13, color: 'var(--text-mid)', marginBottom: 8 }}>
              {t.connect_pending(pendingInvite.pendingInvite)}
            </p>
            {retryError && <p style={{ fontSize: 12, color: '#c0392b', marginBottom: 6 }}>{retryError}</p>}
            <button className="btn-primary" style={{ fontSize: 13, padding: '9px 20px' }}
              onClick={handleRetryJoin} disabled={retryLoading}>
              {retryLoading ? t.connect_connecting : t.connect_retry}
            </button>
          </div>
        )}
        {retrySuccess && (
          <div style={{ ...S.banner, borderColor: '#86efac', backgroundColor: '#f0fdf4' }} className="anim-up">
            <p style={{ fontSize: 13, color: '#166534' }}>{t.connect_success}</p>
          </div>
        )}

        {/* ── 제공자 콘텐츠 ── */}
        {isProvider && (
          <>
            {/* Doll 카드 */}
            <div className="anim-up delay-1">
              {doll ? (
                <Link to="/doll" style={S.dollCard}>
                  {/* 아바타 영역 */}
                  <div style={S.dollAvatarWrap}>
                    <DollAvatar appearance={doll.appearance || {}} size={90} animated />
                  </div>
                  {/* 텍스트 영역 */}
                  <div style={S.dollBody}>
                    <div style={S.dollTop}>
                      <span style={S.dollName}>{isMemorial ? `† ${providerName || doll.name}` : doll.name}</span>
                      <span style={S.dollBadge}>{t.doll_my_badge}</span>
                    </div>
                    <p style={S.dollGreeting}>
                      {isMemorial
                        ? t.doll_memorial_greeting
                        : dollGreeting
                          ? `"${dollGreeting.length > 45 ? dollGreeting.slice(0,45)+'…' : dollGreeting}"`
                          : t.doll_today_cta}
                    </p>
                    <span style={S.dollCta}>{t.doll_chat_cta}</span>
                  </div>
                </Link>
              ) : (
                <Link to="/doll/create" style={S.dollCardEmpty}>
                  <div style={S.dollEmptyIcon}>🪆</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)', marginBottom: 3 }}>{t.dashboard_doll_create}</p>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t.dashboard_doll_create_desc}</p>
                  </div>
                  <span style={{ color: 'var(--accent)', fontSize: 18 }}>→</span>
                </Link>
              )}
            </div>

            {/* 오늘의 질문 카드 */}
            {isMemorial ? (
              <div style={{ ...S.progressCard, cursor: 'pointer' }} className="anim-up delay-2"
                onClick={() => setShowMemorialQModal(true)}>
                <p style={{ ...S.progressTitle, marginBottom: 8 }}>✍️ {t.today_question}</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                  {t.dashboard_memorial_q_desc}
                </p>
              </div>
            ) : (
              <Link to="/questions" style={S.progressCard} className="anim-up delay-2">
                <div style={S.progressTop}>
                  <div>
                    <p style={S.progressTitle}>✍️ {t.today_question}</p>
                    <p style={S.progressSub}>{t.daily_q_sub(DAILY_Q)}</p>
                  </div>
                  <span style={S.progressCount}>
                    <strong style={{ color: 'var(--accent)', fontSize: 20 }}>{Math.min(todayCount, DAILY_Q)}</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>/{DAILY_Q}</span>
                  </span>
                </div>
                <div style={S.progressBar}>
                  <div style={{ ...S.progressFill, width: `${progressPct}%` }} />
                </div>
                <p style={S.progressHint}>
                  {todayCount >= DAILY_Q ? t.daily_q_complete : t.daily_q_remaining(DAILY_Q - todayCount)}
                </p>
              </Link>
            )}

            {/* 기능 카드 2개 */}
            <div style={S.grid} className="anim-up delay-3">
              <FeatureCard to="/memories" icon="📚" title={t.my_memory} desc={t.memory_desc}/>
              <FeatureCard to="/family"   icon="👨‍👩‍👧" title={t.family_connect} desc={t.family_connect_desc}/>
            </div>

            {/* 초대 코드 */}
            {userProfile?.inviteCode && (
              <div style={S.inviteRow} className="anim-up delay-4">
                <div>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, letterSpacing: 0.5 }}>{t.invite_code_label}</p>
                  <p style={S.inviteCode}>{userProfile.inviteCode}</p>
                </div>
                <Link to="/family" style={S.inviteLink}>{t.invite_manage}</Link>
              </div>
            )}
          </>
        )}

        {/* ── 유족 콘텐츠 ── */}
        {isFamily && (
          <div style={S.grid} className="anim-up delay-1">
            {providerDeceased ? (
              <FeatureCard to="/chat" icon="💬" title={t.chat_title} desc={t.chat_desc} highlight />
            ) : (
              <div style={{ ...S.featureCard, opacity: 0.45, cursor: 'not-allowed', gridColumn: 'span 2' }}>
                <span style={{ fontSize: 28, display: 'block', marginBottom: 10 }}>💬</span>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>{t.chat_title}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t.chat_disabled_desc}</p>
              </div>
            )}
            {isTrustedFamily && !providerDeceased && (
              <FeatureCard to="/trust" icon="🔑" title={t.trust_title} desc={t.trust_desc} accent />
            )}
          </div>
        )}

        {!userProfile && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, padding: '40px 0' }}>
            {t.profile_loading}
          </div>
        )}
      </main>

      <BottomNav />

      {/* 추모 모드 질문 완성 모달 */}
    </div>
  );
}

function FeatureCard({ to, icon, title, desc, highlight, accent }) {
  const extra = highlight
    ? { background: 'linear-gradient(135deg, #5c4a3a 0%, #3d2e22 100%)', color: 'white', border: 'none' }
    : accent
    ? { borderColor: 'var(--accent)', backgroundColor: 'var(--accent-pale)' }
    : {};

  return (
    <Link to={to} style={{ ...S.featureCard, ...extra, textDecoration: 'none' }} className="card-lift">
      <span style={{ fontSize: 28, display: 'block', marginBottom: 10 }}>{icon}</span>
      <p style={{ fontSize: 15, fontWeight: 700, color: highlight ? 'white' : 'var(--primary)', marginBottom: 4 }}>{title}</p>
      <p style={{ fontSize: 12, color: highlight ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</p>
    </Link>
  );
}

const S = {
  page: {
    minHeight: '100dvh',
    backgroundColor: 'var(--bg)',
    fontFamily: 'var(--font-sans)',
    position: 'relative',
  },
  bgBlob: {
    position: 'fixed', top: -100, right: -80, width: 320, height: 320,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(196,149,106,0.15) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0,
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 20px',
    backgroundColor: 'rgba(255,253,249,0.92)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid var(--border-light)',
    position: 'sticky', top: 0, zIndex: 10,
  },
  logo: {
    fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--primary)',
    fontWeight: 700, letterSpacing: 3,
  },
  settingsBtn: {
    fontSize: 20, background: 'none', border: 'none',
    cursor: 'pointer', padding: '4px 8px', lineHeight: 1,
  },
  main: {
    padding: '24px 20px 20px',
    display: 'flex', flexDirection: 'column', gap: 16,
    position: 'relative', zIndex: 1,
  },
  hero: { marginBottom: 4 },
  timeGreet: {
    fontSize: 13, color: 'var(--accent)', fontWeight: 600, letterSpacing: 0.3, marginBottom: 6,
  },
  greeting: {
    fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--primary)',
    fontWeight: 700, lineHeight: 1.25, marginBottom: 6,
  },
  subText: { fontSize: 14, color: 'var(--text-mid)' },
  banner: {
    backgroundColor: 'var(--accent-pale)', border: '1px solid var(--accent-light)',
    borderRadius: 'var(--radius-md)', padding: '14px 16px',
  },
  // Doll 카드 (있을 때)
  dollCard: {
    display: 'flex', alignItems: 'center',
    backgroundColor: 'var(--card)', borderRadius: 20,
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--border-light)',
    textDecoration: 'none', color: 'inherit',
    overflow: 'hidden',
    transition: 'transform 0.2s var(--ease), box-shadow 0.2s',
  },
  dollAvatarWrap: {
    background: 'linear-gradient(160deg, var(--accent-pale) 0%, var(--bg) 100%)',
    padding: '16px 12px',
    flexShrink: 0,
    borderRight: '1px solid var(--border-light)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  dollBody: { padding: '16px 18px', flex: 1, minWidth: 0 },
  dollTop: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 },
  dollName: {
    fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--primary)', fontWeight: 700,
  },
  dollBadge: {
    fontSize: 10, color: 'var(--accent)', backgroundColor: 'var(--accent-pale)',
    padding: '2px 8px', borderRadius: 12, border: '1px solid var(--accent-light)', fontWeight: 600,
  },
  dollGreeting: {
    fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6, fontStyle: 'italic', marginBottom: 8,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  dollCta: { fontSize: 12, color: 'var(--accent)', fontWeight: 700 },
  // Doll 카드 (없을 때)
  dollCardEmpty: {
    display: 'flex', alignItems: 'center', gap: 14,
    backgroundColor: 'var(--card)', borderRadius: 20,
    padding: '18px 20px', border: '2px dashed var(--border)',
    textDecoration: 'none', color: 'inherit',
    transition: 'all 0.2s', cursor: 'pointer',
  },
  dollEmptyIcon: {
    width: 52, height: 52, borderRadius: '50%',
    backgroundColor: 'var(--bg)', border: '1.5px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0,
  },
  // 질문 진행률 카드
  progressCard: {
    backgroundColor: 'var(--card)', borderRadius: 20,
    padding: '18px 20px',
    border: '1px solid var(--border-light)',
    boxShadow: 'var(--shadow-sm)',
    textDecoration: 'none', color: 'inherit',
    display: 'block',
    transition: 'transform 0.2s var(--ease), box-shadow 0.2s',
  },
  progressTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  progressTitle: { fontSize: 15, fontWeight: 700, color: 'var(--primary)', marginBottom: 3 },
  progressSub: { fontSize: 12, color: 'var(--text-muted)' },
  progressCount: { display: 'flex', alignItems: 'baseline', gap: 2 },
  progressBar: {
    height: 6, backgroundColor: 'var(--border-light)', borderRadius: 3, overflow: 'hidden', marginBottom: 10,
  },
  progressFill: {
    height: '100%', backgroundColor: 'var(--accent)',
    borderRadius: 3, transition: 'width 0.5s var(--ease)',
  },
  progressHint: { fontSize: 12, color: 'var(--text-muted)' },
  // 기능 카드 그리드
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  featureCard: {
    backgroundColor: 'var(--card)', borderRadius: 20,
    padding: '20px 16px', border: '1px solid var(--border-light)',
    boxShadow: 'var(--shadow-sm)', display: 'block',
  },
  // 초대 코드
  inviteRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'var(--card)', borderRadius: 16,
    padding: '14px 18px', border: '1px solid var(--border-light)',
    boxShadow: 'var(--shadow-sm)',
  },
  inviteCode: {
    fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 700,
    color: 'var(--primary)', letterSpacing: 2,
  },
  inviteLink: { fontSize: 13, color: 'var(--accent)', fontWeight: 700 },
  modalOverlay: {
    minHeight: '100dvh',
    backgroundColor: 'var(--bg)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', padding: '40px 32px', gap: 16,
    fontFamily: 'var(--font-sans)',
  },
  modalCross: {
    fontSize: 52, lineHeight: 1,
  },
  modalTitle: {
    fontSize: 20, fontWeight: 700,
    color: 'var(--primary)', fontFamily: 'var(--font-serif)',
  },
  modalSub: {
    fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.8,
  },
  modalBtn: {
    marginTop: 8, padding: '13px 32px', borderRadius: 14,
    border: '1.5px solid #3d3560',
    backgroundColor: '#1e1e3a', color: '#c8b8d8',
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'var(--font-sans)', letterSpacing: 0.3,
  },
};
