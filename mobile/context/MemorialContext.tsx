// context/MemorialContext.tsx - 추모 모드 전역 상태 (React Native)
// 유족: 연결된 제공자의 isDeceased === true → isMemorial 활성화
// 제공자: 자신의 isDeceased === true → isMemorial 활성화
//
// 웹과 차이점:
// - DOM/CSS 조작 없음 (StarField, MemorialBanner 등 UI는 각 화면/레이아웃에서 처리)
// - Transition/NameInheritance 상태만 관리 (실제 애니메이션은 컴포넌트에서)

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from './AuthContext';

interface MemorialContextType {
  isMemorial: boolean;
  providerName: string;
  providerId: string;
  showTransition: boolean;
  setShowTransition: (v: boolean) => void;
  showNameInheritance: boolean;
  handleTransitionDone: () => Promise<void>;
  handleNameInheritanceDone: () => Promise<void>;
  triggerNameInheritanceAnimation: () => void;
}

const MemorialContext = createContext<MemorialContextType | null>(null);

export function MemorialProvider({ children }: { children: React.ReactNode }) {
  const { user, userProfile } = useAuth();
  const [isMemorial, setIsMemorial]                   = useState(false);
  const [providerName, setProviderName]               = useState('');
  const [providerId, setProviderId]                   = useState('');
  const [showTransition, setShowTransition]           = useState(false);
  const [showNameInheritance, setShowNameInheritance] = useState(false);
  const prevDeceased = useRef<boolean | null>(null);

  useEffect(() => {
    if (!user || !userProfile) return;

    async function check() {
      let deceased = false;
      let name     = '';
      let pid      = '';

      if (userProfile!.role === 'provider') {
        deceased = userProfile!.isDeceased === true;
        name     = userProfile!.name || '';
        pid      = user!.uid;
      } else if (userProfile!.role === 'family') {
        try {
          const snap = await firestore()
            .collection('connections')
            .where('familyId', '==', user!.uid)
            .where('status', '==', 'accepted')
            .get();

          if (!snap.empty) {
            const conn  = snap.docs[0].data();
            pid = conn.providerId;
            const pSnap = await firestore().collection('users').doc(conn.providerId).get();
            if (pSnap.exists) {
              const pd = pSnap.data()!;
              deceased = pd.isDeceased === true;
              name     = pd.name || '';
            }
          }
        } catch {}
      }

      setProviderId(pid);

      if (prevDeceased.current === null && deceased === true) {
        // 앱 로드 시 이미 사후 상태 → 이름 계승 애니메이션 표시 여부 확인
        try {
          const snap = await firestore()
            .collection('users')
            .doc(user!.uid)
            .get({ source: 'server' });
          if (!snap.data()?.nameInheritanceShown) setShowNameInheritance(true);
        } catch {}
      } else if (prevDeceased.current === false && deceased === true) {
        // 실행 중 false → true 전환: 전환 애니메이션 먼저
        setShowTransition(true);
      }

      prevDeceased.current = deceased;
      setIsMemorial(deceased);
      setProviderName(name);
    }

    check();
    // 15초마다 폴링
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, [user, userProfile]);

  // 전환 애니메이션 완료 → 이름 계승 애니메이션 여부 확인
  const handleTransitionDone = useCallback(async () => {
    setShowTransition(false);
    if (!user) return;
    try {
      const snap = await firestore()
        .collection('users')
        .doc(user.uid)
        .get({ source: 'server' });
      if (!snap.data()?.nameInheritanceShown) setShowNameInheritance(true);
    } catch {}
  }, [user]);

  // 이름 계승 애니메이션 완료 → Firestore에 기록
  const handleNameInheritanceDone = useCallback(async () => {
    setShowNameInheritance(false);
    if (!user) return;
    try {
      await firestore()
        .collection('users')
        .doc(user.uid)
        .update({ nameInheritanceShown: true });
    } catch {}
  }, [user]);

  // DevMode에서 강제 재생용
  function triggerNameInheritanceAnimation() {
    setShowNameInheritance(true);
  }

  return (
    <MemorialContext.Provider value={{
      isMemorial, providerName, providerId,
      showTransition, setShowTransition,
      showNameInheritance,
      handleTransitionDone, handleNameInheritanceDone,
      triggerNameInheritanceAnimation,
    }}>
      {children}
    </MemorialContext.Provider>
  );
}

export function useMemorial(): MemorialContextType {
  const ctx = useContext(MemorialContext);
  if (!ctx) throw new Error('useMemorial must be inside MemorialProvider');
  return ctx;
}
