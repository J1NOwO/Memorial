// components/MemorialBanner.tsx - 추모 모드 배너
// 추모 모드 활성화 시 화면 상단에 표시되는 배너
// 방명록 바로가기 포함

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useT } from '@/hooks/useT';
import { Colors } from '@/constants/colors';

interface MemorialBannerProps {
  providerName?: string;
  /** 방명록 바로가기 버튼 숨기기 (이미 방명록 페이지면 true) */
  hideBookBtn?: boolean;
}

export default function MemorialBanner({
  providerName,
  hideBookBtn = false,
}: MemorialBannerProps) {
  const router = useRouter();
  const t      = useT();

  return (
    <View style={S.banner}>
      {/* 왼쪽 촛불 장식 */}
      <Text style={S.candle}>🕯️</Text>

      <View style={S.body}>
        <Text style={S.title}>
          {providerName ? `† ${providerName}` : `† ${t.memorial_mode}`}
        </Text>
        <Text style={S.sub}>{t.rip_message}</Text>
      </View>

      {/* 방명록 바로가기 */}
      {!hideBookBtn && (
        <TouchableOpacity
          style={S.bookBtn}
          onPress={() => router.push('/memorial-book' as any)}
        >
          <Text style={S.bookBtnText}>{t.memorial_book} →</Text>
        </TouchableOpacity>
      )}

      {/* 오른쪽 촛불 장식 */}
      <Text style={S.candle}>🕯️</Text>
    </View>
  );
}

const S = StyleSheet.create({
  banner: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  Colors.memorial.accentPale,
    borderBottomWidth: 1,
    borderBottomColor: Colors.memorial.border,
    paddingVertical:   10,
    paddingHorizontal: 16,
    gap:               10,
  },
  candle: { fontSize: 18 },
  body:   { flex: 1 },
  title:  {
    fontSize:    14,
    fontWeight:  '700',
    color:       Colors.memorial.text,
    letterSpacing: 0.5,
  },
  sub:    {
    fontSize: 11,
    color:    Colors.memorial.textMuted,
    marginTop: 2,
  },
  bookBtn: {
    paddingVertical:   5,
    paddingHorizontal: 10,
    borderRadius:      8,
    borderWidth:       1,
    borderColor:       Colors.memorial.accent,
  },
  bookBtnText: {
    fontSize:   11,
    color:      Colors.memorial.accent,
    fontWeight: '600',
  },
});
