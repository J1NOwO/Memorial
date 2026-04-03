// MyMemories.jsx - 내 기억 모아보기 (모바일 우선)

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  collection, query, where, orderBy, getDocs, deleteDoc, updateDoc, doc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useT } from '../hooks/useT';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import { useMemorial } from '../context/MemorialContext';
import ImageUploader from '../components/ImageUploader';
import ImageViewer from '../components/ImageViewer';
import { uploadImages, deleteImageByUrl } from '../utils/imageUpload';

// 내부 필터링용 키 (Firestore 저장값과 동일한 한국어)
const CATEGORIES = ['전체', '추억', '가치관', '말투·성격', '가족에게', '인생 조언'];

const CATEGORY_COLORS = {
  '추억':      { bg: '#fef3e2', text: '#b7791f', dot: '#f5c842' },
  '가치관':    { bg: '#e8f4fd', text: '#2b6cb0', dot: '#63b3ed' },
  '말투·성격': { bg: '#f0fdf4', text: '#276749', dot: '#68d391' },
  '가족에게':  { bg: '#fdf2f8', text: '#97266d', dot: '#f687b3' },
  '인생 조언': { bg: '#f5f0ff', text: '#6b46c1', dot: '#b794f4' },
};

const CATEGORY_COLORS_MEMORIAL = {
  '추억':      { bg: '#352b1a', text: '#d4aa66', dot: '#d4aa66' },
  '가치관':    { bg: '#12253e', text: '#7bbde8', dot: '#7bbde8' },
  '말투·성격': { bg: '#122a1e', text: '#6fca8a', dot: '#6fca8a' },
  '가족에게':  { bg: '#321526', text: '#df88bb', dot: '#df88bb' },
  '인생 조언': { bg: '#1e1535', text: '#b08ee0', dot: '#b08ee0' },
};

export default function MyMemories() {
  const { user } = useAuth();
  const { isMemorial } = useMemorial();
  const t = useT();

  // 카테고리 키(한국어) → 번역된 표시 라벨
  function getCatLabel(cat) {
    const map = {
      '전체': t.cat_all,
      '추억': t.cat_memory,
      '가치관': t.cat_values,
      '말투·성격': t.cat_personality,
      '가족에게': t.cat_family,
      '인생 조언': t.cat_life_advice,
    };
    return map[cat] || cat;
  }

  const [answers, setAnswers]               = useState([]);
  const [activeCategory, setActiveCategory] = useState('전체');
  const [loading, setLoading]               = useState(true);
  const [deletingId, setDeletingId]         = useState(null);
  const [editingId, setEditingId]           = useState(null);
  const [editText, setEditText]             = useState('');
  const [savingId, setSavingId]             = useState(null);
  const [error, setError]                   = useState('');
  const [toast, setToast]                   = useState(false);
  const toastTimerRef = useRef(null);
  const tabsRef = useRef(null);

  // ── 이미지 상태 ──────────────────────────────────────────────────────────
  const [editExistingUrls, setEditExistingUrls] = useState([]);   // 수정 중인 기존 URL
  const [editRemovedUrls, setEditRemovedUrls]   = useState([]);   // 삭제 예정 URL
  const [editLocalImages, setEditLocalImages]   = useState([]);   // 새 이미지
  const [compressing, setCompressing]           = useState(false);
  const [viewerData, setViewerData]             = useState(null); // {urls, index}

  // 마우스 드래그 + 휠 → 가로 스크롤
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;

    // 휠 → 가로 스크롤
    const onWheel = (e) => {
      e.preventDefault();
      el.scrollLeft += e.deltaX || e.deltaY;
    };

    // 드래그 → 가로 스크롤
    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;

    const onMouseDown = (e) => {
      isDragging = true;
      startX = e.pageX - el.offsetLeft;
      startScrollLeft = el.scrollLeft;
      el.style.cursor = 'grabbing';
      el.style.userSelect = 'none';
    };
    const onMouseMove = (e) => {
      if (!isDragging) return;
      const x = e.pageX - el.offsetLeft;
      el.scrollLeft = startScrollLeft - (x - startX);
    };
    const onMouseUp = () => {
      isDragging = false;
      el.style.cursor = 'grab';
      el.style.userSelect = '';
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  function showMemorialToast() {
    clearTimeout(toastTimerRef.current);
    setToast(true);
    toastTimerRef.current = setTimeout(() => setToast(false), 2400);
  }

  // 추모 모드 활성화 시 진행 중인 편집/삭제 취소
  useEffect(() => {
    if (isMemorial) { setDeletingId(null); setEditingId(null); setEditText(''); }
  }, [isMemorial]);

  useEffect(() => {
    async function loadAnswers() {
      try {
        const q = query(
          collection(db, 'answers'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        setAnswers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        if (err.code === 'failed-precondition') {
          await loadWithoutOrder();
        } else {
          setError(t.error_default);
        }
      } finally {
        setLoading(false);
      }
    }

    async function loadWithoutOrder() {
      try {
        const q = query(collection(db, 'answers'), where('userId', '==', user.uid));
        const snapshot = await getDocs(q);
        const list = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.toDate?.()?.getTime() ?? 0) - (a.createdAt?.toDate?.()?.getTime() ?? 0));
        setAnswers(list);
      } catch {
        setError(t.error_default);
      }
    }

    loadAnswers();
  }, [user]);

  async function handleSaveEdit(answerId) {
    if (isMemorial) return;
    const trimmed = editText.trim();
    if (!trimmed) return;
    setSavingId(answerId);
    try {
      // 삭제된 이미지 Storage에서 제거
      await Promise.all(editRemovedUrls.map(deleteImageByUrl));

      // 새 이미지 업로드
      let newUrls = [];
      if (editLocalImages.length > 0) {
        newUrls = await uploadImages(editLocalImages, `answers/${user.uid}/${answerId}`);
      }
      const finalUrls = [...editExistingUrls, ...newUrls];

      await updateDoc(doc(db, 'answers', answerId), {
        content: trimmed,
        imageUrls: finalUrls,
        updatedAt: new Date(),
      });
      setAnswers((prev) => prev.map((a) =>
        a.id === answerId ? { ...a, content: trimmed, imageUrls: finalUrls } : a
      ));
      setEditingId(null);
      setEditLocalImages([]);
      setEditExistingUrls([]);
      setEditRemovedUrls([]);
    } catch (err) {
      console.error('수정 실패:', err);
      alert(t.error_save);
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(answerId) {
    if (isMemorial) return;
    try {
      await deleteDoc(doc(db, 'answers', answerId));
      setAnswers((prev) => prev.filter((a) => a.id !== answerId));
      setDeletingId(null);
    } catch {
      alert(t.error_delete);
    }
  }

  function formatDate(createdAt) {
    if (!createdAt) return '';
    const date = createdAt.toDate?.() ?? new Date(createdAt);
    return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  }

  const filtered = activeCategory === '전체'
    ? answers
    : answers.filter((a) => a.category === activeCategory);

  return (
    <div style={S.page}>
      <style>{`
        .tabs-scroll::-webkit-scrollbar { display: none; }
      `}</style>
      <TopBar title={t.my_memory} />

      {/* 카테고리 탭 (가로 스크롤) */}
      <div style={{ ...S.tabsWrap, backgroundColor: isMemorial ? 'rgba(22,18,38,0.96)' : 'rgba(247,243,238,0.96)' }}>
        <div ref={tabsRef} style={S.tabs} className="tabs-scroll">
          {CATEGORIES.map((cat) => {
            const count = cat === '전체' ? answers.length : answers.filter((a) => a.category === cat).length;
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  ...S.tab,
                  ...(isMemorial ? S.tabMemorial : {}),
                  ...(active ? (isMemorial ? S.tabActiveMemorial : S.tabActive) : {}),
                }}
              >
                {getCatLabel(cat)}
                {count > 0 && (
                  <span style={{ ...S.tabCount, ...(active ? S.tabCountActive : {}) }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <main style={S.main} className="pb-nav">
        {/* 총 개수 */}
        <p style={S.totalText}>{t.memory_count(answers.length)}</p>

        {error && <div style={isMemorial ? S.errorBoxMemorial : S.errorBox}>{error}</div>}

        {loading && (
          <div style={S.centerBox}>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t.memory_loading}</p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={S.emptyBox}>
            <span style={{ fontSize: 44, display: 'block', marginBottom: 14 }}>📝</span>
            <p style={{ fontSize: 15, color: 'var(--text-mid)', marginBottom: 6 }}>
              {activeCategory === '전체' ? t.no_memory : t.no_memory_in_cat(getCatLabel(activeCategory))}
            </p>
            <Link to="/questions" style={S.emptyBtn}>{t.memory_go_questions}</Link>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div style={S.list}>
            {filtered.map((answer, idx) => {
              const colorMap = isMemorial ? CATEGORY_COLORS_MEMORIAL : CATEGORY_COLORS;
              const catColor = colorMap[answer.category] || (isMemorial ? { bg: '#1e1e2a', text: '#9088a8', dot: '#9088a8' } : { bg: '#f0f0f0', text: '#555', dot: '#ccc' });
              const isPrivate = answer.isPrivate !== false;
              const isConfirmingDelete = deletingId === answer.id;
              const isEditing = editingId === answer.id;
              const isSaving  = savingId  === answer.id;

              return (
                <div key={answer.id} className="anim-up" style={{ animationDelay: `${idx * 0.04}s` }}>

                  {/* ── 카드 (추모 모드 시 터치 → 토스트) ── */}
                  <div
                    style={{ ...S.card, ...(isMemorial ? S.cardMemorial : {}) }}
                    onClick={isMemorial ? showMemorialToast : undefined}
                  >
                    <div style={S.cardMeta}>
                      <div style={S.metaLeft}>
                        <span style={{ ...S.catBadge, backgroundColor: catColor.bg, color: catColor.text }}>
                          {answer.category}
                        </span>
                        {!isMemorial && (
                          <span style={{ ...S.privateBadge, ...(isPrivate ? S.locked : S.unlocked) }}>
                            {isPrivate ? t.memory_private : t.memory_public}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={S.dateText}>{formatDate(answer.createdAt)}</span>
                        {isMemorial && <span style={S.memorialLock}>🔒</span>}
                      </div>
                    </div>

                    <p style={S.questionText}>{answer.questionText}</p>

                    {answer.type === 'tags' ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                        {(Array.isArray(answer.content) ? answer.content : [answer.content]).map((tag) => (
                          <span key={tag} style={S.tag}>{tag}</span>
                        ))}
                      </div>
                    ) : (
                      <p style={S.answerText}>{answer.content}</p>
                    )}

                    {/* 이미지 갤러리 */}
                    {answer.imageUrls?.length > 0 && (
                      <AnswerImageGallery
                        urls={answer.imageUrls}
                        onOpen={(idx) => setViewerData({ urls: answer.imageUrls, index: idx })}
                      />
                    )}
                  </div>

                  {/* ── 수정 폼 (카드 아래, 추모 모드 아닐 때만) ── */}
                  {isEditing && !isMemorial && (
                    <div style={S.editForm}>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        style={S.editTextarea}
                        rows={4}
                        autoFocus
                      />
                      {compressing && (
                        <p style={{ fontSize: 12, color: '#a89080', fontStyle: 'italic', margin: '4px 0' }}>{t.image_optimizing}</p>
                      )}
                      <ImageUploader
                        localImages={editLocalImages}
                        onAdd={(imgs) => setEditLocalImages(prev => [...prev, ...imgs])}
                        onRemoveLocal={(tempId) => setEditLocalImages(prev => prev.filter(i => i.tempId !== tempId))}
                        existingUrls={editExistingUrls}
                        onRemoveExisting={(url) => {
                          setEditExistingUrls(prev => prev.filter(u => u !== url));
                          setEditRemovedUrls(prev => [...prev, url]);
                        }}
                        onCompressingChange={setCompressing}
                      />
                      <div style={S.editActions}>
                        <button onClick={() => { setEditingId(null); setEditText(''); setEditLocalImages([]); setEditExistingUrls([]); setEditRemovedUrls([]); }}
                          style={S.btnCancelEdit} disabled={isSaving}>{t.cancel}</button>
                        <button onClick={() => handleSaveEdit(answer.id)}
                          style={S.btnSave} disabled={isSaving || !editText.trim() || compressing}>
                          {isSaving ? t.saving : t.save}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── 액션 버튼 (카드 아래 독립 행, 추모 모드 시 완전 제거) ── */}
                  {!isMemorial && !isEditing && (
                    <div style={S.actionRow}>
                      {isConfirmingDelete ? (
                        <>
                          <span style={{ fontSize: 13, color: 'var(--text-mid)', marginRight: 8 }}>{t.memory_confirm_delete}</span>
                          <button onClick={() => handleDelete(answer.id)} style={S.btnDeleteConfirm}>{t.delete}</button>
                          <button onClick={() => setDeletingId(null)} style={S.btnCancelDelete}>{t.cancel}</button>
                        </>
                      ) : (
                        <>
                          {answer.type !== 'tags' && (
                            <button
                              onClick={() => {
                                setEditingId(answer.id);
                                setEditText(typeof answer.content === 'string' ? answer.content : '');
                                setEditExistingUrls(answer.imageUrls || []);
                                setEditRemovedUrls([]);
                                setEditLocalImages([]);
                                setDeletingId(null);
                              }}
                              style={S.btnEdit}
                            >{t.edit}</button>
                          )}
                          <button onClick={() => setDeletingId(answer.id)} style={S.btnDelete}>{t.delete}</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav />

      {/* 풀스크린 이미지 뷰어 */}
      {viewerData && (
        <ImageViewer
          urls={viewerData.urls}
          initialIndex={viewerData.index}
          onClose={() => setViewerData(null)}
        />
      )}

      {/* 추모 모드 토스트 */}
      {toast && (
        <div style={S.toast}>{t.memorial_memory_kept}</div>
      )}
    </div>
  );
}

// ── 답변 이미지 갤러리 ────────────────────────────────────────────────────────
function AnswerImageGallery({ urls, onOpen }) {
  if (!urls || urls.length === 0) return null;

  if (urls.length === 1) {
    return (
      <div style={{ marginTop: 10 }}>
        <img
          src={urls[0]}
          alt={t.img_attachment}
          style={{ width: '100%', borderRadius: 10, objectFit: 'cover', maxHeight: 240, cursor: 'pointer', display: 'block' }}
          onClick={() => onOpen(0)}
        />
      </div>
    );
  }

  // 2장 이상: 2열 그리드
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginTop: 10 }}>
      {urls.map((url, idx) => (
        <img
          key={url}
          src={url}
          alt={t.img_attachment_n(idx + 1)}
          style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, cursor: 'pointer', display: 'block' }}
          onClick={() => onOpen(idx)}
        />
      ))}
    </div>
  );
}

const S = {
  page: {
    minHeight: '100dvh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)',
  },
  // 탭 (가로 스크롤)
  tabsWrap: {
    position: 'sticky', top: 57, zIndex: 9,
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid var(--border-light)',
  },
  tabs: {
    display: 'flex', gap: 8, padding: '10px 20px',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  tab: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '7px 14px', borderRadius: 99,
    border: '1.5px solid var(--border)', backgroundColor: 'var(--card)',
    color: 'var(--text-mid)', fontSize: 13, cursor: 'pointer',
    fontFamily: 'var(--font-sans)', transition: 'all 0.15s',
    flexShrink: 0, whiteSpace: 'nowrap',
  },
  tabActive: {
    backgroundColor: 'var(--primary)', borderColor: 'var(--primary)',
    color: 'var(--card)', fontWeight: 700,
  },
  tabMemorial: {
    backgroundColor: 'rgba(28,22,44,0.55)',
    borderColor: 'rgba(120,100,160,0.25)',
    color: 'rgba(180,165,210,0.6)',
  },
  tabActiveMemorial: {
    backgroundColor: 'rgba(72,52,108,0.75)',
    borderColor: 'rgba(140,110,190,0.5)',
    color: '#d4c4f0',
    fontWeight: 700,
  },
  tabCount: {
    fontSize: 11, backgroundColor: 'var(--border-light)',
    color: 'var(--text-muted)', padding: '1px 6px', borderRadius: 99,
  },
  tabCountActive: {
    backgroundColor: 'rgba(255,253,249,0.25)', color: 'var(--card)',
  },
  main: { padding: '16px 20px' },
  totalText: { fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 },
  errorBox: {
    backgroundColor: '#fdf0f0', color: '#c0392b', fontSize: 13,
    padding: '10px 14px', borderRadius: 10, marginBottom: 14,
    borderLeft: '3px solid #c0392b',
  },
  errorBoxMemorial: {
    backgroundColor: '#2a0f0f', color: '#e87070', fontSize: 13,
    padding: '10px 14px', borderRadius: 10, marginBottom: 14,
    borderLeft: '3px solid #a03030',
  },
  centerBox: { textAlign: 'center', padding: '60px 0' },
  emptyBox: {
    textAlign: 'center', padding: '48px 20px',
    backgroundColor: 'var(--card)', borderRadius: 20,
    boxShadow: 'var(--shadow-sm)',
  },
  emptyBtn: {
    display: 'inline-block', padding: '12px 24px',
    backgroundColor: 'var(--primary)', color: 'var(--card)',
    borderRadius: 12, fontSize: 14, fontWeight: 600,
  },
  list: { display: 'flex', flexDirection: 'column', gap: 14 },
  card: {
    backgroundColor: 'var(--card)', borderRadius: 20,
    padding: '18px 18px', boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--border-light)',
  },
  cardMemorial: {
    cursor: 'pointer',
    borderColor: 'rgba(144,132,168,0.3)',
  },
  memorialLock: { fontSize: 13, opacity: 0.5 },
  cardMeta: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10, gap: 8,
  },
  metaLeft: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  catBadge: {
    fontSize: 11, fontWeight: 600, padding: '3px 10px',
    borderRadius: 99, letterSpacing: 0.3,
  },
  privateBadge: {
    fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 99,
  },
  locked:   { backgroundColor: '#fdf2f8', color: '#97266d' },
  unlocked: { backgroundColor: '#f0fdf4', color: '#276749' },
  dateText: { fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 },
  questionText: {
    fontSize: 14, fontWeight: 700, color: 'var(--primary-deep)',
    lineHeight: 1.5, marginBottom: 10,
  },
  answerText: {
    fontSize: 14, color: 'var(--text)', lineHeight: 1.8,
    backgroundColor: 'var(--bg)', padding: '12px 14px',
    borderRadius: 12, borderLeft: '3px solid var(--accent)', margin: 0,
  },
  editTextarea: {
    width: '100%', padding: '12px 14px', fontSize: 14,
    fontFamily: 'var(--font-sans)', color: 'var(--text)',
    backgroundColor: 'var(--bg)', border: '1.5px solid var(--accent)',
    borderRadius: 12, resize: 'vertical', lineHeight: 1.8,
    boxSizing: 'border-box', outline: 'none',
    marginBottom: 10,
  },
  editActions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  btnSave: {
    padding: '8px 18px', backgroundColor: 'var(--primary)', color: 'var(--card)',
    border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer',
    fontFamily: 'var(--font-sans)', fontWeight: 700,
  },
  btnCancelEdit: {
    padding: '8px 14px', backgroundColor: 'transparent', color: 'var(--text-mid)',
    border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13,
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
  },
  tag: {
    fontSize: 13, padding: '5px 13px', borderRadius: 99,
    backgroundColor: 'var(--border-light)', color: 'var(--text-mid)', fontWeight: 500,
  },
  editForm: {
    padding: '12px 16px', marginTop: 4,
    backgroundColor: 'var(--card)', borderRadius: 16,
    border: '1px solid var(--border-light)',
  },
  actionRow: {
    display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
    gap: 8, padding: '6px 4px 2px',
  },
  cardFooter: {
    display: 'flex', justifyContent: 'flex-end',
    borderTop: '1px solid var(--border-light)', paddingTop: 12,
  },
  btnEdit: {
    fontSize: 12, color: '#92400e', cursor: 'pointer',
    backgroundColor: '#fef3e2', border: '1px solid #f5c842',
    borderRadius: 6, padding: '5px 14px',
    fontFamily: 'var(--font-sans)', fontWeight: 600,
  },
  btnDelete: {
    fontSize: 12, color: '#c53030', cursor: 'pointer',
    backgroundColor: '#fff5f5', border: '1px solid #feb2b2',
    borderRadius: 6, padding: '5px 14px',
    fontFamily: 'var(--font-sans)', fontWeight: 600,
  },
  deleteConfirm: { display: 'flex', alignItems: 'center', gap: 8 },
  btnDeleteConfirm: {
    fontSize: 13, color: 'white', backgroundColor: '#e53e3e',
    border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
    fontFamily: 'var(--font-sans)', fontWeight: 600,
  },
  btnCancelDelete: {
    fontSize: 13, color: 'var(--text-mid)', backgroundColor: 'transparent',
    border: '1.5px solid var(--border)', borderRadius: 8, padding: '6px 12px',
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
  },
  toast: {
    position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
    backgroundColor: 'rgba(30,20,50,0.88)', color: 'rgba(220,210,240,0.95)',
    fontSize: 13, padding: '10px 20px', borderRadius: 20,
    fontFamily: 'var(--font-sans)', letterSpacing: 0.3,
    zIndex: 9999, pointerEvents: 'none', whiteSpace: 'nowrap',
    backdropFilter: 'blur(8px)',
  },
};
