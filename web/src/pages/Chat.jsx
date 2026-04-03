// Chat.jsx - 유족용 AI 페르소나 대화 화면
//
// 기능:
// 1. 연결된 제공자(고인) 정보 로드
// 2. 메시지 입력 → POST /api/chat → Gemini 페르소나 답변 표시
// 3. 대화 내역은 로컬 state로만 관리 (새로고침 시 초기화, Firestore 저장 없음)
// 4. 접근 조건: isDeceased=true인 제공자와 accepted 연결이 있는 유족

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useT } from '../hooks/useT';
import { apiCall } from '../utils/api';

function Chat() {
  const { user } = useAuth();
  const t = useT();

  // ── 상태 ───────────────────────────────────────────────────────────────────
  const [provider, setProvider]       = useState(null);   // { id, name }
  const [messages, setMessages]       = useState([]);     // [{ role: 'user'|'ai', text }]
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(true);   // 초기 로딩
  const [sending, setSending]         = useState(false);  // 메시지 전송 중
  const [error, setError]             = useState('');
  const [initError, setInitError]     = useState('');     // 접근 불가 사유

  const messagesEndRef = useRef(null); // 자동 스크롤용

  // ── 제공자 정보 로드 ────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadProvider() {
      try {
        // 내가 유족인 accepted 연결 찾기
        const q = query(
          collection(db, 'connections'),
          where('familyId', '==', user.uid),
          where('status', '==', 'accepted')
        );
        const snap = await getDocs(q);

        if (snap.empty) {
          setInitError(t.chat_no_provider);
          return;
        }

        const connData = snap.docs[0].data();

        // 제공자의 isDeceased 확인
        const providerSnap = await getDoc(doc(db, 'users', connData.providerId));
        if (!providerSnap.exists()) {
          setInitError(t.chat_provider_not_found);
          return;
        }

        const providerData = providerSnap.data();

        if (!providerData.isDeceased) {
          setInitError(t.chat_not_deceased);
          return;
        }

        setProvider({ id: connData.providerId, name: providerData.name });

        // 첫 인사 메시지 추가
        setMessages([{
          role: 'ai',
          text: t.chat_first_greeting(providerData.name),
        }]);
      } catch (err) {
        console.error('Provider load failed:', err);
        setInitError(t.chat_load_fail);
      } finally {
        setLoading(false);
      }
    }

    loadProvider();
  }, [user]);

  // ── 새 메시지 올 때마다 자동 스크롤 ───────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // ── 메시지 전송 ────────────────────────────────────────────────────────────
  async function handleSend() {
    const text = input.trim();
    if (!text || sending || !provider) return;

    // 유저 메시지 즉시 표시
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setError('');
    setSending(true);

    try {
      const { reply } = await apiCall('POST', '/api/chat', {
        providerId: provider.id,
        message: text,
      });

      setMessages((prev) => [...prev, { role: 'ai', text: reply }]);
    } catch (err) {
      setError(err.message || t.chat_send_fail);
    } finally {
      setSending(false);
    }
  }

  // 엔터키 전송 (Shift+Enter는 줄바꿈)
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────────────────────────────────────

  // 로딩 중
  if (loading) {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <Link to="/dashboard" style={styles.backLink}>{t.back_dashboard}</Link>
          <span style={styles.logo}>Memorial</span>
          <div style={{ width: '80px' }} />
        </header>
        <main style={styles.main}>
          <p style={{ color: '#a89080', textAlign: 'center', marginTop: '80px' }}>{t.loading}</p>
        </main>
      </div>
    );
  }

  // 접근 불가
  if (initError) {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <Link to="/dashboard" style={styles.backLink}>{t.back_dashboard}</Link>
          <span style={styles.logo}>Memorial</span>
          <div style={{ width: '80px' }} />
        </header>
        <main style={{ ...styles.main, textAlign: 'center', paddingTop: '80px' }}>
          <span style={{ fontSize: '40px', display: 'block', marginBottom: '16px' }}>🔒</span>
          <p style={{ fontSize: '15px', color: '#7a6355' }}>{initError}</p>
          <Link to="/dashboard" style={styles.btnBack}>{t.back_to_dashboard_btn || t.back}</Link>
        </main>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* 헤더 */}
      <header style={styles.header}>
        <Link to="/dashboard" style={styles.backLink}>{t.back_dashboard}</Link>
        <span style={styles.logo}>Memorial</span>
        <div style={{ width: '80px' }} />
      </header>

      {/* 대화 상대 표시 */}
      <div style={styles.chatHeader}>
        <div style={styles.avatarCircle}>
          {provider?.name?.[0] || '?'}
        </div>
        <div>
          <p style={styles.chatName}>{provider?.name}</p>
          <p style={styles.chatSubtitle}>{t.chat_alive_subtitle}</p>
        </div>
      </div>

      {/* 메시지 목록 */}
      <div style={styles.messageArea}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              ...styles.messageRow,
              ...(msg.role === 'user' ? styles.messageRowUser : styles.messageRowAi),
            }}
          >
            {/* AI 아바타 */}
            {msg.role === 'ai' && (
              <div style={styles.aiAvatar}>
                {provider?.name?.[0] || '?'}
              </div>
            )}

            <div
              style={{
                ...styles.bubble,
                ...(msg.role === 'user' ? styles.bubbleUser : styles.bubbleAi),
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {/* 응답 대기 중 말풍선 */}
        {sending && (
          <div style={{ ...styles.messageRow, ...styles.messageRowAi }}>
            <div style={styles.aiAvatar}>{provider?.name?.[0] || '?'}</div>
            <div style={{ ...styles.bubble, ...styles.bubbleAi, ...styles.typingBubble }}>
              <span style={styles.dot} />
              <span style={{ ...styles.dot, animationDelay: '0.2s' }} />
              <span style={{ ...styles.dot, animationDelay: '0.4s' }} />
            </div>
          </div>
        )}

        {/* 오류 메시지 */}
        {error && (
          <p style={styles.errorMsg}>{error}</p>
        )}

        {/* 자동 스크롤 앵커 */}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력창 */}
      <div style={styles.inputArea}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t.chat_input_placeholder(provider?.name || '')}
          style={styles.textarea}
          rows={2}
          disabled={sending}
        />
        <button
          onClick={handleSend}
          style={{
            ...styles.btnSend,
            ...(sending || !input.trim() ? styles.btnSendDisabled : {}),
          }}
          disabled={sending || !input.trim()}
        >
          {t.chat_send}
        </button>
      </div>

      {/* 점 깜빡임 애니메이션 CSS */}
      <style>{`
        @keyframes blink {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────────────────────────────────────────
const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f7f3ee',
    fontFamily: "'Nunito', 'Noto Sans KR', sans-serif",
    color: '#5c4a3a',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 40px',
    backgroundColor: '#fffdf9',
    borderBottom: '1px solid #e8e0d8',
    flexShrink: 0,
  },
  backLink: { color: '#7a6355', fontSize: '14px', width: '80px', display: 'block' },
  logo: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif KR', serif",
    fontSize: '20px', fontWeight: '700', letterSpacing: '2px', color: '#5c4a3a',
  },

  // 대화 상대 헤더
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '16px 24px',
    backgroundColor: '#fffdf9',
    borderBottom: '1px solid #e8e0d8',
    flexShrink: 0,
  },
  avatarCircle: {
    width: '44px', height: '44px',
    borderRadius: '50%',
    backgroundColor: '#c4956a',
    color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '20px', fontWeight: '700',
    flexShrink: 0,
  },
  chatName: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif KR', serif",
    fontSize: '17px', fontWeight: '700', marginBottom: '2px',
  },
  chatSubtitle: { fontSize: '12px', color: '#a89080' },

  // 메시지 영역
  messageArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    maxWidth: '720px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },

  // 메시지 행
  messageRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '10px',
  },
  messageRowUser: { flexDirection: 'row-reverse' },
  messageRowAi:   { flexDirection: 'row' },

  // AI 아바타 (작은 원)
  aiAvatar: {
    width: '32px', height: '32px',
    borderRadius: '50%',
    backgroundColor: '#c4956a',
    color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '14px', fontWeight: '700',
    flexShrink: 0,
  },

  // 말풍선
  bubble: {
    maxWidth: '70%',
    padding: '12px 16px',
    borderRadius: '18px',
    fontSize: '15px',
    lineHeight: '1.7',
    wordBreak: 'break-word',
  },
  bubbleUser: {
    backgroundColor: '#5c4a3a',
    color: '#fffdf9',
    borderBottomRightRadius: '4px',
  },
  bubbleAi: {
    backgroundColor: '#fffdf9',
    color: '#5c4a3a',
    boxShadow: '0 1px 6px rgba(92,74,58,0.08)',
    borderBottomLeftRadius: '4px',
  },

  // 타이핑 말풍선 (점 3개)
  typingBubble: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '14px 20px',
  },
  dot: {
    display: 'inline-block',
    width: '7px', height: '7px',
    borderRadius: '50%',
    backgroundColor: '#c4956a',
    animation: 'blink 1.2s infinite ease-in-out',
  },

  // 에러
  errorMsg: {
    fontSize: '13px', color: '#c0392b',
    backgroundColor: '#fdf0f0',
    padding: '10px 14px', borderRadius: '8px',
    borderLeft: '3px solid #c0392b',
    marginTop: '4px',
  },

  // 입력 영역
  inputArea: {
    display: 'flex',
    gap: '10px',
    padding: '16px 20px',
    backgroundColor: '#fffdf9',
    borderTop: '1px solid #e8e0d8',
    maxWidth: '720px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
    flexShrink: 0,
  },
  textarea: {
    flex: 1,
    padding: '12px 14px',
    fontSize: '14px',
    fontFamily: "'Nunito', 'Noto Sans KR', sans-serif",
    color: '#5c4a3a',
    backgroundColor: '#f7f3ee',
    border: '1.5px solid #e0d8d0',
    borderRadius: '12px',
    resize: 'none',
    lineHeight: '1.6',
    outline: 'none',
    boxSizing: 'border-box',
  },
  btnSend: {
    padding: '0 22px',
    backgroundColor: '#5c4a3a',
    color: '#fffdf9',
    border: 'none',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: "'Nunito', 'Noto Sans KR', sans-serif",
    flexShrink: 0,
  },
  btnSendDisabled: {
    backgroundColor: '#c8bdb5',
    cursor: 'not-allowed',
  },

  // 접근 불가 화면
  main: { maxWidth: '560px', margin: '0 auto', padding: '60px 20px' },
  btnBack: {
    display: 'inline-block',
    marginTop: '24px',
    padding: '12px 24px',
    backgroundColor: '#5c4a3a',
    color: '#fffdf9',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '600',
  },
};

export default Chat;
