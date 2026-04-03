// routes/connections.js - 가족 연결 관련 API
//
// 엔드포인트:
//   GET  /api/connections              - 내 connections 목록 조회
//   POST /api/connections/join         - 초대 코드로 연결 요청
//   POST /api/connections/approve      - 연결 요청 승인 (제공자만)
//   POST /api/connections/reject       - 연결 요청 거절 (제공자만)
//   POST /api/connections/setTrust     - 신뢰 가족 지정 (제공자만)
//   POST /api/connections/updatePermission - 기억 열람 권한 변경 (제공자만)
//   POST /api/connections/deceased     - 사후 전환 (신뢰 가족만, 비가역적)

const express = require('express');
const router = express.Router();
const { db } = require('../firebase-admin');
const { requireAuth } = require('../middleware/auth');

// Firestore가 초기화 안 됐을 때 모든 요청에 503 반환하는 가드
function requireDB(req, res, next) {
  if (!db) {
    return res.status(503).json({ message: 'Firebase Admin이 설정되지 않았어요. backend/.env를 확인해주세요.' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/connections
// 현재 유저와 관련된 connections 목록 반환
// 제공자: 자신이 providerId인 connections
// 유족:   자신이 familyId인 connections
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', requireAuth, requireDB, async (req, res) => {
  try {
    const uid = req.user.uid;

    // 유저 프로필 조회해서 role 확인
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: '유저를 찾을 수 없어요' });
    }

    const { role } = userDoc.data();
    const field = role === 'provider' ? 'providerId' : 'familyId';

    const snapshot = await db.collection('connections')
      .where(field, '==', uid)
      .get();

    const connections = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ connections });
  } catch (err) {
    console.error('connections 조회 실패:', err);
    res.status(500).json({ message: '조회 중 오류가 발생했어요' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/connections/join
// 유족이 초대 코드를 입력해서 연결 요청 생성
// body: { inviteCode, relation }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/join', requireAuth, requireDB, async (req, res) => {
  const { inviteCode, relation } = req.body;
  const familyId = req.user.uid;

  if (!inviteCode || !relation) {
    return res.status(400).json({ message: '초대 코드와 관계를 입력해주세요' });
  }

  try {
    // 1. 초대 코드로 제공자 찾기
    const providerSnap = await db.collection('users')
      .where('inviteCode', '==', inviteCode.toUpperCase())
      .limit(1)
      .get();

    if (providerSnap.empty) {
      return res.status(404).json({ message: '유효하지 않은 초대 코드예요' });
    }

    const providerDoc = providerSnap.docs[0];
    const providerId  = providerDoc.id;
    const providerData = providerDoc.data();

    // 2. 본인 초대 코드로 가입하려는 경우 방지
    if (providerId === familyId) {
      return res.status(400).json({ message: '자신의 초대 코드로는 가입할 수 없어요' });
    }

    // 3. 이미 연결됐거나 요청 중인지 확인
    const existingSnap = await db.collection('connections')
      .where('providerId', '==', providerId)
      .where('familyId', '==', familyId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const status = existingSnap.docs[0].data().status;
      const msg = status === 'pending' ? '이미 연결 요청을 보냈어요' : '이미 연결된 분이에요';
      return res.status(409).json({ message: msg });
    }

    // 4. 유족 이름 가져오기
    const familyDoc = await db.collection('users').doc(familyId).get();
    const familyName = familyDoc.exists ? familyDoc.data().name : '이름 없음';

    // 5. connection 문서 생성 (pending 상태)
    const connectionRef = await db.collection('connections').add({
      providerId,
      familyId,
      familyName,
      providerName: providerData.name,
      relation,
      status: 'pending',
      isTrusted: false,
      canViewMemories: false,
      connectedAt: new Date(),
    });

    res.json({
      message: `${providerData.name}님에게 연결 요청을 보냈어요. 승인을 기다려주세요.`,
      connectionId: connectionRef.id,
    });
  } catch (err) {
    console.error('연결 요청 실패:', err);
    res.status(500).json({ message: '연결 요청 중 오류가 발생했어요' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/connections/approve
// 제공자가 연결 요청을 승인
// body: { connectionId }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/approve', requireAuth, requireDB, async (req, res) => {
  const { connectionId } = req.body;
  const uid = req.user.uid;

  if (!connectionId) {
    return res.status(400).json({ message: 'connectionId가 필요해요' });
  }

  try {
    const connRef = db.collection('connections').doc(connectionId);
    const connDoc = await connRef.get();

    if (!connDoc.exists) {
      return res.status(404).json({ message: '연결 요청을 찾을 수 없어요' });
    }

    // 요청자가 제공자인지 확인 (보안: 제공자만 승인 가능)
    if (connDoc.data().providerId !== uid) {
      return res.status(403).json({ message: '승인 권한이 없어요' });
    }

    await connRef.update({ status: 'accepted' });
    res.json({ message: '연결 요청을 승인했어요' });
  } catch (err) {
    console.error('승인 실패:', err);
    res.status(500).json({ message: '승인 중 오류가 발생했어요' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/connections/reject
// 제공자가 연결 요청을 거절 → 문서 삭제
// body: { connectionId }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/reject', requireAuth, requireDB, async (req, res) => {
  const { connectionId } = req.body;
  const uid = req.user.uid;

  if (!connectionId) {
    return res.status(400).json({ message: 'connectionId가 필요해요' });
  }

  try {
    const connRef = db.collection('connections').doc(connectionId);
    const connDoc = await connRef.get();

    if (!connDoc.exists) {
      return res.status(404).json({ message: '연결 요청을 찾을 수 없어요' });
    }

    if (connDoc.data().providerId !== uid) {
      return res.status(403).json({ message: '거절 권한이 없어요' });
    }

    await connRef.delete();
    res.json({ message: '연결 요청을 거절했어요' });
  } catch (err) {
    console.error('거절 실패:', err);
    res.status(500).json({ message: '거절 중 오류가 발생했어요' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/connections/setTrust
// 제공자가 신뢰 가족 1명 지정 (기존 신뢰 가족 자동 해제)
// body: { connectionId }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/setTrust', requireAuth, requireDB, async (req, res) => {
  const { connectionId } = req.body;
  const uid = req.user.uid;

  if (!connectionId) {
    return res.status(400).json({ message: 'connectionId가 필요해요' });
  }

  try {
    const connRef = db.collection('connections').doc(connectionId);
    const connDoc = await connRef.get();

    if (!connDoc.exists) {
      return res.status(404).json({ message: '연결을 찾을 수 없어요' });
    }

    const connData = connDoc.data();

    if (connData.providerId !== uid) {
      return res.status(403).json({ message: '권한이 없어요' });
    }

    if (connData.status !== 'accepted') {
      return res.status(400).json({ message: '승인된 연결에만 신뢰 가족을 지정할 수 있어요' });
    }

    // Firestore 배치: 기존 신뢰 가족 모두 해제 → 새로 지정
    const batch = db.batch();

    // 기존 신뢰 가족 해제
    const existingTrustSnap = await db.collection('connections')
      .where('providerId', '==', uid)
      .where('isTrusted', '==', true)
      .get();

    existingTrustSnap.docs.forEach((d) => {
      batch.update(d.ref, { isTrusted: false });
    });

    // 새 신뢰 가족 지정
    batch.update(connRef, { isTrusted: true });

    // users/{providerId}.trustedFamilyId 업데이트
    batch.update(db.collection('users').doc(uid), {
      trustedFamilyId: connData.familyId,
    });

    await batch.commit();

    res.json({
      message: `${connData.familyName}님을 신뢰 가족으로 지정했어요`,
      trustedFamilyId: connData.familyId,
    });
  } catch (err) {
    console.error('신뢰 가족 지정 실패:', err);
    res.status(500).json({ message: '신뢰 가족 지정 중 오류가 발생했어요' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/connections/updatePermission
// 제공자가 유족의 기억 열람 권한 변경
// body: { connectionId, canViewMemories }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/updatePermission', requireAuth, requireDB, async (req, res) => {
  const { connectionId, canViewMemories } = req.body;
  const uid = req.user.uid;

  if (!connectionId || typeof canViewMemories !== 'boolean') {
    return res.status(400).json({ message: 'connectionId와 canViewMemories(true/false)가 필요해요' });
  }

  try {
    const connRef = db.collection('connections').doc(connectionId);
    const connDoc = await connRef.get();

    if (!connDoc.exists) {
      return res.status(404).json({ message: '연결을 찾을 수 없어요' });
    }

    if (connDoc.data().providerId !== uid) {
      return res.status(403).json({ message: '권한이 없어요' });
    }

    await connRef.update({ canViewMemories });
    res.json({ message: `기억 열람 권한을 ${canViewMemories ? '허용' : '차단'}했어요` });
  } catch (err) {
    console.error('권한 변경 실패:', err);
    res.status(500).json({ message: '권한 변경 중 오류가 발생했어요' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/connections/deceased
// 신뢰 가족이 제공자를 사후 모드로 전환 (isDeceased = true)
//
// ⚠️ 비가역적 작업: 한 번 true로 바꾸면 다시 false로 돌릴 수 없어
//    - 보안 확인:
//      1. 요청자가 family role인지
//      2. 요청자가 해당 제공자의 trustedFamilyId인지
//      3. 아직 isDeceased=false인지 (중복 호출 방지)
//
// body: { providerId }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/deceased', requireAuth, requireDB, async (req, res) => {
  const { providerId } = req.body;
  const callerId = req.user.uid; // 요청을 보낸 유족의 uid

  if (!providerId) {
    return res.status(400).json({ message: 'providerId가 필요해요' });
  }

  try {
    // 1. 요청자(유족) 프로필 확인
    const callerDoc = await db.collection('users').doc(callerId).get();
    if (!callerDoc.exists) {
      return res.status(404).json({ message: '유저를 찾을 수 없어요' });
    }
    if (callerDoc.data().role !== 'family') {
      return res.status(403).json({ message: '유족 계정만 이 작업을 할 수 있어요' });
    }

    // 2. 제공자 프로필 확인
    const providerDoc = await db.collection('users').doc(providerId).get();
    if (!providerDoc.exists) {
      return res.status(404).json({ message: '제공자를 찾을 수 없어요' });
    }

    const providerData = providerDoc.data();

    // 3. 요청자가 이 제공자의 신뢰 가족인지 확인 (핵심 보안 체크)
    if (providerData.trustedFamilyId !== callerId) {
      return res.status(403).json({ message: '신뢰 가족만 이 작업을 할 수 있어요' });
    }

    // 4. 이미 사후 전환된 경우
    if (providerData.isDeceased === true) {
      return res.status(409).json({ message: '이미 사후 전환이 완료된 계정이에요' });
    }

    // 5. isDeceased = true 로 전환 (비가역적)
    await db.collection('users').doc(providerId).update({
      isDeceased: true,
      deceasedAt: new Date(),       // 전환 시각 기록
      deceasedBy: callerId,         // 누가 전환했는지 기록
    });

    res.json({
      message: '사후 전환이 완료되었어요. 이제 대화 기능이 활성화돼요.',
      deceasedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('사후 전환 실패:', err);
    res.status(500).json({ message: '사후 전환 중 오류가 발생했어요' });
  }
});

module.exports = router;
