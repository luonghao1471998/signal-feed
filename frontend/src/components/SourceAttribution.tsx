import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { SignalSource } from "@/types/signal";
import { useLocale } from "@/i18n";
import { avatarUrlForHandle } from "@/components/Avatar";

interface SourceAttributionProps {
  source: SignalSource;
}

function initialsFromSource(source: SignalSource): string {
  const name = source.display_name?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase().slice(0, 2);
    }
    return name.slice(0, 2).toUpperCase();
  }
  const h = source.handle.replace(/^@/, "");
  return h.slice(0, 2).toUpperCase() || "?";
}

export function SourceAttribution({ source }: SourceAttributionProps) {
  const { t } = useLocale();
  const initials = initialsFromSource(source);

  const relativeTime = source.posted_at
    ? formatDistanceToNow(new Date(source.posted_at), { addSuffix: true })
    : null;

  const tweetText = source.tweet_text?.trim();

  const avatarSrc =
    source.avatar_url && source.avatar_url.trim() !== ""
      ? source.avatar_url.trim()
      : avatarUrlForHandle(source.handle);

  return (
    <div className="border-b border-gray-200 py-4 last:border-0">
      <div className="mb-2 flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage
            src={avatarSrc}
            alt=""
            className="object-cover"
            referrerPolicy="no-referrer"
          />
          <AvatarFallback className="bg-blue-100 text-blue-700">{initials}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{source.display_name}</div>
          <div className="text-xs text-gray-500">
            {source.handle}
            {relativeTime ? ` · ${relativeTime}` : ""}
          </div>
        </div>
      </div>

      {tweetText ? (
        <div className="mb-2 ml-12">
          <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-700">{tweetText}</blockquote>
        </div>
      ) : null}

      {source.tweet_url ? (
        <div className="ml-12">
          <a
            href={source.tweet_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            {t("signalCard.viewOriginal")}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : null}
    </div>
  );
}
