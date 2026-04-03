// app/(tabs)/settings.tsx - 설정
// 웹 Settings.jsx → React Native 변환
// 언어 전환, 로그아웃, 회원 탈퇴, 개발자 모드 (버전 7번 탭)

import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useMemorial } from '@/context/MemorialContext';
import { useLang } from '@/contexts/LanguageContext';
import { useT } from '@/hooks/useT';
import { Colors } from '@/constants/colors';

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const router  = useRouter();
  const { user, userProfile, logout } = useAuth();
  const { isMemorial } = useMemorial();
  const { lang, setLang } = useLang();
  const t = useT();

  const [loggingOut,   setLoggingOut]   = useState(false);
  const [withdrawing,  setWithdrawing]  = useState(false);
  const [versionTaps,  setVersionTaps]  = useState(0);
  const [devUnlocked,  setDevUnlocked]  = useState(false);

  const bg    = isMemorial ? Colors.memorial.bg   : Colors.bg;
  const card  = isMemorial ? Colors.memorial.card : Colors.card;
  const accent= isMemorial ? Colors.memorial.accent: Colors.accent;
  const textC = isMemorial ? Colors.memorial.text : Colors.primary;
  const mutedC= isMemorial ? Colors.memorial.textMuted : Colors.textMuted;

  async function handleLogout() {
    Alert.alert(t.logout, '', [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.logout,
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
          } catch {
            Alert.alert(t.error_logout);
          } finally { setLoggingOut(false); }
        },
      },
    ]);
  }

  async function handleWithdraw() {
    Alert.alert(
      t.withdraw,
      '계정이 삭제되며 복구할 수 없어요. 정말 탈퇴할까요?',
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.withdraw,
          style: 'destructive',
          onPress: async () => {
            setWithdrawing(true);
            try {
              if (user) {
                await firestore().collection('users').doc(user.uid).delete();
                await auth().currentUser?.delete();
              }
            } catch (e: any) {
              // 재인증 필요한 경우
              Alert.alert('탈퇴 실패', '보안을 위해 재로그인 후 다시 시도해주세요.');
            } finally { setWithdrawing(false); }
          },
        },
      ],
    );
  }

  // 버전 7번 탭으로 개발자 모드 활성화
  function handleVersionTap() {
    const next = versionTaps + 1;
    setVersionTaps(next);
    if (next >= 7) {
      setDevUnlocked(true);
      Alert.alert(t.dev_mode_unlocked);
    } else if (next >= 4) {
      Alert.alert(t.dev_mode_tap_hint(7 - next));
    }
  }

  const roleLabel = userProfile?.role === 'provider'
    ? t.role_provider_label
    : t.role_family_label;

  return (
    <SafeAreaView style={[S.safe, { backgroundColor: bg }]}>
      <View style={[S.header, isMemorial && { borderBottomColor: Colors.memorial.border }]}>
        <Text style={[S.title, { color: textC }]}>{t.settings}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>

        {/* 계정 섹션 */}
        <View style={[S.section, { backgroundColor: card }, isMemorial && { borderColor: Colors.memorial.border }]}>
          <Text style={[S.sectionLabel, { color: mutedC }]}>{t.settings_account}</Text>

          <SettingRow
            label={t.settings_name}
            value={userProfile?.name || '-'}
            isMemorial={isMemorial}
          />
          <View style={S.divider} />
          <SettingRow
            label={t.settings_role}
            value={roleLabel}
            isMemorial={isMemorial}
          />
          <View style={S.divider} />
          <SettingRow
            label={t.email}
            value={user?.email || '-'}
            isMemorial={isMemorial}
          />
        </View>

        {/* 언어 섹션 */}
        <View style={[S.section, { backgroundColor: card }, isMemorial && { borderColor: Colors.memorial.border }]}>
          <Text style={[S.sectionLabel, { color: mutedC }]}>{t.language}</Text>
          <View style={S.langRow}>
            <TouchableOpacity
              style={[S.langBtn, lang === 'ko' && { backgroundColor: accent, borderColor: accent }]}
              onPress={() => setLang('ko')}
            >
              <Text style={[S.langText, lang === 'ko' && { color: '#fff', fontWeight: '700' }]}>🇰🇷 한국어</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[S.langBtn, lang === 'en' && { backgroundColor: accent, borderColor: accent }]}
              onPress={() => setLang('en')}
            >
              <Text style={[S.langText, lang === 'en' && { color: '#fff', fontWeight: '700' }]}>🇺🇸 English</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 앱 정보 */}
        <View style={[S.section, { backgroundColor: card }, isMemorial && { borderColor: Colors.memorial.border }]}>
          <Text style={[S.sectionLabel, { color: mutedC }]}>{t.settings_app_info}</Text>
          <TouchableOpacity onPress={handleVersionTap} activeOpacity={0.7}>
            <SettingRow
              label={t.settings_version}
              value={APP_VERSION}
              isMemorial={isMemorial}
            />
          </TouchableOpacity>
        </View>

        {/* 개발자 모드 */}
        {(devUnlocked || __DEV__) && (
          <TouchableOpacity
            style={[S.section, S.devSection, { backgroundColor: card }]}
            onPress={() => router.push('/dev-mode' as any)}
          >
            <Text style={{ fontSize: 20 }}>🛠️</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#7c3aed', flex: 1, marginLeft: 12 }}>
              개발자 모드
            </Text>
            <Text style={{ color: Colors.textMuted }}>→</Text>
          </TouchableOpacity>
        )}

        {/* 로그아웃 */}
        <TouchableOpacity
          style={[S.actionBtn, { backgroundColor: card }, isMemorial && { borderColor: Colors.memorial.border }]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut
            ? <ActivityIndicator size="small" color={Colors.error} />
            : <Text style={[S.actionText, { color: Colors.error }]}>{t.logout}</Text>
          }
        </TouchableOpacity>

        {/* 회원 탈퇴 */}
        <TouchableOpacity
          style={[S.actionBtn, { borderColor: Colors.borderLight }]}
          onPress={handleWithdraw}
          disabled={withdrawing}
        >
          {withdrawing
            ? <ActivityIndicator size="small" color={Colors.textMuted} />
            : <Text style={[S.actionText, { color: Colors.textMuted }]}>{t.withdraw}</Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── 설정 행 컴포넌트 ───────────────────────────────────────────────
function SettingRow({ label, value, isMemorial }: { label: string; value: string; isMemorial: boolean }) {
  return (
    <View style={SR.row}>
      <Text style={[SR.label, { color: isMemorial ? Colors.memorial.textMid : Colors.textMid }]}>{label}</Text>
      <Text style={[SR.value, { color: isMemorial ? Colors.memorial.text : Colors.primary }]}>{value}</Text>
    </View>
  );
}
const SR = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  label: { fontSize: 14, color: Colors.textMid },
  value: { fontSize: 14, color: Colors.primary, fontWeight: '500' },
});

const S = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  title:  { fontSize: 20, fontWeight: '700', color: Colors.primary },

  section: {
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '600', letterSpacing: 0.5,
    marginBottom: 8, color: Colors.textMuted,
  },
  divider: { height: 1, backgroundColor: Colors.borderLight },

  langRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  langBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center',
  },
  langText: { fontSize: 14, color: Colors.textMid },

  devSection: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#ddd6fe',
  },

  actionBtn: {
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.borderLight,
    alignItems: 'center',
  },
  actionText: { fontSize: 15, fontWeight: '600' },
});
