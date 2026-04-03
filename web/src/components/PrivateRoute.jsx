// PrivateRoute: 로그인 + 프로필 설정 완료 여부를 확인하는 라우트 가드
//
// 미로그인 → /login 리다이렉트
// 로그인됐지만 birthDate 없음 → /profile-setup 리다이렉트 (단, 이미 /profile-setup이면 통과)

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function PrivateRoute({ children }) {
  const { user, userProfile } = useAuth();
  const location = useLocation();

  // 로그인 안 했으면 로그인 페이지로
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 프로필 설정이 안 된 경우 (생년월일 없음) → 프로필 설정 페이지로
  // /profile-setup 자체는 이 조건을 건너뜀 (무한 리다이렉트 방지)
  if (
    userProfile &&
    !userProfile.birthDate &&
    location.pathname !== '/profile-setup'
  ) {
    return <Navigate to="/profile-setup" replace />;
  }

  return children;
}

export default PrivateRoute;
