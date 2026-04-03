// 디자인 토큰 - 웹과 동일한 색상 시스템

export const Colors = {
  // 기본 팔레트
  primary:      '#5c4a3a',
  primaryDeep:  '#3d2e22',
  accent:       '#c4956a',
  accentLight:  '#d4a57a',
  accentPale:   '#f5ede4',

  // 배경/카드
  bg:           '#f7f3ee',
  card:         '#fffdf9',
  border:       '#e8e0d4',
  borderLight:  '#f0ebe4',

  // 텍스트
  text:         '#3d2e22',
  textMid:      '#6b5a4a',
  textMuted:    '#8a7f74',

  // 상태
  success:      '#5a9a6a',
  error:        '#c0392b',
  warning:      '#e67e22',

  // 추모 모드
  memorial: {
    bg:       '#1a1a2e',
    card:     '#16213e',
    accent:   '#7b6fa0',
    accentPale: '#2d2d4e',
    text:     '#e8e0f0',
    textMid:  '#c8b8d8',
    textMuted:'#9088a8',
    border:   '#2d2d4e',
    star:     'rgba(200,184,216,0.6)',
  },

  white:  '#ffffff',
  black:  '#000000',
  transparent: 'transparent',
} as const;

export type ColorKey = keyof typeof Colors;
