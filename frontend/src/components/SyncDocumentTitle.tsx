import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const BRAND = "SignalFeed";

function pageTitle(pathname: string): string {
  if (pathname === "/" || pathname === "") return BRAND;
  if (pathname === "/login") return `${BRAND} Login`;
  if (pathname === "/onboarding/follow") return `${BRAND} Follow`;
  if (pathname === "/onboarding") return `${BRAND} Onboarding`;
  if (pathname.startsWith("/digest")) return `${BRAND} Digest`;
  if (pathname.startsWith("/my-kols")) return `${BRAND} My KOLs`;
  if (pathname.startsWith("/archive")) return `${BRAND} Archive`;
  if (pathname.startsWith("/settings")) return `${BRAND} Settings`;
  return `${BRAND} Page not found`;
}

/** Cập nhật tiêu đề tab trình duyệt theo route. */
export function SyncDocumentTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = pageTitle(pathname);
  }, [pathname]);

  return null;
}
