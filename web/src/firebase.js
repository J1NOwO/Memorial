// Firebase 설정 파일
// .env 파일에서 환경변수를 읽어서 Firebase를 초기화해
// Vite에서는 환경변수 이름이 반드시 VITE_ 로 시작해야 해

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase 프로젝트 설정값 (모두 .env 파일에서 가져옴)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

// 각 Firebase 서비스 초기화 및 내보내기
export const auth = getAuth(app);           // 로그인/회원가입
export const db = getFirestore(app);        // 데이터베이스
export const storage = getStorage(app);     // 파일 저장 (음성, 사진)
export const googleProvider = new GoogleAuthProvider(); // Google 로그인

export default app;
