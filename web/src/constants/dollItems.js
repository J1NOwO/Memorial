// dollItems.js - Doll 커스터마이징 아이템 정의
//
// gender: 'unisex' | 'male' | 'female'
// cost 0 = 기본 제공 / locked: true = 상점에서 구매
//
// 필터 규칙: userGender === 'male'   → 'male' + 'unisex' 표시
//           userGender === 'female' → 'female' + 'unisex' 표시
//           userGender === 'other'  → 전체 표시

// ── 피부톤 ────────────────────────────────────────────────────────────────────
export const SKIN_TONES = [
  { id: 'light', label: '밝은',   labelEn: 'Light',  hex: '#FFE0C8', cost: 0, gender: 'unisex' },
  { id: 'warm',  label: '따뜻한', labelEn: 'Warm',   hex: '#F5C896', cost: 0, gender: 'unisex' },
  { id: 'tan',   label: '구릿빛', labelEn: 'Tan',    hex: '#D4956A', cost: 0, gender: 'unisex' },
  { id: 'deep',  label: '짙은',   labelEn: 'Deep',   hex: '#8D5524', cost: 0, gender: 'unisex' },
];

// ── 헤어스타일 ────────────────────────────────────────────────────────────────
export const HAIR_STYLES = [
  // 혼성
  { id: 'short',     label: '단발',    labelEn: 'Bob',        cost: 0,  gender: 'unisex' },
  { id: 'none',      label: '없음',    labelEn: 'None',       cost: 0,  gender: 'unisex' },
  // 남성
  { id: 'buzz',      label: '버즈컷',  labelEn: 'Buzz cut',   cost: 0,  gender: 'male'   },
  { id: 'crew',      label: '크루컷',  labelEn: 'Crew cut',   cost: 0,  gender: 'male'   },
  { id: 'slick',     label: '올백',    labelEn: 'Slick back', cost: 20, gender: 'male', locked: true },
  { id: 'undercut',  label: '언더컷',  labelEn: 'Undercut',   cost: 20, gender: 'male', locked: true },
  // 여성
  { id: 'long',      label: '긴 머리', labelEn: 'Long',       cost: 0,  gender: 'female' },
  { id: 'wavy',      label: '웨이브',  labelEn: 'Wavy',       cost: 0,  gender: 'female' },
  { id: 'bun',       label: '올림머리', labelEn: 'Bun',       cost: 20, gender: 'female', locked: true },
  { id: 'ponytail',  label: '포니테일', labelEn: 'Ponytail',  cost: 20, gender: 'female', locked: true },
  { id: 'twin',      label: '양갈래',  labelEn: 'Twin tails', cost: 30, gender: 'female', locked: true },
];

// ── 머리색 ────────────────────────────────────────────────────────────────────
export const HAIR_COLORS = [
  { id: '#1a1a1a', label: '블랙',      labelEn: 'Black',      cost: 0,  gender: 'unisex' },
  { id: '#3d2e22', label: '다크브라운', labelEn: 'Dark Brown', cost: 0,  gender: 'unisex' },
  { id: '#7B4F2E', label: '브라운',    labelEn: 'Brown',      cost: 0,  gender: 'unisex' },
  { id: '#C4956A', label: '카라멜',    labelEn: 'Caramel',    cost: 0,  gender: 'unisex' },
  { id: '#8a8a8a', label: '그레이',    labelEn: 'Gray',       cost: 10, gender: 'unisex', locked: true },
  { id: '#e8e0d0', label: '화이트',    labelEn: 'White',      cost: 20, gender: 'unisex', locked: true },
  { id: '#e8c84a', label: '금발',      labelEn: 'Blonde',     cost: 20, gender: 'unisex', locked: true },
  { id: '#d47090', label: '핑크',      labelEn: 'Pink',       cost: 30, gender: 'female', locked: true },
  { id: '#7060b0', label: '퍼플',      labelEn: 'Purple',     cost: 30, gender: 'unisex', locked: true },
  { id: '#4878c0', label: '블루',      labelEn: 'Blue',       cost: 40, gender: 'unisex', locked: true },
  { id: '#c03020', label: '레드',      labelEn: 'Red',        cost: 40, gender: 'unisex', locked: true },
];

// ── 눈 타입 ───────────────────────────────────────────────────────────────────
export const EYE_TYPES = [
  { id: 'normal',  label: '보통',    labelEn: 'Normal',    cost: 0,  gender: 'unisex' },
  { id: 'happy',   label: '웃는 눈', labelEn: 'Smiling',   cost: 0,  gender: 'unisex' },
  { id: 'sleepy',  label: '졸린 눈', labelEn: 'Sleepy',    cost: 10, gender: 'unisex', locked: true },
  { id: 'sparkle', label: '별 눈',   labelEn: 'Sparkling', cost: 20, gender: 'female', locked: true },
  { id: 'sharp',   label: '날카로운', labelEn: 'Sharp',    cost: 20, gender: 'male',  locked: true },
];

// ── 눈동자색 ──────────────────────────────────────────────────────────────────
export const EYE_COLORS = [
  { id: '#5a8fd4', label: '블루',   labelEn: 'Blue',   cost: 0,  gender: 'unisex' },
  { id: '#5a9a6a', label: '그린',   labelEn: 'Green',  cost: 0,  gender: 'unisex' },
  { id: '#8a6040', label: '브라운', labelEn: 'Brown',  cost: 0,  gender: 'unisex' },
  { id: '#7060b0', label: '퍼플',   labelEn: 'Purple', cost: 10, gender: 'unisex', locked: true },
  { id: '#c04060', label: '레드',   labelEn: 'Red',    cost: 20, gender: 'unisex', locked: true },
  { id: '#40a0c0', label: '하늘',   labelEn: 'Sky',    cost: 10, gender: 'unisex', locked: true },
  { id: '#1a1a2e', label: '블랙',   labelEn: 'Black',  cost: 0,  gender: 'unisex' },
];

// ── 옷 스타일 ─────────────────────────────────────────────────────────────────
export const OUTFIT_STYLES = [
  // 혼성
  { id: 'casual',     label: '캐주얼',  labelEn: 'Casual',     desc: '편한 티셔츠',   descEn: 'Comfy tee',      cost: 0,  gender: 'unisex' },
  { id: 'hoodie',     label: '후디',    labelEn: 'Hoodie',     desc: '따뜻한 후드',   descEn: 'Warm hoodie',    cost: 0,  gender: 'unisex' },
  { id: 'uniform',    label: '교복',    labelEn: 'Uniform',    desc: '단정한 교복',   descEn: 'School uniform', cost: 40, gender: 'unisex', locked: true },
  // 남성
  { id: 'shirt',      label: '셔츠',    labelEn: 'Shirt',      desc: '깔끔한 버튼업', descEn: 'Button-up',      cost: 0,  gender: 'male'   },
  { id: 'suit',       label: '정장',    labelEn: 'Suit',       desc: '멋진 수트',     descEn: 'Sharp suit',     cost: 50, gender: 'male',  locked: true },
  { id: 'sportswear', label: '스포츠웨어', labelEn: 'Sportswear', desc: '활동적인 룩', descEn: 'Active look',    cost: 30, gender: 'male',  locked: true },
  // 여성
  { id: 'dress',      label: '원피스',  labelEn: 'Dress',      desc: '우아한 드레스', descEn: 'Elegant dress',  cost: 30, gender: 'female', locked: true },
  { id: 'hanbok',     label: '한복',    labelEn: 'Hanbok',     desc: '아름다운 한복', descEn: 'Traditional',    cost: 60, gender: 'female', locked: true },
];

// ── 옷 색상 ───────────────────────────────────────────────────────────────────
export const OUTFIT_COLORS = [
  { id: '#C4956A', label: '카라멜',  labelEn: 'Caramel',  cost: 0,  gender: 'unisex' },
  { id: '#5c4a3a', label: '브라운',  labelEn: 'Brown',    cost: 0,  gender: 'unisex' },
  { id: '#5c7a5c', label: '세이지',  labelEn: 'Sage',     cost: 0,  gender: 'unisex' },
  { id: '#5c6a8a', label: '슬레이트', labelEn: 'Slate',   cost: 0,  gender: 'unisex' },
  { id: '#8a5c5c', label: '로즈',    labelEn: 'Rose',     cost: 0,  gender: 'unisex' },
  { id: '#7a5c8a', label: '라벤더',  labelEn: 'Lavender', cost: 10, gender: 'unisex', locked: true },
  { id: '#2c3e5c', label: '네이비',  labelEn: 'Navy',     cost: 10, gender: 'unisex', locked: true },
  { id: '#5a9a8a', label: '민트',    labelEn: 'Mint',     cost: 20, gender: 'unisex', locked: true },
  { id: '#c4705a', label: '코랄',    labelEn: 'Coral',    cost: 20, gender: 'unisex', locked: true },
  { id: '#d4a030', label: '골드',    labelEn: 'Gold',     cost: 30, gender: 'unisex', locked: true },
  { id: '#2a2a2a', label: '블랙',    labelEn: 'Black',    cost: 30, gender: 'unisex', locked: true },
  { id: '#ffffff', label: '화이트',  labelEn: 'White',    cost: 10, gender: 'unisex', locked: true },
];

// ── 배경색 ────────────────────────────────────────────────────────────────────
export const BG_COLORS = [
  { id: 'transparent', label: '없음',   labelEn: 'None',     cost: 0,  gender: 'unisex' },
  { id: '#f7f3ee',     label: '크림',   labelEn: 'Cream',    cost: 0,  gender: 'unisex' },
  { id: '#fde8d8',     label: '피치',   labelEn: 'Peach',    cost: 0,  gender: 'unisex' },
  { id: '#e8f0e8',     label: '민트',   labelEn: 'Mint',     cost: 0,  gender: 'unisex' },
  { id: '#e8e4f0',     label: '라벤더', labelEn: 'Lavender', cost: 0,  gender: 'unisex' },
  { id: '#dde8f0',     label: '스카이', labelEn: 'Sky',      cost: 10, gender: 'unisex', locked: true },
  { id: '#f0dde8',     label: '핑크',   labelEn: 'Pink',     cost: 10, gender: 'unisex', locked: true },
  { id: '#d8f0d8',     label: '그린',   labelEn: 'Green',    cost: 40, gender: 'unisex', locked: true },
];

// ── 악세사리 ──────────────────────────────────────────────────────────────────
export const ACCESSORIES = [
  { id: 'none',     label: '없음',   labelEn: 'None',    cost: 0,  gender: 'unisex' },
  { id: 'glasses',  label: '안경',   labelEn: 'Glasses', cost: 15, gender: 'unisex', locked: true },
  { id: 'hat',      label: '모자',   labelEn: 'Hat',     cost: 25, gender: 'unisex', locked: true },
  { id: 'crown',    label: '왕관',   labelEn: 'Crown',   cost: 60, gender: 'unisex', locked: true },
  { id: 'ribbon',   label: '리본',   labelEn: 'Ribbon',  cost: 10, gender: 'female', locked: true },
  { id: 'earring',  label: '귀걸이', labelEn: 'Earring', cost: 20, gender: 'female', locked: true },
  { id: 'scarf',    label: '스카프', labelEn: 'Scarf',   cost: 20, gender: 'male',   locked: true },
];

// ── 기본값 ────────────────────────────────────────────────────────────────────
export const DEFAULT_APPEARANCE_FEMALE = {
  gender:      'female',
  skinTone:    'light',
  hairStyle:   'long',
  hairColor:   '#3d2e22',
  eyeType:     'normal',
  eyeColor:    '#5a8fd4',
  outfitStyle: 'casual',
  outfitColor: '#C4956A',
  bgColor:     'transparent',
  accessory:   'none',
};

export const DEFAULT_APPEARANCE_MALE = {
  gender:      'male',
  skinTone:    'light',
  hairStyle:   'crew',
  hairColor:   '#1a1a1a',
  eyeType:     'normal',
  eyeColor:    '#5a8fd4',
  outfitStyle: 'shirt',
  outfitColor: '#5c6a8a',
  bgColor:     'transparent',
  accessory:   'none',
};

// 기존 호환성용 (gender 없는 기존 doll)
export const DEFAULT_APPEARANCE = {
  gender:      'female',
  skinTone:    'light',
  hairStyle:   'short',
  hairColor:   '#3d2e22',
  eyeType:     'normal',
  eyeColor:    '#5a8fd4',
  outfitStyle: 'casual',
  outfitColor: '#C4956A',
  bgColor:     'transparent',
  accessory:   'none',
};

// ── 성별 필터 헬퍼 ────────────────────────────────────────────────────────────
// userGender: 'male' | 'female' | 'other' | undefined
export function filterByGender(items, userGender) {
  if (!userGender || userGender === 'other') return items;
  return items.filter((item) => item.gender === 'unisex' || item.gender === userGender);
}
