// DollHome.jsx - Doll 메인 화면 (전체화면 앱 느낌)

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../utils/api';
import DollAvatar from '../components/DollAvatar';
import TopBar from '../components/TopBar';
import { useMemorial } from '../context/MemorialContext';
import { useT } from '../hooks/useT';
import { useLang } from '../contexts/LanguageContext';

const ACCENT_COLOR = '#c4956a'; // 성격 없이 기본 포인트 컬러

function timeAgo(ts, t) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return null;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 0)       return t.time_just_now;
  if (s < 60)      return t.time_just_now;
  if (s < 3600)    return t.time_minutes_ago(Math.floor(s/60));
  if (s < 86400)   return t.time_hours_ago(Math.floor(s/3600));
  if (s < 86400*7) return t.time_days_ago(Math.floor(s/86400));
  return t.time_weeks_ago(Math.floor(s/86400/7));
}

export default function DollHome() {
  const navigate = useNavigate();
  const { isMemorial, providerName } = useMemorial();
  const t = useT();
  const { lang } = useLang();

  const [doll, setDoll]             = useState(null);
  const [greeting, setGreeting]     = useState('');
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showConfirm, setShowConfirm]         = useState(false);
  const [deleting, setDeleting]               = useState(false);
  const [showLastMsgModal, setShowLastMsgModal] = useState(false);
  const [lastMsgInput, setLastMsgInput]       = useState('');
  const [savingMsg, setSavingMsg]             = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const r = await apiCall('GET', '/api/doll/me');
        if (!r?.doll) { navigate('/doll/create'); return; }
        setDoll(r.doll);
        const gr = await apiCall('GET', `/api/doll/greeting?dollId=${r.doll.id}&lang=${lang}`);
        setGreeting(gr?.greeting || '');
      } catch (e) {
        if (e.message?.includes('404') || e.message?.includes('없')) navigate('/doll/create');
        else setError(t.doll_load_error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [navigate]);

  async function saveLastMessage() {
    if (savingMsg) return;
    setSavingMsg(true);
    try {
      await apiCall('PATCH', '/api/doll/last-message', { message: lastMsgInput });
      setDoll((d) => ({ ...d, lastMessage: lastMsgInput.trim() }));
      setShowLastMsgModal(false);
    } catch {
      // 실패해도 모달 유지
    } finally {
      setSavingMsg(false);
    }
  }

  // mode: 'appearance' (외형만) | 'full' (기억까지)
  async function handleReset(mode) {
    if (mode === 'appearance') {
      // 외형만 변경: Doll 문서 유지, 이름+외모만 DollCreate에서 갱신
      navigate('/doll/create?reset=true&mode=appearance');
      return;
    }
    // 전체 초기화: Doll + 대화기록 삭제 후 새로 만들기
    setDeleting(true);
    try {
      await apiCall('DELETE', '/api/doll/me');
      navigate('/doll/create?reset=true');
    } catch {
      setError(t.doll_action_error);
      setShowConfirm(false);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return (
    <div style={S.center}>
      <div style={S.loadingRing}/>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 16 }}>{t.loading}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div style={S.center}>
      <p style={{ color: '#c0392b', fontSize: 14 }}>{error}</p>
      <button className="btn-primary" onClick={() => window.location.reload()} style={{ marginTop: 16 }}>{t.retry}</button>
    </div>
  );

  if (!doll) return null;

  const ap = doll.appearance || {};
  const pColor = isMemorial ? '#7b6fa0' : ACCENT_COLOR;
  // 추모 모드: Doll 이름 대신 고인 이름 표시
  const displayName = isMemorial && providerName ? `† ${providerName}` : doll.name;
  const totalChats = doll.totalChats || 0;
  const lastAt = timeAgo(doll.lastChatAt, t);

  return (
    <div style={S.page}>
      {/* 성격 색상 기반 그라데이션 배경 */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: `radial-gradient(ellipse at 50% 0%, ${pColor}28 0%, transparent 60%)`,
      }}/>

      <TopBar
        title={t.doll_my_title}
        onBack={() => navigate('/dashboard')}
        onRightClick={() => setShowConfirm(true)}
        rightIcon="🔄"
      />

      <main style={S.main}>
        {/* ── 아바타 히어로 영역 ── */}
        <div style={S.heroSection} className="anim-up">
          {/* 글로우 효과 */}
          <div style={{
            position: 'absolute', width: 260, height: 260, borderRadius: '50%',
            background: `radial-gradient(circle, ${pColor}35 0%, transparent 70%)`,
            top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            pointerEvents: 'none',
          }}/>

          <DollAvatar appearance={ap} size={180} animated />

          {/* 이름 + 배지 */}
          <div style={S.nameArea}>
            <h1 style={S.dollName}>{displayName}</h1>
            {doll.isDeceased && <span style={S.deceasedBadge}>{t.doll_from_heaven}</span>}
          </div>

          <div style={{ ...S.pBadge, backgroundColor: `${pColor}22`, color: pColor, border: `1px solid ${pColor}44` }}>
            {t.doll_growing}
          </div>
        </div>

        {/* ── 말풍선 ── */}
        {(isMemorial ? (doll.lastMessage || greeting) : greeting) && (
          <div style={{
            ...S.bubble,
            ...(isMemorial ? { backgroundColor: '#16213e', borderColor: '#2d2d4e' } : {}),
          }} className="anim-bubble delay-2">
            <div style={{
              ...S.bubbleTail,
              ...(isMemorial ? { borderBottomColor: '#2d2d4e' } : {}),
            }}/>
            <p style={{ ...S.bubbleText, ...(isMemorial ? { color: '#c8b8d8', fontStyle: 'normal' } : {}) }}>
              {isMemorial && doll.lastMessage
                ? `"${doll.lastMessage}"`
                : `"${greeting}"`}
            </p>
            {isMemorial && doll.lastMessage && (
              <p style={{ fontSize: 11, color: '#7b6fa0', textAlign: 'center', marginTop: 8, marginBottom: 0 }}>
                {t.doll_last_message_label}
              </p>
            )}
          </div>
        )}

        {/* ── 유언 메시지 설정 버튼 (추모 모드가 아닐 때만) ── */}
        {!isMemorial && (
          <button
            onClick={() => { setLastMsgInput(doll.lastMessage || ''); setShowLastMsgModal(true); }}
            style={S.lastMsgBtn}
            className="anim-up delay-4"
          >
            <span style={{ fontSize: 16 }}>✉️</span>
            <span>{doll.lastMessage ? t.doll_last_message_edit : t.doll_last_message_write}</span>
          </button>
        )}

        {/* ── 통계 카드 ── */}
        <div style={S.statsCard} className="anim-up delay-3">
          <div style={S.statItem}>
            <span style={S.statNum}>{totalChats.toLocaleString()}</span>
            <span style={S.statLab}>{t.doll_total_chats}</span>
          </div>
          {lastAt && (
            <>
              <div style={S.statDivider}/>
              <div style={S.statItem}>
                <span style={S.statNum}>{lastAt}</span>
                <span style={S.statLab}>{t.doll_last_chat}</span>
              </div>
            </>
          )}
          {!lastAt && totalChats === 0 && (
            <div style={S.statItem}>
              <span style={{ ...S.statNum, fontSize: 13, color: 'var(--text-muted)' }}>{t.doll_no_chats}</span>
              <span style={S.statLab}>{t.doll_start_chat}</span>
            </div>
          )}
        </div>

        {/* ── 힌트 텍스트 ── */}
        <p style={S.hint} className="anim-up delay-4">
          {isMemorial
            ? t.doll_hint_memorial(providerName || doll.name)
            : t.doll_hint_alive(doll.name)}
        </p>
      </main>

      {/* ── 하단 고정 버튼 ── */}
      <div style={{ ...S.fixedBottom, backgroundColor: isMemorial ? 'rgba(13,13,26,0.97)' : 'rgba(247,243,238,0.95)' }} className="anim-up delay-3">
        <div style={S.btnRow}>
          <button
            onClick={() => navigate('/doll/wardrobe')}
            style={S.wardrobeBtn}
          >
            <span style={{ fontSize: 20 }}>👗</span>
            <span>{t.edit}</span>
          </button>
          <button
            onClick={() => navigate('/doll/chat')}
            style={{ ...S.chatBtn, background: `linear-gradient(135deg, var(--primary) 0%, var(--primary-deep) 100%)` }}
          >
            <span style={{ fontSize: 20 }}>💬</span>
            <span>{t.doll_chat_btn}</span>
          </button>
        </div>
      </div>

      {/* ── 새로 만들기 선택 모달 ── */}
      {showConfirm && (
        <div style={S.overlay}>
          <div style={S.modal} className="anim-scale">
            <p style={S.modalEmoji}>🔄</p>
            <h3 style={S.modalTitle}>{t.doll_reset_title}</h3>
            <p style={S.modalDesc}>{t.doll_reset_desc}</p>

            {/* 옵션 1: 외형만 변경 */}
            <button
              onClick={() => handleReset('appearance')}
              disabled={deleting}
              style={S.optionCard}
            >
              <span style={S.optionIcon}>🎨</span>
              <div style={S.optionText}>
                <p style={S.optionTitle}>{t.doll_reset_appearance_title}</p>
                <p style={S.optionDesc}>
                  {t.doll_reset_appearance_desc1}<br/>
                  {t.doll_reset_appearance_desc2(doll?.name)}
                </p>
              </div>
            </button>

            {/* 옵션 2: 전체 초기화 */}
            <button
              onClick={() => handleReset('full')}
              disabled={deleting}
              style={{ ...S.optionCard, ...S.optionCardDanger }}
            >
              <span style={S.optionIcon}>🗑️</span>
              <div style={S.optionText}>
                <p style={{ ...S.optionTitle, color: '#c0392b' }}>{t.doll_reset_full_title}</p>
                <p style={S.optionDesc}>
                  {t.doll_reset_full_desc1}<br/>
                  {t.doll_reset_full_desc2}
                </p>
              </div>
            </button>

            {deleting && <p style={S.deletingText}>{t.processing}</p>}

            <button
              onClick={() => setShowConfirm(false)}
              style={S.cancelBtn}
              disabled={deleting}
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {/* ── 유언 메시지 작성 모달 ── */}
      {showLastMsgModal && (
        <div style={S.overlay}>
          <div style={S.modal} className="anim-scale">
            <p style={S.modalEmoji}>✉️</p>
            <h3 style={S.modalTitle}>{t.doll_last_msg_modal_title}</h3>
            <p style={S.modalDesc}>
              {t.doll_last_msg_modal_desc1}<br/>
              {t.doll_last_msg_modal_desc2}
            </p>
            <textarea
              value={lastMsgInput}
              onChange={(e) => setLastMsgInput(e.target.value)}
              placeholder={t.doll_last_msg_placeholder}
              rows={4}
              style={S.lastMsgTextarea}
              maxLength={200}
            />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', marginBottom: 12 }}>
              {lastMsgInput.length}/200
            </p>
            <button
              onClick={saveLastMessage}
              disabled={savingMsg}
              style={{ ...S.cancelBtn, backgroundColor: 'var(--primary)', color: 'white', border: 'none', marginBottom: 8 }}
            >
              {savingMsg ? t.saving : t.save}
            </button>
            <button
              onClick={() => setShowLastMsgModal(false)}
              style={S.cancelBtn}
              disabled={savingMsg}
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100dvh', backgroundColor: 'var(--bg)',
    fontFamily: 'var(--font-sans)', position: 'relative',
    display: 'flex', flexDirection: 'column',
  },
  center: {
    minHeight: '100dvh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)',
  },
  loadingRing: {
    width: 40, height: 40, borderRadius: '50%',
    border: '3px solid var(--border)', borderTopColor: 'var(--accent)',
    animation: 'spin 0.8s linear infinite',
  },
  main: {
    flex: 1, padding: '32px 20px 120px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
    position: 'relative', zIndex: 1,
  },
  heroSection: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    position: 'relative', paddingTop: 8,
  },
  nameArea: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 },
  dollName: {
    fontFamily: 'var(--font-serif)', fontSize: 36, color: 'var(--primary)',
    fontWeight: 700, letterSpacing: 1,
  },
  deceasedBadge: {
    fontSize: 11, color: 'var(--text-muted)', backgroundColor: 'var(--border-light)',
    padding: '3px 10px', borderRadius: 20, border: '1px solid var(--border)',
  },
  pBadge: {
    fontSize: 12, fontWeight: 600, padding: '6px 16px',
    borderRadius: 20, letterSpacing: 0.3,
  },
  bubble: {
    width: '100%', backgroundColor: 'var(--card)',
    borderRadius: 20, padding: '16px 20px',
    boxShadow: 'var(--shadow-md)', border: '1px solid var(--accent-light)',
    position: 'relative',
  },
  bubbleTail: {
    position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)',
    width: 0, height: 0,
    borderLeft: '9px solid transparent',
    borderRight: '9px solid transparent',
    borderBottom: '9px solid var(--accent-light)',
  },
  bubbleText: {
    fontSize: 14, color: 'var(--text)', lineHeight: 1.8,
    fontStyle: 'italic', textAlign: 'center', margin: 0,
  },
  statsCard: {
    width: '100%', backgroundColor: 'var(--card)',
    borderRadius: 20, padding: '18px 24px',
    boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24,
  },
  statItem:    { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  statNum:     { fontSize: 22, fontWeight: 800, color: 'var(--primary)' },
  statLab:     { fontSize: 11, color: 'var(--text-muted)' },
  statDivider: { width: 1, height: 36, backgroundColor: 'var(--border)' },
  hint:        { fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.7 },
  // 하단 고정 CTA
  fixedBottom: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    width: '100%', maxWidth: 390, margin: '0 auto',
    padding: '16px 20px',
    paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
    backgroundColor: 'rgba(247,243,238,0.95)',
    backdropFilter: 'blur(16px)',
    borderTop: '1px solid var(--border-light)',
    zIndex: 50,
  },
  btnRow: {
    display: 'flex', gap: 10,
  },
  wardrobeBtn: {
    flex: '0 0 auto', padding: '16px 20px',
    borderRadius: 16, border: '1.5px solid var(--border)',
    backgroundColor: 'var(--card)', color: 'var(--primary)',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: '0 2px 8px rgba(92,74,58,0.1)',
    transition: 'transform 0.2s',
  },
  overlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(61,46,34,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200, backdropFilter: 'blur(4px)',
  },
  modal: {
    backgroundColor: 'var(--card)', borderRadius: 24, padding: '36px 28px 28px',
    width: 'calc(100% - 48px)', maxWidth: 320, textAlign: 'center',
    boxShadow: '0 20px 60px rgba(61,46,34,0.25)',
  },
  modalEmoji:  { fontSize: 40, marginBottom: 12 },
  modalTitle:  {
    fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--primary)',
    fontWeight: 700, marginBottom: 12,
  },
  modalDesc:   { fontSize: 14, color: 'var(--text-mid)', lineHeight: 1.7, marginBottom: 8 },
  modalWarn:   {
    fontSize: 12, color: '#c0392b', backgroundColor: 'var(--bg)',
    padding: '8px 12px', borderRadius: 8, marginBottom: 20,
    border: '1px solid var(--border)',
  },
  optionCard: {
    width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12,
    padding: '14px 16px', borderRadius: 14, marginBottom: 10,
    border: '1.5px solid var(--border)', backgroundColor: 'var(--bg)',
    cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)',
    transition: 'border-color 0.15s, background-color 0.15s',
  },
  optionCardDanger: {
    borderColor: 'rgba(192,57,43,0.4)', backgroundColor: 'rgba(192,57,43,0.06)',
  },
  optionIcon:  { fontSize: 24, flexShrink: 0, marginTop: 2 },
  optionText:  { flex: 1 },
  optionTitle: { fontSize: 14, fontWeight: 700, color: 'var(--primary)', marginBottom: 4 },
  optionDesc:  { fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 },
  deletingText: { fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', margin: '4px 0' },
  cancelBtn: {
    width: '100%', padding: '12px', borderRadius: 12, marginTop: 4,
    border: '1.5px solid var(--border)', backgroundColor: 'var(--bg)',
    color: 'var(--text-mid)', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
  },
  chatBtn: {
    flex: 1, padding: '16px',
    borderRadius: 16, color: 'white', border: 'none',
    fontSize: 16, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    boxShadow: '0 6px 24px rgba(92,74,58,0.3)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  lastMsgBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '9px 18px', borderRadius: 20,
    border: '1.5px dashed var(--border)', backgroundColor: 'transparent',
    color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  lastMsgTextarea: {
    width: '100%', padding: '12px 14px', borderRadius: 12,
    border: '1.5px solid var(--border)', fontSize: 14, color: 'var(--text)',
    backgroundColor: 'var(--bg)', outline: 'none', resize: 'vertical',
    fontFamily: 'var(--font-sans)', lineHeight: 1.6, marginBottom: 4,
    boxSizing: 'border-box',
  },
};
