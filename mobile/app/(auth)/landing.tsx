// app/(auth)/landing.tsx - 서비스 소개 첫 화면
// 웹 Landing.jsx → React Native 변환
// Link → router.push, div → View, p → Text, 100vh → height: '100%'

import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/hooks/useT';
import { Colors } from '@/constants/colors';

export default function LandingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const t = useT();

  const features = [
    { icon: '✍️', title: t.landing_feature_q_title,       desc: t.landing_feature_q_desc },
    { icon: '🤖', title: t.landing_feature_ai_title,      desc: t.landing_feature_ai_desc },
    { icon: '💌', title: t.landing_feature_forever_title, desc: t.landing_feature_forever_desc },
  ];

  return (
    <SafeAreaView style={S.safe}>
      <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false}>

        {/* 헤더 */}
        <View style={S.header}>
          <Text style={S.logo}>{t.app_name}</Text>
          <TouchableOpacity
            style={S.btnHeader}
            onPress={() => router.push(user ? '/(tabs)' : '/(auth)/login')}
          >
            <Text style={S.btnHeaderText}>
              {user ? t.landing_to_dashboard : t.landing_start}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 히어로 섹션 */}
        <View style={S.hero}>
          <Text style={S.eyebrow}>{t.landing_hero_title}</Text>
          <Text style={S.heroTitle}>
            {t.landing_hero_sub1}{'\n'}{t.landing_hero_sub2}
          </Text>
          <Text style={S.heroDesc}>{t.landing_hero_desc}</Text>
          <TouchableOpacity
            style={S.btnHero}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.85}
          >
            <Text style={S.btnHeroText}>{t.landing_start_btn}</Text>
          </TouchableOpacity>
        </View>

        {/* 기능 소개 카드 */}
        <View style={S.features}>
          {features.map((item) => (
            <View key={item.title} style={S.featureCard}>
              <Text style={S.featureIcon}>{item.icon}</Text>
              <Text style={S.featureTitle}>{item.title}</Text>
              <Text style={S.featureDesc}>{item.desc}</Text>
            </View>
          ))}
        </View>

        {/* 푸터 */}
        <View style={S.footer}>
          <Text style={S.footerText}>{t.landing_footer}</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flexGrow: 1 },

  // ── 헤더 ──────────────────────────────────────────────────
  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingHorizontal: 24,
    paddingVertical:   16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  logo: {
    fontSize:      22,
    fontWeight:    '700',
    color:         Colors.primary,
    letterSpacing: 2,
  },
  btnHeader: {
    paddingVertical:   8,
    paddingHorizontal: 18,
    backgroundColor:   Colors.primary,
    borderRadius:      8,
  },
  btnHeaderText: {
    color:      Colors.card,
    fontSize:   13,
    fontWeight: '600',
  },

  // ── 히어로 ────────────────────────────────────────────────
  hero: {
    alignItems:   'center',
    paddingTop:   64,
    paddingBottom: 56,
    paddingHorizontal: 28,
  },
  eyebrow: {
    fontSize:      12,
    letterSpacing: 3,
    color:         Colors.accent,
    marginBottom:  14,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize:      36,
    fontWeight:    '700',
    lineHeight:    52,
    textAlign:     'center',
    marginBottom:  20,
    color:         Colors.text,
  },
  heroDesc: {
    fontSize:    15,
    lineHeight:  26,
    color:       Colors.textMid,
    textAlign:   'center',
    marginBottom: 36,
  },
  btnHero: {
    paddingVertical:   15,
    paddingHorizontal: 40,
    backgroundColor:   Colors.accent,
    borderRadius:      50,
  },
  btnHeroText: {
    color:         Colors.white,
    fontSize:      16,
    fontWeight:    '600',
    letterSpacing: 0.5,
  },

  // ── 기능 카드 ──────────────────────────────────────────────
  features: {
    paddingHorizontal: 20,
    paddingBottom:     48,
    gap:               14,
  },
  featureCard: {
    backgroundColor: Colors.card,
    borderRadius:    16,
    padding:         28,
    alignItems:      'center',
    shadowColor:     Colors.primary,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.07,
    shadowRadius:    8,
    elevation:       2,
  },
  featureIcon:  { fontSize: 36, marginBottom: 14 },
  featureTitle: {
    fontSize:      17,
    fontWeight:    '600',
    color:         Colors.text,
    marginBottom:  10,
    textAlign:     'center',
  },
  featureDesc: {
    fontSize:   14,
    lineHeight: 22,
    color:      Colors.textMid,
    textAlign:  'center',
  },

  // ── 푸터 ──────────────────────────────────────────────────
  footer: {
    alignItems:        'center',
    paddingVertical:   28,
    borderTopWidth:    1,
    borderTopColor:    Colors.border,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 12,
    color:    Colors.textMuted,
  },
});
