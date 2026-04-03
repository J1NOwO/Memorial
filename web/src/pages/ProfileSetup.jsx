// ProfileSetup.jsx - 처음 로그인 시 프로필 설정 페이지
//
// 표시 조건: userProfile.birthDate가 없을 때 (PrivateRoute가 자동으로 여기로 보내줌)
//
// 입력 항목:
//   - 이름 (구글 이름 수정 가능, 이메일 가입도 여기서 확인)
//   - 생년월일
//   - 역할 선택 (role이 아직 null인 경우, 주로 구글 신규 유저)
//   - 유족이면 초대 코드 + 관계 (연결 요청까지 한 번에 처리)

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useT } from '../hooks/useT';
import { apiCall } from '../utils/api';

function ProfileSetup() {
  const { user, userProfile, completeProfile } = useAuth();
  const navigate = useNavigate();
  const t = useT();

  // 관계 선택 옵션 (그룹별 분리, t.relations 순서 기준)
  const RELATION_GROUPS = [
    { label: t.relation_group_family, options: t.relations.slice(0, 4) },
    { label: t.relation_group_friend, options: t.relations.slice(4) },
  ];

  // 이름: 성 + 이름 분리 (기존 이름이 있으면 그대로 표시)
  const existingName = userProfile?.name || user?.displayName || '';
  const [lastName, setLastName]   = useState('');
  const [firstName, setFirstName] = useState(existingName); // 기존 이름을 이름 칸에 pre-fill

  // 생년월일 (년/월/일 분리)
  const [birthYear, setBirthYear]   = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay]     = useState('');

  // role이 null이면 선택 UI 표시 (주로 구글 신규 유저)
  const needsRoleSelect = !userProfile?.role;
  const [role, setRole]           = useState(needsRoleSelect ? 'provider' : userProfile?.role);

  // 성별
  const [gender, setGender] = useState(userProfile?.gender || '');

  // 유족 전용
  const [inviteCode, setInviteCode] = useState('');
  const [relation, setRelation]     = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // ── 오늘 날짜 (생년월일 최대값) ────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];

  // ── 제출 ───────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // 유효성 검사
    const fullName = (lastName + firstName).trim();
    if (!fullName) { setError(t.validation_name); return; }
    if (!birthYear || !birthMonth || !birthDay) {
      setError(t.validation_birthdate); return;
    }
    if (!gender) { setError(t.validation_gender); return; }
    const birthDate = `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;
    if (role === 'family') {
      if (!inviteCode.trim()) { setError(t.validation_invite_code); return; }
      if (!relation)          { setError(t.validation_relation); return; }
    }

    setLoading(true);
    try {
      // 1. Firestore에 프로필 저장 (이름, 생년월일, 역할, inviteCode)
      await completeProfile({ name: fullName, birthDate, role, gender });

      // 2. 유족이면 초대 코드로 연결 요청
      if (role === 'family') {
        try {
          await apiCall('POST', '/api/connections/join', {
            inviteCode: inviteCode.trim().toUpperCase(),
            relation,
          });
        } catch (apiErr) {
          // 연결 실패는 대시보드에서 재시도 가능
          navigate('/dashboard', {
            state: { pendingInvite: inviteCode.trim().toUpperCase(), relation },
          });
          return;
        }
      }

      navigate('/dashboard');
    } catch (err) {
      console.error('프로필 설정 실패:', err);
      setError(t.error_save);
    } finally {
      setLoading(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.logo}>{t.app_name}</h1>
        <p style={styles.logoSub}>{t.profile_welcome}</p>

        <h2 style={styles.title}>{t.profile_setup_title}</h2>
        <p style={styles.desc}>{t.profile_setup_desc}</p>

        {error && <p style={styles.errorMsg}>{error}</p>}

        <form onSubmit={handleSubmit} style={styles.form}>

          {/* ── 역할 선택 (role이 아직 null인 신규 구글 유저) ── */}
          {needsRoleSelect && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>{t.signup_type}</label>
              <div style={styles.roleRow}>
                <button
                  type="button"
                  onClick={() => setRole('provider')}
                  style={{ ...styles.roleBtn, ...(role === 'provider' ? styles.roleBtnActive : {}) }}
                >
                  <span style={styles.roleIcon}>✍️</span>
                  <span style={styles.roleName}>{t.profile_role_provider_name}</span>
                  <span style={styles.roleDesc}>{t.profile_role_provider_desc}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('family')}
                  style={{ ...styles.roleBtn, ...(role === 'family' ? styles.roleBtnActive : {}) }}
                >
                  <span style={styles.roleIcon}>💌</span>
                  <span style={styles.roleName}>{t.profile_role_family_name}</span>
                  <span style={styles.roleDesc}>{t.profile_role_family_desc}</span>
                </button>
              </div>
            </div>
          )}

          {/* ── 이름 (성 + 이름 분리) ── */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>{t.name}</label>
            <div style={styles.nameRow}>
              <input
                type="text" placeholder={t.last_name}
                value={lastName} onChange={(e) => setLastName(e.target.value)}
                style={{ ...styles.input, ...styles.nameInputShort }}
              />
              <input
                type="text" placeholder={t.first_name}
                value={firstName} onChange={(e) => setFirstName(e.target.value)}
                style={{ ...styles.input, flex: 1 }}
              />
            </div>
            <p style={styles.inputHint}>{t.profile_name_hint}</p>
          </div>

          {/* ── 생년월일 (년/월/일 분리) ── */}
          <BirthDateSelect
            year={birthYear} month={birthMonth} day={birthDay}
            onYear={setBirthYear} onMonth={setBirthMonth} onDay={setBirthDay}
            styles={styles}
            t={t}
          />

          {/* ── 성별 선택 ── */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>{t.doll_step_gender}</label>
            <div style={styles.genderRow}>
              {[
                { value: 'male',   label: t.doll_create_male,   icon: '👦' },
                { value: 'female', label: t.doll_create_female, icon: '👧' },
              ].map(({ value, label, icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setGender(value)}
                  style={{ ...styles.genderBtn, ...(gender === value ? styles.genderBtnActive : {}) }}
                >
                  <span style={{ fontSize: 22 }}>{icon}</span>
                  <span style={styles.genderLabel}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── 유족 전용: 초대 코드 + 관계 ── */}
          {role === 'family' && (
            <>
              <div style={styles.inputGroup}>
                <label style={styles.label}>{t.invite_code}</label>
                <input
                  type="text"
                  placeholder="MEM-XXXXXX"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  style={{ ...styles.input, letterSpacing: '2px', fontWeight: '600' }}
                  maxLength={10}
                  required
                />
                <p style={styles.inputHint}>{t.profile_invite_hint}</p>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>{t.relation}</label>
                <select
                  value={relation}
                  onChange={(e) => setRelation(e.target.value)}
                  style={styles.select}
                  required
                >
                  <option value="">{t.relation_placeholder}</option>
                  {RELATION_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </>
          )}

          <button type="submit" style={styles.btnSubmit} disabled={loading}>
            {loading ? t.saving : t.landing_start}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 생년월일 셀렉트 (년 / 월 / 일 따로)
// ─────────────────────────────────────────────────────────────────────────────
function BirthDateSelect({ year, month, day, onYear, onMonth, onDay, styles, t }) {
  const currentYear = new Date().getFullYear();
  const years  = Array.from({ length: currentYear - 1899 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const daysInMonth = year && month ? new Date(year, month, 0).getDate() : 31;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  function handleMonthChange(m) {
    onMonth(m);
    if (day && year) {
      const max = new Date(year, m, 0).getDate();
      if (Number(day) > max) onDay('');
    }
  }

  return (
    <div style={styles.inputGroup}>
      <label style={styles.label}>{t.birthdate}</label>
      <div style={styles.dateRow}>
        <select value={year} onChange={(e) => onYear(e.target.value)} style={{ ...styles.select, flex: 2 }}>
          <option value="">{t.year_placeholder}</option>
          {years.map((y) => <option key={y} value={y}>{t.year_unit(y)}</option>)}
        </select>
        <select value={month} onChange={(e) => handleMonthChange(e.target.value)} style={{ ...styles.select, flex: 1 }}>
          <option value="">{t.month_placeholder}</option>
          {months.map((m) => <option key={m} value={m}>{t.month_unit(m)}</option>)}
        </select>
        <select value={day} onChange={(e) => onDay(e.target.value)} style={{ ...styles.select, flex: 1 }}>
          <option value="">{t.day_placeholder}</option>
          {days.map((d) => <option key={d} value={d}>{t.day_unit(d)}</option>)}
        </select>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────────────────────────────────────────
const styles = {
  container: {
    minHeight: '100vh', backgroundColor: '#f7f3ee',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Nunito', 'Noto Sans KR', sans-serif", padding: '20px',
  },
  card: {
    backgroundColor: '#fffdf9', borderRadius: '20px', padding: '48px 40px',
    width: '100%', maxWidth: '440px',
    boxShadow: '0 4px 30px rgba(92,74,58,0.1)',
  },
  logo: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif KR', serif", fontSize: '26px', color: '#5c4a3a',
    letterSpacing: '2px', textAlign: 'center', marginBottom: '4px',
  },
  logoSub: { fontSize: '12px', color: '#c4956a', textAlign: 'center', letterSpacing: '2px', marginBottom: '32px' },
  title: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif KR', serif",
    fontSize: '20px', color: '#5c4a3a', marginBottom: '6px',
  },
  desc: { fontSize: '13px', color: '#a89080', marginBottom: '24px' },
  errorMsg: {
    backgroundColor: '#fdf0f0', color: '#c0392b', fontSize: '13px',
    padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
    borderLeft: '3px solid #c0392b',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '18px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', color: '#7a6355', fontWeight: '500' },
  input: {
    padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #e0d8d0',
    fontSize: '15px', color: '#3d2e22', backgroundColor: '#faf7f4', outline: 'none',
    fontFamily: "'Nunito', 'Noto Sans KR', sans-serif",
  },
  inputHint: { fontSize: '12px', color: '#a89080' },
  nameRow: { display: 'flex', gap: '8px' },
  nameInputShort: { width: '80px', flexShrink: 0 },
  dateRow: { display: 'flex', gap: '8px' },
  select: {
    padding: '12px 14px', borderRadius: '10px', border: '1.5px solid #e0d8d0',
    fontSize: '15px', color: '#3d2e22', backgroundColor: '#faf7f4', outline: 'none',
    fontFamily: "'Nunito', 'Noto Sans KR', sans-serif", cursor: 'pointer',
  },
  roleRow: { display: 'flex', gap: '10px' },
  roleBtn: {
    flex: 1, padding: '14px 10px', borderRadius: '12px',
    border: '1.5px solid #e0d8d0', backgroundColor: '#faf7f4',
    cursor: 'pointer', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '4px', fontFamily: "'Nunito', 'Noto Sans KR', sans-serif",
  },
  roleBtnActive: { borderColor: '#c4956a', backgroundColor: '#fef8f2' },
  roleIcon: { fontSize: '24px' },
  roleName: { fontSize: '13px', fontWeight: '600', color: '#3d2e22' },
  roleDesc: { fontSize: '11px', color: '#a89080' },
  genderRow: { display: 'flex', gap: '8px' },
  genderBtn: {
    flex: 1, padding: '12px 8px', borderRadius: '12px',
    border: '1.5px solid #e0d8d0', backgroundColor: '#faf7f4',
    cursor: 'pointer', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '4px', fontFamily: "'Nunito', 'Noto Sans KR', sans-serif",
    transition: 'all 0.15s',
  },
  genderBtnActive: { borderColor: '#c4956a', backgroundColor: '#fef8f2', boxShadow: '0 0 0 2px rgba(196,149,106,0.2)' },
  genderLabel: { fontSize: '13px', fontWeight: '600', color: '#3d2e22' },
  btnSubmit: {
    marginTop: '4px', padding: '14px', backgroundColor: '#5c4a3a',
    color: '#fffdf9', borderRadius: '10px', fontSize: '15px', fontWeight: '600',
    cursor: 'pointer', fontFamily: "'Nunito', 'Noto Sans KR', sans-serif", border: 'none',
  },
};

export default ProfileSetup;
