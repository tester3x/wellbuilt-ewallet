import React, { useState, useEffect, useCallback, useContext, createContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './en';
import es from './es';
import type { Translations } from './en';

export type Locale = 'en' | 'es';

const STORAGE_KEY = 'wbew_language';
const translations: Record<Locale, Translations> = { en, es };

type I18nContext = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nCtx = createContext<I18nContext>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
});

function resolve(obj: any, path: string): string | undefined {
  const keys = path.split('.');
  let cur = obj;
  for (const k of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[k];
  }
  return typeof cur === 'string' ? cur : undefined;
}

function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => String(params[key] ?? `{{${key}}}`));
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'en' || saved === 'es') setLocaleState(saved);
    }).catch(() => {});
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    AsyncStorage.setItem(STORAGE_KEY, newLocale).catch(() => {});
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const str = resolve(translations[locale], key)
      ?? resolve(translations.en, key)
      ?? key;
    return interpolate(str, params);
  }, [locale]);

  return React.createElement(I18nCtx.Provider, { value: { locale, setLocale, t } }, children);
}

export function useTranslation() {
  return useContext(I18nCtx);
}
