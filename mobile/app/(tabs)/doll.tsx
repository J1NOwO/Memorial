// app/(tabs)/doll.tsx - Doll 메인 화면
// 웹 DollHome.jsx → React Native 변환
// navigate → router.push
// env(safe-area-inset-bottom) → useSafeAreaInsets

import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, Modal, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMemorial } from '@/context/MemorialContext';
import { useT } from '@/hooks/useT';
import { useLang } from '@/contexts/LanguageContext';
import { apiCall } from '@/utils/api';
import DollAvatar from '@/components/DollAvatar';
import TopBar from '@/components/TopBar';
import { Colors } from '@/constants/colors';

function timeAgo(ts: any, t: any): string | null {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return null;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60)      return t.time_just_now;
  if (s < 3600)    return t.time_minutes_ago(Math.floor(s / 60));
  if (s < 86400)   return t.time_hours_ago(Math.floor(s / 3600));
  if (s < 86400*7) return t.time_days_ago(Math.floor(s / 86400));
  return t.time_weeks_ago(Math.floor(s / 86400 / 7));
}

export default function DollHomeScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { isMemorial, providerName } = useMemorial();
  const t = useT();
  const { lang } = useLang();

  const [doll, setDoll]             = useState<any>(null);
  const [greeting, setGreeting]     = useState('');
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showConfirm, setShowConfirm]           = useState(false);
  const [deleting, setDeleting]                 = useState(false);
  const [showLastMsgModal, setShowLastMsgModal] = useState(false);
  const [lastMsgInput, setLastMsgInput]         = useState('');
  const [savingMsg, setSavingMsg]               = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const r = await apiCall('GET', '/api/doll/me');
        if (!r?.doll) { router.replace('/doll/create' as any); return; }
        setDoll(r.doll);
        const gr = await apiCall('GET', `/api/doll/greeting?dollId=${r.doll.id}&lang=${lang}`);
        setGreeting(gr?.greeting || '');
      } catch (e: any) {
        if (e.message?.includes('404') || e.message?.includes('없')) {
          router.replace('/doll/create' as any);
        } else {
          setError(t.doll_load_error);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function saveLastMessage() {
    if (savingMsg) return;
    setSavingMsg(true);
    try {
      await apiCall('PATCH', '/api/doll/last-message', { message: lastMsgInput });
      setDoll((d: any) => ({ ...d, lastMessage: lastMsgInput.trim() }));
      setShowLastMsgModal(false);
    } catch {} finally { setSavingMsg(false); }
  }

  async function handleReset(mode: 'appearance' | 'full') {
    if (mode === 'appearance') {
      router.push(('/doll/create?reset=true&mode=appearance') as any);
      return;
    }
    setDeleting(true);
    try {
      await apiCall('DELETE', '/api/doll/me');
      router.replace('/doll/create' as any);
    } catch {
      setError(t.doll_action_error);
      setShowConfirm(false);
    } finally { setDeleting(false); }
  }

  if (loading) {
    return (
      <SafeAreaView style={S.safe}>
        <View style={S.centered}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={{ color: Colors.textMuted, fontSize: 14, marginTop: 16 }}>{t.loading}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !doll) {
    return (
      <SafeAreaView style={S.safe}>
        <View style={S.centered}>
          <Text style={{ color: Colors.error, fontSize: 14 }}>{error || t.doll_not_found}</Text>
          <TouchableOpacity style={S.retryBtn} onPress={() => router.back()}>
            <Text style={S.retryBtnText}>{t.back}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const ap           = doll.appearance || {};
  const pColor       = isMemorial ? '#7b6fa0' : Colors.accent;
  const displayName  = isMemorial && providerName ? `† ${providerName}` : doll.name;
  const totalChats   = doll.totalChats || 0;
  const lastAt       = timeAgo(doll.lastChatAt, t);

  return (
    <SafeAreaView style={[S.safe, isMemorial && { backgroundColor: Colors.memorial.bg }]}>
      <TopBar
        title={t.doll_my_title}
        onBack={() => router.back()}
        onRightClick={() => setShowConfirm(true)}
        rightIcon="🔄"
      />

      <ScrollView contentContainerStyle={S.main} showsVerticalScrollIndicator={false}>
        {/* 히어로 */}
        <View style={S.heroSection}>
          <DollAvatar appearance={ap} size={180} animated />
          <View style={S.nameArea}>
            <Text style={S.dollName}>{displayName}</Text>
            {doll.isDeceased && (
              <View style={S.deceasedBadge}>
                <Text style={S.deceasedBadgeText}>{t.doll_from_heaven}</Text>
              </View>
            )}
          </View>
          <View style={[S.pBadge, { backgroundColor: `${pColor}22`, borderColor: `${pColor}44` }]}>
            <Text style={[S.pBadgeText, { color: pColor }]}>{t.doll_growing}</Text>
          </View>
        </View>

        {/* 말풍선 */}
        {(isMemorial ? (doll.lastMessage || greeting) : greeting) ? (
          <View style={[S.bubble, isMemorial && S.bubbleMemorial]}>
            <Text style={[S.bubbleText, isMemorial && { color: Colors.memorial.textMid, fontStyle: 'normal' }]}>
              {isMemorial && doll.lastMessage
                ? `"${doll.lastMessage}"`
                : `"${greeting}"`}
            </Text>
            {isMemorial && doll.lastMessage && (
              <Text style={{ fontSize: 11, color: '#7b6fa0', textAlign: 'center', marginTop: 8 }}>
                {t.doll_last_message_label}
              </Text>
            )}
          </View>
        ) : null}

        {/* 유언 메시지 버튼 */}
        {!isMemorial && (
          <TouchableOpacity
            style={S.lastMsgBtn}
            onPress={() => { setLastMsgInput(doll.lastMessage || ''); setShowLastMsgModal(true); }}
          >
            <Text style={{ fontSize: 16 }}>✉️</Text>
            <Text style={S.lastMsgBtnText}>
              {doll.lastMessage ? t.doll_last_message_edit : t.doll_last_message_write}
            </Text>
          </TouchableOpacity>
        )}

        {/* 통계 카드 */}
        <View style={S.statsCard}>
          <View style={S.statItem}>
            <Text style={S.statNum}>{totalChats.toLocaleString()}</Text>
            <Text style={S.statLab}>{t.doll_total_chats}</Text>
          </View>
          {lastAt && (
            <>
              <View style={S.statDivider} />
              <View style={S.statItem}>
                <Text style={S.statNum}>{lastAt}</Text>
                <Text style={S.statLab}>{t.doll_last_chat}</Text>
              </View>
            </>
          )}
          {!lastAt && totalChats === 0 && (
            <View style={S.statItem}>
              <Text style={{ fontSize: 13, color: Colors.textMuted }}>{t.doll_no_chats}</Text>
              <Text style={S.statLab}>{t.doll_start_chat}</Text>
            </View>
          )}
        </View>

        <Text style={S.hint}>
          {isMemorial
            ? t.doll_hint_memorial(providerName || doll.name)
            : t.doll_hint_alive(doll.name)}
        </Text>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* 하단 고정 버튼 */}
      <View style={[
        S.fixedBottom,
        {
          paddingBottom: insets.bottom + 16,
          backgroundColor: isMemorial ? 'rgba(13,13,26,0.97)' : 'rgba(247,243,238,0.95)',
        },
      ]}>
        <View style={S.btnRow}>
          <TouchableOpacity style={S.wardrobeBtn} onPress={() => router.push('/doll/wardrobe' as any)}>
            <Text style={{ fontSize: 20 }}>👗</Text>
            <Text style={S.wardrobeBtnText}>{t.edit}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={S.chatBtn} onPress={() => router.push('/doll/chat' as any)} activeOpacity={0.85}>
            <Text style={{ fontSize: 20 }}>💬</Text>
            <Text style={S.chatBtnText}>{t.doll_chat_btn}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 초기화 선택 모달 */}
      <Modal visible={showConfirm} transparent animationType="fade" onRequestClose={() => setShowConfirm(false)}>
        <View style={S.overlay}>
          <View style={S.modal}>
            <Text style={S.modalEmoji}>🔄</Text>
            <Text style={S.modalTitle}>{t.doll_reset_title}</Text>
            <Text style={S.modalDesc}>{t.doll_reset_desc}</Text>

            <TouchableOpacity style={S.optionCard} onPress={() => handleReset('appearance')} disabled={deleting}>
              <Text style={S.optionIcon}>🎨</Text>
              <View style={{ flex: 1 }}>
                <Text style={S.optionTitle}>{t.doll_reset_appearance_title}</Text>
                <Text style={S.optionDesc}>
                  {t.doll_reset_appearance_desc1}{'\n'}{t.doll_reset_appearance_desc2(doll?.name)}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[S.optionCard, S.optionCardDanger]} onPress={() => handleReset('full')} disabled={deleting}>
              <Text style={S.optionIcon}>🗑️</Text>
              <View style={{ flex: 1 }}>
                <Text style={[S.optionTitle, { color: Colors.error }]}>{t.doll_reset_full_title}</Text>
                <Text style={S.optionDesc}>
                  {t.doll_reset_full_desc1}{'\n'}{t.doll_reset_full_desc2}
                </Text>
              </View>
            </TouchableOpacity>

            {deleting && <Text style={{ fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginTop: 4 }}>{t.processing}</Text>}

            <TouchableOpacity style={S.cancelBtn} onPress={() => setShowConfirm(false)} disabled={deleting}>
              <Text style={S.cancelBtnText}>{t.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 유언 메시지 모달 */}
      <Modal visible={showLastMsgModal} transparent animationType="fade" onRequestClose={() => setShowLastMsgModal(false)}>
        <View style={S.overlay}>
          <View style={S.modal}>
            <Text style={S.modalEmoji}>✉️</Text>
            <Text style={S.modalTitle}>{t.doll_last_msg_modal_title}</Text>
            <Text style={S.modalDesc}>
              {t.doll_last_msg_modal_desc1}{'\n'}{t.doll_last_msg_modal_desc2}
            </Text>
            <TextInput
              style={S.lastMsgTextarea}
              value={lastMsgInput}
              onChangeText={setLastMsgInput}
              placeholder={t.doll_last_msg_placeholder}
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
              maxLength={200}
              textAlignVertical="top"
            />
            <Text style={{ fontSize: 11, color: Colors.textMuted, alignSelf: 'flex-end', marginBottom: 12 }}>
              {lastMsgInput.length}/200
            </Text>
            <TouchableOpacity
              style={[S.cancelBtn, { backgroundColor: Colors.primary, borderWidth: 0, marginBottom: 8 }]}
              onPress={saveLastMessage}
              disabled={savingMsg}
            >
              <Text style={[S.cancelBtnText, { color: '#fff' }]}>{savingMsg ? t.saving : t.save}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.cancelBtn} onPress={() => setShowLastMsgModal(false)} disabled={savingMsg}>
              <Text style={S.cancelBtnText}>{t.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, marginTop: 8 },
  retryBtnText: { fontSize: 14, color: Colors.textMid },

  main: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 32, gap: 20 },

  heroSection: { alignItems: 'center', gap: 12 },
  nameArea:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  dollName:    { fontSize: 36, fontWeight: '700', color: Colors.primary, letterSpacing: 1 },
  deceasedBadge:     { backgroundColor: Colors.borderLight, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  deceasedBadgeText: { fontSize: 11, color: Colors.textMuted },
  pBadge:     { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1 },
  pBadgeText: { fontSize: 12, fontWeight: '600' },

  bubble:         { width: '100%', backgroundColor: Colors.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: Colors.accentLight },
  bubbleMemorial: { backgroundColor: '#16213e', borderColor: '#2d2d4e' },
  bubbleText:     { fontSize: 14, color: Colors.text, lineHeight: 25, fontStyle: 'italic', textAlign: 'center' },

  lastMsgBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 18, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed' },
  lastMsgBtnText: { color: Colors.textMuted, fontSize: 13 },

  statsCard:   { width: '100%', backgroundColor: Colors.card, borderRadius: 20, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, borderWidth: 1, borderColor: Colors.borderLight },
  statItem:    { alignItems: 'center', gap: 4 },
  statNum:     { fontSize: 22, fontWeight: '800', color: Colors.primary },
  statLab:     { fontSize: 11, color: Colors.textMuted },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.border },
  hint:        { fontSize: 12, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  fixedBottom: {
    position:   'absolute',
    bottom:     0,
    left:       0,
    right:      0,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth:    1,
    borderTopColor:    Colors.borderLight,
  },
  btnRow:      { flexDirection: 'row', gap: 10 },
  wardrobeBtn: { paddingVertical: 16, paddingHorizontal: 20, borderRadius: 16, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.card, flexDirection: 'row', alignItems: 'center', gap: 8 },
  wardrobeBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  chatBtn:     { flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  chatBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  overlay: { flex: 1, backgroundColor: 'rgba(61,46,34,0.55)', alignItems: 'center', justifyContent: 'center' },
  modal:   { backgroundColor: Colors.card, borderRadius: 24, padding: 28, width: '85%', alignItems: 'center', gap: 12 },
  modalEmoji: { fontSize: 40 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.primary, textAlign: 'center' },
  modalDesc:  { fontSize: 14, color: Colors.textMid, lineHeight: 22, textAlign: 'center' },

  optionCard: {
    width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bg,
  },
  optionCardDanger: { borderColor: 'rgba(192,57,43,0.4)', backgroundColor: 'rgba(192,57,43,0.06)' },
  optionIcon:  { fontSize: 24 },
  optionTitle: { fontSize: 14, fontWeight: '700', color: Colors.primary, marginBottom: 4 },
  optionDesc:  { fontSize: 12, color: Colors.textMuted, lineHeight: 18 },

  cancelBtn:     { width: '100%', paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bg, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textMid },

  lastMsgTextarea: { width: '100%', padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, fontSize: 14, color: Colors.text, backgroundColor: Colors.bg, lineHeight: 22, minHeight: 100 },
});
