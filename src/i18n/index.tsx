import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import en from "./locales/en";
import ru from "./locales/ru";
import fr from "./locales/fr";
import de from "./locales/de";
import zh from "./locales/zh";

export type Lang = "en" | "ru" | "fr" | "de" | "zh";

export const LANGUAGES: { code: Lang; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "ru", label: "Russian", native: "Русский" },
  { code: "fr", label: "French", native: "Français" },
  { code: "de", label: "German", native: "Deutsch" },
  { code: "zh", label: "Chinese (Simplified)", native: "中文" },
];

const DICTIONARIES: Record<Lang, Record<string, string>> = {
  en,
  ru,
  fr,
  de,
  zh,
};

type Vars = Record<string, string | number>;

function format(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : `{${k}}`,
  );
}

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Vars) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function detectSystemLang(): Lang {
  if (typeof navigator === "undefined") return "en";
  const raw = (navigator.language || "en").toLowerCase();
  if (raw.startsWith("ru")) return "ru";
  if (raw.startsWith("fr")) return "fr";
  if (raw.startsWith("de")) return "de";
  if (raw.startsWith("zh")) return "zh";
  return "en";
}

const STORAGE_KEY = "mailmind.lang";

interface ProviderProps {
  initialLang?: Lang;
  onLangChange?: (lang: Lang) => void;
  children: ReactNode;
}

export function I18nProvider({ initialLang, onLangChange, children }: ProviderProps) {
  const [lang, setLangState] = useState<Lang>(() => {
    // 1. Explicit prop wins (set by App once it has loaded settings).
    if (initialLang) return initialLang;
    // 2. Try localStorage so the choice survives a Tauri reload.
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (saved && DICTIONARIES[saved]) return saved;
    } catch {}
    // 3. Fall back to OS locale.
    return detectSystemLang();
  });

  // If the parent later supplies a new initialLang (e.g. settings finish loading), adopt it.
  useEffect(() => {
    if (initialLang && initialLang !== lang) {
      setLangState(initialLang);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLang]);

  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {}
      onLangChange?.(next);
    },
    [onLangChange],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => {
        const dict = DICTIONARIES[lang] || DICTIONARIES.en;
        const template = dict[key] ?? DICTIONARIES.en[key] ?? key;
        return format(template, vars);
      },
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used inside <I18nProvider>");
  }
  return ctx;
}

export function useT() {
  return useI18n().t;
}
