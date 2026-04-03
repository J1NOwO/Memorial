// DevMode.jsx - 개발자 모드 페이지
// ⚠️ Settings 버전 7탭으로만 진입 가능 / 로컬 상태 (재시작 시 비활성화)

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMemorial } from '../context/MemorialContext';
import { apiCall } from '../utils/api';
import TopBar from '../components/TopBar';

const CATEGORIES = ['추억', '가치관', '말투·성격', '가족에게', '인생 조언'];

export default function DevMode() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const { triggerNameInheritanceAnimation } = useMemorial();

  // 열린 섹션
  const [open, setOpen] = useState({ user: true, doll: false, ai: false, data: false, danger: false });
  const toggle = (k) => setOpen((p) => ({ ...p, [k]: !p[k] }));

  // 섹션별 결과 메시지
  const [results, setResults] = useState({});
  const setResult = (key, msg) => setResults((p) => ({ ...p, [key]: msg }));

  // 데이터 섹션
  const [userInfo, setUserInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(false);

  // Doll 컨텍스트 모달
  const [contextModal, setContextModal] = useState('');

  // AI 테스트
  const [genCategory, setGenCategory] = useState(CATEGORIES[0]);

  // 확인 팝업
  const [confirmAction, setConfirmAction] = useState(null); // { label, fn }
  const [confirmInput, setConfirmInput]   = useState('');

  // ── 유저 정보 로드 ──────────────────────────────────────────────────────────
  async function loadUserInfo() {
    setLoadingInfo(true);
    try {
      const data = await apiCall('GET', '/api/dev/user-info');
      setUserInfo(data);
    } catch (e) {
      setResult('info', `❌ ${e.message}`);
    } finally {
      setLoadingInfo(false);
    }
  }

  useEffect(() => { loadUserInfo(); }, []);

  // ── 공통 액션 래퍼 ─────────────────────────────────────────────────────────
  async function run(key, fn) {
    setResult(key, '⏳ 실행 중...');
    try {
      const r = await fn();
      setResult(key, `✅ ${r}`);
      await refreshProfile();
      await loadUserInfo();
    } catch (e) {
      setResult(key, `❌ ${e.message}`);
    }
  }

  // ── 확인 팝업 필요한 위험 액션 ─────────────────────────────────────────────
  function requireConfirm(label, fn) {
    setConfirmAction({ label, fn });
    setConfirmInput('');
  }

  async function execConfirm() {
    if (!confirmAction) return;
    const { fn } = confirmAction;
    setConfirmAction(null);
    await fn();
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <TopBar title="개발자 모드" onBack={() => navigate('/settings')} />

      {/* 경고 배너 */}
      <div style={S.warningBanner}>⚠️ 개발자 모드 — 실제 데이터가 변경됩니다</div>

      <div style={S.body}>

        {/* ── 섹션 1: 유저 상태 조작 ── */}
        <Accordion title="👤 유저 상태 조작" open={open.user} onToggle={() => toggle('user')}>

          <DevBtn label="isDeceased 토글"
            result={results.deceased}
            onClick={() => run('deceased', async () => {
              const r = await apiCall('POST', '/api/dev/toggle-deceased');
              return `isDeceased = ${r.isDeceased}`;
            })}/>

          <Row2>
            <DevBtn label="+100 💎" result={null}
              onClick={() => run('gems100', async () => {
                const r = await apiCall('POST', '/api/dev/add-gems', { amount: 100 });
                return `gems = ${r.gems}`;
              })}/>
            <DevBtn label="+1000 💎" result={null}
              onClick={() => run('gems1000', async () => {
                const r = await apiCall('POST', '/api/dev/add-gems', { amount: 1000 });
                return `gems = ${r.gems}`;
              })}/>
            <DevBtn label="초기화" result={null} danger
              onClick={() => run('gems0', async () => {
                const r = await apiCall('POST', '/api/dev/add-gems', { amount: 0 });
                return `gems = ${r.gems}`;
              })}/>
          </Row2>
          {results.gems100 && <Res msg={results.gems100}/>}
          {results.gems1000 && <Res msg={results.gems1000}/>}
          {results.gems0 && <Res msg={results.gems0}/>}

          <DevBtn label="카테고리 인덱스 리셋 (오늘 새 질문)"
            result={results.category}
            onClick={() => run('category', async () => {
              const r = await apiCall('POST', '/api/dev/reset-category');
              return r.message;
            })}/>

          <DevBtn label="오늘 답변 기록 초기화"
            result={results.todayAns}
            danger
            onClick={() => requireConfirm('오늘 답변 초기화', async () => {
              run('todayAns', async () => {
                const r = await apiCall('POST', '/api/dev/clear-today-answers');
                return `${r.deleted}개 삭제됨`;
              });
            })}/>
        </Accordion>

        {/* ── 섹션 2: Doll 테스트 ── */}
        <Accordion title="🪆 Doll 테스트" open={open.doll} onToggle={() => toggle('doll')}>

          <DevBtn label="현재 Doll 컨텍스트 보기 (프롬프트)"
            result={results.context}
            onClick={async () => {
              setResult('context', '⏳ 불러오는 중...');
              try {
                const r = await apiCall('GET', '/api/dev/doll-context');
                setContextModal(r.prompt);
                setResult('context', `✅ ${r.dollName} / 기억 ${r.memoryCount}개 / 대화 ${r.chatPairsCount}쌍`);
              } catch (e) {
                setResult('context', `❌ ${e.message}`);
              }
            }}/>

          <DevBtn label="기억 추출 강제 실행"
            result={results.extract}
            onClick={() => run('extract', async () => {
              const r = await apiCall('POST', '/api/dev/force-extract');
              return `추출 ${r.extracted}개 / 저장 ${r.saved}개`;
            })}/>

          <DevBtn label="Doll 대화 기록 전체 삭제" danger
            result={results.clearChat}
            onClick={() => requireConfirm('Doll 대화 기록 전체 삭제', async () => {
              run('clearChat', async () => {
                const r = await apiCall('POST', '/api/dev/clear-doll-chats');
                return `${r.deleted}개 삭제됨`;
              });
            })}/>

          <DevBtn label="▶️ 이름 계승 애니메이션 미리보기"
            result={results.nameAnimPreview}
            onClick={() => {
              triggerNameInheritanceAnimation();
              setResult('nameAnimPreview', '▶️ 재생 중 (25초)');
            }}/>

          <DevBtn label="🔄 이름 계승 애니메이션 플래그 초기화"
            result={results.nameAnim}
            onClick={() => run('nameAnim', async () => {
              await apiCall('POST', '/api/dev/reset-name-inheritance');
              return '플래그 초기화 완료 (다음 추모 전환 시 재생됨)';
            })}/>
        </Accordion>

        {/* ── 섹션 3: AI 테스트 ── */}
        <Accordion title="🤖 AI 테스트" open={open.ai} onToggle={() => toggle('ai')}>

          <DevBtn label="Gemini 연결 테스트"
            result={results.gemini}
            onClick={async () => {
              setResult('gemini', '⏳ 연결 확인 중...');
              try {
                const r = await apiCall('POST', '/api/dev/test-gemini');
                setResult('gemini', `✅ 연결 정상 — "${r.response}"`);
              } catch (e) {
                setResult('gemini', `❌ ${e.message}`);
              }
            }}/>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={genCategory}
              onChange={(e) => setGenCategory(e.target.value)}
              style={S.select}
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button style={S.btn}
              onClick={() => run('genQ', async () => {
                const r = await apiCall('POST', '/api/dev/generate-question', { category: genCategory });
                return `"${r.question.text}" (followUp: ${r.question.followUp})`;
              })}>
              질문 즉시 생성
            </button>
          </div>
          {results.genQ && <Res msg={results.genQ}/>}

          <DevBtn label="테스트 대화 (샘플 기억 3개)"
            result={results.testChat}
            onClick={() => run('testChat', async () => {
              const r = await apiCall('POST', '/api/dev/test-chat');
              return `Doll 응답: "${r.reply}"`;
            })}/>
        </Accordion>

        {/* ── 섹션 4: 데이터 확인 ── */}
        <Accordion title="📊 데이터 확인" open={open.data} onToggle={() => toggle('data')}>
          <button style={S.btn} onClick={loadUserInfo} disabled={loadingInfo}>
            {loadingInfo ? '로딩 중...' : '새로고침'}
          </button>
          {results.info && <Res msg={results.info}/>}
          {userInfo && (
            <div style={S.infoBox}>
              {[
                ['userId',        userInfo.userId],
                ['role',          userInfo.role],
                ['gems',          userInfo.gems],
                ['categoryIndex', userInfo.categoryIndex],
                ['isDeceased',    String(userInfo.isDeceased)],
                ['gender',        userInfo.gender],
                ['answers',       `${userInfo.answersCount}개`],
                ['dollChats',     `${userInfo.dollChatsCount}개`],
                ['connections',   `${userInfo.connectionsCount}개`],
              ].map(([k, v]) => (
                <div key={k} style={S.infoRow}>
                  <span style={S.infoKey}>{k}</span>
                  <span style={S.infoVal}>{v ?? '-'}</span>
                </div>
              ))}
            </div>
          )}
        </Accordion>

        {/* ── 섹션 5: 위험 구역 ── */}
        <Accordion title="☢️ 위험 구역" open={open.danger} onToggle={() => toggle('danger')} danger>

          <DevBtn label="오늘 답변 전체 삭제" danger
            result={results.dangerAns}
            onClick={() => requireConfirm('오늘 답변 전체 삭제', async () => {
              run('dangerAns', async () => {
                const r = await apiCall('POST', '/api/dev/clear-today-answers');
                return `${r.deleted}개 삭제됨`;
              });
            })}/>

          <DevBtn label="Doll 완전 삭제 (새로 만들어야 함)" danger
            result={results.dangerDoll}
            onClick={() => requireConfirm('Doll 완전 삭제', async () => {
              run('dangerDoll', async () => {
                await apiCall('DELETE', '/api/doll/me');
                return 'Doll 삭제됨';
              });
            })}/>

          <DevBtn label="테스트 계정 전체 초기화 ☢️" danger
            result={results.nuke}
            onClick={() => requireConfirm('계정 전체 초기화', async () => {
              run('nuke', async () => {
                const r = await apiCall('POST', '/api/dev/nuke');
                return r.message;
              });
            })}/>
        </Accordion>

      </div>

      {/* ── Doll 컨텍스트 모달 ── */}
      {contextModal && (
        <div style={S.overlay} onClick={() => setContextModal('')}>
          <div style={S.promptModal} onClick={(e) => e.stopPropagation()}>
            <div style={S.promptHeader}>
              <p style={S.promptTitle}>Gemini 프롬프트</p>
              <button style={S.closeBtn} onClick={() => setContextModal('')}>✕</button>
            </div>
            <pre style={S.promptPre}>{contextModal}</pre>
          </div>
        </div>
      )}

      {/* ── 확인 팝업 ── */}
      {confirmAction && (
        <div style={S.overlay}>
          <div style={S.confirmModal}>
            <p style={S.confirmTitle}>⚠️ 정말 실행할까요?</p>
            <p style={S.confirmDesc}><strong>{confirmAction.label}</strong></p>
            <p style={S.confirmWarn}>되돌릴 수 없습니다.</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button style={S.cancelBtn} onClick={() => setConfirmAction(null)}>취소</button>
              <button style={S.confirmBtn} onClick={execConfirm}>실행</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 서브 컴포넌트 ─────────────────────────────────────────────────────────────

function Accordion({ title, open, onToggle, children, danger }) {
  return (
    <div style={{ ...S.accordion, ...(danger ? { borderColor: '#f5c6c6' } : {}) }}>
      <button style={S.accordionHeader} onClick={onToggle}>
        <span style={{ ...S.accordionTitle, ...(danger ? { color: '#c0392b' } : {}) }}>{title}</span>
        <span style={S.chevron}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={S.accordionBody}>{children}</div>}
    </div>
  );
}

function DevBtn({ label, result, onClick, danger }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <button
        style={{ ...S.btn, ...(danger ? S.btnDanger : {}) }}
        onClick={onClick}
      >
        {label}
      </button>
      {result && <Res msg={result}/>}
    </div>
  );
}

function Row2({ children }) {
  return <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>{children}</div>;
}

function Res({ msg }) {
  const isOk  = msg.startsWith('✅');
  const isErr = msg.startsWith('❌');
  return (
    <p style={{
      fontSize: 12, marginTop: 4, padding: '6px 10px', borderRadius: 8,
      backgroundColor: isOk ? '#f0fff4' : isErr ? '#fff0f0' : '#f7f3ee',
      color: isOk ? '#2d6a3f' : isErr ? '#c0392b' : '#7a6355',
      wordBreak: 'break-all', lineHeight: 1.5,
    }}>{msg}</p>
  );
}

// ── 스타일 ─────────────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: '100dvh', backgroundColor: 'var(--bg)',
    fontFamily: 'var(--font-sans)', paddingBottom: 40,
  },
  warningBanner: {
    backgroundColor: '#c0392b', color: 'white',
    padding: '10px 16px', fontSize: 13, fontWeight: 700, textAlign: 'center',
  },
  body: { padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12 },

  // 아코디언
  accordion: {
    backgroundColor: 'var(--card)', borderRadius: 14,
    border: '1px solid var(--border-light)', overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
  },
  accordionHeader: {
    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  accordionTitle: { fontSize: 14, fontWeight: 700, color: 'var(--primary)' },
  chevron: { fontSize: 11, color: 'var(--text-muted)' },
  accordionBody: { padding: '4px 14px 14px', display: 'flex', flexDirection: 'column', gap: 0 },

  // 버튼
  btn: {
    padding: '9px 14px', borderRadius: 9, border: '1px solid var(--border)',
    backgroundColor: 'var(--bg)', color: 'var(--primary)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
    flex: 1,
  },
  btnDanger: {
    borderColor: '#f5c6c6', backgroundColor: '#fff8f8', color: '#c0392b',
  },

  // select
  select: {
    flex: 1, padding: '9px 10px', borderRadius: 9, border: '1px solid var(--border)',
    backgroundColor: 'var(--bg)', color: 'var(--primary)',
    fontSize: 12, fontFamily: 'var(--font-sans)', cursor: 'pointer',
  },

  // 데이터 박스
  infoBox: {
    backgroundColor: '#1a1a2e', borderRadius: 10, padding: '12px 14px',
    marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6,
  },
  infoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  infoKey: { fontSize: 11, color: '#8888cc', fontFamily: 'monospace' },
  infoVal: { fontSize: 11, color: '#ccffcc', fontFamily: 'monospace', wordBreak: 'break-all', textAlign: 'right', maxWidth: '60%' },

  // 오버레이
  overlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 300, padding: 20,
  },

  // 프롬프트 모달
  promptModal: {
    backgroundColor: '#1a1a2e', borderRadius: 16, width: '100%', maxWidth: 480,
    maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  promptHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 16px', borderBottom: '1px solid #333',
  },
  promptTitle: { color: '#ccffcc', fontSize: 14, fontWeight: 700 },
  closeBtn: {
    background: 'none', border: 'none', color: '#888', fontSize: 18, cursor: 'pointer',
  },
  promptPre: {
    color: '#e0e0e0', fontSize: 11, lineHeight: 1.7, padding: '14px 16px',
    overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    fontFamily: 'monospace', flex: 1,
  },

  // 확인 팝업
  confirmModal: {
    backgroundColor: '#fffdf9', borderRadius: 20, padding: '28px 24px',
    width: 'calc(100% - 40px)', maxWidth: 320, textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  confirmTitle: { fontSize: 18, fontWeight: 700, color: '#c0392b', marginBottom: 10 },
  confirmDesc:  { fontSize: 14, color: 'var(--primary)', marginBottom: 6 },
  confirmWarn:  { fontSize: 12, color: 'var(--text-muted)' },
  cancelBtn: {
    flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--border)',
    backgroundColor: 'var(--bg)', color: 'var(--text-mid)', fontSize: 14,
    fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
  },
  confirmBtn: {
    flex: 1, padding: '12px', borderRadius: 10, border: 'none',
    backgroundColor: '#c0392b', color: 'white', fontSize: 14,
    fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)',
  },
};
