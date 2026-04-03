// app/memorial-book.tsx - 추모 방명록
// 웹 MemorialBook.jsx → React Native 변환
// 고인에 대한 메시지를 남기고 조회

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useMemorial } from '@/context/MemorialContext';
import { useT } from '@/hooks/useT';
import { apiCall } from '@/utils/api';
import { Colors } from '@/constants/colors';

function timeAgo(ts: any, t: any): string {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)    return t.time_just_now;
  if (diff < 3600)  return t.time_minutes_ago(Math.floor(diff / 60));
  if (diff < 86400) return t.time_hours_ago(Math.floor(diff / 3600));
  if (diff < 604800)return t.time_days_ago(Math.floor(diff / 86400));
  return t.time_weeks_ago(Math.floor(diff / 604800));
}

export default function MemorialBookScreen() {
  const router  = useRouter();
  const { user, userProfile } = useAuth();
  const { isMemorial, providerName } = useMemorial();
  const t = useT();

  const [messages,   setMessages]   = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [message,    setMessage]    = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [providerId, setProviderId] = useState<string | null>(null);

  const isProvider = userProfile?.role === 'provider';
  const isFamily   = userProfile?.role === 'family';

  // 제공자 uid 찾기
  const resolveProvider = useCallback(async () => {
    if (!user) return;
    if (isProvider) {
      setProviderId(user.uid);
      return;
    }
    // 유족: 연결된 제공자 찾기
    const snap = await firestore()
      .collection('connections')
      .where('familyId', '==', user.uid)
      .where('status', '==', 'accepted')
      .get();
    if (!snap.empty) setProviderId(snap.docs[0].data().providerId);
  }, [user, isProvider]);

  useEffect(() => { resolveProvider(); }, [resolveProvider]);

  const loadMessages = useCallback(async () => {
    if (!providerId) return;
    setLoading(true);
    try {
      const snap = await firestore()
        .collection('memorialBook')
        .where('providerId', '==', providerId)
        .orderBy('createdAt', 'desc')
        .get();
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      Alert.alert(t.memorial_book_load_fail);
    } finally { setLoading(false); }
  }, [providerId]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  async function handleSubmit() {
    if (!message.trim()) return;
    if (!providerId || !user) return;
    setSubmitting(true);
    try {
      const data = {
        providerId,
        authorId:   user.uid,
        authorName: userProfile?.name || '익명',
        content:    message.trim(),
        createdAt:  firestore.FieldValue.serverTimestamp(),
      };
      const ref = await firestore().collection('memorialBook').add(data);
      setMessages(prev => [{ id: ref.id, ...data, createdAt: { toDate: () => new Date() } }, ...prev]);
      setMessage('');
    } catch {
      Alert.alert(t.error_submit);
    } finally { setSubmitting(false); }
  }

  async function handleDelete(id: string) {
    Alert.alert(t.confirm_delete, '', [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete, style: 'destructive',
        onPress: async () => {
          try {
            await firestore().collection('memorialBook').doc(id).delete();
            setMessages(prev => prev.filter(m => m.id !== id));
          } catch { Alert.alert(t.error_delete_book); }
        },
      },
    ]);
  }

  const displayName = providerName || '고인';
  const accent = isMemorial ? Colors.memorial.accent : Colors.accent;
  const bg     = isMemorial ? Colors.memorial.bg    : Colors.bg;
  const card   = isMemorial ? Colors.memorial.card  : Colors.card;
  const textC  = isMemorial ? Colors.memorial.text  : Colors.primary;
  const mutedC = isMemorial ? Colors.memorial.textMuted : Colors.textMuted;

  return (
    <SafeAreaView style={[S.safe, { backgroundColor: bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* 헤더 */}
        <View style={[S.header, isMemorial && { borderBottomColor: Colors.memorial.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[S.back, { color: accent }]}>{t.back}</Text>
          </TouchableOpacity>
          <Text style={[S.title, { color: textC }]}>{t.memorial_book}</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          {/* 히어로 */}
          <View style={[S.hero, { backgroundColor: isMemorial ? Colors.memorial.accentPale : Colors.accentPale }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🕯️</Text>
            <Text style={[S.heroTitle, { color: textC }]}>{t.memorial_book_hero(displayName)}</Text>
            <Text style={[S.heroSub, { color: mutedC }]}>
              {isProvider ? t.memorial_book_provider_hint : t.memorial_book_hero_sub}
            </Text>
          </View>

          {/* 메시지 작성 (유족만) */}
          {isFamily && (
            <View style={[S.inputCard, { backgroundColor: card }, isMemorial && { borderColor: Colors.memorial.border }]}>
              <TextInput
                style={[S.input, {
                  color: textC,
                  borderColor: isMemorial ? Colors.memorial.border : Colors.border,
                  backgroundColor: bg,
                }]}
                placeholder={t.leave_message}
                placeholderTextColor={mutedC}
                multiline
                textAlignVertical="top"
                value={message}
                onChangeText={setMessage}
                maxLength={500}
              />
              <TouchableOpacity
                style={[S.submitBtn, { backgroundColor: accent, opacity: (!message.trim() || submitting) ? 0.5 : 1 }]}
                onPress={handleSubmit}
                disabled={!message.trim() || submitting}
              >
                {submitting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={S.submitText}>{t.memorial_book_submit}</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* 메시지 목록 */}
          <View style={{ padding: 16, gap: 12 }}>
            {loading ? (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <ActivityIndicator color={accent} />
              </View>
            ) : messages.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 36, marginBottom: 12 }}>🕯️</Text>
                <Text style={[S.emptyText, { color: textC }]}>{t.memorial_book_empty1}</Text>
                <Text style={{ fontSize: 13, color: mutedC, marginTop: 4 }}>{t.memorial_book_empty2}</Text>
              </View>
            ) : (
              messages.map(msg => (
                <View
                  key={msg.id}
                  style={[
                    S.msgCard,
                    { backgroundColor: card },
                    isMemorial && { borderColor: Colors.memorial.border },
                  ]}
                >
                  <View style={S.msgTop}>
                    <View style={S.msgAuthor}>
                      <View style={[S.avatar, { backgroundColor: isMemorial ? Colors.memorial.accentPale : Colors.accentPale }]}>
                        <Text style={{ fontSize: 14, color: accent }}>
                          {msg.authorName?.[0] || '?'}
                        </Text>
                      </View>
                      <View>
                        <Text style={[S.authorName, { color: textC }]}>{msg.authorName}</Text>
                        <Text style={[S.msgTime, { color: mutedC }]}>{timeAgo(msg.createdAt, t)}</Text>
                      </View>
                    </View>
                    {/* 본인 메시지 삭제 */}
                    {msg.authorId === user?.uid && (
                      <TouchableOpacity onPress={() => handleDelete(msg.id)}>
                        <Text style={{ fontSize: 12, color: Colors.error }}>{t.delete}</Text>
                      </TouchableOpacity>
                    )}
                    {/* 제공자: 자기 방명록 모든 메시지 삭제 가능 */}
                    {isProvider && msg.authorId !== user?.uid && (
                      <TouchableOpacity onPress={() => handleDelete(msg.id)}>
                        <Text style={{ fontSize: 12, color: Colors.textMuted }}>{t.delete}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={[S.msgContent, { color: isMemorial ? Colors.memorial.textMid : Colors.textMid }]}>
                    {msg.content}
                  </Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  header:  {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  back:    { fontSize: 14, color: Colors.accent },
  title:   { fontSize: 17, fontWeight: '700', color: Colors.primary },

  hero:    { padding: 28, alignItems: 'center' },
  heroTitle:{ fontSize: 20, fontWeight: '700', color: Colors.primary, marginBottom: 6 },
  heroSub: { fontSize: 13, color: Colors.textMid, textAlign: 'center' },

  inputCard: {
    margin: 16, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: Colors.borderLight,
    gap: 10,
  },
  input: {
    minHeight: 80, borderRadius: 10, borderWidth: 1,
    padding: 12, fontSize: 14, lineHeight: 21,
  },
  submitBtn: {
    paddingVertical: 11, borderRadius: 12, alignItems: 'center',
  },
  submitText:{ fontSize: 14, color: '#fff', fontWeight: '700' },

  emptyText: { fontSize: 15, fontWeight: '600', color: Colors.primary },

  msgCard: {
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  msgTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  msgAuthor: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar:    { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  authorName:{ fontSize: 14, fontWeight: '600', color: Colors.primary },
  msgTime:   { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  msgContent:{ fontSize: 14, color: Colors.textMid, lineHeight: 21 },
});
