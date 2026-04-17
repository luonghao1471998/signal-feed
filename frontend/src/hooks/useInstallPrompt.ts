import { useCallback, useEffect, useState } from "react";
import { useIsPWA } from "./useIsPWA";

const DISMISS_KEY = "sf-install-banner-dismissed";

type BeforeInstallPromptEventLike = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function useInstallPrompt() {
  const isPWA = useIsPWA();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEventLike | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  });

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEventLike);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const dismiss = useCallback(() => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }, []);

  const install = useCallback(async () => {
    if (!deferred?.prompt) return;
    await deferred.prompt();
    setDeferred(null);
  }, [deferred]);

  const shouldShow = Boolean(deferred) && !dismissed && !isPWA;

  return { shouldShow, install, dismiss };
}
