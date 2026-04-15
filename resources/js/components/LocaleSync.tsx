import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/i18n";
import { fetchSettings } from "@/services/settingsService";

export function LocaleSync() {
  const { user, authReady } = useAuth();
  const { locale, setLocale } = useLocale();

  useEffect(() => {
    if (!authReady || !user) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const settings = await fetchSettings();
        const apiLocale = settings.preferences?.locale;
        if (cancelled) {
          return;
        }
        if ((apiLocale === "en" || apiLocale === "vi") && apiLocale !== locale) {
          setLocale(apiLocale);
        }
      } catch {
        // Keep current locale if settings call fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, user, locale, setLocale]);

  return null;
}
