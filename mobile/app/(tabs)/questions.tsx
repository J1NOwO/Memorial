// app/(tabs)/questions.tsx - 오늘의 질문 답변 페이지
// 웹 DailyQuestion.jsx → React Native 변환
// textarea → TextInput (multiline)
// ImageUploader → 생략 (모바일 향후 추가)
// 보석 팝업: Modal로 변환

import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, Modal, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useMemorial } from '@/context/MemorialContext';
import { useT } from '@/hooks/useT';
import { useLang } from '@/contexts/LanguageContext';
import { apiCall } from '@/utils/api';
import { Colors } from '@/constants/colors';

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  '추억':       { bg: '#fef3e2', text: '#b7791f' },
  '가치관':     { bg: '#e8f4fd', text: '#2b6cb0' },
  '말투·성격':  { bg: '#f0fdf4', text: '#276749' },
  '가족에게':   { bg: '#fdf2f8', text: '#97266d' },
  '인생 조언':  { bg: '#f5f0ff', text: '#6b46c1' },
  '자유':       { bg: '#faf7f4', text: '#7a6355' },
};

function getEncouragementMsg(count: number, t: any): string | null {
  if (count >= 6) return t.encourage_lots;
  if (count >= 3) return t.encourage_many;
  if (count >= 1) return t.encourage_some;
  return null;
}

export default function QuestionsScreen() {
  const router = useRouter();
  const { user, addGems } = useAuth();
  const { isMemorial } = useMemorial();
  const t = useT();
  const { lang } = useLang();

  const [baseQuestions, setBaseQuestions]   = useState<any[]>([]);
  const [extraQuestions, setExtraQuestions] = useState<any[]>([]);
  const [extraLoading, setExtraLoading]     = useState(false);
  const [extraError, setExtraError]         = useState('');

  const [answeredMap, setAnsweredMap] = useState<Record<string, string>>({});
  const [activeId, setActiveId]       = useState<string | null>(null);
  const [textInput, setTextInput]     = useState('');
  const [isPrivate, setIsPrivate]     = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState('');

  const [showGemPopup, setShowGemPopup]     = useState(false);
  const [gemRewardGiven, setGemRewardGiven] = useState(false);

  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError]     = useState('');
  const [aiSource, setAiSource]       = useState('');

  const allQuestions  = [...baseQuestions, ...extraQuestions];
  const answeredCount = Object.keys(answeredMap).length;
  const allBaseAnswered = baseQuestions.length > 0 &&
    baseQuestions.every((q) => answeredMap[q.id || q.text] !== undefined);

  // 추모 모드면 완료 화면
  if (isMemorial) {
    return (
      <SafeAreaView style={S.safe}>
        <View style={S.centered}>
          <Text style={{ fontSize: 52 }}>†</Text>
          <Text style={S.memorialTitle}>{t.memorial_record_complete}</Text>
          <Text style={S.memorialDesc}>{t.memorial_record_kept}</Text>
          <TouchableOpacity style={S.backBtn} onPress={() => router.back()}>
            <Text style={S.backBtnText}>← {t.back}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  useEffect(() => {
    async function init() {
      const questions = await loadTodayQuestions();
      if (questions.length > 0) await loadTodayAnswers(questions);
      setPageLoading(false);
    }
    init();
  }, [user]);

  async function loadTodayQuestions() {
    try {
      const data = await apiCall('GET', `/api/questions/daily?lang=${lang}`);
      setBaseQuestions(data.questions);
      setAiSource('ai');
      return data.questions;
    } catch {
      setLoadError(t.question_load_fail);
      return [];
    }
  }

  async function loadTodayAnswers(questions: any[]) {
    try {
      const ids  = questions.map((q) => q.id || q.text);
      const snap = await firestore()
        .collection('answers')
        .where('userId', '==', user!.uid)
        .where('questionKey', 'in', ids)
        .get();
      const today = new Date().toISOString().split('T')[0];
      const map: Record<string, string> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.createdAt) {
          const date = data.createdAt.toDate?.().toISOString().split('T')[0];
          if (date === today) map[data.questionKey] = data.content;
        }
      });
      setAnsweredMap(map);
    } catch (err: any) {
      console.warn('오늘 답변 로드 실패:', err.message);
    }
  }

  function handleCardClick(question: any) {
    const key = question.id || question.text;
    if (answeredMap[key] !== undefined) return;
    if (activeId === key) {
      setActiveId(null);
    } else {
      setActiveId(key);
      setTextInput('');
      setIsPrivate(false);
      setError('');
    }
  }

  async function handleSubmit(question: any) {
    if (!textInput.trim()) { setError(t.validation_answer); return; }
    setSubmitting(true); setError('');
    try {
      const questionKey = question.id || question.text;
      await firestore().collection('answers').add({
        userId:       user!.uid,
        questionId:   question.id || null,
        questionKey,
        questionText: question.text,
        category:     question.category,
        type:         'text',
        content:      textInput.trim(),
        isPrivate,
        audioUrl:     '',
        imageUrls:    [],
        createdAt:    firestore.FieldValue.serverTimestamp(),
      });

      const newAnsweredMap = { ...answeredMap, [questionKey]: textInput.trim() };
      setAnsweredMap(newAnsweredMap);
      setActiveId(null);

      const isBaseQ = baseQuestions.some((q) => (q.id || q.text) === questionKey);
      if (isBaseQ) {
        const allBaseDone = baseQuestions.every((q) => newAnsweredMap[q.id || q.text] !== undefined);
        if (allBaseDone && !gemRewardGiven) {
          setGemRewardGiven(true);
          setShowGemPopup(true);
          addGems(10);
        }
      }
      const isExtraQ = extraQuestions.some((q) => (q.id || q.text) === questionKey);
      if (isExtraQ) addGems(3);
    } catch {
      setError(t.error_save);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestExtra() {
    setExtraLoading(true); setExtraError('');
    try {
      const askedTexts = allQuestions.map((q) => q.text);
      const data = await apiCall('POST', '/api/questions/extra', { askedTexts, lang });
      if (!data.question) throw new Error(t.question_no_data);
      setExtraQuestions((prev) => [...prev, data.question]);
    } catch (err: any) {
      setExtraError(err.message || t.error_default);
    } finally {
      setExtraLoading(false);
    }
  }

  return (
    <SafeAreaView style={S.safe}>
      {/* 헤더 */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={S.backLink}>{t.back_dashboard}</Text>
        </TouchableOpacity>
        <Text style={S.logo}>Memorial</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={S.main} keyboardShouldPersistTaps="handled">
        {/* 타이틀 */}
        <View style={S.titleArea}>
          <View style={S.titleRow}>
            <Text style={S.title}>{t.daily_question_title}</Text>
            {!pageLoading && aiSource === 'ai' && (
              <View style={S.aiBadge}>
                <Text style={S.aiBadgeText}>{t.ai_generated}</Text>
              </View>
            )}
          </View>
          <Text style={S.dateText}>
            {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
          </Text>
          {!pageLoading && (
            <View style={S.progressArea}>
              <Text style={S.progressCount}>{t.today_count(answeredCount)}</Text>
              {getEncouragementMsg(answeredCount, t) && (
                <Text style={S.encourageMsg}>{getEncouragementMsg(answeredCount, t)}</Text>
              )}
            </View>
          )}
        </View>

        {pageLoading && (
          <View style={S.loadingBox}>
            <ActivityIndicator color={Colors.accent} />
            <Text style={S.loadingText}>{t.question_loading}</Text>
          </View>
        )}

        {!pageLoading && !!loadError && (
          <View style={S.errorBox}>
            <Text style={S.errorText}>{loadError}</Text>
          </View>
        )}

        {!pageLoading && (
          <View style={{ gap: 12 }}>

            {/* 일기 바로가기 */}
            <TouchableOpacity style={S.diaryShortcut} onPress={() => router.push('/(tabs)/diary' as any)}>
              <Text style={{ fontSize: 18 }}>📓</Text>
              <View style={{ flex: 1 }}>
                <Text style={S.questionText}>{t.diary_shortcut_title}</Text>
                <Text style={S.freeSubTitle}>{t.diary_shortcut_desc}</Text>
              </View>
              <Text style={{ color: Colors.accent, fontSize: 18 }}>→</Text>
            </TouchableOpacity>

            {/* 질문 카드들 */}
            {allQuestions.map((question, index) => {
              const key        = question.id || question.text;
              const isAnswered = answeredMap[key] !== undefined;
              const isOpen     = activeId === key;
              const catColor   = CATEGORY_COLORS[question.category] || { bg: '#f0f0f0', text: '#555' };

              return (
                <View key={key} style={[
                  S.questionCard,
                  isAnswered && S.questionCardDone,
                  isOpen     && S.questionCardOpen,
                ]}>
                  <TouchableOpacity
                    style={S.cardHeader}
                    onPress={() => handleCardClick(question)}
                    disabled={isAnswered}
                    activeOpacity={0.7}
                  >
                    <View style={[S.questionNum, isAnswered && S.questionNumDone]}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isAnswered ? '#fff' : Colors.textMid }}>
                        {isAnswered ? '✓' : index + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <View style={[S.categoryBadge, { backgroundColor: catColor.bg }]}>
                          <Text style={[S.categoryBadgeText, { color: catColor.text }]}>{question.category}</Text>
                        </View>
                      </View>
                      <Text style={[S.questionText, isAnswered && { color: Colors.textMid }]}>
                        {question.text}
                      </Text>
                      {isAnswered && (
                        <Text style={S.answeredPreview} numberOfLines={2}>{answeredMap[key]}</Text>
                      )}
                    </View>
                    {!isAnswered && (
                      <Text style={[S.arrow, isOpen && { transform: [{ rotate: '180deg' }] }]}>▾</Text>
                    )}
                  </TouchableOpacity>

                  {/* 답변 폼 */}
                  {isOpen && (
                    <View style={S.answerForm}>
                      <View style={S.divider} />
                      {question.followUp && (
                        <View style={S.followUpHint}>
                          <Text style={S.followUpText}>💬 {question.followUp}</Text>
                        </View>
                      )}
                      {!!error && (
                        <View style={S.errorBox}>
                          <Text style={S.errorText}>{error}</Text>
                        </View>
                      )}
                      <TextInput
                        style={S.textarea}
                        placeholder={t.answer_placeholder}
                        placeholderTextColor={Colors.textMuted}
                        value={textInput}
                        onChangeText={setTextInput}
                        multiline
                        numberOfLines={5}
                        textAlignVertical="top"
                      />
                      {/* 비공개 토글 */}
                      <TouchableOpacity
                        style={[S.privateToggle, isPrivate && S.privateToggleOn]}
                        onPress={() => setIsPrivate((v) => !v)}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 20 }}>{isPrivate ? '🔒' : '🔓'}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={S.privateTitle}>{isPrivate ? t.private_post_label : t.public_label}</Text>
                          <Text style={S.privateDesc}>{isPrivate ? t.private_post_desc : t.public_desc}</Text>
                        </View>
                        <View style={[S.toggleDot, isPrivate && S.toggleDotOn]} />
                      </TouchableOpacity>
                      <View style={S.formFooter}>
                        <TouchableOpacity
                          style={S.btnCancel}
                          onPress={() => { setActiveId(null); setError(''); }}
                          disabled={submitting}
                        >
                          <Text style={S.btnCancelText}>{t.cancel}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[S.btnSubmit, (submitting) && { opacity: 0.55 }]}
                          onPress={() => handleSubmit(question)}
                          disabled={submitting}
                        >
                          <Text style={S.btnSubmitText}>{submitting ? t.loading : t.save}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {/* 추가 질문 버튼 */}
            {allBaseAnswered && (
              <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                {extraLoading ? (
                  <ActivityIndicator color={Colors.accent} />
                ) : (
                  <>
                    {!!extraError && (
                      <View style={[S.errorBox, { marginBottom: 8, width: '100%' }]}>
                        <Text style={S.errorText}>{extraError}</Text>
                      </View>
                    )}
                    <TouchableOpacity style={S.btnExtra} onPress={handleRequestExtra}>
                      <Text style={S.btnExtraText}>{t.add_question}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {answeredCount > 0 && (
              <TouchableOpacity style={{ alignItems: 'center', marginTop: 8 }} onPress={() => router.push('/(tabs)/memories' as any)}>
                <Text style={{ fontSize: 14, color: Colors.accent, fontWeight: '600' }}>{t.memory_link}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* 보석 팝업 */}
      <Modal visible={showGemPopup} transparent animationType="fade">
        <View style={S.popupOverlay}>
          <View style={S.popupCard}>
            <Text style={{ fontSize: 52, textAlign: 'center' }}>🎉</Text>
            <Text style={S.popupTitle}>{t.gem_popup_title}</Text>
            <View style={S.popupGemRow}>
              <Text style={{ fontSize: 24 }}>💎</Text>
              <Text style={S.popupGemText}>{t.gem_popup_reward}</Text>
            </View>
            <TouchableOpacity style={S.popupBtn} onPress={() => setShowGemPopup(false)}>
              <Text style={S.popupBtnText}>{t.confirm}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },

  memorialTitle: { fontSize: 20, fontWeight: '700', color: Colors.primary, textAlign: 'center' },
  memorialDesc:  { fontSize: 14, color: Colors.textMuted, lineHeight: 25, textAlign: 'center' },
  backBtn:       { marginTop: 8, paddingVertical: 13, paddingHorizontal: 32, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.card },
  backBtnText:   { fontSize: 14, fontWeight: '600', color: Colors.textMid },

  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  backLink: { color: Colors.textMid, fontSize: 14, width: 80 },
  logo:     { fontSize: 20, fontWeight: '700', color: Colors.primary, letterSpacing: 2 },

  main:     { padding: 20 },

  titleArea:     { marginBottom: 28 },
  titleRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  title:         { fontSize: 26, fontWeight: '700', color: Colors.primary },
  aiBadge:       { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 99 },
  aiBadgeText:   { fontSize: 11, color: '#276749', fontWeight: '600' },
  dateText:      { fontSize: 13, color: Colors.textMuted, marginBottom: 16 },
  progressArea:  { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  progressCount: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  encourageMsg:  { fontSize: 13, color: Colors.textMuted },

  loadingBox:  { paddingVertical: 40, alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 15, color: Colors.textMuted },
  errorBox:    { backgroundColor: '#fdf0f0', borderRadius: 8, padding: 12, borderLeftWidth: 3, borderLeftColor: Colors.error, marginBottom: 8 },
  errorText:   { color: Colors.error, fontSize: 13 },

  diaryShortcut: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.border },

  questionCard:     { backgroundColor: Colors.card, borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: Colors.transparent },
  questionCardDone: { opacity: 0.7, backgroundColor: '#f5f2ee' },
  questionCardOpen: { borderColor: Colors.accent },
  cardHeader:       { flexDirection: 'row', alignItems: 'flex-start', gap: 16, padding: 20 },
  questionNum:      { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f0ebe4', alignItems: 'center', justifyContent: 'center' },
  questionNumDone:  { backgroundColor: Colors.accent },
  categoryBadge:    { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 99 },
  categoryBadgeText:{ fontSize: 11, fontWeight: '600' },
  questionText:     { fontSize: 16, lineHeight: 26, color: Colors.text, fontWeight: '500' },
  freeSubTitle:     { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  answeredPreview:  { marginTop: 8, fontSize: 13, color: Colors.textMuted, lineHeight: 20, fontStyle: 'italic' },
  arrow:            { fontSize: 18, color: Colors.accent, marginTop: 4 },

  answerForm:   { paddingHorizontal: 20, paddingBottom: 20 },
  divider:      { height: 1, backgroundColor: '#f0ebe4', marginBottom: 16 },
  followUpHint: { backgroundColor: '#fef8f2', borderWidth: 1, borderColor: '#f0ddc8', borderRadius: 10, padding: 12, marginBottom: 14 },
  followUpText: { fontSize: 14, color: Colors.textMid, lineHeight: 22 },
  textarea: {
    backgroundColor: '#faf7f4', borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 10, padding: 14, fontSize: 15, color: Colors.text, lineHeight: 24,
    minHeight: 120, marginBottom: 12,
  },
  privateToggle:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, backgroundColor: '#f7f3ee', borderWidth: 1.5, borderColor: Colors.border, marginBottom: 12 },
  privateToggleOn: { backgroundColor: '#fef8f2', borderColor: Colors.accent },
  privateTitle:    { fontSize: 13, fontWeight: '600', color: Colors.text },
  privateDesc:     { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  toggleDot:       { width: 36, height: 20, backgroundColor: '#d8d0c8', borderRadius: 10 },
  toggleDotOn:     { backgroundColor: Colors.accent },
  formFooter:      { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  btnCancel:       { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border },
  btnCancelText:   { fontSize: 14, color: Colors.textMid },
  btnSubmit:       { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10, backgroundColor: Colors.accent },
  btnSubmitText:   { fontSize: 14, fontWeight: '600', color: '#fff' },

  btnExtra:     { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.accent, borderStyle: 'dashed', backgroundColor: '#fef8f2', width: '100%' },
  btnExtraText: { fontSize: 14, fontWeight: '600', color: Colors.accent, textAlign: 'center' },

  // 보석 팝업
  popupOverlay: { flex: 1, backgroundColor: 'rgba(61,46,34,0.5)', alignItems: 'center', justifyContent: 'center' },
  popupCard:    { backgroundColor: Colors.card, borderRadius: 24, padding: 36, width: '80%', alignItems: 'center', gap: 12 },
  popupTitle:   { fontSize: 20, fontWeight: '700', color: Colors.text, textAlign: 'center', lineHeight: 28 },
  popupGemRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef8f2', borderWidth: 1.5, borderColor: '#f0d8b8', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 20 },
  popupGemText: { fontSize: 16, fontWeight: '700', color: Colors.accent },
  popupBtn:     { width: '100%', paddingVertical: 13, backgroundColor: Colors.accent, borderRadius: 12, alignItems: 'center' },
  popupBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
