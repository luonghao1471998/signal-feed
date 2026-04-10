import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import CategoryBadge from "@/components/CategoryBadge";
import type { CategoryKey } from "@/components/CategoryBadge";
import RankBadge from "@/components/RankBadge";
import { Av, avatarUrlForHandle } from "@/components/Avatar";
import { type DigestSignal } from "@/types/digestUi";

const CATEGORY_KEYS = new Set<string>([
  "ai-ml",
  "dev-tools",
  "indie-saas",
  "marketing",
  "startup-vc",
  "crypto",
  "finance",
  "design-product",
  "creator",
  "tech-policy",
]);

function isCategoryKey(c: CategoryKey | string): c is CategoryKey {
  return CATEGORY_KEYS.has(c);
}

function tweetUrlForHandle(handle: string): string {
  const u = handle.replace(/^@/, "");
  return `https://x.com/${u}`;
}

interface SignalBottomSheetProps {
  signal: DigestSignal | null;
  onDismiss: () => void;
  userPlan?: "free" | "pro" | "power";
}

const SignalBottomSheet: React.FC<SignalBottomSheetProps> = ({ signal, onDismiss, userPlan = "free" }) => {
  const [copied, setCopied] = useState(false);

  if (!signal) return null;

  const draft = signal.draftTweet ?? "";
  const showDraft = userPlan !== "free" && Boolean(draft);

  const handleCopy = () => {
    if (!draft) return;
    void navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col sf-slide-up-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signal-sheet-title"
    >
      <div className="min-h-0 flex-1 bg-black/20" onClick={onDismiss} aria-hidden />

      <div className="flex max-h-[90vh] flex-col rounded-t-2xl bg-white shadow-xl">
        <div className="flex shrink-0 justify-center pb-2 pt-3">
          <div className="h-1 w-10 rounded-full bg-[#cfd9de]" />
        </div>

        <div className="overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-start gap-3 py-3">
            <RankBadge score={signal.rankScore} rank={signal.rank} />
            <h2 id="signal-sheet-title" className="min-w-0 flex-1 text-lg font-bold text-[#0f1419]">
              {signal.title}
            </h2>
          </div>

          <div className="mb-3 flex flex-wrap gap-1">
            {signal.categories.map((cat, idx) =>
              isCategoryKey(cat) ? (
                <CategoryBadge key={`${cat}-${idx}`} category={cat} />
              ) : (
                <span
                  key={`${cat}-${idx}`}
                  className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                >
                  {cat}
                </span>
              ),
            )}
            {signal.tags.map((tag) => (
              <span key={tag} className="text-xs text-[#536471]">
                {tag.startsWith("#") ? tag : `#${tag}`}
              </span>
            ))}
          </div>

          <p className="mb-4 text-[15px] leading-relaxed text-[#536471]">{signal.summary}</p>

          <div className="mb-4 border-t border-[#eff3f4] pt-3">
            <p className="mb-2 text-xs font-medium text-[#536471]">{signal.kolCount} KOLs mentioned this</p>
            {signal.sources?.map((source) => (
              <div
                key={source.handle}
                className="flex items-start gap-2 border-b border-[#eff3f4] py-2 last:border-b-0"
              >
                <Av src={avatarUrlForHandle(source.handle)} name={source.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#0f1419]">
                    {source.name}{" "}
                    <span className="font-normal text-[#536471]">
                      {source.handle} · {source.category} · {source.timeAgo}
                    </span>
                  </p>
                  <p className="truncate text-sm text-[#536471]">{source.tweetPreview ?? ""}</p>
                </div>
                <a
                  href={source.tweetUrl || tweetUrlForHandle(source.handle)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 shrink-0 text-xs text-[#1d9bf0]"
                >
                  View ↗
                </a>
              </div>
            ))}
            <button type="button" className="mt-2 text-sm text-[#1d9bf0]">
              View all {signal.kolCount} sources →
            </button>
          </div>

          {showDraft ? (
            <div className="mb-4 rounded-xl border border-[#cde5f9] bg-[#eef6fd] p-3">
              <p className="mb-2 text-xs font-medium text-[#536471]">✏️ Draft tweet</p>
              <p className="text-[14px] leading-relaxed text-[#0f1419]">{draft}</p>
              <p className="mt-2 text-right text-xs text-[#536471]">{draft.length}/280</p>
              <button
                type="button"
                onClick={handleCopy}
                className="mt-3 w-full rounded-full border border-[#cfd9de] bg-white py-2.5 text-sm font-medium text-[#0f1419]"
              >
                {copied ? (
                  <span className="inline-flex items-center justify-center gap-1">
                    <Check className="h-4 w-4 text-emerald-600" />
                    Copied
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center gap-1">
                    <Copy className="h-4 w-4" />
                    📋 Copy draft
                  </span>
                )}
              </button>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(draft)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block w-full rounded-full bg-[#0f1419] py-2.5 text-center text-sm font-medium text-white"
              >
                Open in Twitter ↗
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default SignalBottomSheet;
