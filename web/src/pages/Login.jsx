// Login.jsx - 로그인 / 회원가입 페이지
//
// 회원가입 탭에서 역할 선택:
//   제공자(provider): 기억을 남기는 사람 → inviteCode 자동 발급
//   유족(family):     초대 코드 입력 → 제공자에게 연결 요청

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useT } from '../hooks/useT';
import { apiCall } from '../utils/api';

function Login() {
  const t = useT();
  const RELATIONS = t.relations;
  const [tab, setTab] = useState('login');

  // 공통 입력값
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // 회원가입 전용 입력값
  const [role, setRole]           = useState('provider');
  const [lastName, setLastName]   = useState('');           // 성
  const [firstName, setFirstName] = useState('');           // 이름
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay]   = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [relation, setRelation]   = useState('');

  // UI 상태
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  // ─────────────────────────────────────────
  // 회원가입 / 로그인 제출
  // ─────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (tab === 'login') {
        await login(email, password);
        navigate('/dashboard');
        return;
      }

      // ── 회원가입 ──────────────────────────
      const fullName = (lastName + firstName).trim();
      if (!fullName) { setError(t.validation_name); setLoading(false); return; }
      if (!birthYear || !birthMonth || !birthDay) {
        setError(t.validation_birthdate); setLoading(false); return;
      }
      const birthDate = `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;

      // 유족이면 초대 코드와 관계 필수
      if (role === 'family') {
        if (!inviteCode.trim()) { setError(t.validation_invite_code); setLoading(false); return; }
        if (!relation) { setError(t.validation_relation); setLoading(false); return; }
      }

      // 1. Firebase 계정 생성
      const newUser = await signup(fullName, email, password, role, birthDate);

      // 2. 유족이면 초대 코드로 연결 요청 전송
      if (role === 'family') {
        try {
          // 백엔드에 연결 요청 (백엔드가 꺼져 있어도 가입은 성공 처리)
          await apiCall('POST', '/api/connections/join', {
            inviteCode: inviteCode.trim().toUpperCase(),
            relation,
          });
        } catch (apiErr) {
          // 초대 코드 오류는 별도 메시지로 안내 (계정은 이미 생성됨)
          console.error('연결 요청 실패:', apiErr);
          navigate('/dashboard');
          // dashboard에서 재시도 안내 메시지 표시를 위해 state 전달
          navigate('/dashboard', { state: { pendingInvite: inviteCode.trim().toUpperCase(), relation } });
          return;
        }
      }

      navigate('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err.code, t));
    } finally {
      setLoading(false);
    }
  }

  // ─────────────────────────────────────────
  // Google 로그인 (제공자로 가입)
  // ─────────────────────────────────────────
  async function handleGoogleLogin() {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err.code, t));
    } finally {
      setLoading(false);
    }
  }

  function switchTab(newTab) {
    setTab(newTab);
    setError('');
    setName(''); setEmail(''); setPassword('');
    setRole('provider');
    setLastName(''); setFirstName('');
    setBirthYear(''); setBirthMonth(''); setBirthDay('');
    setInviteCode(''); setRelation('');
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <Link to="/" style={styles.backLink}>← {t.back}</Link>
        <h1 style={styles.logo}>{t.app_name}</h1>
        <p style={styles.logoSub}>{t.login_subtitle}</p>

        {/* 로그인 / 회원가입 탭 */}
        <div style={styles.tabs}>
          {['login', 'signup'].map((tabKey) => (
            <button
              key={tabKey}
              style={{ ...styles.tab, ...(tab === tabKey ? styles.tabActive : {}) }}
              onClick={() => switchTab(tabKey)}
            >
              {tabKey === 'login' ? t.login : t.signup}
            </button>
          ))}
        </div>

        {/* 에러 메시지 */}
        {error && <p style={styles.errorMsg}>{error}</p>}

        <form onSubmit={handleSubmit} style={styles.form}>

          {/* ── 회원가입: 역할 선택 ── */}
          {tab === 'signup' && (
            <div style={styles.roleSelect}>
              <p style={styles.label}>{t.signup_type}</p>
              <div style={styles.roleRow}>
                {/* 제공자 선택 */}
                <button
                  type="button"
                  onClick={() => setRole('provider')}
                  style={{ ...styles.roleBtn, ...(role === 'provider' ? styles.roleBtnActive : {}) }}
                >
                  <span style={styles.roleIcon}>✍️</span>
                  <span style={styles.roleName}>{t.role_provider}</span>
                  <span style={styles.roleDesc}>{t.signup}</span>
                </button>
                {/* 유족 선택 */}
                <button
                  type="button"
                  onClick={() => setRole('family')}
                  style={{ ...styles.roleBtn, ...(role === 'family' ? styles.roleBtnActive : {}) }}
                >
                  <span style={styles.roleIcon}>💌</span>
                  <span style={styles.roleName}>{t.role_family}</span>
                  <span style={styles.roleDesc}>{t.signup}</span>
                </button>
              </div>
            </div>
          )}

          {/* 성 + 이름 (회원가입만) */}
          {tab === 'signup' && (
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
            </div>
          )}

          {/* 생년월일 (회원가입만) */}
          {tab === 'signup' && (
            <BirthDateSelect
              year={birthYear} month={birthMonth} day={birthDay}
              onYear={setBirthYear} onMonth={setBirthMonth} onDay={setBirthDay}
              label={t.birthdate}
              styles={styles}
              t={t}
            />
          )}

          {/* 이메일 */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>{t.email}</label>
            <input
              type="email" placeholder="example@email.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              style={styles.input} required
            />
          </div>

          {/* 비밀번호 */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>{t.password}</label>
            <input
              type="password"
              placeholder={tab === 'signup' ? t.password_hint : t.password_placeholder}
              value={password} onChange={(e) => setPassword(e.target.value)}
              style={styles.input} required minLength={6}
            />
          </div>

          {/* ── 유족 전용: 초대 코드 + 관계 ── */}
          {tab === 'signup' && role === 'family' && (
            <>
              <div style={styles.inputGroup}>
                <label style={styles.label}>{t.invite_code}</label>
                <input
                  type="text"
                  placeholder="MEM-XXXXXX"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  style={{ ...styles.input, letterSpacing: '2px', fontWeight: '600' }}
                  required
                  maxLength={10}
                />
                <p style={styles.inputHint}>{t.invite_code_hint}</p>
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
                  {RELATIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <button type="submit" style={styles.btnSubmit} disabled={loading}>
            {loading ? t.loading : tab === 'login' ? t.login : t.signup}
          </button>
        </form>

        {/* Google 로그인 (로그인 탭에서만 표시) */}
        {tab === 'login' && (
          <>
            <div style={styles.divider}>
              <span style={styles.dividerLine} />
              <span style={styles.dividerText}>{t.or_divider}</span>
              <span style={styles.dividerLine} />
            </div>
            <button onClick={handleGoogleLogin} style={styles.btnGoogle} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 18 18" style={{ marginRight: '10px' }}>
                <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
                <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z"/>
                <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
              </svg>
              {t.login_google}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 생년월일 셀렉트 (년 / 월 / 일 따로)
// ─────────────────────────────────────────────────────────────────────────────
function BirthDateSelect({ year, month, day, onYear, onMonth, onDay, label, styles, t }) {
  const currentYear = new Date().getFullYear();
  const years  = Array.from({ length: currentYear - 1899 }, (_, i) => currentYear - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const daysInMonth = year && month ? new Date(year, month, 0).getDate() : 31;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // 선택된 day가 해당 월 최대일 초과 시 초기화
  function handleMonthChange(m) {
    onMonth(m);
    if (day && year) {
      const max = new Date(year, m, 0).getDate();
      if (Number(day) > max) onDay('');
    }
  }

  return (
    <div style={styles.inputGroup}>
      <label style={styles.label}>{label}</label>
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

function getErrorMessage(code, t) {
  const map = {
    'auth/email-already-in-use': t.error_email_in_use,
    'auth/invalid-email':        t.error_invalid_email,
    'auth/weak-password':        t.error_weak_password,
    'auth/user-not-found':       t.error_user_not_found,
    'auth/wrong-password':       t.error_wrong_password,
    'auth/invalid-credential':   t.error_invalid_credential,
    'auth/popup-closed-by-user': t.error_popup_closed,
    'auth/too-many-requests':    t.error_too_many_requests,
  };
  return map[code] || t.error_default;
}

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
  backLink: { display: 'block', color: '#a89080', fontSize: '14px', marginBottom: '28px' },
  logo: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif KR', serif", fontSize: '26px', color: '#5c4a3a',
    letterSpacing: '2px', textAlign: 'center', marginBottom: '4px',
  },
  logoSub: { fontSize: '12px', color: '#c4956a', textAlign: 'center', letterSpacing: '2px', marginBottom: '32px' },
  tabs: {
    display: 'flex', borderRadius: '10px', backgroundColor: '#f0ebe4',
    padding: '4px', marginBottom: '24px',
  },
  tab: {
    flex: 1, padding: '10px', borderRadius: '8px', fontSize: '14px',
    color: '#7a6355', cursor: 'pointer', fontFamily: "'Nunito', 'Noto Sans KR', sans-serif",
  },
  tabActive: {
    backgroundColor: '#fffdf9', color: '#5c4a3a', fontWeight: '600',
    boxShadow: '0 1px 4px rgba(92,74,58,0.12)',
  },
  errorMsg: {
    backgroundColor: '#fdf0f0', color: '#c0392b', fontSize: '13px',
    padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
    borderLeft: '3px solid #c0392b',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  // 역할 선택
  roleSelect: { display: 'flex', flexDirection: 'column', gap: '8px' },
  roleRow: { display: 'flex', gap: '10px' },
  roleBtn: {
    flex: 1, padding: '14px 10px', borderRadius: '12px',
    border: '1.5px solid #e0d8d0', backgroundColor: '#faf7f4',
    cursor: 'pointer', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '4px', fontFamily: "'Nunito', 'Noto Sans KR', sans-serif",
    transition: 'all 0.2s',
  },
  roleBtnActive: { borderColor: '#c4956a', backgroundColor: '#fef8f2' },
  roleIcon: { fontSize: '24px' },
  roleName: { fontSize: '13px', fontWeight: '600', color: '#3d2e22' },
  roleDesc: { fontSize: '11px', color: '#a89080' },
  // 입력 필드
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
  btnSubmit: {
    marginTop: '4px', padding: '14px', backgroundColor: '#5c4a3a',
    color: '#fffdf9', borderRadius: '10px', fontSize: '15px', fontWeight: '600',
    cursor: 'pointer', fontFamily: "'Nunito', 'Noto Sans KR', sans-serif", border: 'none',
  },
  divider: { display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' },
  dividerLine: { flex: 1, height: '1px', backgroundColor: '#e8e0d8', display: 'block' },
  dividerText: { fontSize: '12px', color: '#a89080' },
  btnGoogle: {
    width: '100%', padding: '13px', backgroundColor: '#fffdf9',
    border: '1.5px solid #e0d8d0', borderRadius: '10px', fontSize: '14px',
    color: '#5c4a3a', cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontFamily: "'Nunito', 'Noto Sans KR', sans-serif", fontWeight: '500',
  },
};

export default Login;
