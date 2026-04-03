// seedQuestions.js - 샘플 질문 데이터 + Firestore 자동 시드
// 앱 첫 실행 시 questions 컬렉션이 비어있으면 이 데이터를 자동으로 저장해
// 모든 질문은 type: 'text' (자유 서술형)

import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';

export const SAMPLE_QUESTIONS = [
  // ── 추억 ──
  { id: 'q01', category: '추억', type: 'text',
    text: '살면서 가장 행복했던 순간은 언제인가요?',
    followUp: '그 순간이 왜 특별히 기억에 남으시나요?' },
  { id: 'q02', category: '추억', type: 'text',
    text: '어린 시절, 가장 기억에 남는 장소는 어디인가요?',
    followUp: '그 장소에서 어떤 일이 있었나요?' },
  { id: 'q03', category: '추억', type: 'text',
    text: '지금도 생각나는 특별한 냄새나 소리가 있나요?',
    followUp: '그게 왜 아직도 기억에 남는 것 같으세요?' },
  { id: 'q04', category: '추억', type: 'text',
    text: '평생 잊지 못할 여행지가 있다면?',
    followUp: '그곳에서 가장 인상 깊었던 순간은 무엇인가요?' },
  { id: 'q05', category: '추억', type: 'text',
    text: '인생에서 가장 웃겼던 순간을 이야기해주세요.',
    followUp: '그때 왜 그렇게 웃겼는지 조금 더 이야기해주실 수 있어요?' },
  { id: 'q06', category: '추억', type: 'text',
    text: '지금의 나를 만든 경험이 있다면 무엇인가요?',
    followUp: '그 경험이 어떻게 지금의 나를 만들었다고 생각하시나요?' },

  // ── 가치관 ──
  { id: 'q07', category: '가치관', type: 'text',
    text: '인생에서 가장 중요하다고 생각하는 것은 무엇인가요?',
    followUp: '왜 그것이 가장 중요하다고 느끼시나요?' },
  { id: 'q08', category: '가치관', type: 'text',
    text: '돈과 시간 중 하나를 더 많이 갖게 된다면?',
    followUp: '그것을 선택하신 이유가 무엇인가요?' },
  { id: 'q09', category: '가치관', type: 'text',
    text: '후회 없는 삶이란 어떤 삶이라고 생각하나요?',
    followUp: '지금 그런 삶에 얼마나 가까이 있다고 느끼시나요?' },
  { id: 'q10', category: '가치관', type: 'text',
    text: '지금 가장 감사하게 생각하는 것은 무엇인가요?',
    followUp: '그것의 소중함을 언제 처음 깨달으셨나요?' },
  { id: 'q11', category: '가치관', type: 'text',
    text: '어떤 사람으로 기억되고 싶나요?',
    followUp: '그런 사람이 되기 위해 어떻게 살아오셨나요?' },
  { id: 'q12', category: '가치관', type: 'text',
    text: '살면서 가장 어려웠던 결정은 무엇이었나요?',
    followUp: '그 결정을 내리기까지 어떤 생각을 하셨나요?' },

  // ── 말투·성격 ──
  { id: 'q13', category: '말투·성격', type: 'text',
    text: '친한 사람들은 나를 어떤 사람이라고 하나요?',
    followUp: '그 말을 들었을 때 어떤 느낌이었나요?' },
  { id: 'q14', category: '말투·성격', type: 'text',
    text: '자주 쓰는 말버릇이나 표현이 있나요?',
    followUp: '그 표현을 언제부터 쓰기 시작했는지 기억하시나요?' },
  { id: 'q15', category: '말투·성격', type: 'text',
    text: '화가 났을 때 나만의 해소 방법이 있나요?',
    followUp: '그 방법이 효과가 있다고 느끼시나요? 어떻게 알게 됐나요?' },
  { id: 'q16', category: '말투·성격', type: 'text',
    text: '기분이 좋을 때 나오는 행동이 있나요?',
    followUp: '주변 사람들도 그걸 알아채나요?' },
  { id: 'q17', category: '말투·성격', type: 'text',
    text: '아침형 인간인가요, 저녁형 인간인가요?',
    followUp: '언제부터 그랬는지 아시나요? 그게 일상에 어떤 영향을 주나요?' },
  { id: 'q18', category: '말투·성격', type: 'text',
    text: '혼자 있는 시간과 함께하는 시간 중 어느 쪽이 더 편한가요?',
    followUp: '왜 그런 것 같으세요?' },

  // ── 가족에게 ──
  { id: 'q19', category: '가족에게', type: 'text',
    text: '가족에게 평소에 못 했던 말이 있다면?',
    followUp: '왜 그 말을 하기 어려우셨나요?' },
  { id: 'q20', category: '가족에게', type: 'text',
    text: '자녀 혹은 소중한 사람에게 꼭 전하고 싶은 한 마디는?',
    followUp: '그 말을 전하고 싶다고 느끼게 된 계기가 있나요?' },
  { id: 'q21', category: '가족에게', type: 'text',
    text: '배우자나 파트너에게 가장 고마운 점은 무엇인가요?',
    followUp: '그 감사함을 직접 표현한 적 있으신가요?' },
  { id: 'q22', category: '가족에게', type: 'text',
    text: '나를 가장 잘 알고 있는 사람은 누구인가요?',
    followUp: '그 사람이 나를 잘 이해한다고 느끼는 순간은 언제인가요?' },
  { id: 'q23', category: '가족에게', type: 'text',
    text: '가족과 함께한 가장 소중한 기억은 무엇인가요?',
    followUp: '그 기억이 특별히 소중하게 느껴지는 이유가 있나요?' },
  { id: 'q24', category: '가족에게', type: 'text',
    text: '사랑하는 사람이 힘들 때 해주고 싶은 말은?',
    followUp: '그 말이 떠오른 특별한 이유가 있으신가요?' },

  // ── 인생 조언 ──
  { id: 'q25', category: '인생 조언', type: 'text',
    text: '20대의 나에게 해주고 싶은 말이 있다면?',
    followUp: '그때 그 말을 들었다면 어떻게 달라졌을까요?' },
  { id: 'q26', category: '인생 조언', type: 'text',
    text: '인생에서 가장 잘했다고 생각하는 선택은?',
    followUp: '그 선택을 하기까지 어떤 고민이 있으셨나요?' },
  { id: 'q27', category: '인생 조언', type: 'text',
    text: '다시 태어난다면 꼭 해보고 싶은 것은?',
    followUp: '왜 이번 생에는 하지 못하셨나요?' },
  { id: 'q28', category: '인생 조언', type: 'text',
    text: '힘든 시간을 버티게 해준 것은 무엇인가요?',
    followUp: '그게 힘이 됐다는 걸 언제 깨달으셨나요?' },
  { id: 'q29', category: '인생 조언', type: 'text',
    text: '행복해지려면 어떻게 살아야 한다고 생각하나요?',
    followUp: '그 생각은 어떤 경험에서 나온 건가요?' },
  { id: 'q30', category: '인생 조언', type: 'text',
    text: '삶에서 가장 중요한 것 세 가지를 꼽는다면?',
    followUp: '그 세 가지가 중요하다는 걸 언제 처음 느끼셨나요?' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Firestore에 질문 데이터 시드
// questions 컬렉션이 비어있을 때만 실행 (중복 방지)
// ─────────────────────────────────────────────────────────────────────────────
export async function seedQuestionsIfEmpty() {
  try {
    const snapshot = await getDocs(collection(db, 'questions'));
    if (!snapshot.empty) return;

    const batch = writeBatch(db);
    SAMPLE_QUESTIONS.forEach((question) => {
      const docRef = doc(db, 'questions', question.id);
      batch.set(docRef, question);
    });

    await batch.commit();
    console.log('질문 데이터 시드 완료:', SAMPLE_QUESTIONS.length, '개');
  } catch (err) {
    console.error('질문 시드 실패:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 오늘의 날짜 기반으로 질문 3개 선택 (카테고리 분산, 결정론적)
// 연속된 인덱스가 같은 카테고리에 몰리는 현상 방지
// ─────────────────────────────────────────────────────────────────────────────
export function selectTodayQuestions(allQuestions, count = 3) {
  if (allQuestions.length === 0) return [];

  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const dateNum = parseInt(today);

  // 카테고리별로 그룹화 (고정 순서 유지)
  const CATEGORY_ORDER = ['추억', '가치관', '말투·성격', '가족에게', '인생 조언'];
  const groups = {};
  CATEGORY_ORDER.forEach((cat) => { groups[cat] = []; });
  allQuestions.forEach((q) => {
    if (groups[q.category]) groups[q.category].push(q);
  });

  const selected = [];
  for (let i = 0; i < count; i++) {
    // 날짜 기반으로 카테고리를 순환 선택 (매일 다른 카테고리 조합)
    const catIndex = (dateNum + i) % CATEGORY_ORDER.length;
    const cat = CATEGORY_ORDER[catIndex];
    const qs = groups[cat];
    if (qs && qs.length > 0) {
      // 카테고리 내에서도 날짜 기반으로 다른 질문 선택
      selected.push(qs[(dateNum + i) % qs.length]);
    }
  }

  return selected;
}
