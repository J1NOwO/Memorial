// DollChat.jsx - Doll 채팅 (카카오톡 스타일 말풍선)

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../utils/api';
import DollAvatar from '../components/DollAvatar';
import { useMemorial } from '../context/MemorialContext';
import { useLang } from '../contexts/LanguageContext';
import { useT } from '../hooks/useT';

export default function DollChat() {
  const navigate = useNavigate();
  const { isMemorial, providerName } = useMemorial();
  const { lang } = useLang();
  const t = useT();

  const [doll, setDoll]       = useState(null);
  const [msgs, setMsgs]       = useState([]);
  const [input, setInput]     = useState('');
  const [typing, setTyping]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const r = await apiCall('GET', '/api/doll/me');
        if (!r?.doll) { navigate('/doll/create'); return; }
        setDoll(r.doll);

        const chatR = await apiCall('GET', `/api/doll/chat/today?dollId=${r.doll.id}`);
        const history = (chatR?.messages || []).map((m) => ({ role: m.role, content: m.content }));

        if (history.length === 0) {
          if (r.doll.isDeceased && r.doll.lastMessage) {
            setMsgs([{ role: 'doll', content: r.doll.lastMessage }]);
          } else {
            const grR = await apiCall('GET', `/api/doll/greeting?dollId=${r.doll.id}&lang=${lang}`);
            if (grR?.greeting) setMsgs([{ role: 'doll', content: grR.greeting }]);
          }
        } else {
          setMsgs(history);
        }
      } catch {
        setError(t.chat_error_load);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, typing]);

  async function send() {
    const text = input.trim();
    if (!text || typing) return;
    setInput('');
    setMsgs((p) => [...p, { role: 'user', content: text }]);
    setTyping(true);
    try {
      const r = await apiCall('POST', '/api/doll/chat', { dollId: doll.id, message: text, lang });
      setMsgs((p) => [...p, { role: 'doll', content: r.reply }]);
    } catch {
      setMsgs((p) => [...p, { role: 'doll', content: t.chat_fallback }]);
    } finally {
      setTyping(false);
      inputRef.current?.focus();
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  if (loading) return (
    <div style={S.center}>
      <div style={S.spinner}/>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 14 }}>{t.doll_thinking}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error || !doll) return (
    <div style={S.center}>
      <p style={{ color: '#c0392b', fontSize: 14 }}>{error || t.doll_not_found}</p>
      <button className="btn-ghost" style={{ marginTop: 16 }} onClick={() => navigate('/doll')}>{t.back}</button>
    </div>
  );

  const ap = doll.appearance || {};
  // 추모 모드: 고인 이름 우선, 없으면 Doll 이름
  const displayName = isMemorial
    ? `† ${providerName || doll.name}`
    : doll.name;

  return (
    <div style={{ ...S.page, ...(isMemorial ? { backgroundColor: 'var(--bg)' } : {}) }}>
      {/* ── 상단 헤더 ── */}
      <header style={{
        ...S.header,
        ...(isMemorial ? { backgroundColor: 'rgba(22,33,62,0.97)', borderBottomColor: 'var(--border)' } : {}),
      }}>
        <button style={S.backBtn} onClick={() => navigate('/doll')} aria-label={t.aria_back}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>

        <div style={S.headerCenter}>
          <div style={S.headerAvatarWrap}>
            <DollAvatar appearance={ap} size={34} />
          </div>
          <div>
            <div style={S.headerName}>{displayName}</div>
            <div style={S.headerStatus}>
              {isMemorial ? (
                <span style={{ color: '#9088a8', fontSize: 11 }}>
                  {t.chat_deceased_status(providerName || doll.name)}
                </span>
              ) : (
                <>
                  <span style={{ ...S.statusDot, backgroundColor: doll.isDeceased ? '#7ab89a' : '#8abe8a' }}/>
                  {doll.isDeceased ? t.chat_connected_heaven : t.chat_available}
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{ width: 36 }}/>
      </header>

      {/* ── 날짜 구분선 ── */}
      <div style={S.dateDivider}>
        <span style={S.dateLabel}>
          {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
        </span>
      </div>

      {/* ── 메시지 영역 ── */}
      <div style={S.msgArea}>
        {msgs.length === 0 && (
          <div style={S.emptyState}>
            <DollAvatar appearance={ap} size={80} />
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 14 }}>
              {t.chat_waiting(doll.name)}
            </p>
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} style={{ ...S.msgRow, ...(m.role === 'user' ? S.msgRowUser : {}) }}>
            {m.role === 'doll' && (
              <div style={S.smallAvatar}>
                <DollAvatar appearance={ap} size={30} />
              </div>
            )}
            <div style={{ maxWidth: '72%' }}>
              {m.role === 'doll' && (
                <span style={S.senderName}>{doll.name}</span>
              )}
              <div style={{
                ...S.bubble,
                ...(m.role === 'user' ? S.bubbleUser : S.bubbleDoll),
                ...(m.role === 'doll' && isMemorial ? {
                  backgroundColor: '#16213e',
                  borderColor: '#2d2d4e',
                } : {}),
              }}>
                <p style={{ ...S.bubbleText, color: m.role === 'user' ? 'white' : 'var(--text)' }}>
                  {m.content}
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* 타이핑 인디케이터 */}
        {typing && (
          <div style={S.msgRow}>
            <div style={S.smallAvatar}><DollAvatar appearance={ap} size={30} /></div>
            <div>
              <span style={S.senderName}>{doll.name}</span>
              <div style={{ ...S.bubble, ...S.bubbleDoll, padding: '12px 16px' }}>
                <div style={S.dots}>
                  {[0, 0.22, 0.44].map((d, i) => (
                    <span key={i} style={{ ...S.dot, animationDelay: `${d}s` }}/>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef}/>
      </div>

      {/* ── 입력창 (하단 고정) ── */}
      <div style={S.inputWrap}>
        <div style={S.inputRow}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder={isMemorial
              ? t.chat_memorial_placeholder(providerName || doll.name)
              : t.doll_chat_placeholder}
            rows={1}
            style={S.textarea}
          />
          <button
            onClick={send}
            disabled={!input.trim() || typing}
            style={{ ...S.sendBtn, opacity: (!input.trim() || typing) ? 0.4 : 1 }}
            aria-label={t.aria_send}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" style={{ transform: 'rotate(90deg)' }}>
              <path d="M12 19V5M5 12l7-7 7 7"/>
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes dotB { 0%,80%,100% { transform:translateY(0); opacity:.4; } 40% { transform:translateY(-6px); opacity:1; } }
      `}</style>
    </div>
  );
}

const S = {
  page: {
    height: '100dvh', display: 'flex', flexDirection: 'column',
    backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)',
  },
  center: {
    minHeight: '100dvh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)',
  },
  spinner: {
    width: 36, height: 36, borderRadius: '50%',
    border: '3px solid var(--border)', borderTopColor: 'var(--accent)',
    animation: 'spin 0.8s linear infinite',
  },
  // 헤더
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 16px', flexShrink: 0,
    backgroundColor: 'rgba(255,253,249,0.96)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid var(--border-light)',
    boxShadow: '0 1px 8px rgba(92,74,58,0.06)',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: '50%',
    background: 'var(--bg)', border: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text-mid)', cursor: 'pointer', transition: 'all 0.15s',
  },
  headerCenter: { display: 'flex', alignItems: 'center', gap: 10 },
  headerAvatarWrap: {
    borderRadius: '50%', overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(92,74,58,0.15)',
  },
  headerName:   { fontSize: 15, fontWeight: 700, color: 'var(--text)' },
  headerStatus: { fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 },
  statusDot:    { width: 6, height: 6, borderRadius: '50%', display: 'inline-block' },
  // 날짜
  dateDivider: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '10px 16px 4px', flexShrink: 0,
  },
  dateLabel: {
    fontSize: 11, color: 'var(--text-muted)',
    backgroundColor: 'var(--border-light)', padding: '4px 12px', borderRadius: 20,
  },
  // 메시지 영역
  msgArea: {
    flex: 1, overflowY: 'auto', padding: '8px 16px 8px',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  emptyState: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: '40px 0',
  },
  msgRow: {
    display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 2,
  },
  msgRowUser: { flexDirection: 'row-reverse' },
  smallAvatar: {
    flexShrink: 0, borderRadius: '50%', overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(92,74,58,0.12)',
  },
  senderName: {
    display: 'block', fontSize: 11, color: 'var(--text-muted)',
    marginBottom: 3, marginLeft: 4,
  },
  bubble: { padding: '10px 14px', borderRadius: 18, wordBreak: 'break-word' },
  bubbleDoll: {
    backgroundColor: 'var(--card)',
    borderBottomLeftRadius: 5,
    boxShadow: '0 1px 4px rgba(92,74,58,0.08)',
    border: '1px solid var(--border-light)',
  },
  bubbleUser: {
    background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-deep) 100%)',
    borderBottomRightRadius: 5,
    boxShadow: '0 2px 8px rgba(92,74,58,0.25)',
  },
  bubbleText: { fontSize: 14, lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' },
  dots: { display: 'flex', gap: 5, padding: '2px 0' },
  dot: {
    width: 7, height: 7, borderRadius: '50%', backgroundColor: 'var(--accent)',
    display: 'inline-block', animation: 'dotB 1.3s ease-in-out infinite',
  },
  // 입력창
  inputWrap: {
    padding: '10px 14px',
    paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
    flexShrink: 0,
    backgroundColor: 'var(--card)',
    borderTop: '1px solid var(--border-light)',
    boxShadow: '0 -4px 20px rgba(92,74,58,0.05)',
  },
  inputRow: { display: 'flex', gap: 8, alignItems: 'flex-end' },
  textarea: {
    flex: 1, padding: '11px 16px', borderRadius: 22,
    border: '1.5px solid var(--border)', fontSize: 14, color: 'var(--text)',
    backgroundColor: 'var(--bg)', outline: 'none', resize: 'none',
    fontFamily: 'var(--font-sans)', lineHeight: 1.5,
    maxHeight: 120, overflowY: 'auto', transition: 'border-color 0.2s',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-deep) 100%)',
    border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, boxShadow: '0 3px 10px rgba(92,74,58,0.3)',
    transition: 'opacity 0.15s, transform 0.15s',
  },
};
