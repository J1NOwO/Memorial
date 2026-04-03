// Shop.jsx - 기억 조각 상점 (Doll 아이템 구매)

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useT } from '../hooks/useT';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';

// ── 상점 아이템 정의 (t를 받아 번역된 라벨 반환) ──────────────────────────────
function getShopSections(t) {
  return [
    {
      title: t.shop_section_hair,
      icon: '💇',
      items: [
        { id: 'bun',      type: 'hairStyle', label: t.shop_item_bun,      price: 30, emoji: '🔮' },
        { id: 'ponytail', type: 'hairStyle', label: t.shop_item_ponytail, price: 30, emoji: '🎀' },
        { id: 'twin',     type: 'hairStyle', label: t.shop_item_twin,     price: 30, emoji: '✨' },
      ],
    },
    {
      title: t.shop_section_haircolor,
      icon: '🎨',
      items: [
        { id: '#8a8a8a', type: 'hairColor', label: t.shop_item_gray,   price: 20, hex: '#8a8a8a' },
        { id: '#e8e0d0', type: 'hairColor', label: t.shop_item_white,  price: 20, hex: '#e8e0d0' },
        { id: '#e8c84a', type: 'hairColor', label: t.shop_item_blonde, price: 20, hex: '#e8c84a' },
        { id: '#d47090', type: 'hairColor', label: t.shop_item_pink,   price: 20, hex: '#d47090' },
        { id: '#7060b0', type: 'hairColor', label: t.shop_item_purple, price: 20, hex: '#7060b0' },
      ],
    },
    {
      title: t.shop_section_outfit,
      icon: '👗',
      items: [
        { id: 'dress',   type: 'outfitStyle', label: t.shop_item_dress,   price: 50, emoji: '👗' },
        { id: 'uniform', type: 'outfitStyle', label: t.shop_item_uniform, price: 50, emoji: '🎽' },
        { id: 'hanbok',  type: 'outfitStyle', label: t.shop_item_hanbok,  price: 50, emoji: '🎎' },
      ],
    },
    {
      title: t.shop_section_bg,
      icon: '🌅',
      items: [
        { id: '#dde8f0', type: 'bgColor', label: t.shop_item_sky,   price: 40, hex: '#dde8f0' },
        { id: '#f0dde8', type: 'bgColor', label: t.shop_item_pink,  price: 40, hex: '#f0dde8' },
        { id: '#d8f0d8', type: 'bgColor', label: t.shop_item_green, price: 40, hex: '#d8f0d8' },
      ],
    },
  ];
}

export default function Shop() {
  const { user, userProfile, buyItem } = useAuth();
  const t = useT();

  const SHOP_SECTIONS = getShopSections(t);

  const [ownedItems, setOwnedItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [buying, setBuying] = useState(null); // 구매 중인 itemId
  const [confirmItem, setConfirmItem] = useState(null); // 구매 확인 팝업용 아이템

  const gems = userProfile?.gems || 0;

  // 구매한 아이템 목록 로드
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'userItems', user.uid))
      .then((snap) => {
        if (snap.exists()) setOwnedItems(snap.data().ownedItems || []);
      })
      .catch(() => {})
      .finally(() => setLoadingItems(false));
  }, [user]);

  // 구매 확인 → 실제 구매 실행
  async function handleBuyConfirm() {
    if (!confirmItem) return;
    setBuying(confirmItem.id);
    try {
      await buyItem(confirmItem.id, confirmItem.price);
      setOwnedItems((prev) => [...prev, confirmItem.id]);
    } catch (e) {
      alert(e.message || t.error_default);
    } finally {
      setBuying(null);
      setConfirmItem(null);
    }
  }

  return (
    <div style={S.page}>
      <TopBar title={t.shop_title} />

      {/* 보유 기억 조각 */}
      <div style={S.gemsBar}>
        <span style={S.gemsLabel}>{t.gems}</span>
        <div style={S.gemsBadge}>
          <span style={{ fontSize: 18 }}>💎</span>
          <span style={S.gemsCount}>{gems}</span>
          {t.gems_unit && <span style={S.gemsUnit}>{t.gems_unit}</span>}
        </div>
      </div>

      <main style={S.main} className="pb-nav">
        {SHOP_SECTIONS.map((section) => (
          <div key={section.title} style={S.section}>
            <p style={S.sectionTitle}>{section.icon} {section.title}</p>
            <div style={S.itemGrid}>
              {section.items.map((item) => {
                const owned = ownedItems.includes(item.id);
                const canAfford = gems >= item.price;
                return (
                  <div key={item.id} style={{ ...S.itemCard, ...(owned ? S.itemCardOwned : {}) }}>
                    {/* 미리보기 */}
                    <div style={S.itemPreview}>
                      {item.hex ? (
                        <div style={{
                          width: 44, height: 44, borderRadius: '50%',
                          backgroundColor: item.hex,
                          border: '2px solid var(--border)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                        }}/>
                      ) : (
                        <span style={{ fontSize: 32 }}>{item.emoji}</span>
                      )}
                    </div>
                    {/* 아이템 이름 */}
                    <p style={S.itemLabel}>{item.label}</p>
                    {/* 상태 / 구매 버튼 */}
                    {owned ? (
                      <div style={S.ownedBadge}>✓ {t.owned}</div>
                    ) : (
                      <button
                        style={{ ...S.buyBtn, ...(!canAfford ? S.buyBtnDisabled : {}) }}
                        onClick={() => setConfirmItem(item)}
                        disabled={!canAfford || buying === item.id}
                      >
                        {buying === item.id ? '...' : (
                          <><span style={{ fontSize: 13 }}>💎</span> {item.price}</>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* 기억 조각 획득 안내 */}
        <div style={S.infoBox}>
          <p style={S.infoTitle}>{t.shop_info_title}</p>
          <div style={S.infoList}>
            <p style={S.infoRow}><span style={S.infoReward}>+10</span> {t.shop_info_q}</p>
            <p style={S.infoRow}><span style={S.infoReward}>+5</span> {t.shop_info_diary}</p>
            <p style={S.infoRow}><span style={S.infoReward}>+3</span> {t.shop_info_extra}</p>
          </div>
        </div>
      </main>

      {/* 구매 확인 팝업 */}
      {confirmItem && (
        <div style={S.overlay}>
          <div style={S.confirmCard} className="anim-scale">
            <p style={S.confirmTitle}>{t.shop_confirm_title}</p>
            <div style={S.confirmPreview}>
              {confirmItem.hex ? (
                <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: confirmItem.hex, border: '2px solid var(--border)' }}/>
              ) : (
                <span style={{ fontSize: 44 }}>{confirmItem.emoji}</span>
              )}
              <p style={S.confirmItemName}>{confirmItem.label}</p>
            </div>
            <p style={S.confirmDesc}>
              {t.shop_confirm_desc(confirmItem.price)}
            </p>
            <p style={S.confirmBalance}>
              {t.shop_confirm_balance(gems, gems - confirmItem.price)}
            </p>
            <div style={S.confirmBtns}>
              <button style={S.btnCancel} onClick={() => setConfirmItem(null)}>{t.cancel}</button>
              <button style={S.btnConfirm} onClick={handleBuyConfirm} disabled={!!buying}>
                {buying ? t.loading : t.buy}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

const S = {
  page: { minHeight: '100dvh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)' },
  gemsBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px',
    backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border-light)',
  },
  gemsLabel: { fontSize: 13, color: 'var(--text-mid)', fontWeight: 600 },
  gemsBadge: {
    display: 'flex', alignItems: 'center', gap: 6,
    backgroundColor: 'var(--accent-pale)', border: '1.5px solid var(--accent-light)',
    borderRadius: 20, padding: '6px 14px',
  },
  gemsCount: { fontSize: 18, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 },
  gemsUnit:  { fontSize: 12, color: 'var(--text-muted)', marginTop: 2 },
  main: { padding: '16px 16px' },
  section: {
    backgroundColor: 'var(--card)', borderRadius: 20,
    padding: '16px', marginBottom: 14,
    boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)',
  },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: 'var(--primary-deep)', marginBottom: 12 },
  itemGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 },
  itemCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    padding: '12px 6px',
    backgroundColor: 'var(--bg)', borderRadius: 14,
    border: '1.5px solid var(--border-light)',
    transition: 'all 0.15s',
  },
  itemCardOwned: { backgroundColor: 'var(--accent-pale)', borderColor: 'var(--accent-light)' },
  itemPreview: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 50 },
  itemLabel: { fontSize: 12, fontWeight: 600, color: 'var(--primary-deep)', textAlign: 'center' },
  ownedBadge: {
    fontSize: 11, fontWeight: 700, color: 'var(--accent)',
    backgroundColor: 'var(--accent-pale)', borderRadius: 8, padding: '4px 8px',
  },
  buyBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
    padding: '6px 10px', borderRadius: 8,
    backgroundColor: 'var(--accent)', color: 'white',
    border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)',
    transition: 'all 0.15s',
  },
  buyBtnDisabled: { backgroundColor: 'var(--border)', color: 'var(--text-muted)', cursor: 'not-allowed' },
  infoBox: {
    backgroundColor: 'var(--accent-pale)', border: '1px solid var(--accent-light)',
    borderRadius: 16, padding: '16px 18px', marginBottom: 14,
  },
  infoTitle: { fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 },
  infoList:  { display: 'flex', flexDirection: 'column', gap: 6 },
  infoRow:   { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-mid)' },
  infoReward: { fontSize: 13, fontWeight: 800, color: 'var(--accent)', minWidth: 28 },
  // 구매 확인 팝업
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(61,46,34,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(4px)' },
  confirmCard: {
    backgroundColor: 'var(--card)', borderRadius: 24, padding: '28px 24px',
    width: 'calc(100% - 48px)', maxWidth: 320, textAlign: 'center',
    boxShadow: '0 20px 60px rgba(61,46,34,0.25)',
  },
  confirmTitle: { fontSize: 16, fontWeight: 700, color: 'var(--primary-deep)', marginBottom: 16 },
  confirmPreview: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 16 },
  confirmItemName: { fontSize: 15, fontWeight: 600, color: 'var(--primary)' },
  confirmDesc: { fontSize: 15, color: 'var(--primary-deep)', fontWeight: 600, marginBottom: 6 },
  confirmBalance: { fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 },
  confirmBtns: { display: 'flex', gap: 10 },
  btnCancel: {
    flex: 1, padding: '12px', borderRadius: 12,
    border: '1.5px solid var(--border)', backgroundColor: 'transparent',
    color: 'var(--text-mid)', fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-sans)',
  },
  btnConfirm: {
    flex: 1, padding: '12px', borderRadius: 12,
    backgroundColor: 'var(--accent)', color: 'white',
    border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)',
  },
};
