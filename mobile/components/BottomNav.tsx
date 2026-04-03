// components/BottomNav.tsx - 하단 탭바
// 웹 BottomNav.jsx → React Native 변환
// useLocation/useNavigate → usePathname/useRouter (Expo Router)
// position:fixed → SafeAreaView + absolute
// env(safe-area-inset-bottom) → useSafeAreaInsets()

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useMemorial } from '@/context/MemorialContext';
import { useT } from '@/hooks/useT';
import { Colors } from '@/constants/colors';

export default function BottomNav() {
  const pathname   = usePathname();
  const router     = useRouter();
  const insets     = useSafeAreaInsets();
  const { userProfile } = useAuth();
  const { isMemorial }  = useMemorial();
  const t = useT();

  // ── 탭 정의 ─────────────────────────────────────────────────
  const TABS_PROVIDER = [
    { path: '/(tabs)',          icon: '🏠', label: t.nav_home },
    { path: '/(tabs)/doll',    icon: '🪆', label: t.nav_doll },
    { path: '/(tabs)/memories',icon: '📚', label: t.nav_memory },
    { path: '/(tabs)/diary',   icon: '📓', label: t.nav_diary },
    { path: '/(tabs)/shop',    icon: '💎', label: t.nav_shop },
    { path: '/(tabs)/family',  icon: '👨‍👩‍👧', label: t.nav_family },
  ];

  const TABS_PROVIDER_MEMORIAL = [
    { path: '/(tabs)',               icon: '🏠', label: t.nav_home },
    { path: '/(tabs)/doll',         icon: '🪆', label: t.nav_doll },
    { path: '/(tabs)/memories',     icon: '📚', label: t.nav_memory },
    { path: '/(tabs)/diary',        icon: '📓', label: t.nav_diary },
    { path: '/memorial-book',       icon: '🕯️', label: t.nav_memorial },
    { path: '/(tabs)/family',       icon: '👨‍👩‍👧', label: t.nav_family },
  ];

  const TABS_FAMILY = [
    { path: '/(tabs)',          icon: '🏠', label: t.nav_home },
    { path: '/(tabs)/memories',icon: '📚', label: t.nav_memory },
    { path: '/(tabs)/family',  icon: '👨‍👩‍👧', label: t.nav_family },
  ];

  const tabs = userProfile?.role === 'family'
    ? TABS_FAMILY
    : isMemorial ? TABS_PROVIDER_MEMORIAL : TABS_PROVIDER;

  // active 판정: doll 하위 경로도 doll 탭 active 처리
  function isActive(path: string) {
    if (path === '/(tabs)/doll') return pathname.startsWith('/doll') || pathname === '/(tabs)/doll';
    if (path === '/(tabs)')      return pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/index';
    return pathname === path || pathname.startsWith(path.replace('/(tabs)', ''));
  }

  const activeColor = isMemorial ? Colors.memorial.accent    : Colors.accent;
  const inactColor  = isMemorial ? Colors.memorial.textMuted : Colors.textMuted;
  const navBg       = isMemorial ? 'rgba(13,13,26,0.97)'     : 'rgba(255,253,249,0.96)';
  const borderColor = isMemorial ? '#2d2d4e'                 : Colors.borderLight;

  return (
    <View
      style={[
        S.nav,
        {
          backgroundColor:  navBg,
          borderTopColor:   borderColor,
          paddingBottom:    insets.bottom + 4,
        },
      ]}
    >
      {tabs.map((tab) => {
        const active = isActive(tab.path);
        return (
          <TouchableOpacity
            key={tab.path}
            onPress={() => router.push(tab.path as any)}
            style={S.tab}
            activeOpacity={0.7}
          >
            {/* 상단 인디케이터 */}
            {active && (
              <View style={[S.indicator, { backgroundColor: activeColor }]} />
            )}

            <Text style={[S.icon, !active && S.iconInactive]}>
              {tab.icon}
            </Text>
            <Text style={[S.label, { color: active ? activeColor : inactColor, fontWeight: active ? '700' : '500' }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const S = StyleSheet.create({
  nav: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingTop:     8,
  },
  tab: {
    flex:           1,
    alignItems:     'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    position:       'relative',
  },
  indicator: {
    position:     'absolute',
    top:          -8,
    width:        24,
    height:       3,
    borderRadius: 3,
  },
  icon: {
    fontSize:   22,
    lineHeight: 28,
  },
  iconInactive: {
    opacity: 0.55,
  },
  label: {
    fontSize:   10,
    marginTop:  2,
    lineHeight: 13,
  },
});
