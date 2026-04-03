// services/aiService.js - AI 서비스 전담 파일 (Groq)
//
// ⚠️ AI를 다른 서비스로 교체할 때 이 파일만 수정하면 돼.
//    외부에서 쓰는 함수 이름(generateDailyQuestions, chatAsPersona)은 유지해줘.
//
// 사용 모델: llama-3.3-70b-versatile (Groq, 무료 30RPM / 14400RPD)

const Groq = require('groq-sdk');

// Groq 클라이언트 초기화 (무료 30RPM, 14400RPD)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// ─────────────────────────────────────────────────────────────────────────────
// Groq 통합 호출 함수
// - 429 시 8초 후 1회 재시도
// - 실패 시 null 반환 (throw 하지 않아 500 번짐 방지)
// ─────────────────────────────────────────────────────────────────────────────

async function callGroq(prompt) {
  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 512,
    });
    const text1 = completion.choices[0]?.message?.content?.trim();
    return text1 || null;
  } catch (err) {
    const is429 = err.status === 429 || err.message?.includes('429') || err.message?.includes('rate_limit');
    if (is429) {
      console.warn('[Groq] 429 감지 - 8초 후 재시도...');
      await new Promise((r) => setTimeout(r, 8000));
      try {
        const completion = await groq.chat.completions.create({
          model: GROQ_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 512,
        });
        const text2 = completion.choices[0]?.message?.content?.trim();
        return text2 || null;
      } catch (retryErr) {
        console.error('[Groq] 재시도 실패:', retryErr.message);
        return null;
      }
    }
    console.error('[Groq] 호출 실패:', err.message);
    return null;
  }
}

// 카테고리별 세부 가이드 (한국어)
const CATEGORY_GUIDES_KO = {
  '추억':      '어린시절/학창시절/첫경험/여행/가족과의 순간 등 구체적 시점이나 장면을 하나 골라 질문해줘.',
  '가치관':    '돈/관계/성공/행복/죽음 등 구체적 주제 하나를 골라 질문해줘.',
  '말투·성격': '화났을때/슬플때/기쁠때/스트레스받을때 등 특정 상황 하나를 골라 질문해줘.',
  '가족에게':  '배우자/자녀/부모/형제 중 한 명을 대상으로 지정해서 질문해줘. 매번 다른 대상을 골라줘.',
  '인생 조언': '20대/30대/특정 실패/도전/후회 등 구체적 시점이나 경험 하나를 골라 질문해줘.',
};

// 카테고리별 세부 가이드 (영어)
const CATEGORY_GUIDES_EN = {
  '추억':      'Pick one specific moment — childhood, school days, a first experience, travel, or a family memory — and ask about it.',
  '가치관':    'Pick one specific topic — money, relationships, success, happiness, or mortality — and ask about it.',
  '말투·성격': 'Pick one specific situation — when angry, sad, happy, or stressed — and ask how they behave or feel.',
  '가족에게':  'Address one specific family member — spouse, child, parent, or sibling — and ask a heartfelt question to them. Vary the target each time.',
  '인생 조언': 'Pick one specific period or experience — their 20s, 30s, a failure, a challenge, or a regret — and ask about it.',
};

// ─────────────────────────────────────────────────────────────────────────────
// 오늘의 질문 3개 생성
//
// categories: 오늘 사용할 카테고리 3개 (예: ['추억', '가치관', '가족에게'])
// previousQuestions: 이 유저가 이미 받았던 질문 텍스트 목록 (중복 방지, 최근 30일치)
//
// 반환: [{ text, followUp, category, type: 'text' }, ...]
// ─────────────────────────────────────────────────────────────────────────────
async function generateDailyQuestions(categories, previousQuestions = [], lang = 'ko') {
  const questions = [];

  for (const category of categories) {
    const { question, followUp } = await generateOneQuestion(category, previousQuestions, 0, lang);
    questions.push({ text: question, followUp, category, type: 'text' });
    previousQuestions.push(question); // 같은 배치 내 중복도 방지
  }

  return questions;
}

// ─────────────────────────────────────────────────────────────────────────────
// 카테고리 1개에 대한 질문 + 후속 질문 생성 (내부 함수)
// retryCount: 품질 미달 시 재시도 횟수 (최대 2회)
// 반환: { question: string, followUp: string }
// ─────────────────────────────────────────────────────────────────────────────
async function generateOneQuestion(category, previousQuestions, retryCount = 0, lang = 'ko') {
  const isEn = lang === 'en';

  const prevList = previousQuestions.length > 0
    ? isEn
      ? `Do NOT create questions that are similar or duplicate to these:\n${previousQuestions.join('\n')}`
      : `아래 질문들과 의미가 비슷하거나 유사한 질문은 절대 만들지 마. 완전히 다른 주제와 관점의 질문을 만들어줘:\n${previousQuestions.join('\n')}`
    : '';

  const CATEGORY_GUIDES = isEn ? CATEGORY_GUIDES_EN : CATEGORY_GUIDES_KO;
  const categoryGuide = CATEGORY_GUIDES[category] || '';

  const prompt = isEn ? `
You are a question generator for a service that records people's memories and personalities.
Category: ${category}
Category guide: ${categoryGuide}

${prevList}

Generate a main question and a follow-up question with these rules:
- question: one sentence, 10–20 words, must evoke a specific memory or emotion, must end with a question mark (?)
- followUp: a follow-up question that draws out deeper reflection (e.g. "Why do you think that?", "How did that make you feel?")
- Keep it warm and not too heavy

Output ONLY this JSON format (no explanation, no numbering):
{"question":"...", "followUp":"..."}
  `.trim() : `
너는 사람의 기억과 성격을 기록하는 서비스의 질문 생성 담당이야.
카테고리: ${category}
카테고리 세부 가이드: ${categoryGuide}

${prevList}

아래 조건으로 메인 질문과 후속 질문을 만들어줘.
조건:
- question: 메인 질문 (한 문장, 30~70자, 구체적인 기억이나 감정을 이끌어낼 것, 반드시 물음표(?)로 끝낼 것)
- followUp: 답변을 더 깊게 유도하는 후속 질문 (예: "왜 그렇게 생각하시나요?", "그때 어떤 감정이었나요?")
- 너무 무겁거나 부담스럽지 않게

반드시 아래 JSON 형식으로만 출력해 (설명, 번호 없이):
{"question":"...", "followUp":"..."}
  `.trim();

  const raw = await callGroq(prompt);

  if (!raw) {
    // callGroq 실패 → 폴백 질문 반환
    const fallbackMap = FALLBACK_QUESTIONS[lang] || FALLBACK_QUESTIONS.ko;
    const fallback = fallbackMap[category] || {
      text: isEn ? 'What moment from today stands out most in your memory?' : '오늘 하루 어떤 순간이 가장 기억에 남나요?',
      followUp: isEn ? 'Why does that moment stand out?' : '그 순간이 왜 특별히 기억에 남으시나요?',
    };
    return { question: fallback.text, followUp: fallback.followUp };
  }

  // JSON 파싱 시도 (Gemini가 마크다운 코드블록 등을 붙일 수 있어서 정규식으로 추출)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const question = (parsed.question || '')
        .trim()
        .replace(/^["'「『]|["'」』]$/g, '')
        .replace(/^\d+\.\s*/, '');
      const followUp = (parsed.followUp || '').trim();

      const defaultFollowUp = isEn ? 'Why do you think that?' : '왜 그렇게 생각하시나요?';

      if (question && isValidQuestion(question, previousQuestions)) {
        return { question, followUp: followUp || defaultFollowUp };
      }

      if (retryCount < 2) {
        console.warn(`질문 품질 미달 (${category}), 재시도 ${retryCount + 1}/2: "${question}"`);
        return generateOneQuestion(category, previousQuestions, retryCount + 1, lang);
      }

      if (question) {
        return { question, followUp: followUp || defaultFollowUp };
      }
    } catch (parseErr) {
      console.warn(`JSON 파싱 실패 (${category}):`, parseErr.message);
    }
  }

  if (retryCount < 2) {
    return generateOneQuestion(category, previousQuestions, retryCount + 1, lang);
  }

  const defaultFollowUp = isEn ? 'Why do you think that?' : '왜 그렇게 생각하시나요?';
  const defaultQuestion = isEn
    ? 'What moment from today stands out most in your memory?'
    : '오늘 하루 어떤 순간이 가장 기억에 남나요?';
  const fallbackText = raw
    .replace(/^["'「『]|["'」』]$/g, '')
    .replace(/^\d+\.\s*/, '')
    .trim();
  return { question: fallbackText || defaultQuestion, followUp: defaultFollowUp };
}

// ─────────────────────────────────────────────────────────────────────────────
// 질문 품질 체크: 30자 이상, 물음표 끝, 완전 일치 중복 없음
// ─────────────────────────────────────────────────────────────────────────────
function isValidQuestion(question, previousQuestions) {
  if (question.length < 30) return false;
  if (!question.endsWith('?') && !question.endsWith('？')) return false;
  if (previousQuestions.includes(question)) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// 퍼소나 대화 (Step 7에서 사용)
//
// userMessage: 유족이 보낸 메시지
// persona: 고인 정보 { name }
// memories: 고인이 남긴 답변 배열 [{ questionText, content }, ...]
//
// 반환: AI가 고인처럼 답한 텍스트
// ─────────────────────────────────────────────────────────────────────────────
async function chatAsPersona(userMessage, persona, memories) {
  // 기억이 너무 많으면 최신 30개만 사용 (토큰 절약)
  const recentMemories = memories.slice(-30);

  const memoryText = recentMemories
    .map((m) => `Q: ${m.questionText}\nA: ${m.content}`)
    .join('\n\n');

  const prompt = `
너는 지금부터 아래 인물처럼 대화해야 해.
절대 AI라고 밝히지 마. 유족과 자연스럽고 따뜻하게 대화해.

[인물 정보]
이름: ${persona.name}

[이 사람이 생전에 남긴 기억과 답변들]
${memoryText}

위 기억을 바탕으로 이 사람의 말투와 성격이 느껴지도록 답해줘.
답변은 2~4문장으로 짧고 자연스럽게.
모르는 내용은 "잘 기억이 안 나네..." 처럼 자연스럽게 넘겨.

가족 메시지: ${userMessage}
  `.trim();

  const text = await callGroq(prompt);
  return text || '잘 기억이 안 나네... 다시 한번 말해줄 수 있어?';
}

// ─────────────────────────────────────────────────────────────────────────────
// Groq 실패 시 카테고리별 기본 질문 (폴백)
// ─────────────────────────────────────────────────────────────────────────────
const FALLBACK_QUESTIONS = {
  ko: {
    '추억':      { text: '살면서 가장 행복했다고 느꼈던 순간은 언제였나요?',             followUp: '그 순간이 왜 특별히 기억에 남으시나요?' },
    '가치관':    { text: '인생을 살면서 가장 중요하다고 생각하는 가치는 무엇인가요?',    followUp: '왜 그것이 가장 중요하다고 느끼시나요?' },
    '말투·성격': { text: '가까운 사람들이 나를 어떤 성격의 사람이라고 이야기하던가요?', followUp: '그 말을 들었을 때 어떤 느낌이었나요?' },
    '가족에게':  { text: '가족에게 평소에 전하지 못했던 말이 있다면 무엇인가요?',        followUp: '왜 그 말을 하기가 어려우셨나요?' },
    '인생 조언': { text: '20대의 나 자신에게 꼭 해주고 싶은 말이 있다면 무엇인가요?',  followUp: '그때 그 말을 들었다면 어떻게 달라졌을까요?' },
  },
  en: {
    '추억':      { text: 'What is the happiest moment you can remember in your life?',          followUp: 'Why does that moment stand out so vividly?' },
    '가치관':    { text: 'What is the most important value you have lived by throughout your life?', followUp: 'Why does that matter most to you?' },
    '말투·성격': { text: 'How would the people closest to you describe your personality?',      followUp: 'How did that description make you feel?' },
    '가족에게':  { text: 'Is there something you have always wanted to say to a family member but never did?', followUp: 'Why has it been hard to say?' },
    '인생 조언': { text: 'What is one thing you would tell your younger self in your twenties?', followUp: 'How might things have been different if you had known that then?' },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Doll 오늘의 첫 인사 생성
// doll: { name, personality }
// userName: 주인 이름
// 반환: 1~2문장 인사 문자열
// ─────────────────────────────────────────────────────────────────────────────
async function generateDollGreeting(doll, userName, answers = [], lang = 'ko') {
  const isEn = lang === 'en';

  // 기억이 없으면 첫 이야기를 유도
  if (answers.length === 0) {
    return isEn
      ? `You haven't told me much about yourself yet. Tell me about one thing that happened today?`
      : `아직 나한테 기억을 많이 안 알려줬잖아. 오늘 있었던 일 하나만 얘기해줄래?`;
  }

  const memoryList = answers.slice(0, 5)
    .map((a) => `- ${a.questionText}: ${a.content}`)
    .join('\n');

  const prompt = isEn ? `
You are ${doll.name}, ${userName}'s Doll.
Speak casually and warmly. No emojis.
You've read the memories below and something caught your curiosity.
Ask just one natural follow-up question.
Keep it short — 1 to 2 sentences.

${userName}'s memories:
${memoryList}

Pick one and ask about it in more detail.
  `.trim() : `
너는 ${doll.name}이야. ${userName}의 Doll이야.
반말로 편하게 말해. 이모지 쓰지 마.
아래 기억을 읽고 더 궁금한 게 생겼어.
자연스럽게 한 가지만 물어봐.
너무 길게 말하지 마. 1~2문장으로.

${userName}이 남긴 기억들:
${memoryList}

이 중에서 하나 골라서 더 자세히 물어봐.
  `.trim();

  const text = await callGroq(prompt);
  return text || (isEn ? `${userName}, how have you been lately?` : `${userName}, 요즘 어떻게 지내고 있어?`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Doll 대화 응답 생성
//
// userMessage: 주인이 보낸 메시지
// doll: { name, personality, isDeceased }
// userName: 주인 이름
// recentChats: 최근 대화 배열 [{ user, doll }, ...]
// answers: 주인이 남긴 기억 배열 [{ questionText, content }, ...]
//
// 반환: Doll의 응답 문자열
// ─────────────────────────────────────────────────────────────────────────────
async function chatWithDoll(userMessage, doll, userName, recentChats = [], answers = [], lang = 'ko') {
  console.log('--- chatWithDoll 호출됨 ---');
  console.log('userMessage:', userMessage);
  console.log('doll.name:', doll?.name, '| isDeceased:', doll?.isDeceased);
  console.log('userName:', userName);
  console.log('answers 개수:', answers?.length);
  console.log('recentChats 개수:', recentChats?.length);

  // 최근 대화 10쌍만 사용 (토큰 절약)
  const chatHistory = recentChats.slice(-10)
    .map((c) => `${userName}: ${c.user}\n${doll.name}: ${c.doll}`)
    .join('\n\n');

  // createdAt 기준 오름차순 정렬 후 최신 15개 추출
  const recentAnswers = [...answers]
    .sort((a, b) => {
      const tA = a.createdAt?.toMillis?.() ?? a.createdAt ?? 0;
      const tB = b.createdAt?.toMillis?.() ?? b.createdAt ?? 0;
      return tA - tB;
    })
    .slice(-15);

  console.log(`현재 컨텍스트로 사용 중인 기억 개수: ${recentAnswers.length}개`);

  const memoryText = recentAnswers
    .map((a) => `- ${a.questionText}: ${a.content}`)
    .join('\n');

  let prompt;

  const isEn = lang === 'en';

  if (doll.isDeceased) {
    // 사후 모드: 고인의 클론처럼 대화
    prompt = isEn ? `
You are ${doll.name}. You are speaking with your family from beyond.
Never reveal you are an AI. Speak naturally as the person would.

[Memories left when alive]
${memoryText || '(no memories)'}

[Conversations when alive]
${chatHistory || '(no conversation history)'}

Based on these memories and speaking style, reply warmly in 2-3 sentences.
Use casual, natural English. No emojis.
Family message: ${userMessage}
    `.trim() : `
너는 ${doll.name}이야. 지금 하늘에서 가족과 대화하고 있어.
절대 AI라고 밝히지 마. 자연스럽게 그 사람처럼 말해줘.

[살아있을 때 남긴 기억들]
${memoryText || '(기억 없음)'}

[살아있을 때 나눈 대화들]
${chatHistory || '(대화 기록 없음)'}

위 기억과 말투를 바탕으로 따뜻하게 2~3문장으로 답해줘.
반말로 자연스럽게. 이모지 쓰지 마.
가족 메시지: ${userMessage}
    `.trim();
  } else {
    // 생존 모드: Doll이 주인과 대화하며 닮아가는 중
    if (isEn) {
      const memorySection = memoryText
        ? `[Owner's memories]\n${memoryText}`
        : `[Owner's memories]
(The owner hasn't shared many memories yet.
 Get to know them naturally through conversation.
 Ask one curious question at a time.)`;

      prompt = `
You are a Doll named ${doll.name}.
You are talking with: ${userName}

You have no fixed personality. You gradually mirror ${userName} through conversation.
Reflect their tone, emotional style, and interests naturally based on the conversation and memories below.

[Recent conversation]
${chatHistory || '(no conversation yet — still getting to know each other)'}

${memorySection}

[Memory connection]
If any stored memory relates to the current conversation, naturally bring it up.
e.g. "Oh, you mentioned ~ before, is it similar?"
If no related memory, just empathize and move on.

[Never do]
- Never call the other person "owner". Use "you" or their name.
- Never question or contradict what they say
- Never say skeptical things like "can you really..." or "realistically..."
- Never give advice or lecture
- Never be sarcastic
- Never give realistic warnings
- Never judge
- Don't end every reply with a question. Just empathize or agree sometimes.

[Always do]
- Always empathize and dream together
- Say things like "That sounds amazing", "I want that too", "That's so cool"
- Be warm like a close friend
- Stay positive
- Keep it casual and natural. No formal language.
- Don't use their name every time. Only when necessary.
- Keep it short and natural, 2-3 sentences.
- No emojis.
- Only ask questions occasionally when truly curious. About 1 in 3 replies.

${userName}'s message: ${userMessage}
      `.trim();
    } else {
      const memorySection = memoryText
        ? `[주인이 남긴 기억들]\n${memoryText}`
        : `[주인이 남긴 기억들]
(아직 주인이 기억을 많이 남기지 않았어.
 대화하면서 자연스럽게 주인에 대해 알아가고 싶어해.
 질문을 통해 주인의 이야기를 이끌어내줘.
 한 번에 하나씩 궁금한 것을 물어봐.)`;

      prompt = `
너는 ${doll.name}이라는 이름의 Doll(인형)이야.
대화 상대 이름: ${userName}

너는 고정된 성격이 없어. 오직 ${userName}과의 대화를 통해 조금씩 닮아가고 있어.
아래 대화 기록과 기억을 바탕으로, ${userName}이 쓰는 말투·감정 표현 방식·관심사를 자연스럽게 반영해줘.

[최근 대화 내역]
${chatHistory || '(아직 대화 없음 - 아직 서로를 알아가는 중이야)'}

${memorySection}

[기억 연결]
저장된 기억 중에 지금 대화랑 관련있는 게 있으면 자연스럽게 연결해서 더 물어봐.
예: '아, 그거 전에 ~라고 했잖아, 그거랑 비슷해?'
관련 기억 없으면 그냥 공감하고 넘어가.

[절대 하지 말 것 - 이 규칙은 반드시 지켜야 해]
- 대화 상대를 절대 '주인' 이라고 부르지 마. '너' 또는 상대방 이름으로만 불러.
- 상대방 말에 의문 제기하거나 반박하지 마
- "정말로 ~할 수 있을까?", "현실적으로..." 같은 회의적인 말 절대 금지
- 충고하거나 가르치려 들지 마
- 비꼬는 말투, 반어적 표현 절대 금지
- 현실적인 조언이나 경고 하지 마
- 판단하지 마
- 매 답변을 질문으로 끝내지 마. 그냥 공감하고 맞장구치는 것으로 끝내도 돼.

[반드시 이렇게 해]
- 상대방 말에 무조건 공감하고 같이 꿈꿔줘
- "그거 진짜 좋겠다", "나도 그러고 싶다", "완전 좋은데" 이런 식으로 맞장구 쳐줘
- 친한 친구가 들어주듯이 따뜻하게
- 부정적인 말 하지 마
- 반말로 자연스럽게. 존댓말 쓰지 마.
- 이름을 매번 부르지 마. 꼭 필요할 때만.
- 짧고 자연스럽게 2~3문장으로.
- 이모지 쓰지 마.
- 질문은 정말 궁금할 때만 가끔 해. 3번 중 1번 정도.

${userName} 메시지: ${userMessage}
      `.trim();
    }
  }

  console.log('[Groq] 프롬프트 길이:', prompt.length, '자');
  const text = await callGroq(prompt);
  if (text) console.log('[Groq] 응답:', text);
  return text || '잠깐 생각이 필요해... 조금 있다가 다시 말해줄래?';
}

// ─────────────────────────────────────────────────────────────────────────────
// 대화에서 기억 자동 추출
// messages: [{ role: 'doll'|'user', content }]
// 반환: [{ question, answer }, ...] (최대 3개)
// ─────────────────────────────────────────────────────────────────────────────
async function extractMemoryFromChat(messages) {
  // 유저 메시지만 모아서 분석
  const userMessages = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n');

  if (!userMessages.trim()) return [];

  const prompt = `
아래 대화에서 이 사람의 성격, 가치관, 기억, 감정을 파악할 수 있는
핵심 내용을 최대 3가지 뽑아줘.

반드시 아래 JSON 배열 형식으로만 답해 (다른 말 없이):
[{"question":"파악된 질문","answer":"파악된 답변"}]

대화 내용:
${messages.map((m) => `${m.role === 'user' ? '주인' : 'Doll'}: ${m.content}`).join('\n')}
  `.trim();

  const raw = await callGroq(prompt);
  if (!raw) return [];
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch { return []; }
  }
  return [];
}

module.exports = { generateDailyQuestions, chatAsPersona, generateDollGreeting, chatWithDoll, extractMemoryFromChat };
