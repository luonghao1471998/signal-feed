import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import en from "./en";
import vi from "./vi";

export type Locale = "en" | "vi";
type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = {
  en,
  vi,
};

interface LocaleContextType {
  locale: Locale;
  t: (key: string) => string;
  setLocale: (nextLocale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextType | null>(null);

function resolveInitialLocale(): Locale {
  if (typeof window === "undefined") {
    return "en";
  }

  const stored = window.localStorage.getItem("locale");
  if (stored === "en" || stored === "vi") {
    return stored;
  }

  return "en";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [locale, setLocaleState] = useState<Locale>(resolveInitialLocale);
  const forceEnglishRoutes = useMemo(
    () => new Set(["/login", "/onboarding", "/onboarding/follow", "/onboarding/follow-kols"]),
    [],
  );
  const effectiveLocale: Locale = forceEnglishRoutes.has(location.pathname) ? "en" : locale;

  const t = useCallback(
    (key: string): string => {
      const parts = key.split(".");
      let value: unknown = dictionaries[effectiveLocale];

      for (const part of parts) {
        if (value && typeof value === "object" && part in (value as Record<string, unknown>)) {
          value = (value as Record<string, unknown>)[part];
        } else {
          return key;
        }
      }

      return typeof value === "string" ? value : key;
    },
    [effectiveLocale],
  );

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("locale", nextLocale);
    }
  }, []);

  const value = useMemo(
    () => ({
      locale,
      t,
      setLocale,
    }),
    [locale, t, setLocale],
  );

  return React.createElement(LocaleContext.Provider, { value }, children);
}

export function useLocale(): LocaleContextType {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}
