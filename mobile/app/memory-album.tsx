// app/memory-album.tsx - 기억 앨범
// 웹 MemoryAlbum.jsx → React Native 변환
// 제공자 기억을 카테고리별로 탐색, 카드 뷰로 표시

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Image,
  StyleSheet, ActivityIndicator, Alert, Share,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useMemorial } from '@/context/MemorialContext';
import { useT } from '@/hooks/useT';
import { apiCall } from '@/utils/api';
import { Colors } from '@/constants/colors';

const { width: SCREEN_W } = Dimensions.get('window');

const CATS = [
  { key: 'all',         icon: '✨' },
  { key: 'memory',      icon: '💭' },
  { key: 'values',      icon: '🌿' },
  { key: 'personality', icon: '😊' },
  { key: 'family',      icon: '👨‍👩‍👧' },
  { key: 'life_advice', icon: '📜' },
  { key: 'free',        icon: '✏️' },
  { key: 'favorites',   icon: '⭐' },
];

function formatDate(ts: any): string {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return `${d.getFullYear()}. ${d.getMonth()+1}. ${d.getDate()}`;
}

export default function MemoryAlbumScreen() {
  const router  = useRouter();
  const { user, userProfile } = useAuth();
  const { isMemorial, providerName } = useMemorial();
  const t = useT();

  const [answers,   setAnswers]   = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [selCat,    setSelCat]    = useState('all');
  const [favorites, setFavorites] = useState<string[]>([]);

  // 제공자 자신이면 자기 기억, 유족이면 연결된 제공자 기억
  const isProvider = userProfile?.role === 'provider';

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let targetUid = user.uid;
      if (!isProvider) {
        // 연결된 제공자 uid 조회
        const connSnap = await firestore()
          .collection('connections')
          .where('familyId', '==', user.uid)
          .where('status', '==', 'accepted')
          .get();
        if (connSnap.empty) { setAnswers([]); setLoading(false); return; }
        const conn = connSnap.docs[0].data();
        if (!conn.canViewMemories && !isMemorial) { setAnswers([]); setLoading(false); return; }
        targetUid = conn.providerId;
      }

      const [answersSnap, albumSnap] = await Promise.all([
        firestore()
          .collection('answers')
          .where('userId', '==', targetUid)
          .where('isPrivate', '==', false)
          .orderBy('createdAt', 'desc')
          .get(),
        firestore().collection('memoryAlbum').doc(user.uid).get(),
      ]);

      setAnswers(answersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setFavorites(albumSnap.exists ? (albumSnap.data()?.favorites ?? []) : []);
    } catch (e) {
      Alert.alert(t.album_load_fail);
    } finally { setLoading(false); }
  }, [user, isProvider, isMemorial]);

  useEffect(() => { load(); }, [load]);

  async function toggleFavorite(id: string) {
    if (!user) return;
    const isFav = favorites.includes(id);
    const updated = isFav
      ? favorites.filter(f => f !== id)
      : [...favorites, id];
    setFavorites(updated);
    await firestore()
      .collection('memoryAlbum')
      .doc(user.uid)
      .set({ favorites: updated }, { merge: true });
  }

  async function handleShare(item: any, name: string) {
    try {
      const dateStr = formatDate(item.createdAt);
      const msg = `${t.album_memory_label(name)}\n\n"${item.content}"\n\n${t.album_memory_footer}`;
      await Share.share({ message: msg });
    } catch { /* user cancelled */ }
  }

  // 필터링
  const filtered = selCat === 'favorites'
    ? answers.filter(a => favorites.includes(a.id))
    : selCat === 'all'
      ? answers
      : answers.filter(a => a.category === selCat || a.type === selCat);

  const displayName = isProvider
    ? t.album_self_name
    : providerName || t.album_deceased_name;

  const bg    = isMemorial ? Colors.memorial.bg   : Colors.bg;
  const accent= isMemorial ? Colors.memorial.accent: Colors.accent;
  const textC = isMemorial ? Colors.memorial.text : Colors.primary;

  return (
    <SafeAreaView style={[S.safe, { backgroundColor: bg }]}>
      {/* 헤더 */}
      <View style={[S.header, isMemorial && { borderBottomColor: Colors.memorial.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[S.back, { color: accent }]}>{t.back}</Text>
        </TouchableOpacity>
        <Text style={[S.title, { color: textC }]}>{t.album_title}</Text>
        <View style={{ width: 48 }} />
      </View>

      {/* 히어로 */}
      <View style={[S.hero, { backgroundColor: isMemorial ? Colors.memorial.accentPale : Colors.accentPale }]}>
        <Text style={[S.heroTitle, { color: textC }]}>{t.album_title_text(displayName)}</Text>
        <Text style={[S.heroSub, { color: isMemorial ? Colors.memorial.textMid : Colors.textMid }]}>
          {t.album_count(answers.length)}
        </Text>
      </View>

      {/* 카테고리 */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={S.catBar} contentContainerStyle={S.catContent}
      >
        {CATS.map(cat => {
          const active = selCat === cat.key;
          const label  = (t as any)[`cat_${cat.key}`] || cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              style={[
                S.catChip,
                active && { backgroundColor: accent, borderColor: accent },
                !active && isMemorial && { borderColor: Colors.memorial.border },
              ]}
              onPress={() => setSelCat(cat.key)}
            >
              <Text style={{ fontSize: 11 }}>{cat.icon} </Text>
              <Text style={[S.catLabel, active ? { color: '#fff', fontWeight: '700' } : { color: isMemorial ? Colors.memorial.textMid : Colors.textMid }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 목록 */}
      {loading ? (
        <View style={S.centered}><ActivityIndicator color={accent} /></View>
      ) : filtered.length === 0 ? (
        <View style={S.centered}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📭</Text>
          <Text style={{ fontSize: 14, color: isMemorial ? Colors.memorial.textMuted : Colors.textMuted }}>
            {selCat === 'favorites' ? t.album_no_favorites : t.no_memory}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          {filtered.map(item => {
            const isFav = favorites.includes(item.id);
            return (
              <View
                key={item.id}
                style={[
                  S.card,
                  { backgroundColor: isMemorial ? Colors.memorial.card : Colors.card },
                  isMemorial && { borderColor: Colors.memorial.border },
                ]}
              >
                {/* 카드 상단 */}
                <View style={S.cardTop}>
                  <Text style={[S.dateText, { color: isMemorial ? Colors.memorial.textMuted : Colors.textMuted }]}>
                    {formatDate(item.createdAt)}
                  </Text>
                  <View style={S.cardActions}>
                    <TouchableOpacity onPress={() => toggleFavorite(item.id)} style={{ padding: 4 }}>
                      <Text style={{ fontSize: 18 }}>{isFav ? '⭐' : '☆'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleShare(item, displayName)} style={{ padding: 4 }}>
                      <Text style={{ fontSize: 16 }}>📤</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 질문 */}
                {item.questionText && (
                  <Text style={[S.qText, { color: isMemorial ? Colors.memorial.textMid : Colors.textMid }]}>
                    Q. {item.questionText}
                  </Text>
                )}

                {/* 본문 */}
                <Text style={[S.content, { color: isMemorial ? Colors.memorial.text : Colors.text }]}>
                  {item.content}
                </Text>

                {/* 이미지 */}
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

                {/* 카테고리 태그 */}
                {item.category && (
                  <View style={[S.catTag, { backgroundColor: isMemorial ? Colors.memorial.accentPale : Colors.accentPale }]}>
                    <Text style={{ fontSize: 10, color: isMemorial ? Colors.memorial.textMid : Colors.accent }}>
                      {(t as any)[`cat_${item.category}`] || item.category}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  back:  { fontSize: 14, color: Colors.accent },
  title: { fontSize: 17, fontWeight: '700', color: Colors.primary },

  hero: {
    padding: 20, alignItems: 'center',
  },
  heroTitle: { fontSize: 22, fontWeight: '700', color: Colors.primary, textAlign: 'center', lineHeight: 30, marginBottom: 6 },
  heroSub:   { fontSize: 13, color: Colors.textMid },

  catBar:    { maxHeight: 46, flexGrow: 0 },
  catContent:{ paddingHorizontal: 16, paddingVertical: 6, gap: 8, flexDirection: 'row' },
  catChip:   {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 5, paddingHorizontal: 12,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.card,
  },
  catLabel:  { fontSize: 11 },

  card: {
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  cardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardActions:{ flexDirection: 'row', gap: 4 },
  dateText:  { fontSize: 11, color: Colors.textMuted },
  qText:     { fontSize: 12, color: Colors.textMid, fontStyle: 'italic', marginBottom: 8 },
  content:   { fontSize: 14, color: Colors.text, lineHeight: 22 },
  thumb:     { width: 90, height: 90, borderRadius: 8, marginRight: 8 },
  catTag:    { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 12 },
});
