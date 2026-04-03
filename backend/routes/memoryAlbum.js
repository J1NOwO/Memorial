// routes/memoryAlbum.js - 기억 앨범 API
//
// GET /api/memory-album/:userId
//   → 해당 유저의 answers 전체 반환 (오름차순)
//   → 권한: 본인 또는 연결된 가족(status=accepted)

const express = require('express');
const router  = express.Router();
const { db }  = require('../firebase-admin');
const { requireAuth } = require('../middleware/auth');

function requireDB(req, res, next) {
  if (!db) return res.status(503).json({ message: 'Firebase Admin이 설정되지 않았어요.' });
  next();
}

// ── GET /api/memory-album/:userId ─────────────────────────────────────────────
router.get('/:userId', requireAuth, requireDB, async (req, res) => {
  try {
    const { userId }  = req.params;
    const callerId    = req.user.uid;

    // 권한 체크: 본인이 아니면 연결된 가족 + canViewMemories 확인
    if (callerId !== userId) {
      let hasAccess = false;
      try {
        const connSnap = await db.collection('connections')
          .where('familyId',   '==', callerId)
          .where('providerId', '==', userId)
          .where('status',     '==', 'accepted')
          .get();
        hasAccess = connSnap.docs.some(d => d.data().canViewMemories === true);
      } catch {
        // 복합 인덱스 미생성 시 2-조건 폴백
        const connSnap = await db.collection('connections')
          .where('familyId',   '==', callerId)
          .where('providerId', '==', userId)
          .get();
        hasAccess = connSnap.docs.some(d =>
          d.data().status === 'accepted' && d.data().canViewMemories === true
        );
      }
      if (!hasAccess) {
        return res.status(403).json({ message: '접근 권한이 없어요.' });
      }
    }

    // answers 전체 조회 (오래된 기억부터)
    let answers = [];
    try {
      const snap = await db.collection('answers')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'asc')
        .get();
      answers = snap.docs.map(d => {
        const data = d.data();
        return {
          id:           d.id,
          questionText: data.questionText || '',
          content:      data.content,
          category:     data.category || '',
          type:         data.type || 'text',
          isPrivate:    data.isPrivate ?? true,
          createdAt:    data.createdAt?.toDate?.()?.toISOString() ?? null,
          updatedAt:    data.updatedAt?.toDate?.()?.toISOString() ?? null,
        };
      });
    } catch {
      // orderBy 인덱스 미생성 시 정렬 없이 로드 후 클라이언트 정렬
      const snap = await db.collection('answers')
        .where('userId', '==', userId)
        .get();
      answers = snap.docs
        .map(d => {
          const data = d.data();
          return {
            id:           d.id,
            questionText: data.questionText || '',
            content:      data.content,
            category:     data.category || '',
            type:         data.type || 'text',
            isPrivate:    data.isPrivate ?? true,
            createdAt:    data.createdAt?.toDate?.()?.toISOString() ?? null,
            updatedAt:    data.updatedAt?.toDate?.()?.toISOString() ?? null,
          };
        })
        .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    }

    // 카테고리별 개수
    const categoryCounts = {};
    answers.forEach(a => {
      const cat = a.category || '기타';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    res.json({ answers, categoryCounts, total: answers.length });
  } catch (err) {
    console.error('기억 앨범 조회 실패:', err);
    res.status(500).json({ message: '기억 앨범을 불러오는 데 실패했어요.' });
  }
});

module.exports = router;
