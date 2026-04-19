import React, { useState } from "react";
import { cn } from "@/lib/utils";

export const KOL_AVATARS: Record<string, string> = {
  sama: "https://api.dicebear.com/7.x/avataaars/svg?seed=sama&backgroundColor=b6e3f4",
  karpathy: "https://api.dicebear.com/7.x/avataaars/svg?seed=karpathy&backgroundColor=c0aede",
  levelsio: "https://api.dicebear.com/7.x/avataaars/svg?seed=levelsio&backgroundColor=d1d4f9",
  rauchg: "https://api.dicebear.com/7.x/avataaars/svg?seed=rauchg&backgroundColor=ffd5dc",
  naval: "https://api.dicebear.com/7.x/avataaars/svg?seed=naval&backgroundColor=ffdfbf",
  randfish: "https://api.dicebear.com/7.x/avataaars/svg?seed=randfish&backgroundColor=b6e3f4",
  balajis: "https://api.dicebear.com/7.x/avataaars/svg?seed=balajis&backgroundColor=c0aede",
  patio11: "https://api.dicebear.com/7.x/avataaars/svg?seed=patio11&backgroundColor=d1d4f9",
  emollick: "https://api.dicebear.com/7.x/avataaars/svg?seed=emollick&backgroundColor=ffd5dc",
  swyx: "https://api.dicebear.com/7.x/avataaars/svg?seed=swyx&backgroundColor=ffdfbf",
  paulg: "https://api.dicebear.com/7.x/avataaars/svg?seed=paulg&backgroundColor=b6e3f4",
  gregkamradt: "https://api.dicebear.com/7.x/avataaars/svg?seed=gregkamradt&backgroundColor=c0aede",
  leeerob: "https://api.dicebear.com/7.x/avataaars/svg?seed=leeerob&backgroundColor=d1d4f9",
  t3dotgg: "https://api.dicebear.com/7.x/avataaars/svg?seed=t3dotgg&backgroundColor=ffd5dc",
  simonw: "https://api.dicebear.com/7.x/avataaars/svg?seed=simonw&backgroundColor=ffdfbf",
};

export function handleToKey(handle: string): string {
  return handle.replace(/^@/, "");
}

/** DiceBear avataaars URL for a handle (known KOL or generic seed from handle). */
export function avatarUrlForHandle(handle: string): string {
  const key = handleToKey(handle);
  return (
    KOL_AVATARS[key] ??
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(key)}&backgroundColor=b6e3f4`
  );
}

interface AvProps {
  src: string;
  name: string;
  size?: number;
  f?: boolean;
  className?: string;
}

export const Av: React.FC<AvProps> = ({ src, name, size = 40, f = false, className }) => {
  const [error, setError] = useState(false);
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const COLORS = [
    "#1d9bf0",
    "#17bf63",
    "#f4212e",
    "#ff7043",
    "#7c3aed",
    "#db2777",
    "#059669",
    "#d97706",
  ];
  const bgColor = COLORS[(name || "?").charCodeAt(0) % COLORS.length];
  const badgeSize = size * 0.38;

  const showImg = Boolean(src) && !error;

  return (
    <div
      className={cn(className)}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        position: "relative",
        border: "none",
      }}
    >
      {showImg ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setError(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: bgColor,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: size * 0.38,
            fontWeight: 700,
          }}
        >
          {initials || "?"}
        </div>
      )}
      {f ? (
        <div
          style={{
            position: "absolute",
            bottom: -1,
            right: -1,
            width: badgeSize,
            height: badgeSize,
            borderRadius: "50%",
            background: "#1d9bf0",
            border: "2px solid #fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
          }}
          aria-hidden
        >
          <svg width={size * 0.2} height={size * 0.2} viewBox="0 0 24 24" fill="#fff">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
          </svg>
        </div>
      ) : null}
    </div>
  );
};

interface AvStackSource {
  handle: string;
  name?: string;
  avatar?: string;
}

interface AvStackProps {
  sources: AvStackSource[];
  max?: number;
  className?: string;
}

export const AvStack: React.FC<AvStackProps> = ({ sources, max = 5, className }) => {
  const shown = sources.slice(0, max);
  const remaining = sources.length > max ? sources.length - max : 0;

  return (
    <div className={cn("flex items-center", className)} style={{ display: "flex", alignItems: "center" }}>
      {shown.map((source, i) => {
        const displayName = source.name ?? source.handle;
        const src = source.avatar && source.avatar.trim() !== "" ? source.avatar : avatarUrlForHandle(source.handle);
        return (
          <div
            key={`${source.handle}-${i}`}
            title={source.name || source.handle}
            style={{
              marginLeft: i > 0 ? -10 : 0,
              zIndex: max - i,
              position: "relative",
              borderRadius: "50%",
              overflow: "hidden",
              border: "2px solid #fff",
              flexShrink: 0,
            }}
          >
            <Av src={src} name={displayName} size={26} />
          </div>
        );
      })}
      {remaining > 0 ? (
        <span style={{ marginLeft: 6, fontSize: 13, color: "#536471", fontWeight: 500 }}>+{remaining}</span>
      ) : null}
    </div>
  );
};
