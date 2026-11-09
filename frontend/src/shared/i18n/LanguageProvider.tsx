import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import th from "../../../i18n/th.json";
import lo from "../../../i18n/lo.json";
import en from "../../../i18n/en.json";
import ko from "../../../i18n/ko.json";
import vi from "../../../i18n/vi.json";
import zh from "../../../i18n/zh.json";

export type Locale = "th" | "lo" | "en" | "ko" | "vi" | "zh";
const dictionaries: Record<Locale, Record<string, string>> = { th, lo, en, ko, vi, zh };
const STORAGE_KEY = "qrmenu.locale";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readLocale());
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
      localStorage.setItem("shopqr-language", next);
    } catch { /* Language still changes for this session if storage is unavailable. */ }
  }, []);
  const t = useCallback((key: string, values?: Record<string, string | number>) => {
    let value = dictionaries[locale][key] ?? dictionaries.th[key] ?? key;
    if (values) value = value.replace(/\{(\w+)\}/g, (match: string, name: string) => name in values ? String(values[name]) : match);
    return value;
  }, [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const receiveLegacyLocale = (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin || !event.data || typeof event.data !== "object") return;
      const message = event.data as { type?: unknown; locale?: unknown };
      if (message.type !== "shopqr:locale-changed") return;
      if (isLocale(message.locale)) setLocale(message.locale);
    };
    window.addEventListener("message", receiveLegacyLocale);
    return () => window.removeEventListener("message", receiveLegacyLocale);
  }, [setLocale]);

  const context = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <LanguageContext.Provider value={context}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}

function readLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem("shopqr-language");
    if (isLocale(saved)) return saved;
  } catch { /* Use Thai when browser storage is unavailable. */ }
  return "th";
}

function isLocale(value: unknown): value is Locale {
  return value === "th" || value === "lo" || value === "en" || value === "ko" || value === "vi" || value === "zh";
}
