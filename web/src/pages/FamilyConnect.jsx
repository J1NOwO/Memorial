// FamilyConnect.jsx - 가족 연결 관리 (모바일 우선)

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useMemorial } from '../context/MemorialContext';
import { useT } from '../hooks/useT';
import { apiCall } from '../utils/api';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';

const RELATION_EMOJI = {
  '배우자': '💑', '자녀': '👶', '부모': '👨‍👩‍👦',
  '형제자매': '👫', '친구': '🤝', '기타': '👤',
};

// 가족/친구 분류
const FAMILY_RELATIONS = ['배우자', '자녀', '부모', '형제자매'];
const FRIEND_RELATIONS = ['친구', '기타'];

export default function FamilyConnect() {
  const { userProfile, refreshProfile } = useAuth();
  const { isMemorial } = useMemorial();
  const t = useT();

  const KO_RELATIONS = ['배우자', '자녀', '부모', '형제자매', '친구', '기타'];
  function getRelationLabel(rel) {
    const idx = KO_RELATIONS.indexOf(rel);
    return idx >= 0 ? (t.relations[idx] || rel) : rel;
  }

  const [connections, setConnections] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [copyDone, setCopyDone]       = useState(false);
  const [error, setError]             = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const pending  = connections.filter((c) => c.status === 'pending');
  const accepted = connections.filter((c) => c.status === 'accepted');

  // 가족/친구 섹션 분리
  const familyGroup = accepted.filter((c) => FAMILY_RELATIONS.includes(c.relation));
  const friendGroup = accepted.filter((c) => FRIEND_RELATIONS.includes(c.relation));

  useEffect(() => { loadConnections(); }, []);

  async function loadConnections() {
    try {
      setLoading(true);
      const data = await apiCall('GET', '/api/connections');
      setConnections(data.connections || []);
    } catch {
      setError(t.connection_load_fail);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(userProfile?.inviteCode || '');
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    } catch {
      alert(t.copy_fail);
    }
  }

  async function handleApprove(connectionId) {
    setActionLoading(connectionId);
    try {
      await apiCall('POST', '/api/connections/approve', { connectionId });
      setConnections((prev) => prev.map((c) => c.id === connectionId ? { ...c, status: 'accepted' } : c));
    } catch (e) {
      alert(e.message || t.error_approve);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(connectionId) {
    if (!window.confirm(t.confirm_reject)) return;
    setActionLoading(connectionId);
    try {
      await apiCall('POST', '/api/connections/reject', { connectionId });
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
    } catch (e) {
      alert(e.message || t.error_reject);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggleMemories(connectionId, currentValue) {
    setActionLoading(connectionId);
    try {
      await apiCall('POST', '/api/connections/updatePermission', { connectionId, canViewMemories: !currentValue });
      setConnections((prev) => prev.map((c) => c.id === connectionId ? { ...c, canViewMemories: !currentValue } : c));
    } catch (e) {
      alert(e.message || t.error_permission);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSetTrust(connectionId, newName) {
    // 기존 신뢰 가족 확인
    const currentTrusted = connections.find((c) => c.isTrusted);
    if (currentTrusted && currentTrusted.id !== connectionId) {
      const ok = window.confirm(
        t.confirm_trust_change(currentTrusted.familyName, newName)
      );
      if (!ok) return;
    }
    setActionLoading(connectionId);
    try {
      await apiCall('POST', '/api/connections/setTrust', { connectionId });
      setConnections((prev) => prev.map((c) => ({ ...c, isTrusted: c.id === connectionId })));
      await refreshProfile();
      alert(t.trust_set_success(newName));
    } catch (e) {
      alert(e.message || t.error_trust_set);
    } finally {
      setActionLoading(null);
    }
  }

  // 연결된 사람 카드 렌더링 (showTrust: 가족 섹션만 true)
  function renderConnectionCard(conn, showTrust) {
    return (
      <div key={conn.id} style={S.familyCard}>
        {/* 왼쪽 */}
        <div style={S.familyLeft}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <span style={S.emoji}>{RELATION_EMOJI[conn.relation] || '👤'}</span>
            {/* 신뢰 가족 왕관 아이콘 */}
            {conn.isTrusted && (
              <span style={S.crownBadge}>👑</span>
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <p style={S.familyName}>{conn.familyName}</p>
              {conn.isTrusted && <span style={S.trustedBadge}>{t.trust_badge}</span>}
            </div>
            <p style={S.familyRelation}>{getRelationLabel(conn.relation)}</p>
          </div>
        </div>

        {/* 오른쪽: 권한 + 신뢰 (추모 모드에서는 열람 상태만 표시) */}
        <div style={S.cardRight}>
          {isMemorial ? (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {conn.canViewMemories ? `🔓 ${t.memory_view}` : `🔒 ${t.memory_private_label}`}
            </span>
          ) : (
            <>
              <label style={S.toggleLabel}>
                <span style={S.toggleText}>{t.memory_view}</span>
                <div
                  style={{ ...S.toggle, ...(conn.canViewMemories ? S.toggleOn : {}) }}
                  onClick={() => handleToggleMemories(conn.id, conn.canViewMemories)}
                >
                  <div style={{ ...S.toggleDot, ...(conn.canViewMemories ? S.toggleDotOn : {}) }}/>
                </div>
              </label>
              {showTrust && !conn.isTrusted && (
                <button
                  onClick={() => handleSetTrust(conn.id, conn.familyName)}
                  style={S.btnTrust}
                  disabled={actionLoading === conn.id}
                >
                  {actionLoading === conn.id ? '...' : t.trust_designate}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <TopBar title={t.family_connect} />

      <main style={S.main} className="pb-nav">

        {/* 추모 모드 안내 */}
        {isMemorial && (
          <div style={{
            backgroundColor: 'var(--accent-pale)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '12px 16px', fontSize: 13,
            color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.7,
          }}>
            {t.memorial_no_edit}
          </div>
        )}

        {/* ── 초대 코드 섹션 ── */}
        <div style={S.section}>
          <p style={S.sectionLabel}>{t.connection_invite_title}</p>
          <p style={S.sectionDesc}>{t.connection_invite_desc}</p>

          <div style={S.codeBox}>
            <span style={S.codeText}>{userProfile?.inviteCode || '—'}</span>
            <button
              onClick={handleCopy}
              style={{ ...S.copyBtn, ...(copyDone ? S.copyBtnDone : {}) }}
            >
              {copyDone ? t.copy_done : t.copy}
            </button>
          </div>
        </div>

        {error && <div style={S.errorBox}>{error}</div>}
        {loading && <p style={S.loadingText}>{t.loading}</p>}

        {/* ── 연결 요청 ── */}
        {!loading && pending.length > 0 && (
          <div style={S.section}>
            <div style={S.sectionHeader}>
              <p style={S.sectionLabel}>{t.pending_requests}</p>
              <span style={S.badge}>{pending.length}</span>
            </div>
            <div style={S.list}>
              {pending.map((conn) => (
                <div key={conn.id} style={S.familyCard}>
                  <div style={S.familyLeft}>
                    <span style={S.emoji}>{RELATION_EMOJI[conn.relation] || '👤'}</span>
                    <div>
                      <p style={S.familyName}>{conn.familyName}</p>
                      <p style={S.familyRelation}>{getRelationLabel(conn.relation)}</p>
                    </div>
                  </div>
                  {!isMemorial && (
                    <div style={S.cardActions}>
                      <button onClick={() => handleApprove(conn.id)} style={S.btnApprove}
                        disabled={actionLoading === conn.id}>
                        {actionLoading === conn.id ? '...' : t.accept}
                      </button>
                      <button onClick={() => handleReject(conn.id)} style={S.btnReject}
                        disabled={actionLoading === conn.id}>
                        {t.reject}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 가족 섹션 ── */}
        {!loading && (
          <div style={S.section}>
            <p style={S.sectionLabel}>{t.family_group_title}</p>

            {familyGroup.length === 0 ? (
              <div style={S.emptyBox}>
                <p style={{ fontSize: 14, color: 'var(--text-mid)', marginBottom: 4 }}>{t.no_family}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.no_family_desc}</p>
              </div>
            ) : (
              <div style={S.list}>
                {familyGroup.map((conn) => renderConnectionCard(conn, true))}
              </div>
            )}
          </div>
        )}

        {/* ── 친구 섹션 ── */}
        {!loading && (
          <div style={S.section}>
            <p style={S.sectionLabel}>{t.friend_group_title}</p>

            {friendGroup.length === 0 ? (
              <div style={S.emptyBox}>
                <p style={{ fontSize: 14, color: 'var(--text-mid)', marginBottom: 4 }}>{t.no_friends}</p>
              </div>
            ) : (
              <div style={S.list}>
                {friendGroup.map((conn) => renderConnectionCard(conn, false))}
              </div>
            )}
          </div>
        )}

        {/* 신뢰 가족 안내 */}
        <div style={S.infoBox}>
          <p style={S.infoTitle}>{t.trust_family_info_title}</p>
          <p style={S.infoText}>
            {t.trust_family_info_desc1}{' '}
            {t.trust_family_info_desc2}
          </p>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

const S = {
  page: {
    minHeight: '100dvh', backgroundColor: 'var(--bg)', fontFamily: 'var(--font-sans)',
  },
  main: { padding: '20px 20px' },
  section: {
    backgroundColor: 'var(--card)', borderRadius: 20,
    padding: '20px', marginBottom: 14,
    boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)',
  },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionLabel: {
    fontSize: 14, fontWeight: 700, color: 'var(--primary-deep)', marginBottom: 6,
  },
  sectionDesc: { fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 14 },
  badge: {
    backgroundColor: 'var(--accent)', color: 'white',
    fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
  },
  // 초대 코드 박스
  codeBox: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    backgroundColor: 'var(--bg)', borderRadius: 14, padding: '16px 18px',
  },
  codeText: {
    fontFamily: "'Courier New', Courier, monospace", fontSize: 20, fontWeight: 700,
    color: 'var(--primary)', letterSpacing: 3, flex: 1, whiteSpace: 'nowrap',
  },
  copyBtn: {
    padding: '10px 18px', borderRadius: 10,
    border: '1.5px solid var(--accent)', color: 'var(--accent)',
    backgroundColor: 'transparent', cursor: 'pointer',
    fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)',
    transition: 'all 0.2s', whiteSpace: 'nowrap', flexShrink: 0,
  },
  copyBtnDone: {
    backgroundColor: 'var(--accent)', color: 'white', borderColor: 'var(--accent)',
  },
  errorBox: {
    backgroundColor: 'var(--bg)', color: '#c0392b', fontSize: 13,
    padding: '10px 14px', borderRadius: 10, marginBottom: 14,
    borderLeft: '3px solid #c0392b', border: '1px solid var(--border)',
  },
  loadingText: { textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0', fontSize: 14 },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  familyCard: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 14px', backgroundColor: 'var(--bg)', borderRadius: 14, gap: 12,
  },
  familyLeft: { display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  emoji: { fontSize: 28, flexShrink: 0 },
  crownBadge: {
    position: 'absolute', top: -8, right: -8,
    fontSize: 14, lineHeight: 1,
  },
  familyName: { fontSize: 15, fontWeight: 600, color: 'var(--primary-deep)' },
  familyRelation: { fontSize: 12, color: 'var(--text-muted)', marginTop: 2 },
  trustedBadge: {
    fontSize: 10, backgroundColor: 'var(--accent)', color: 'white',
    padding: '2px 7px', borderRadius: 99, fontWeight: 700,
  },
  cardActions: { display: 'flex', gap: 7, flexShrink: 0 },
  btnApprove: {
    padding: '8px 16px', backgroundColor: 'var(--primary)', color: 'var(--card)',
    border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
    fontFamily: 'var(--font-sans)', fontWeight: 700,
  },
  btnReject: {
    padding: '8px 14px', backgroundColor: 'transparent',
    border: '1.5px solid var(--border)', color: 'var(--text-mid)',
    borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-sans)',
  },
  cardRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 },
  toggleLabel: { display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' },
  toggleText: { fontSize: 11, color: 'var(--text-mid)' },
  toggle: {
    width: 40, height: 22, backgroundColor: 'var(--border)',
    borderRadius: 11, position: 'relative', cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  toggleOn: { backgroundColor: 'var(--accent)' },
  toggleDot: {
    width: 18, height: 18, backgroundColor: 'white',
    borderRadius: '50%', position: 'absolute', top: 2, left: 2,
    transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  },
  toggleDotOn: { transform: 'translateX(18px)' },
  btnTrust: {
    padding: '6px 12px', backgroundColor: 'transparent',
    border: '1.5px solid var(--accent)', color: 'var(--accent)',
    borderRadius: 8, cursor: 'pointer', fontSize: 11,
    fontFamily: 'var(--font-sans)', fontWeight: 600,
  },
  emptyBox: { textAlign: 'center', padding: '20px 0' },
  infoBox: {
    backgroundColor: 'var(--accent-pale)', border: '1px solid var(--accent-light)',
    borderRadius: 16, padding: '16px 18px', marginBottom: 14,
  },
  infoTitle: { fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 },
  infoText:  { fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.7 },
};
