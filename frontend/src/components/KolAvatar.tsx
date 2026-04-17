import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { kolAvatarUrlForHandle } from "@/data/kolAvatars";

interface KolAvatarProps {
  handle: string;
  className?: string;
  /** Tailwind size classes e.g. w-6 h-6 */
  sizeClassName?: string;
  ringClassName?: string;
}

/** Real Twitter avatar when URL exists; on error falls back to initials from @handle. */
const KolAvatar: React.FC<KolAvatarProps> = ({
  handle,
  className,
  sizeClassName = "w-8 h-8",
  ringClassName,
}) => {
  const url = kolAvatarUrlForHandle(handle);
  const [failed, setFailed] = useState(false);
  const initial = handle.replace(/^@/, "").slice(0, 1).toUpperCase() || "?";

  if (!url || failed) {
    return (
      <div
        className={cn(
          sizeClassName,
          "rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0",
          ringClassName,
          className,
        )}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={handle}
      className={cn(sizeClassName, "rounded-full object-cover shrink-0", ringClassName, className)}
      onError={() => setFailed(true)}
    />
  );
};

export default KolAvatar;
