// 폰트 토큰

export const Typography = {
  serif:  'NotoSerifKR',   // expo-font으로 로드 예정
  sans:   'NotoSansKR',
  sansSystem: undefined,   // 시스템 폰트 폴백
} as const;

export const FontSize = {
  xs:  11,
  sm:  12,
  md:  14,
  lg:  16,
  xl:  18,
  '2xl': 22,
  '3xl': 28,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium:  '500' as const,
  semibold:'600' as const,
  bold:    '700' as const,
} as const;
