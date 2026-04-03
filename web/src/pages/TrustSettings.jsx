// TrustSettings.jsx - 신뢰 가족 전용: 사후 전환 페이지
//
// 접근 조건: 유족(family) 계정 + 신뢰 가족(isTrusted=true)으로 지정된 경우
//
// 기능:
// 1. 연결된 제공자 정보 표시
// 2. 제공자가 이미 사후 전환됐는지 확인
// 3. 2단계 확인을 거쳐 사후 전환 요청 (POST /api/connections/deceased)
//    - 1단계: "사후 전환하기" 버튼 클릭
//    - 2단계: 텍스트 입력으로 의도 재확인
// ⚠️ 이 작업은 되돌릴 수 없어. UI에도 명확하게 표시해야 해.

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useT } from '../hooks/useT';
import { apiCall } from '../utils/api';

function TrustSettings() {
  const { user, userProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const t = useT();

  // ── 상태 ───────────────────────────────────────────────────────────────────
  const [connection, setConnection]         = useState(null);
  const [providerName, setProviderName]     = useState('');
  const [isDeceased, setIsDeceased]         = useState(false);
  const [loading, setLoading]               = useState(true);
  const [step, setStep]                     = useState(0);     // 0: 초기 | 1: 경고 | 2: 확인 입력
  const [confirmText, setConfirmText]       = useState('');
  const [submitting, setSubmitting]         = useState(false);
  const [done, setDone]                     = useState(false);
  const [error, setError]                   = useState('');

  // ── 연결 정보 로드 ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadConnection() {
      try {
        const q = query(
          collection(db, 'connections'),
          where('familyId', '==', user.uid),
          where('status', '==', 'accepted'),
          where('isTrusted', '==', true)
        );
        const snap = await getDocs(q);

        if (snap.empty) {
          navigate('/dashboard', { replace: true });
          return;
        }

        const connDoc = snap.docs[0];
        const connData = { id: connDoc.id, ...connDoc.data() };
        setConnection(connData);
        setProviderName(connData.providerName || connData.providerName || '—');

        const providerSnap = await getDoc(doc(db, 'users', connData.providerId));
        if (providerSnap.exists()) {
          setIsDeceased(providerSnap.data().isDeceased === true);
        }
      } catch (err) {
        console.error('연결 정보 로드 실패:', err);
        setError(t.trust_load_fail);
      } finally {
        setLoading(false);
      }
    }

    loadConnection();
  }, [user, navigate]);

  // ── 사후 전환 요청 ─────────────────────────────────────────────────────────
  async function handleDeceased() {
    if (!connection) return;
    if (confirmText.trim() !== t.trust_confirm_word) {
      setError(t.trust_confirm_error);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await apiCall('POST', '/api/connections/deceased', {
        providerId: connection.providerId,
      });
      setDone(true);
      setStep(0);
      setIsDeceased(true);
    } catch (err) {
      setError(err.message || t.error_deceased_transition);
    } finally {
      setSubmitting(false);
    }
  }

  // ── 로딩 중 ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <Link to="/dashboard" style={styles.backLink}>{t.back_dashboard}</Link>
          <span style={styles.logo}>{t.app_name}</span>
          <div style={{ width: '80px' }} />
        </header>
        <main style={styles.main}>
          <p style={{ color: '#a89080', textAlign: 'center', marginTop: '80px' }}>{t.loading}</p>
        </main>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={styles.container}>
      {/* 헤더 */}
      <header style={styles.header}>
        <Link to="/dashboard" style={styles.backLink}>{t.back_dashboard}</Link>
        <span style={styles.logo}>{t.app_name}</span>
        <div style={{ width: '80px' }} />
      </header>

      <main style={styles.main}>
        <h2 style={styles.title}>{t.trust_settings_title}</h2>
        <p style={styles.subtitle}>{t.trust_settings_desc}</p>

        {/* 제공자 상태 카드 */}
        <div style={styles.statusCard}>
          <div style={styles.statusRow}>
            <span style={styles.statusLabel}>{t.trust_connected_label}</span>
            <span style={styles.statusValue}>{providerName}</span>
          </div>
          <div style={styles.statusRow}>
            <span style={styles.statusLabel}>{t.trust_status_label}</span>
            <span style={{
              ...styles.statusBadge,
              ...(isDeceased ? styles.badgeDeceased : styles.badgeAlive),
            }}>
              {isDeceased ? t.trust_status_done : t.trust_status_alive}
            </span>
          </div>
        </div>

        {/* 이미 전환된 경우 */}
        {isDeceased && (
          <div style={styles.doneBox}>
            <span style={styles.doneIcon}>🕊️</span>
            <p style={styles.doneTitle}>{t.trust_done_title}</p>
            <p style={styles.doneDesc}>{t.trust_done_desc(providerName)}</p>
            <Link to="/chat" style={styles.btnChat}>{t.trust_done_chat_btn}</Link>
          </div>
        )}

        {/* 전환 완료 직후 메시지 */}
        {done && !isDeceased && (
          <div style={styles.doneBox}>
            <p style={{ color: '#276749', fontWeight: '600' }}>{t.trust_done_title}</p>
          </div>
        )}

        {/* 사후 전환 버튼 영역 (아직 전환 안 된 경우) */}
        {!isDeceased && !done && (
          <div>
            {/* 단계 0: 초기 안내 */}
            {step === 0 && (
              <div style={styles.infoBox}>
                <p style={styles.infoTitle}>{t.trust_info_title}</p>
                <p style={styles.infoText}>
                  {t.trust_info_desc1(providerName)}<br />
                  {t.trust_info_desc2(providerName)}
                </p>
                <p style={styles.warningText}>{t.trust_warning}</p>
                <button onClick={() => setStep(1)} style={styles.btnStart}>
                  {t.trust_start_btn}
                </button>
              </div>
            )}

            {/* 단계 1: 경고 확인 */}
            {step === 1 && (
              <div style={styles.warningBox}>
                <p style={styles.warningTitle}>{t.trust_caution_title}</p>
                <ul style={styles.warningList}>
                  <li>{t.trust_caution_1}</li>
                  <li>{t.trust_caution_2(providerName)}</li>
                  <li>{t.trust_caution_3}</li>
                  <li>{t.trust_caution_4(user?.displayName || providerName)}</li>
                </ul>
                <div style={styles.stepButtons}>
                  <button onClick={() => setStep(0)} style={styles.btnBack}>{t.cancel}</button>
                  <button onClick={() => setStep(2)} style={styles.btnConfirmWarning}>
                    {t.trust_continue_btn}
                  </button>
                </div>
              </div>
            )}

            {/* 단계 2: 텍스트 입력 최종 확인 */}
            {step === 2 && (
              <div style={styles.confirmBox}>
                <p style={styles.confirmTitle}>{t.trust_final_title}</p>
                <p style={styles.confirmDesc}>{t.trust_final_desc}</p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={t.trust_confirm_word}
                  style={styles.confirmInput}
                  autoFocus
                />
                {error && <p style={styles.errorText}>{error}</p>}
                <div style={styles.stepButtons}>
                  <button onClick={() => { setStep(1); setConfirmText(''); setError(''); }} style={styles.btnBack}>
                    {t.trust_prev}
                  </button>
                  <button
                    onClick={handleDeceased}
                    style={{
                      ...styles.btnDeceased,
                      ...(submitting ? styles.btnDisabled : {}),
                    }}
                    disabled={submitting}
                  >
                    {submitting ? t.processing : t.trust_complete_btn}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────────────────────────────────────────
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f7f3ee',
    fontFamily: "'Nunito', 'Noto Sans KR', sans-serif",
    color: '#5c4a3a',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 40px',
    backgroundColor: '#fffdf9',
    borderBottom: '1px solid #e8e0d8',
  },
  backLink: { color: '#7a6355', fontSize: '14px', width: '80px', display: 'block' },
  logo: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif KR', serif",
    fontSize: '20px', fontWeight: '700', letterSpacing: '2px', color: '#5c4a3a',
  },
  main: { maxWidth: '560px', margin: '0 auto', padding: '60px 20px 80px' },
  title: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif KR', serif",
    fontSize: '26px', marginBottom: '8px',
  },
  subtitle: { fontSize: '14px', color: '#7a6355', marginBottom: '36px' },

  // 제공자 상태 카드
  statusCard: {
    backgroundColor: '#fffdf9',
    borderRadius: '14px',
    padding: '20px 24px',
    marginBottom: '28px',
    boxShadow: '0 2px 10px rgba(92,74,58,0.07)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  statusRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  statusLabel: { fontSize: '13px', color: '#a89080' },
  statusValue: { fontSize: '15px', fontWeight: '600' },
  statusBadge: {
    fontSize: '12px', fontWeight: '700',
    padding: '4px 12px', borderRadius: '99px',
  },
  badgeAlive: { backgroundColor: '#f0fdf4', color: '#276749' },
  badgeDeceased: { backgroundColor: '#fdf2f8', color: '#97266d' },

  // 완료 박스
  doneBox: {
    backgroundColor: '#fffdf9', borderRadius: '16px', padding: '40px 24px',
    textAlign: 'center', boxShadow: '0 2px 12px rgba(92,74,58,0.07)',
  },
  doneIcon: { fontSize: '40px', display: 'block', marginBottom: '16px' },
  doneTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif KR', serif",
    fontSize: '20px', marginBottom: '10px',
  },
  doneDesc: { fontSize: '14px', color: '#7a6355', marginBottom: '24px' },
  btnChat: {
    display: 'inline-block', padding: '12px 28px',
    backgroundColor: '#5c4a3a', color: '#fffdf9',
    borderRadius: '10px', fontSize: '14px', fontWeight: '600',
  },

  // 안내 박스
  infoBox: {
    backgroundColor: '#fffdf9', borderRadius: '14px', padding: '28px 24px',
    boxShadow: '0 2px 10px rgba(92,74,58,0.07)',
  },
  infoTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif KR', serif",
    fontSize: '18px', fontWeight: '700', marginBottom: '12px',
  },
  infoText: { fontSize: '14px', color: '#5c4a3a', lineHeight: '1.7', marginBottom: '14px' },
  warningText: {
    fontSize: '13px', color: '#c4956a', fontWeight: '600', marginBottom: '20px',
  },
  btnStart: {
    padding: '12px 28px', backgroundColor: '#c4956a', color: '#fff',
    border: 'none', borderRadius: '10px', fontSize: '14px', cursor: 'pointer',
    fontFamily: "'Nunito', 'Noto Sans KR', sans-serif", fontWeight: '600',
  },

  // 경고 박스
  warningBox: {
    backgroundColor: '#fef8f2', border: '1px solid #f0ddc8',
    borderRadius: '14px', padding: '28px 24px',
  },
  warningTitle: {
    fontSize: '16px', fontWeight: '700', color: '#5c4a3a', marginBottom: '16px',
  },
  warningList: {
    fontSize: '14px', color: '#5c4a3a', lineHeight: '2',
    paddingLeft: '20px', marginBottom: '24px',
  },

  // 최종 확인 박스
  confirmBox: {
    backgroundColor: '#fffdf9', border: '1.5px solid #f0ddc8',
    borderRadius: '14px', padding: '28px 24px',
  },
  confirmTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif KR', serif",
    fontSize: '18px', fontWeight: '700', marginBottom: '10px',
  },
  confirmDesc: { fontSize: '14px', color: '#5c4a3a', lineHeight: '1.7', marginBottom: '16px' },
  confirmInput: {
    width: '100%', padding: '12px 14px', fontSize: '16px',
    fontFamily: "'Nunito', 'Noto Sans KR', sans-serif",
    border: '1.5px solid #e0d8d0', borderRadius: '10px',
    backgroundColor: '#f7f3ee', color: '#5c4a3a',
    boxSizing: 'border-box', outline: 'none', marginBottom: '8px',
  },
  errorText: { fontSize: '13px', color: '#c0392b', marginBottom: '12px' },

  // 단계 버튼들
  stepButtons: { display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'flex-end' },
  btnBack: {
    padding: '10px 20px', backgroundColor: 'transparent', color: '#7a6355',
    border: '1.5px solid #e0d8d0', borderRadius: '8px', fontSize: '13px',
    cursor: 'pointer', fontFamily: "'Nunito', 'Noto Sans KR', sans-serif",
  },
  btnConfirmWarning: {
    padding: '10px 20px', backgroundColor: '#c4956a', color: '#fff',
    border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
    fontFamily: "'Nunito', 'Noto Sans KR', sans-serif", fontWeight: '600',
  },
  btnDeceased: {
    padding: '10px 24px', backgroundColor: '#c0392b', color: '#fff',
    border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
    fontFamily: "'Nunito', 'Noto Sans KR', sans-serif", fontWeight: '700',
  },
  btnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
};

export default TrustSettings;
