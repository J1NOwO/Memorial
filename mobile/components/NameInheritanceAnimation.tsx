// components/NameInheritanceAnimation.tsx - 이름 계승 애니메이션
// 추모 모드 첫 진입 시 재생되는 풀스크린 애니메이션
// react-native-reanimated 사용

import React, { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withSequence, Easing,
} from 'react-native-reanimated';
import { useT } from '@/hooks/useT';
import { Colors } from '@/constants/colors';
import StarField from './StarField';

const { width: W, height: H } = Dimensions.get('window');

interface NameInheritanceAnimationProps {
  providerName: string;
  onComplete: () => void;
}

export default function NameInheritanceAnimation({
  providerName,
  onComplete,
}: NameInheritanceAnimationProps) {
  const t = useT();

  const bgOpacity   = useSharedValue(0);
  const nameOpacity = useSharedValue(0);
  const nameScale   = useSharedValue(0.8);
  const text1Opacity= useSharedValue(0);
  const text2Opacity= useSharedValue(0);
  const candleScale = useSharedValue(0.5);
  const candleOpacity = useSharedValue(0);

  useEffect(() => {
    // 시퀀스 애니메이션
    bgOpacity.value = withTiming(1, { duration: 1200 });

    // 촛불 등장
    candleOpacity.value = withDelay(600, withTiming(1, { duration: 800 }));
    candleScale.value   = withDelay(600, withTiming(1, {
      duration: 800, easing: Easing.out(Easing.back(2)),
    }));

    // 이름 등장
    nameOpacity.value = withDelay(1400, withTiming(1, { duration: 1000 }));
    nameScale.value   = withDelay(1400, withTiming(1, {
      duration: 1000, easing: Easing.out(Easing.back(1.5)),
    }));

    // 텍스트 등장
    text1Opacity.value = withDelay(2600, withTiming(1, { duration: 800 }));
    text2Opacity.value = withDelay(3400, withTiming(1, { duration: 800 }));

    // 8초 후 자동 완료
    const timer = setTimeout(onComplete, 8000);
    return () => clearTimeout(timer);
  }, []);

  const bgStyle       = useAnimatedStyle(() => ({ opacity: bgOpacity.value }));
  const nameStyle     = useAnimatedStyle(() => ({
    opacity: nameOpacity.value, transform: [{ scale: nameScale.value }],
  }));
  const candleStyle   = useAnimatedStyle(() => ({
    opacity: candleOpacity.value, transform: [{ scale: candleScale.value }],
  }));
  const text1Style    = useAnimatedStyle(() => ({ opacity: text1Opacity.value }));
  const text2Style    = useAnimatedStyle(() => ({ opacity: text2Opacity.value }));

  return (
    <View style={S.container}>
      {/* 어두운 배경 */}
      <Animated.View style={[S.bg, bgStyle]} />

      {/* 별빛 */}
      <StarField absolute />

      {/* 컨텐츠 */}
      <View style={S.content} pointerEvents="box-none">
        {/* 촛불 */}
        <Animated.Text style={[S.candle, candleStyle]}>🕯️</Animated.Text>

        {/* 이름 */}
        <Animated.Text style={[S.name, nameStyle]}>
          † {providerName}
        </Animated.Text>

        {/* 메시지 */}
        <Animated.Text style={[S.text1, text1Style]}>
          {t.animation_text1}
        </Animated.Text>
        <Animated.Text style={[S.text2, text2Style]}>
          {t.animation_text2}
        </Animated.Text>

        {/* 건너뛰기 */}
        <Animated.View style={[S.skipWrap, text1Style]}>
          <TouchableOpacity style={S.skipBtn} onPress={onComplete}>
            <Text style={S.skipText}>{t.animation_skip}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.memorial.bg,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    zIndex: 1,
  },
  candle: {
    fontSize: 56,
    marginBottom: 8,
  },
  name: {
    fontSize:      34,
    fontWeight:    '700',
    color:         Colors.memorial.text,
    letterSpacing: 2,
    textAlign:     'center',
  },
  text1: {
    fontSize:    16,
    color:       Colors.memorial.textMid,
    letterSpacing: 1,
    marginTop:   8,
  },
  text2: {
    fontSize:    16,
    color:       Colors.memorial.textMid,
    letterSpacing: 1,
  },
  skipWrap: {
    marginTop: 40,
  },
  skipBtn: {
    paddingVertical:   8,
    paddingHorizontal: 20,
    borderRadius:      20,
    borderWidth:       1,
    borderColor:       Colors.memorial.border,
  },
  skipText: {
    fontSize: 13,
    color:    Colors.memorial.textMuted,
  },
});
