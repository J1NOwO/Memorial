// contexts/LanguageContext.tsx - 언어 상태 관리 (React Native)
// lang: 'ko' | 'en'
// 웹의 localStorage 대신 AsyncStorage 사용

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANG_KEY = 'memorial_lang';

type Lang = 'ko' | 'en';

interface LanguageContextType {
  lang: Lang;
  toggleLang: (newLang: Lang) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('ko');

  // 앱 시작 시 저장된 언어 불러오기
  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((saved) => {
      if (saved === 'ko' || saved === 'en') {
        setLang(saved);
      }
    });
  }, []);

  // 언어 전환 + AsyncStorage 저장
  const toggleLang = (newLang: Lang) => {
    if (newLang === lang) return;
    setLang(newLang);
    AsyncStorage.setItem(LANG_KEY, newLang);
  };

  return (
    <LanguageContext.Provider value={{ lang, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = (): LanguageContextType => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang는 LanguageProvider 안에서만 사용할 수 있어요');
  return ctx;
};
