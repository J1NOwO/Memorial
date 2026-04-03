// app/(tabs)/shop.tsx - 상점
// 웹 Shop.jsx → React Native 변환
// Doll 아이템 구매, 기억 조각 사용

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useMemorial } from '@/context/MemorialContext';
import { useT } from '@/hooks/useT';
import { Colors } from '@/constants/colors';
import {
  HAIR_STYLES, HAIR_COLORS, OUTFIT_STYLES, BG_COLORS,
  DollItem,
} from '@/constants/dollItems';

// 상점에서 보여줄 잠긴 아이템만 필터링
function getShopItems(items: DollItem[], ownedIds: string[]) {
  return items.filter(i => i.locked && i.cost > 0);
}

interface ShopSection {
  key: string;
  titleKey: string;
  items: DollItem[];
}

export default function ShopScreen() {
  const { user, userProfile, buyItem } = useAuth();
  const { isMemorial } = useMemorial();
  const t = useT();

  const [ownedIds,  setOwnedIds]  = useState<string[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [confirm,   setConfirm]   = useState<DollItem | null>(null);
  const [buying,    setBuying]    = useState(false);
  const [doll,      setDoll]      = useState<any>(null);

  const gems = userProfile?.gems ?? 0;

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 보유 아이템
      const snap = await firestore().collection('userItems').doc(user.uid).get();
      setOwnedIds(snap.exists ? (snap.data()?.ownedItems ?? []) : []);
      // 내 Doll (성별 확인용)
      const dollSnap = await firestore()
        .collection('dolls')
        .where('userId', '==', user.uid)
        .limit(1)
        .get();
      if (!dollSnap.empty) setDoll(dollSnap.docs[0].data());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const gender = doll?.appearance?.gender || 'female';

  const SECTIONS: ShopSection[] = [
    {
      key: 'hair',
      titleKey: 'shop_section_hair',
      items: getShopItems(
        HAIR_STYLES.filter(i => i.gender === 'unisex' || i.gender === gender),
        ownedIds,
      ),
    },
    {
      key: 'haircolor',
      titleKey: 'shop_section_haircolor',
      items: getShopItems(
        HAIR_COLORS.filter(i => i.gender === 'unisex' || i.gender === gender),
        ownedIds,
      ),
    },
    {
      key: 'outfit',
      titleKey: 'shop_section_outfit',
      items: getShopItems(
        OUTFIT_STYLES.filter((i: DollItem) => i.gender === 'unisex' || i.gender === gender),
        ownedIds,
      ),
    },
    {
      key: 'bg',
      titleKey: 'shop_section_bg',
      items: getShopItems(BG_COLORS, ownedIds),
    },
  ].filter(s => s.items.length > 0);

  async function handleBuy(item: DollItem) {
    if (gems < item.cost) {
      Alert.alert('💎', `기억 조각이 부족해요. (보유: ${gems}개)`);
      return;
    }
    setBuying(true);
    try {
      await buyItem(item.id, item.cost);
      setOwnedIds(prev => [...prev, item.id]);
      setConfirm(null);
      Alert.alert('✅', `${item.label} 구매 완료!`);
    } catch (e: any) {
      Alert.alert(t.error_default, e.message || '');
    } finally { setBuying(false); }
  }

  const bg    = isMemorial ? Colors.memorial.bg   : Colors.bg;
  const card  = isMemorial ? Colors.memorial.card : Colors.card;
  const accent= isMemorial ? Colors.memorial.accent: Colors.accent;
  const textC = isMemorial ? Colors.memorial.text : Colors.primary;

  return (
    <SafeAreaView style={[S.safe, { backgroundColor: bg }]}>
      {/* 헤더 */}
      <View style={[S.header, isMemorial && { borderBottomColor: Colors.memorial.border }]}>
        <Text style={[S.title, { color: textC }]}>{t.shop_title}</Text>
        {/* 기억 조각 잔액 */}
        <View style={[S.gemBadge, { backgroundColor: isMemorial ? Colors.memorial.accentPale : Colors.accentPale }]}>
          <Text style={{ fontSize: 16 }}>💎</Text>
          <Text style={[S.gemCount, { color: isMemorial ? Colors.memorial.text : Colors.primary }]}>
            {gems}{t.gems_unit}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={S.centered}><ActivityIndicator color={accent} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }}>
          {/* 기억 조각 안내 */}
          <View style={[S.infoCard, { backgroundColor: card }, isMemorial && { borderColor: Colors.memorial.border }]}>
            <Text style={[S.infoTitle, { color: textC }]}>{t.shop_info_title}</Text>
            <View style={S.infoRow}><Text style={S.dot}>•</Text><Text style={[S.infoText, { color: isMemorial ? Colors.memorial.textMid : Colors.textMid }]}>{t.shop_info_q} → +10{t.gems_unit}</Text></View>
            <View style={S.infoRow}><Text style={S.dot}>•</Text><Text style={[S.infoText, { color: isMemorial ? Colors.memorial.textMid : Colors.textMid }]}>{t.shop_info_diary} → +5{t.gems_unit}</Text></View>
            <View style={S.infoRow}><Text style={S.dot}>•</Text><Text style={[S.infoText, { color: isMemorial ? Colors.memorial.textMid : Colors.textMid }]}>{t.shop_info_extra} → +2{t.gems_unit}</Text></View>
          </View>

          {/* 상점 섹션들 */}
          {SECTIONS.map(section => (
            <View key={section.key}>
              <Text style={[S.sectionTitle, { color: textC }]}>
                {(t as any)[section.titleKey] || section.titleKey}
              </Text>
              <View style={S.itemGrid}>
                {section.items.map(item => {
                  const owned = ownedIds.includes(item.id);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        S.itemCard,
                        { backgroundColor: card },
                        isMemorial && { borderColor: Colors.memorial.border },
                        owned && { borderColor: accent, borderWidth: 2 },
                      ]}
                      onPress={() => !owned && setConfirm(item)}
                      activeOpacity={owned ? 1 : 0.8}
                    >
                      <Text style={{ fontSize: 28, marginBottom: 6 }}>
                        {section.key === 'haircolor' ? '🎨' :
                         section.key === 'hair'      ? '💇' :
                         section.key === 'outfit'    ? '👗' : '🌅'}
                      </Text>
                      <Text style={[S.itemName, { color: textC }]} numberOfLines={1}>
                        {item.label}
                      </Text>
                      {owned ? (
                        <View style={[S.ownedBadge, { backgroundColor: accent }]}>
                          <Text style={S.ownedText}>{t.owned}</Text>
                        </View>
                      ) : (
                        <View style={S.priceBadge}>
                          <Text style={[S.priceText, { color: isMemorial ? Colors.memorial.textMid : Colors.textMid }]}>
                            💎 {item.cost}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          {SECTIONS.length === 0 && (
            <View style={S.centered}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🎉</Text>
              <Text style={[S.emptyText, { color: isMemorial ? Colors.memorial.textMid : Colors.textMid }]}>
                모든 아이템을 보유하고 있어요!
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* 구매 확인 모달 */}
      <Modal visible={!!confirm} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        <View style={S.overlay}>
          <View style={[S.dialog, { backgroundColor: card }]}>
            <Text style={[S.dialogTitle, { color: textC }]}>{t.shop_confirm_title}</Text>
            <Text style={{ fontSize: 28, marginVertical: 12 }}>
              {confirm?.label}
            </Text>
            <Text style={[S.dialogDesc, { color: isMemorial ? Colors.memorial.textMid : Colors.textMid }]}>
              {t.shop_confirm_desc(confirm?.cost ?? 0)}
            </Text>
            <Text style={[S.dialogBalance, { color: isMemorial ? Colors.memorial.textMuted : Colors.textMuted }]}>
              {t.shop_confirm_balance(gems, gems - (confirm?.cost ?? 0))}
            </Text>
            <View style={S.dialogBtns}>
              <TouchableOpacity
                style={[S.dialogBtn, { borderColor: Colors.border }]}
                onPress={() => setConfirm(null)}
                disabled={buying}
              >
                <Text style={{ fontSize: 14, color: Colors.textMid }}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[S.dialogBtn, { backgroundColor: accent, borderColor: accent }]}
                onPress={() => confirm && handleBuy(confirm)}
                disabled={buying}
              >
                {buying
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ fontSize: 14, color: '#fff', fontWeight: '700' }}>{t.buy}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  header:  {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  title:   { fontSize: 20, fontWeight: '700', color: Colors.primary },
  gemBadge:{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  gemCount:{ fontSize: 15, fontWeight: '700' },

  infoCard:  { borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.borderLight, gap: 4 },
  infoTitle: { fontSize: 14, fontWeight: '700', color: Colors.primary, marginBottom: 6 },
  infoRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:       { fontSize: 12, color: Colors.textMuted },
  infoText:  { fontSize: 13, color: Colors.textMid },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.primary, marginBottom: 10 },
  itemGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  itemCard: {
    width: '30%', alignItems: 'center', padding: 12,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.borderLight,
  },
  itemName:    { fontSize: 12, fontWeight: '600', color: Colors.primary, marginBottom: 6, textAlign: 'center' },
  ownedBadge:  { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 12 },
  ownedText:   { fontSize: 10, color: '#fff', fontWeight: '700' },
  priceBadge:  { paddingVertical: 3, paddingHorizontal: 10, backgroundColor: Colors.bg, borderRadius: 12 },
  priceText:   { fontSize: 11, color: Colors.textMuted },
  emptyText:   { fontSize: 15, color: Colors.textMid },

  // 모달
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  dialog:   { width: 280, borderRadius: 20, padding: 24, alignItems: 'center' },
  dialogTitle:   { fontSize: 17, fontWeight: '700', color: Colors.primary },
  dialogDesc:    { fontSize: 14, color: Colors.textMid, textAlign: 'center', marginBottom: 4 },
  dialogBalance: { fontSize: 12, color: Colors.textMuted, marginBottom: 16 },
  dialogBtns:    { flexDirection: 'row', gap: 10, width: '100%' },
  dialogBtn:     { flex: 1, paddingVertical: 11, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
});
