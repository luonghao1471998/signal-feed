import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fetchSignalDetail } from "@/services/signalService";
import { SourceAttribution } from "@/components/SourceAttribution";
import RankBadge from "@/components/RankBadge";
import CategoryBadge from "@/components/CategoryBadge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Signal } from "@/types/signal";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { apiSlugToCategoryKey } from "@/lib/categorySlugMap";

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

  const isMobile = useMediaQuery("(max-width: 767px)");

  useEffect(() => {
    if (!signalId || !isOpen) {
      setSignal(null);
      setError(null);
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
              <button
                type="button"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                onClick={() => {
                  alert("Copy to X feature coming in Task 1.12.3");
                }}
              >
                Copy to X
              </button>
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
