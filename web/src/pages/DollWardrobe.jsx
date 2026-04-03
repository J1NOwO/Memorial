// DollWardrobe.jsx - Doll 외모 커스터마이징 (옷장)

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useT } from '../hooks/useT';
import { useLang } from '../contexts/LanguageContext';
import { apiCall } from '../utils/api';
import DollAvatar from '../components/DollAvatar';
import {
  SKIN_TONES, HAIR_STYLES, HAIR_COLORS, EYE_TYPES, EYE_COLORS,
  OUTFIT_STYLES, OUTFIT_COLORS, BG_COLORS, ACCESSORIES,
} from '../constants/dollItems';

export default function DollWardrobe() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const t = useT();
  const { lang } = useLang();
  const lbl = (item) => (lang === 'en' && item.labelEn) ? item.labelEn : item.label;
  const desc = (item) => (lang === 'en' && item.descEn) ? item.descEn : item.desc;

  const TABS = [
    { label: t.tab_skin,         key: 'skin'       },
    { label: t.tab_hair,         key: 'hair'       },
    { label: t.tab_hair_color,   key: 'hairColor'  },
    { label: t.tab_eye,          key: 'eye'        },
    { label: t.tab_eye_color,    key: 'eyeColor'   },
    { label: t.tab_outfit,       key: 'outfit'     },
    { label: t.tab_outfit_color, key: 'outfitColor'},
    { label: t.tab_bg,           key: 'bg'         },
    { label: t.tab_acc,          key: 'acc'        },
  ];
  const userGender = userProfile?.gender || 'female';

  const [doll, setDoll]           = useState(null);
  const [ap, setAp]               = useState(null);
  const [ownedItems, setOwnedItems] = useState([]);
  const [tab, setTab]             = useState(0);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const r = await apiCall('GET', '/api/doll/me');
        if (!r?.doll) { navigate('/doll/create'); return; }
        setDoll(r.doll);
        setAp({ ...(r.doll.appearance || {}) });
      } catch {
        setError(t.error_doll_load);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'userItems', user.uid)).then((snap) => {
      if (snap.exists()) setOwnedItems(snap.data().ownedItems || []);
    }).catch(() => {});
  }, [user]);

  const set = (k, v) => { setAp((p) => ({ ...p, [k]: v })); setSaved(false); };
  const avail = (item) => {
    const genderOk = !item.gender || item.gender === 'unisex' || item.gender === userGender || userGender === 'other';
    const purchaseOk = !item.locked || ownedItems.includes(item.id);
    return genderOk && purchaseOk;
  };

  async function handleSave() {
    setSaving(true); setError('');
    try {
      await apiCall('PATCH', '/api/doll/appearance', { appearance: ap });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e.message || t.error_doll_save);
    } finally {
      setSaving(false);
    }
  }

  function renderOptions() {
    if (!ap) return null;
    switch (TABS[tab].key) {
      case 'skin':
        return <OptionGrid>{SKIN_TONES.map((item) =>
          <ColorDot key={item.id} hex={item.hex} label={lbl(item)}
            active={ap.skinTone === item.id} onClick={() => set('skinTone', item.id)}/>
        )}</OptionGrid>;
      case 'hair':
        return <OptionGrid cols={3}>{HAIR_STYLES.filter(avail).map((item) =>
          <Chip key={item.id} label={lbl(item)}
            active={ap.hairStyle === item.id} onClick={() => set('hairStyle', item.id)}/>
        )}</OptionGrid>;
      case 'hairColor':
        return <OptionGrid>{HAIR_COLORS.filter(avail).map((item) =>
          <ColorDot key={item.id} hex={item.id} label={lbl(item)}
            active={ap.hairColor === item.id} onClick={() => set('hairColor', item.id)}/>
        )}</OptionGrid>;
      case 'eye':
        return <OptionGrid cols={2}>{EYE_TYPES.filter(avail).map((item) =>
          <Chip key={item.id} label={lbl(item)}
            active={ap.eyeType === item.id} onClick={() => set('eyeType', item.id)}/>
        )}</OptionGrid>;
      case 'eyeColor':
        return <OptionGrid>{EYE_COLORS.filter(avail).map((item) =>
          <ColorDot key={item.id} hex={item.id} label={lbl(item)}
            active={ap.eyeColor === item.id} onClick={() => set('eyeColor', item.id)}/>
        )}</OptionGrid>;
      case 'outfit':
        return <OptionGrid cols={2}>{OUTFIT_STYLES.filter(avail).map((item) =>
          <OutfitItem key={item.id} labelText={lbl(item)} descText={desc(item)}
            active={ap.outfitStyle === item.id} onClick={() => set('outfitStyle', item.id)}/>
        )}</OptionGrid>;
      case 'outfitColor':
        return <OptionGrid>{OUTFIT_COLORS.filter(avail).map((item) =>
          <ColorDot key={item.id} hex={item.id} label={lbl(item)}
            active={ap.outfitColor === item.id} onClick={() => set('outfitColor', item.id)}/>
        )}</OptionGrid>;
      case 'bg':
        return <OptionGrid>{BG_COLORS.filter(avail).map((item) =>
          <ColorDot key={item.id} hex={item.id === 'transparent' ? '#ffffff' : item.id} label={lbl(item)}
            active={ap.bgColor === item.id} onClick={() => set('bgColor', item.id)}
            isTransparent={item.id === 'transparent'}/>
        )}</OptionGrid>;
      case 'acc':
        return <OptionGrid cols={3}>{ACCESSORIES.filter(avail).map((item) =>
          <Chip key={item.id} label={lbl(item)}
            active={ap.accessory === item.id} onClick={() => set('accessory', item.id)}/>
        )}</OptionGrid>;
      default: return null;
    }
  }

  if (loading) return (
    <div style={S.center}>
      <div style={S.loadingRing}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={S.page}>
      {/* 헤더 */}
      <header style={S.header}>
        <button onClick={() => navigate('/doll')} style={S.backBtn} aria-label={t.back}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <p style={S.headerTitle}>{t.wardrobe_title}</p>
        <div style={{ width: 36 }}/>
      </header>

      {/* 아바타 프리뷰 영역 */}
      <div style={S.previewArea}>
        {/* 배경 그라데이션 */}
        <div style={S.previewBg}/>

        {ap && <DollAvatar appearance={ap} size={160} animated />}

        {doll && (
          <p style={S.dollName}>{doll.name}</p>
        )}
      </div>

      {/* 바텀 패널 */}
      <div style={S.panel}>
        {/* 카테고리 탭 */}
        <div style={S.tabRow}>
          {TABS.map((t, i) => (
            <button key={t.key} onClick={() => setTab(i)}
              style={{ ...S.tabBtn, ...(tab === i ? S.tabBtnOn : {}) }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* 아이템 그리드 */}
        <div style={S.optionArea}>
          {renderOptions()}
        </div>

        {/* 상점 링크 */}
        <p style={S.shopNote}>{t.wardrobe_locked_hint}</p>

        {/* 에러 */}
        {error && <p style={S.errorText}>{error}</p>}

        {/* 저장 버튼 */}
        <button
          onClick={handleSave}
          disabled={saving || saved}
          style={{
            ...S.saveBtn,
            ...(saved ? S.saveBtnDone : {}),
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? t.saving : saved ? t.saved : t.save}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function OptionGrid({ children, cols = 4 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>
      {children}
    </div>
  );
}

function ColorDot({ hex, label, active, onClick, isTransparent }) {
  return (
    <div onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        backgroundColor: isTransparent ? 'white' : hex,
        backgroundImage: isTransparent
          ? 'linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)'
          : 'none',
        backgroundSize: isTransparent ? '8px 8px' : 'auto',
        backgroundPosition: isTransparent ? '0 0,0 4px,4px -4px,-4px 0px' : 'auto',
        border: active ? '3px solid var(--primary)' : '2.5px solid transparent',
        boxShadow: active ? '0 0 0 2px var(--accent)' : '0 1px 4px rgba(0,0,0,0.12)',
        transition: 'all 0.15s',
        transform: active ? 'scale(1.12)' : 'scale(1)',
      }}/>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.2 }}>
        {label}
      </span>
    </div>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        padding: '10px 4px', borderRadius: 10, fontSize: 12,
        fontWeight: active ? 700 : 400, lineHeight: 1.3,
        border: active ? '2px solid var(--accent)' : '1.5px solid var(--border)',
        backgroundColor: active ? 'var(--accent-pale)' : 'var(--card)',
        color: active ? 'var(--primary)' : 'var(--text-mid)',
        cursor: 'pointer',
        transition: 'all 0.15s', fontFamily: 'var(--font-sans)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        transform: active ? 'scale(1.04)' : 'scale(1)',
      }}>
      {label}
    </button>
  );
}

function OutfitItem({ labelText, descText, active, onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{
        padding: '10px 8px', borderRadius: 12,
        border: active ? '2px solid var(--accent)' : '1.5px solid var(--border)',
        backgroundColor: active ? 'var(--accent-pale)' : 'var(--card)',
        color: active ? 'var(--primary)' : 'var(--text-mid)',
        cursor: 'pointer',
        transition: 'all 0.15s', fontFamily: 'var(--font-sans)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        transform: active ? 'scale(1.04)' : 'scale(1)',
      }}>
      <span style={{ fontSize: 13, fontWeight: active ? 700 : 500 }}>{labelText}</span>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>{descText}</span>
    </button>
  );
}

const S = {
  page: {
    minHeight: '100dvh', backgroundColor: 'var(--bg)',
    fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  },
  center: {
    minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  loadingRing: {
    width: 40, height: 40, borderRadius: '50%',
    border: '3px solid var(--border)', borderTopColor: 'var(--accent)',
    animation: 'spin 0.8s linear infinite',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: 'rgba(255,253,249,0.92)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid var(--border-light)',
    flexShrink: 0, zIndex: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: '50%',
    background: 'var(--bg)', border: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text-mid)', cursor: 'pointer',
  },
  headerTitle: {
    fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--primary)',
    fontWeight: 600, letterSpacing: 0.5,
  },
  previewArea: {
    flex: 1,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative', gap: 10,
    minHeight: 0,
    paddingTop: 12, paddingBottom: 12,
  },
  previewBg: {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    background: 'radial-gradient(ellipse at 50% 40%, rgba(196,149,106,0.18) 0%, transparent 65%)',
  },
  dollName: {
    fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--primary)',
    fontWeight: 700, letterSpacing: 1, position: 'relative',
  },
  panel: {
    backgroundColor: 'var(--card)',
    borderTop: '1px solid var(--border-light)',
    borderRadius: '24px 24px 0 0',
    boxShadow: '0 -8px 32px rgba(92,74,58,0.08)',
    padding: '16px 16px 32px',
    display: 'flex', flexDirection: 'column', gap: 12,
    flexShrink: 0,
    maxHeight: '55vh', overflowY: 'auto',
  },
  tabRow: {
    display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4,
    msOverflowStyle: 'none', scrollbarWidth: 'none',
    flexShrink: 0,
  },
  tabBtn: {
    flexShrink: 0, padding: '7px 14px', borderRadius: 20,
    border: '1.5px solid var(--border)', backgroundColor: 'var(--bg)',
    color: 'var(--text-mid)', fontSize: 12, cursor: 'pointer',
    fontFamily: 'var(--font-sans)', transition: 'all 0.15s', fontWeight: 500,
  },
  tabBtnOn: {
    backgroundColor: 'var(--primary)', color: 'white',
    borderColor: 'var(--primary)', fontWeight: 700,
  },
  optionArea: {
    backgroundColor: 'var(--bg)', borderRadius: 14, padding: '12px 10px',
    border: '1px solid var(--border-light)',
  },
  shopNote: {
    fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6,
  },
  errorText: { fontSize: 13, color: '#c0392b', textAlign: 'center' },
  saveBtn: {
    width: '100%', padding: '14px',
    background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-deep) 100%)',
    color: 'white', border: 'none', borderRadius: 14,
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    boxShadow: '0 4px 16px rgba(92,74,58,0.25)',
    transition: 'all 0.2s',
  },
  saveBtnDone: {
    background: 'linear-gradient(135deg, #5a9a6a 0%, #3a7a4a 100%)',
    boxShadow: '0 4px 16px rgba(90,154,106,0.3)',
  },
};
