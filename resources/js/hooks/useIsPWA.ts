import { useEffect, useState } from "react";

function getStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)");
  if (mq.matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

export function useIsPWA(): boolean {
  const [isPWA, setIsPWA] = useState(getStandalone);

  useEffect(() => {
    setIsPWA(getStandalone());
    const mq = window.matchMedia("(display-mode: standalone)");
    const onChange = () => setIsPWA(getStandalone());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isPWA;
}
