// app/(tabs)/memories.tsx - 내 기억 (MyMemories)
// 웹 MyMemories.jsx → React Native 변환
// Firestore에서 answers 컬렉션 불러와서 카테고리별 표시

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Image,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useMemorial } from '@/context/MemorialContext';
import { useT } from '@/hooks/useT';
import { Colors } from '@/constants/colors';

// ── 카테고리 목록 ───────────────────────────────────────────────
const CATEGORIES = [
  { key: 'all',         icon: '✨' },
  { key: 'memory',      icon: '💭' },
  { key: 'values',      icon: '🌿' },
  { key: 'personality', icon: '😊' },
  { key: 'family',      icon: '👨‍👩‍👧' },
  { key: 'life_advice', icon: '📜' },
  { key: 'free',        icon: '✏️' },
];

function timeAgo(ts: any, t: any): string {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)   return t.time_just_now;
  if (diff < 3600) return t.time_minutes_ago(Math.floor(diff / 60));
  if (diff < 86400) return t.time_hours_ago(Math.floor(diff / 3600));
  if (diff < 604800) return t.time_days_ago(Math.floor(diff / 86400));
  return t.time_weeks_ago(Math.floor(diff / 604800));
}

export default function MemoriesScreen() {
  const router  = useRouter();
  const { user, userProfile } = useAuth();
  const { isMemorial }        = useMemorial();
  const t = useT();

  const [answers, setAnswers]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selCat, setSelCat]     = useState('all');
  const [deleting, setDeleting] = useState<string | null>(null);

  // 제공자 본인 또는 연결된 유족이 볼 수 있음
  const isProvider = userProfile?.role === 'provider';
  const isFamily   = userProfile?.role === 'family';

  const loadAnswers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let q;
      if (isProvider) {
        // 제공자: 자신의 answers
        q = await firestore()
          .collection('answers')
          .where('userId', '==', user.uid)
          .orderBy('createdAt', 'desc')
          .get();
      } else {
        // 유족: 연결된 제공자의 공개 answers
        const connSnap = await firestore()
          .collection('connections')
          .where('familyId', '==', user.uid)
          .where('status', '==', 'accepted')
          .get();
        if (connSnap.empty) { setAnswers([]); setLoading(false); return; }
        const conn = connSnap.docs[0].data();
        if (!conn.canViewMemories && !isMemorial) { setAnswers([]); setLoading(false); return; }
        q = await firestore()
          .collection('answers')
          .where('userId', '==', conn.providerId)
          .where('isPrivate', '==', false)
          .orderBy('createdAt', 'desc')
          .get();
      }
      setAnswers(q.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user, isProvider, isMemorial]);

  useEffect(() => { loadAnswers(); }, [loadAnswers]);

  async function handleDelete(id: string) {
    Alert.alert(t.memory_confirm_delete, '', [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          setDeleting(id);
          try {
            await firestore().collection('answers').doc(id).delete();
            setAnswers(prev => prev.filter(a => a.id !== id));
          } catch {
            Alert.alert(t.error_default);
          } finally { setDeleting(null); }
        },
      },
    ]);
  }

  // 카테고리 필터링
  const filtered = selCat === 'all'
    ? answers
    : answers.filter(a => a.category === selCat || a.type === selCat);

  const bg   = isMemorial ? Colors.memorial.bg   : Colors.bg;
  const card = isMemorial ? Colors.memorial.card  : Colors.card;

  return (
    <SafeAreaView style={[S.safe, { backgroundColor: bg }]}>
      {/* 헤더 */}
      <View style={[S.header, isMemorial && { borderBottomColor: Colors.memorial.border }]}>
        <Text style={[S.title, isMemorial && { color: Colors.memorial.text }]}>{t.my_memory}</Text>
        <Text style={[S.count, isMemorial && { color: Colors.memorial.textMuted }]}>
          {t.memory_count(answers.length)}
        </Text>
      </View>

      {/* 카테고리 탭 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={S.catBar}
        contentContainerStyle={S.catContent}
      >
        {CATEGORIES.map(cat => {
          const active = selCat === cat.key;
          const label  = (t as any)[`cat_${cat.key}`] || cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              onPress={() => setSelCat(cat.key)}
              style={[
                S.catChip,
                active && (isMemorial
                  ? { backgroundColor: Colors.memorial.accent, borderColor: Colors.memorial.accent }
                  : { backgroundColor: Colors.accent, borderColor: Colors.accent }),
                !active && isMemorial && { borderColor: Colors.memorial.border },
              ]}
            >
              <Text style={{ fontSize: 12 }}>{cat.icon} </Text>
              <Text style={[
                S.catLabel,
                active ? { color: '#fff', fontWeight: '700' }
                       : { color: isMemorial ? Colors.memorial.textMid : Colors.textMid },
              ]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 추모 모드 잠금 배너 */}
      {isMemorial && isProvider && (
        <View style={[S.memBanner, { backgroundColor: Colors.memorial.accentPale }]}>
          <Text style={{ fontSize: 12, color: Colors.memorial.textMid, textAlign: 'center' }}>
            🔒 {t.memorial_memory_kept}
          </Text>
        </View>
      )}

      {/* 목록 */}
      {loading ? (
        <View style={S.centered}>
          <ActivityIndicator color={isMemorial ? Colors.memorial.accent : Colors.accent} />
          <Text style={[S.loadingText, isMemorial && { color: Colors.memorial.textMuted }]}>{t.memory_loading}</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={S.centered}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>📭</Text>
          <Text style={[S.emptyText, isMemorial && { color: Colors.memorial.textMid }]}>{t.no_memory}</Text>
          {isProvider && !isMemorial && (
            <TouchableOpacity
              style={S.goBtn}
              onPress={() => router.push('/(tabs)/questions' as any)}
            >
              <Text style={S.goBtnText}>{t.memory_go_questions}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <MemoryCard
              item={item}
              isProvider={isProvider}
              isMemorial={isMemorial}
              deleting={deleting}
              onDelete={handleDelete}
              t={t}
              card={card}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ── 기억 카드 컴포넌트 ──────────────────────────────────────────────
function MemoryCard({
  item, isProvider, isMemorial, deleting, onDelete, t, card,
}: {
  item: any; isProvider: boolean; isMemorial: boolean;
  deleting: string | null; onDelete: (id: string) => void;
  t: any; card: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = item.content?.length > 120;

  return (
    <TouchableOpacity
      style={[
        S.card,
        { backgroundColor: card },
        isMemorial && { borderColor: Colors.memorial.border },
      ]}
      onPress={() => isLong && setExpanded(e => !e)}
      activeOpacity={isLong ? 0.9 : 1}
    >
      {/* 상단 메타 */}
      <View style={S.cardMeta}>
        <View style={S.categoryRow}>
          {item.isPrivate ? (
            <View style={[S.badge, { backgroundColor: '#f0f0f0' }]}>
              <Text style={[S.badgeText, { color: Colors.textMuted }]}>{t.memory_private}</Text>
            </View>
          ) : (
            <View style={[S.badge, { backgroundColor: Colors.accentPale }]}>
              <Text style={[S.badgeText, { color: Colors.accent }]}>{t.memory_public}</Text>
            </View>
          )}
          {item.type === 'free' && (
            <View style={[S.badge, { backgroundColor: '#e8f5e9' }]}>
              <Text style={[S.badgeText, { color: '#388e3c' }]}>{t.cat_free_record}</Text>
            </View>
          )}
        </View>
        <Text style={[S.timeText, isMemorial && { color: Colors.memorial.textMuted }]}>
          {timeAgo(item.createdAt, t)}
        </Text>
      </View>

      {/* 질문 */}
      {item.questionText && (
        <Text style={[S.questionText, isMemorial && { color: Colors.memorial.textMid }]}>
          Q. {item.questionText}
        </Text>
      )}

      {/* 본문 */}
      <Text
        style={[S.content, isMemorial && { color: Colors.memorial.text }]}
        numberOfLines={expanded ? undefined : 4}
      >
        {item.content}
      </Text>
      {isLong && (
        <Text style={[S.expandHint, isMemorial && { color: Colors.memorial.accent }]}>
          {expanded ? '▲ 접기' : '▼ 펼치기'}
        </Text>
      )}

      {/* 이미지 미리보기 */}
      {item.images?.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
          {item.images.map((uri: string, i: number) => (
            <Image
              key={i}
              source={{ uri }}
              style={S.thumb}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      )}

      {/* 제공자: 수정/삭제 버튼 */}
      {isProvider && !isMemorial && (
        <View style={S.actions}>
          <TouchableOpacity
            style={[S.actionBtn, { opacity: deleting === item.id ? 0.5 : 1 }]}
            onPress={() => onDelete(item.id)}
            disabled={deleting === item.id}
          >
            {deleting === item.id
              ? <ActivityIndicator size="small" color={Colors.error} />
              : <Text style={{ fontSize: 13, color: Colors.error }}>{t.delete}</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },

  header: {
    flexDirection:    'row',
    justifyContent:   'space-between',
    alignItems:       'center',
    paddingHorizontal: 20,
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  title:    { fontSize: 20, fontWeight: '700', color: Colors.primary },
  count:    { fontSize: 13, color: Colors.textMuted },

  catBar:    { maxHeight: 48, flexGrow: 0 },
  catContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  catChip:   {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 5, paddingHorizontal: 12,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.card,
  },
  catLabel:  { fontSize: 12 },

  memBanner: {
    marginHorizontal: 16, marginBottom: 8,
    paddingVertical: 10, borderRadius: 12,
  },

  loadingText: { fontSize: 13, color: Colors.textMuted, marginTop: 8 },
  emptyText:   { fontSize: 15, color: Colors.textMid },
  goBtn:     { marginTop: 8, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: Colors.accent, borderRadius: 12 },
  goBtnText: { fontSize: 14, color: '#fff', fontWeight: '600' },

  // 카드
  card: {
    borderRadius:    16,
    padding:         16,
    borderWidth:     1,
    borderColor:     Colors.borderLight,
    elevation:       1,
  },
  cardMeta:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  categoryRow: { flexDirection: 'row', gap: 6 },
  badge:       { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 10 },
  badgeText:   { fontSize: 10, fontWeight: '600' },
  timeText:    { fontSize: 11, color: Colors.textMuted },
  questionText:{ fontSize: 12, color: Colors.textMid, fontStyle: 'italic', marginBottom: 6 },
  content:     { fontSize: 14, color: Colors.text, lineHeight: 22 },
  expandHint:  { fontSize: 12, color: Colors.accent, marginTop: 6, textAlign: 'right' },
  thumb:       { width: 80, height: 80, borderRadius: 8, marginRight: 8 },
  actions:     { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 8 },
  actionBtn:   { padding: 6 },
});
