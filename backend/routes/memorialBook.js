// routes/memorialBook.js - 추모 방명록 API
//
// GET    /api/memorial-book/:providerId        - 방명록 목록 (최신순)
// POST   /api/memorial-book/:providerId        - 방명록 작성
// DELETE /api/memorial-book/:providerId/:messageId - 본인 글 삭제

const express = require('express');
const router  = express.Router();
const { db }  = require('../firebase-admin');
const { requireAuth } = require('../middleware/auth');

function requireDB(req, res, next) {
  if (!db) return res.status(503).json({ message: 'Firebase Admin이 설정되지 않았어요.' });
  next();
}

// ── GET /api/memorial-book/:providerId ────────────────────────────────────────
router.get('/:providerId', requireAuth, requireDB, async (req, res) => {
  try {
    const { providerId } = req.params;
    const snap = await db
      .collection('memorialBook').doc(providerId)
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .get();

    const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ messages });
  } catch (err) {
    console.error('방명록 조회 실패:', err);
    res.status(500).json({ message: '방명록을 불러오는 데 실패했어요.' });
  }
});

// ── POST /api/memorial-book/:providerId ───────────────────────────────────────
router.post('/:providerId', requireAuth, requireDB, async (req, res) => {
  try {
    const uid          = req.user.uid;
    const { providerId } = req.params;
    const { content }  = req.body;

    if (!content?.trim()) return res.status(400).json({ message: '내용을 입력해주세요.' });
    if (content.length > 200) return res.status(400).json({ message: '200자 이내로 작성해주세요.' });

    // 작성자 정보 조회
    const userDoc = await db.collection('users').doc(uid).get();
    const authorName = userDoc.exists ? (userDoc.data().name || '익명') : '익명';

    const ref = await db
      .collection('memorialBook').doc(providerId)
      .collection('messages')
      .add({
        authorId:   uid,
        authorName,
        content:    content.trim(),
        providerId,
        createdAt:  new Date(),
      });

    res.json({ id: ref.id, authorId: uid, authorName, content: content.trim() });
  } catch (err) {
    console.error('방명록 작성 실패:', err);
    res.status(500).json({ message: '작성 중 오류가 발생했어요.' });
  }
});

// ── DELETE /api/memorial-book/:providerId/:messageId ──────────────────────────
router.delete('/:providerId/:messageId', requireAuth, requireDB, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { providerId, messageId } = req.params;

    const msgRef = db
      .collection('memorialBook').doc(providerId)
      .collection('messages').doc(messageId);

    const snap = await msgRef.get();
    if (!snap.exists) return res.status(404).json({ message: '메시지를 찾을 수 없어요.' });
    if (snap.data().authorId !== uid) return res.status(403).json({ message: '본인 글만 삭제할 수 있어요.' });

    await msgRef.delete();
    res.json({ success: true });
  } catch (err) {
    console.error('방명록 삭제 실패:', err);
    res.status(500).json({ message: '삭제 중 오류가 발생했어요.' });
  }
});

module.exports = router;
