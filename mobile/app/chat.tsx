// app/chat.tsx - 유족-고인 AI 대화
// 웹 Chat.jsx → React Native 변환
// 사후 전환 완료된 제공자의 AI와 대화 (유족만 접근)

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, FlatList,
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

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: any;
}

export default function ChatScreen() {
  const router  = useRouter();
  const { user, userProfile } = useAuth();
  const { providerName } = useMemorial();
  const t = useT();

  const [messages,   setMessages]   = useState<Message[]>([]);
  const [input,      setInput]      = useState('');
  const [loading,    setLoading]    = useState(true);
  const [sending,    setSending]    = useState(false);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [pName,      setPName]      = useState('');
  const [dollId,     setDollId]     = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  // 연결 정보 + 제공자 검증
  const init = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 유족: 연결된 제공자 찾기
      const connSnap = await firestore()
        .collection('connections')
        .where('familyId', '==', user.uid)
        .where('status', '==', 'accepted')
        .get();
      if (connSnap.empty) {
        Alert.alert(t.chat_no_provider);
        router.back(); return;
      }
      const conn = connSnap.docs[0].data();
      const pid  = conn.providerId;
      setProviderId(pid);

      // 제공자 정보
      const pSnap = await firestore().collection('users').doc(pid).get();
      if (!pSnap.exists) { Alert.alert(t.chat_provider_not_found); router.back(); return; }
      const pData = pSnap.data()!;
      setPName(pData.name || providerName || '');

      // 사후 전환 확인
      if (!pData.isDeceased) {
        Alert.alert(t.chat_not_deceased);
        router.back(); return;
      }

      // Doll ID 조회
      const dollSnap = await firestore()
        .collection('dolls')
        .where('userId', '==', pid)
        .limit(1)
        .get();
      const dId = dollSnap.empty ? null : dollSnap.docs[0].id;
      setDollId(dId);

      // 채팅 기록 불러오기
      const chatSnap = await firestore()
        .collection('chatMessages')
        .where('familyId', '==', user.uid)
        .where('providerId', '==', pid)
        .orderBy('createdAt', 'asc')
        .limit(50)
        .get();

      if (chatSnap.empty) {
        // 첫 대화: 인사 메시지
        setMessages([{
          id: 'greeting',
          role: 'assistant',
          content: t.chat_first_greeting(pData.name || ''),
        }]);
      } else {
        setMessages(chatSnap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
      }
    } catch {
      Alert.alert(t.chat_load_fail);
    } finally { setLoading(false); }
  }, [user, providerName]);

  useEffect(() => { init(); }, [init]);

  // 새 메시지 오면 스크롤 아래로
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || !providerId || !user) return;
    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: input.trim(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await apiCall('POST', '/api/chat', {
        providerId,
        dollId,
        message: userMsg.content,
      });
      const aiMsg: Message = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: res.reply || t.chat_fallback,
      };
      setMessages(prev => [...prev, aiMsg]);

      // Firestore에 저장
      const batch = firestore().batch();
      const colRef = firestore().collection('chatMessages');
      [userMsg, aiMsg].forEach(m => {
        const ref = colRef.doc();
        batch.set(ref, {
          familyId:   user.uid,
          providerId,
          role:       m.role,
          content:    m.content,
          createdAt:  firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    } catch {
      Alert.alert(t.chat_send_fail);
      setMessages(prev => prev.filter(m => m.id !== userMsg.id));
    } finally { setSending(false); }
  }

  const displayName = pName || providerName || '고인';

  return (
    <SafeAreaView style={S.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* 헤더 */}
        <View style={S.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ fontSize: 14, color: Colors.memorial.accent }}>{t.back}</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={S.headerName}>† {displayName}</Text>
            <Text style={S.headerSub}>{t.chat_alive_subtitle}</Text>
          </View>
          <View style={{ width: 48 }} />
        </View>

        {/* 메시지 목록 */}
        {loading ? (
          <View style={S.centered}><ActivityIndicator color={Colors.memorial.accent} /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={[
                S.bubble,
                item.role === 'user'
                  ? S.bubbleUser
                  : S.bubbleAI,
              ]}>
                {item.role === 'assistant' && (
                  <Text style={S.aiLabel}>† {displayName}</Text>
                )}
                <Text style={[
                  S.bubbleText,
                  item.role === 'user' ? { color: '#fff' } : { color: Colors.memorial.text },
                ]}>
                  {item.content}
                </Text>
              </View>
            )}
            ListFooterComponent={sending ? (
              <View style={[S.bubble, S.bubbleAI]}>
                <Text style={S.aiLabel}>† {displayName}</Text>
                <ActivityIndicator size="small" color={Colors.memorial.accent} />
              </View>
            ) : null}
          />
        )}

        {/* 입력창 */}
        <View style={S.inputArea}>
          <TextInput
            style={S.input}
            placeholder={t.chat_input_placeholder(displayName)}
            placeholderTextColor={Colors.memorial.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[S.sendBtn, { opacity: (!input.trim() || sending) ? 0.4 : 1 }]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
          >
            <Text style={S.sendIcon}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.memorial.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header:  {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.memorial.border,
    backgroundColor: 'rgba(13,13,26,0.97)',
  },
  headerName: { fontSize: 16, fontWeight: '700', color: Colors.memorial.text },
  headerSub:  { fontSize: 11, color: Colors.memorial.textMuted, marginTop: 2 },

  bubble: {
    maxWidth: '80%', borderRadius: 18, padding: 14,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.memorial.accent,
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.memorial.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: Colors.memorial.border,
  },
  aiLabel:    { fontSize: 11, color: Colors.memorial.textMuted, marginBottom: 6 },
  bubbleText: { fontSize: 15, lineHeight: 22 },

  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    padding: 12, paddingBottom: 16,
    backgroundColor: 'rgba(13,13,26,0.97)',
    borderTopWidth: 1, borderTopColor: Colors.memorial.border,
  },
  input: {
    flex: 1, maxHeight: 120,
    backgroundColor: Colors.memorial.card,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, color: Colors.memorial.text,
    borderWidth: 1, borderColor: Colors.memorial.border,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.memorial.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  sendIcon: { fontSize: 20, color: '#fff', fontWeight: '700' },
});
