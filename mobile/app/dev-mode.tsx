// app/dev-mode.tsx - 개발자 모드
// 설정 화면에서 버전 7번 탭으로 진입
// __DEV__ 환경 또는 버전 탭 7번 달성 시에만 접근 가능

import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/colors';
import { apiCall } from '@/utils/api';

export default function DevModeScreen() {
  const router = useRouter();
  const { user, userProfile, refreshProfile } = useAuth();

  const [loading, setLoading] = useState<string | null>(null);
  const [log,     setLog]     = useState<string[]>([]);

  function addLog(msg: string) {
    setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 19)]);
  }

  async function run(key: string, fn: () => Promise<void>) {
    setLoading(key);
    try {
      await fn();
    } catch (e: any) {
      addLog(`❌ ${key}: ${e.message || e}`);
    } finally { setLoading(null); }
  }

  // ── Dev 액션들 ───────────────────────────────────────────────────

  async function addGems100() {
    await run('gems', async () => {
      if (!user) return;
      await firestore().collection('users').doc(user.uid).update({
        gems: firestore.FieldValue.increment(100),
      });
      await refreshProfile();
      addLog('✅ 기억 조각 +100 추가');
    });
  }

  async function resetGems() {
    await run('resetGems', async () => {
      if (!user) return;
      await firestore().collection('users').doc(user.uid).update({ gems: 0 });
      await refreshProfile();
      addLog('✅ 기억 조각 초기화');
    });
  }

  async function unlockAllItems() {
    await run('unlock', async () => {
      if (!user) return;
      const allIds = [
        'slick','undercut','bun','ponytail','twin',
        '#8a8a8a','#e8e0d0','#e8c84a','#d47090','#7060b0','#4878c0','#c03020',
        'sleepy','sparkle','sharp',
        '#7060b0','#c04060','#40a0c0',
        'uniform','suit','sportswear','dress','hanbok',
        '#7a5c8a','#2c3e5c','#5a9a8a','#c4705a','#d4a030','#2a2a2a','#ffffff',
        '#dde8f0','#f0dde8','#d8f0d8',
        'glasses','hat','crown','ribbon','earring','scarf',
      ];
      const ref = firestore().collection('userItems').doc(user.uid);
      const snap = await ref.get();
      if (snap.exists) {
        await ref.update({ ownedItems: firestore.FieldValue.arrayUnion(...allIds) });
      } else {
        await ref.set({ ownedItems: allIds });
      }
      addLog('✅ 모든 아이템 잠금 해제');
    });
  }

  async function toggleDeceased() {
    await run('deceased', async () => {
      if (!user || userProfile?.role !== 'provider') {
        addLog('❌ provider 계정만 사용 가능');
        return;
      }
      const current = userProfile?.isDeceased ?? false;
      await firestore().collection('users').doc(user.uid).update({
        isDeceased: !current,
      });
      await refreshProfile();
      addLog(`✅ isDeceased: ${!current}`);
    });
  }

  async function clearDollChats() {
    await run('clearChats', async () => {
      if (!user) return;
      const snap = await firestore()
        .collection('dollChats')
        .where('userId', '==', user.uid)
        .get();
      const batch = firestore().batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      addLog(`✅ Doll 대화 ${snap.size}개 삭제`);
    });
  }

  async function pingBackend() {
    await run('ping', async () => {
      const res = await apiCall('GET', '/api/health');
      addLog(`✅ Backend: ${JSON.stringify(res)}`);
    });
  }

  async function showProfile() {
    addLog(`ℹ️ ${JSON.stringify({
      uid:       user?.uid?.slice(0, 8),
      role:      userProfile?.role,
      gems:      userProfile?.gems,
      deceased:  userProfile?.isDeceased,
      invCode:   userProfile?.inviteCode,
    }, null, 2)}`);
  }

  const ACTIONS = [
    { key: 'gems',       label: '💎 기억 조각 +100',        fn: addGems100 },
    { key: 'resetGems',  label: '🔄 기억 조각 초기화',       fn: resetGems },
    { key: 'unlock',     label: '🔓 모든 아이템 해제',        fn: unlockAllItems },
    { key: 'deceased',   label: '☠️ isDeceased 토글',       fn: toggleDeceased },
    { key: 'clearChats', label: '🗑 Doll 대화 기록 삭제',    fn: clearDollChats },
    { key: 'ping',       label: '🌐 백엔드 헬스체크',        fn: pingBackend },
    { key: 'profile',    label: '👤 프로필 정보 출력',        fn: showProfile },
  ];

  return (
    <SafeAreaView style={S.safe}>
      {/* 헤더 */}
      <View style={S.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontSize: 14, color: Colors.accent }}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={S.title}>🛠️ 개발자 모드</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {/* 경고 */}
        <View style={S.warnCard}>
          <Text style={S.warnText}>⚠️ 개발/테스트용 전용 기능입니다. 실제 데이터에 영향을 줍니다.</Text>
        </View>

        {/* 현재 상태 */}
        <View style={S.infoCard}>
          <Text style={S.infoTitle}>현재 상태</Text>
          <Text style={S.infoRow}>UID: {user?.uid?.slice(0, 12) ?? '-'}…</Text>
          <Text style={S.infoRow}>Role: {userProfile?.role ?? '-'}</Text>
          <Text style={S.infoRow}>💎 Gems: {userProfile?.gems ?? 0}</Text>
          <Text style={S.infoRow}>isDeceased: {String(userProfile?.isDeceased ?? false)}</Text>
          <Text style={S.infoRow}>InviteCode: {userProfile?.inviteCode ?? '-'}</Text>
        </View>

        {/* 액션 버튼들 */}
        {ACTIONS.map(action => (
          <TouchableOpacity
            key={action.key}
            style={[S.actionBtn, loading === action.key && { opacity: 0.6 }]}
            onPress={action.fn}
            disabled={!!loading}
          >
            {loading === action.key
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <Text style={S.actionText}>{action.label}</Text>
            }
          </TouchableOpacity>
        ))}

        {/* 로그 */}
        {log.length > 0 && (
          <View style={S.logCard}>
            <Text style={S.logTitle}>로그</Text>
            {log.map((l, i) => (
              <Text key={i} style={S.logLine}>{l}</Text>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  title:  { fontSize: 17, fontWeight: '700', color: Colors.primary },

  warnCard: {
    backgroundColor: '#fef3c7', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#fbbf24',
  },
  warnText: { fontSize: 12, color: '#92400e', lineHeight: 18 },

  infoCard: {
    backgroundColor: Colors.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.borderLight, gap: 4,
  },
  infoTitle: { fontSize: 13, fontWeight: '700', color: Colors.primary, marginBottom: 6 },
  infoRow:   { fontSize: 12, color: Colors.textMid, fontFamily: 'monospace' },

  actionBtn: {
    backgroundColor: Colors.card, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  actionText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },

  logCard: {
    backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, gap: 4,
  },
  logTitle: { fontSize: 12, fontWeight: '700', color: '#e8e0f0', marginBottom: 6 },
  logLine:  { fontSize: 11, color: '#9088a8', fontFamily: 'monospace', lineHeight: 18 },
});
