import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { TRANSLATIONS, KURDISH_TO_ENGLISH_MAP, type Language } from '../i18n/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (keyOrText: string, fallback?: string) => string;
  tr: (kuText: string, enText: string) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'ku',
  setLanguage: () => {},
  t: (keyOrText, fallback) => fallback || keyOrText,
  tr: (kuText, enText) => kuText,
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

  /**
   * Universal translation helper:
   * Works with both keys ('nav.dashboard') and direct Kurdish phrases ('سەرەکی').
   */
  const t = (keyOrText: string, fallback?: string): string => {
    if (language === 'ku') {
      return TRANSLATIONS.ku[keyOrText] ?? fallback ?? keyOrText;
    } else {
      // English mode: check key mapping first, then Kurdish-to-English dictionary
      return (
        TRANSLATIONS.en[keyOrText] ??
        KURDISH_TO_ENGLISH_MAP[keyOrText] ??
        fallback ??
        keyOrText
      );
    }
  };

  /**
   * Inline dual-language helper:
   * Returns kuText when Kurdish, enText when English.
   */
  const tr = (kuText: string, enText: string): string => {
    return language === 'en' ? enText : kuText;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        tr,
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
