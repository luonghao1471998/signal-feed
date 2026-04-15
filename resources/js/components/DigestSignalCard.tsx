import React, { useState } from "react";
import { Bookmark, BookmarkCheck, Copy, Check } from "lucide-react";
import CategoryBadge from "./CategoryBadge";
import { Av, AvStack, avatarUrlForHandle } from "./Avatar";
import { cn } from "@/lib/utils";
import type { CategoryKey } from "./CategoryBadge";
import type { DigestSignal } from "@/types/digestUi";

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

interface Props {
  signal: DigestSignal;
  className?: string;
  sheetMode?: boolean;
  onSignalOpen?: (signal: DigestSignal) => void;
  /** Khi có: click mở detail (modal) thay vì expand / bottom sheet. */
  onClick?: () => void;
  myKolsOnly?: boolean;
  userPlan?: "free" | "pro" | "power";
  /** Save to archive (Task 2.5.3) */
  isArchived?: boolean;
  archiveLoading?: boolean;
  onArchiveToggle?: (signalId: string, wasArchived: boolean) => void;
}

function tweetUrlForHandle(handle: string): string {
  const u = handle.replace(/^@/, "");
  return `https://x.com/${u}`;
}

const DigestSignalCard: React.FC<Props> = ({
  signal,
  className,
  sheetMode,
  onSignalOpen,
  onClick,
  myKolsOnly = false,
  userPlan = "free",
  isArchived = false,
  archiveLoading = false,
  onArchiveToggle,
}) => {
  const [inlineExpanded, setInlineExpanded] = useState(sheetMode ? false : (signal.defaultExpanded ?? false));
  const [copied, setCopied] = useState(false);
  const modalMode = Boolean(onClick);
  const expanded = !modalMode && !sheetMode && inlineExpanded;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (signal.draftTweet) {
      void navigator.clipboard.writeText(signal.draftTweet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const rankIsTop = signal.rank <= 3;
  const tagsLine = signal.tags.join("  ");
  const sourceCount = signal.sourceCount ?? signal.kolCount;
  const score = Number.isFinite(signal.rankScore) ? signal.rankScore : 0;
  const rankBadgeClass =
    score >= 0.8
      ? "bg-emerald-100 text-emerald-800"
      : score >= 0.6
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-600";
  const signalHasMyKolMatch = signal.sources.some((s) => s.isMySource);

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (archiveLoading || !onArchiveToggle) {
      return;
    }
    onArchiveToggle(signal.id, isArchived);
  };

  const onCardClick = () => {
    if (onClick) {
      onClick();
      return;
    }
    if (sheetMode) {
      onSignalOpen?.(signal);
      return;
    }
    setInlineExpanded(!inlineExpanded);
  };

  const showDraft = userPlan !== "free" && Boolean(signal.draftTweet);

  return (
    <article
      className={cn("transition-colors", !expanded && "hover:bg-[#f7f9f9]", className)}
      style={{
        borderBottom: "1px solid #eff3f4",
        backgroundColor: expanded ? "#f7f9f9" : "transparent",
        ...(myKolsOnly && signalHasMyKolMatch ? { borderLeft: "3px solid #10b981" } : {}),
      }}
    >
      <div
        className="flex cursor-pointer gap-3.5 px-5 py-4"
        onClick={onCardClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onCardClick();
          }
        }}
      >
        <div
          className={cn(
            "mt-px flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold",
            rankIsTop ? "bg-[#1d9bf0] text-white" : "bg-[#eff3f4] text-[#536471]",
          )}
        >
          {signal.rank}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="m-0 flex-1 text-[15px] font-bold leading-[1.4] text-[#0f1419]">{signal.title}</h3>
            <div className="mt-0.5 flex shrink-0 items-center gap-1">
              {onArchiveToggle ? (
                <button
                  type="button"
                  onClick={handleBookmarkClick}
                  disabled={archiveLoading}
                  className={cn(
                    "rounded-full p-1.5 transition-opacity",
                    archiveLoading ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-[#eff3f4]",
                  )}
                  title={isArchived ? "Remove from archive" : "Save to archive"}
                  aria-label={isArchived ? "Remove from archive" : "Save to archive"}
                >
                  {isArchived ? (
                    <BookmarkCheck className="h-[18px] w-[18px] text-[#1d9bf0]" aria-hidden />
                  ) : (
                    <Bookmark className="h-[18px] w-[18px] text-[#536471]" aria-hidden />
                  )}
                </button>
              ) : null}
              <span className="text-[13px] text-[#536471]">{signal.timeAgo}</span>
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-[#536471]">
            <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-semibold", rankBadgeClass)}>
              Rank: {score.toFixed(2)}
            </span>
            <span aria-hidden>•</span>
            <span>{sourceCount} sources</span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {signal.categories.map((cat, idx) =>
              isCategoryKey(cat) ? (
                <CategoryBadge key={`${cat}-${idx}`} category={cat} className="text-[12px] font-bold" />
              ) : (
                <span
                  key={`${cat}-${idx}`}
                  className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[12px] font-medium text-slate-700"
                >
                  {cat}
                </span>
              ),
            )}
            {tagsLine ? <span className="text-[13px] text-[#536471]">{tagsLine}</span> : null}
          </div>

          <p className="mb-0 mt-2 text-[14px] leading-[1.5] text-[#536471]">{signal.summary}</p>

          <div className="mt-2.5 flex items-center gap-2.5">
            <AvStack sources={signal.sources} max={5} />
            <span className="text-[13px] text-[#536471]">{signal.kolCount} KOLs</span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="space-y-0" style={{ padding: "0 20px 20px 64px" }}>
          {signal.sources.map((source, i) => (
            <div
              key={`${source.handle}-${i}`}
              className={cn("flex", i > 0 && "border-t border-[#eff3f4]")}
              style={{ gap: 12, padding: "12px 0" }}
            >
              <Av src={avatarUrlForHandle(source.handle)} name={source.name} size={40} f={i === 0} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-snug">
                  <span className="font-bold text-[#0f1419]">{source.name}</span>
                  {myKolsOnly && source.isMySource ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#059669",
                        background: "#d1fae5",
                        borderRadius: 9999,
                        padding: "1px 6px",
                        marginLeft: 6,
                      }}
                    >
                      ★ My KOL
                    </span>
                  ) : null}{" "}
                  <span className="text-[15px] text-[#536471]">{source.handle}</span>{" "}
                  <span className="text-[14px] text-[#536471]">· {source.timeAgo}</span>
                </p>
                {source.tweetPreview ? (
                  <p className="mb-0 mt-1 text-[15px] leading-[1.5] text-[#0f1419]">{source.tweetPreview}</p>
                ) : null}
                <a
                  href={source.tweetUrl || tweetUrlForHandle(source.handle)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-[13px] font-medium text-[#1d9bf0] no-underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  View original ↗
                </a>
              </div>
            </div>
          ))}

          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            style={{
              display: "block",
              fontSize: 14,
              color: "#1d9bf0",
              fontWeight: 500,
              padding: "8px 0 4px 0",
              textDecoration: "none",
              borderTop: "1px solid #eff3f4",
              marginTop: 4,
            }}
          >
            View all {sourceCount} sources →
          </a>

          {showDraft && signal.draftTweet ? (
            <div className="border border-[#cde5f9] bg-[#eef6fd]" style={{ padding: 16, marginTop: 12, borderRadius: 16 }}>
              <div className="mb-2.5 flex items-center gap-2">
                <svg width={16} height={16} viewBox="0 0 24 24" fill="#1d9bf0" aria-hidden>
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                </svg>
                <span className="text-[13px] font-bold text-[#1d9bf0]">Draft tweet</span>
                <span className="ml-auto text-[12px] text-[#536471]">{signal.draftTweet.length}/280</span>
              </div>
              <p className="mb-3.5 mt-0 text-[15px] leading-[1.55] text-[#0f1419]">{signal.draftTweet}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="cursor-pointer rounded-full border border-[#cfd9de] bg-white px-[18px] py-2 text-[14px] font-bold text-[#0f1419]"
                >
                  {copied ? (
                    <span className="inline-flex items-center gap-1">
                      <Check className="h-4 w-4 text-emerald-600" /> Copied
                    </span>
                  ) : (
                    "Copy"
                  )}
                </button>
                <a
                  href={`https://x.com/intent/post?text=${encodeURIComponent(signal.draftTweet)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex cursor-pointer items-center rounded-full bg-[#0f1419] px-5 py-2 text-[14px] font-bold text-white no-underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Post on 𝕏 ↗
                </a>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </article>
  );
};

export default DigestSignalCard;