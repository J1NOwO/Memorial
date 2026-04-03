// test/testDailyQuestions.js
// 같은 유저가 7일 연속 질문 받았을 때 중복 없이 다양하게 나오는지 테스트
//
// 실행: node test/testDailyQuestions.js
// (backend 폴더에서 실행해야 .env가 로드됨)

require('dotenv').config();
const { generateDailyQuestions } = require('../services/aiService');

const CATEGORIES = ['추억', '가치관', '말투·성격', '가족에게', '인생 조언'];

function getCategoriesFromIndex(startIndex) {
  return [0, 1, 2].map((i) => CATEGORIES[(startIndex + i) % CATEGORIES.length]);
}

async function runTest() {
  console.log('=== 7일 연속 질문 생성 테스트 ===\n');

  const allQuestions = []; // 누적 질문 텍스트 (이전 질문 중복 방지용)
  let categoryIndex = 0;
  let failCount = 0;

  for (let day = 1; day <= 7; day++) {
    console.log(`\n--- Day ${day} ---`);
    const categories = getCategoriesFromIndex(categoryIndex);
    console.log(`카테고리: ${categories.join(' / ')}`);

    const questions = await generateDailyQuestions(categories, [...allQuestions]);

    for (const q of questions) {
      const isDuplicate = allQuestions.includes(q.text);
      const lenOk  = q.text.length >= 30;
      const qmarkOk = q.text.endsWith('?') || q.text.endsWith('？');

      const lenStatus   = lenOk   ? '✅' : '❌ 30자미만';
      const qmarkStatus = qmarkOk ? '✅' : '❌ 물음표없음';
      const dupStatus   = isDuplicate ? '❌ 중복!' : '✅';

      console.log(`  [${q.category}] ${q.text}`);
      console.log(`    길이: ${q.text.length}자 ${lenStatus} | 물음표: ${qmarkStatus} | 중복: ${dupStatus}`);
      console.log(`    후속: ${q.followUp}`);

      if (isDuplicate || !lenOk || !qmarkOk) failCount++;
      allQuestions.push(q.text);
    }

    // 다음 날은 3칸 이동
    categoryIndex = (categoryIndex + 3) % CATEGORIES.length;
  }

  // 최종 통계
  const total  = allQuestions.length;
  const unique = new Set(allQuestions).size;
  console.log('\n=== 최종 결과 ===');
  console.log(`총 질문: ${total}개 | 고유 질문: ${unique}개 | 중복: ${total - unique}개`);
  console.log(`품질 이슈 총계: ${failCount}건`);
  console.log(failCount === 0 ? '✅ 테스트 통과!' : '⚠️ 일부 개선 필요');
}

runTest().catch(console.error);
