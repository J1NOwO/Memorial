// routes/questions.js - 오늘의 질문 생성 API
//
// GET /api/questions/daily
//   → 유저별 카테고리 순환으로 질문 3개 반환
//   → Firestore에 캐싱 (하루에 한 번만 Gemini 호출)

const express = require('express');
const router = express.Router();
const { db } = require('../firebase-admin');
const { requireAuth } = require('../middleware/auth');
const { generateDailyQuestions } = require('../services/aiService');

const CATEGORIES = ['추억', '가치관', '말투·성격', '가족에게', '인생 조언'];

// 유저별 카테고리 인덱스 읽기 (없으면 0)
async function getUserCategoryIndex(userId) {
  if (!db) return 0;
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) return 0;
  const data = userDoc.data();
  return typeof data.categoryIndex === 'number' ? data.categoryIndex : 0;
}

// 유저 카테고리 인덱스 업데이트
async function updateUserCategoryIndex(userId, nextIndex, lastCategory) {
  if (!db) return;
  await db.collection('users').doc(userId).update({ categoryIndex: nextIndex, lastCategory });
}

// 시작 인덱스부터 카테고리 3개 선택
function getCategoriesFromIndex(startIndex) {
  return [0, 1, 2].map((i) => CATEGORIES[(startIndex + i) % CATEGORIES.length]);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/questions/daily
// 오늘의 질문 3개 반환 (캐싱됨)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/daily', requireAuth, async (req, res) => {
  const userId = req.user.uid;
  const lang   = req.query.lang === 'en' ? 'en' : 'ko';
  const today  = new Date().toISOString().split('T')[0]; // '2026-03-25'

  try {
    // 1. 오늘 이미 생성된 질문이 있는지 확인 (Firestore 캐시)
    if (db) {
      const cacheRef  = db.collection('dailyQuestions').doc(`${userId}_${today}_${lang}`);
      const cacheSnap = await cacheRef.get();
      if (cacheSnap.exists) {
        return res.json({ questions: cacheSnap.data().questions, cached: true });
      }
    }

    // 2. 이 유저가 이전에 받았던 질문 텍스트 목록 (중복 방지용, 최근 30일치)
    // orderBy 없이 where만 사용 → 복합 인덱스 불필요
    let previousQuestions = [];
    if (db) {
      try {
        const prevSnap = await db.collection('dailyQuestions')
          .where('userId', '==', userId)
          .get();

        // 클라이언트에서 날짜 내림차순 정렬 후 30개 제한
        const sorted = prevSnap.docs
          .sort((a, b) => (b.data().date || '').localeCompare(a.data().date || ''))
          .slice(0, 30);

        sorted.forEach((d) => {
          const qs = d.data().questions || [];
          qs.forEach((q) => previousQuestions.push(q.text));
        });
      } catch {
        console.warn('이전 질문 로드 실패 - 중복 방지 없이 생성');
      }
    }

    // 3. 유저별 카테고리 인덱스 로드 → 오늘 카테고리 3개 결정
    const currentIndex = await getUserCategoryIndex(userId);
    const categories   = getCategoriesFromIndex(currentIndex);

    // 4. Gemini로 오늘의 질문 3개 생성
    const questions = await generateDailyQuestions(categories, previousQuestions, lang);

    // 5. Firestore에 캐시 저장
    if (db) {
      const cacheRef = db.collection('dailyQuestions').doc(`${userId}_${today}_${lang}`);
      await cacheRef.set({ userId, date: today, questions, generatedAt: new Date() });
    }

    // 6. 유저 카테고리 인덱스 업데이트 (다음 날은 3칸 이동)
    const nextIndex    = (currentIndex + 3) % CATEGORIES.length;
    const lastCategory = categories[categories.length - 1];
    await updateUserCategoryIndex(userId, nextIndex, lastCategory);

    res.json({ questions, cached: false });
  } catch (err) {
    console.error('오늘의 질문 생성 실패:', err);
    res.status(500).json({ message: '질문 생성 중 오류가 발생했어요' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/questions/extra
// 추가 질문 1개 생성 (이미 받은 질문들 전달해서 중복 방지)
// body: { askedTexts: string[] }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/extra', requireAuth, async (req, res) => {
  const userId = req.user.uid;
  const { askedTexts = [], lang: bodyLang } = req.body;
  const lang = bodyLang === 'en' ? 'en' : 'ko';

  try {
    // 이전 30일치 + 현재 세션 질문들 합쳐서 중복 방지
    // (복합 인덱스 없어도 동작하도록 try-catch 처리)
    let previousQuestions = [...askedTexts];
    if (db) {
      try {
        const prevSnap = await db.collection('dailyQuestions')
          .where('userId', '==', userId)
          .orderBy('date', 'desc')
          .limit(30)
          .get();
        prevSnap.docs.forEach((d) => {
          (d.data().questions || []).forEach((q) => {
            if (!previousQuestions.includes(q.text)) previousQuestions.push(q.text);
          });
        });
      } catch {
        // 인덱스 미생성 시 현재 세션 질문(askedTexts)만으로 중복 방지
        console.warn('dailyQuestions 인덱스 없음 - askedTexts만 사용');
      }
    }

    // 5개 카테고리에서 랜덤 선택
    const CATEGORIES = ['추억', '가치관', '말투·성격', '가족에게', '인생 조언'];
    const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];

    const questions = await generateDailyQuestions([category], previousQuestions, lang);
    res.json({ question: questions[0] });
  } catch (err) {
    console.error('추가 질문 생성 실패:', err);
    res.status(500).json({ message: err.message || '추가 질문 생성 중 오류가 발생했어요' });
  }
});

module.exports = router;
