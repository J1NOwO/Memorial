// routes/chat.js - AI 페르소나 대화 API
//
// POST /api/chat
//   - 유족이 고인 AI와 대화
//   - 보안 조건:
//     1. 요청자가 family role
//     2. 연결된 제공자(provider)의 isDeceased === true
//     3. 해당 connection의 status === 'accepted'
//   - 고인의 answers를 메모리로 넘겨 Gemini가 페르소나 형성
//
// body: { providerId, message }

const express = require('express');
const router = express.Router();
const { db } = require('../firebase-admin');
const { requireAuth } = require('../middleware/auth');
const { chatAsPersona } = require('../services/aiService');

// Firestore 미초기화 가드
function requireDB(req, res, next) {
  if (!db) {
    return res.status(503).json({ message: 'Firebase Admin이 설정되지 않았어요. backend/.env를 확인해주세요.' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat
// 유족이 메시지를 보내면 Gemini가 고인처럼 답변
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', requireAuth, requireDB, async (req, res) => {
  const { providerId, message } = req.body;
  const familyId = req.user.uid;

  if (!providerId || !message?.trim()) {
    return res.status(400).json({ message: 'providerId와 message가 필요해요' });
  }

  try {
    // 1. 제공자 프로필 조회 (isDeceased 확인)
    const providerDoc = await db.collection('users').doc(providerId).get();
    if (!providerDoc.exists) {
      return res.status(404).json({ message: '제공자를 찾을 수 없어요' });
    }

    const providerData = providerDoc.data();

    // 2. 사후 전환 여부 확인 (핵심 보안 체크)
    if (!providerData.isDeceased) {
      return res.status(403).json({ message: '사후 전환 후에만 대화할 수 있어요' });
    }

    // 3. 요청자와 제공자 간 accepted 연결이 있는지 확인
    const connSnap = await db.collection('connections')
      .where('providerId', '==', providerId)
      .where('familyId', '==', familyId)
      .where('status', '==', 'accepted')
      .limit(1)
      .get();

    if (connSnap.empty) {
      return res.status(403).json({ message: '연결된 가족만 대화할 수 있어요' });
    }

    // 4. 고인의 답변 목록 가져오기 (페르소나 형성용)
    //    - isPrivate=false인 것은 항상 포함
    //    - isPrivate=true인 것도 사후에는 포함 (이미 isDeceased=true 확인함)
    const answersSnap = await db.collection('answers')
      .where('userId', '==', providerId)
      .orderBy('createdAt', 'asc')
      .get();

    const memories = answersSnap.docs.map((d) => {
      const data = d.data();
      return {
        questionText: data.questionText || '',
        content: Array.isArray(data.content)
          ? data.content.join(', ')   // 태그 타입이면 문자열로 합치기
          : (data.content || ''),
        category: data.category || '',
      };
    });

    // 5. Gemini로 페르소나 대화 생성
    const persona = { name: providerData.name };
    const reply = await chatAsPersona(message.trim(), persona, memories);

    res.json({ reply });
  } catch (err) {
    console.error('AI 대화 실패:', err);
    res.status(500).json({ message: '대화 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.' });
  }
});

module.exports = router;
