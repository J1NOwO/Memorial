// MemorialContext.tsx - 추모 모드 전역 상태 (React Native)
// 유족: 연결된 제공자의 isDeceased === true → isMemorial 활성화
// 제공자: 자신의 isDeceased === true → isMemorial 활성화
//
// 웹과 차이점:
// - DOM/CSS 조작 없음 (StarField, MemorialBanner 등은 각 화면에서 직접 처리)
// - MemorialTransition, NameInheritanceAnimation 상태만 관리 (UI는 별도 컴포넌트)

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from './AuthContext';

interface MemorialContextType {
  isMemorial: boolean;
  providerName: string;
  providerId: string;
  showTransition: boolean;        // 사후 전환 애니메이션 표시 여부
  setShowTransition: (v: boolean) => void;
  showNameInheritance: boolean;   // 이름 계승 애니메이션 표시 여부
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
  const prevDeceased = useRef<boolean | null>(null); // null=초기 로드 전, false/true=이전 상태

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
          // 연결된 제공자 조회
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
        // 앱 로드 시 이미 isDeceased=true → nameInheritanceShown 확인
        try {
          const snap = await firestore()
            .collection('users')
            .doc(user!.uid)
            .get({ source: 'server' });
          if (!snap.data()?.nameInheritanceShown) {
            setShowNameInheritance(true);
          }
        } catch {}
      } else if (prevDeceased.current === false && deceased === true) {
        // 앱 실행 중 false → true 전환: Transition 먼저
        setShowTransition(true);
      }

      prevDeceased.current = deceased;
      setIsMemorial(deceased);
      setProviderName(name);
    }

    check();
    // 15초마다 폴링 (실시간 감지)
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, [user, userProfile]);

  // ── Transition 완료 → 이름 계승 애니메이션 여부 확인 ────────────────────
  const handleTransitionDone = useCallback(async () => {
    setShowTransition(false);
    if (!user) return;
    try {
      const snap = await firestore()
        .collection('users')
        .doc(user.uid)
        .get({ source: 'server' });
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
    <MemorialContext.Provider
      value={{
        isMemorial,
        providerName,
        providerId,
        showTransition,
        setShowTransition,
        showNameInheritance,
        handleTransitionDone,
        handleNameInheritanceDone,
        triggerNameInheritanceAnimation,
      }}
    >
      {children}
    </MemorialContext.Provider>
  );
}

export function useMemorial(): MemorialContextType {
  const ctx = useContext(MemorialContext);
  if (!ctx) throw new Error('useMemorial must be inside MemorialProvider');
  return ctx;
}
