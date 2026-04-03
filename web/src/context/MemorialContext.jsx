// MemorialContext.jsx - 추모 모드 전역 상태
// 유족: 연결된 제공자의 isDeceased === true → isMemorial 활성화
// 제공자: 자신의 isDeceased === true → DevMode 테스트용으로도 활성화

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { collection, query, where, getDocs, getDoc, getDocFromServer, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { useLang } from '../contexts/LanguageContext';
import MemorialBanner from '../components/MemorialBanner';
import StarField from '../components/StarField';
import MemorialTransition from '../components/MemorialTransition';
import NameInheritanceAnimation from '../components/NameInheritanceAnimation';

const MemorialContext = createContext(null);

export function MemorialProvider({ children }) {
  const { user, userProfile } = useAuth();
  const { lang } = useLang();
  const [isMemorial, setIsMemorial]               = useState(false);
  const [providerName, setProviderName]           = useState('');
  const [providerId, setProviderId]               = useState('');
  const [showTransition, setShowTransition]       = useState(false);
  const [showNameInheritance, setShowNameInheritance] = useState(false);
  const prevDeceased = useRef(null); // null=초기 로드 전, false/true=이전 상태

  useEffect(() => {
    if (!user || !userProfile) return;

    async function check() {
      let deceased = false;
      let name     = '';

      let pid = '';
      if (userProfile.role === 'provider') {
        deceased = userProfile.isDeceased === true;
        name     = userProfile.name || '';
        pid      = user.uid;
      } else if (userProfile.role === 'family') {
        try {
          const q    = query(
            collection(db, 'connections'),
            where('familyId', '==', user.uid),
            where('status',   '==', 'accepted'),
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            const conn  = snap.docs[0].data();
            pid = conn.providerId;
            const pSnap = await getDoc(doc(db, 'users', conn.providerId));
            if (pSnap.exists()) {
              const pd = pSnap.data();
              deceased = pd.isDeceased === true;
              name     = pd.name || '';
            }
          }
        } catch {}
      }
      setProviderId(pid);

      if (prevDeceased.current === null && deceased === true) {
        // 앱 로드 시 이미 isDeceased=true → nameInheritanceShown 확인 후 바로 애니메이션
        try {
          const snap = await getDocFromServer(doc(db, 'users', user.uid));
          if (!snap.data()?.nameInheritanceShown) {
            setShowNameInheritance(true);
          }
        } catch {}
      } else if (prevDeceased.current === false && deceased === true) {
        // 앱 실행 중 false → true 전환: MemorialTransition 먼저
        setShowTransition(true);
      }
      prevDeceased.current = deceased;

      setIsMemorial(deceased);
      setProviderName(name);
    }

    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, [user, userProfile]);

  // HTML 요소에 data-memorial 속성 → CSS 변수 전환
  useEffect(() => {
    document.documentElement.setAttribute('data-memorial', isMemorial ? 'true' : 'false');
    const root = document.getElementById('root');
    if (root) root.style.paddingTop = isMemorial ? '33px' : '0';
  }, [isMemorial]);

  // ── MemorialTransition 완료 → 이름 계승 애니메이션 여부 확인 ───────────────
  const handleTransitionDone = useCallback(async () => {
    setShowTransition(false);
    if (!user) return;
    try {
      const snap = await getDocFromServer(doc(db, 'users', user.uid));
      if (!snap.data()?.nameInheritanceShown) {
        setShowNameInheritance(true);
      }
    } catch {}
  }, [user]);

  // ── 이름 계승 애니메이션 완료 → Firestore에 기록 ──────────────────────────
  const handleNameInheritanceDone = useCallback(async () => {
    setShowNameInheritance(false);
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { nameInheritanceShown: true });
    } catch {}
  }, [user]);

  // ── DevMode에서 강제 재생용 ────────────────────────────────────────────────
  function triggerNameInheritanceAnimation() {
    setShowNameInheritance(true);
  }

  return (
    <MemorialContext.Provider value={{
      isMemorial,
      providerName,
      providerId,
      showTransition,
      setShowTransition,
      triggerNameInheritanceAnimation,
    }}>
      {isMemorial && <StarField />}
      {isMemorial && <MemorialBanner />}
      {children}
      <MemorialTransition
        visible={showTransition}
        onDone={handleTransitionDone}
        lang={lang}
      />
      <NameInheritanceAnimation
        visible={showNameInheritance}
        providerName={providerName}
        onDone={handleNameInheritanceDone}
      />
    </MemorialContext.Provider>
  );
}

export function useMemorial() {
  const ctx = useContext(MemorialContext);
  if (!ctx) throw new Error('useMemorial must be inside MemorialProvider');
  return ctx;
}
