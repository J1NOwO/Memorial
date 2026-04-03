// DailyQuestion.jsx - 오늘의 질문 답변 페이지
//
// 흐름:
// 1. 백엔드 /api/questions/daily 호출 → Gemini가 생성한 기본 질문 3개
//    (백엔드 미연결 시 정적 질문으로 폴백)
// 2. 오늘 이미 답변한 질문 확인 (answeredMap)
// 3. 질문 카드 클릭 → 답변 폼 (텍스트, followUp 힌트, 비공개 토글)
// 4. 기본 3개 모두 답변 완료 → 추가 질문 버튼 표시 (무제한)
// 5. 자유 기록 카드 (최상단) → type: 'free', questionText: '자유 기록' 저장

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, addDoc, updateDoc, doc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useMemorial } from '../context/MemorialContext';
import { useT } from '../hooks/useT';
import { useLang } from '../contexts/LanguageContext';
import { apiCall } from '../utils/api';
import { seedQuestionsIfEmpty, selectTodayQuestions } from '../utils/seedQuestions';
import ImageUploader from '../components/ImageUploader';
import { uploadImages } from '../utils/imageUpload';

const CATEGORY_COLORS = {
  '추억':      { bg: '#fef3e2', text: '#b7791f' },
  '가치관':    { bg: '#e8f4fd', text: '#2b6cb0' },
  '말투·성격': { bg: '#f0fdf4', text: '#276749' },
  '가족에게':  { bg: '#fdf2f8', text: '#97266d' },
  '인생 조언': { bg: '#f5f0ff', text: '#6b46c1' },
  '자유':      { bg: '#faf7f4', text: '#7a6355' },
};

function DailyQuestion() {
  const { user, addGems } = useAuth();
  const { isMemorial } = useMemorial();
  const t = useT();
  const { lang } = useLang();

  // 오늘 저장 수에 따른 격려 메시지
  function getEncouragementMsg(count) {
    if (count >= 6) return t.encourage_lots;
    if (count >= 3) return t.encourage_many;
    if (count >= 1) return t.encourage_some;
    return null;
  }

  if (isMemorial) return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)',
      padding: '40px 32px', textAlign: 'center', gap: 16,
    }}>
      <span style={{ fontSize: 52, lineHeight: 1 }}>†</span>
      <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-serif)' }}>
        {t.memorial_record_complete}
      </p>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.8 }}>
        {t.memorial_record_kept}
      </p>
      <button
        onClick={() => window.history.back()}
        style={{
          marginTop: 8, padding: '13px 32px', borderRadius: 14,
          border: '1.5px solid #3d3560',
          backgroundColor: '#1e1e3a', color: '#c8b8d8',
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'var(--font-sans)', letterSpacing: 0.3,
        }}
      >
        ← {t.back}
      </button>
    </div>
  );

  // ── 기본 질문 + 추가 질문 ────────────────────────────────────────────────
  const [baseQuestions, setBaseQuestions]   = useState([]);
  const [extraQuestions, setExtraQuestions] = useState([]);
  const [extraLoading, setExtraLoading]     = useState(false);

  // ── 답변 상태 ────────────────────────────────────────────────────────────
  const [answeredMap, setAnsweredMap] = useState({});  // { questionKey: content }
  const [activeId, setActiveId]       = useState(null);
  const [textInput, setTextInput]     = useState('');
  const [isPrivate, setIsPrivate]     = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState('');

  // ── 이미지 상태 ──────────────────────────────────────────────────────────
  const [localImages, setLocalImages]   = useState([]); // [{file, previewUrl, tempId}]
  const [compressing, setCompressing]   = useState(false);

  const [extraError, setExtraError]         = useState(''); // 추가 질문 에러 메시지
  const [showGemPopup, setShowGemPopup]     = useState(false);
  const [gemRewardGiven, setGemRewardGiven] = useState(false);

  // ── 페이지 상태 ──────────────────────────────────────────────────────────
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError]     = useState('');
  const [aiSource, setAiSource]       = useState('');

  // ── 파생 값 ──────────────────────────────────────────────────────────────
  const allQuestions    = [...baseQuestions, ...extraQuestions];
  const answeredCount   = Object.keys(answeredMap).length;
  const todayTotal      = answeredCount;
  // 기본 3개 모두 답변 완료 여부 (추가 질문 버튼 표시 기준)
  const allBaseAnswered = baseQuestions.length > 0 &&
    baseQuestions.every((q) => answeredMap[q.id || q.text] !== undefined);

  // ── 초기 로드 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const questions = await loadTodayQuestions();
      if (questions.length > 0) await loadTodayAnswers(questions);
      setPageLoading(false);
    }
    init();
  }, [user]);

  // ── 질문 로드: 백엔드 AI → 정적 폴백 ─────────────────────────────────────
  async function loadTodayQuestions() {
    try {
      const data = await apiCall('GET', `/api/questions/daily?lang=${lang}`);
      setBaseQuestions(data.questions);
      setAiSource('ai');
      return data.questions;
    } catch {
      try {
        await seedQuestionsIfEmpty();
        const snap = await getDocs(collection(db, 'questions'));
        const all  = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const qs   = selectTodayQuestions(all, 3);
        setBaseQuestions(qs);
        setAiSource('static');
        return qs;
      } catch {
        setLoadError(t.question_load_fail);
        return [];
      }
    }
  }

  // ── 오늘 답변 로드 ─────────────────────────────────────────────────────────
  async function loadTodayAnswers(questions) {
    try {
      const ids  = questions.map((q) => q.id || q.text);
      const snap = await getDocs(query(
        collection(db, 'answers'),
        where('userId', '==', user.uid),
        where('questionKey', 'in', ids),
      ));
      const today = new Date().toISOString().split('T')[0];
      const map   = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.createdAt) {
          const date = data.createdAt.toDate?.().toISOString().split('T')[0];
          if (date === today) map[data.questionKey] = data.content;
        }
      });
      setAnsweredMap(map);
    } catch (err) {
      console.warn('오늘 답변 로드 실패 (무시):', err.message);
    }
  }

  // ── 질문 카드 클릭 ─────────────────────────────────────────────────────────
  function handleCardClick(question) {
    const key = question.id || question.text;
    if (answeredMap[key] !== undefined) return;
    if (activeId === key) {
      setActiveId(null);
    } else {
      setActiveId(key);
      setTextInput('');
      setIsPrivate(false);
      setError('');
      setLocalImages([]);
    }
  }

  // ── 답변 저장 ──────────────────────────────────────────────────────────────
  async function handleSubmit(question) {
    if (!textInput.trim()) { setError(t.validation_answer); return; }
    if (compressing) { setError(t.wait_compressing); return; }
    setSubmitting(true);
    setError('');
    try {
      const questionKey = question.id || question.text;
      // 1. 텍스트 먼저 저장 (docId 확보)
      const docRef = await addDoc(collection(db, 'answers'), {
        userId:       user.uid,
        questionId:   question.id || null,
        questionKey,
        questionText: question.text,
        category:     question.category,
        type:         'text',
        content:      textInput.trim(),
        isPrivate,
        audioUrl:     '',
        imageUrls:    [],
        createdAt:    serverTimestamp(),
      });

      // 2. 이미지 업로드 (있을 때만)
      if (localImages.length > 0) {
        try {
          const urls = await uploadImages(
            localImages,
            `answers/${user.uid}/${docRef.id}`
          );
          await updateDoc(doc(db, 'answers', docRef.id), { imageUrls: urls });
        } catch (imgErr) {
          console.error('이미지 업로드 실패:', imgErr);
          // 텍스트 저장은 됐으므로 이미지 오류만 알림
          alert(t.error_image_partial);
        }
      }

      const newAnsweredMap = { ...answeredMap, [questionKey]: textInput.trim() };
      setAnsweredMap(newAnsweredMap);
      setActiveId(null);
      setLocalImages([]);

      // 기본 질문 3개 완료 보상 (+10 💎)
      const isBaseQ = baseQuestions.some((q) => (q.id || q.text) === questionKey);
      if (isBaseQ) {
        const allBaseDone = baseQuestions.every((q) => newAnsweredMap[q.id || q.text] !== undefined);
        if (allBaseDone && !gemRewardGiven) {
          setGemRewardGiven(true);
          setShowGemPopup(true);
          addGems(10);
        }
      }

      // 추가 질문 답변 보상 (+3 💎)
      const isExtraQ = extraQuestions.some((q) => (q.id || q.text) === questionKey);
      if (isExtraQ) addGems(3);

    } catch (err) {
      console.error('답변 저장 실패:', err);
      setError(t.error_save);
    } finally {
      setSubmitting(false);
    }
  }

  // ── 추가 질문 요청 ─────────────────────────────────────────────────────────
  async function handleRequestExtra() {
    setExtraLoading(true);
    setExtraError('');
    try {
      const askedTexts = allQuestions.map((q) => q.text);
      const data = await apiCall('POST', '/api/questions/extra', { askedTexts, lang });
      if (!data.question) throw new Error(t.question_no_data);
      setExtraQuestions((prev) => [...prev, data.question]);
    } catch (err) {
      console.error('추가 질문 요청 실패:', err.message);
      setExtraError(err.message || t.error_default);
    } finally {
      setExtraLoading(false);
    }
  }


  // ─────────────────────────────────────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <Link to="/dashboard" style={styles.backLink}>{t.back_dashboard}</Link>
        <span style={styles.logo}>Memorial</span>
        <div style={{ width: '80px' }} />
      </header>

      <main style={styles.main}>
        {/* 타이틀 */}
        <div style={styles.titleArea}>
          <div style={styles.titleRow}>
            <h2 style={styles.title}>{t.daily_question_title}</h2>
            {!pageLoading && aiSource === 'ai' && (
              <span style={styles.aiBadge}>{t.ai_generated}</span>
            )}
          </div>
          <p style={styles.dateText}>
            {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
          </p>

          {/* 진행률: "오늘 N개 남겼어요 🌱" */}
          {!pageLoading && (
            <div style={styles.progressArea}>
              <span style={styles.progressCount}>{t.today_count(todayTotal)}</span>
              {getEncouragementMsg(todayTotal) && (
                <span style={styles.encourageMsg}>{getEncouragementMsg(todayTotal)}</span>
              )}
            </div>
          )}
        </div>

        {/* 로딩 */}
        {pageLoading && (
          <div style={styles.loadingBox}>
            <p style={styles.loadingText}>{t.question_loading}</p>
          </div>
        )}

        {/* 로드 에러 */}
        {!pageLoading && loadError && <p style={styles.errorMsg}>{loadError}</p>}

        {/* 질문 목록 */}
        {!pageLoading && (
          <div style={styles.questionList}>

            {/* ── 일기 바로가기 카드 (최상단) ── */}
            <Link to="/diary" style={styles.diaryShortcut}>
              <div style={styles.freeIcon}>📓</div>
              <div style={styles.cardBody}>
                <p style={{ ...styles.questionText, marginBottom: 4 }}>{t.diary_shortcut_title}</p>
                <p style={styles.freeSubTitle}>{t.diary_shortcut_desc}</p>
              </div>
              <span style={{ color: '#c4956a', fontSize: 18, flexShrink: 0 }}>→</span>
            </Link>

            {/* ── 기본 질문 3개 + 추가 질문 ── */}
            {allQuestions.map((question, index) => {
              const key        = question.id || question.text;
              const isAnswered = answeredMap[key] !== undefined;
              const isOpen     = activeId === key;
              const catColor   = CATEGORY_COLORS[question.category] || { bg: '#f0f0f0', text: '#555' };

              return (
                <div key={key} style={{
                  ...styles.questionCard,
                  ...(isAnswered ? styles.questionCardDone : {}),
                  ...(isOpen     ? styles.questionCardOpen : {}),
                }}>
                  {/* 카드 헤더 */}
                  <div
                    style={{ ...styles.cardHeader, cursor: isAnswered ? 'default' : 'pointer' }}
                    onClick={() => handleCardClick(question)}
                  >
                    <div style={{ ...styles.questionNum, ...(isAnswered ? styles.questionNumDone : {}) }}>
                      {isAnswered ? '✓' : index + 1}
                    </div>
                    <div style={styles.cardBody}>
                      <div style={styles.cardTop}>
                        <span style={{ ...styles.categoryBadge, backgroundColor: catColor.bg, color: catColor.text }}>
                          {question.category}
                        </span>
                      </div>
                      <p style={{ ...styles.questionText, ...(isAnswered ? styles.questionTextDone : {}) }}>
                        {question.text}
                      </p>
                      {isAnswered && (
                        <p style={styles.answeredPreview}>{answeredMap[key]}</p>
                      )}
                    </div>
                    {!isAnswered && (
                      <span style={{ ...styles.arrow, transform: isOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
                    )}
                  </div>

                  {/* 답변 폼 */}
                  {isOpen && (
                    <div style={styles.answerForm}>
                      <div style={styles.divider} />
                      {question.followUp && (
                        <p style={styles.followUpHint}>💬 {question.followUp}</p>
                      )}
                      {error && <p style={styles.errorMsg}>{error}</p>}
                      <textarea
                        placeholder={t.answer_placeholder}
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        style={styles.textarea}
                        rows={5}
                        autoFocus
                      />

                      {/* 사진 첨부 */}
                      {compressing && (
                        <p style={styles.compressingMsg}>{t.image_optimizing}</p>
                      )}
                      <ImageUploader
                        localImages={localImages}
                        onAdd={(imgs) => setLocalImages(prev => [...prev, ...imgs])}
                        onRemoveLocal={(tempId) => setLocalImages(prev => prev.filter(i => i.tempId !== tempId))}
                        onCompressingChange={setCompressing}
                      />

                      <div
                        style={{ ...styles.privateToggle, ...(isPrivate ? styles.privateToggleOn : {}) }}
                        onClick={() => setIsPrivate((v) => !v)}
                      >
                        <span style={styles.privateLock}>{isPrivate ? '🔒' : '🔓'}</span>
                        <div>
                          <p style={styles.privateTitle}>{isPrivate ? t.private_post_label : t.public_label}</p>
                          <p style={styles.privateDesc}>
                            {isPrivate ? t.private_post_desc : t.public_desc}
                          </p>
                        </div>
                        <div style={{ ...styles.toggleDot, ...(isPrivate ? styles.toggleDotOn : {}) }} />
                      </div>
                      <div style={styles.formFooter}>
                        <button
                          onClick={() => { setActiveId(null); setError(''); setLocalImages([]); }}
                          style={styles.btnCancel}
                          disabled={submitting}
                        >
                          {t.cancel}
                        </button>
                        <button
                          onClick={() => handleSubmit(question)}
                          style={styles.btnSubmit}
                          disabled={submitting || compressing}
                        >
                          {submitting ? t.loading : t.save}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── 추가 질문 버튼 (기본 3개 완료 후 표시) ── */}
            {allBaseAnswered && (
              <div style={styles.extraArea}>
                {extraLoading ? (
                  <p style={styles.extraLoading}>{t.extra_loading}</p>
                ) : (
                  <>
                    {extraError && <p style={styles.extraErrorMsg}>{extraError}</p>}
                    <button style={styles.btnExtra} onClick={handleRequestExtra}>
                      {t.add_question}
                    </button>
                  </>
                )}
              </div>
            )}

          </div>
        )}

        {/* 내 기억 보러가기 링크 (하단) */}
        {!pageLoading && todayTotal > 0 && (
          <div style={styles.bottomLink}>
            <Link to="/memories" style={styles.memoriesLink}>{t.memory_link}</Link>
          </div>
        )}
      </main>

        {/* ── 기억 조각 보상 팝업 ── */}
        {showGemPopup && (
          <div style={styles.popupOverlay}>
            <div style={styles.popupCard} className="anim-scale">
              {/* 보석 애니메이션 */}
              <div style={styles.gemRainArea}>
                {[...Array(7)].map((_, i) => (
                  <span key={i} style={{
                    position: 'absolute',
                    left: `${6 + i * 13}%`,
                    top: 0,
                    fontSize: 22,
                    animation: `gemFall 1.6s ease-in ${i * 0.13}s both`,
                  }}>💎</span>
                ))}
              </div>
              <div style={styles.popupEmoji}>🎉</div>
              <h3 style={styles.popupTitle}>{t.gem_popup_title}</h3>
              <div style={styles.popupGemRow}>
                <span style={styles.popupGemIcon}>💎</span>
                <span style={styles.popupGemText}>{t.gem_popup_reward}</span>
              </div>
              <button style={styles.popupBtn} onClick={() => setShowGemPopup(false)}>
                {t.confirm}
              </button>
            </div>
          </div>
        )}
    </div>
  );
}

const styles = {
  container:         { minHeight: '100vh', backgroundColor: '#f7f3ee', fontFamily: "'Nunito', 'Noto Sans KR', sans-serif", color: '#5c4a3a' },
  header:            { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 40px', backgroundColor: '#fffdf9', borderBottom: '1px solid #e8e0d8' },
  backLink:          { color: '#7a6355', fontSize: '14px', width: '80px', display: 'block' },
  logo:              { fontFamily: "'Cormorant Garamond', 'Noto Serif KR', serif", fontSize: '20px', fontWeight: '700', letterSpacing: '2px', color: '#5c4a3a' },
  main:              { maxWidth: '640px', margin: '0 auto', padding: '48px 20px 80px' },
  titleArea:         { marginBottom: '36px' },
  titleRow:          { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' },
  title:             { fontFamily: "'Cormorant Garamond', 'Noto Serif KR', serif", fontSize: '26px' },
  aiBadge:           { fontSize: '11px', backgroundColor: '#f0fdf4', color: '#276749', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: '99px', fontWeight: '600' },
  dateText:          { fontSize: '13px', color: '#a89080', marginBottom: '16px' },
  // 진행률
  progressArea:      { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  progressCount:     { fontSize: '15px', fontWeight: '600', color: '#5c4a3a' },
  encourageMsg:      { fontSize: '13px', color: '#a89080' },
  // 로딩/에러
  loadingBox:        { padding: '80px 0', textAlign: 'center' },
  loadingText:       { fontSize: '15px', color: '#a89080' },
  errorMsg:          { backgroundColor: '#fdf0f0', color: '#c0392b', fontSize: '13px', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', borderLeft: '3px solid #c0392b' },
  // 질문 목록
  questionList:      { display: 'flex', flexDirection: 'column', gap: '12px' },
  questionCard:      { backgroundColor: '#fffdf9', borderRadius: '16px', boxShadow: '0 2px 12px rgba(92,74,58,0.08)', overflow: 'hidden', border: '1.5px solid transparent', transition: 'border-color 0.2s' },
  questionCardDone:  { opacity: 0.7, backgroundColor: '#f5f2ee' },
  questionCardOpen:  { border: '1.5px solid #c4956a' },
  cardHeader:        { display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '20px' },
  questionNum:       { width: '32px', height: '32px', minWidth: '32px', borderRadius: '50%', backgroundColor: '#f0ebe4', color: '#7a6355', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', marginTop: '2px' },
  questionNumDone:   { backgroundColor: '#c4956a', color: '#fffdf9' },
  freeIcon:          { width: '32px', height: '32px', minWidth: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', marginTop: '2px' },
  cardBody:          { flex: 1 },
  cardTop:           { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },
  categoryBadge:     { fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '99px', letterSpacing: '0.5px' },
  savedBadge:        { fontSize: '11px', color: '#276749', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: '99px', fontWeight: '600' },
  questionText:      { fontSize: '16px', lineHeight: '1.6', color: '#3d2e22', fontWeight: '500' },
  questionTextDone:  { color: '#7a6355' },
  freeSubTitle:      { fontSize: '13px', color: '#a89080', marginTop: '4px' },
  diaryShortcut:     { display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px', backgroundColor: '#fffdf9', borderRadius: '16px', boxShadow: '0 2px 12px rgba(92,74,58,0.08)', border: '1.5px solid #ede8e2', textDecoration: 'none', color: 'inherit', transition: 'border-color 0.15s' },
  answeredPreview:   { marginTop: '8px', fontSize: '13px', color: '#a89080', lineHeight: '1.5', fontStyle: 'italic' },
  arrow:             { fontSize: '18px', color: '#c4956a', transition: 'transform 0.2s', marginTop: '4px' },
  // 답변 폼
  answerForm:        { padding: '0 20px 20px' },
  divider:           { height: '1px', backgroundColor: '#f0ebe4', marginBottom: '16px' },
  followUpHint:      { fontSize: '14px', color: '#7a6355', fontWeight: '500', backgroundColor: '#fef8f2', border: '1px solid #f0ddc8', borderRadius: '10px', padding: '10px 14px', marginBottom: '14px', lineHeight: '1.6' },
  textarea:          { width: '100%', padding: '14px', borderRadius: '10px', border: '1.5px solid #e0d8d0', fontSize: '15px', color: '#3d2e22', backgroundColor: '#faf7f4', fontFamily: "'Nunito', 'Noto Sans KR', sans-serif", resize: 'vertical', lineHeight: '1.7', outline: 'none', boxSizing: 'border-box' },
  compressingMsg:    { fontSize: '13px', color: '#a89080', margin: '8px 0 0', fontStyle: 'italic' },
  privateToggle:     { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#f7f3ee', border: '1.5px solid #e8e0d8', cursor: 'pointer', marginTop: '14px', transition: 'all 0.2s', userSelect: 'none' },
  privateToggleOn:   { backgroundColor: '#fef8f2', borderColor: '#c4956a' },
  privateLock:       { fontSize: '20px' },
  privateTitle:      { fontSize: '13px', fontWeight: '600', color: '#3d2e22' },
  privateDesc:       { fontSize: '12px', color: '#a89080', marginTop: '2px' },
  toggleDot:         { width: '36px', height: '20px', backgroundColor: '#d8d0c8', borderRadius: '10px', marginLeft: 'auto', position: 'relative', flexShrink: 0, transition: 'background-color 0.2s' },
  toggleDotOn:       { backgroundColor: '#c4956a' },
  formFooter:        { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' },
  btnCancel:         { padding: '10px 20px', borderRadius: '10px', border: '1.5px solid #e0d8d0', backgroundColor: 'transparent', color: '#7a6355', fontSize: '14px', cursor: 'pointer', fontFamily: "'Nunito', 'Noto Sans KR', sans-serif" },
  btnSubmit:         { padding: '10px 24px', borderRadius: '10px', backgroundColor: '#c4956a', color: '#fffdf9', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Nunito', 'Noto Sans KR', sans-serif", border: 'none' },
  // 추가 질문 영역
  extraArea:         { textAlign: 'center', padding: '8px 0' },
  extraLoading:      { fontSize: '14px', color: '#a89080', padding: '16px' },
  extraErrorMsg:     { fontSize: '13px', color: '#c0392b', backgroundColor: '#fdf0f0', border: '1px solid #f5c6c6', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px', textAlign: 'left' },
  btnExtra:          { padding: '14px 28px', borderRadius: '12px', border: '1.5px dashed #c4956a', backgroundColor: '#fef8f2', color: '#c4956a', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Nunito', 'Noto Sans KR', sans-serif", transition: 'all 0.2s', width: '100%' },
  // 하단 링크
  bottomLink:        { textAlign: 'center', marginTop: '32px' },
  memoriesLink:      { fontSize: '14px', color: '#c4956a', fontWeight: '600' },
  popupOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(61,46,34,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(4px)' },
  popupCard:    { backgroundColor: '#fffdf9', borderRadius: 24, padding: '40px 32px 32px', width: 'calc(100% - 48px)', maxWidth: 320, textAlign: 'center', position: 'relative', overflow: 'hidden', boxShadow: '0 20px 60px rgba(61,46,34,0.25)' },
  gemRainArea:  { position: 'absolute', top: 0, left: 0, right: 0, height: '100%', pointerEvents: 'none', overflow: 'hidden' },
  popupEmoji:   { fontSize: 52, marginBottom: 12, display: 'block' },
  popupTitle:   { fontFamily: "'Cormorant Garamond','Noto Serif KR',serif", fontSize: 20, color: '#3d2e22', fontWeight: 700, marginBottom: 16, lineHeight: 1.4 },
  popupGemRow:  { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fef8f2', border: '1.5px solid #f0d8b8', borderRadius: 14, padding: '12px 20px', marginBottom: 24 },
  popupGemIcon: { fontSize: 24 },
  popupGemText: { fontSize: 16, fontWeight: 700, color: '#c4956a' },
  popupBtn:     { width: '100%', padding: '13px', backgroundColor: '#c4956a', color: '#fffdf9', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito','Noto Sans KR',sans-serif" },
};

export default DailyQuestion;
