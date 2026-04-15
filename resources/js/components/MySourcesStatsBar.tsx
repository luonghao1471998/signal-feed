import React from "react";
import { useLocale } from "@/i18n";

export interface MySourcesStatsBarProps {
  /** Tổng signal (meta.total) hoặc số card sau filter client */
  signalCount: number;
  /** Tối đa 3 handle nổi bật (theo số signal trên trang hiện tại) */
  topHandles: string[];
  loading?: boolean;
}

const MySourcesStatsBar: React.FC<MySourcesStatsBarProps> = ({
  signalCount,
  topHandles,
  loading = false,
}) => {
  const { t } = useLocale();
  const topLine =
    topHandles.length > 0
      ? `${t("myKols.topActiveSources")}: ${topHandles.slice(0, 3).join(" · ")}`
      : t("rightPanel.noKolsToday");

  return (
    <div className="my-2 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
      <span aria-hidden>📡</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-emerald-800">
          {loading ? (
            t("myKols.loadingSources")
          ) : (
            <>
              {signalCount} {t("myKols.signalsUnit")} {t("digest.today").toLowerCase()} ({t("nav.myKols")})
            </>
          )}
        </p>
        <p className="mt-0.5 text-[13px] text-emerald-700">{loading ? "—" : topLine}</p>
        <p className="mt-1 text-[12px] text-emerald-600/90">
          {t("myKols.fromFollowedKols")}
        </p>
      </div>
    </div>
  );
};

export default MySourcesStatsBar;
