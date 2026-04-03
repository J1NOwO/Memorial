// utils/api.js - 백엔드 API 호출 헬퍼
//
// Firebase ID 토큰을 Authorization 헤더에 자동으로 포함시켜줘.
// 모든 백엔드 API 호출은 이 함수를 통해 해.
//
// 사용 예:
//   await apiCall('POST', '/api/connections/join', { inviteCode, relation });
//   await apiCall('GET', '/api/connections');

import { auth } from '../firebase';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function apiCall(method, endpoint, body = null) {
  // 1. 현재 로그인한 유저의 인증 토큰 가져오기
  const token = await auth.currentUser?.getIdToken();

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      // 토큰이 있으면 Authorization 헤더에 포함
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };

  // GET이 아닐 때만 body 포함
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, options);

  // 응답이 JSON이 아닌 경우 에러 처리
  const contentType = res.headers.get('content-type');
  const data = contentType?.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    // 서버에서 보낸 에러 메시지가 있으면 그걸 throw
    const message = typeof data === 'object' ? data.message : data;
    throw new Error(message || `API 오류: ${res.status}`);
  }

  return data;
}
