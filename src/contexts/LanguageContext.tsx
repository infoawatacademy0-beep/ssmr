import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { TRANSLATIONS, type Language } from '../i18n/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'ku',
  setLanguage: () => {},
  t: (key, fallback) => fallback || key,
  isRTL: true,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('ssmr_language') as Language;
    return saved === 'en' ? 'en' : 'ku'; // Default: Kurdish (سەرەکی: کوردی)
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('ssmr_language', lang);
    applyHtmlAttributes(lang);
    window.dispatchEvent(new Event('ssmr-language-changed'));
  };

  const applyHtmlAttributes = (lang: Language) => {
    const isKu = lang === 'ku';
    document.documentElement.lang = isKu ? 'ckb' : 'en';
    document.documentElement.dir = isKu ? 'rtl' : 'ltr';
  };

  useEffect(() => {
    applyHtmlAttributes(language);
  }, [language]);

  const t = (key: string, fallback?: string): string => {
    return TRANSLATIONS[language]?.[key] ?? fallback ?? key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        isRTL: language === 'ku',
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
