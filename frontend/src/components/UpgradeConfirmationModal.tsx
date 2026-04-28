import React, { useEffect, useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useLocale } from "@/i18n";
import {
  fetchUpgradePreview,
  startBillingCheckout,
  type UpgradePreview,
} from "@/services/billingService";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Gọi sau khi upgrade thành công (kind: "upgraded") — không dùng redirect. */
  onUpgraded?: () => void;
}

function formatAmount(amount: number, currency: string): string {
  const code = currency.toUpperCase();
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `$${formatted} ${code}`;
}

function formatDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function UpgradeConfirmationModal({ open, onClose, onUpgraded }: Props) {
  const { t, locale } = useLocale();

  const [preview, setPreview] = useState<UpgradePreview | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function load() {
      setLoadingPreview(true);
      setFetchError(null);
      setPreview(null);
      setHowItWorksOpen(false);

      try {
        const data = await fetchUpgradePreview("power");
        if (!cancelled) {
          setPreview(data);
        }
      } catch (e) {
        if (!cancelled) {
          setFetchError(e instanceof Error ? e.message : t("common.error"));
        }
      } finally {
        if (!cancelled) {
          setLoadingPreview(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [open, t]);

  async function handleConfirm() {
    if (confirming || !preview) return;
    setConfirming(true);
    try {
      const result = await startBillingCheckout("power");
      if (result.kind === "redirect") {
        window.location.href = result.checkoutUrl;
        return;
      }
      if (result.kind === "upgraded") {
        onClose();
        onUpgraded?.();
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : t("common.error"));
      setConfirming(false);
    }
  }

  const amountLabel =
    preview !== null
      ? formatAmount(preview.amount_due, preview.currency)
      : null;

  const periodEnd = preview?.billing_period.end
    ? formatDate(preview.billing_period.end, locale)
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-indigo-600" aria-hidden />
            {t("settings.upgradeModalTitle")}
          </DialogTitle>
        </DialogHeader>

        {/* Loading */}
        {loadingPreview && (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-500">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-500" aria-hidden />
            <p className="text-sm">{t("settings.upgradeModalCalculating")}</p>
          </div>
        )}

        {/* Error */}
        {!loadingPreview && fetchError && (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-sm font-medium text-amber-900">
                  {t("settings.upgradeModalError")}
                </p>
                <p className="text-xs text-amber-700 mt-1">{fetchError}</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("settings.upgradeModalCancel")}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setFetchError(null);
                  setLoadingPreview(true);
                  fetchUpgradePreview("power")
                    .then((data) => { setPreview(data); })
                    .catch((e: unknown) => {
                      setFetchError(e instanceof Error ? e.message : t("common.error"));
                    })
                    .finally(() => { setLoadingPreview(false); });
                }}
              >
                {t("settings.upgradeModalRetry")}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Preview loaded */}
        {!loadingPreview && !fetchError && preview && (
          <div className="space-y-4">
            {/* Charged today label */}
            <p className="text-sm text-slate-600">{t("settings.upgradeModalChargedToday")}</p>

            {/* Breakdown box */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              {preview.line_items.map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start justify-between gap-3 px-4 py-3 text-sm",
                    idx < preview.line_items.length - 1 && "border-b border-slate-100",
                  )}
                >
                  <span className="text-slate-700 flex-1 leading-snug">{item.description}</span>
                  <span
                    className={cn(
                      "font-medium tabular-nums shrink-0",
                      item.type === "credit" ? "text-emerald-600" : "text-slate-900",
                    )}
                  >
                    {item.type === "credit" ? "−" : "+"}
                    {formatAmount(Math.abs(item.amount), preview.currency)}
                  </span>
                </div>
              ))}

              {/* Total row */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-t border-slate-200">
                <span className="text-sm font-semibold text-slate-900">
                  {t("settings.upgradeModalTotalDue")}
                </span>
                <span className="text-lg font-bold text-indigo-700 tabular-nums">
                  {amountLabel}
                </span>
              </div>
            </div>

            {/* How proration works — collapsible */}
            <div className="rounded-xl border border-slate-100 bg-slate-50">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
                onClick={() => setHowItWorksOpen((v) => !v)}
                aria-expanded={howItWorksOpen}
              >
                <span className="flex items-center gap-2">
                  <span className="text-base" aria-hidden>ℹ️</span>
                  {t("settings.upgradeModalHowItWorks")}
                </span>
                {howItWorksOpen ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" aria-hidden />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />
                )}
              </button>

              {howItWorksOpen && (
                <ul className="px-4 pb-4 space-y-1.5 text-xs text-slate-600 list-none">
                  <li className="flex gap-2">
                    <span className="text-slate-400 shrink-0">•</span>
                    {t("settings.upgradeModalExplainCredit")}
                  </li>
                  <li className="flex gap-2">
                    <span className="text-slate-400 shrink-0">•</span>
                    {t("settings.upgradeModalExplainCharge")}
                  </li>
                  {periodEnd && (
                    <li className="flex gap-2">
                      <span className="text-slate-400 shrink-0">•</span>
                      {t("settings.upgradeModalExplainDate").replace("{date}", periodEnd)}
                    </li>
                  )}
                </ul>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={confirming}
              >
                {t("settings.upgradeModalCancel")}
              </Button>
              <Button
                type="button"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => void handleConfirm()}
                disabled={confirming}
              >
                {confirming ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    {t("settings.billingProcessing")}
                  </span>
                ) : (
                  t("settings.upgradeModalConfirm").replace("{amount}", amountLabel ?? "")
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
