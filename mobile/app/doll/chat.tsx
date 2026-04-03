// app/doll/chat.tsx - Doll 채팅 화면
// 웹 DollChat.jsx → React Native 변환
// textarea → TextInput
// scroll to bottom → FlatList inverted or ScrollView + ref
// 타이핑 인디케이터: animated dots

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useMemorial } from '@/context/MemorialContext';
import { useLang } from '@/contexts/LanguageContext';
import { useT } from '@/hooks/useT';
import { apiCall } from '@/utils/api';
import DollAvatar from '@/components/DollAvatar';
import { Colors } from '@/constants/colors';

interface Message {
  role: 'user' | 'doll';
  content: string;
}

export default function DollChatScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { isMemorial, providerName } = useMemorial();
  const { lang } = useLang();
  const t = useT();

  const [doll, setDoll]     = useState<any>(null);
  const [msgs, setMsgs]     = useState<Message[]>([]);
  const [input, setInput]   = useState('');
  const [typing, setTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    async function load() {
      try {
        const r = await apiCall('GET', '/api/doll/me');
        if (!r?.doll) { router.replace('/doll/create' as any); return; }
        setDoll(r.doll);

        const chatR   = await apiCall('GET', `/api/doll/chat/today?dollId=${r.doll.id}`);
        const history: Message[] = (chatR?.messages || []).map((m: any) => ({
          role: m.role, content: m.content,
        }));

        if (history.length === 0) {
          if (r.doll.isDeceased && r.doll.lastMessage) {
            setMsgs([{ role: 'doll', content: r.doll.lastMessage }]);
          } else {
            const grR = await apiCall('GET', `/api/doll/greeting?dollId=${r.doll.id}&lang=${lang}`);
            if (grR?.greeting) setMsgs([{ role: 'doll', content: grR.greeting }]);
          }
        } else {
          setMsgs(history);
        }
      } catch {
        setError(t.chat_error_load);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // 메시지 추가 시 스크롤
  useEffect(() => {
    if (msgs.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [msgs, typing]);

  async function send() {
    const text = input.trim();
    if (!text || typing) return;
    setInput('');
    const next: Message[] = [...msgs, { role: 'user', content: text }];
    setMsgs(next);
    setTyping(true);
    try {
      const r = await apiCall('POST', '/api/doll/chat', { dollId: doll.id, message: text, lang });
      setMsgs((p) => [...p, { role: 'doll', content: r.reply }]);
    } catch {
      setMsgs((p) => [...p, { role: 'doll', content: t.chat_fallback }]);
    } finally {
      setTyping(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={S.safe}>
        <View style={S.centered}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={{ color: Colors.textMuted, fontSize: 14, marginTop: 14 }}>{t.doll_thinking}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !doll) {
    return (
      <SafeAreaView style={S.safe}>
        <View style={S.centered}>
          <Text style={{ color: Colors.error, fontSize: 14 }}>{error || t.doll_not_found}</Text>
          <TouchableOpacity style={S.backBtnSmall} onPress={() => router.back()}>
            <Text style={{ fontSize: 14, color: Colors.textMid }}>{t.back}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const ap          = doll.appearance || {};
  const displayName = isMemorial ? `† ${providerName || doll.name}` : doll.name;

  const allMsgs: (Message | { role: 'typing' })[] = typing
    ? [...msgs, { role: 'typing' as const }]
    : msgs;

  return (
    <SafeAreaView style={[S.safe, isMemorial && { backgroundColor: Colors.memorial.bg }]} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* 헤더 */}
        <View style={[S.header, isMemorial && { backgroundColor: 'rgba(22,33,62,0.97)', borderBottomColor: Colors.memorial.border }]}>
          <TouchableOpacity style={S.backCircle} onPress={() => router.back()}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={Colors.textMid} strokeWidth="2.5">
              <Path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>

          <View style={S.headerCenter}>
            <View style={S.headerAvatarWrap}>
              <DollAvatar appearance={ap} size={34} />
            </View>
            <View>
              <Text style={S.headerName}>{displayName}</Text>
              <View style={S.headerStatus}>
                {isMemorial ? (
                  <Text style={{ color: '#9088a8', fontSize: 11 }}>
                    {t.chat_deceased_status(providerName || doll.name)}
                  </Text>
                ) : (
                  <>
                    <View style={[S.statusDot, { backgroundColor: doll.isDeceased ? '#7ab89a' : '#8abe8a' }]} />
                    <Text style={S.statusText}>
                      {doll.isDeceased ? t.chat_connected_heaven : t.chat_available}
                    </Text>
                  </>
                )}
              </View>
            </View>
          </View>

          <View style={{ width: 36 }} />
        </View>

        {/* 날짜 구분선 */}
        <View style={S.dateDivider}>
          <View style={S.dateLabelWrap}>
            <Text style={S.dateLabel}>
              {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
            </Text>
          </View>
        </View>

        {/* 메시지 영역 */}
        <FlatList
          ref={flatRef}
          data={allMsgs}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={S.msgArea}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={S.emptyState}>
              <DollAvatar appearance={ap} size={80} />
              <Text style={{ color: Colors.textMuted, fontSize: 14, marginTop: 14 }}>
                {t.chat_waiting(doll.name)}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item.role === 'typing') {
              return (
                <View style={S.msgRow}>
                  <View style={S.smallAvatar}><DollAvatar appearance={ap} size={30} /></View>
                  <View>
                    <Text style={S.senderName}>{doll.name}</Text>
                    <View style={[S.bubble, S.bubbleDoll, { paddingVertical: 12 }]}>
                      <View style={S.dots}>
                        {[0, 1, 2].map((i) => (
                          <View key={i} style={S.dot} />
                        ))}
                      </View>
                    </View>
                  </View>
                </View>
              );
            }
            const m = item as Message;
            const isUser = m.role === 'user';
            return (
              <View style={[S.msgRow, isUser && S.msgRowUser]}>
                {!isUser && (
                  <View style={S.smallAvatar}><DollAvatar appearance={ap} size={30} /></View>
                )}
                <View style={{ maxWidth: '72%' }}>
                  {!isUser && <Text style={S.senderName}>{doll.name}</Text>}
                  <View style={[
                    S.bubble,
                    isUser ? S.bubbleUser : S.bubbleDoll,
                    !isUser && isMemorial && { backgroundColor: '#16213e', borderColor: '#2d2d4e' },
                  ]}>
                    <Text style={[S.bubbleText, { color: isUser ? '#fff' : Colors.text }]}>
                      {m.content}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
        />

        {/* 입력창 */}
        <View style={[S.inputWrap, { paddingBottom: insets.bottom + 10 }]}>
          <View style={S.inputRow}>
            <TextInput
              style={S.textarea}
              value={input}
              onChangeText={setInput}
              placeholder={
                isMemorial
                  ? t.chat_memorial_placeholder(providerName || doll.name)
                  : t.doll_chat_placeholder
              }
              placeholderTextColor={Colors.textMuted}
              multiline
              onSubmitEditing={send}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[S.sendBtn, (!input.trim() || typing) && { opacity: 0.4 }]}
              onPress={send}
              disabled={!input.trim() || typing}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" style={{ transform: [{ rotate: '90deg' }] }}>
                <Path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" />
              </Svg>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  backBtnSmall: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, marginTop: 8 },

  header: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingHorizontal: 16,
    paddingVertical:   10,
    backgroundColor:  'rgba(255,253,249,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backCircle:    { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  headerCenter:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatarWrap: { borderRadius: 17, overflow: 'hidden' },
  headerName:    { fontSize: 15, fontWeight: '700', color: Colors.text },
  headerStatus:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot:     { width: 6, height: 6, borderRadius: 3 },
  statusText:    { fontSize: 11, color: Colors.textMuted },

  dateDivider:   { alignItems: 'center', paddingVertical: 10 },
  dateLabelWrap: { backgroundColor: Colors.borderLight, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20 },
  dateLabel:     { fontSize: 11, color: Colors.textMuted },

  msgArea:  { padding: 16, gap: 4, paddingBottom: 20 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },

  msgRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 2 },
  msgRowUser: { flexDirection: 'row-reverse' },
  smallAvatar: { borderRadius: 15, overflow: 'hidden' },
  senderName: { fontSize: 11, color: Colors.textMuted, marginBottom: 3, marginLeft: 4 },

  bubble:     { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18 },
  bubbleDoll: { backgroundColor: Colors.card, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: Colors.borderLight },
  bubbleUser: { backgroundColor: Colors.primary, borderBottomRightRadius: 5 },
  bubbleText: { fontSize: 14, lineHeight: 22 },

  dots: { flexDirection: 'row', gap: 5, paddingVertical: 2 },
  dot:  { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.accent },

  inputWrap: {
    paddingHorizontal: 14,
    paddingTop:        10,
    backgroundColor:   Colors.card,
    borderTopWidth:    1,
    borderTopColor:    Colors.borderLight,
  },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  textarea: {
    flex: 1, paddingVertical: 11, paddingHorizontal: 16,
    borderRadius: 22, borderWidth: 1.5, borderColor: Colors.border,
    fontSize: 14, color: Colors.text, backgroundColor: Colors.bg,
    maxHeight: 120, lineHeight: 20,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});
