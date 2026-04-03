// components/DollAvatar.tsx - 치비 인형 SVG 아바타 (React Native)
// 웹 DollFigure.jsx → react-native-svg 변환
// svg → Svg, path → Path, circle → Circle, g → G 등
// animated prop: react-native-reanimated 부유 애니메이션

import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, {
  Defs, RadialGradient, Stop,
  G, Path, Circle, Ellipse, Line, Text as SvgText,
} from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';

// ── 타입 ──────────────────────────────────────────────────────────────────────
export interface DollAppearance {
  gender?:      'female' | 'male';
  skinTone?:    'light' | 'warm' | 'tan' | 'deep';
  hairStyle?:   string;
  hairColor?:   string;
  eyeType?:     string;
  eyeColor?:    string;
  outfitStyle?: string;
  outfitColor?: string;
  bgColor?:     string;
  accessory?:   string;
}

interface Props {
  appearance?: DollAppearance;
  size?:       number;
  animated?:   boolean;
}

// ── 색상 팔레트 ───────────────────────────────────────────────────────────────
const SKIN = {
  light: { base: '#FFE0C8', shd: '#F5BFA0', hi: '#FFF2EA' },
  warm:  { base: '#F5C896', shd: '#DFA060', hi: '#FFD9AA' },
  tan:   { base: '#D4956A', shd: '#B87040', hi: '#E4A87A' },
  deep:  { base: '#8D5524', shd: '#6A3810', hi: '#A0682E' },
};

// ── 색상 유틸 ─────────────────────────────────────────────────────────────────
function lighten(hex: string, amt: number): string {
  const h = (hex || '#888').replace('#', '');
  const num = parseInt(h.length === 3 ? h.split('').map(x => x+x).join('') : h, 16);
  const r = Math.min(255, (num >> 16) + amt);
  const g = Math.min(255, ((num >> 8) & 0xff) + amt);
  const b = Math.min(255, (num & 0xff) + amt);
  return `rgb(${r},${g},${b})`;
}
function darken(hex: string, amt: number): string { return lighten(hex, -amt); }

// ── 헤어 (뒷레이어) ──────────────────────────────────────────────────────────
function HairBack({ style, color }: { style: string; color: string }) {
  const c = color || '#3d2e22';
  switch (style) {
    case 'buzz': case 'crew': return null;
    case 'slick':
      return <G fill={c}><Path d="M80,20 C52,18 30,40 28,68 C26,88 34,108 42,118 C36,108 28,88 30,66 C32,38 54,16 80,16 C106,16 128,38 130,66 C132,88 124,108 118,118 C126,108 134,88 132,68 C130,40 108,18 80,20 Z"/></G>;
    case 'undercut':
      return <G fill={c}><Path d="M80,20 C56,18 36,38 34,62 C36,52 52,36 80,34 C108,36 124,52 126,62 C124,38 104,18 80,20 Z"/></G>;
    case 'long':
      return (
        <G fill={c}>
          <Path d="M80,20 C52,18 30,40 28,68 C26,88 34,108 42,118 C36,108 28,88 30,66 C32,38 54,16 80,16 C106,16 128,38 130,66 C132,88 124,108 118,118 C126,108 134,88 132,68 C130,40 108,18 80,20 Z"/>
          <Path d="M34,90 C26,110 24,140 28,170 C32,200 38,222 40,238 L32,238 C28,220 20,196 18,164 C14,132 18,104 28,82 Z"/>
          <Path d="M126,90 C134,110 136,140 132,170 C128,200 122,222 120,238 L128,238 C132,220 140,196 142,164 C146,132 142,104 132,82 Z"/>
        </G>
      );
    case 'wavy':
      return (
        <G fill={c}>
          <Path d="M80,20 C52,18 30,40 28,68 C26,88 34,108 42,118 C36,108 28,88 30,66 C32,38 54,16 80,16 C106,16 128,38 130,66 C132,88 124,108 118,118 C126,108 134,88 132,68 C130,40 108,18 80,20 Z"/>
          <Path d="M34,90 C22,108 28,126 24,144 C20,162 28,178 24,196 C20,214 28,228 30,238 L22,238 C18,226 10,210 14,190 C18,170 12,154 16,136 C20,118 14,102 22,82 Z"/>
          <Path d="M126,90 C138,108 132,126 136,144 C140,162 132,178 136,196 C140,214 132,228 130,238 L138,238 C142,226 150,210 146,190 C142,170 148,154 144,136 C140,118 146,102 138,82 Z"/>
        </G>
      );
    case 'ponytail':
      return (
        <G fill={c}>
          <Path d="M80,20 C52,18 30,40 28,68 C26,88 34,108 42,118 C36,108 28,88 30,66 C32,38 54,16 80,16 C106,16 128,38 130,66 C132,88 124,108 118,118 C126,108 134,88 132,68 C130,40 108,18 80,20 Z"/>
          <Path d="M108,48 C120,44 132,50 134,66 C138,88 128,120 120,148 C114,170 110,196 114,220 C116,230 112,238 108,240 C104,240 100,232 102,220 C106,196 110,168 116,146 C124,118 134,88 130,66 C128,52 116,42 106,46 Z"/>
        </G>
      );
    case 'twin':
      return (
        <G fill={c}>
          <Path d="M80,20 C52,18 30,40 28,68 C26,88 34,108 42,118 C36,108 28,88 30,66 C32,38 54,16 80,16 C106,16 128,38 130,66 C132,88 124,108 118,118 C126,108 134,88 132,68 C130,40 108,18 80,20 Z"/>
          <Path d="M28,72 C16,76 10,96 14,120 C18,144 24,168 22,196 C20,216 26,232 30,240 C26,232 20,216 22,196 C24,168 18,142 14,118 C10,94 16,74 28,72 Z"/>
          <Path d="M132,72 C144,76 150,96 146,120 C142,144 136,168 138,196 C140,216 134,232 130,240 C134,232 140,216 138,196 C136,168 142,142 146,118 C150,94 144,74 132,72 Z"/>
        </G>
      );
    case 'bun':
      return (
        <G fill={c}>
          <Path d="M80,20 C52,18 30,40 28,68 C26,88 34,108 42,118 C36,108 28,88 30,66 C32,38 54,16 80,16 C106,16 128,38 130,66 C132,88 124,108 118,118 C126,108 134,88 132,68 C130,40 108,18 80,20 Z"/>
          <Ellipse cx={80} cy={14} rx={20} ry={16}/>
          <Circle cx={80} cy={14} r={12} fill={lighten(c, 15)}/>
        </G>
      );
    case 'none': return null;
    default:
      return <Path fill={c} d="M80,20 C52,18 30,40 28,68 C26,88 34,108 42,118 C36,108 28,88 30,66 C32,38 54,16 80,16 C106,16 128,38 130,66 C132,88 124,108 118,118 C126,108 134,88 132,68 C130,40 108,18 80,20 Z"/>;
  }
}

// ── 헤어 (앞레이어) ───────────────────────────────────────────────────────────
function HairFront({ style, color }: { style: string; color: string }) {
  const c  = color || '#3d2e22';
  const hi = lighten(c, 30);
  switch (style) {
    case 'buzz':
      return (
        <G>
          <Path fill={c} d="M32,58 C32,38 52,20 80,20 C108,20 128,38 128,58 C124,50 108,40 80,40 C52,40 36,50 32,58 Z"/>
          <Path fill={hi} opacity={0.2} d="M55,28 C62,22 72,20 80,20 C72,22 62,26 56,34 Z"/>
        </G>
      );
    case 'crew':
      return (
        <G>
          <Path fill={c} d="M32,62 C32,40 52,20 80,20 C108,20 128,40 128,62 C124,48 108,36 80,36 C52,36 36,48 32,62 Z"/>
          <Path fill={c} d="M32,62 C28,72 28,88 32,100 L38,94 C34,84 34,72 36,62 Z"/>
          <Path fill={c} d="M128,62 C132,72 132,88 128,100 L122,94 C126,84 126,72 124,62 Z"/>
          <Path fill={hi} opacity={0.2} d="M55,28 C62,22 72,20 80,20 C72,22 62,26 56,34 Z"/>
        </G>
      );
    case 'slick':
      return (
        <G>
          <Path fill={c} d="M32,64 C32,42 52,20 80,20 C108,20 128,42 128,64 C120,50 104,38 80,36 C56,38 40,50 32,64 Z"/>
          <Path fill={hi} opacity={0.25} d="M58,26 C68,20 76,20 80,20 C76,22 68,26 62,32 Z"/>
        </G>
      );
    case 'undercut':
      return (
        <G>
          <Path fill={c} d="M38,56 C40,38 56,22 80,20 C104,22 120,38 122,56 C116,44 100,34 80,32 C60,34 44,44 38,56 Z"/>
          <Path fill={c} opacity={0.6} d="M32,70 C30,80 30,92 34,102 L38,96 C36,88 36,78 36,70 Z"/>
          <Path fill={c} opacity={0.6} d="M128,70 C130,80 130,92 126,102 L122,96 C124,88 124,78 124,70 Z"/>
          <Path fill={hi} opacity={0.25} d="M55,28 C62,22 72,20 80,20 C72,22 62,26 56,34 Z"/>
        </G>
      );
    case 'long': case 'wavy':
      return (
        <G>
          <Path fill={c} d="M34,52 C36,38 48,22 80,20 C112,22 124,38 126,52 C120,44 106,32 80,32 C54,32 40,44 34,52 Z"/>
          <Path fill={hi} opacity={0.3} d="M55,28 C62,22 72,20 80,20 C72,22 62,26 56,34 Z"/>
        </G>
      );
    case 'ponytail':
      return (
        <G>
          <Path fill={c} d="M34,52 C36,38 48,22 80,20 C112,22 124,38 126,52 C120,44 106,32 80,32 C54,32 40,44 34,52 Z"/>
          <Path fill={hi} opacity={0.3} d="M55,28 C62,22 72,20 80,20 C72,22 62,26 56,34 Z"/>
          <Ellipse cx={112} cy={50} rx={7} ry={6} fill={c}/>
          <Ellipse cx={112} cy={50} rx={5} ry={4} fill={hi} opacity={0.4}/>
        </G>
      );
    case 'twin':
      return (
        <G>
          <Path fill={c} d="M80,20 C64,20 48,28 38,44 C44,34 56,26 80,24 C104,26 116,34 122,44 C112,28 96,20 80,20 Z"/>
          <Ellipse cx={28} cy={76} rx={8} ry={6} fill={c}/>
          <Ellipse cx={132} cy={76} rx={8} ry={6} fill={c}/>
          <Path fill={hi} opacity={0.4} d="M55,28 C62,22 72,20 80,20 C72,22 62,26 56,34 Z"/>
        </G>
      );
    case 'bun':
      return (
        <G>
          <Path fill={c} d="M34,60 C34,44 48,24 80,22 C112,24 126,44 126,60 C120,48 106,36 80,36 C54,36 40,48 34,60 Z"/>
          <Path fill={hi} opacity={0.3} d="M55,30 C62,24 72,22 80,22 C72,24 62,28 56,36 Z"/>
        </G>
      );
    case 'none': return null;
    default:
      return (
        <G>
          <Path fill={c} d="M32,60 C32,42 48,22 80,20 C112,22 128,42 128,60 C124,46 108,34 80,34 C52,34 36,46 32,60 Z"/>
          <Path fill={c} d="M32,60 C28,70 28,84 32,94 L36,88 C32,80 32,68 34,60 Z"/>
          <Path fill={c} d="M128,60 C132,70 132,84 128,94 L124,88 C128,80 128,68 126,60 Z"/>
          <Path fill={hi} opacity={0.3} d="M55,28 C62,22 72,20 80,20 C72,22 62,26 56,34 Z"/>
        </G>
      );
  }
}

// ── 눈 ───────────────────────────────────────────────────────────────────────
function Eyes({ type, color = '#5a8fd4' }: { type: string; color?: string }) {
  switch (type) {
    case 'happy':
      return (
        <G>
          <Path d="M44,74 Q56,63 68,74" stroke="#3d2e22" strokeWidth={3.5} fill="none" strokeLinecap="round"/>
          <Path d="M92,74 Q104,63 116,74" stroke="#3d2e22" strokeWidth={3.5} fill="none" strokeLinecap="round"/>
          <Path d="M46,72 Q56,61 66,72" stroke="#3d2e22" strokeWidth={1} fill="none" opacity={0.4}/>
          <Path d="M94,72 Q104,61 114,72" stroke="#3d2e22" strokeWidth={1} fill="none" opacity={0.4}/>
        </G>
      );
    case 'sleepy':
      return (
        <G>
          <Ellipse cx={56} cy={76} rx={12} ry={9} fill="white"/>
          <Path d="M44,72 Q56,66 68,72" stroke="#3d2e22" strokeWidth={3} fill={`${color}88`}/>
          <Ellipse cx={104} cy={76} rx={12} ry={9} fill="white"/>
          <Path d="M92,72 Q104,66 116,72" stroke="#3d2e22" strokeWidth={3} fill={`${color}88`}/>
        </G>
      );
    case 'sharp':
      return (
        <G>
          <Ellipse cx={56} cy={75} rx={13} ry={11} fill="white"/>
          <Ellipse cx={56} cy={75} rx={10} ry={8} fill={color}/>
          <Ellipse cx={56} cy={75} rx={5} ry={5} fill="#1a1a2e"/>
          <Circle cx={61} cy={70} r={3} fill="white"/>
          <Path d="M43,70 Q56,62 69,68" stroke="#3d2e22" strokeWidth={2.8} fill="none" strokeLinecap="round"/>
          <Ellipse cx={104} cy={75} rx={13} ry={11} fill="white"/>
          <Ellipse cx={104} cy={75} rx={10} ry={8} fill={color}/>
          <Ellipse cx={104} cy={75} rx={5} ry={5} fill="#1a1a2e"/>
          <Circle cx={109} cy={70} r={3} fill="white"/>
          <Path d="M91,70 Q104,62 117,68" stroke="#3d2e22" strokeWidth={2.8} fill="none" strokeLinecap="round"/>
        </G>
      );
    case 'sparkle':
      return (
        <G>
          <Ellipse cx={56} cy={74} rx={13} ry={14} fill="white"/>
          <Ellipse cx={56} cy={74} rx={10} ry={11} fill={color}/>
          <Ellipse cx={56} cy={74} rx={5.5} ry={6.5} fill="#1a1a2e"/>
          <Circle cx={61} cy={68} r={3.5} fill="white"/>
          <Circle cx={51} cy={78} r={1.8} fill="white" opacity={0.7}/>
          <SvgText x={49} y={70} fontSize={8} fill="white" opacity={0.9}>★</SvgText>
          <Ellipse cx={104} cy={74} rx={13} ry={14} fill="white"/>
          <Ellipse cx={104} cy={74} rx={10} ry={11} fill={color}/>
          <Ellipse cx={104} cy={74} rx={5.5} ry={6.5} fill="#1a1a2e"/>
          <Circle cx={109} cy={68} r={3.5} fill="white"/>
          <Circle cx={99} cy={78} r={1.8} fill="white" opacity={0.7}/>
          <SvgText x={97} y={70} fontSize={8} fill="white" opacity={0.9}>★</SvgText>
        </G>
      );
    default: // normal
      return (
        <G>
          <Ellipse cx={56} cy={74} rx={13} ry={14} fill="white"/>
          <Ellipse cx={56} cy={74} rx={10} ry={11} fill={color}/>
          <Ellipse cx={56} cy={75} rx={5.5} ry={6.5} fill="#1a1a2e"/>
          <Circle cx={62} cy={68} r={3.5} fill="white"/>
          <Circle cx={52} cy={78} r={1.8} fill="white" opacity={0.6}/>
          <Path d="M43,66 Q56,60 69,66" stroke="#3d2e22" strokeWidth={2.5} fill="none" strokeLinecap="round"/>
          <Ellipse cx={104} cy={74} rx={13} ry={14} fill="white"/>
          <Ellipse cx={104} cy={74} rx={10} ry={11} fill={color}/>
          <Ellipse cx={104} cy={75} rx={5.5} ry={6.5} fill="#1a1a2e"/>
          <Circle cx={110} cy={68} r={3.5} fill="white"/>
          <Circle cx={100} cy={78} r={1.8} fill="white" opacity={0.6}/>
          <Path d="M91,66 Q104,60 117,66" stroke="#3d2e22" strokeWidth={2.5} fill="none" strokeLinecap="round"/>
        </G>
      );
  }
}

// ── 옷 ───────────────────────────────────────────────────────────────────────
function Outfit({ style, color, skinColor }: { style: string; color: string; skinColor: string }) {
  const c  = color || '#c4956a';
  const dk = darken(c, 25);
  const lt = lighten(c, 20);

  switch (style) {
    case 'dress':
      return (
        <G>
          <Path d="M52,140 C48,148 46,162 46,174 C60,178 80,180 100,178 C114,176 118,174 114,162 C112,150 110,140 108,140 Z" fill={c}/>
          <Path d="M46,174 C38,186 32,200 34,218 C50,226 80,230 110,226 C126,222 128,208 122,196 C118,186 114,176 100,178 C80,180 60,178 46,174 Z" fill={c}/>
          <Path d="M38,196 C54,202 80,205 106,202 C118,200 124,196 122,196" stroke={dk} strokeWidth={1.5} fill="none" opacity={0.3}/>
          <Path d="M50,173 L110,173" stroke={dk} strokeWidth={3} opacity={0.3}/>
          <Path d="M76,170 C72,168 68,172 72,174 C76,176 80,173 80,173 C80,173 84,176 88,174 C92,172 88,168 84,170 Z" fill={lt}/>
        </G>
      );
    case 'uniform':
      return (
        <G>
          <Path d="M52,138 C46,148 44,164 44,178 C60,182 80,184 100,182 C116,180 116,164 114,150 C112,140 108,138 108,138 Z" fill={c}/>
          <Path d="M65,136 L80,152 L95,136 C90,130 86,128 80,128 C74,128 70,130 65,136 Z" fill="white" opacity={0.9}/>
          <Path d="M72,136 L80,148 L88,136" stroke={dk} strokeWidth={1.5} fill="none" opacity={0.5}/>
          <Path d="M77,140 L80,158 L83,140 Z" fill="#c0392b" opacity={0.8}/>
          {[148,158,168].map(y => <Circle key={y} cx={80} cy={y} r={2} fill={dk} opacity={0.4}/>)}
        </G>
      );
    case 'hanbok':
      return (
        <G>
          <Path d="M55,136 C50,144 48,158 50,166 L110,166 C112,158 110,144 105,136 Z" fill={c}/>
          <Path d="M80,128 L66,150" stroke={lighten(c, 30)} strokeWidth={3} opacity={0.7} strokeLinecap="round"/>
          <Path d="M80,128 L94,150" stroke={lighten(c, 30)} strokeWidth={3} opacity={0.7} strokeLinecap="round"/>
          <Path d="M50,165 C44,180 42,200 46,220 C60,228 80,230 100,228 C114,224 116,204 110,188 C106,176 110,166 110,166 Z" fill={darken(c, -15)}/>
          {[56,64,72,80,88,96,104].map(x => (
            <Line key={x} x1={x} y1={168} x2={x-3} y2={224} stroke={dk} strokeWidth={1} opacity={0.15}/>
          ))}
        </G>
      );
    case 'hoodie':
      return (
        <G>
          <Path d="M52,138 C46,148 44,164 44,178 C60,182 80,184 100,182 C116,180 116,164 114,150 C112,140 108,138 108,138 Z" fill={c}/>
          <Path d="M52,138 C44,130 42,120 46,114 L54,120 C52,124 52,130 54,136 Z" fill={dk} opacity={0.4}/>
          <Path d="M108,138 C116,130 118,120 114,114 L106,120 C108,124 108,130 106,136 Z" fill={dk} opacity={0.4}/>
          <Path d="M62,166 C60,172 60,178 66,180 C74,182 86,182 94,180 C100,178 100,172 98,166 Z" fill={dk} opacity={0.2}/>
          <Line x1={80} y1={140} x2={80} y2={178} stroke={dk} strokeWidth={1.5} opacity={0.25}/>
        </G>
      );
    default: // casual / shirt / suit / sportswear
      return (
        <G>
          <Path d="M52,138 C46,148 44,166 44,180 C60,184 80,186 100,184 C116,182 116,166 114,150 C112,140 108,138 108,138 Z" fill={c}/>
          <Path d="M44,148 C40,154 38,166 40,174 L50,174 C50,164 50,152 52,142 Z" fill={dk} opacity={0.2}/>
          <Path d="M116,148 C120,154 122,166 120,174 L110,174 C110,164 110,152 108,142 Z" fill={dk} opacity={0.2}/>
          <Path d="M66,136 Q80,130 94,136" stroke={dk} strokeWidth={2} fill="none" opacity={0.35} strokeLinecap="round"/>
        </G>
      );
  }
}

// ── 악세사리 ─────────────────────────────────────────────────────────────────
function Accessory({ type, hairColor }: { type: string; hairColor: string }) {
  switch (type) {
    case 'ribbon':
      return (
        <G>
          <Path d="M56,38 C48,30 40,34 44,42 C48,50 60,44 64,40 Z" fill="#e88fa8"/>
          <Path d="M64,38 C72,30 80,34 76,42 C72,50 60,44 56,40 Z" fill="#e88fa8"/>
          <Circle cx={60} cy={40} r={5} fill="#f0a8c0"/>
        </G>
      );
    case 'hat':
      return (
        <G fill={hairColor || '#3d2e22'}>
          <Ellipse cx={80} cy={28} rx={46} ry={8}/>
          <Path d="M40,28 C38,8 56,-4 80,-4 C104,-4 122,8 120,28 Z"/>
          <Line x1={36} y1={24} x2={124} y2={24} stroke="#c4956a" strokeWidth={3} opacity={0.7}/>
        </G>
      );
    case 'glasses':
      return (
        <G stroke="#5c4a3a" strokeWidth={2} fill="none" opacity={0.75}>
          <Circle cx={56} cy={74} r={16}/>
          <Circle cx={104} cy={74} r={16}/>
          <Line x1={72} y1={74} x2={88} y2={74}/>
          <Line x1={40} y1={72} x2={34} y2={70}/>
          <Line x1={120} y1={72} x2={126} y2={70}/>
        </G>
      );
    case 'crown':
      return (
        <G>
          <Path d="M44,32 L52,16 L64,28 L80,12 L96,28 L108,16 L116,32 Z" fill="#e8b84a" stroke="#d4a030" strokeWidth={1}/>
          <Line x1={44} y1={32} x2={116} y2={32} stroke="#d4a030" strokeWidth={2}/>
          <Circle cx={64} cy={24} r={4} fill="#e88fa8"/>
          <Circle cx={80} cy={18} r={4} fill="#88c4f4"/>
          <Circle cx={96} cy={24} r={4} fill="#a8e4a0"/>
        </G>
      );
    case 'earring':
      return (
        <G>
          <Circle cx={31} cy={90} r={4} fill="#e8c84a" stroke="#d4a030" strokeWidth={1}/>
          <Ellipse cx={31} cy={97} rx={3} ry={5} fill="#e8c84a" stroke="#d4a030" strokeWidth={0.8}/>
          <Circle cx={129} cy={90} r={4} fill="#e8c84a" stroke="#d4a030" strokeWidth={1}/>
          <Ellipse cx={129} cy={97} rx={3} ry={5} fill="#e8c84a" stroke="#d4a030" strokeWidth={0.8}/>
        </G>
      );
    case 'scarf':
      return (
        <G>
          <Path d="M56,126 C56,126 68,122 80,124 C92,122 104,126 104,126 C108,132 108,138 104,140 C96,136 88,134 80,136 C72,134 64,136 56,140 C52,138 52,132 56,126 Z" fill="#c4705a" opacity={0.9}/>
          <Path d="M74,136 C76,140 78,146 76,154 C74,162 72,166 74,170" stroke="#c4705a" strokeWidth={8} fill="none" opacity={0.85} strokeLinecap="round"/>
        </G>
      );
    default: return null;
  }
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function DollAvatar({ appearance = {}, size = 120, animated = false }: Props) {
  const {
    gender      = 'female',
    skinTone    = 'light',
    hairStyle   = 'short',
    hairColor   = '#3d2e22',
    eyeType     = 'normal',
    eyeColor    = '#5a8fd4',
    outfitStyle = 'casual',
    outfitColor = '#c4956a',
    bgColor     = 'transparent',
    accessory   = 'none',
  } = appearance;

  const isMale = gender === 'male';
  const skin   = SKIN[skinTone as keyof typeof SKIN] || SKIN.light;
  const uid    = `doll_${skinTone}_${outfitColor.replace('#', '')}`;
  const svgH   = size * 1.625; // 160:260 비율

  // 부유 애니메이션
  const floatY = useSharedValue(0);
  useEffect(() => {
    if (!animated) return;
    floatY.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0,  { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [animated]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const svgContent = (
    <Svg width={size} height={svgH} viewBox="0 0 160 260">
      <Defs>
        <RadialGradient id={`skin_${uid}`} cx="45%" cy="35%" r="60%">
          <Stop offset="0%"   stopColor={skin.hi}/>
          <Stop offset="60%"  stopColor={skin.base}/>
          <Stop offset="100%" stopColor={skin.shd}/>
        </RadialGradient>
        <RadialGradient id={`blush_${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0%"   stopColor="#f5a0a0" stopOpacity={0.55}/>
          <Stop offset="100%" stopColor="#f5a0a0" stopOpacity={0}/>
        </RadialGradient>
      </Defs>

      {/* 배경 */}
      {bgColor !== 'transparent' && (
        <Circle cx={80} cy={130} r={76} fill={bgColor} opacity={0.4}/>
      )}

      {/* 헤어 뒤 */}
      <HairBack style={hairStyle} color={hairColor}/>

      {/* 팔 */}
      {isMale ? (
        <G>
          <Path d="M48,138 C38,150 32,168 34,188 C36,198 43,202 50,198 C57,194 58,182 56,170 C54,158 52,146 52,138 Z" fill={`url(#skin_${uid})`}/>
          <Ellipse cx={42} cy={198} rx={11} ry={9} fill={`url(#skin_${uid})`}/>
          <Path d="M112,138 C122,150 128,168 126,188 C124,198 117,202 110,198 C103,194 102,182 104,170 C106,158 108,146 108,138 Z" fill={`url(#skin_${uid})`}/>
          <Ellipse cx={118} cy={198} rx={11} ry={9} fill={`url(#skin_${uid})`}/>
        </G>
      ) : (
        <G>
          <Path d="M54,142 C46,152 40,168 42,186 C44,196 50,200 56,196 C62,192 64,182 62,172 C60,162 58,150 56,140 Z" fill={`url(#skin_${uid})`}/>
          <Ellipse cx={48} cy={196} rx={10} ry={8} fill={`url(#skin_${uid})`}/>
          <Path d="M106,142 C114,152 120,168 118,186 C116,196 110,200 104,196 C98,192 96,182 98,172 C100,162 102,150 104,140 Z" fill={`url(#skin_${uid})`}/>
          <Ellipse cx={112} cy={196} rx={10} ry={8} fill={`url(#skin_${uid})`}/>
        </G>
      )}

      {/* 옷 */}
      <Outfit style={outfitStyle} color={outfitColor} skinColor={skin.base}/>

      {/* 다리 */}
      <Path d="M62,182 C58,196 56,214 58,230 C60,238 66,242 70,238 C74,234 74,224 72,212 C70,200 68,188 66,182 Z" fill={skin.base}/>
      <Ellipse cx={64} cy={240} rx={14} ry={8} fill={darken(outfitColor, 10)}/>
      <Path d="M98,182 C102,196 104,214 102,230 C100,238 94,242 90,238 C86,234 86,224 88,212 C90,200 92,188 94,182 Z" fill={skin.base}/>
      <Ellipse cx={96} cy={240} rx={14} ry={8} fill={darken(outfitColor, 10)}/>

      {/* 목 */}
      <Path d="M68,118 C66,126 66,132 68,138 C72,140 88,140 92,138 C94,132 94,126 92,118 Z" fill={`url(#skin_${uid})`}/>

      {/* 얼굴 */}
      {isMale ? (
        <G>
          <Path d="M80,22 C108,22 132,44 132,70 C132,96 116,118 96,124 L80,126 L64,124 C44,118 28,96 28,70 C28,44 52,22 80,22 Z" fill={`url(#skin_${uid})`}/>
          <Path d="M50,106 C56,116 68,124 80,126 C92,124 104,116 110,106" stroke={skin.shd} strokeWidth={2} fill="none" opacity={0.35}/>
        </G>
      ) : (
        <G>
          <Path d="M80,22 C108,22 130,44 130,70 C130,100 110,122 80,124 C50,122 30,100 30,70 C30,44 52,22 80,22 Z" fill={`url(#skin_${uid})`}/>
          <Path d="M52,108 C60,118 74,124 80,124 C86,124 100,118 108,108" stroke={skin.shd} strokeWidth={1.5} fill="none" opacity={0.3}/>
        </G>
      )}

      {/* 헤어 앞 */}
      <HairFront style={hairStyle} color={hairColor}/>

      {/* 눈 */}
      <Eyes type={eyeType} color={eyeColor}/>

      {/* 코 */}
      <Path d="M76,92 Q80,97 84,92" stroke={skin.shd} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.6}/>

      {/* 입 */}
      <Path d="M68,104 Q80,114 92,104" stroke={darken(skin.base, 30)} strokeWidth={2.5} fill="none" strokeLinecap="round"/>
      <Path d="M72,104 Q80,101 88,104" stroke={darken(skin.base, 20)} strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.5}/>

      {/* 볼 */}
      <Ellipse cx={44} cy={88} rx={16} ry={10} fill={`url(#blush_${uid})`}/>
      <Ellipse cx={116} cy={88} rx={16} ry={10} fill={`url(#blush_${uid})`}/>

      {/* 악세사리 */}
      <Accessory type={accessory} hairColor={hairColor}/>

      {/* 눈썹 */}
      {eyeType !== 'happy' && (
        <G>
          <Path d="M44,60 Q56,54 68,58" stroke={hairColor} strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.8}/>
          <Path d="M92,58 Q104,54 116,60" stroke={hairColor} strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.8}/>
        </G>
      )}
    </Svg>
  );

  if (animated) {
    return (
      <Animated.View style={[{ width: size, height: svgH }, animStyle]}>
        {svgContent}
      </Animated.View>
    );
  }

  return <View style={{ width: size, height: svgH }}>{svgContent}</View>;
}
