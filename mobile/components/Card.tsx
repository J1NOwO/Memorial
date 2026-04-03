// components/Card.tsx - 공통 카드 컴포넌트
// 웹 Card.jsx → React Native 변환
// div → View, onClick → onPress

import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '@/constants/colors';

interface CardProps {
  children:  React.ReactNode;
  onPress?:  () => void;
  style?:    ViewStyle;
  padding?:  number;
  lift?:     boolean; // 터치 시 살짝 눌리는 효과
}

export default function Card({
  children,
  onPress,
  style,
  padding = 20,
  lift    = true,
}: CardProps) {
  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={lift ? 0.80 : 1}
        style={[S.card, { padding }, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[S.card, { padding }, style]}>
      {children}
    </View>
  );
}

const S = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius:    18,
    borderWidth:     1,
    borderColor:     Colors.borderLight,
    shadowColor:     Colors.primary,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.06,
    shadowRadius:    8,
    elevation:       2,
  },
});
