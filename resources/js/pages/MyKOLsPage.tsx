import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Plus, Search, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Av, avatarUrlForHandle } from "@/components/Avatar";
import CategoryBadge, { type CategoryKey } from "@/components/CategoryBadge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AddSourceModal } from "@/components/AddSourceModal";
import { useAuth } from "@/contexts/AuthContext";
import { categoryDotActiveClass, categoryDotFilledClass } from "@/lib/categoryDotColor";
import { getCategories, type Category } from "@/services/categoryService";
import {
  fetchBrowseSources,
  SourceSubscriptionError,
  subscribeToSource,
  type BrowseSource,
  unsubscribeFromSource,
} from "@/services/sourceService";
import { toast } from "sonner";

interface KOLSource {
  id: string;
  name: string;
  handle: string;
  categories: CategoryKey[];
  signals7d: number;
  lastActive: string;
}

const poolSources: KOLSource[] = [
  { id: "karpathy", name: "Andrej Karpathy", handle: "@karpathy", categories: ["ai-ml"], signals7d: 12, lastActive: "2h ago" },
  { id: "sama", name: "Sam Altman", handle: "@sama", categories: ["ai-ml", "startup-vc"], signals7d: 8, lastActive: "4h ago" },
  { id: "levelsio", name: "Pieter Levels", handle: "@levelsio", categories: ["indie-saas"], signals7d: 15, lastActive: "1h ago" },
  { id: "rauchg", name: "Guillermo Rauch", handle: "@rauchg", categories: ["dev-tools"], signals7d: 6, lastActive: "6h ago" },
  { id: "naval", name: "Naval", handle: "@naval", categories: ["startup-vc"], signals7d: 3, lastActive: "12h ago" },
  { id: "randfish", name: "Rand Fishkin", handle: "@randfish", categories: ["marketing"], signals7d: 9, lastActive: "3h ago" },
  { id: "balajis", name: "Balaji Srinivasan", handle: "@balajis", categories: ["crypto", "startup-vc"], signals7d: 7, lastActive: "5h ago" },
  { id: "patio11", name: "Patrick McKenzie", handle: "@patio11", categories: ["finance", "indie-saas"], signals7d: 4, lastActive: "8h ago" },
  { id: "emollick", name: "Ethan Mollick", handle: "@emollick", categories: ["ai-ml"], signals7d: 11, lastActive: "1h ago" },
  { id: "swyx", name: "swyx", handle: "@swyx", categories: ["ai-ml", "dev-tools"], signals7d: 10, lastActive: "2h ago" },
];

const kolBios: Record<string, string> = {
  "@karpathy": "AI researcher & former Tesla AI director",
  "@sama": "OpenAI CEO, frequent AI policy commentary",
  "@levelsio": "Indie hacker, bootstrapped SaaS & nomad lifestyle",
  "@rauchg": "CEO of Vercel, creator of Next.js",
  "@naval": "Investor & philosopher, startup + wealth thinking",
  "@randfish": "SEO expert, founder of SparkToro",
  "@balajis": "Tech investor, crypto & biotech analyst",
  "@patio11": "Stripe, fintech & software business insights",
  "@emollick": "Wharton professor, AI in education & work",
  "@swyx": "AI engineer, developer education & tooling",
};

const followingTabBadges: Partial<Record<string, CategoryKey[]>> = {
  karpathy: ["ai-ml"],
  sama: ["ai-ml", "startup-vc"],
  levelsio: ["indie-saas"],
  rauchg: ["dev-tools"],
  randfish: ["marketing"],
  emollick: ["ai-ml"],
  swyx: ["ai-ml", "dev-tools"],
};

const getQualityColor = (signalCount: number) => {
  if (signalCount >= 10) return "#10b981";
  if (signalCount >= 5) return "#f59e0b";
  return "#9ca3af";
};

const getQualityLabel = (signalCount: number) => {
  if (signalCount >= 10) return "High activity";
  if (signalCount >= 5) return "Medium activity";
  return "Low activity";
};

/** Mock 7d counts for quality dot (Following tab). */
const MOCK_QUALITY_SIGNAL_COUNT: Partial<Record<string, number>> = {
  "@karpathy": 12,
  "@sama": 8,
  "@levelsio": 15,
  "@rauchg": 6,
  "@randfish": 9,
  "@emollick": 11,
  "@swyx": 10,
};

const MyKOLsPage = () => {
  const { user, authReady } = useAuth();
  const canAddSource = Boolean(user && (user.plan === "pro" || user.plan === "power"));

  const [tab, setTab] = useState<"browse" | "following">("browse");
  const [following, setFollowing] = useState<Set<string>>(
    new Set(["karpathy", "sama", "levelsio", "rauchg", "randfish", "emollick", "swyx"]),
  );
  const [search, setSearch] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [apiSources, setApiSources] = useState<BrowseSource[]>([]);
  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [busySourceId, setBusySourceId] = useState<number | null>(null);
  const [browseCategories, setBrowseCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [powerCapDialogOpen, setPowerCapDialogOpen] = useState(false);

  const loadBrowseSources = useCallback(async () => {
    setApiLoading(true);
    setApiError(null);
    try {
      const rows = await fetchBrowseSources();
      setApiSources(rows);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to load sources");
    } finally {
      setApiLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBrowseSources();
  }, [loadBrowseSources]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setCategoriesLoading(true);
      try {
        const list = await getCategories();
        if (!cancelled) {
          setBrowseCategories(list);
        }
      } catch {
        if (!cancelled) {
          toast.error("Failed to load categories");
          setBrowseCategories([]);
        }
      } finally {
        if (!cancelled) {
          setCategoriesLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleBrowseCategoryId = (categoryId: number) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId],
    );
  };

  const filteredApi = useMemo(() => {
    return apiSources.filter((s) => {
      const handle = `@${s.x_handle}`;
      const name = (s.display_name ?? "").toLowerCase();
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        name.includes(q) ||
        handle.toLowerCase().includes(q) ||
        s.x_handle.toLowerCase().includes(q);
      const matchCat =
        selectedCategoryIds.length === 0 ||
        s.categories.some((c) => selectedCategoryIds.includes(c.id));
      return matchSearch && matchCat;
    });
  }, [apiSources, search, selectedCategoryIds]);

  const toggleFollow = (id: string) => {
    setFollowing((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const followingList = poolSources.filter((s) => following.has(s.id));
  const subscriptionLimit = user?.plan === "power" ? 50 : user?.plan === "pro" ? 10 : 0;
  const currentSubscriptions = apiSources.filter((source) => source.is_subscribed).length;
  const followingQuotaLabel = subscriptionLimit > 0 ? `${currentSubscriptions}/${subscriptionLimit}` : "0/0";

  const handleToggleSubscription = async (source: BrowseSource) => {
    const sourceHandle = `@${source.x_handle}`;
    const isSubscribed = source.is_subscribed;

    if (!user) {
      toast.error("Please sign in to manage subscriptions");
      return;
    }

    if (user.plan === "free") {
      toast.info("Upgrade Required", {
        description: "Upgrade to Pro to follow KOLs",
      });
      return;
    }

    const atLimit = !isSubscribed && currentSubscriptions >= subscriptionLimit;
    if (atLimit) {
      toast.error(
        user.plan === "pro"
          ? "Subscription limit reached. Upgrade to Power to follow more KOLs."
          : "Subscription limit reached for your plan.",
      );
      return;
    }

    setApiSources((prev) =>
      prev.map((row) => (row.id === source.id ? { ...row, is_subscribed: !isSubscribed } : row)),
    );
    setBusySourceId(source.id);

    try {
      if (isSubscribed) {
        await unsubscribeFromSource(source.id);
        toast.success(`Unfollowed ${sourceHandle}`);
      } else {
        await subscribeToSource(source.id);
        toast.success(`Following ${sourceHandle}`);
        if (
          user.plan === "power" &&
          subscriptionLimit === 50 &&
          currentSubscriptions + 1 >= subscriptionLimit
        ) {
          setPowerCapDialogOpen(true);
        }
      }
    } catch (error) {
      setApiSources((prev) =>
        prev.map((row) => (row.id === source.id ? { ...row, is_subscribed: isSubscribed } : row)),
      );
      if (error instanceof SourceSubscriptionError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to update subscription");
      }
    } finally {
      setBusySourceId((prev) => (prev === source.id ? null : prev));
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-5 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-[#0f1419]">My KOLs</h1>
          {authReady && canAddSource ? (
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="rounded-full bg-[#0f1419] px-5 py-2 text-sm font-bold text-white"
            >
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add KOL
              </span>
            </button>
          ) : null}
        </div>

        <div className="mb-4 flex gap-6 border-b border-[#eff3f4]">
          {(["browse", "following"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "pb-2 text-sm font-bold transition-colors",
                tab === t ? "border-b-2 border-[#0f1419] text-[#0f1419]" : "text-[#536471] hover:text-[#0f1419]",
              )}
            >
              {t === "browse" ? "Browse" : "Following"}
            </button>
          ))}
        </div>

        {tab === "browse" && (
          <div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#536471]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by @handle or name..."
                className="w-full rounded-full border border-[#eff3f4] bg-[#f7f9f9] py-2.5 pl-9 pr-4 text-sm text-[#0f1419] placeholder:text-[#536471] focus:border-[#1d9bf0] focus:outline-none focus:ring-0"
              />
            </div>

            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-[#536471]">
                Following: <span className="font-semibold text-[#0f1419]">{followingQuotaLabel}</span>
              </span>
              {user?.plan === "free" ? (
                <span className="text-[#1d9bf0]">Upgrade to the Pro version to follow My KOLs.</span>
              ) : null}
            </div>

            <div className="mb-3 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {categoriesLoading ? (
                <span className="shrink-0 px-2 py-1 text-sm text-[#536471]">Loading categories…</span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryIds([])}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm",
                      selectedCategoryIds.length === 0
                        ? "border-none bg-[#0f1419] font-bold text-white"
                        : "border border-[#eff3f4] bg-transparent font-medium text-[#536471]",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        selectedCategoryIds.length === 0 ? categoryDotActiveClass() : "bg-[#1d9bf0]",
                      )}
                    />
                    All
                  </button>
                  {browseCategories.map((cat) => {
                    const active = selectedCategoryIds.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleBrowseCategoryId(cat.id)}
                        className={cn(
                          "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm",
                          active
                            ? "border-none bg-[#0f1419] font-bold text-white"
                            : "border border-[#eff3f4] bg-transparent font-medium text-[#536471]",
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            active ? categoryDotActiveClass() : categoryDotFilledClass(cat.slug),
                          )}
                        />
                        {cat.name}
                      </button>
                    );
                  })}
                </>
              )}
            </div>

            {apiLoading ? (
              <p className="py-8 text-center text-sm text-[#536471]">Loading sources…</p>
            ) : null}
            {apiError ? (
              <p className="py-4 text-center text-sm text-red-600">{apiError}</p>
            ) : null}
            {!apiLoading && !apiError && filteredApi.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#536471]">No sources match your filters.</p>
            ) : null}
            {!apiLoading && !apiError && filteredApi.length > 0 ? (
              <TooltipProvider>
                <div className="divide-y divide-[#eff3f4] border-t border-[#eff3f4]">
                {filteredApi.map((source) => {
                  const handle = `@${source.x_handle}`;
                  const title = source.display_name?.trim() || source.x_handle;
                  const isBusy = busySourceId === source.id;
                  const isSubscribed = source.is_subscribed;
                  const blockedByPlan = !user || user.plan === "free";
                  const blockedByCap = !isSubscribed && subscriptionLimit > 0 && currentSubscriptions >= subscriptionLimit;
                  const isBlocked = blockedByCap;
                  const shouldShowTooltip = blockedByPlan || blockedByCap;
                  const tooltipLabel = blockedByPlan
                    ? "Upgrade to Pro to follow KOLs"
                    : blockedByCap
                      ? user?.plan === "pro"
                        ? "Limit reached (10). Upgrade to Power."
                        : "Limit reached (50)."
                      : "";
                  return (
                    <div key={source.id} className="flex items-center gap-3 py-4">
                      <Av src={avatarUrlForHandle(handle)} name={title} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-bold text-[#0f1419]">{title}</div>
                        <div className="text-sm text-[#536471]">{handle}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {source.categories.map((c) => (
                            <span
                              key={c.id}
                              className="rounded-full bg-[#f7f9f9] px-2.5 py-0.5 text-xs font-medium text-[#536471]"
                            >
                              {c.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant={isSubscribed ? "outline" : "default"}
                              aria-disabled={isBlocked || isBusy}
                              onClick={() => void handleToggleSubscription(source)}
                              className={cn(
                                "rounded-full px-3 text-xs",
                                isBlocked && "opacity-50 cursor-not-allowed",
                                isBusy && "cursor-wait",
                              )}
                            >
                              {isBusy ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  {isSubscribed ? "Unfollowing..." : "Following..."}
                                </>
                              ) : isSubscribed ? (
                                <>
                                  <Check className="h-3.5 w-3.5" />
                                  Following
                                </>
                              ) : (
                                <>
                                  <UserPlus className="h-3.5 w-3.5" />
                                  Follow
                                </>
                              )}
                            </Button>
                          </TooltipTrigger>
                          {shouldShowTooltip ? <TooltipContent>{tooltipLabel}</TooltipContent> : null}
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
                </div>
              </TooltipProvider>
            ) : null}
          </div>
        )}

        {tab === "following" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-[#536471]">
                {followingList.length} / {Math.max(subscriptionLimit, 10)} KOLs
              </span>
              <div className="mx-3 h-1 flex-1 rounded-full bg-[#eff3f4]">
                <div
                  className="h-full rounded-full bg-[#1d9bf0] transition-all"
                  style={{ width: `${Math.min(100, (followingList.length / Math.max(subscriptionLimit, 10)) * 100)}%` }}
                />
              </div>
              <span className="text-[13px] font-medium text-[#1d9bf0]">
                {user?.plan === "power" ? "Power plan" : user?.plan === "pro" ? "Pro plan" : "Free plan"}
              </span>
            </div>

            <div className="divide-y divide-[#eff3f4] border-t border-[#eff3f4]">
              {followingList.map((source) => {
                const tabBadges = followingTabBadges[source.id];
                const signalCountForQuality =
                  MOCK_QUALITY_SIGNAL_COUNT[source.handle] ?? source.signals7d;
                return (
                  <div key={source.id} className="flex items-center gap-3 py-4">
                    <Av src={avatarUrlForHandle(source.handle)} name={source.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-bold text-[#0f1419]">{source.name}</span>
                        <span className="text-sm text-[#536471]">{source.handle}</span>
                      </div>
                      {tabBadges && tabBadges.length > 0 ? (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {tabBadges.map((cat) => (
                            <CategoryBadge key={cat} category={cat} />
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-1 flex items-center gap-2">
                        <span className="rounded-full bg-[#e8f5fd] px-2 py-0.5 text-xs font-medium text-[#1d9bf0]">
                          {source.signals7d} signals/7d
                        </span>
                        <span
                          title={getQualityLabel(signalCountForQuality)}
                          style={{
                            display: "inline-block",
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: getQualityColor(signalCountForQuality),
                            marginLeft: 6,
                            verticalAlign: "middle",
                            flexShrink: 0,
                          }}
                        />
                        <span className="text-[13px] text-[#536471]">last active {source.lastActive}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFollow(source.id)}
                      className="shrink-0 rounded-full border border-[#cfd9de] bg-white px-4 py-1.5 text-sm text-[#536471] hover:border-[#f4212e] hover:text-[#f4212e]"
                    >
                      Unfollow
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <AddSourceModal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} />

        <AlertDialog open={powerCapDialogOpen} onOpenChange={setPowerCapDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>The maximum of 50 KOLs has been reached.</AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction type="button" onClick={() => setPowerCapDialogOpen(false)}>
              Close
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default MyKOLsPage;
