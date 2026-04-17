import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export interface DigestTopKol {
  handle: string;
  displayName: string;
  signalCount: number;
}

export interface DigestSidebarSnapshot {
  signalTotal: number;
  kolsActive: number;
  topicTags: string[];
  topKols: DigestTopKol[];
  loading: boolean;
}

type DigestSidebarContextValue = {
  snapshot: DigestSidebarSnapshot | null;
  setSnapshot: (s: DigestSidebarSnapshot | null) => void;
};

const DigestSidebarContext = createContext<DigestSidebarContextValue | null>(null);

export function DigestSidebarProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<DigestSidebarSnapshot | null>(null);

  const setSnapshotStable = useCallback((s: DigestSidebarSnapshot | null) => {
    setSnapshot(s);
  }, []);

  const value = useMemo(
    () => ({
      snapshot,
      setSnapshot: setSnapshotStable,
    }),
    [snapshot, setSnapshotStable],
  );

  return <DigestSidebarContext.Provider value={value}>{children}</DigestSidebarContext.Provider>;
}

export function useDigestSidebar(): DigestSidebarContextValue {
  const ctx = useContext(DigestSidebarContext);
  if (!ctx) {
    throw new Error("useDigestSidebar must be used within DigestSidebarProvider");
  }
  return ctx;
}

/** Mobile / PWA layout không bọc DigestSidebarProvider — dùng hook này. */
export function useDigestSidebarOptional(): DigestSidebarContextValue | null {
  return useContext(DigestSidebarContext);
}
