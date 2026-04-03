// components/StarField.tsx - 추모 모드 별빛 배경 애니메이션
// react-native-reanimated 사용
// CSS @keyframes → Animated.loop

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withRepeat, Easing,
} from 'react-native-reanimated';
import { Colors } from '@/constants/colors';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
}

// 별 데이터 미리 생성 (컴포넌트 외부에서 한 번만)
const STARS: Star[] = Array.from({ length: 60 }, (_, i) => ({
  id:       i,
  x:        Math.random() * SCREEN_W,
  y:        Math.random() * SCREEN_H,
  size:     Math.random() * 2.5 + 0.8,
  delay:    Math.random() * 4000,
  duration: Math.random() * 3000 + 2000,
}));

function StarDot({ star }: { star: Star }) {
  const opacity = useSharedValue(0.1);

  useEffect(() => {
    opacity.value = withDelay(
      star.delay,
      withRepeat(
        withTiming(0.8, { duration: star.duration, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        S.star,
        {
          left:   star.x,
          top:    star.y,
          width:  star.size,
          height: star.size,
          borderRadius: star.size / 2,
        },
        style,
      ]}
    />
  );
}

interface StarFieldProps {
  /** 기본: 전체 화면 절대 위치 배경으로 사용. false면 relative */
  absolute?: boolean;
}

export default function StarField({ absolute = true }: StarFieldProps) {
  return (
    <View
      style={[
        S.container,
        absolute
          ? StyleSheet.absoluteFillObject
          : { width: '100%', height: '100%' },
      ]}
      pointerEvents="none"
    >
      {STARS.map(star => (
        <StarDot key={star.id} star={star} />
      ))}
    </View>
  );
}

const S = StyleSheet.create({
  container: { zIndex: 0 },
  star: {
    position:        'absolute',
    backgroundColor: Colors.memorial.star,
  },
});
