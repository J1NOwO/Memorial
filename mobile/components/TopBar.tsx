// components/TopBar.tsx - 상단 헤더 (뒤로가기 + 타이틀 + 💎 재화 표시)
// 웹 TopBar.jsx → React Native 변환
// sticky/position:fixed → 각 화면 최상단에 배치
// env(safe-area-inset-top) → useSafeAreaInsets()

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '@/context/AuthContext';
import { useMemorial } from '@/context/MemorialContext';
import { useT } from '@/hooks/useT';
import { Colors } from '@/constants/colors';

interface TopBarProps {
  title?:         string;
  onBack?:        () => void;
  rightIcon?:     React.ReactNode;
  onRightPress?:  () => void;
  noBorder?:      boolean;
}

export default function TopBar({
  title,
  onBack,
  rightIcon,
  onRightPress,
  noBorder,
}: TopBarProps) {
  const { userProfile } = useAuth();
  const { isMemorial }  = useMemorial();
  const t               = useT();
  const insets          = useSafeAreaInsets();
  const gems            = userProfile?.gems ?? null;

  return (
    <View
      style={[
        S.header,
        { paddingTop: insets.top + 8 },
        isMemorial && S.headerMemorial,
        noBorder   && S.noBorder,
      ]}
    >
      {/* 왼쪽: 뒤로가기 */}
      <View style={S.side}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={S.iconBtn} accessibilityLabel={t.aria_back}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M19 12H5M12 5l-7 7 7 7"
                stroke={isMemorial ? Colors.memorial.text : Colors.textMid}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            </Svg>
          </TouchableOpacity>
        )}
      </View>

      {/* 중앙: 타이틀 */}
      <Text style={[S.title, isMemorial && S.titleMemorial]} numberOfLines={1}>
        {title}
      </Text>

      {/* 오른쪽: 커스텀 아이콘 or 💎 재화 */}
      <View style={[S.side, S.sideRight]}>
        {onRightPress ? (
          <TouchableOpacity onPress={onRightPress} style={S.iconBtn} accessibilityLabel={t.aria_menu}>
            {rightIcon ?? <Text style={S.moreIcon}>⋯</Text>}
          </TouchableOpacity>
        ) : gems !== null ? (
          <View style={[S.gemsBadge, isMemorial && S.gemsBadgeMemorial]}>
            <Text style={S.gemEmoji}>💎</Text>
            <Text style={[S.gemsNum, isMemorial && S.gemsNumMemorial]}>{gems}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingBottom:   12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,253,249,0.97)',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerMemorial: {
    backgroundColor:   'rgba(22,33,62,0.97)',
    borderBottomColor: '#2d2d4e',
  },
  noBorder: {
    borderBottomWidth: 0,
    shadowOpacity:     0,
    elevation:         0,
  },

  side:      { width: 60, flexDirection: 'row', alignItems: 'center' },
  sideRight: { justifyContent: 'flex-end' },

  iconBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreIcon: {
    fontSize: 18,
    color: Colors.textMid,
    lineHeight: 20,
  },

  title: {
    flex:          1,
    textAlign:     'center',
    fontSize:      17,
    fontWeight:    '600',
    color:         Colors.primary,
    letterSpacing: 0.5,
  },
  titleMemorial: {
    color: Colors.memorial.text,
  },

  gemsBadge: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            4,
    backgroundColor: Colors.accentPale,
    borderWidth:    1.5,
    borderColor:    Colors.accentLight,
    borderRadius:   20,
    paddingVertical:   5,
    paddingHorizontal: 10,
  },
  gemsBadgeMemorial: {
    backgroundColor: Colors.memorial.accentPale,
    borderColor:     Colors.memorial.accent,
  },
  gemEmoji: { fontSize: 13, lineHeight: 16 },
  gemsNum: {
    fontSize:   13,
    fontWeight: '800',
    color:      Colors.accent,
    lineHeight: 16,
  },
  gemsNumMemorial: {
    color: Colors.memorial.accent,
  },
});
