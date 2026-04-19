import React, { useEffect, useState } from "react";
import { Av, avatarUrlForHandle } from "@/components/Avatar";
import { cn } from "@/lib/utils";
import { useDigestSidebar } from "@/contexts/DigestSidebarContext";
import { useLocale } from "@/i18n";

const KOL_PREVIEW_COUNT = 4;

function xProfileUrlFromHandle(handle: string): string {
  const u = handle.replace(/^@/, "").trim();
  return `https://x.com/${encodeURIComponent(u)}`;
}

const RightPanel: React.FC = () => {
  const { t } = useLocale();
  const { snapshot } = useDigestSidebar();
  const loading = snapshot?.loading ?? false;
  const signalTotal = snapshot?.signalTotal ?? 0;
  const kolsActive = snapshot?.kolsActive ?? 0;
  const kolRows = snapshot?.topKols ?? [];
  const [kolListExpanded, setKolListExpanded] = useState(false);

  const visibleKolRows =
    kolListExpanded || kolRows.length <= KOL_PREVIEW_COUNT
      ? kolRows
      : kolRows.slice(0, KOL_PREVIEW_COUNT);

  const kolRowsSignature = kolRows.map((r) => r.handle).join("\0");
  useEffect(() => {
    setKolListExpanded(false);
  }, [kolRowsSignature]);

  return (
    <aside
      className="sticky top-0 z-20 hidden h-screen max-w-[350px] min-w-[280px] w-[28%] flex-col overflow-y-auto bg-white px-7 py-4 lg:flex"
      aria-label="Digest sidebar"
    >
      <div className="mt-2 rounded-2xl bg-[#f7f9f9] p-4">
        <h2 className="mb-3 text-[19px] font-extrabold text-[#0f1419]">{t("rightPanel.today")}</h2>
        <div className="flex gap-6">
          <div>
            <p className="text-[28px] font-extrabold leading-none text-[#0f1419]">
              {loading ? "—" : signalTotal}
            </p>
            <p className="mt-1 text-[13px] text-[#536471]">{t("rightPanel.signals")}</p>
          </div>
          <div>
            <p className="text-[28px] font-extrabold leading-none text-[#0f1419]">
              {loading ? "—" : kolsActive}
            </p>
            <p className="mt-1 text-[13px] text-[#536471]">{t("rightPanel.kolsActive")}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 mt-4 max-h-none overflow-visible rounded-2xl bg-[#f7f9f9] p-4">
        <h2 className="mb-3.5 text-[19px] font-extrabold text-[#0f1419]">{t("rightPanel.kolsInTodayDigest")}</h2>
        <div className="max-h-none space-y-0 overflow-visible">
          {loading && kolRows.length === 0 ? (
            <p className="py-2 text-[14px] text-[#536471]">{t("rightPanel.loading")}</p>
          ) : kolRows.length === 0 ? (
            <p className="py-2 text-[14px] text-[#536471]">{t("rightPanel.noKolsToday")}</p>
          ) : (
            visibleKolRows.map((row, i) => {
              const kolAvatarSrc =
                row.avatarUrl && row.avatarUrl.trim() !== ""
                  ? row.avatarUrl.trim()
                  : avatarUrlForHandle(row.handle);
              return (
              <a
                key={row.handle}
                href={xProfileUrlFromHandle(row.handle)}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex items-center gap-2.5 text-inherit no-underline transition-colors hover:bg-[#e8e8e8]",
                  i > 0 && "border-t border-[#eff3f4]",
                )}
                style={{ padding: "10px 4px" }}
              >
                <Av src={kolAvatarSrc} name={row.displayName} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold leading-tight text-[#0f1419]">{row.displayName}</p>
                  <p className="text-[13px] leading-tight text-[#536471]">{row.handle}</p>
                </div>
                <span
                  className="shrink-0 rounded-full text-[13px] text-[#1d9bf0]"
                  style={{ background: "#e8f5fd", padding: "2px 10px" }}
                >
                  {row.signalCount} {t("rightPanel.signals")}
                </span>
              </a>
              );
            })
          )}
        </div>
        {kolRows.length > KOL_PREVIEW_COUNT ? (
          <button
            type="button"
            className="mt-2 block w-full cursor-pointer border-none bg-transparent py-1 text-left text-[15px] text-[#1d9bf0] hover:underline"
            onClick={() => setKolListExpanded((v) => !v)}
          >
            {kolListExpanded ? t("rightPanel.showLess") : t("rightPanel.showMore")}
          </button>
        ) : null}
      </div>

      <footer className="mt-auto px-1 py-1 text-[13px] leading-[1.8] text-[#536471]">
        <p>{t("rightPanel.termsPrivacyAbout")}</p>
        <p>© 2026 SignalFeed</p>
      </footer>
    </aside>
  );
};

export default RightPanel;
