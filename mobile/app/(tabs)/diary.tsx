// app/(tabs)/diary.tsx - 일기 목록 + 작성/수정
// 웹 Diary.jsx → React Native 변환
// Firestore diaries 컬렉션

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, ActivityIndicator, Alert, Switch,
  KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useMemorial } from '@/context/MemorialContext';
import { useT } from '@/hooks/useT';
import { Colors } from '@/constants/colors';

const MOODS = [
  { key: 'happy',   icon: '😊' },
  { key: 'excited', icon: '🥰' },
  { key: 'neutral', icon: '😐' },
  { key: 'sad',     icon: '😢' },
  { key: 'angry',   icon: '😠' },
];

function formatDate(ts: any): string {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

// ── 수정/작성 모달 ─────────────────────────────────────────────────
function DiaryModal({
  visible, entry, onClose, onSaved, t, isMemorial, addGems,
}: {
  visible: boolean; entry: any | null;
  onClose: () => void; onSaved: (item: any) => void;
  t: any; isMemorial: boolean; addGems: (n: number) => Promise<void>;
}) {
  const { user } = useAuth();
  const [title,      setTitle]      = useState('');
  const [content,    setContent]    = useState('');
  const [mood,       setMood]       = useState('neutral');
  const [isPosthumous, setPosthumous] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [gemPopup,   setGemPopup]   = useState(false);

  // 수정 시 기존값 세팅
  useEffect(() => {
    if (entry) {
      setTitle(entry.title || '');
      setContent(entry.content || '');
      setMood(entry.mood || 'neutral');
      setPosthumous(entry.isPosthumous ?? false);
    } else {
      setTitle(''); setContent(''); setMood('neutral'); setPosthumous(false);
    }
  }, [entry, visible]);

  async function handleSave() {
    if (!content.trim()) { Alert.alert(t.validation_content); return; }
    if (!user) return;
    setSaving(true);
    try {
      const data = {
        userId: user.uid, title: title.trim(), content: content.trim(),
        mood, isPosthumous,
        createdAt: entry?.createdAt ?? firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };
      let saved;
      if (entry?.id) {
        await firestore().collection('diaries').doc(entry.id).update(data);
        saved = { ...entry, ...data };
      } else {
        const ref = await firestore().collection('diaries').add(data);
        saved = { id: ref.id, ...data };
        // 첫 작성 시 gem 보상 (중복 방지: 당일 일기가 없었을 때만)
        setGemPopup(true);
        await addGems(5);
      }
      onSaved(saved);
    } catch {
      Alert.alert(t.error_default);
    } finally { setSaving(false); }
  }

  const accent = isMemorial ? Colors.memorial.accent : Colors.accent;
  const bg     = isMemorial ? Colors.memorial.bg     : Colors.bg;
  const cardBg = isMemorial ? Colors.memorial.card   : Colors.card;
  const textCol= isMemorial ? Colors.memorial.text   : Colors.text;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* 헤더 */}
          <View style={[MS.header, isMemorial && { borderBottomColor: Colors.memorial.border }]}>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ fontSize: 15, color: accent }}>{t.cancel}</Text>
            </TouchableOpacity>
            <Text style={[MS.headerTitle, { color: textCol }]}>
              {entry ? t.diary_edit_title : t.diary_new_title}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              <Text style={{ fontSize: 15, color: accent, fontWeight: '700', opacity: saving ? 0.5 : 1 }}>
                {saving ? t.saving : (entry ? t.diary_save_edit : t.diary_save_new)}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            {/* 제목 */}
            <TextInput
              style={[MS.titleInput, { color: textCol, borderBottomColor: isMemorial ? Colors.memorial.border : Colors.border }]}
              placeholder={t.diary_title_placeholder}
              placeholderTextColor={isMemorial ? Colors.memorial.textMuted : Colors.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={50}
            />

            {/* 기분 선택 */}
            <View>
              <Text style={[MS.label, { color: isMemorial ? Colors.memorial.textMid : Colors.textMid }]}>
                {t.diary_today_mood}
              </Text>
              <View style={MS.moodRow}>
                {MOODS.map(m => (
                  <TouchableOpacity
                    key={m.key}
                    onPress={() => setMood(m.key)}
                    style={[
                      MS.moodBtn,
                      mood === m.key && { backgroundColor: accent, borderColor: accent },
                      mood !== m.key && { borderColor: isMemorial ? Colors.memorial.border : Colors.border },
                    ]}
                  >
                    <Text style={{ fontSize: 22 }}>{m.icon}</Text>
                    <Text style={{ fontSize: 10, color: mood === m.key ? '#fff' : (isMemorial ? Colors.memorial.textMuted : Colors.textMuted), marginTop: 2 }}>
                      {(t as any)[`mood_${m.key}`] || m.key}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 본문 */}
            <TextInput
              style={[MS.contentInput, {
                color: textCol,
                backgroundColor: cardBg,
                borderColor: isMemorial ? Colors.memorial.border : Colors.borderLight,
              }]}
              placeholder={t.diary_content_placeholder}
              placeholderTextColor={isMemorial ? Colors.memorial.textMuted : Colors.textMuted}
              multiline
              textAlignVertical="top"
              value={content}
              onChangeText={setContent}
            />

            {/* 사후 공개 토글 */}
            <View style={[MS.toggleRow, {
              backgroundColor: cardBg,
              borderColor: isMemorial ? Colors.memorial.border : Colors.borderLight,
            }]}>
              <View style={{ flex: 1 }}>
                <Text style={[MS.toggleTitle, { color: textCol }]}>{t.diary_posthumous_title}</Text>
                <Text style={{ fontSize: 12, color: isMemorial ? Colors.memorial.textMuted : Colors.textMuted, marginTop: 2 }}>
                  {isPosthumous ? t.diary_posthumous_on_desc : t.diary_posthumous_off_desc}
                </Text>
              </View>
              <Switch
                value={isPosthumous}
                onValueChange={setPosthumous}
                trackColor={{ true: accent }}
                thumbColor="#fff"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* gem 보상 팝업 */}
        {gemPopup && (
          <View style={MS.gemOverlay}>
            <View style={MS.gemBox}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>💎</Text>
              <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.primary, marginBottom: 4 }}>
                {t.diary_gem_title}
              </Text>
              <Text style={{ fontSize: 14, color: Colors.textMid, marginBottom: 16 }}>
                {t.diary_gem_reward}
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: Colors.accent, paddingVertical: 10, paddingHorizontal: 28, borderRadius: 12 }}
                onPress={() => { setGemPopup(false); onClose(); }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>{t.confirm}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ── 메인 화면 ───────────────────────────────────────────────────────
export default function DiaryScreen() {
  const { user, userProfile, addGems } = useAuth();
  const { isMemorial }                 = useMemorial();
  const t = useT();

  const [diaries,  setDiaries]  = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [editing,  setEditing]  = useState<any | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const isProvider = userProfile?.role === 'provider';

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await firestore()
        .collection('diaries')
        .where('userId', '==', user.uid)
        .orderBy('createdAt', 'desc')
        .get();
      setDiaries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  function openNew()        { setEditing(null); setModal(true); }
  function openEdit(d: any) { setEditing(d);    setModal(true); }

  function handleSaved(item: any) {
    setModal(false);
    setDiaries(prev => {
      const idx = prev.findIndex(d => d.id === item.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = item; return next; }
      return [item, ...prev];
    });
  }

  async function handleDelete(id: string) {
    Alert.alert(t.confirm_delete, '', [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete, style: 'destructive',
        onPress: async () => {
          setDeleting(id);
          try {
            await firestore().collection('diaries').doc(id).delete();
            setDiaries(prev => prev.filter(d => d.id !== id));
          } catch { Alert.alert(t.error_default); }
          finally { setDeleting(null); }
        },
      },
    ]);
  }

  const bg    = isMemorial ? Colors.memorial.bg   : Colors.bg;
  const card  = isMemorial ? Colors.memorial.card : Colors.card;
  const accent= isMemorial ? Colors.memorial.accent: Colors.accent;

  return (
    <SafeAreaView style={[S.safe, { backgroundColor: bg }]}>
      {/* 헤더 */}
      <View style={[S.header, isMemorial && { borderBottomColor: Colors.memorial.border }]}>
        <Text style={[S.title, isMemorial && { color: Colors.memorial.text }]}>{t.diary_title}</Text>
        {isProvider && !isMemorial && (
          <TouchableOpacity style={[S.newBtn, { backgroundColor: accent }]} onPress={openNew}>
            <Text style={S.newBtnText}>+ {t.diary_new}</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={S.centered}>
          <ActivityIndicator color={accent} />
        </View>
      ) : diaries.length === 0 ? (
        <View style={S.centered}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>📓</Text>
          <Text style={[S.emptyTitle, isMemorial && { color: Colors.memorial.text }]}>{t.diary_empty}</Text>
          <Text style={[S.emptyDesc, isMemorial && { color: Colors.memorial.textMuted }]}>{t.diary_empty_desc}</Text>
          {isProvider && !isMemorial && (
            <TouchableOpacity style={[S.newBtn, { backgroundColor: accent, marginTop: 16 }]} onPress={openNew}>
              <Text style={S.newBtnText}>{t.diary_write_first}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {diaries.map(entry => {
            const moodIcon = MOODS.find(m => m.key === entry.mood)?.icon || '😐';
            return (
              <TouchableOpacity
                key={entry.id}
                style={[S.card, { backgroundColor: card }, isMemorial && { borderColor: Colors.memorial.border }]}
                onPress={() => isProvider && !isMemorial && openEdit(entry)}
                activeOpacity={isProvider && !isMemorial ? 0.8 : 1}
              >
                <View style={S.cardTop}>
                  <View style={S.cardLeft}>
                    <Text style={{ fontSize: 24 }}>{moodIcon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={S.cardTitleRow}>
                      <Text style={[S.cardTitle, isMemorial && { color: Colors.memorial.text }]} numberOfLines={1}>
                        {entry.title || t.no_title}
                      </Text>
                      <View style={[
                        S.badge,
                        { backgroundColor: entry.isPosthumous
                          ? (isMemorial ? Colors.memorial.accentPale : Colors.accentPale)
                          : '#f0f0f0' },
                      ]}>
                        <Text style={{ fontSize: 10, color: entry.isPosthumous
                          ? (isMemorial ? Colors.memorial.textMid : Colors.accent)
                          : Colors.textMuted }}>
                          {entry.isPosthumous ? t.diary_posthumous_badge : t.diary_private_badge}
                        </Text>
                      </View>
                    </View>
                    <Text style={[S.dateText, isMemorial && { color: Colors.memorial.textMuted }]}>
                      {formatDate(entry.createdAt)}
                    </Text>
                  </View>
                </View>
                <Text style={[S.cardContent, isMemorial && { color: Colors.memorial.textMid }]} numberOfLines={2}>
                  {entry.content}
                </Text>
                {/* 삭제 버튼 */}
                {isProvider && !isMemorial && (
                  <TouchableOpacity
                    style={S.deleteBtn}
                    onPress={() => handleDelete(entry.id)}
                    disabled={deleting === entry.id}
                  >
                    {deleting === entry.id
                      ? <ActivityIndicator size="small" color={Colors.error} />
                      : <Text style={{ fontSize: 12, color: Colors.error }}>{t.delete}</Text>
                    }
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* 작성/수정 모달 */}
      <DiaryModal
        visible={modal}
        entry={editing}
        onClose={() => setModal(false)}
        onSaved={handleSaved}
        t={t}
        isMemorial={isMemorial}
        addGems={addGems}
      />
    </SafeAreaView>
  );
}

// ── Modal StyleSheet ──────────────────────────────────────────────
const MS = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  label:       { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  titleInput: {
    fontSize: 20, fontWeight: '600', color: Colors.text,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingBottom: 8,
  },
  moodRow:    { flexDirection: 'row', gap: 8 },
  moodBtn:    {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border,
  },
  contentInput: {
    minHeight: 200, borderRadius: 12, borderWidth: 1,
    padding: 14, fontSize: 15, lineHeight: 24,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12, borderWidth: 1,
  },
  toggleTitle: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  gemOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  gemBox: {
    backgroundColor: Colors.card, borderRadius: 20,
    padding: 32, alignItems: 'center', width: 260,
  },
});

const S = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  title:   { fontSize: 20, fontWeight: '700', color: Colors.primary },
  newBtn:  { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12 },
  newBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.primary },
  emptyDesc:  { fontSize: 13, color: Colors.textMuted, marginTop: 4 },

  card: {
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.borderLight, elevation: 1,
  },
  cardTop:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  cardLeft:    { width: 40, alignItems: 'center' },
  cardTitleRow:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  cardTitle:   { fontSize: 15, fontWeight: '700', color: Colors.primary, flex: 1 },
  dateText:    { fontSize: 11, color: Colors.textMuted },
  cardContent: { fontSize: 13, color: Colors.textMid, lineHeight: 20 },
  badge:       { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 10 },
  deleteBtn:   { alignSelf: 'flex-end', marginTop: 10, padding: 4 },
});
