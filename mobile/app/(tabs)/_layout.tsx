// app/(tabs)/_layout.tsx - 탭 레이아웃
// 기본 탭바 숨기고 커스텀 BottomNav 사용
// BottomNav는 각 탭 화면에서 직접 렌더링 (화면별 SafeAreaView 내부 하단)

import { Tabs } from 'expo-router';
import BottomNav from '@/components/BottomNav';

export default function TabsLayout() {
  return (
    <Tabs
      // tabBar prop으로 커스텀 BottomNav 사용
      tabBar={() => <BottomNav />}
      screenOptions={{ headerShown: false }}
    />
  );
}
