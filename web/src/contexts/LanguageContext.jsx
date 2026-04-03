// contexts/LanguageContext.jsx - 언어 상태 관리
// lang: 'ko' | 'en'
// fading: 언어 전환 시 fade 애니메이션용 상태

import { createContext, useContext, useState } from 'react';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('memorial_lang') || 'ko';
  });
  // 언어 전환 시 fade out → 변경 → fade in
  const [fading, setFading] = useState(false);

  const toggleLang = (newLang) => {
    if (newLang === lang) return;
    setFading(true);
    setTimeout(() => {
      setLang(newLang);
      localStorage.setItem('memorial_lang', newLang);
      setTimeout(() => setFading(false), 50);
    }, 150);
  };

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, fading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
