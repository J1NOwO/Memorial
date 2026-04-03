// MemoryAlbum.jsx - 기억 앨범 (책처럼 넘겨보는 답변 모음)
//
// 표지 → 앨범 두 단계로 구성
// 생존 모드: 본인 answers / 추모 모드: 고인 answers (비공개 포함)

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, query, where, getDocs, orderBy,
  doc, setDoc, deleteDoc, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useMemorial } from '../context/MemorialContext';
import { apiCall } from '../utils/api';
import { useT } from '../hooks/useT';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import ImageViewer from '../components/ImageViewer';

// ── 카테고리 ────────────────────────────────────────────────────────────────
const CATEGORY_LIST = ['전체', '추억', '가치관', '말투·성격', '가족에게', '인생 조언', '자유 기록', '즐겨찾기'];

const CATEGORY_ICONS = {
  '전체':      '📖',
  '추억':      '🌸',
  '가치관':    '💭',
  '말투·성격': '🗣️',
  '가족에게':  '💌',
  '인생 조언': '🌿',
  '자유 기록': '📝',
  '즐겨찾기':  '❤️',
};

// 카테고리 뱃지 색상 (일반 / 추모)
function getCatColor(cat, isMemorial) {
  if (isMemorial) {
    const M = {
      '추억':      { backgroundColor: 'rgba(245,200,66,0.15)',  color: '#f5c842' },
      '가치관':    { backgroundColor: 'rgba(99,179,237,0.15)',  color: '#63b3ed' },
      '말투·성격': { backgroundColor: 'rgba(104,211,145,0.15)', color: '#68d391' },
      '가족에게':  { backgroundColor: 'rgba(246,135,179,0.15)', color: '#f687b3' },
      '인생 조언': { backgroundColor: 'rgba(183,148,244,0.15)', color: '#b794f4' },
      '자유 기록': { backgroundColor: 'rgba(104,211,145,0.15)', color: '#68d391' },
    };
    return M[cat] || { backgroundColor: 'rgba(200,184,216,0.15)', color: '#c8b8d8' };
  }
  const N = {
    '추억':      { backgroundColor: '#fef3e2', color: '#b7791f' },
    '가치관':    { backgroundColor: '#e8f4fd', color: '#2b6cb0' },
    '말투·성격': { backgroundColor: '#f0fdf4', color: '#276749' },
    '가족에게':  { backgroundColor: '#fdf2f8', color: '#97266d' },
    '인생 조언': { backgroundColor: '#f5f0ff', color: '#6b46c1' },
    '자유 기록': { backgroundColor: '#f0f9f0', color: '#2f7a3a' },
  };
  return N[cat] || { backgroundColor: '#f0f0f0', color: '#555' };
}

// ── 날짜 포맷 ────────────────────────────────────────────────────────────────
function formatDate(val) {
  if (!val) return '';
  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateYM(val) {
  if (!val) return '';
  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────────────
export default function MemoryAlbum() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isMemorial, providerName, providerId } = useMemorial();
  const t = useT();

  function getCatLabel(cat) {
    const map = {
      '전체': t.cat_all, '추억': t.cat_memory, '가치관': t.cat_values,
      '말투·성격': t.cat_personality, '가족에게': t.cat_family, '인생 조언': t.cat_life_advice,
      '자유 기록': t.cat_free_record, '즐겨찾기': t.cat_favorites,
    };
    return map[cat] || cat;
  }

  // 누구의 앨범인지
  const targetUserId  = (isMemorial && providerId) ? providerId : (user?.uid ?? '');
  const isViewingOther = targetUserId !== user?.uid;
  const displayName   = isMemorial ? (providerName || t.album_deceased_name) : (user?.displayName || t.album_self_name);

  // ── 상태 ──────────────────────────────────────────────────────────────────
  const [phase, setPhase]                   = useState('cover');
  const [answers, setAnswers]               = useState([]);
  const [favorites, setFavorites]           = useState(new Set());
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');
  const [activeCategory, setActiveCategory] = useState('전체');
  const [currentIndex, setCurrentIndex]     = useState(0);
  const [slideDir, setSlideDir]             = useState('right');
  const [animKey, setAnimKey]               = useState(0);
  const [dollName, setDollName]             = useState('');
  const [shareToast, setShareToast]         = useState('');
  const [showWriteForm, setShowWriteForm]   = useState(false);
  const [writeContent, setWriteContent]     = useState('');
  const [writeSaving, setWriteSaving]       = useState(false);
  const [viewerData, setViewerData]         = useState(null); // {urls, index}

  const touchStartX  = useRef(null);
  const shareTimerRef = useRef(null);

  // ── 데이터 로드 ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!targetUserId) return;
    load();
  }, [targetUserId]);

  async function load() {
    setLoading(true);
    setError('');
    await Promise.all([loadAnswers(), loadFavorites(), loadDoll()]);
    setLoading(false);
  }

  async function loadAnswers() {
    try {
      const r = await apiCall('GET', `/api/memory-album/${targetUserId}`);
      setAnswers(r.answers || []);
    } catch {
      // 폴백: Firestore 직접 (본인 데이터 한정)
      if (!isViewingOther) {
        try {
          const q = query(
            collection(db, 'answers'),
            where('userId', '==', targetUserId),
            orderBy('createdAt', 'asc'),
          );
          const snap = await getDocs(q);
          setAnswers(snap.docs.map(d => {
            const data = d.data();
            return { id: d.id, ...data, createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null };
          }));
        } catch {
          setError(t.album_load_fail);
        }
      } else {
        setError(t.album_load_fail);
      }
    }
  }

  async function loadFavorites() {
    if (!user?.uid) return;
    try {
      const snap = await getDocs(collection(db, 'albumFavorites', user.uid, 'items'));
      setFavorites(new Set(snap.docs.map(d => d.id)));
    } catch {}
  }

  async function loadDoll() {
    if (!targetUserId) return;
    try {
      const q    = query(collection(db, 'dolls'), where('userId', '==', targetUserId));
      const snap = await getDocs(q);
      if (!snap.empty) setDollName(snap.docs[0].data().name || '');
    } catch {}
  }

  // ── 필터링 ────────────────────────────────────────────────────────────────
  const filtered = (() => {
    if (activeCategory === '즐겨찾기') return answers.filter(a => favorites.has(a.id));
    if (activeCategory === '전체')     return answers;
    return answers.filter(a => a.category === activeCategory);
  })();

  const currentAnswer = filtered[currentIndex] ?? null;

  // 카테고리 바뀌면 인덱스 초기화
  useEffect(() => {
    setCurrentIndex(0);
    setSlideDir('right');
    setAnimKey(k => k + 1);
  }, [activeCategory]);

  // ── 페이지 이동 ───────────────────────────────────────────────────────────
  function goNext() {
    if (currentIndex >= filtered.length - 1) return;
    setSlideDir('left');
    setAnimKey(k => k + 1);
    setCurrentIndex(p => p + 1);
  }

  function goPrev() {
    if (currentIndex <= 0) return;
    setSlideDir('right');
    setAnimKey(k => k + 1);
    setCurrentIndex(p => p - 1);
  }

  // ── 스와이프 ──────────────────────────────────────────────────────────────
  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX; }

  function onTouchEnd(e) {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 50) diff < 0 ? goNext() : goPrev();
    touchStartX.current = null;
  }

  // ── 즐겨찾기 토글 ─────────────────────────────────────────────────────────
  async function toggleFavorite(answerId) {
    if (!user?.uid) return;
    const ref = doc(db, 'albumFavorites', user.uid, 'items', answerId);
    if (favorites.has(answerId)) {
      await deleteDoc(ref);
      setFavorites(prev => { const s = new Set(prev); s.delete(answerId); return s; });
    } else {
      await setDoc(ref, { savedAt: new Date() });
      setFavorites(prev => new Set([...prev, answerId]));
    }
  }

  // ── 공유 ──────────────────────────────────────────────────────────────────
  async function handleShare(answer) {
    const contentStr = Array.isArray(answer.content)
      ? answer.content.join(', ')
      : (answer.content || '');
    const text = [
      t.album_memory_label(displayName),
      '',
      `Q. ${answer.questionText || t.cat_free_record}`,
      '',
      `"${contentStr}"`,
      '',
      formatDate(answer.createdAt),
      '',
      t.album_memory_footer,
    ].join('\n');

    if (navigator.share) {
      try { await navigator.share({ title: t.album_memory_label(displayName), text }); } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(text);
        triggerShareToast(t.album_copy_success);
      } catch {
        triggerShareToast(t.album_share_unsupported);
      }
    }
  }

  function triggerShareToast(msg) {
    clearTimeout(shareTimerRef.current);
    setShareToast(msg);
    shareTimerRef.current = setTimeout(() => setShareToast(''), 2400);
  }

  // ── 자유 기록 작성 ────────────────────────────────────────────────────────
  async function handleWriteFree() {
    if (!writeContent.trim() || writeSaving || !user?.uid) return;
    setWriteSaving(true);
    try {
      const ref = await addDoc(collection(db, 'answers'), {
        userId:       user.uid,
        questionText: '자유 기록',
        content:      writeContent.trim(),
        category:     '자유 기록',
        type:         'free',
        isPrivate:    false,
        createdAt:    serverTimestamp(),
      });
      const newAnswer = {
        id:           ref.id,
        userId:       user.uid,
        questionText: '자유 기록',
        content:      writeContent.trim(),
        category:     '자유 기록',
        type:         'free',
        isPrivate:    false,
        createdAt:    new Date().toISOString(),
      };
      setAnswers(prev => [...prev, newAnswer]);
      setWriteContent('');
      setShowWriteForm(false);
      // 자유 기록 탭으로 이동해서 방금 쓴 기억 보여주기
      setActiveCategory('자유 기록');
      setPhase('album');
    } catch {
      triggerShareToast(t.error_save);
    } finally {
      setWriteSaving(false);
    }
  }

  // ── 커버 날짜 ─────────────────────────────────────────────────────────────
  const firstDate = answers[0]?.createdAt ?? null;
  const lastDate  = answers[answers.length - 1]?.createdAt ?? null;

  // ── 동적 스타일 (isMemorial 의존) ─────────────────────────────────────────
  const tabActiveStyle = {
    color:            isMemorial ? '#7b6fa0' : 'var(--accent)',
    borderBottomColor: isMemorial ? '#7b6fa0' : 'var(--accent)',
    fontWeight: 700,
  };
  const tabCountActiveStyle = {
    backgroundColor: isMemorial ? 'rgba(123,111,160,0.2)' : 'var(--accent-pale)',
    color:           isMemorial ? '#7b6fa0'               : 'var(--accent)',
  };
  const navBtnStyle = {
    ...S.navBtn,
    backgroundColor: isMemorial ? '#16213e' : 'var(--card)',
    border:          `1px solid ${isMemorial ? '#2d2d4e' : 'var(--border-light)'}`,
    color:           isMemorial ? '#c8b8d8' : 'var(--text)',
  };

  // ── 렌더링: 로딩 ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t.album_loading}</p>
      </div>
    );
  }

  // ── 렌더링: 표지 ──────────────────────────────────────────────────────────
  if (phase === 'cover') {
    return (
      <div style={S.page}>
        <TopBar title={t.album_title} onBack={() => navigate(-1)} />

        <div style={S.coverWrap}>
          <div style={{
            ...S.coverBook,
            backgroundColor: isMemorial ? '#16213e' : 'var(--card)',
            border:          `1px solid ${isMemorial ? '#2d2d4e' : 'var(--border-light)'}`,
          }}>
            {/* 책등 */}
            <div style={{ ...S.coverSpine, backgroundColor: isMemorial ? '#7b6fa0' : 'var(--accent)' }} />

            {/* 아바타 */}
            <div style={S.coverAvatarWrap}>
              <div style={S.coverAvatar}>🪆</div>
              {dollName && <p style={{ ...S.coverDollName, color: 'var(--text-muted)' }}>{dollName}</p>}
            </div>

            {/* 제목 */}
            <div style={S.coverCenter}>
              {isMemorial && <p style={S.coverCross}>†</p>}
              <h1 style={{ ...S.coverTitle, color: 'var(--primary)' }}>
                {t.album_title_text(displayName)}
              </h1>
              <p style={{ ...S.coverCount, color: 'var(--text-muted)' }}>
                {t.album_count(answers.length)}
              </p>
            </div>

            {/* 기간 */}
            {firstDate && (
              <p style={{ ...S.coverDates, color: 'var(--text-muted)' }}>
                {formatDateYM(firstDate)}
                {lastDate && lastDate !== firstDate ? ` ~ ${formatDateYM(lastDate)}` : ''}
              </p>
            )}
          </div>

          {error && <p style={S.errorText}>{error}</p>}

          {/* 기억 있을 때: 앨범 열기 */}
          {answers.length > 0 && (
            <button
              style={{ ...S.coverBtn, backgroundColor: isMemorial ? '#7b6fa0' : 'var(--accent)' }}
              onClick={() => setPhase('album')}
            >
              {t.album_open_btn}
            </button>
          )}

          {/* 기억 없을 때: 추가 방법 안내 */}
          {answers.length === 0 && !isMemorial && (
            <div style={S.emptyActions}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, textAlign: 'center' }}>
                {t.album_fill_hint}
              </p>
              <button
                style={{ ...S.coverBtn, backgroundColor: 'var(--accent)', marginTop: 0 }}
                onClick={() => navigate('/questions')}
              >
                {t.memory_go_questions}
              </button>
              <button
                style={S.coverBtnSecondary}
                onClick={() => setShowWriteForm(true)}
              >
                {t.album_free_write_btn}
              </button>
            </div>
          )}

          {answers.length === 0 && isMemorial && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
              {t.album_no_memorial}
            </p>
          )}
        </div>

        <BottomNav />
      </div>
    );
  }

  // ── 렌더링: 앨범 ──────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes albumSlideRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
        @keyframes albumSlideLeft {
          from { transform: translateX(-100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .album-slide-right { animation: albumSlideRight 0.28s ease; }
        .album-slide-left  { animation: albumSlideLeft  0.28s ease; }
      `}</style>

      <div style={S.page}>
        <TopBar title={t.album_title} onBack={() => setPhase('cover')} />

        {/* 카테고리 탭 */}
        <div style={{
          ...S.tabsWrap,
          backgroundColor: isMemorial ? '#16213e' : 'var(--card)',
          borderBottomColor: isMemorial ? '#2d2d4e' : 'var(--border-light)',
        }}>
          <div style={S.tabs}>
            {CATEGORY_LIST.map(cat => {
              const count =
                cat === '즐겨찾기' ? answers.filter(a => favorites.has(a.id)).length
                : cat === '전체'   ? answers.length
                : answers.filter(a => a.category === cat).length;
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    ...S.tab,
                    color: active ? (isMemorial ? '#7b6fa0' : 'var(--accent)') : 'var(--text-muted)',
                    borderBottomColor: active ? (isMemorial ? '#7b6fa0' : 'var(--accent)') : 'transparent',
                    fontWeight: active ? 700 : 400,
                  }}
                >
                  {CATEGORY_ICONS[cat]} {getCatLabel(cat)}
                  {count > 0 && (
                    <span style={{ ...S.tabCount, ...(active ? tabCountActiveStyle : {}) }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <main style={S.main} className="pb-nav">
          {filtered.length === 0 ? (
            <div style={S.emptyBox}>
              <p style={{ fontSize: 36, marginBottom: 12 }}>
                {activeCategory === '즐겨찾기' ? '💔' : '📭'}
              </p>
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                {activeCategory === '즐겨찾기' ? t.album_no_favorites : t.album_no_cat(getCatLabel(activeCategory))}
              </p>
            </div>
          ) : (
            <>
              {/* 카드 (스와이프 영역) */}
              <div
                style={S.cardWrap}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
              >
                {currentAnswer && (
                  <div
                    key={animKey}
                    className={slideDir === 'left' ? 'album-slide-left' : 'album-slide-right'}
                    style={{
                      ...S.card,
                      backgroundColor: isMemorial ? '#16213e' : 'var(--card)',
                      border: `1px solid ${isMemorial ? '#2d2d4e' : 'var(--border-light)'}`,
                      ...(currentAnswer.category === '자유 기록' || currentAnswer.type === 'free'
                        ? {
                            backgroundImage: `repeating-linear-gradient(
                              transparent, transparent 27px,
                              ${isMemorial ? 'rgba(45,45,78,0.8)' : 'rgba(196,149,106,0.12)'} 28px
                            )`,
                            backgroundPosition: '0 52px',
                          }
                        : {}),
                    }}
                  >
                    {/* 상단: 카테고리 뱃지 + 즐겨찾기 */}
                    <div style={S.cardHeader}>
                      <span style={{ ...S.catBadge, ...getCatColor(currentAnswer.category, isMemorial) }}>
                        {CATEGORY_ICONS[currentAnswer.category] || '📖'} {getCatLabel(currentAnswer.category) || t.album_cat_other}
                      </span>
                      <button
                        onClick={() => toggleFavorite(currentAnswer.id)}
                        style={S.favBtn}
                        aria-label={t.aria_fav_toggle}
                      >
                        {favorites.has(currentAnswer.id) ? '❤️' : '🤍'}
                      </button>
                    </div>

                    {/* 질문 */}
                    <p style={{ ...S.questionText, color: 'var(--primary)' }}>
                      Q. {currentAnswer.questionText || t.cat_free_record}
                    </p>

                    {/* 답변 */}
                    <div style={S.answerWrap}>
                      {currentAnswer.type === 'tags' || Array.isArray(currentAnswer.content) ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {(Array.isArray(currentAnswer.content)
                            ? currentAnswer.content
                            : [currentAnswer.content]
                          ).map(tag => (
                            <span key={tag} style={S.tag}>{tag}</span>
                          ))}
                        </div>
                      ) : (
                        <p style={{ ...S.answerText, color: 'var(--text)' }}>
                          "{currentAnswer.content}"
                        </p>
                      )}
                    </div>

                    {/* 이미지 갤러리 */}
                    {currentAnswer.imageUrls?.length > 0 && (
                      <AlbumImageGallery
                        urls={currentAnswer.imageUrls}
                        isMemorial={isMemorial}
                        imgAlt={t.img_attachment}
                        imgAltN={t.img_attachment_n}
                        onOpen={(idx) => setViewerData({ urls: currentAnswer.imageUrls, index: idx })}
                      />
                    )}

                    {/* 날짜 */}
                    <p style={{ ...S.dateText, color: isMemorial ? '#7b6fa0' : '#c4956a' }}>
                      {isMemorial
                        ? t.album_memory_date_label(formatDate(currentAnswer.createdAt))
                        : formatDate(currentAnswer.createdAt)
                      }
                    </p>

                    {/* 공유 버튼 (추모 모드) */}
                    {isMemorial && (
                      <button onClick={() => handleShare(currentAnswer)} style={S.shareBtn}>
                        {t.album_share_btn}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 페이지 번호 */}
              <p style={{ ...S.pageNum, color: 'var(--text-muted)' }}>
                {currentIndex + 1} / {filtered.length}
              </p>

              {/* 이전 / 다음 버튼 */}
              <div style={S.navRow}>
                <button
                  onClick={goPrev}
                  disabled={currentIndex === 0}
                  style={{ ...navBtnStyle, opacity: currentIndex === 0 ? 0.3 : 1 }}
                >
                  {t.album_prev}
                </button>
                <button
                  onClick={goNext}
                  disabled={currentIndex >= filtered.length - 1}
                  style={{ ...navBtnStyle, opacity: currentIndex >= filtered.length - 1 ? 0.3 : 1 }}
                >
                  {t.album_next}
                </button>
              </div>
            </>
          )}
        </main>

        {/* 자유 기록 FAB (생존 모드만) */}
        {!isMemorial && (
          <button
            style={S.fab}
            onClick={() => setShowWriteForm(true)}
            aria-label={t.aria_free_write}
          >
            ✏️
          </button>
        )}

        <BottomNav />

        {/* 자유 기록 작성 모달 */}
        {showWriteForm && (
          <div style={S.modalOverlay} onClick={() => setShowWriteForm(false)}>
            <div style={S.modalSheet} onClick={e => e.stopPropagation()}>
              <div style={S.modalHandle} />
              <p style={S.modalTitle}>{t.album_free_write_title}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                {t.album_free_write_desc}
              </p>
              <textarea
                value={writeContent}
                onChange={e => setWriteContent(e.target.value.slice(0, 500))}
                placeholder={t.album_free_write_placeholder}
                rows={5}
                style={S.writeTextarea}
                autoFocus
              />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', marginBottom: 12 }}>
                {writeContent.length}/500
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setShowWriteForm(false); setWriteContent(''); }}
                  style={S.modalCancelBtn}
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleWriteFree}
                  disabled={!writeContent.trim() || writeSaving}
                  style={{
                    ...S.modalSaveBtn,
                    opacity: !writeContent.trim() || writeSaving ? 0.45 : 1,
                  }}
                >
                  {writeSaving ? t.saving : t.save}
                </button>
              </div>
            </div>
          </div>
        )}

        {shareToast && <div style={S.toast}>{shareToast}</div>}

        {/* 풀스크린 이미지 뷰어 */}
        {viewerData && (
          <ImageViewer
            urls={viewerData.urls}
            initialIndex={viewerData.index}
            onClose={() => setViewerData(null)}
          />
        )}
      </div>
    </>
  );
}

// ── 앨범 이미지 갤러리 ────────────────────────────────────────────────────────
function AlbumImageGallery({ urls, isMemorial, onOpen, imgAlt = '', imgAltN = (n) => `${n}` }) {
  if (!urls || urls.length === 0) return null;

  const borderColor = isMemorial ? 'rgba(45,45,78,0.6)' : 'rgba(196,149,106,0.3)';

  if (urls.length === 1) {
    return (
      <div style={{ marginBottom: 14 }}>
        <img
          src={urls[0]}
          alt={imgAlt}
          style={{ width: '100%', borderRadius: 12, objectFit: 'cover', maxHeight: 260, cursor: 'pointer', display: 'block', border: `1px solid ${borderColor}` }}
          onClick={() => onOpen(0)}
        />
      </div>
    );
  }

  // 2장 이상: 2열 그리드
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
      {urls.map((url, idx) => (
        <img
          key={url}
          src={url}
          alt={imgAltN(idx + 1)}
          style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 10, cursor: 'pointer', display: 'block', border: `1px solid ${borderColor}` }}
          onClick={() => onOpen(idx)}
        />
      ))}
    </div>
  );
}

// ── 스타일 ────────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100dvh',
    backgroundColor: 'var(--bg)',
    fontFamily: 'var(--font-sans)',
  },

  // 표지
  coverWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 'calc(100dvh - 56px - 64px)',
    padding: '24px 28px',
  },
  coverBook: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    padding: '32px 28px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  coverSpine: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 8,
    opacity: 0.5,
    borderRadius: '20px 0 0 20px',
  },
  coverAvatarWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  coverAvatar: {
    fontSize: 56,
    lineHeight: 1,
    filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.1))',
  },
  coverDollName: {
    fontSize: 12,
    margin: 0,
  },
  coverCenter: {
    textAlign: 'center',
  },
  coverCross: {
    fontSize: 24,
    color: '#c8b8d8',
    margin: '0 0 8px',
    fontFamily: 'var(--font-serif)',
    lineHeight: 1,
  },
  coverTitle: {
    fontFamily: 'var(--font-serif)',
    fontSize: 22,
    fontWeight: 700,
    lineHeight: 1.5,
    margin: '0 0 8px',
    whiteSpace: 'pre-line',
  },
  coverCount: {
    fontSize: 14,
    margin: 0,
  },
  coverDates: {
    fontSize: 12,
    margin: 0,
  },
  coverBtn: {
    marginTop: 24,
    padding: '14px 40px',
    borderRadius: 50,
    color: 'white',
    fontFamily: 'var(--font-sans)',
    fontSize: 15,
    fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    transition: 'transform 0.15s, opacity 0.15s',
  },
  errorText: {
    fontSize: 13,
    color: '#fc8181',
    textAlign: 'center',
    marginTop: 16,
  },

  // 탭
  tabsWrap: {
    overflowX: 'auto',
    borderBottom: '1px solid',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
  },
  tabs: {
    display: 'flex',
    padding: '0 8px',
    minWidth: 'max-content',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '10px 10px',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
    whiteSpace: 'nowrap',
    transition: 'color 0.15s',
  },
  tabCount: {
    fontSize: 10,
    backgroundColor: 'var(--border-light)',
    color: 'var(--text-muted)',
    borderRadius: 10,
    padding: '1px 5px',
    marginLeft: 2,
  },

  // 메인
  main: {
    padding: '20px 20px 20px',
  },
  emptyBox: {
    textAlign: 'center',
    padding: '60px 0',
  },

  // 카드
  cardWrap: {
    overflow: 'hidden',
    borderRadius: 20,
  },
  card: {
    borderRadius: 20,
    padding: '22px 20px',
    minHeight: 300,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catBadge: {
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 20,
    padding: '4px 10px',
  },
  favBtn: {
    fontSize: 20,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    lineHeight: 1,
  },
  questionText: {
    fontFamily: 'var(--font-serif)',
    fontSize: 16,
    lineHeight: 1.7,
    margin: 0,
  },
  answerWrap: {
    flex: 1,
  },
  answerText: {
    fontSize: 18,
    lineHeight: 1.85,
    fontStyle: 'italic',
    margin: 0,
  },
  tag: {
    fontSize: 14,
    backgroundColor: 'var(--accent-pale)',
    color: 'var(--accent)',
    borderRadius: 20,
    padding: '6px 14px',
    fontWeight: 600,
  },
  dateText: {
    fontSize: 12,
    margin: 0,
  },
  shareBtn: {
    alignSelf: 'flex-end',
    fontSize: 12,
    color: '#9088a8',
    backgroundColor: 'transparent',
    border: '1px solid #3d3d6b',
    borderRadius: 20,
    padding: '6px 14px',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },

  // 페이지 번호 & 네비게이션
  pageNum: {
    textAlign: 'center',
    fontSize: 13,
    margin: '16px 0 12px',
  },
  navRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  navBtn: {
    flex: 1,
    padding: '12px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    transition: 'opacity 0.15s',
  },

  // 표지 - 기억 없을 때
  emptyActions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    width: '100%',
    maxWidth: 280,
    marginTop: 24,
    gap: 10,
  },
  coverBtnSecondary: {
    padding: '13px 40px',
    borderRadius: 50,
    backgroundColor: 'transparent',
    color: 'var(--accent)',
    border: '1.5px solid var(--accent)',
    fontFamily: 'var(--font-sans)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center',
  },

  // FAB
  fab: {
    position: 'fixed',
    bottom: 80,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'var(--accent)',
    color: 'white',
    fontSize: 20,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },

  // 작성 모달
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 150,
    display: 'flex',
    alignItems: 'flex-end',
  },
  modalSheet: {
    width: '100%',
    maxWidth: 390,
    margin: '0 auto',
    backgroundColor: 'var(--card)',
    borderRadius: '20px 20px 0 0',
    padding: '12px 20px 32px',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'var(--border)',
    margin: '0 auto 16px',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--primary)',
    marginBottom: 6,
    fontFamily: 'var(--font-serif)',
  },
  writeTextarea: {
    width: '100%',
    backgroundColor: 'var(--bg)',
    border: '1px solid var(--border-light)',
    borderRadius: 12,
    color: 'var(--text)',
    fontSize: 15,
    lineHeight: 1.7,
    padding: '12px 14px',
    resize: 'none',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    boxSizing: 'border-box',
    marginBottom: 6,
  },
  modalCancelBtn: {
    flex: 1,
    padding: '13px',
    borderRadius: 12,
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border-light)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  modalSaveBtn: {
    flex: 2,
    padding: '13px',
    borderRadius: 12,
    backgroundColor: 'var(--accent)',
    color: 'white',
    border: 'none',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    transition: 'opacity 0.15s',
  },

  // 토스트
  toast: {
    position: 'fixed',
    bottom: 80,
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#2d2d4e',
    color: '#e8e0f0',
    padding: '10px 20px',
    borderRadius: 20,
    fontSize: 13,
    whiteSpace: 'nowrap',
    zIndex: 200,
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
  },
};
