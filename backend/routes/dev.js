// routes/dev.js - 개발자 모드 전용 API
// ⚠️ 프로덕션에서는 이 라우트를 비활성화해야 합니다

const express = require('express');
const router  = express.Router();
const { db }  = require('../firebase-admin');
const { requireAuth } = require('../middleware/auth');
const Groq = require('groq-sdk');
const {
  generateDailyQuestions,
  chatWithDoll,
  extractMemoryFromChat,
} = require('../services/aiService');

const CATEGORIES = ['추억', '가치관', '말투·성격', '가족에게', '인생 조언'];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dev/user-info  – 유저 전체 통계
// ─────────────────────────────────────────────────────────────────────────────
router.get('/user-info', requireAuth, async (req, res) => {
  const userId = req.user.uid;
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data() || {};

    const [answersSnap, dollSnap, connSnap] = await Promise.all([
      db.collection('answers').where('userId', '==', userId).get(),
      db.collection('dolls').where('userId', '==', userId).limit(1).get(),
      db.collection('connections').where('providerId', '==', userId).get(),
    ]);

    let dollChatsCount = 0;
    if (!dollSnap.empty) {
      const dollId = dollSnap.docs[0].id;
      const chatSnap = await db.collection('dollChats').where('dollId', '==', dollId).get();
      dollChatsCount = chatSnap.size;
    }

    res.json({
      userId,
      email:         userData.email,
      role:          userData.role,
      gems:          userData.gems ?? 0,
      categoryIndex: userData.categoryIndex ?? 0,
      isDeceased:    userData.isDeceased ?? false,
      gender:        userData.gender,
      answersCount:  answersSnap.size,
      dollChatsCount,
      connectionsCount: connSnap.size,
      hasDoll: !dollSnap.empty,
      dollId:  dollSnap.empty ? null : dollSnap.docs[0].id,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dev/toggle-deceased  – isDeceased 토글
// ─────────────────────────────────────────────────────────────────────────────
router.post('/toggle-deceased', requireAuth, async (req, res) => {
  const userId = req.user.uid;
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const current = userDoc.data()?.isDeceased ?? false;
    await db.collection('users').doc(userId).update({ isDeceased: !current });
    res.json({ ok: true, isDeceased: !current });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dev/add-gems  – gems 변경 { amount: number (음수=차감, 0=초기화) }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/add-gems', requireAuth, async (req, res) => {
  const userId = req.user.uid;
  const { amount } = req.body;
  try {
    if (amount === 0) {
      await db.collection('users').doc(userId).update({ gems: 0 });
      res.json({ ok: true, gems: 0 });
    } else {
      const userDoc = await db.collection('users').doc(userId).get();
      const current = userDoc.data()?.gems ?? 0;
      const next    = Math.max(0, current + amount);
      await db.collection('users').doc(userId).update({ gems: next });
      res.json({ ok: true, gems: next });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dev/reset-category  – categoryIndex 리셋 + 오늘 캐시 삭제
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reset-category', requireAuth, async (req, res) => {
  const userId = req.user.uid;
  const today  = new Date().toISOString().split('T')[0];
  try {
    await db.collection('users').doc(userId).update({ categoryIndex: 0 });
    const cacheRef = db.collection('dailyQuestions').doc(`${userId}_${today}`);
    const cacheSnap = await cacheRef.get();
    if (cacheSnap.exists) await cacheRef.delete();
    res.json({ ok: true, message: '카테고리 인덱스 리셋 + 오늘 캐시 삭제됨' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dev/clear-today-answers  – 오늘 답변 삭제
// ─────────────────────────────────────────────────────────────────────────────
router.post('/clear-today-answers', requireAuth, async (req, res) => {
  const userId = req.user.uid;
  const today  = new Date().toISOString().split('T')[0];
  try {
    const snap = await db.collection('answers').where('userId', '==', userId).get();
    const batch = db.batch();
    let count = 0;
    snap.docs.forEach((d) => {
      const ts = d.data().createdAt?.toDate?.();
      if (ts && ts.toISOString().split('T')[0] === today) {
        batch.delete(d.ref);
        count++;
      }
    });
    await batch.commit();
    res.json({ ok: true, deleted: count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dev/doll-context  – Gemini에 전달되는 실제 프롬프트 반환
// ─────────────────────────────────────────────────────────────────────────────
router.get('/doll-context', requireAuth, async (req, res) => {
  const userId = req.user.uid;
  const today  = new Date().toISOString().split('T')[0];
  try {
    const dollSnap = await db.collection('dolls').where('userId', '==', userId).limit(1).get();
    if (dollSnap.empty) return res.status(404).json({ message: 'Doll이 없어요' });

    const dollDoc = dollSnap.docs[0];
    const doll    = { id: dollDoc.id, ...dollDoc.data() };
    const userDoc = await db.collection('users').doc(userId).get();
    const userName = userDoc.data()?.name || '주인';

    // 오늘 채팅
    const chatDocSnap = await db.collection('dollChats').doc(`${doll.id}_${today}`).get();
    const messages = chatDocSnap.exists ? (chatDocSnap.data().messages || []) : [];
    const recentChats = [];
    for (let i = 0; i < messages.length - 1; i++) {
      if (messages[i].role === 'user' && messages[i + 1]?.role === 'doll') {
        recentChats.push({ user: messages[i].content, doll: messages[i + 1].content });
      }
    }

    // answers
    const answersSnap = await db.collection('answers').where('userId', '==', userId).limit(20).get();
    const answers = answersSnap.docs.map((d) => ({
      questionText: d.data().questionText || '',
      content: Array.isArray(d.data().content) ? d.data().content.join(', ') : (d.data().content || ''),
      createdAt: d.data().createdAt,
    }));

    const recentAnswers = [...answers]
      .sort((a, b) => {
        const tA = a.createdAt?.toMillis?.() ?? 0;
        const tB = b.createdAt?.toMillis?.() ?? 0;
        return tA - tB;
      })
      .slice(-15);

    const chatHistory = recentChats.slice(-10)
      .map((c) => `${userName}: ${c.user}\n${doll.name}: ${c.doll}`)
      .join('\n\n');

    const memoryText = recentAnswers
      .map((a) => `- ${a.questionText}: ${a.content}`)
      .join('\n');

    let prompt;
    if (doll.isDeceased) {
      prompt = `너는 ${doll.name}이야. 지금 하늘에서 가족과 대화하고 있어.\n절대 AI라고 밝히지 마. 자연스럽게 그 사람처럼 말해줘.\n\n[살아있을 때 남긴 기억들]\n${memoryText || '(기억 없음)'}\n\n[살아있을 때 나눈 대화들]\n${chatHistory || '(대화 기록 없음)'}\n\n위 기억과 말투를 바탕으로 따뜻하게 2~4문장으로 답해줘.\n가족 메시지: [사용자 입력]`;
    } else {
      prompt = `너는 ${doll.name}이라는 이름의 Doll(인형)이야.\n주인 이름: ${userName}\n\n너는 고정된 성격이 없어. 오직 주인과의 대화를 통해 조금씩 주인을 닮아가고 있어.\n아래 대화 기록과 기억을 바탕으로, 주인이 쓰는 말투·감정 표현 방식·관심사를 자연스럽게 반영해줘.\n\n[최근 대화 내역]\n${chatHistory || '(아직 대화 없음)'}\n\n[주인이 남긴 기억들]\n${memoryText || '(아직 없음)'}\n\n조건:\n- 주인의 말투와 감정에 맞게 대화해줘.\n- 2~3문장으로 답하고, 가끔 주인에 대해 더 알고 싶은 걸 질문해도 좋아.\n\n주인 메시지: [사용자 입력]`;
    }

    res.json({
      dollName: doll.name,
      isDeceased: doll.isDeceased,
      memoryCount: recentAnswers.length,
      chatPairsCount: recentChats.length,
      prompt,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dev/force-extract  – 오늘 채팅에서 기억 강제 추출
// ─────────────────────────────────────────────────────────────────────────────
router.post('/force-extract', requireAuth, async (req, res) => {
  const userId = req.user.uid;
  const today  = new Date().toISOString().split('T')[0];
  try {
    const dollSnap = await db.collection('dolls').where('userId', '==', userId).limit(1).get();
    if (dollSnap.empty) return res.status(404).json({ message: 'Doll이 없어요' });

    const dollId = dollSnap.docs[0].id;
    const chatDocSnap = await db.collection('dollChats').doc(`${dollId}_${today}`).get();
    if (!chatDocSnap.exists) return res.status(404).json({ message: '오늘 대화 없음' });

    const messages = chatDocSnap.data().messages || [];
    if (messages.filter((m) => m.role === 'user').length < 2) {
      return res.status(400).json({ message: '대화가 너무 짧아요 (유저 메시지 2개 이상 필요)' });
    }

    const extracted = await extractMemoryFromChat(messages);
    let saved = 0;
    for (const item of extracted) {
      if (item.question && item.answer) {
        await db.collection('answers').add({
          userId,
          questionText: item.question,
          questionKey:  `extracted_dev_${Date.now()}_${Math.random()}`,
          category:     'Doll 대화',
          type:         'extracted',
          content:      item.answer,
          isPrivate:    true,
          audioUrl:     '',
          createdAt:    new Date(),
        });
        saved++;
      }
    }
    await chatDocSnap.ref.update({ isMemoryExtracted: true });
    res.json({ ok: true, extracted: extracted.length, saved });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dev/clear-doll-chats  – dollChats 전체 삭제
// ─────────────────────────────────────────────────────────────────────────────
router.post('/clear-doll-chats', requireAuth, async (req, res) => {
  const userId = req.user.uid;
  try {
    const dollSnap = await db.collection('dolls').where('userId', '==', userId).limit(1).get();
    if (dollSnap.empty) return res.status(404).json({ message: 'Doll이 없어요' });

    const dollId = dollSnap.docs[0].id;
    const chatSnap = await db.collection('dollChats').where('dollId', '==', dollId).get();
    const batch = db.batch();
    chatSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    await dollSnap.docs[0].ref.update({ totalChats: 0, lastChatAt: null });
    res.json({ ok: true, deleted: chatSnap.size });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dev/test-gemini  – Groq(AI) 연결 테스트
// ─────────────────────────────────────────────────────────────────────────────
router.post('/test-gemini', requireAuth, async (req, res) => {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: '안녕. 한 문장으로만 응답해줘.' }],
      max_tokens: 64,
    });
    const text = completion.choices[0]?.message?.content?.trim();
    res.json({ ok: true, response: text });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dev/generate-question  – 카테고리 지정해서 질문 즉시 생성
// body: { category: '추억' | '가치관' | ... }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/generate-question', requireAuth, async (req, res) => {
  const { category } = req.body;
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ message: `카테고리는 ${CATEGORIES.join(', ')} 중 하나여야 해요` });
  }
  try {
    const questions = await generateDailyQuestions([category], []);
    res.json({ ok: true, question: questions[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dev/test-chat  – 샘플 기억 3개로 퍼소나 대화 테스트
// ─────────────────────────────────────────────────────────────────────────────
router.post('/test-chat', requireAuth, async (req, res) => {
  const userId = req.user.uid;
  try {
    const dollSnap = await db.collection('dolls').where('userId', '==', userId).limit(1).get();
    if (dollSnap.empty) return res.status(404).json({ message: 'Doll이 없어요' });
    const doll = { id: dollSnap.docs[0].id, ...dollSnap.docs[0].data() };
    const userDoc = await db.collection('users').doc(userId).get();
    const userName = userDoc.data()?.name || '주인';

    const sampleAnswers = [
      { questionText: '가장 좋아하는 음식은?', content: '삼겹살이랑 된장찌개' },
      { questionText: '취미가 뭐야?', content: '산책이랑 독서' },
      { questionText: '요즘 기분은?', content: '요즘 많이 바빠서 좀 지침' },
    ];

    const reply = await chatWithDoll('안녕! 오늘 어때?', doll, userName, [], sampleAnswers);
    res.json({ ok: true, reply, sampleAnswers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dev/nuke  – 위험: 테스트 계정 전체 초기화
// ─────────────────────────────────────────────────────────────────────────────
router.post('/nuke', requireAuth, async (req, res) => {
  const userId = req.user.uid;
  try {
    const batch = db.batch();

    // answers
    const answersSnap = await db.collection('answers').where('userId', '==', userId).get();
    answersSnap.docs.forEach((d) => batch.delete(d.ref));

    // diaries
    const diariesSnap = await db.collection('diaries').where('userId', '==', userId).get();
    diariesSnap.docs.forEach((d) => batch.delete(d.ref));

    // dailyQuestions
    const dqSnap = await db.collection('dailyQuestions').where('userId', '==', userId).get();
    dqSnap.docs.forEach((d) => batch.delete(d.ref));

    // dolls + dollChats
    const dollSnap = await db.collection('dolls').where('userId', '==', userId).get();
    for (const d of dollSnap.docs) {
      const chatSnap = await db.collection('dollChats').where('dollId', '==', d.id).get();
      chatSnap.docs.forEach((c) => batch.delete(c.ref));
      batch.delete(d.ref);
    }

    // user fields 리셋 (계정 자체는 유지)
    batch.update(db.collection('users').doc(userId), {
      gems: 0,
      categoryIndex: 0,
      isDeceased: false,
    });

    await batch.commit();
    res.json({ ok: true, message: '전체 데이터 초기화 완료' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/dev/reset-name-inheritance  – 이름 계승 애니메이션 초기화 (다시보기)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reset-name-inheritance', requireAuth, async (req, res) => {
  const userId = req.user.uid;
  try {
    await db.collection('users').doc(userId).update({ nameInheritanceShown: false });
    res.json({ ok: true, message: '이름 계승 애니메이션 초기화됨' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
