// routes/doll.js - Doll 시스템 API
//
// 엔드포인트:
//   POST /api/doll/create         - 새 Doll 생성
//   GET  /api/doll/me             - 내 Doll 정보 조회
//   POST /api/doll/chat           - Doll에게 메시지 전송 → 응답 받기
//   GET  /api/doll/chat/today     - 오늘 대화 내역 조회
//   GET  /api/doll/greeting       - 오늘의 첫 인사 (캐싱)

const express = require('express');
const router  = express.Router();
const { db }  = require('../firebase-admin');
const { requireAuth } = require('../middleware/auth');
const {
  generateDollGreeting,
  chatWithDoll,
  extractMemoryFromChat,
} = require('../services/aiService');

// Firestore 미초기화 가드
function requireDB(req, res, next) {
  if (!db) return res.status(503).json({ message: 'Firebase Admin이 설정되지 않았어요.' });
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/doll/create
// 새 Doll 생성. 유저당 1개만 허용.
// body: { name, appearance }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/create', requireAuth, requireDB, async (req, res) => {
  const { name, appearance } = req.body;
  const userId = req.user.uid;

  if (!name || !appearance) {
    return res.status(400).json({ message: '이름과 외모를 입력해주세요' });
  }

  try {
    // 이미 Doll이 있는지 확인
    const existing = await db.collection('dolls')
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(409).json({ message: '이미 Doll이 있어요', dollId: existing.docs[0].id });
    }

    // 유저 이름 가져오기 (첫 인사 생성용)
    const userDoc = await db.collection('users').doc(userId).get();
    const userName = userDoc.exists ? userDoc.data().name : '주인';

    // Doll 문서 생성
    const dollRef = await db.collection('dolls').add({
      userId,
      name: name.trim(),
      appearance,
      totalChats: 0,
      lastChatAt:  null,
      createdAt:   new Date(),
    });

    // 첫 인사 생성 (Gemini)
    const greeting = await generateDollGreeting(
      { name: name.trim() },
      userName
    );

    res.json({ dollId: dollRef.id, greeting });
  } catch (err) {
    console.error('Doll 생성 실패:', err);
    res.status(500).json({ message: 'Doll 생성 중 오류가 발생했어요' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/doll/me
// 현재 유저의 Doll 정보 반환
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', requireAuth, requireDB, async (req, res) => {
  const userId = req.user.uid;

  try {
    const snap = await db.collection('dolls')
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.json({ doll: null });
    }

    const doc  = snap.docs[0];
    const doll = { id: doc.id, ...doc.data() };

    // 유저의 isDeceased 상태도 포함 (사후 모드 체크용)
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      doll.isDeceased = userDoc.data().isDeceased === true;
    }

    res.json({ doll });
  } catch (err) {
    console.error('Doll 조회 실패:', err);
    res.status(500).json({ message: 'Doll 정보를 불러오는 데 실패했어요' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/doll/appearance
// Doll 외모 업데이트
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/appearance', requireAuth, requireDB, async (req, res) => {
  const { appearance } = req.body;
  const userId = req.user.uid;

  if (!appearance || typeof appearance !== 'object') {
    return res.status(400).json({ message: '외모 데이터가 필요합니다' });
  }

  try {
    const snap = await db.collection('dolls')
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({ message: 'Doll이 없어요' });
    }

    await snap.docs[0].ref.update({ appearance, updatedAt: new Date() });
    res.json({ ok: true });
  } catch (err) {
    console.error('외모 업데이트 실패:', err);
    res.status(500).json({ message: '저장 중 오류가 발생했어요' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/doll/last-message
// 생전에 미리 설정하는 마지막 메시지 (추모 모드에서 AI 인사 대신 표시)
// body: { message: string }
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/last-message', requireAuth, requireDB, async (req, res) => {
  const { message } = req.body;
  const userId = req.user.uid;

  if (typeof message !== 'string') {
    return res.status(400).json({ message: '메시지가 필요합니다' });
  }

  try {
    const snap = await db.collection('dolls')
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({ message: 'Doll이 없어요' });
    }

    await snap.docs[0].ref.update({ lastMessage: message.trim(), updatedAt: new Date() });
    res.json({ ok: true });
  } catch (err) {
    console.error('유언 메시지 저장 실패:', err);
    res.status(500).json({ message: '저장 중 오류가 발생했어요' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/doll/me/rename  ← 외형만 변경: 이름+외모만 갱신, 대화기록 보존
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/me/rename', requireAuth, requireDB, async (req, res) => {
  const { name, appearance } = req.body;
  const userId = req.user.uid;

  if (!name || !appearance) {
    return res.status(400).json({ message: '이름과 외모가 필요해요' });
  }

  try {
    const snap = await db.collection('dolls')
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({ message: 'Doll이 없어요' });
    }

    await snap.docs[0].ref.update({ name: name.trim(), appearance, updatedAt: new Date() });
    res.json({ ok: true });
  } catch (err) {
    console.error('Doll 외형 변경 실패:', err);
    res.status(500).json({ message: '저장 중 오류가 발생했어요' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/doll/me  ← 전체 초기화: Doll + dollChats + 자동추출 answers 삭제
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/me', requireAuth, requireDB, async (req, res) => {
  const userId = req.user.uid;

  try {
    const snap = await db.collection('dolls')
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(404).json({ message: 'Doll이 없어요' });
    }

    const dollId = snap.docs[0].id;
    const batch  = db.batch();

    const chatSnap = await db.collection('dollChats')
      .where('dollId', '==', dollId)
      .get();
    chatSnap.docs.forEach((d) => batch.delete(d.ref));

    const answersSnap = await db.collection('answers')
      .where('userId', '==', userId)
      .get();
    answersSnap.docs.forEach((d) => {
      if (d.data().type === 'extracted') batch.delete(d.ref);
    });

    batch.delete(snap.docs[0].ref);
    await batch.commit();

    res.json({ ok: true });
  } catch (err) {
    console.error('Doll 삭제 실패:', err);
    res.status(500).json({ message: '삭제 중 오류가 발생했어요' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/doll/greeting
// 오늘의 첫 인사 반환 (하루 1회 생성 후 캐싱)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/greeting', requireAuth, requireDB, async (req, res) => {
  const userId = req.user.uid;
  const lang   = req.query.lang === 'en' ? 'en' : 'ko';
  const today  = new Date().toISOString().split('T')[0];

  try {
    // 내 Doll 찾기
    const dollSnap = await db.collection('dolls')
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (dollSnap.empty) {
      return res.status(404).json({ message: 'Doll이 없어요' });
    }

    const dollDoc  = dollSnap.docs[0];
    const doll     = { id: dollDoc.id, ...dollDoc.data() };
    const cacheKey = `${doll.id}_${today}_${lang}`;

    // 오늘 캐시된 인사 확인
    const cacheSnap = await db.collection('dollGreetings').doc(cacheKey).get();
    if (cacheSnap.exists) {
      return res.json({ greeting: cacheSnap.data().greeting, cached: true });
    }

    // 없으면 새로 생성
    const [userDoc, answersSnap] = await Promise.all([
      db.collection('users').doc(userId).get(),
      db.collection('answers').where('userId', '==', userId).get(),
    ]);

    const userName = userDoc.exists ? userDoc.data().name : '주인';

    // 이미 물어본 기억 제외하고 후보 선정
    const askedAnswerIds = doll.askedAnswerIds || [];
    let candidates = answersSnap.docs
      .filter((d) => !askedAnswerIds.includes(d.id))
      .map((d) => ({
        id: d.id,
        questionText: d.data().questionText || '',
        content: Array.isArray(d.data().content)
          ? d.data().content.join(', ')
          : (d.data().content || ''),
      }));

    // 모두 소진했으면 전체 리셋
    if (candidates.length === 0 && answersSnap.docs.length > 0) {
      candidates = answersSnap.docs.map((d) => ({
        id: d.id,
        questionText: d.data().questionText || '',
        content: Array.isArray(d.data().content)
          ? d.data().content.join(', ')
          : (d.data().content || ''),
      }));
    }

    // 랜덤 셔플 후 최대 5개 선택
    const selected = candidates
      .sort(() => Math.random() - 0.5)
      .slice(0, 5);

    const greeting = await generateDollGreeting(doll, userName, selected, lang);

    // 캐시 저장 + askedAnswerIds 업데이트 (병렬)
    const newAskedIds = [...new Set([...askedAnswerIds, ...selected.map((a) => a.id)])];

    await Promise.all([
      db.collection('dollGreetings').doc(cacheKey).set({
        dollId: doll.id,
        userId,
        greeting,
        date: today,
        createdAt: new Date(),
      }),
      dollDoc.ref.update({ askedAnswerIds: newAskedIds }),
    ]);

    res.json({ greeting, cached: false });
  } catch (err) {
    console.error('인사 생성 실패:', err);
    res.status(500).json({ message: '인사 생성 중 오류가 발생했어요' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/doll/chat
// Doll에게 메시지 전송 → Gemini 응답 → dollChats에 저장
// body: { dollId, message }
//
// 대화 10개(유저 기준)마다 기억 자동 추출 → answers 컬렉션 저장
// ─────────────────────────────────────────────────────────────────────────────
router.post('/chat', requireAuth, requireDB, async (req, res) => {
  const { dollId, message, lang = 'ko' } = req.body;
  const userId = req.user.uid;
  const start  = Date.now();

  if (!dollId || !message?.trim()) {
    return res.status(400).json({ message: 'dollId와 message가 필요해요' });
  }

  try {
    console.log('=== DollChat 시작 ===');
    console.log('요청 body:', req.body);
    console.log('userId:', req.user.uid);

    // 1. Doll 정보 조회 (doll.userId 알아야 병렬 쿼리 가능)
    const dollDoc = await db.collection('dolls').doc(dollId).get();
    if (!dollDoc.exists) {
      return res.status(404).json({ message: 'Doll을 찾을 수 없어요' });
    }

    const doll       = { id: dollDoc.id, ...dollDoc.data() };
    const today      = new Date().toISOString().split('T')[0];
    const chatDocId  = `${dollId}_${today}`;
    const chatDocRef = db.collection('dollChats').doc(chatDocId);

    // 2. userDoc + chatSnap + answersSnap 병렬 조회 (직렬 → 병렬로 변경)
    const [userDoc, chatSnap, answersSnap] = await Promise.all([
      db.collection('users').doc(userId).get(),
      chatDocRef.get(),
      db.collection('answers')
        .where('userId', '==', doll.userId)
        .limit(20)
        .get(),
    ]);

    if (!userDoc.exists) {
      return res.status(404).json({ message: '유저를 찾을 수 없어요' });
    }

    const userData = userDoc.data();

    // 3. 접근 권한 확인 (유족인 경우 providerDoc + connSnap 병렬 조회)
    const isOwner = doll.userId === userId;
    if (!isOwner) {
      const [providerDoc, connSnap] = await Promise.all([
        db.collection('users').doc(doll.userId).get(),
        db.collection('connections')
          .where('providerId', '==', doll.userId)
          .where('familyId', '==', userId)
          .where('status', '==', 'accepted')
          .limit(1)
          .get(),
      ]);

      if (!providerDoc.exists || !providerDoc.data().isDeceased) {
        return res.status(403).json({ message: '접근 권한이 없어요' });
      }
      if (connSnap.empty) {
        return res.status(403).json({ message: '연결된 가족만 접근할 수 있어요' });
      }

      doll.isDeceased = true;
    } else {
      doll.isDeceased = userData.isDeceased === true;
    }

    const userName = userData.name || '주인';

    // 4. 오늘 대화 메시지 파싱
    let messages = chatSnap.exists ? (chatSnap.data().messages || []) : [];

    // 5. 최근 대화 쌍 구성 (AI 컨텍스트용) - 폴백 응답 제외
    const FALLBACK_PHRASES = [
      '잠깐... 잘 못 들었어',
      '잠깐 생각이 필요해',
      '잘 못 들었어. 다시 말해줄 수 있어?',
    ];
    const recentChats = [];
    for (let i = 0; i < messages.length - 1; i++) {
      if (messages[i].role === 'user' && messages[i + 1]?.role === 'doll') {
        const dollMsg = messages[i + 1].content;
        const isFallback = FALLBACK_PHRASES.some((p) => dollMsg.startsWith(p));
        if (!isFallback) {
          recentChats.push({ user: messages[i].content, doll: dollMsg });
        }
      }
    }

    // 6. answers 가공 (메모리 정렬은 chatWithDoll 내부에서 처리)
    const answers = answersSnap.docs.map((d) => ({
      questionText: d.data().questionText || '',
      content: Array.isArray(d.data().content)
        ? d.data().content.join(', ')
        : (d.data().content || ''),
    }));

    console.log('doll 정보:', doll ? `있음 (${doll.name})` : '없음');
    console.log('answers 개수:', answers.length);
    console.log('recentChats 개수:', recentChats.length);
    console.log('Gemini 호출 시작...');

    // 7. Gemini로 Doll 응답 생성 (lang에 따라 응답 언어 결정)
    const reply = await chatWithDoll(message.trim(), doll, userName, recentChats, answers, lang);

    console.log('Gemini 응답:', reply);
    console.log('=== DollChat 완료 ===');

    // 8. 메시지 배열에 추가
    const now = new Date();
    messages.push({ role: 'user', content: message.trim(), timestamp: now });
    messages.push({ role: 'doll', content: reply,          timestamp: now });

    // 9. Firestore 저장 + Doll 통계 업데이트 병렬 실행
    await Promise.all([
      chatDocRef.set({
        dollId,
        userId: doll.userId,
        date: today,
        messages,
        isMemoryExtracted: chatSnap.exists ? chatSnap.data().isMemoryExtracted : false,
        updatedAt: now,
      }, { merge: true }),
      db.collection('dolls').doc(dollId).update({
        totalChats: (doll.totalChats || 0) + 1,
        lastChatAt: now,
      }),
    ]);

    // 10. 응답 시간 로그
    const elapsed = Date.now() - start;
    console.log(`[DollChat] 총 응답시간: ${elapsed}ms | 기억: ${answers.length}개 | 대화: ${recentChats.length}쌍`);

    res.json({ reply });

    // 11. 유저 메시지 10개마다 기억 자동 추출 (응답 후 백그라운드 실행)
    const userMsgCount     = messages.filter((m) => m.role === 'user').length;
    const alreadyExtracted = chatSnap.exists ? chatSnap.data().isMemoryExtracted : false;

    if (userMsgCount >= 10 && !alreadyExtracted) {
      extractMemoryFromChat(messages)
        .then(async (extracted) => {
          for (const item of extracted) {
            if (item.question && item.answer) {
              await db.collection('answers').add({
                userId:       doll.userId,
                questionText: item.question,
                questionKey:  `extracted_${Date.now()}_${Math.random()}`,
                category:     'Doll 대화',
                type:         'extracted',
                content:      item.answer,
                isPrivate:    true,
                audioUrl:     '',
                createdAt:    new Date(),
              });
            }
          }
          await chatDocRef.update({ isMemoryExtracted: true });
        })
        .catch((extractErr) => {
          console.error('기억 추출 중 오류 (무시):', extractErr.message);
        });
    }
  } catch (err) {
    console.error('=== DollChat 에러 ===');
    console.error('에러 타입:', err.constructor.name);
    console.error('에러 메시지:', err.message);
    console.error('에러 스택:', err.stack);
    res.status(500).json({ message: '대화 중 오류가 발생했어요' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/doll/chat/today
// 오늘 대화 내역 반환
// query: ?dollId=xxx
// ─────────────────────────────────────────────────────────────────────────────
router.get('/chat/today', requireAuth, requireDB, async (req, res) => {
  const { dollId } = req.query;
  const userId     = req.user.uid;

  if (!dollId) {
    return res.status(400).json({ message: 'dollId가 필요해요' });
  }

  try {
    const today      = new Date().toISOString().split('T')[0];
    const chatDocRef = db.collection('dollChats').doc(`${dollId}_${today}`);
    const snap       = await chatDocRef.get();

    if (!snap.exists) {
      return res.json({ messages: [] });
    }

    res.json({ messages: snap.data().messages || [] });
  } catch (err) {
    console.error('오늘 대화 조회 실패:', err);
    res.status(500).json({ message: '대화 내역을 불러오는 데 실패했어요' });
  }
});

module.exports = router;
