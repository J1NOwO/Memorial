// app/index.tsx - 인증 상태에 따라 라우팅
// 로그인 O + 프로필 완료 → (tabs)/index (대시보드)
// 로그인 O + 프로필 미완료 → (auth)/profile-setup
// 로그인 X → (auth)/landing

import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/colors';

export default function Index() {
  const { user, userProfile, loading } = useAuth();

  // 인증 상태 로딩 중 → 빈 화면 (스플래시 대체)
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  // 로그아웃 상태 → 랜딩
  if (!user) {
    return <Redirect href="/(auth)/landing" />;
  }

  // 로그인 O, 프로필 미완료 (role 없음) → 프로필 설정
  if (!userProfile?.role) {
    return <Redirect href="/(auth)/profile-setup" />;
  }

  // 로그인 O, 프로필 완료 → 대시보드
  return <Redirect href="/(tabs)" />;
}
