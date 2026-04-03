// Diary.jsx - 일기 쓰기 (목록 / 작성 / 상세 인라인 전환)
//
// Firestore: diaries/{diaryId}
//   userId, title, content, mood, isPosthumous, createdAt, updatedAt

import { useState, useEffect, useRef } from 'react';
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useMemorial } from '../context/MemorialContext';
import { useT } from '../hooks/useT';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import ImageUploader from '../components/ImageUploader';
import ImageViewer from '../components/ImageViewer';
import { uploadImages, deleteImageByUrl } from '../utils/imageUpload';

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate?.() ?? new Date(ts);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateShort(ts) {
  if (!ts) return '';
  const d = ts.toDate?.() ?? new Date(ts);
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

export default function Diary() {
  const { user, addGems } = useAuth();
  const { isMemorial } = useMemorial();
  const t = useT();

  const MOODS = [
    { emoji: '😊', label: t.mood_happy },
    { emoji: '🥰', label: t.mood_excited },
    { emoji: '😐', label: t.mood_neutral },
    { emoji: '😔', label: t.mood_sad },
    { emoji: '😤', label: t.mood_angry },
  ];

  // ── 뷰 상태 ──────────────────────────────────────────────────────────────
  // mode: 'list' | 'write' | 'detail'
  const [mode, setMode]           = useState('list');
  const [selected, setSelected]   = useState(null); // 상세 보기할 일기

  // ── 데이터 ────────────────────────────────────────────────────────────────
  const [diaries, setDiaries]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  // ── 작성 폼 ───────────────────────────────────────────────────────────────
  const [title, setTitle]           = useState('');
  const [content, setContent]       = useState('');
  const [mood, setMood]             = useState('');
  const [isPosthumous, setIsPosthumous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState('');

  // 수정 모드 여부 (edit: diary 객체, null이면 새 글)
  const [editTarget, setEditTarget] = useState(null);

  // 삭제 확인 중인 id
  const [deletingId, setDeletingId] = useState(null);

  // 일기 저장 보상 팝업
  const [showGemPopup, setShowGemPopup] = useState(false);

  // 추모 모드 토스트
  const [toast, setToast] = useState(false);
  const toastTimerRef = useRef(null);

  // ── 이미지 상태 ──────────────────────────────────────────────────────────
  const [localImages, setLocalImages]       = useState([]);         // [{file, previewUrl, tempId}]
  const [existingUrls, setExistingUrls]     = useState([]);         // 기존 저장 URL (수정 모드)
  const [removedUrls, setRemovedUrls]       = useState([]);         // 삭제 예정 URL
  const [compressing, setCompressing]       = useState(false);
  const [viewerUrls, setViewerUrls]         = useState([]);         // 뷰어 표시 URL 배열
  const [viewerIndex, setViewerIndex]       = useState(0);

  function showMemorialToast() {
    clearTimeout(toastTimerRef.current);
    setToast(true);
    toastTimerRef.current = setTimeout(() => setToast(false), 2400);
  }

  const contentRef = useRef(null);

  // ── 목록 로드 ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    loadDiaries();
  }, [user]);

  async function loadDiaries() {
    try {
      setLoading(true);
      // orderBy 없이 userId만 쿼리 → 복합 인덱스 불필요, 클라이언트 정렬
      const snap = await getDocs(
        query(collection(db, 'diaries'), where('userId', '==', user.uid))
      );
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) =>
          (b.createdAt?.toDate?.()?.getTime() ?? 0) -
          (a.createdAt?.toDate?.()?.getTime() ?? 0)
        );
      setDiaries(list);
    } catch {
      setError(t.diary_load_fail);
    } finally {
      setLoading(false);
    }
  }

  // ── 작성 폼 열기 ──────────────────────────────────────────────────────────
  function openWrite(diary = null) {
    if (diary) {
      // 수정 모드
      setEditTarget(diary);
      setTitle(diary.title || '');
      setContent(diary.content || '');
      setMood(diary.mood || '');
      setIsPosthumous(diary.isPosthumous ?? false);
      setExistingUrls(diary.imageUrls || []);
      setRemovedUrls([]);
      setLocalImages([]);
    } else {
      // 새 글 모드
      setEditTarget(null);
      setTitle('');
      setContent('');
      setMood('');
      setIsPosthumous(false);
      setExistingUrls([]);
      setRemovedUrls([]);
      setLocalImages([]);
    }
    setFormError('');
    setMode('write');
  }

  // ── 저장 ──────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!content.trim()) { setFormError(t.validation_content); return; }
    if (compressing) { setFormError(t.wait_compressing); return; }
    setSubmitting(true);
    setFormError('');
    try {
      if (editTarget) {
        // 수정: 삭제 예정 이미지 Storage에서 제거
        await Promise.all(removedUrls.map(deleteImageByUrl));

        // 새 이미지 업로드
        let newUrls = [];
        if (localImages.length > 0) {
          newUrls = await uploadImages(
            localImages,
            `diaries/${user.uid}/${editTarget.id}`
          );
        }
        const finalUrls = [...existingUrls, ...newUrls];

        await updateDoc(doc(db, 'diaries', editTarget.id), {
          title: title.trim(),
          content: content.trim(),
          mood,
          isPosthumous,
          imageUrls: finalUrls,
          updatedAt: serverTimestamp(),
        });
        const updated = {
          ...editTarget,
          title: title.trim(),
          content: content.trim(),
          mood,
          isPosthumous,
          imageUrls: finalUrls,
        };
        setDiaries((prev) => prev.map((d) => d.id === editTarget.id ? updated : d));
        setMode('detail');
        setSelected(updated);
      } else {
        // 새 글: 먼저 저장 후 이미지 업로드
        const docRef = await addDoc(collection(db, 'diaries'), {
          userId: user.uid,
          title: title.trim(),
          content: content.trim(),
          mood,
          isPosthumous,
          imageUrls: [],
          createdAt: serverTimestamp(),
        });

        let imageUrls = [];
        if (localImages.length > 0) {
          try {
            imageUrls = await uploadImages(
              localImages,
              `diaries/${user.uid}/${docRef.id}`
            );
            await updateDoc(doc(db, 'diaries', docRef.id), { imageUrls });
          } catch (imgErr) {
            console.error('이미지 업로드 실패:', imgErr);
            alert(t.error_diary_image_partial);
          }
        }

        const newDiary = {
          id: docRef.id,
          userId: user.uid,
          title: title.trim(),
          content: content.trim(),
          mood,
          isPosthumous,
          imageUrls,
          createdAt: { toDate: () => new Date() },
        };
        setDiaries((prev) => [newDiary, ...prev]);
        addGems(5);       // 일기 저장 보상 +5 💎
        setShowGemPopup(true);
        setMode('detail');
        setSelected(newDiary);
      }
    } catch {
      setFormError(t.error_save);
    } finally {
      setSubmitting(false);
    }
  }

  // ── 삭제 ──────────────────────────────────────────────────────────────────
  async function handleDelete(diaryId) {
    try {
      await deleteDoc(doc(db, 'diaries', diaryId));
      setDiaries((prev) => prev.filter((d) => d.id !== diaryId));
      setDeletingId(null);
      setMode('list');
      setSelected(null);
    } catch {
      alert(t.error_delete);
    }
  }

  // ── 뒤로가기 처리 ─────────────────────────────────────────────────────────
  function handleBack() {
    if (mode === 'write') {
      // 수정 중이었으면 상세로, 새 글이었으면 목록으로
      if (editTarget) { setMode('detail'); setSelected(editTarget); }
      else setMode('list');
    } else if (mode === 'detail') {
      setMode('list');
      setSelected(null);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────────────────────────────────────

  // ── 목록 뷰 ───────────────────────────────────────────────────────────────
  if (mode === 'list') {
    return (
      <div style={S.page}>
        <TopBar
          title={t.diary_title}
          rightIcon={isMemorial ? null : '✏️'}
          onRightClick={isMemorial ? undefined : () => openWrite()}
        />
        <main style={S.main} className="pb-nav">
          {error && <div style={S.errorBox}>{error}</div>}

          {loading ? (
            <p style={S.loadingText}>{t.diary_loading}</p>
          ) : diaries.length === 0 ? (
            <div style={S.emptyBox}>
              <span style={{ fontSize: 52, display: 'block', marginBottom: 16 }}>📓</span>
              <p style={S.emptyTitle}>{t.diary_empty}</p>
              <p style={S.emptyDesc}>{t.diary_empty_desc}</p>
              <button style={S.emptyBtn} onClick={() => openWrite()}>{t.diary_write_first}</button>
            </div>
          ) : (
            <div style={S.list}>
              {diaries.map((diary, idx) => {
                const isConfirmingDelete = deletingId === diary.id;
                return (
                <div key={diary.id} className="anim-up" style={{ animationDelay: `${idx * 0.04}s` }}>
                  {/* 카드 본체 */}
                  <div
                    style={{ ...S.card, ...(isMemorial ? S.cardMemorial : {}) }}
                    onClick={isMemorial
                      ? showMemorialToast
                      : () => { setSelected(diary); setMode('detail'); }}
                  >
                    {/* 상단: 날짜 + 기분 */}
                    <div style={S.cardTop}>
                      <span style={S.cardDate}>{formatDateShort(diary.createdAt)}</span>
                      <div style={S.cardTopRight}>
                        {diary.mood && <span style={S.moodDot}>{diary.mood}</span>}
                        {isMemorial ? (
                          <span style={S.memorialLock}>🔒</span>
                        ) : (
                          <span style={diary.isPosthumous ? S.posthumousBadge : S.privateBadge}>
                            {diary.isPosthumous ? t.diary_posthumous_badge : t.diary_private_badge}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* 제목 */}
                    {diary.title ? (
                      <p style={S.cardTitle}>{diary.title}</p>
                    ) : (
                      <p style={{ ...S.cardTitle, color: 'var(--text-muted)', fontStyle: 'italic' }}>{t.no_title}</p>
                    )}
                    {/* 내용 미리보기 */}
                    <p style={S.cardPreview}>{diary.content}</p>
                  </div>

                  {/* 수정/삭제 버튼 (추모 모드에서 완전 제거) */}
                  {!isMemorial && (
                    <div style={S.actionRow}>
                      {isConfirmingDelete ? (
                        <>
                          <span style={{ fontSize: 13, color: 'var(--text-mid)', marginRight: 8 }}>{t.confirm_delete}</span>
                          <button onClick={() => handleDelete(diary.id)} style={S.btnDeleteConfirm}>{t.delete}</button>
                          <button onClick={() => setDeletingId(null)} style={S.btnCancelDelete}>{t.cancel}</button>
                        </>
                      ) : (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); openWrite(diary); }} style={S.btnEdit}>✏️ {t.edit}</button>
                          <button onClick={(e) => { e.stopPropagation(); setDeletingId(diary.id); }} style={S.btnDelete}>🗑️ {t.delete}</button>
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

        {/* 새 일기 쓰기 FAB (추모 모드에서 숨김) */}
        {!isMemorial && (
          <button style={S.fab} onClick={() => openWrite()} aria-label={t.diary_new}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>✏️</span>
          </button>
        )}

        {/* 추모 모드 토스트 */}
        {toast && <div style={S.toast}>{t.memorial_memory_kept}</div>}

        <BottomNav />
      </div>
    );
  }

  // ── 상세 뷰 ───────────────────────────────────────────────────────────────
  if (mode === 'detail' && selected) {
    const diary = selected;
    return (
      <div style={S.page}>
        <TopBar title={t.diary_title} onBack={handleBack} />

        {/* 💎 일기 저장 보상 팝업 */}
        {showGemPopup && (
          <div style={S.popupOverlay}>
            <div style={S.popupCard} className="anim-scale">
              <div style={S.gemRainArea}>
                {[...Array(6)].map((_, i) => (
                  <span key={i} style={{
                    position: 'absolute',
                    left: `${8 + i * 15}%`,
                    top: 0,
                    fontSize: 20,
                    animation: `gemFall 1.5s ease-in ${i * 0.12}s both`,
                  }}>💎</span>
                ))}
              </div>
              <div style={S.popupEmoji}>📓</div>
              <h3 style={S.popupTitle}>{t.diary_gem_title}</h3>
              <div style={S.popupGemRow}>
                <span style={{ fontSize: 22 }}>💎</span>
                <span style={S.popupGemText}>{t.diary_gem_reward}</span>
              </div>
              <button style={S.popupBtn} onClick={() => setShowGemPopup(false)}>{t.confirm}</button>
            </div>
          </div>
        )}
        <main style={S.detailMain} className="pb-nav">

          {/* 메타 정보 */}
          <div style={S.detailMeta}>
            <span style={S.detailDate}>{formatDate(diary.createdAt)}</span>
            <div style={S.detailBadges}>
              {diary.mood && <span style={S.moodChip}>{diary.mood}</span>}
              <span style={diary.isPosthumous ? S.posthumousBadge : S.privateBadge}>
                {diary.isPosthumous ? t.diary_posthumous_badge : t.diary_private_badge}
              </span>
            </div>
          </div>

          {/* 제목 */}
          {diary.title ? (
            <h2 style={S.detailTitle}>{diary.title}</h2>
          ) : null}

          {/* 내용 */}
          <p style={S.detailContent}>{diary.content}</p>

          {/* 이미지 갤러리 */}
          {diary.imageUrls?.length > 0 && (
            <DiaryImageGallery
              urls={diary.imageUrls}
              onOpen={(idx) => { setViewerUrls(diary.imageUrls); setViewerIndex(idx); }}
            />
          )}

          {/* 풀스크린 뷰어 */}
          {viewerUrls.length > 0 && (
            <ImageViewer
              urls={viewerUrls}
              initialIndex={viewerIndex}
              onClose={() => setViewerUrls([])}
            />
          )}

          {/* 액션 버튼 (추모 모드에서 제거) */}
          {!isMemorial && (
            <div style={S.detailActions}>
              {deletingId === diary.id ? (
                <div style={S.deleteConfirm}>
                  <span style={S.deleteConfirmText}>{t.confirm_delete}</span>
                  <button style={S.btnDeleteOk} onClick={() => handleDelete(diary.id)}>{t.delete}</button>
                  <button style={S.btnDeleteCancel} onClick={() => setDeletingId(null)}>{t.cancel}</button>
                </div>
              ) : (
                <>
                  <button style={S.btnEdit} onClick={() => openWrite(diary)}>✏️ {t.edit}</button>
                  <button style={S.btnDelete} onClick={() => setDeletingId(diary.id)}>🗑️ {t.delete}</button>
                </>
              )}
            </div>
          )}
        </main>
        <BottomNav />
      </div>
    );
  }

  // ── 작성/수정 뷰 ──────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <TopBar
        title={editTarget ? t.diary_edit : t.diary_new}
        onBack={handleBack}
      />

      <main style={S.writeMain} className="pb-nav">

        {/* 오늘 날짜 */}
        <p style={S.writeDateLabel}>
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </p>

        {/* 제목 */}
        <input
          className="input-base"
          type="text"
          placeholder={t.diary_title_placeholder}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={50}
          style={S.titleInput}
        />

        {/* 기분 선택 */}
        <div style={S.moodSection}>
          <p style={S.moodLabel}>{t.diary_today_mood}</p>
          <div style={S.moodRow}>
            {MOODS.map((m) => (
              <button
                key={m.emoji}
                type="button"
                onClick={() => setMood(mood === m.emoji ? '' : m.emoji)}
                style={{ ...S.moodBtn, ...(mood === m.emoji ? S.moodBtnOn : {}) }}
                title={m.label}
              >
                <span style={{ fontSize: 24 }}>{m.emoji}</span>
                <span style={{ fontSize: 10, color: mood === m.emoji ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {m.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 본문 */}
        <textarea
          ref={contentRef}
          placeholder={t.diary_content_placeholder}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          style={S.contentArea}
          rows={10}
          autoFocus={!editTarget}
        />

        {/* 사진 첨부 */}
        {compressing && (
          <p style={{ fontSize: 13, color: '#a89080', fontStyle: 'italic' }}>{t.image_optimizing}</p>
        )}
        <ImageUploader
          localImages={localImages}
          onAdd={(imgs) => setLocalImages(prev => [...prev, ...imgs])}
          onRemoveLocal={(tempId) => setLocalImages(prev => prev.filter(i => i.tempId !== tempId))}
          existingUrls={existingUrls}
          onRemoveExisting={(url) => {
            setExistingUrls(prev => prev.filter(u => u !== url));
            setRemovedUrls(prev => [...prev, url]);
          }}
          onCompressingChange={setCompressing}
        />

        {/* 사후 공개 토글 */}
        <div
          style={{ ...S.posthumousToggle, ...(isPosthumous ? S.posthumousToggleOn : {}) }}
          onClick={() => setIsPosthumous((v) => !v)}
        >
          <span style={S.posthumousLock}>{isPosthumous ? '👨‍👩‍👧' : '🔒'}</span>
          <div style={{ flex: 1 }}>
            <p style={S.posthumousTitle}>{t.diary_posthumous_title}</p>
            <p style={S.posthumousDesc}>
              {isPosthumous ? t.diary_posthumous_on_desc : t.diary_posthumous_off_desc}
            </p>
          </div>
          {/* 토글 스위치 */}
          <div style={{ ...S.toggleTrack, ...(isPosthumous ? S.toggleTrackOn : {}) }}>
            <div style={{ ...S.toggleThumb, ...(isPosthumous ? S.toggleThumbOn : {}) }} />
          </div>
        </div>

        {formError && <p style={S.formError}>{formError}</p>}

        {/* 저장 버튼 */}
        <button
          className="btn-primary"
          style={{ width: '100%', opacity: (submitting || compressing) ? 0.6 : 1 }}
          onClick={handleSubmit}
          disabled={submitting || compressing}
        >
          {submitting ? t.saving : (editTarget ? t.diary_save_edit : t.diary_save_new)}
        </button>
      </main>

      <BottomNav />
    </div>
  );
}

// ── 일기 이미지 갤러리 (상세 뷰 전용) ────────────────────────────────────────
function DiaryImageGallery({ urls, onOpen }) {
  if (!urls || urls.length === 0) return null;

  if (urls.length === 1) {
    return (
      <div style={{ marginBottom: 20 }}>
        <img
          src={urls[0]}
          alt={t.img_attachment}
          style={{ width: '100%', borderRadius: 14, objectFit: 'cover', maxHeight: 320, cursor: 'pointer' }}
          onClick={() => onOpen(0)}
        />
      </div>
    );
  }

  // 2장 이상: 2열 그리드
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 20 }}>
      {urls.map((url, idx) => (
        <img
          key={url}
          src={url}
          alt={t.img_attachment_n(idx + 1)}
          style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 12, cursor: 'pointer' }}
          onClick={() => onOpen(idx)}
        />
      ))}
    </div>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100dvh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)',
    position: 'relative',
  },

  // ── 목록 뷰 ─────────────────────────────────────────────────────────────
  main: { padding: '16px 20px' },
  loadingText: { textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, padding: '40px 0' },
  errorBox: {
    backgroundColor: '#fdf0f0', color: '#c0392b', fontSize: 13,
    padding: '10px 14px', borderRadius: 10, marginBottom: 14, borderLeft: '3px solid #c0392b',
  },
  emptyBox: {
    textAlign: 'center', padding: '56px 24px',
    backgroundColor: 'var(--card)', borderRadius: 24,
    boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)',
  },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: 'var(--primary)', marginBottom: 8 },
  emptyDesc:  { fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 },
  emptyBtn: {
    display: 'inline-block', padding: '12px 28px',
    backgroundColor: 'var(--primary)', color: 'var(--card)',
    borderRadius: 12, fontSize: 14, fontWeight: 700,
    border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  card: {
    backgroundColor: 'var(--card)', borderRadius: 20, padding: '16px 18px',
    boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)',
    cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s',
  },
  cardMemorial: { borderColor: 'rgba(144,132,168,0.3)' },
  memorialLock: { fontSize: 12, opacity: 0.5 },
  actionRow: {
    display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
    gap: 8, padding: '6px 4px 2px',
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
  btnDeleteConfirm: {
    padding: '6px 14px', backgroundColor: '#e53e3e', color: 'white',
    border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer',
    fontFamily: 'var(--font-sans)', fontWeight: 600,
  },
  btnCancelDelete: {
    padding: '6px 12px', backgroundColor: 'transparent', color: 'var(--text-mid)',
    border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 12,
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
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTopRight: { display: 'flex', alignItems: 'center', gap: 6 },
  cardDate: { fontSize: 12, color: 'var(--text-muted)' },
  moodDot: { fontSize: 18 },
  posthumousBadge: {
    fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
    backgroundColor: '#eff6ff', color: '#1d4ed8',
  },
  privateBadge: {
    fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
    backgroundColor: '#f5f5f5', color: '#6b7280',
  },
  cardTitle: {
    fontSize: 15, fontWeight: 700, color: 'var(--primary-deep)',
    marginBottom: 6, lineHeight: 1.4,
  },
  cardPreview: {
    fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.65,
    display: '-webkit-box', WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical', overflow: 'hidden',
  },

  // ── FAB ─────────────────────────────────────────────────────────────────
  fab: {
    position: 'fixed', bottom: 80, right: 20,
    width: 52, height: 52, borderRadius: '50%',
    backgroundColor: 'var(--primary)', color: 'white',
    boxShadow: '0 4px 16px rgba(92,74,58,0.30)',
    border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 90, transition: 'transform 0.15s',
  },

  // ── 상세 뷰 ─────────────────────────────────────────────────────────────
  detailMain: { padding: '24px 20px', paddingBottom: 100 },
  detailMeta: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  detailDate: { fontSize: 13, color: 'var(--text-muted)' },
  detailBadges: { display: 'flex', alignItems: 'center', gap: 6 },
  moodChip: { fontSize: 20 },
  detailTitle: {
    fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 700,
    color: 'var(--primary)', marginBottom: 16, lineHeight: 1.35,
  },
  detailContent: {
    fontSize: 15, color: 'var(--text)', lineHeight: 1.9,
    whiteSpace: 'pre-wrap',
    backgroundColor: 'var(--card)', borderRadius: 16,
    padding: '18px 18px', border: '1px solid var(--border-light)',
    boxShadow: 'var(--shadow-sm)', marginBottom: 24,
  },
  detailActions: {
    display: 'flex', justifyContent: 'flex-end', gap: 8,
    borderTop: '1px solid var(--border-light)', paddingTop: 16,
  },
  deleteConfirm: { display: 'flex', alignItems: 'center', gap: 8 },
  deleteConfirmText: { fontSize: 13, color: 'var(--text-mid)' },
  btnDeleteOk: {
    padding: '8px 16px', backgroundColor: '#e53e3e', color: 'white',
    border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer',
    fontFamily: 'var(--font-sans)', fontWeight: 600,
  },
  btnDeleteCancel: {
    padding: '8px 12px', backgroundColor: 'transparent', color: 'var(--text-mid)',
    border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13,
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
  },

  // ── 작성 뷰 ─────────────────────────────────────────────────────────────
  writeMain: { padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 16 },
  writeDateLabel: { fontSize: 13, color: 'var(--text-muted)', marginBottom: -4 },
  titleInput: { fontSize: 16, fontWeight: 600 },
  moodSection: {},
  moodLabel: { fontSize: 13, color: 'var(--text-mid)', fontWeight: 600, marginBottom: 10 },
  moodRow: { display: 'flex', gap: 8 },
  moodBtn: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    padding: '10px 4px', borderRadius: 12,
    border: '1.5px solid var(--border)', backgroundColor: 'var(--card)',
    cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'var(--font-sans)',
  },
  moodBtnOn: {
    border: '1.5px solid var(--accent)', backgroundColor: 'var(--accent-pale)',
  },
  contentArea: {
    width: '100%', padding: '16px', borderRadius: 14,
    border: '1.5px solid var(--border)', fontSize: 15,
    color: 'var(--text)', backgroundColor: 'var(--card)',
    fontFamily: 'var(--font-sans)', resize: 'vertical', lineHeight: 1.85,
    outline: 'none', boxSizing: 'border-box',
    minHeight: 220,
  },
  // 사후 공개 토글
  posthumousToggle: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
    borderRadius: 14, backgroundColor: 'var(--bg)',
    border: '1.5px solid var(--border)', cursor: 'pointer',
    transition: 'all 0.2s', userSelect: 'none',
  },
  posthumousToggleOn: { backgroundColor: 'var(--accent-pale)', borderColor: 'var(--accent)' },
  posthumousLock:  { fontSize: 22, flexShrink: 0 },
  posthumousTitle: { fontSize: 14, fontWeight: 700, color: 'var(--primary-deep)' },
  posthumousDesc:  { fontSize: 12, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 },
  toggleTrack: {
    width: 42, height: 24, borderRadius: 12,
    backgroundColor: '#d8d0c8', position: 'relative',
    flexShrink: 0, transition: 'background-color 0.2s',
  },
  toggleTrackOn: { backgroundColor: 'var(--accent)' },
  toggleThumb: {
    width: 20, height: 20, borderRadius: '50%', backgroundColor: 'white',
    position: 'absolute', top: 2, left: 2,
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'transform 0.2s',
  },
  toggleThumbOn: { transform: 'translateX(18px)' },
  formError: {
    fontSize: 13, color: '#c0392b', backgroundColor: '#fdf0f0',
    padding: '10px 14px', borderRadius: 10, borderLeft: '3px solid #c0392b',
  },
  popupOverlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(61,46,34,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200, backdropFilter: 'blur(4px)',
  },
  popupCard: {
    backgroundColor: '#fffdf9', borderRadius: 24, padding: '40px 32px 32px',
    width: 'calc(100% - 48px)', maxWidth: 320, textAlign: 'center',
    position: 'relative', overflow: 'hidden', boxShadow: '0 20px 60px rgba(61,46,34,0.25)',
  },
  gemRainArea: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '100%',
    pointerEvents: 'none', overflow: 'hidden',
  },
  popupEmoji:  { fontSize: 48, marginBottom: 12, display: 'block' },
  popupTitle: {
    fontFamily: "'Cormorant Garamond','Noto Serif KR',serif",
    fontSize: 20, color: '#3d2e22', fontWeight: 700, marginBottom: 16, lineHeight: 1.4,
  },
  popupGemRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fef8f2', border: '1.5px solid #f0d8b8',
    borderRadius: 14, padding: '12px 20px', marginBottom: 24,
  },
  popupGemText: { fontSize: 16, fontWeight: 700, color: '#c4956a' },
  popupBtn: {
    width: '100%', padding: '13px', backgroundColor: '#c4956a',
    color: '#fffdf9', border: 'none', borderRadius: 12, fontSize: 15,
    fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito','Noto Sans KR',sans-serif",
  },
};
