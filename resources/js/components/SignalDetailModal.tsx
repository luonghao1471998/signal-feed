import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { copyDraft, fetchSignalDetail } from "@/services/signalService";
import { SourceAttribution } from "@/components/SourceAttribution";
import RankBadge from "@/components/RankBadge";
import CategoryBadge from "@/components/CategoryBadge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Signal } from "@/types/signal";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { apiSlugToCategoryKey } from "@/lib/categorySlugMap";
import { toast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const X_CLIENT_MODE_KEY = "signalfeed_x_client_mode";

type XContentMode = "browser_tab" | "x_desktop_app";

function readXContentMode(): XContentMode {
  if (typeof window === "undefined") {
    return "browser_tab";
  }
  return window.localStorage.getItem(X_CLIENT_MODE_KEY) === "x_desktop_app"
    ? "x_desktop_app"
    : "browser_tab";
}

/** Mở Web Intent (X) — thẻ <a> + chỉ noopener (tránh edge case với noreferrer + intent). */
function openIntentUrlInNewTab(url: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

interface SignalDetailModalProps {
  signalId: number | null;
  listRank: number | null;
  isOpen: boolean;
  onClose: () => void;
  userPlan: "free" | "pro" | "power";
}

export function SignalDetailModal({
  signalId,
  listRank,
  isOpen,
  onClose,
  userPlan,
}: SignalDetailModalProps) {
  const [signal, setSignal] = useState<Signal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [xClientMode, setXClientMode] = useState<XContentMode>(readXContentMode);

  const isMobile = useMediaQuery("(max-width: 767px)");

  const handleXContentModeChange = (value: string) => {
    const next: XContentMode = value === "x_desktop_app" ? "x_desktop_app" : "browser_tab";
    setXClientMode(next);
    try {
      window.localStorage.setItem(X_CLIENT_MODE_KEY, next);
    } catch {
      /* ignore quota / private mode */
    }
  };

  const handleCopyDraft = async () => {
    if (!signal?.id || copyLoading) {
      return;
    }

    try {
      setCopyLoading(true);
      setCopyError(null);

      const result = await copyDraft(signal.id);

      const draftPlain = signal.draft_tweets[0]?.text ?? "";
      if (draftPlain && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(draftPlain);
        } catch {
          /* clipboard có thể bị chặn */
        }
      }

      if (xClientMode === "browser_tab") {
        openIntentUrlInNewTab(result.twitter_intent_url);
        toast({
          title: "Draft copied",
          description:
            "A new tab opens X with the draft pre-filled. Paste (⌘V / Ctrl+V) if the box is empty.",
        });
      } else {
        toast({
          title: "Draft copied",
          description:
            "Open the X desktop app or x.com, start a post, and paste (⌘V or Ctrl+V). No link is opened so the empty-composer issue in the installed app is avoided.",
        });
      }
    } catch (err) {
      const status =
        typeof err === "object" &&
          err !== null &&
          "status" in err &&
          typeof (err as { status: unknown }).status === "number"
          ? (err as { status: number }).status
          : undefined;

      let errorMessage = "Failed to copy draft. Please try again.";
      if (status === 403) {
        errorMessage = "Upgrade to Pro to use draft feature";
      } else if (status === 404) {
        errorMessage = "Draft not available for this signal";
      } else if (err instanceof Error && err.message) {
        errorMessage = err.message;
      }

      setCopyError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setCopyLoading(false);
    }
  };

  useEffect(() => {
    if (!signalId || !isOpen) {
      setSignal(null);
      setError(null);
      setCopyError(null);
      setCopyLoading(false);
      return;
    }

    const loadDetail = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchSignalDetail(signalId);
        setSignal(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load signal");
      } finally {
        setLoading(false);
      }
    };

    void loadDetail();
  }, [signalId, isOpen]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const titleRow = (
    <div className="flex items-start gap-2">
      {signal && listRank != null ? (
        <RankBadge score={signal.rank_score} rank={listRank} />
      ) : null}
      <span className="flex-1 text-left text-lg font-semibold leading-snug">
        {loading ? "Loading…" : error && !signal ? "Error" : (signal?.title ?? "")}
      </span>
    </div>
  );

  const body = (
    <>
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {error ? (
        <div className="py-8 text-center">
          <p className="text-red-600">{error}</p>
        </div>
      ) : null}

      {signal && !loading ? (
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 font-semibold">Summary</h3>
            <p className="leading-relaxed text-gray-700">{signal.summary}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {signal.categories.map((cat) => {
              const key = apiSlugToCategoryKey(cat.slug);
              return key ? (
                <CategoryBadge key={cat.id} category={key} />
              ) : (
                <span
                  key={cat.id}
                  className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                >
                  {cat.name}
                </span>
              );
            })}
            {signal.topic_tags.map((tag) => (
              <Badge key={tag} variant="outline">
                #{tag}
              </Badge>
            ))}
          </div>

          <div>
            <h3 className="mb-4 font-semibold">
              Sources ({signal.source_count})
            </h3>
            <div>
              {signal.sources.map((source, idx) => (
                <SourceAttribution key={`${source.handle}-${idx}`} source={source} />
              ))}
            </div>
          </div>

          {userPlan !== "free" && signal.draft_tweets.length > 0 ? (
            <div className="rounded-lg bg-blue-50 p-4">
              <h3 className="mb-2 font-semibold">Ready to Share</h3>
              <p className="mb-3 text-sm text-gray-700">{signal.draft_tweets[0].text}</p>
              <div className="mb-4 space-y-2">
                <p className="text-xs font-medium text-slate-800">How do you use X?</p>
                <RadioGroup
                  value={xClientMode}
                  onValueChange={handleXContentModeChange}
                  className="grid gap-3"
                >
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="browser_tab" id="signalfeed-x-browser" className="mt-0.5" />
                    <Label htmlFor="signalfeed-x-browser" className="cursor-pointer text-sm font-normal leading-snug">
                      <span className="font-medium text-slate-900">Chrome / browser tab</span>
                      <span className="block text-slate-600">
                        Opens X in a new tab with the draft pre-filled (recommended).
                      </span>
                    </Label>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="x_desktop_app" id="signalfeed-x-pwa" className="mt-0.5" />
                    <Label htmlFor="signalfeed-x-pwa" className="cursor-pointer text-sm font-normal leading-snug">
                      <span className="font-medium text-slate-900">X desktop app</span>
                      <span className="block text-slate-600">
                        Installed from Chrome — we only copy the draft; open X and paste yourself.
                      </span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              {copyError ? (
                <p className="mb-2 text-sm text-red-600" role="alert">
                  {copyError}
                </p>
              ) : null}
              <Button
                type="button"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={copyLoading}
                onClick={() => {
                  void handleCopyDraft();
                }}
              >
                {copyLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    {xClientMode === "browser_tab" ? "Opening…" : "Copying…"}
                  </>
                ) : (
                  "Copy to X"
                )}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="mb-4 text-left">
            <SheetTitle className="text-left">{titleRow}</SheetTitle>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader className="mb-4 text-left">
          <DialogTitle className="text-left">{titleRow}</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}