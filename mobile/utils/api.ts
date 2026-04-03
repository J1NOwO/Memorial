// utils/api.ts - 백엔드 API 호출 헬퍼 (React Native)
//
// Firebase ID 토큰을 Authorization 헤더에 자동 포함.
// 모든 백엔드 API 호출은 이 함수를 통해 해.
//
// 환경변수 설정:
//   .env 파일에 EXPO_PUBLIC_API_URL=https://your-backend.com 추가
//   (Expo는 EXPO_PUBLIC_ 접두사 환경변수를 자동으로 번들에 포함)

import auth from '@react-native-firebase/auth';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export async function apiCall(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  endpoint: string,
  body: object | null = null,
): Promise<any> {
  // 현재 유저의 Firebase ID 토큰
  const token = await auth().currentUser?.getIdToken();

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, options);

  const contentType = res.headers.get('content-type');
  const data = contentType?.includes('application/json')
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    const message = typeof data === 'object' ? data.message : data;
    throw new Error(message || `API 오류: ${res.status}`);
  }

  return data;
}
