// app/(tabs)/index.tsx - 메인 대시보드
// 웹 Dashboard.jsx → React Native 변환
// Link → TouchableOpacity + router.push
// Firestore web SDK → @react-native-firebase/firestore

import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useMemorial } from '@/context/MemorialContext';
import { useT } from '@/hooks/useT';
import { useLang } from '@/contexts/LanguageContext';
import { apiCall } from '@/utils/api';
import DollAvatar from '@/components/DollAvatar';
import { Colors } from '@/constants/colors';

function getTimeGreeting(t: any) {
  const h = new Date().getHours();
  if (h < 6)  return `${t.greeting_night} 🌙`;
  if (h < 11) return `${t.greeting_morning} ☀️`;
  if (h < 14) return `${t.greeting_afternoon} 🌤`;
  if (h < 18) return `${t.greeting_afternoon} 🌿`;
  if (h < 22) return `${t.greeting_evening} 🌆`;
  return `${t.greeting_night} 🌙`;
}

export default function DashboardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ pendingInvite?: string; relation?: string }>();
  const { user, userProfile, logout } = useAuth();
  const { isMemorial, providerName } = useMemorial();
  const t = useT();
  const { lang } = useLang();

  const [pendingInvite, setPendingInvite] = useState<{ code: string; relation: string } | null>(null);
  const [retryLoading, setRetryLoading]   = useState(false);
  const [retryError, setRetryError]       = useState('');
  const [retrySuccess, setRetrySuccess]   = useState(false);

  const [isTrustedFamily, setIsTrustedFamily]     = useState(false);
  const [providerDeceased, setProviderDeceased]   = useState(false);

  const [doll, setDoll]             = useState<any>(null);
  const [dollGreeting, setDollGreeting] = useState('');
  const [todayCount, setTodayCount] = useState(0);
  const DAILY_Q = 3;

  // params로 넘어온 pendingInvite 처리
  useEffect(() => {
    if (params.pendingInvite) {
      setPendingInvite({ code: params.pendingInvite, relation: params.relation || '' });
    }
  }, [params.pendingInvite]);

  // 유족: 연결 정보 로드
  useEffect(() => {
    if (!user || userProfile?.role !== 'family') return;
    async function loadFamily() {
      try {
        const snap = await firestore()
          .collection('connections')
          .where('familyId', '==', user!.uid)
          .where('status', '==', 'accepted')
          .get();
        if (snap.empty) return;
        const conn = snap.docs[0].data();
        setIsTrustedFamily(conn.isTrusted === true);
        const pSnap = await firestore().collection('users').doc(conn.providerId).get();
        if (pSnap.exists) setProviderDeceased(pSnap.data()?.isDeceased === true);
      } catch {}
    }
    loadFamily();
  }, [user, userProfile]);

  // 제공자: Doll + 오늘 질문 진행률 로드
  useEffect(() => {
    if (!user || userProfile?.role !== 'provider') return;
    async function loadDoll() {
      try {
        const r = await apiCall('GET', '/api/doll/me');
        if (r?.doll) {
          setDoll(r.doll);
          const gr = await apiCall('GET', `/api/doll/greeting?dollId=${r.doll.id}&lang=${lang}`);
          setDollGreeting(gr?.greeting || '');
        }
      } catch {}
    }
    async function loadTodayProgress() {
      try {
        const snap = await firestore()
          .collection('answers')
          .where('userId', '==', user!.uid)
          .get();
        const today = new Date().toISOString().split('T')[0];
        const count = snap.docs.filter((d) => {
          const ts = d.data().createdAt?.toDate?.();
          return ts && ts.toISOString().split('T')[0] === today;
        }).length;
        setTodayCount(count);
      } catch {}
    }
    loadDoll();
    loadTodayProgress();
  }, [user, userProfile]);

  async function handleRetryJoin() {
    if (!pendingInvite) return;
    setRetryLoading(true); setRetryError('');
    try {
      await apiCall('POST', '/api/connections/join', {
        inviteCode: pendingInvite.code,
        relation:   pendingInvite.relation,
      });
      setRetrySuccess(true); setPendingInvite(null);
    } catch (e: any) {
      setRetryError(e.message || t.connect_error);
    } finally { setRetryLoading(false); }
  }

  const isProvider   = userProfile?.role === 'provider';
  const isFamily     = userProfile?.role === 'family';
  const name         = userProfile?.name || user?.displayName?.split(' ')[0] || t.me;
  const progressPct  = Math.min((todayCount / DAILY_Q) * 100, 100);

  if (!userProfile) {
    return (
      <SafeAreaView style={S.safe}>
        <View style={S.centered}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[S.safe, isMemorial && { backgroundColor: Colors.memorial.bg }]}>
      {/* 헤더 */}
      <View style={[S.header, isMemorial && S.headerMemorial]}>
        <Text style={[S.logo, isMemorial && { color: Colors.memorial.textMid }]}>Memorial</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/settings' as any)} style={S.settingsBtn}>
          <Text style={{ fontSize: 20 }}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={S.main} showsVerticalScrollIndicator={false}>

        {/* ── 인사말 ── */}
        <View style={S.hero}>
          {isMemorial ? (
            <>
              <Text style={[S.greeting, { fontSize: 24, letterSpacing: 0.5 }]}>
                † {providerName}
              </Text>
              <Text style={S.subText}>{t.rip_message}</Text>
            </>
          ) : (
            <>
              <Text style={S.timeGreet}>{getTimeGreeting(t)}</Text>
              <Text style={S.greeting}>{t.greeting_hello(name)}</Text>
              <Text style={S.subText}>
                {isProvider ? t.dashboard_subtext_provider : t.dashboard_subtext_family}
              </Text>
            </>
          )}
        </View>

        {/* ── 재시도 배너 ── */}
        {pendingInvite && !retrySuccess && (
          <View style={S.banner}>
            <Text style={{ fontSize: 13, color: Colors.textMid, marginBottom: 8 }}>
              {t.connect_pending(pendingInvite.code)}
            </Text>
            {!!retryError && (
              <Text style={{ fontSize: 12, color: Colors.error, marginBottom: 6 }}>{retryError}</Text>
            )}
            <TouchableOpacity
              style={[S.retryBtn, retryLoading && { opacity: 0.55 }]}
              onPress={handleRetryJoin}
              disabled={retryLoading}
            >
              <Text style={S.retryBtnText}>
                {retryLoading ? t.connect_connecting : t.connect_retry}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {retrySuccess && (
          <View style={[S.banner, { borderColor: '#86efac', backgroundColor: '#f0fdf4' }]}>
            <Text style={{ fontSize: 13, color: '#166534' }}>{t.connect_success}</Text>
          </View>
        )}

        {/* ── 제공자 콘텐츠 ── */}
        {isProvider && (
          <>
            {/* Doll 카드 */}
            {doll ? (
              <TouchableOpacity style={S.dollCard} onPress={() => router.push('/(tabs)/doll')}>
                <View style={S.dollAvatarWrap}>
                  <DollAvatar appearance={doll.appearance || {}} size={90} animated />
                </View>
                <View style={S.dollBody}>
                  <View style={S.dollTop}>
                    <Text style={S.dollName}>
                      {isMemorial ? `† ${providerName || doll.name}` : doll.name}
                    </Text>
                    <View style={S.dollBadge}>
                      <Text style={S.dollBadgeText}>{t.doll_my_badge}</Text>
                    </View>
                  </View>
                  <Text style={S.dollGreeting} numberOfLines={2}>
                    {isMemorial
                      ? t.doll_memorial_greeting
                      : dollGreeting
                        ? `"${dollGreeting.length > 45 ? dollGreeting.slice(0, 45) + '…' : dollGreeting}"`
                        : t.doll_today_cta}
                  </Text>
                  <Text style={S.dollCta}>{t.doll_chat_cta}</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={S.dollCardEmpty} onPress={() => router.push('/doll/create' as any)}>
                <View style={S.dollEmptyIcon}>
                  <Text style={{ fontSize: 24 }}>🪆</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.primary, marginBottom: 3 }}>
                    {t.dashboard_doll_create}
                  </Text>
                  <Text style={{ fontSize: 13, color: Colors.textMuted }}>
                    {t.dashboard_doll_create_desc}
                  </Text>
                </View>
                <Text style={{ color: Colors.accent, fontSize: 18 }}>→</Text>
              </TouchableOpacity>
            )}

            {/* 오늘의 질문 카드 */}
            <TouchableOpacity
              style={S.progressCard}
              onPress={() => router.push('/(tabs)/questions' as any)}
              activeOpacity={0.85}
            >
              <View style={S.progressTop}>
                <View>
                  <Text style={S.progressTitle}>✍️ {t.today_question}</Text>
                  <Text style={S.progressSub}>{t.daily_q_sub(DAILY_Q)}</Text>
                </View>
                <View style={S.progressCount}>
                  <Text style={S.progressCountNum}>{Math.min(todayCount, DAILY_Q)}</Text>
                  <Text style={S.progressCountTotal}>/{DAILY_Q}</Text>
                </View>
              </View>
              <View style={S.progressBar}>
                <View style={[S.progressFill, { width: `${progressPct}%` as any }]} />
              </View>
              <Text style={S.progressHint}>
                {todayCount >= DAILY_Q ? t.daily_q_complete : t.daily_q_remaining(DAILY_Q - todayCount)}
              </Text>
            </TouchableOpacity>

            {/* 기능 카드 2개 */}
            <View style={S.grid}>
              <FeatureCard onPress={() => router.push('/(tabs)/memories' as any)} icon="📚" title={t.my_memory}       desc={t.memory_desc} />
              <FeatureCard onPress={() => router.push('/(tabs)/family' as any)}   icon="👨‍👩‍👧" title={t.family_connect} desc={t.family_connect_desc} />
            </View>

            {/* 초대 코드 */}
            {userProfile?.inviteCode && (
              <View style={S.inviteRow}>
                <View>
                  <Text style={S.inviteLabel}>{t.invite_code_label}</Text>
                  <Text style={S.inviteCode}>{userProfile.inviteCode}</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/(tabs)/family' as any)}>
                  <Text style={S.inviteLink}>{t.invite_manage}</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* ── 유족 콘텐츠 ── */}
        {isFamily && (
          <View style={S.grid}>
            {providerDeceased ? (
              <FeatureCard
                onPress={() => router.push('/chat' as any)}
                icon="💬" title={t.chat_title} desc={t.chat_desc}
                highlight
                fullWidth
              />
            ) : (
              <View style={[S.featureCard, { opacity: 0.45, gridColumn: 'span 2' as any }]}>
                <Text style={{ fontSize: 28, marginBottom: 10 }}>💬</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.primary, marginBottom: 4 }}>{t.chat_title}</Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted, lineHeight: 18 }}>{t.chat_disabled_desc}</Text>
              </View>
            )}
            {isTrustedFamily && !providerDeceased && (
              <FeatureCard
                onPress={() => router.push('/trust' as any)}
                icon="🔑" title={t.trust_title} desc={t.trust_desc}
                accent
              />
            )}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── 기능 카드 컴포넌트 ─────────────────────────────────────────────────────────
function FeatureCard({
  onPress, icon, title, desc, highlight, accent, fullWidth,
}: {
  onPress: () => void;
  icon: string; title: string; desc: string;
  highlight?: boolean; accent?: boolean; fullWidth?: boolean;
}) {
  const cardStyle = [
    S.featureCard,
    highlight && S.featureCardHighlight,
    accent    && S.featureCardAccent,
    fullWidth && { flex: 1 },
  ];
  return (
    <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.8}>
      <Text style={{ fontSize: 28, marginBottom: 10 }}>{icon}</Text>
      <Text style={[S.featureTitle, highlight && { color: '#fff' }]}>{title}</Text>
      <Text style={[S.featureDesc,  highlight && { color: 'rgba(255,255,255,0.75)' }]}>{desc}</Text>
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection:    'row',
    justifyContent:   'space-between',
    alignItems:       'center',
    paddingHorizontal: 20,
    paddingVertical:   14,
    backgroundColor:  'rgba(255,253,249,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerMemorial: {
    backgroundColor: 'rgba(22,33,62,0.97)',
    borderBottomColor: '#2d2d4e',
  },
  logo:        { fontSize: 20, fontWeight: '700', color: Colors.primary, letterSpacing: 3 },
  settingsBtn: { padding: 8 },

  main: { padding: 20, gap: 16 },

  // ── 인사말 ───────────────────────────────────────────────
  hero:      { marginBottom: 4 },
  timeGreet: { fontSize: 13, color: Colors.accent, fontWeight: '600', marginBottom: 6 },
  greeting:  { fontSize: 28, fontWeight: '700', color: Colors.primary, lineHeight: 36, marginBottom: 6 },
  subText:   { fontSize: 14, color: Colors.textMid },

  // ── 배너 ────────────────────────────────────────────────
  banner: {
    backgroundColor: Colors.accentPale,
    borderWidth:    1,
    borderColor:    Colors.accentLight,
    borderRadius:   16,
    padding:        14,
  },
  retryBtn:     { paddingVertical: 9, paddingHorizontal: 20, backgroundColor: Colors.accent, borderRadius: 8, alignSelf: 'flex-start' },
  retryBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },

  // ── Doll 카드 ────────────────────────────────────────────
  dollCard: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  Colors.card,
    borderRadius:     20,
    overflow:         'hidden',
    borderWidth:      1,
    borderColor:      Colors.borderLight,
    elevation:        2,
    shadowColor:      Colors.primary,
    shadowOffset:     { width: 0, height: 2 },
    shadowOpacity:    0.08,
    shadowRadius:     8,
  },
  dollAvatarWrap: {
    padding:         16,
    backgroundColor: Colors.accentPale,
    borderRightWidth: 1,
    borderRightColor: Colors.borderLight,
  },
  dollBody:     { padding: '16px 18px' as any, flex: 1 },
  dollTop:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  dollName:     { fontSize: 20, fontWeight: '700', color: Colors.primary },
  dollBadge:    { backgroundColor: Colors.accentPale, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: Colors.accentLight },
  dollBadgeText:{ fontSize: 10, color: Colors.accent, fontWeight: '600' },
  dollGreeting: { fontSize: 13, color: Colors.textMid, lineHeight: 20, fontStyle: 'italic', marginBottom: 8 },
  dollCta:      { fontSize: 12, color: Colors.accent, fontWeight: '700' },

  dollCardEmpty: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             14,
    backgroundColor: Colors.card,
    borderRadius:    20,
    padding:         18,
    borderWidth:     2,
    borderColor:     Colors.border,
    borderStyle:     'dashed',
  },
  dollEmptyIcon: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.bg,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── 진행률 카드 ──────────────────────────────────────────
  progressCard: {
    backgroundColor: Colors.card,
    borderRadius:    20,
    padding:         18,
    borderWidth:     1,
    borderColor:     Colors.borderLight,
    elevation:       1,
  },
  progressTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  progressTitle:    { fontSize: 15, fontWeight: '700', color: Colors.primary, marginBottom: 3 },
  progressSub:      { fontSize: 12, color: Colors.textMuted },
  progressCount:    { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  progressCountNum: { fontSize: 20, fontWeight: '800', color: Colors.accent },
  progressCountTotal:{ fontSize: 14, color: Colors.textMuted },
  progressBar:      { height: 6, backgroundColor: Colors.borderLight, borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  progressFill:     { height: 6, backgroundColor: Colors.accent, borderRadius: 3 },
  progressHint:     { fontSize: 12, color: Colors.textMuted },

  // ── 기능 카드 그리드 ────────────────────────────────────
  grid: { flexDirection: 'row', gap: 12 },
  featureCard: {
    flex:            1,
    backgroundColor: Colors.card,
    borderRadius:    20,
    padding:         20,
    borderWidth:     1,
    borderColor:     Colors.borderLight,
    elevation:       1,
  },
  featureCardHighlight: {
    backgroundColor: Colors.primary,
    borderWidth:     0,
  },
  featureCardAccent: {
    borderColor:     Colors.accent,
    backgroundColor: Colors.accentPale,
  },
  featureTitle: { fontSize: 15, fontWeight: '700', color: Colors.primary, marginBottom: 4 },
  featureDesc:  { fontSize: 12, color: Colors.textMuted, lineHeight: 18 },

  // ── 초대 코드 ────────────────────────────────────────────
  inviteRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.borderLight },
  inviteLabel: { fontSize: 10, color: Colors.textMuted, marginBottom: 3, letterSpacing: 0.5 },
  inviteCode:  { fontSize: 15, fontWeight: '700', color: Colors.primary, letterSpacing: 2 },
  inviteLink:  { fontSize: 13, color: Colors.accent, fontWeight: '700' },
});
