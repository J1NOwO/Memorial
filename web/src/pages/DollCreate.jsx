// DollCreate.jsx - Doll 만들기 3단계 (잠긴 아이템은 상점에서 구매 후 사용)

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useMemorial } from '../context/MemorialContext';
import { useT } from '../hooks/useT';
import { useLang } from '../contexts/LanguageContext';
import { apiCall } from '../utils/api';
import DollAvatar from '../components/DollAvatar';
import {
  SKIN_TONES, HAIR_STYLES, HAIR_COLORS, EYE_TYPES, EYE_COLORS,
  OUTFIT_STYLES, OUTFIT_COLORS, BG_COLORS, ACCESSORIES,
  DEFAULT_APPEARANCE_MALE, DEFAULT_APPEARANCE_FEMALE, DEFAULT_APPEARANCE,
  filterByGender,
} from '../constants/dollItems';


export default function DollCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isReset = searchParams.get('reset') === 'true';
  const isAppearanceOnly = searchParams.get('mode') === 'appearance'; // 외형만 변경 모드
  const { user, userProfile } = useAuth();
  const { isMemorial } = useMemorial();
  const t = useT();
  const { lang } = useLang();
  const lbl = (item) => (lang === 'en' && item.labelEn) ? item.labelEn : item.label;
  const desc = (item) => (lang === 'en' && item.descEn) ? item.descEn : item.desc;

  const TABS = [
    { label: t.tab_skin,        key: 'skin'        },
    { label: t.tab_hair,        key: 'hair'        },
    { label: t.tab_hair_color,  key: 'hairColor'   },
    { label: t.tab_eye,         key: 'eye'         },
    { label: t.tab_eye_color,   key: 'eyeColor'    },
    { label: t.tab_outfit,      key: 'outfit'      },
    { label: t.tab_outfit_color,key: 'outfitColor' },
    { label: t.tab_bg,          key: 'bg'          },
    { label: t.tab_acc,         key: 'acc'         },
  ];

  if (isMemorial) return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)',
      padding: '40px 32px', textAlign: 'center', gap: 16,
    }}>
      <span style={{ fontSize: 52 }}>†</span>
      <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-serif)' }}>
        {t.doll_memorial_frozen_title}
      </p>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.8 }}>
        {t.doll_memorial_frozen_desc}
      </p>
      <button
        onClick={() => navigate(-1)}
        style={{
          marginTop: 8, padding: '12px 28px', borderRadius: 12,
          border: '1px solid var(--border)', backgroundColor: 'var(--card)',
          color: 'var(--text-mid)', fontSize: 14, cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
        }}
      >{t.back}</button>
    </div>
  );

  const userGender = userProfile?.gender || 'female';
  const defaultAp = userGender === 'male' ? DEFAULT_APPEARANCE_MALE
                  : userGender === 'female' ? DEFAULT_APPEARANCE_FEMALE
                  : DEFAULT_APPEARANCE;

  // 기존 Doll 체크 (reset/appearance 모드일 때는 스킵)
  useEffect(() => {
    if (isReset || isAppearanceOnly) return;
    apiCall('GET', '/api/doll/me').then((r) => {
      if (r?.doll) navigate('/doll', { replace: true });
    }).catch(() => {});
  }, [navigate, isReset, isAppearanceOnly]);

  // 구매한 아이템 목록 로드
  const [ownedItems, setOwnedItems] = useState([]);
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'userItems', user.uid)).then((snap) => {
      if (snap.exists()) setOwnedItems(snap.data().ownedItems || []);
    }).catch(() => {});
  }, [user]);

  const [step, setStep]           = useState(1);
  const [slideDir, setSlideDir]   = useState('right');
  const [dollGender, setDollGender] = useState(userGender); // doll 성별 (step1)
  const [name, setName]           = useState('');
  const [ap, setAp]               = useState({ ...defaultAp });
  const [tab, setTab]             = useState(0);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const set = (k, v) => setAp((p) => ({ ...p, [k]: v }));

  // 성별 + 구매 여부로 필터 (dollGender 기준)
  const avail = (item) => {
    const g = dollGender || 'female';
    const genderOk = !item.gender || item.gender === 'unisex' || item.gender === g || g === 'other';
    const purchaseOk = !item.locked || ownedItems.includes(item.id);
    return genderOk && purchaseOk;
  };

  function goStep(next) {
    setSlideDir(next > step ? 'right' : 'left');
    setStep(next);
    setError('');
  }

  // step1: 성별 선택 → step2
  function handleStep1() {
    if (!dollGender) { setError(t.validation_gender); return; }
    goStep(2);
  }

  // step2: 이름 입력 → step3
  function handleStep2() {
    if (!name.trim()) { setError(t.validation_doll_name); return; }
    goStep(3);
  }

  async function handleCreate() {
    setLoading(true); setError('');
    try {
      if (isAppearanceOnly) {
        // 외형만 변경: 기존 Doll 이름+외모 갱신 (totalChats 등 보존)
        await apiCall('PATCH', '/api/doll/me/rename', { name: name.trim(), appearance: ap });
      } else {
        await apiCall('POST', '/api/doll/create', { name: name.trim(), appearance: ap });
      }
      navigate('/doll');
    } catch (e) {
      setError(e.message || t.error_doll_save);
      setLoading(false);
    }
  }

  function renderOptions() {
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
          <OutfitItem key={item.id} item={item} labelText={lbl(item)} descText={desc(item)}
            active={ap.outfitStyle === item.id} onClick={() => set('outfitStyle', item.id)}/>
        )}</OptionGrid>;
      case 'outfitColor':
        return <OptionGrid>{OUTFIT_COLORS.filter(avail).map((item) =>
          <ColorDot key={item.id} hex={item.id} label={lbl(item)}
            active={ap.outfitColor === item.id} onClick={() => set('outfitColor', item.id)}/>
        )}</OptionGrid>;
      case 'bg':
        return <OptionGrid>{BG_COLORS.filter(avail).map((item) =>
          <ColorDot key={item.id} hex={item.id === 'transparent' ? '#ffffff' : item.id}
            label={lbl(item)}
            active={ap.bgColor === item.id}
            onClick={() => set('bgColor', item.id)}
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

  const animClass = slideDir === 'right' ? 'anim-slide-right' : 'anim-slide-left';

  return (
    <div style={S.page}>
      <div style={S.blob1}/><div style={S.blob2}/>

      <header style={S.header}>
        {step > 1 ? (
          <button onClick={() => goStep(step - 1)} style={S.backBtn} aria-label={t.aria_back}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
        ) : <div style={{ width: 36 }}/>}
        <p style={S.logo}>{t.doll_create_title}</p>
        <div style={{ width: 36 }}/>
      </header>

      <div style={S.stepIndicator}>
        {[1, 2, 3].map((n) => (
          <div key={n} style={S.stepWrapper}>
            <div style={{
              ...S.stepDot,
              ...(step > n ? S.stepDone : step === n ? S.stepActive : {}),
            }}>
              {step > n ? '✓' : n}
            </div>
            <span style={{ ...S.stepLabel, ...(step === n ? { color: 'var(--accent)', fontWeight: 700 } : {}) }}>
              {[t.doll_step_gender, t.doll_step_name, t.doll_step_appearance][n - 1]}
            </span>
            {n < 3 && (
              <div style={{ ...S.stepLine, backgroundColor: step > n ? 'var(--accent)' : 'var(--border-light)' }}/>
            )}
          </div>
        ))}
      </div>

      {error && <div style={S.errorBox}>{error}</div>}

      {/* ── Step 1: 성별 선택 ── */}
      {step === 1 && (
        <div style={S.stepContent} className={animClass} key="step1">
          <div style={S.avatarCenter}>
            <DollAvatar appearance={ap} size={130} animated />
          </div>
          <h2 style={S.stepTitle}>{t.doll_create_gender}</h2>
          <p style={S.stepDesc}>{t.doll_create_gender_desc}</p>

          <div style={S.genderRow}>
            {[
              { value: 'male',   label: t.doll_create_male,   icon: '👦', desc: t.doll_create_male_desc },
              { value: 'female', label: t.doll_create_female, icon: '👧', desc: t.doll_create_female_desc },
            ].map(({ value, label, icon, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setDollGender(value);
                  const next = value === 'male' ? DEFAULT_APPEARANCE_MALE : DEFAULT_APPEARANCE_FEMALE;
                  setAp({ ...next, gender: value });
                }}
                style={{ ...S.genderBtn, ...(dollGender === value ? S.genderBtnOn : {}) }}
              >
                <span style={{ fontSize: 32 }}>{icon}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: dollGender === value ? 'var(--accent)' : 'var(--primary)' }}>{label}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>{desc}</span>
              </button>
            ))}
          </div>

          <button className="btn-primary" onClick={handleStep1} style={{ width: '100%', marginTop: 4 }}>
            {t.doll_create_next}
          </button>
        </div>
      )}

      {/* ── Step 2: 이름 입력 ── */}
      {step === 2 && (
        <div style={S.stepContent} className={animClass} key="step2">
          <div style={S.avatarCenter}>
            <DollAvatar appearance={ap} size={140} animated />
          </div>
          <h2 style={S.stepTitle}>{t.doll_create_name_label}</h2>
          <p style={S.stepDesc}>{t.doll_create_name_example}</p>
          <input
            autoFocus
            className="input-base"
            type="text"
            placeholder={t.doll_create_name_input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleStep2()}
            maxLength={10}
            style={{ textAlign: 'center', fontSize: 18, fontWeight: 600, letterSpacing: 1 }}
          />
          <button className="btn-primary" onClick={handleStep2} style={{ width: '100%', marginTop: 4 }}>
            {t.doll_create_next}
          </button>
        </div>
      )}

      {/* ── Step 3: 외모 설정 ── */}
      {step === 3 && (
        <div style={S.stepContent} className={animClass} key="step3">
          <div style={S.previewRow}>
            <div style={S.previewBox}>
              <DollAvatar appearance={ap} size={100} animated />
              <p style={S.previewName}>{name}</p>
            </div>
            <div style={S.tabScroll}>
              {TABS.map((t, i) => (
                <button key={t.key} onClick={() => setTab(i)}
                  style={{ ...S.tabChip, ...(tab === i ? S.tabChipOn : {}) }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={S.optionArea}>{renderOptions()}</div>

          <p style={S.lockNote}>
            {t.doll_shop_hint_pre}
            <Link to="/shop" style={{ color: 'var(--accent)', fontWeight: 700 }}>{t.shop_title}</Link>
            {t.doll_shop_hint_post}
          </p>

          <button
            className="btn-primary"
            style={{ width: '100%', opacity: loading ? 0.6 : 1 }}
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? t.doll_creating : `✨ ${name}`}
          </button>
        </div>
      )}
    </div>
  );
}

function OptionGrid({ children, cols = 4 }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>{children}</div>;
}

function ColorDot({ hex, label, active, onClick, isTransparent }) {
  return (
    <div onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        cursor: 'pointer', transition: 'transform 0.15s' }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        backgroundColor: isTransparent ? 'white' : hex,
        backgroundImage: isTransparent ? 'linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)' : 'none',
        backgroundSize: isTransparent ? '8px 8px' : 'auto',
        backgroundPosition: isTransparent ? '0 0,0 4px,4px -4px,-4px 0px' : 'auto',
        border: active ? '3px solid var(--primary)' : '2.5px solid transparent',
        boxShadow: active ? '0 0 0 2px var(--accent)' : '0 1px 4px rgba(0,0,0,0.12)',
        transition: 'all 0.15s',
        transform: active ? 'scale(1.1)' : 'scale(1)',
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
        padding: '9px 4px', borderRadius: 10, fontSize: 12,
        fontWeight: active ? 700 : 400, lineHeight: 1.3,
        border: active ? '2px solid var(--accent)' : '1.5px solid var(--border)',
        backgroundColor: active ? 'var(--accent-pale)' : 'var(--card)',
        color: active ? 'var(--primary)' : 'var(--text-mid)',
        cursor: 'pointer',
        transition: 'all 0.15s', fontFamily: 'var(--font-sans)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        transform: active ? 'scale(1.03)' : 'scale(1)',
      }}>
      {label}
    </button>
  );
}

function OutfitItem({ item, labelText, descText, active, onClick }) {
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
        transform: active ? 'scale(1.03)' : 'scale(1)',
      }}>
      <span style={{ fontSize: 13, fontWeight: active ? 700 : 500 }}>{labelText}</span>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>{descText}</span>
    </button>
  );
}

const S = {
  page: {
    minHeight: '100dvh', backgroundColor: 'var(--bg)',
    fontFamily: 'var(--font-sans)', position: 'relative',
    display: 'flex', flexDirection: 'column',
    padding: '0 0 40px',
  },
  blob1: {
    position: 'fixed', top: -80, right: -60, width: 240, height: 240,
    borderRadius: '50%', background: 'radial-gradient(circle, rgba(196,149,106,0.18) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0,
  },
  blob2: {
    position: 'fixed', bottom: -80, left: -80, width: 280, height: 280,
    borderRadius: '50%', background: 'radial-gradient(circle, rgba(92,74,58,0.08) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0,
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: 'rgba(255,253,249,0.92)',
    backdropFilter: 'blur(16px)',
    borderBottom: '1px solid var(--border-light)',
    position: 'sticky', top: 0, zIndex: 10,
    flexShrink: 0,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: '50%',
    background: 'var(--bg)', border: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text-mid)', cursor: 'pointer',
  },
  logo: {
    fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--primary)',
    fontWeight: 600, letterSpacing: 0.5,
  },
  stepIndicator: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px 24px 8px',
    position: 'relative', zIndex: 1,
  },
  stepWrapper: { display: 'flex', alignItems: 'center', gap: 6, position: 'relative' },
  stepDot: {
    width: 30, height: 30, borderRadius: '50%',
    backgroundColor: 'var(--border)', color: 'var(--text-muted)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, flexShrink: 0,
    border: '2px solid var(--border)', transition: 'all 0.3s',
  },
  stepActive: {
    backgroundColor: 'var(--accent)', color: 'white', borderColor: 'var(--accent)',
    boxShadow: '0 0 0 4px rgba(196,149,106,0.2)',
  },
  stepDone: { backgroundColor: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' },
  stepLabel: { fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, transition: 'all 0.2s' },
  stepLine: { width: 28, height: 2, borderRadius: 1, transition: 'background 0.3s', marginLeft: 2 },
  errorBox: {
    backgroundColor: '#fdf0f0', color: '#c0392b', fontSize: 13,
    padding: '10px 14px', borderRadius: 10, margin: '0 20px',
    borderLeft: '3px solid #e74c3c', zIndex: 1, position: 'relative',
  },
  stepContent: {
    display: 'flex', flexDirection: 'column', gap: 14,
    padding: '20px 20px 8px',
    position: 'relative', zIndex: 1, flex: 1,
  },
  avatarCenter: { display: 'flex', justifyContent: 'center', paddingTop: 4 },
  stepTitle: {
    fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--primary)',
    textAlign: 'center', fontWeight: 600,
  },
  stepDesc: { fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: -6 },
  previewRow: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  previewBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0,
    background: 'var(--bg)', borderRadius: 16, padding: '12px 10px',
    border: '1px solid var(--border)',
  },
  previewName: { fontSize: 11, color: 'var(--text-mid)', fontFamily: 'var(--font-serif)', letterSpacing: 1 },
  tabScroll: {
    display: 'flex', flexDirection: 'column', gap: 4, flex: 1,
    maxHeight: 200, overflowY: 'auto',
  },
  tabChip: {
    padding: '8px 10px', borderRadius: 8, textAlign: 'left',
    border: '1px solid var(--border)', backgroundColor: 'var(--bg)',
    color: 'var(--text-mid)', fontSize: 12, cursor: 'pointer',
    transition: 'all 0.15s', fontFamily: 'var(--font-sans)', flexShrink: 0,
  },
  tabChipOn: {
    backgroundColor: 'var(--primary)', color: 'white', borderColor: 'var(--primary)', fontWeight: 700,
  },
  optionArea: {
    backgroundColor: 'var(--bg)', borderRadius: 14, padding: '14px 12px',
    border: '1px solid var(--border-light)', maxHeight: 180, overflowY: 'auto',
  },
  genderRow: { display: 'flex', gap: 10 },
  genderBtn: {
    flex: 1, padding: '16px 8px', borderRadius: 14,
    border: '1.5px solid var(--border)', backgroundColor: 'var(--bg)',
    cursor: 'pointer', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)',
    transition: 'all 0.15s',
  },
  genderBtnOn: {
    borderColor: 'var(--accent)', backgroundColor: 'var(--accent-pale)',
    boxShadow: '0 0 0 3px rgba(196,149,106,0.15)',
  },
  lockNote: { fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 },
};
