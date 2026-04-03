// firebase-admin.js - Firebase Admin SDK 초기화
//
// 백엔드에서 Firestore 접근 + Firebase Auth 토큰 검증에 사용해.
// 서비스 계정 키는 .env에서 읽어와 (절대 코드에 직접 넣으면 안 됨!)
//
// 서비스 계정 키 발급 방법:
//   Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
//   → JSON 파일에서 project_id, private_key, client_email 복사

const admin = require('firebase-admin');

// 이미 초기화됐으면 다시 초기화하지 않음 (서버 재시작 시 중복 방지)
if (!admin.apps.length) {
  // .env에서 서비스 계정 정보 읽기
  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'); // 줄바꿈 처리
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (!projectId || !privateKey || !clientEmail) {
    console.warn(
      '⚠️  Firebase Admin 환경변수가 설정되지 않았어요.\n' +
      '   backend/.env 파일에 FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL을 추가해주세요.'
    );
  } else {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, privateKey, clientEmail }),
    });
    console.log('✅ Firebase Admin 초기화 완료');
  }
}

// Admin이 초기화됐으면 db/auth 내보내기, 아니면 null
const db   = admin.apps.length ? admin.firestore() : null;
const auth = admin.apps.length ? admin.auth()      : null;

module.exports = { admin, db, auth };
