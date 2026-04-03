// hooks/useT.ts - 번역 훅 (React Native)
// 사용법: const t = useT();  →  t.login, t.today_count(3) 등
import { useLang } from '../contexts/LanguageContext';
import ko from '../locales/ko';
import en from '../locales/en';

export function useT() {
  const { lang } = useLang();
  return lang === 'ko' ? ko : en;
}
