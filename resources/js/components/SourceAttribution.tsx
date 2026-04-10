import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { SignalSource } from "@/types/signal";

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
  const initials = initialsFromSource(source);

  const relativeTime = source.posted_at
    ? formatDistanceToNow(new Date(source.posted_at), { addSuffix: true })
    : null;

  const tweetText = source.tweet_text?.trim();

  return (
    <div className="border-b border-gray-200 py-4 last:border-0">
      <div className="mb-2 flex items-center gap-3">
        <Avatar className="h-10 w-10">
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
            View on X
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      ) : null}
    </div>
  );
}
