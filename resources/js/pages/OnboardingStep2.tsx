import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Av, KOL_AVATARS } from "../components/Avatar";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  bulkSubscribeSources,
  getCurrentSubscriptionCount,
  getMySourcesAPI,
  getOnboardingKOLs,
  subscribeToSource,
  type BrowseSource,
  SourceSubscriptionError,
  unsubscribeFromSource,
} from "@/services/sourceService";

const FREE_CAP = 5;
const ONBOARDING_RECOMMENDED_LIMIT = 10;

function avatarSrcForKol(handle: string): string {
  const normalized = handle.replace("@", "").toLowerCase() as keyof typeof KOL_AVATARS;
  if (normalized in KOL_AVATARS) {
    return KOL_AVATARS[normalized];
  }
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(handle)}&backgroundColor=b6e3f4`;
}

const OnboardingStep2: React.FC = () => {
  const navigate = useNavigate();
  const { user, authReady } = useAuth();
  const [kols, setKols] = useState<BrowseSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<Set<number>>(new Set());
  const [subscribingId, setSubscribingId] = useState<number | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [currentCount, setCurrentCount] = useState(0);

  const userLimit = user?.plan === "free" ? FREE_CAP : user?.plan === "pro" ? 10 : 50;
  const hasReachedCap = currentCount >= userLimit;

  useEffect(() => {
    if (!authReady) {
      return;
    }
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }

    let canceled = false;
    void (async () => {
      try {
        const [browseSources, mySources, initialCount] = await Promise.all([
          getOnboardingKOLs(),
          getMySourcesAPI(1),
          getCurrentSubscriptionCount(),
        ]);
        if (canceled) {
          return;
        }

        setKols(browseSources);
        const ids = mySources.data.map((item) => item.id);
        setFollowingIds(new Set(ids));
        setCurrentCount(initialCount ?? mySources.total ?? ids.length);
      } catch (error) {
        if (!canceled) {
          toast.error("Failed to load recommended KOLs");
        }
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, [authReady, navigate, user]);

  const handleFollow = async (sourceId: number) => {
    const isFollowingNow = followingIds.has(sourceId);

    if (!isFollowingNow && hasReachedCap) {
      return;
    }

    setSubscribingId(sourceId);
    try {
      if (isFollowingNow) {
        await unsubscribeFromSource(sourceId);
        setFollowingIds((prev) => {
          const next = new Set(prev);
          next.delete(sourceId);
          return next;
        });
        setCurrentCount((prev) => Math.max(0, prev - 1));
        toast.success("Unfollowed");
        return;
      }

      const response = await subscribeToSource(sourceId);
      setFollowingIds((prev) => new Set([...prev, sourceId]));
      setCurrentCount(response.current_count);
      toast.success("Following!");
    } catch (error) {
      if (error instanceof SourceSubscriptionError && error.status === 400) {
        toast.error("Subscription limit reached");
      } else {
        toast.error(isFollowingNow ? "Failed to unfollow KOL" : "Failed to follow KOL");
      }
    } finally {
      setSubscribingId(null);
    }
  };

  const handleFollowAll = async () => {
    const unfollowed = kols.filter((item) => !followingIds.has(item.id)).map((item) => item.id);
    if (unfollowed.length === 0) {
      toast.info("Already following all recommended KOLs");
      return;
    }
    if (hasReachedCap) {
      return;
    }

    setBulkLoading(true);
    try {
      const response = await bulkSubscribeSources(unfollowed);
      const followCount = Math.min(unfollowed.length, response.subscribed_count);
      const newIds = unfollowed.slice(0, followCount);
      setFollowingIds((prev) => new Set([...prev, ...newIds]));
      setCurrentCount(response.total_count);
      toast.success(`Following ${response.subscribed_count} KOLs!`);
    } catch (error) {
      if (error instanceof SourceSubscriptionError && error.status === 400) {
        toast.error("Subscription limit reached");
      } else {
        toast.error("Failed to follow KOLs");
      }
    } finally {
      setBulkLoading(false);
    }
  };

  const finish = () => {
    navigate("/digest");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading recommended KOLs...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar */}
      <div className="border-b border-slate-100 py-3 px-4 flex items-center gap-3">
        <button type="button" onClick={() => navigate("/onboarding")} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </button>
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full w-full bg-slate-900 rounded-full" />
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-[13px] text-slate-400">{currentCount} following</span>
          <button
            type="button"
            onClick={() => void handleFollowAll()}
            disabled={bulkLoading || hasReachedCap || kols.length === 0}
            className="text-xs text-blue-500 underline font-medium disabled:text-slate-300"
          >
            {bulkLoading ? "Following..." : `Follow all (${Math.min(userLimit - currentCount, kols.filter((item) => !followingIds.has(item.id)).length)})`}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[560px] w-full mx-auto flex-1 flex flex-col">
        <div className="px-6 mt-6">
          <h1 className="text-2xl font-bold text-slate-900">Follow the voices you trust</h1>
          <p className="text-sm text-slate-500 mt-2">
            Your digest is ready based on your categories. Follow specific KOLs to get a personal signal filter on top.
          </p>
        </div>

        {/* KOL grid */}
        {kols.length === 0 ? (
          <div className="px-6 mt-6 border-t border-slate-100 pt-8 text-center">
            <p className="text-sm text-slate-600">No KOLs found in your selected categories.</p>
            <button
              type="button"
              onClick={finish}
              className="mt-3 text-sm font-medium text-blue-600 underline"
            >
              Skip to your digest
            </button>
          </div>
        ) : (
          <div
            className="px-6 mt-6 border-t border-slate-100"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
          >
            {kols.map((kol) => {
            const isFollowing = followingIds.has(kol.id);
            const isSubscribing = subscribingId === kol.id;
            const isDisabled = isSubscribing || (!isFollowing && hasReachedCap);

            return (
              <div
                key={kol.id}
                className="border-b border-slate-100 py-3 hover:bg-slate-50/50 transition-colors"
                style={{ minWidth: 0 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
                  <div style={{ flexShrink: 0 }}>
                    <Av src={avatarSrcForKol(kol.x_handle)} name={kol.display_name ?? kol.x_handle} size={48} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#0f1419",
                        margin: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {kol.display_name ?? kol.x_handle}
                    </p>
                    <p
                      style={{
                        fontSize: 12,
                        color: "#536471",
                        margin: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      @{kol.x_handle}
                    </p>
                    <p
                      title={kol.categories.map((cat) => cat.name).join(", ")}
                      style={{
                        fontSize: 11,
                        color: "#536471",
                        margin: 0,
                        fontStyle: "italic",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {kol.categories.map((cat) => cat.name).join(" • ")}
                    </p>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => void handleFollow(kol.id)}
                      style={{ whiteSpace: "nowrap" }}
                      disabled={isDisabled}
                      className={cn(
                        "rounded-full px-4 py-1.5 text-sm font-bold min-h-[36px] transition-colors",
                        isDisabled ? "opacity-50 cursor-not-allowed" : "",
                        isFollowing
                          ? "bg-transparent text-slate-900 border border-slate-300 hover:border-red-300 hover:text-red-500 hover:bg-red-50 group"
                          : "bg-slate-900 text-white hover:bg-slate-800",
                      )}
                    >
                      {isSubscribing ? "Following..." : isFollowing ? (
                        <>
                          <span className="group-hover:hidden">Following</span>
                          <span className="hidden group-hover:inline text-red-500">Unfollow</span>
                        </>
                      ) : (
                        "Follow"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        )}

        <div className="px-6 mt-3">
          <p className="text-xs text-slate-500">
            {currentCount}/{userLimit} KOLs ({user?.plan ?? "free"} plan)
          </p>
        </div>

        {/* CTA */}
        <div className="px-6 pb-6 pt-4 mt-auto border-t border-slate-100 md:border-t-0">
          <button
            type="button"
            onClick={finish}
            className="w-full bg-slate-900 text-white rounded-full py-3.5 font-bold text-base flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
          >
            View my digest
            <ArrowRight className="w-4 h-4" />
          </button>
          <button type="button" onClick={finish} className="text-sm text-slate-500 underline text-center mt-3 block mx-auto">
            Skip for now
          </button>
        </div>
      </div>

    </div>
  );
};

export default OnboardingStep2;
