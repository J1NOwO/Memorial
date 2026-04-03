// app/trust-settings.tsx - 사후 전환
// 웹 TrustSettings.jsx → React Native 변환
// 신뢰 가족만 접근 가능. 단계별 확인 후 제공자 계정을 추모 모드로 전환

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useMemorial } from '@/context/MemorialContext';
import { useT } from '@/hooks/useT';
import { apiCall } from '@/utils/api';
import { Colors } from '@/constants/colors';

type Step = 'info' | 'caution' | 'confirm' | 'done';

export default function TrustSettingsScreen() {
  const router  = useRouter();
  const { user, userProfile } = useAuth();
  const { isMemorial, providerName } = useMemorial();
  const t = useT();

  const [step,       setStep]       = useState<Step>('info');
  const [connection, setConnection] = useState<any>(null);
  const [provider,   setProvider]   = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [confirmInput, setConfirmInput] = useState('');
  const [processing,   setProcessing]   = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const connSnap = await firestore()
        .collection('connections')
        .where('familyId', '==', user.uid)
        .where('status', '==', 'accepted')
        .where('isTrusted', '==', true)
        .get();
      if (connSnap.empty) {
        Alert.alert(t.trust_load_fail);
        router.back();
        return;
      }
      const conn = { id: connSnap.docs[0].id, ...connSnap.docs[0].data() };
      setConnection(conn);
      const pSnap = await firestore().collection('users').doc((conn as any).providerId).get();
      if (pSnap.exists) setProvider({ id: pSnap.id, ...pSnap.data() });
    } catch {
      Alert.alert(t.trust_load_fail);
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function handleComplete() {
    if (confirmInput.trim() !== t.trust_confirm_word) {
      Alert.alert(t.trust_confirm_error);
      return;
    }
    setProcessing(true);
    try {
      await apiCall('POST', '/api/connections/deceased', {
        providerId: provider?.id,
      });
      setStep('done');
    } catch (e: any) {
      Alert.alert(t.error_deceased_transition, e.message || '');
    } finally { setProcessing(false); }
  }

  const pName = provider?.name || providerName || '제공자';
  const accent= Colors.accent;
  const isDone = provider?.isDeceased || step === 'done';

  if (loading) {
    return (
      <SafeAreaView style={S.safe}>
        <View style={S.centered}><ActivityIndicator color={accent} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={S.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* 헤더 */}
        <View style={S.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ fontSize: 14, color: accent }}>{t.back}</Text>
          </TouchableOpacity>
          <Text style={S.title}>{t.trust_settings_title}</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>

          {/* 연결 정보 */}
          <View style={S.card}>
            <Text style={S.cardLabel}>{t.trust_connected_label}</Text>
            <Text style={S.cardValue}>{pName}</Text>
            <View style={S.divider} />
            <Text style={S.cardLabel}>{t.trust_status_label}</Text>
            <Text style={[S.cardValue, { color: isDone ? Colors.memorial.accent : Colors.success }]}>
              {isDone ? t.trust_status_done : t.trust_status_alive}
            </Text>
          </View>

          {/* 전환 완료 상태 */}
          {isDone && (
            <View style={[S.doneCard, { backgroundColor: Colors.memorial.accentPale }]}>
              <Text style={{ fontSize: 36, marginBottom: 12 }}>🕯️</Text>
              <Text style={[S.doneTitle, { color: Colors.memorial.text }]}>
                {t.trust_done_title}
              </Text>
              <Text style={[S.doneDesc, { color: Colors.memorial.textMid }]}>
                {t.trust_done_desc(pName)}
              </Text>
              <TouchableOpacity
                style={[S.btn, { backgroundColor: Colors.memorial.accent, marginTop: 16 }]}
                onPress={() => router.push('/chat' as any)}
              >
                <Text style={S.btnText}>{t.trust_done_chat_btn}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 단계별 UI */}
          {!isDone && step === 'info' && (
            <>
              <View style={S.infoBox}>
                <Text style={S.infoTitle}>{t.trust_info_title}</Text>
                <Text style={S.infoText}>{t.trust_info_desc1(pName)}</Text>
                <Text style={[S.infoText, { marginTop: 6 }]}>{t.trust_info_desc2(pName)}</Text>
              </View>
              <Text style={S.warningText}>{t.trust_warning}</Text>
              <TouchableOpacity
                style={[S.btn, { backgroundColor: accent }]}
                onPress={() => setStep('caution')}
              >
                <Text style={S.btnText}>{t.trust_start_btn}</Text>
              </TouchableOpacity>
            </>
          )}

          {!isDone && step === 'caution' && (
            <>
              <View style={[S.infoBox, { borderColor: '#fca5a5', backgroundColor: '#fef2f2' }]}>
                <Text style={[S.infoTitle, { color: '#b91c1c' }]}>{t.trust_caution_title}</Text>
                {[
                  t.trust_caution_1,
                  t.trust_caution_2(pName),
                  t.trust_caution_3,
                  t.trust_caution_4(userProfile?.name || ''),
                ].map((caution, i) => (
                  <View key={i} style={S.cautionRow}>
                    <Text style={{ color: '#b91c1c', fontSize: 14 }}>⚠️ </Text>
                    <Text style={{ fontSize: 14, color: '#7f1d1d', flex: 1 }}>{caution}</Text>
                  </View>
                ))}
              </View>
              <View style={S.rowBtns}>
                <TouchableOpacity
                  style={[S.btn, { flex: 1, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card }]}
                  onPress={() => setStep('info')}
                >
                  <Text style={[S.btnText, { color: Colors.textMid }]}>{t.trust_prev}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[S.btn, { flex: 1, backgroundColor: accent }]}
                  onPress={() => setStep('confirm')}
                >
                  <Text style={S.btnText}>{t.trust_continue_btn}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {!isDone && step === 'confirm' && (
            <>
              <View style={S.infoBox}>
                <Text style={S.infoTitle}>{t.trust_final_title}</Text>
                <Text style={[S.infoText, { marginBottom: 12 }]}>{t.trust_final_desc}</Text>
                <TextInput
                  style={[S.confirmInput, { borderColor: confirmInput === t.trust_confirm_word ? Colors.success : Colors.border }]}
                  value={confirmInput}
                  onChangeText={setConfirmInput}
                  placeholder={t.trust_confirm_word}
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <View style={S.rowBtns}>
                <TouchableOpacity
                  style={[S.btn, { flex: 1, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card }]}
                  onPress={() => setStep('caution')}
                  disabled={processing}
                >
                  <Text style={[S.btnText, { color: Colors.textMid }]}>{t.trust_prev}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[S.btn, { flex: 1, backgroundColor: Colors.error, opacity: processing ? 0.6 : 1 }]}
                  onPress={handleComplete}
                  disabled={processing}
                >
                  {processing
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={S.btnText}>{t.trust_complete_btn}</Text>
                  }
                </TouchableOpacity>
              </View>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:  {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  title:   { fontSize: 17, fontWeight: '700', color: Colors.primary },

  card:  {
    backgroundColor: Colors.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  cardLabel: { fontSize: 11, color: Colors.textMuted, marginBottom: 4, letterSpacing: 0.5 },
  cardValue: { fontSize: 16, fontWeight: '700', color: Colors.primary, marginBottom: 12 },
  divider:   { height: 1, backgroundColor: Colors.borderLight, marginVertical: 4 },

  doneCard:  { borderRadius: 16, padding: 24, alignItems: 'center' },
  doneTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  doneDesc:  { fontSize: 14, textAlign: 'center', lineHeight: 21 },

  infoBox: {
    backgroundColor: Colors.accentPale, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.accentLight,
  },
  infoTitle: { fontSize: 15, fontWeight: '700', color: Colors.primary, marginBottom: 10 },
  infoText:  { fontSize: 14, color: Colors.textMid, lineHeight: 21 },
  warningText: { fontSize: 13, color: Colors.error, textAlign: 'center' },

  cautionRow: { flexDirection: 'row', marginTop: 8 },

  confirmInput: {
    borderWidth: 1.5, borderRadius: 10, padding: 12,
    fontSize: 16, textAlign: 'center', color: Colors.text,
    backgroundColor: Colors.card,
  },

  btn: {
    paddingVertical: 14, borderRadius: 14, alignItems: 'center',
  },
  btnText: { fontSize: 15, color: '#fff', fontWeight: '700' },

  rowBtns: { flexDirection: 'row', gap: 10 },
});
