// app/(tabs)/family.tsx - 가족 연결 관리
// 웹 FamilyConnect.jsx → React Native 변환
// 초대 코드 복사, 연결 요청 승인/거절, 신뢰 가족 지정

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useMemorial } from '@/context/MemorialContext';
import { useT } from '@/hooks/useT';
import { apiCall } from '@/utils/api';
import { Colors } from '@/constants/colors';

export default function FamilyScreen() {
  const { user, userProfile, refreshProfile } = useAuth();
  const { isMemorial } = useMemorial();
  const t = useT();

  const [connections, setConnections] = useState<any[]>([]);
  const [pending,     setPending]     = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [copied,      setCopied]      = useState(false);
  const [actionId,    setActionId]    = useState<string | null>(null);

  const isProvider = userProfile?.role === 'provider';

  const load = useCallback(async () => {
    if (!user || !isProvider) { setLoading(false); return; }
    setLoading(true);
    try {
      const snap = await firestore()
        .collection('connections')
        .where('providerId', '==', user.uid)
        .get();
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPending(all.filter((c: any) => c.status === 'pending'));
      setConnections(all.filter((c: any) => c.status === 'accepted'));
    } catch {
      Alert.alert(t.connection_load_fail);
    } finally { setLoading(false); }
  }, [user, isProvider]);

  useEffect(() => { load(); }, [load]);

  function copyInviteCode() {
    if (!userProfile?.inviteCode) return;
    Clipboard.setString(userProfile.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleApprove(id: string) {
    setActionId(id);
    try {
      await apiCall('POST', `/api/connections/${id}/approve`);
      await load();
    } catch {
      Alert.alert(t.error_approve);
    } finally { setActionId(null); }
  }

  async function handleReject(id: string) {
    Alert.alert(t.confirm_reject, '', [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.reject, style: 'destructive',
        onPress: async () => {
          setActionId(id);
          try {
            await apiCall('DELETE', `/api/connections/${id}`);
            await load();
          } catch { Alert.alert(t.error_reject); }
          finally { setActionId(null); }
        },
      },
    ]);
  }

  async function handleToggleMemory(id: string, current: boolean) {
    setActionId(id);
    try {
      await apiCall('PATCH', `/api/connections/${id}`, { canViewMemories: !current });
      setConnections(prev => prev.map(c => c.id === id ? { ...c, canViewMemories: !current } : c));
    } catch { Alert.alert(t.error_permission); }
    finally { setActionId(null); }
  }

  async function handleSetTrust(id: string, name: string) {
    const currentTrusted = connections.find(c => c.isTrusted);
    if (currentTrusted && currentTrusted.id !== id) {
      Alert.alert(t.confirm_trust_change(currentTrusted.familyName, name), '', [
        { text: t.cancel, style: 'cancel' },
        { text: t.confirm, onPress: () => doSetTrust(id) },
      ]);
    } else {
      doSetTrust(id);
    }
  }

  async function doSetTrust(id: string) {
    setActionId(id);
    try {
      await apiCall('POST', `/api/connections/${id}/trust`);
      setConnections(prev => prev.map(c => ({ ...c, isTrusted: c.id === id })));
      const conn = connections.find(c => c.id === id);
      if (conn) Alert.alert(t.trust_set_success(conn.familyName));
      await refreshProfile();
    } catch { Alert.alert(t.error_trust_set); }
    finally { setActionId(null); }
  }

  const bg    = isMemorial ? Colors.memorial.bg   : Colors.bg;
  const card  = isMemorial ? Colors.memorial.card : Colors.card;
  const accent= isMemorial ? Colors.memorial.accent: Colors.accent;
  const textC = isMemorial ? Colors.memorial.text : Colors.primary;

  // 유족 화면: 연결 정보만 보여줌
  if (!isProvider) {
    return (
      <SafeAreaView style={[S.safe, { backgroundColor: bg }]}>
        <View style={[S.header, isMemorial && { borderBottomColor: Colors.memorial.border }]}>
          <Text style={[S.title, { color: textC }]}>{t.family_connect}</Text>
        </View>
        <View style={S.centered}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>👨‍👩‍👧</Text>
          <Text style={[S.emptyText, isMemorial && { color: Colors.memorial.textMid }]}>
            {t.no_family_desc}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[S.safe, { backgroundColor: bg }]}>
      <View style={[S.header, isMemorial && { borderBottomColor: Colors.memorial.border }]}>
        <Text style={[S.title, { color: textC }]}>{t.family_connect}</Text>
      </View>

      {loading ? (
        <View style={S.centered}><ActivityIndicator color={accent} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>

          {/* 추모 모드 잠금 */}
          {isMemorial && (
            <View style={[S.memBanner, { backgroundColor: Colors.memorial.accentPale }]}>
              <Text style={{ fontSize: 13, color: Colors.memorial.textMid, textAlign: 'center' }}>
                🔒 {t.memorial_no_edit}
              </Text>
            </View>
          )}

          {/* 초대 코드 */}
          {userProfile?.inviteCode && (
            <View style={[S.inviteCard, { backgroundColor: card }, isMemorial && { borderColor: Colors.memorial.border }]}>
              <Text style={[S.sectionLabel, { color: isMemorial ? Colors.memorial.textMid : Colors.textMid }]}>
                {t.connection_invite_title}
              </Text>
              <View style={S.codeRow}>
                <Text style={[S.code, { color: textC }]}>{userProfile.inviteCode}</Text>
                <TouchableOpacity
                  style={[S.copyBtn, { backgroundColor: accent }]}
                  onPress={copyInviteCode}
                >
                  <Text style={S.copyBtnText}>{copied ? t.copy_done : t.copy}</Text>
                </TouchableOpacity>
              </View>
              <Text style={[S.inviteDesc, { color: isMemorial ? Colors.memorial.textMuted : Colors.textMuted }]}>
                {t.connection_invite_desc}
              </Text>
            </View>
          )}

          {/* 연결 요청 */}
          {pending.length > 0 && (
            <View>
              <Text style={[S.sectionTitle, { color: textC }]}>{t.pending_requests} ({pending.length})</Text>
              {pending.map(conn => (
                <View key={conn.id} style={[S.connCard, { backgroundColor: card }, isMemorial && { borderColor: Colors.memorial.border }]}>
                  <View style={S.connInfo}>
                    <Text style={{ fontSize: 22 }}>👤</Text>
                    <View>
                      <Text style={[S.connName, { color: textC }]}>{conn.familyName}</Text>
                      <Text style={[S.connRel, { color: isMemorial ? Colors.memorial.textMuted : Colors.textMuted }]}>
                        {conn.relation}
                      </Text>
                    </View>
                  </View>
                  <View style={S.connActions}>
                    <TouchableOpacity
                      style={[S.approveBtn, actionId === conn.id && { opacity: 0.5 }]}
                      onPress={() => handleApprove(conn.id)}
                      disabled={!!actionId}
                    >
                      {actionId === conn.id
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={S.approveBtnText}>{t.accept}</Text>
                      }
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[S.rejectBtn, actionId === conn.id && { opacity: 0.5 }]}
                      onPress={() => handleReject(conn.id)}
                      disabled={!!actionId}
                    >
                      <Text style={S.rejectBtnText}>{t.reject}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* 연결된 가족 */}
          <View>
            <Text style={[S.sectionTitle, { color: textC }]}>{t.family_group_title}</Text>
            {connections.length === 0 ? (
              <View style={[S.emptyCard, { backgroundColor: card }, isMemorial && { borderColor: Colors.memorial.border }]}>
                <Text style={[S.emptyText, { color: isMemorial ? Colors.memorial.textMuted : Colors.textMuted }]}>
                  {t.no_family}
                </Text>
                <Text style={{ fontSize: 12, color: isMemorial ? Colors.memorial.textMuted : Colors.textMuted, marginTop: 4 }}>
                  {t.no_family_desc}
                </Text>
              </View>
            ) : (
              connections.map(conn => (
                <View key={conn.id} style={[S.connCard, { backgroundColor: card }, isMemorial && { borderColor: Colors.memorial.border }]}>
                  <View style={S.connInfo}>
                    <Text style={{ fontSize: 22 }}>{conn.isTrusted ? '🔑' : '👤'}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[S.connName, { color: textC }]}>{conn.familyName}</Text>
                        {conn.isTrusted && (
                          <View style={[S.trustBadge, { backgroundColor: accent }]}>
                            <Text style={S.trustBadgeText}>{t.trust_badge}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[S.connRel, { color: isMemorial ? Colors.memorial.textMuted : Colors.textMuted }]}>
                        {conn.relation}
                      </Text>
                    </View>
                  </View>

                  {!isMemorial && (
                    <View style={S.permRow}>
                      {/* 기억 열람 권한 */}
                      <TouchableOpacity
                        style={[
                          S.permBtn,
                          conn.canViewMemories
                            ? { backgroundColor: Colors.accentPale, borderColor: Colors.accent }
                            : { borderColor: Colors.border },
                        ]}
                        onPress={() => handleToggleMemory(conn.id, conn.canViewMemories)}
                        disabled={!!actionId}
                      >
                        <Text style={{ fontSize: 11, color: conn.canViewMemories ? Colors.accent : Colors.textMuted }}>
                          📚 {t.memory_view}
                        </Text>
                      </TouchableOpacity>

                      {/* 신뢰 가족 지정 */}
                      {!conn.isTrusted && (
                        <TouchableOpacity
                          style={[S.permBtn, { borderColor: Colors.border }]}
                          onPress={() => handleSetTrust(conn.id, conn.familyName)}
                          disabled={!!actionId}
                        >
                          <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                            🔑 {t.trust_designate}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              ))
            )}
          </View>

          {/* 신뢰 가족 안내 */}
          {!isMemorial && (
            <View style={[S.infoCard, { backgroundColor: card }]}>
              <Text style={[S.infoTitle, { color: textC }]}>{t.trust_family_info_title}</Text>
              <Text style={[S.infoDesc, { color: isMemorial ? Colors.memorial.textMuted : Colors.textMuted }]}>
                {t.trust_family_info_desc1}
              </Text>
              <Text style={[S.infoDesc, { color: isMemorial ? Colors.memorial.textMuted : Colors.textMuted, marginTop: 4 }]}>
                {t.trust_family_info_desc2}
              </Text>
            </View>
          )}

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  header:  {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  title:   { fontSize: 20, fontWeight: '700', color: Colors.primary },

  memBanner: { padding: 12, borderRadius: 12 },

  // 초대 코드 카드
  inviteCard: {
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.borderLight,
  },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 },
  codeRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  code:        { fontSize: 22, fontWeight: '800', letterSpacing: 3, color: Colors.primary },
  copyBtn:     { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 10 },
  copyBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  inviteDesc:  { fontSize: 12, lineHeight: 18, color: Colors.textMuted },

  // 섹션
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.primary, marginBottom: 10 },

  // 연결 카드
  connCard: {
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.borderLight,
    marginBottom: 8,
  },
  connInfo:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  connName:    { fontSize: 15, fontWeight: '700', color: Colors.primary },
  connRel:     { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  connActions: { flexDirection: 'row', gap: 8 },
  approveBtn:  { flex: 1, paddingVertical: 8, backgroundColor: Colors.accent, borderRadius: 10, alignItems: 'center' },
  approveBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  rejectBtn:   { flex: 1, paddingVertical: 8, backgroundColor: '#fee2e2', borderRadius: 10, alignItems: 'center' },
  rejectBtnText:  { fontSize: 13, color: Colors.error, fontWeight: '600' },

  // 권한 버튼
  permRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  permBtn:     { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1.5 },

  // 뱃지
  trustBadge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 10 },
  trustBadgeText: { fontSize: 10, color: '#fff', fontWeight: '600' },

  // 빈 카드
  emptyCard:  { borderRadius: 14, padding: 20, borderWidth: 1, borderColor: Colors.borderLight, alignItems: 'center' },
  emptyText:  { fontSize: 14, color: Colors.textMuted },

  // 안내 카드
  infoCard:   { borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.borderLight },
  infoTitle:  { fontSize: 14, fontWeight: '700', color: Colors.primary, marginBottom: 8 },
  infoDesc:   { fontSize: 12, color: Colors.textMuted, lineHeight: 18 },
});
