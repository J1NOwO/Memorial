// app/doll/wardrobe.tsx - Doll 옷장
// 보유한 아이템을 Doll에 적용하는 화면
// 상점에서 구매한 아이템만 표시 (잠긴 아이템 미리보기)

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useMemorial } from '@/context/MemorialContext';
import { useT } from '@/hooks/useT';
import { useLang } from '@/contexts/LanguageContext';
import { apiCall } from '@/utils/api';
import DollAvatar from '@/components/DollAvatar';
import {
  HAIR_STYLES, HAIR_COLORS, OUTFIT_STYLES, OUTFIT_COLORS,
  BG_COLORS, ACCESSORIES, EYE_TYPES, EYE_COLORS, SKIN_TONES,
  filterByGender, DollItem,
} from '@/constants/dollItems';
import { Colors } from '@/constants/colors';

const TABS = [
  { key: 'hair',        icon: '💇' },
  { key: 'hairColor',   icon: '🎨' },
  { key: 'outfit',      icon: '👗' },
  { key: 'outfitColor', icon: '🖌️' },
  { key: 'bg',          icon: '🌅' },
  { key: 'acc',         icon: '💍' },
];

export default function WardrobeScreen() {
  const router  = useRouter();
  const { user } = useAuth();
  const { isMemorial } = useMemorial();
  const t = useT();
  const { lang } = useLang();
  const lbl = (item: any) => (lang === 'en' && item.labelEn) ? item.labelEn : item.label;

  const [doll,       setDoll]       = useState<any>(null);
  const [dollId,     setDollId]     = useState<string | null>(null);
  const [appearance, setAppearance] = useState<any>({});
  const [ownedIds,   setOwnedIds]   = useState<string[]>([]);
  const [activeTab,  setActiveTab]  = useState('hair');
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [changed,    setChanged]    = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [dollSnap, itemsSnap] = await Promise.all([
        firestore().collection('dolls').where('userId', '==', user.uid).limit(1).get(),
        firestore().collection('userItems').doc(user.uid).get(),
      ]);
      if (dollSnap.empty) { router.back(); return; }
      const doc = dollSnap.docs[0];
      setDollId(doc.id);
      setDoll({ id: doc.id, ...doc.data() });
      setAppearance(doc.data()?.appearance || {});
      setOwnedIds(itemsSnap.exists ? (itemsSnap.data()?.ownedItems ?? []) : []);
    } catch { Alert.alert(t.error_default); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const gender = appearance.gender || 'female';

  function updateField(field: string, value: string) {
    setAppearance((prev: any) => ({ ...prev, [field]: value }));
    setChanged(true);
  }

  async function handleSave() {
    if (!dollId) return;
    setSaving(true);
    try {
      await firestore().collection('dolls').doc(dollId).update({ appearance });
      setChanged(false);
      Alert.alert('✅', '변경사항이 저장되었어요!');
    } catch { Alert.alert(t.error_doll_save); }
    finally { setSaving(false); }
  }

  // 탭별 아이템 목록 반환
  function getItems(): DollItem[] {
    switch (activeTab) {
      case 'hair':        return filterByGender(HAIR_STYLES, gender);
      case 'hairColor':   return filterByGender(HAIR_COLORS, gender);
      case 'outfit':      return filterByGender(OUTFIT_STYLES, gender);
      case 'outfitColor': return filterByGender(OUTFIT_COLORS, gender);
      case 'bg':          return BG_COLORS;
      case 'acc':         return filterByGender(ACCESSORIES, gender);
      default:            return [];
    }
  }

  // 현재 선택된 값 반환
  function getCurrentValue(): string {
    switch (activeTab) {
      case 'hair':        return appearance.hairStyle   || '';
      case 'hairColor':   return appearance.hairColor   || '';
      case 'outfit':      return appearance.outfitStyle || '';
      case 'outfitColor': return appearance.outfitColor || '';
      case 'bg':          return appearance.bgColor     || 'transparent';
      case 'acc':         return appearance.accessory   || 'none';
      default:            return '';
    }
  }

  function setCurrentValue(val: string) {
    switch (activeTab) {
      case 'hair':        updateField('hairStyle',   val); break;
      case 'hairColor':   updateField('hairColor',   val); break;
      case 'outfit':      updateField('outfitStyle', val); break;
      case 'outfitColor': updateField('outfitColor', val); break;
      case 'bg':          updateField('bgColor',     val); break;
      case 'acc':         updateField('accessory',   val); break;
    }
  }

  const isLocked = (item: DollItem) => !!item.locked && !ownedIds.includes(item.id);
  const currentVal = getCurrentValue();
  const items      = getItems();

  const accent = isMemorial ? Colors.memorial.accent : Colors.accent;
  const bg     = isMemorial ? Colors.memorial.bg     : Colors.bg;
  const card   = isMemorial ? Colors.memorial.card   : Colors.card;
  const textC  = isMemorial ? Colors.memorial.text   : Colors.primary;

  return (
    <SafeAreaView style={[S.safe, { backgroundColor: bg }]}>
      {/* 헤더 */}
      <View style={[S.header, isMemorial && { borderBottomColor: Colors.memorial.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontSize: 14, color: accent }}>{t.back}</Text>
        </TouchableOpacity>
        <Text style={[S.title, { color: textC }]}>{t.wardrobe_title}</Text>
        <TouchableOpacity onPress={handleSave} disabled={!changed || saving}>
          {saving
            ? <ActivityIndicator size="small" color={accent} />
            : <Text style={{ fontSize: 14, color: changed ? accent : Colors.textMuted, fontWeight: '700' }}>
                {t.save}
              </Text>
          }
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={S.centered}><ActivityIndicator color={accent} /></View>
      ) : (
        <>
          {/* 아바타 미리보기 */}
          <View style={[S.preview, { backgroundColor: card }]}>
            <DollAvatar appearance={appearance} size={120} animated />
          </View>

          {/* 탭 */}
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            style={S.tabBar} contentContainerStyle={S.tabContent}
          >
            {TABS.map(tab => {
              const active = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    S.tabBtn,
                    active && { backgroundColor: accent, borderColor: accent },
                    !active && isMemorial && { borderColor: Colors.memorial.border },
                  ]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Text style={{ fontSize: 14 }}>{tab.icon}</Text>
                  <Text style={[S.tabLabel, { color: active ? '#fff' : (isMemorial ? Colors.memorial.textMid : Colors.textMid) }]}>
                    {(t as any)[`tab_${tab.key.toLowerCase().replace('color', '_color')}`] || tab.key}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* 아이템 목록 */}
          <ScrollView contentContainerStyle={S.itemGrid}>
            <Text style={[S.hint, { color: isMemorial ? Colors.memorial.textMuted : Colors.textMuted }]}>
              🔒 {t.wardrobe_locked_hint}
            </Text>
            {items.map(item => {
              const locked   = isLocked(item);
              const selected = currentVal === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    S.itemCard,
                    { backgroundColor: card },
                    isMemorial && { borderColor: Colors.memorial.border },
                    selected && { borderColor: accent, borderWidth: 2 },
                    locked && { opacity: 0.45 },
                  ]}
                  onPress={() => {
                    if (locked) {
                      Alert.alert(t.wardrobe_locked_hint);
                      return;
                    }
                    setCurrentValue(item.id);
                  }}
                  activeOpacity={locked ? 1 : 0.8}
                >
                  {/* 색상 스와치 */}
                  {(activeTab === 'hairColor' || activeTab === 'outfitColor' || activeTab === 'bg') && (
                    <View style={[
                      S.swatch,
                      { backgroundColor: item.id === 'transparent' ? Colors.borderLight : item.id },
                      selected && { borderColor: accent, borderWidth: 2 },
                    ]} />
                  )}
                  <Text style={[S.itemLabel, { color: textC }]} numberOfLines={1}>
                    {lbl(item)}
                  </Text>
                  {locked && (
                    <View style={[S.lockBadge, { backgroundColor: isMemorial ? Colors.memorial.accentPale : Colors.accentPale }]}>
                      <Text style={{ fontSize: 9, color: isMemorial ? Colors.memorial.textMuted : Colors.textMuted }}>
                        💎{item.cost}
                      </Text>
                    </View>
                  )}
                  {selected && !locked && (
                    <View style={[S.checkBadge, { backgroundColor: accent }]}>
                      <Text style={{ fontSize: 9, color: '#fff' }}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}
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

  preview: { padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.borderLight },

  tabBar:    { maxHeight: 52, flexGrow: 0 },
  tabContent:{ paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  tabBtn:    {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border,
  },
  tabLabel:  { fontSize: 12 },

  hint:      { fontSize: 11, color: Colors.textMuted, marginBottom: 12, paddingHorizontal: 4 },
  itemGrid:  { padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  itemCard:  {
    width: '29%', alignItems: 'center', padding: 10,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.borderLight,
    position: 'relative',
  },
  swatch:    { width: 36, height: 36, borderRadius: 18, marginBottom: 6, borderWidth: 1, borderColor: Colors.border },
  itemLabel: { fontSize: 11, fontWeight: '600', color: Colors.primary, textAlign: 'center' },
  lockBadge: {
    position: 'absolute', top: 4, right: 4,
    paddingVertical: 2, paddingHorizontal: 4, borderRadius: 6,
  },
  checkBadge: {
    position: 'absolute', top: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
});
