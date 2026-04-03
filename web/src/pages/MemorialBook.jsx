// MemorialBook.jsx - 추모 방명록
import { useState, useEffect, useRef } from 'react';
import { useMemorial } from '../context/MemorialContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useT } from '../hooks/useT';
import { apiCall } from '../utils/api';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';

function formatDate(val) {
  if (!val) return '';
  const d = val?.toDate?.() ?? (val?.seconds ? new Date(val.seconds * 1000) : new Date(val));
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function MemorialBook() {
  const { providerName, providerId } = useMemorial();
  const { user, userProfile } = useAuth();
  const t = useT();
  const isProvider = userProfile?.role === 'provider';

  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [input, setInput]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError]       = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!providerId) return;
    load();
  }, [providerId]);

  async function load() {
    try {
      setLoading(true);
      const r = await apiCall('GET', `/api/memorial-book/${providerId}`);
      setMessages(r.messages || []);
    } catch {
      setError(t.memorial_book_load_fail);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!input.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const r = await apiCall('POST', `/api/memorial-book/${providerId}`, { content: input.trim() });
      setMessages(prev => [{ id: r.id, authorId: r.authorId, authorName: r.authorName, content: r.content, createdAt: new Date() }, ...prev]);
      setInput('');
    } catch (e) {
      setError(e.message || t.error_submit);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(msgId) {
    try {
      await apiCall('DELETE', `/api/memorial-book/${providerId}/${msgId}`);
      setMessages(prev => prev.filter(m => m.id !== msgId));
      setDeletingId(null);
    } catch {
      setError(t.error_delete_book);
    }
  }

  return (
    <div style={S.page}>
      <TopBar title={t.memorial_book} />

      <main style={S.main} className="pb-nav">

        {/* 헤더 */}
        <div style={S.hero}>
          <p style={S.cross}>†</p>
          <h1 style={S.heroTitle}>{t.memorial_book_hero(providerName)}</h1>
          <p style={S.heroSub}>{t.memorial_book_hero_sub}</p>
        </div>

        {/* 작성 폼 — 가족만 표시 */}
        {!isProvider && (
          <div style={S.formCard}>
            <div style={S.formTop}>
              <span style={S.formAuthor}>🕯️ {user?.displayName || t.me}</span>
              <span style={S.charCount}>{input.length}/200</span>
            </div>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value.slice(0, 200))}
              placeholder={t.leave_message}
              rows={3}
              style={S.textarea}
            />
            {error && <p style={S.errorText}>{error}</p>}
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || submitting}
              style={{ ...S.submitBtn, opacity: (!input.trim() || submitting) ? 0.45 : 1 }}
            >
              {submitting ? t.memorial_book_submitting : t.memorial_book_submit}
            </button>
          </div>
        )}

        {/* 제공자 안내 문구 */}
        {isProvider && (
          <p style={S.viewOnlyHint}>{t.memorial_book_provider_hint}</p>
        )}

        {/* 목록 */}
        {loading ? (
          <p style={S.loadingText}>{t.loading}</p>
        ) : messages.length === 0 ? (
          <div style={S.emptyBox}>
            <p style={S.emptyText}>{t.memorial_book_empty1}</p>
            <p style={S.emptyText}>{t.memorial_book_empty2}</p>
          </div>
        ) : (
          <div style={S.list}>
            {messages.map((m, idx) => {
              const isMine = m.authorId === user?.uid;
              const isConfirming = deletingId === m.id;
              return (
                <div key={m.id} style={S.card} className="anim-up" data-delay={idx * 0.04}>
                  <div style={S.cardTop}>
                    <span style={S.candleIcon}>🕯️</span>
                    <div style={S.cardMeta}>
                      <span style={S.authorName}>{m.authorName}</span>
                      <span style={S.dateText}>{formatDate(m.createdAt)}</span>
                    </div>
                    {isMine && (
                      <div style={S.deleteArea}>
                        {isConfirming ? (
                          <>
                            <button onClick={() => handleDelete(m.id)} style={S.btnDeleteOk}>{t.delete}</button>
                            <button onClick={() => setDeletingId(null)} style={S.btnCancel}>{t.cancel}</button>
                          </>
                        ) : (
                          <button onClick={() => setDeletingId(m.id)} style={S.btnDeleteTrigger}>{t.delete}</button>
                        )}
                      </div>
                    )}
                  </div>
                  <p style={S.content}>"{m.content}"</p>
                </div>
              );
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      <BottomNav />
    </div>
  );
}

const S = {
  page: {
    minHeight: '100dvh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)',
  },
  main: { padding: '20px 20px 20px' },
  hero: {
    textAlign: 'center', padding: '20px 0 24px',
  },
  cross: {
    fontSize: 32, color: '#c8b8d8', margin: '0 0 12px', lineHeight: 1,
    fontFamily: 'var(--font-serif)',
  },
  heroTitle: {
    fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--primary)',
    fontWeight: 700, marginBottom: 8, lineHeight: 1.4,
  },
  heroSub: {
    fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7,
  },
  formCard: {
    backgroundColor: '#16213e', border: '1px solid #2d2d4e',
    borderRadius: 16, padding: '16px', marginBottom: 20,
  },
  formTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  formAuthor: { fontSize: 13, color: '#c8b8d8', fontWeight: 600 },
  charCount:  { fontSize: 11, color: '#7b6fa0' },
  textarea: {
    width: '100%', backgroundColor: '#0f1726',
    border: '1px solid #2d2d4e', borderRadius: 10,
    color: '#e8e0f0', fontSize: 14, lineHeight: 1.7,
    padding: '12px 14px', resize: 'none', outline: 'none',
    fontFamily: 'var(--font-sans)', boxSizing: 'border-box', marginBottom: 12,
  },
  errorText: { fontSize: 12, color: '#fc8181', marginBottom: 8 },
  submitBtn: {
    width: '100%', padding: '12px', borderRadius: 10,
    backgroundColor: '#7b6fa0', color: '#f0ecf8',
    border: 'none', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
    transition: 'opacity 0.15s',
  },
  loadingText: { textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, padding: '32px 0' },
  emptyBox: { textAlign: 'center', padding: '48px 0' },
  emptyText: { fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.9 },
  viewOnlyHint: {
    fontSize: 13, color: '#7b6fa0', textAlign: 'center',
    marginBottom: 20, lineHeight: 1.7,
  },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: {
    backgroundColor: '#16213e', border: '1px solid #2d2d4e',
    borderRadius: 16, padding: '16px 18px',
  },
  cardTop: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  candleIcon: { fontSize: 20, flexShrink: 0 },
  cardMeta: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  authorName: { fontSize: 13, fontWeight: 700, color: '#c8b8d8' },
  dateText:   { fontSize: 11, color: '#7b6fa0' },
  content: {
    fontSize: 14, color: '#e8e0f0', lineHeight: 1.8,
    fontStyle: 'italic', margin: 0,
  },
  deleteArea: { display: 'flex', gap: 6, flexShrink: 0 },
  btnDeleteTrigger: {
    fontSize: 11, color: '#9088a8', background: 'none',
    border: 'none', cursor: 'pointer', padding: '2px 6px',
    fontFamily: 'var(--font-sans)',
  },
  btnDeleteOk: {
    fontSize: 11, color: 'white', backgroundColor: '#c53030',
    border: 'none', borderRadius: 6, padding: '4px 10px',
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
  },
  btnCancel: {
    fontSize: 11, color: 'var(--text-muted)', backgroundColor: 'transparent',
    border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px',
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
  },
};
