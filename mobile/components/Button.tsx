// components/Button.tsx - 공통 버튼 (primary / secondary / ghost)
// 웹 Button.jsx → React Native 변환
// onClick → onPress, button → TouchableOpacity

import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors } from '@/constants/colors';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?:  Variant;
  size?:     Size;
  onPress?:  () => void;
  disabled?: boolean;
  loading?:  boolean;
  fullWidth?: boolean;
  style?:    ViewStyle;
  textStyle?: TextStyle;
  children:  React.ReactNode;
}

export default function Button({
  variant   = 'primary',
  size      = 'md',
  onPress,
  disabled,
  loading,
  fullWidth,
  style,
  textStyle,
  children,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[
        S.base,
        S[variant],
        S[`size_${size}`],
        fullWidth && S.fullWidth,
        isDisabled && S.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'ghost' ? Colors.textMid : Colors.white}
        />
      ) : (
        <Text style={[S.text, S[`text_${variant}`], S[`textSize_${size}`], textStyle]}>
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  base: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   14,
  },

  // ── variant ──────────────────────────────────────
  primary: {
    backgroundColor: Colors.primary,
    shadowColor:     Colors.primary,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.25,
    shadowRadius:    8,
    elevation:       4,
  },
  secondary: {
    backgroundColor: Colors.accent,
    shadowColor:     Colors.accent,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.35,
    shadowRadius:    8,
    elevation:       4,
  },
  ghost: {
    backgroundColor: Colors.transparent,
    borderWidth:     1.5,
    borderColor:     Colors.border,
  },

  // ── size ─────────────────────────────────────────
  size_sm: { paddingVertical: 9,  paddingHorizontal: 16 },
  size_md: { paddingVertical: 14, paddingHorizontal: 24 },
  size_lg: { paddingVertical: 17, paddingHorizontal: 28 },

  // ── misc ─────────────────────────────────────────
  fullWidth: { width: '100%' },
  disabled:  { opacity: 0.5 },

  // ── text ─────────────────────────────────────────
  text: {
    fontWeight:    '700',
    letterSpacing: 0.3,
  },
  text_primary:   { color: Colors.card },
  text_secondary: { color: Colors.white },
  text_ghost:     { color: Colors.textMid },

  textSize_sm: { fontSize: 13 },
  textSize_md: { fontSize: 15 },
  textSize_lg: { fontSize: 16 },
});
