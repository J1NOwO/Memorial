// app/doll/create.tsx - Doll 만들기 3단계
// 웹 DollCreate.jsx → React Native 변환
// CSS Grid → FlatList / View row wrap
// useSearchParams → useLocalSearchParams
// Link to="/shop" → router.push

import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, ActivityIndicator, FlatList,
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
import {
  SKIN_TONES, HAIR_STYLES, HAIR_COLORS, EYE_TYPES, EYE_COLORS,
  OUTFIT_STYLES, OUTFIT_COLORS, BG_COLORS, ACCESSORIES,
  DEFAULT_APPEARANCE_MALE, DEFAULT_APPEARANCE_FEMALE, DEFAULT_APPEARANCE,
} from '@/constants/dollItems';
import { Colors } from '@/constants/colors';

export default function DollCreateScreen() {
  const router  = useRouter();
  const params  = useLocalSearchParams<{ reset?: string; mode?: string }>();
  const isReset          = params.reset === 'true';
  const isAppearanceOnly = params.mode === 'appearance';

  const { user, userProfile } = useAuth();
  const { isMemorial } = useMemorial();
  const t = useT();
  const { lang } = useLang();
  const lbl  = (item: any) => (lang === 'en' && item.labelEn) ? item.labelEn : item.label;
  const desc = (item: any) => (lang === 'en' && item.descEn)  ? item.descEn  : item.desc;

  const TABS = [
    { label: t.tab_skin,         key: 'skin'        },
    { label: t.tab_hair,         key: 'hair'        },
    { label: t.tab_hair_color,   key: 'hairColor'   },
    { label: t.tab_eye,          key: 'eye'         },
    { label: t.tab_eye_color,    key: 'eyeColor'    },
    { label: t.tab_outfit,       key: 'outfit'      },
    { label: t.tab_outfit_color, key: 'outfitColor' },
    { label: t.tab_bg,           key: 'bg'          },
    { label: t.tab_acc,          key: 'acc'         },
  ];

  // 추모 모드: 편집 불가
  if (isMemorial) {
    return (
      <SafeAreaView style={S.safe}>
        <View style={S.centered}>
          <Text style={{ fontSize: 52 }}>†</Text>
          <Text style={S.memTitle}>{t.doll_memorial_frozen_title}</Text>
          <Text style={S.memDesc}>{t.doll_memorial_frozen_desc}</Text>
          <TouchableOpacity style={S.backBtn} onPress={() => router.back()}>
            <Text style={S.backBtnText}>{t.back}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const userGender = userProfile?.gender || 'female';
  const defaultAp  = userGender === 'male'   ? DEFAULT_APPEARANCE_MALE
                   : userGender === 'female' ? DEFAULT_APPEARANCE_FEMALE
                   : DEFAULT_APPEARANCE;

  // 기존 Doll 체크 (reset 모드 아닐 때)
  useEffect(() => {
    if (isReset || isAppearanceOnly) return;
    apiCall('GET', '/api/doll/me').then((r) => {
      if (r?.doll) router.replace('/(tabs)/doll' as any);
    }).catch(() => {});
  }, []);

  // 구매 아이템 로드
  const [ownedItems, setOwnedItems] = useState<string[]>([]);
  useEffect(() => {
    if (!user) return;
    firestore().collection('userItems').doc(user.uid).get().then((snap) => {
      if (snap.exists) setOwnedItems(snap.data()?.ownedItems || []);
    }).catch(() => {});
  }, [user]);

  const [step, setStep]             = useState(1);
  const [dollGender, setDollGender] = useState(userGender);
  const [name, setName]             = useState('');
  const [ap, setAp]                 = useState<any>({ ...defaultAp });
  const [tab, setTab]               = useState(0);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const set = (k: string, v: any) => setAp((p: any) => ({ ...p, [k]: v }));

  function avail(item: any) {
    const g = dollGender || 'female';
    const genderOk   = !item.gender || item.gender === 'unisex' || item.gender === g || g === 'other';
    const purchaseOk = !item.locked || ownedItems.includes(item.id);
    return genderOk && purchaseOk;
  }

  function goStep(next: number) { setStep(next); setError(''); }

  function handleStep1() {
    if (!dollGender) { setError(t.validation_gender); return; }
    goStep(2);
  }
  function handleStep2() {
    if (!name.trim()) { setError(t.validation_doll_name); return; }
    goStep(3);
  }

  async function handleCreate() {
    setLoading(true); setError('');
    try {
      if (isAppearanceOnly) {
        await apiCall('PATCH', '/api/doll/me/rename', { name: name.trim(), appearance: ap });
      } else {
        await apiCall('POST', '/api/doll/create', { name: name.trim(), appearance: ap });
      }
      router.replace('/(tabs)/doll' as any);
    } catch (e: any) {
      setError(e.message || t.error_doll_save);
      setLoading(false);
    }
  }

  function renderOptions() {
    switch (TABS[tab].key) {
      case 'skin':
        return SKIN_TONES.map((item) => (
          <ColorDot key={item.id} hex={(item as any).hex} label={lbl(item)}
            active={ap.skinTone === item.id} onPress={() => set('skinTone', item.id)} />
        ));
      case 'hair':
        return HAIR_STYLES.filter(avail).map((item) => (
          <Chip key={item.id} label={lbl(item)}
            active={ap.hairStyle === item.id} onPress={() => set('hairStyle', item.id)} />
        ));
      case 'hairColor':
        return HAIR_COLORS.filter(avail).map((item) => (
          <ColorDot key={item.id} hex={item.id} label={lbl(item)}
            active={ap.hairColor === item.id} onPress={() => set('hairColor', item.id)} />
        ));
      case 'eye':
        return EYE_TYPES.filter(avail).map((item) => (
          <Chip key={item.id} label={lbl(item)}
            active={ap.eyeType === item.id} onPress={() => set('eyeType', item.id)} />
        ));
      case 'eyeColor':
        return EYE_COLORS.filter(avail).map((item) => (
          <ColorDot key={item.id} hex={item.id} label={lbl(item)}
            active={ap.eyeColor === item.id} onPress={() => set('eyeColor', item.id)} />
        ));
      case 'outfit':
        return OUTFIT_STYLES.filter(avail).map((item) => (
          <OutfitChip key={item.id} label={lbl(item)} descText={desc(item)}
            active={ap.outfitStyle === item.id} onPress={() => set('outfitStyle', item.id)} />
        ));
      case 'outfitColor':
        return OUTFIT_COLORS.filter(avail).map((item) => (
          <ColorDot key={item.id} hex={item.id} label={lbl(item)}
            active={ap.outfitColor === item.id} onPress={() => set('outfitColor', item.id)} />
        ));
      case 'bg':
        return BG_COLORS.filter(avail).map((item) => (
          <ColorDot key={item.id}
            hex={item.id === 'transparent' ? '#ffffff' : item.id}
            label={lbl(item)}
            active={ap.bgColor === item.id}
            onPress={() => set('bgColor', item.id)}
            isTransparent={item.id === 'transparent'} />
        ));
      case 'acc':
        return ACCESSORIES.filter(avail).map((item) => (
          <Chip key={item.id} label={lbl(item)}
            active={ap.accessory === item.id} onPress={() => set('accessory', item.id)} />
        ));
      default: return null;
    }
  }

  return (
    <SafeAreaView style={S.safe}>
      {/* 헤더 */}
      <View style={S.header}>
        {step > 1 ? (
          <TouchableOpacity style={S.backCircle} onPress={() => goStep(step - 1)}>
            <Text style={{ color: Colors.textMid, fontSize: 18 }}>←</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
        <Text style={S.logo}>{t.doll_create_title}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* 스텝 인디케이터 */}
      <View style={S.stepIndicator}>
        {[1, 2, 3].map((n) => (
          <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[S.stepDot, step > n ? S.stepDone : step === n ? S.stepActive : {}]}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: step >= n ? '#fff' : Colors.textMuted }}>
                {step > n ? '✓' : n}
              </Text>
            </View>
            <Text style={[S.stepLabel, step === n && { color: Colors.accent, fontWeight: '700' }]}>
              {[t.doll_step_gender, t.doll_step_name, t.doll_step_appearance][n - 1]}
            </Text>
            {n < 3 && <View style={[S.stepLine, { backgroundColor: step > n ? Colors.accent : Colors.borderLight }]} />}
          </View>
        ))}
      </View>

      {!!error && (
        <View style={S.errorBox}>
          <Text style={S.errorText}>{error}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={S.content} keyboardShouldPersistTaps="handled">

        {/* ── Step 1: 성별 선택 ── */}
        {step === 1 && (
          <View style={S.stepContent}>
            <View style={{ alignItems: 'center', paddingTop: 4 }}>
              <DollAvatar appearance={ap} size={130} animated />
            </View>
            <Text style={S.stepTitle}>{t.doll_create_gender}</Text>
            <Text style={S.stepDesc}>{t.doll_create_gender_desc}</Text>
            <View style={S.genderRow}>
              {([
                { value: 'male',   label: t.doll_create_male,   icon: '👦', d: t.doll_create_male_desc },
                { value: 'female', label: t.doll_create_female, icon: '👧', d: t.doll_create_female_desc },
              ] as const).map(({ value, label, icon, d }) => (
                <TouchableOpacity
                  key={value}
                  style={[S.genderBtn, dollGender === value && S.genderBtnOn]}
                  onPress={() => {
                    setDollGender(value);
                    const next = value === 'male' ? DEFAULT_APPEARANCE_MALE : DEFAULT_APPEARANCE_FEMALE;
                    setAp({ ...next, gender: value });
                  }}
                >
                  <Text style={{ fontSize: 32 }}>{icon}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: dollGender === value ? Colors.accent : Colors.primary }}>{label}</Text>
                  <Text style={{ fontSize: 10, color: Colors.textMuted, lineHeight: 16, textAlign: 'center' }}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={S.btnPrimary} onPress={handleStep1}>
              <Text style={S.btnPrimaryText}>{t.doll_create_next}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step 2: 이름 입력 ── */}
        {step === 2 && (
          <View style={S.stepContent}>
            <View style={{ alignItems: 'center', paddingTop: 4 }}>
              <DollAvatar appearance={ap} size={140} animated />
            </View>
            <Text style={S.stepTitle}>{t.doll_create_name_label}</Text>
            <Text style={S.stepDesc}>{t.doll_create_name_example}</Text>
            <TextInput
              style={S.nameInput}
              placeholder={t.doll_create_name_input}
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
              onSubmitEditing={handleStep2}
              maxLength={10}
              textAlign="center"
              autoFocus
            />
            <TouchableOpacity style={S.btnPrimary} onPress={handleStep2}>
              <Text style={S.btnPrimaryText}>{t.doll_create_next}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step 3: 외모 설정 ── */}
        {step === 3 && (
          <View style={S.stepContent}>
            {/* 미리보기 + 탭 선택 */}
            <View style={S.previewRow}>
              <View style={S.previewBox}>
                <DollAvatar appearance={ap} size={100} animated />
                <Text style={S.previewName}>{name}</Text>
              </View>
              <ScrollView style={{ flex: 1, maxHeight: 200 }} showsVerticalScrollIndicator={false}>
                {TABS.map((tabItem, i) => (
                  <TouchableOpacity
                    key={tabItem.key}
                    style={[S.tabChip, tab === i && S.tabChipOn]}
                    onPress={() => setTab(i)}
                  >
                    <Text style={[S.tabChipText, tab === i && S.tabChipTextOn]}>
                      {tabItem.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* 옵션 그리드 */}
            <View style={S.optionArea}>
              <View style={S.optionGrid}>
                {renderOptions()}
              </View>
            </View>

            <Text style={S.lockNote}>
              {t.doll_shop_hint_pre}
              <Text style={{ color: Colors.accent, fontWeight: '700' }} onPress={() => router.push('/(tabs)/shop' as any)}>
                {t.shop_title}
              </Text>
              {t.doll_shop_hint_post}
            </Text>

            <TouchableOpacity
              style={[S.btnPrimary, loading && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={S.btnPrimaryText}>{t.doll_creating ? `✨ ${name}` : `✨ ${name}`}</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── 서브 컴포넌트들 ────────────────────────────────────────────────────────────
function ColorDot({ hex, label, active, onPress, isTransparent }: {
  hex: string; label: string; active: boolean; onPress: () => void; isTransparent?: boolean;
}) {
  return (
    <TouchableOpacity style={{ alignItems: 'center', gap: 4 }} onPress={onPress} activeOpacity={0.7}>
      <View style={[
        S.colorDot,
        { backgroundColor: isTransparent ? '#f0f0f0' : hex },
        active && { borderWidth: 3, borderColor: Colors.primary },
        active && { shadowColor: Colors.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 3 },
      ]} />
      <Text style={S.colorDotLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[S.chip, active && S.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[S.chipText, active && S.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function OutfitChip({ label, descText, active, onPress }: {
  label: string; descText: string; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[S.outfitChip, active && S.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[S.chipText, active && S.chipTextActive]}>{label}</Text>
      <Text style={{ fontSize: 10, color: Colors.textMuted, textAlign: 'center' }}>{descText}</Text>
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  memTitle: { fontSize: 18, fontWeight: '700', color: Colors.primary, textAlign: 'center' },
  memDesc:  { fontSize: 14, color: Colors.textMuted, lineHeight: 22, textAlign: 'center' },
  backBtn:  { marginTop: 8, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  backBtnText: { fontSize: 14, color: Colors.textMid },

  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'rgba(255,253,249,0.92)', borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  backCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  logo:       { fontSize: 17, fontWeight: '600', color: Colors.primary, letterSpacing: 0.5 },

  stepIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, paddingHorizontal: 24 },
  stepDot:   { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.border },
  stepActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  stepDone:   { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepLabel:  { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
  stepLine:   { width: 28, height: 2, borderRadius: 1 },

  errorBox: { backgroundColor: '#fdf0f0', borderRadius: 10, margin: 12, padding: 10, borderLeftWidth: 3, borderLeftColor: Colors.error },
  errorText: { color: Colors.error, fontSize: 13 },

  content:     { flexGrow: 1 },
  stepContent: { flex: 1, padding: 20, gap: 14 },

  stepTitle: { fontSize: 22, fontWeight: '600', color: Colors.primary, textAlign: 'center' },
  stepDesc:  { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginTop: -6 },

  genderRow: { flexDirection: 'row', gap: 10 },
  genderBtn: {
    flex: 1, paddingVertical: 16, paddingHorizontal: 8, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bg,
    alignItems: 'center', gap: 6,
  },
  genderBtnOn: { borderColor: Colors.accent, backgroundColor: Colors.accentPale },

  nameInput: {
    backgroundColor: '#faf7f4', borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14,
    fontSize: 18, fontWeight: '600', color: Colors.text, letterSpacing: 1,
  },

  previewRow:  { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  previewBox:  { alignItems: 'center', gap: 6, backgroundColor: Colors.bg, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: Colors.border, flexShrink: 0 },
  previewName: { fontSize: 11, color: Colors.textMid, letterSpacing: 1 },

  tabChip:       { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bg, marginBottom: 4 },
  tabChipOn:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabChipText:   { fontSize: 12, color: Colors.textMid },
  tabChipTextOn: { color: '#fff', fontWeight: '700' },

  optionArea: { backgroundColor: Colors.bg, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.borderLight, maxHeight: 200 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  colorDot:      { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  colorDotLabel: { fontSize: 9, color: Colors.textMuted, textAlign: 'center' },

  chip:         { paddingVertical: 9, paddingHorizontal: 4, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.card, minWidth: 60, alignItems: 'center' },
  chipActive:   { borderColor: Colors.accent, backgroundColor: Colors.accentPale },
  chipText:     { fontSize: 12, color: Colors.textMid, textAlign: 'center' },
  chipTextActive: { color: Colors.primary, fontWeight: '700' },

  outfitChip: { paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.card, minWidth: 80, alignItems: 'center', gap: 3 },

  lockNote: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },

  btnPrimary:     { paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
