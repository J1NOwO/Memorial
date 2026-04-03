// middleware/auth.js - Firebase ID 토큰 검증 미들웨어
//
// API 요청의 Authorization 헤더에서 Bearer 토큰을 꺼내서
// Firebase Admin으로 검증하고, req.user에 유저 정보를 붙여줘.
//
// 사용 방법:
//   const { requireAuth } = require('../middleware/auth');
//   router.post('/join', requireAuth, async (req, res) => { ... });
//   // req.user.uid, req.user.email 사용 가능

const { auth } = require('../firebase-admin');

async function requireAuth(req, res, next) {
  // Firebase Admin이 초기화 안 됐으면 503 반환
  if (!auth) {
    return res.status(503).json({
      message: '백엔드 Firebase 설정이 필요해요. backend/.env를 확인해주세요.',
    });
  }

  const authHeader = req.headers.authorization;

  // Authorization 헤더 없으면 401
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: '로그인이 필요해요' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    // 토큰 검증 → 유저 정보 반환
    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken; // { uid, email, name, ... }
    next();
  } catch (err) {
    console.error('토큰 검증 실패:', err.message);
    return res.status(401).json({ message: '인증이 만료됐어요. 다시 로그인해주세요.' });
  }
}

module.exports = { requireAuth };
