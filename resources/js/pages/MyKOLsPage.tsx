import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Plus, Search, UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Av, avatarUrlForHandle } from "@/components/Avatar";
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
  getMySourcesAPI,
  type MySource,
  type MySourcesResponse,
  SourceSubscriptionError,
  subscribeToSource,
  type BrowseSource,
  unsubscribeFromSource,
} from "@/services/sourceService";
import { toast } from "sonner";

const formatSubscribedDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const MyKOLsPage = () => {
  const { user, authReady } = useAuth();
  const canAddSource = Boolean(user && (user.plan === "pro" || user.plan === "power"));

  const [tab, setTab] = useState<"browse" | "following">("browse");
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
  const [followingSources, setFollowingSources] = useState<MySource[]>([]);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [followingError, setFollowingError] = useState<string | null>(null);
  const [followingPage, setFollowingPage] = useState(1);
  const [followingHasMore, setFollowingHasMore] = useState(false);
  const [followingBusySourceId, setFollowingBusySourceId] = useState<number | null>(null);

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

  const subscriptionLimit = user?.plan === "power" ? 50 : user?.plan === "pro" ? 10 : 0;
  const currentSubscriptions = apiSources.filter((source) => source.is_subscribed).length;
  const followingQuotaLabel = subscriptionLimit > 0 ? `${currentSubscriptions}/${subscriptionLimit}` : "0/0";

  const loadFollowingSources = useCallback(async (page: number, append: boolean) => {
    setFollowingLoading(true);
    setFollowingError(null);
    try {
      const response: MySourcesResponse = await getMySourcesAPI(page);
      setFollowingHasMore(response.current_page < response.last_page);
      setFollowingPage(response.current_page);
      setFollowingSources((prev) => {
        if (!append) {
          return response.data;
        }
        const existing = new Set(prev.map((item) => item.id));
        const merged = [...prev];
        response.data.forEach((item) => {
          if (!existing.has(item.id)) {
            merged.push(item);
          }
        });
        return merged;
      });
    } catch (error) {
      setFollowingError(error instanceof Error ? error.message : "Failed to load following list");
      toast.error("Failed to load following list");
    } finally {
      setFollowingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== "following") {
      return;
    }
    void loadFollowingSources(1, false);
  }, [tab, loadFollowingSources]);

  const handleLoadMoreFollowing = () => {
    if (followingLoading || !followingHasMore) {
      return;
    }

    void loadFollowingSources(followingPage + 1, true);
  };

  const handleUnfollowFromFollowing = async (source: MySource) => {
    const confirmed = window.confirm(`Unfollow ${source.handle}?`);
    if (!confirmed) {
      return;
    }

    const previousFollowing = followingSources;
    setFollowingBusySourceId(source.id);
    setFollowingSources((prev) => prev.filter((item) => item.id !== source.id));
    setApiSources((prev) =>
      prev.map((item) => (item.id === source.id ? { ...item, is_subscribed: false } : item)),
    );

    try {
      await unsubscribeFromSource(source.id);
      toast.success(`Unfollowed ${source.handle}`);
    } catch {
      setFollowingSources(previousFollowing);
      setApiSources((prev) =>
        prev.map((item) => (item.id === source.id ? { ...item, is_subscribed: true } : item)),
      );
      toast.error("Failed to unfollow. Please try again.");
    } finally {
      setFollowingBusySourceId((prev) => (prev === source.id ? null : prev));
    }
  };

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
        setFollowingSources((prev) => prev.filter((item) => item.id !== source.id));
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
        if (tab === "following") {
          void loadFollowingSources(1, false);
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
                {followingSources.length} / {Math.max(subscriptionLimit, 10)} KOLs
              </span>
              <div className="mx-3 h-1 flex-1 rounded-full bg-[#eff3f4]">
                <div
                  className="h-full rounded-full bg-[#1d9bf0] transition-all"
                  style={{
                    width: `${Math.min(100, (followingSources.length / Math.max(subscriptionLimit, 10)) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-[13px] font-medium text-[#1d9bf0]">
                {user?.plan === "power" ? "Power plan" : user?.plan === "pro" ? "Pro plan" : "Free plan"}
              </span>
            </div>

            {followingLoading && followingSources.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#536471]">Loading following list...</p>
            ) : null}

            {followingError ? <p className="py-4 text-center text-sm text-red-600">{followingError}</p> : null}

            {!followingLoading && !followingError && followingSources.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#dbe2e8] px-4 py-10 text-center">
                <Users className="mx-auto mb-3 h-10 w-10 text-[#536471]" />
                <h3 className="text-base font-bold text-[#0f1419]">You haven&apos;t followed any KOLs yet</h3>
                <p className="mt-2 text-sm text-[#536471]">
                  Browse the source pool to find and follow KOLs that match your interests.
                </p>
                <Button type="button" className="mt-4 rounded-full px-5" onClick={() => setTab("browse")}>
                  Browse KOLs
                </Button>
              </div>
            ) : null}

            {followingSources.length > 0 ? (
              <div className="divide-y divide-[#eff3f4] border-t border-[#eff3f4]">
                {followingSources.map((source) => {
                  const sourceName = source.display_name?.trim() || source.handle.replace(/^@/, "");
                  const sourceHandle = source.handle.startsWith("@") ? source.handle : `@${source.handle}`;
                  const signalCount = source.stats.signal_count;
                  const statsText =
                    signalCount > 0
                      ? `${signalCount} signal${signalCount > 1 ? "s" : ""} (last 7 days)`
                      : "No recent signals";
                  const lastActiveText = source.stats.last_active_date
                    ? `last active ${source.stats.last_active_date}`
                    : "No recent activity";
                  const isBusy = followingBusySourceId === source.id;

                  return (
                    <div key={source.id} className="flex items-center gap-3 py-4">
                      <Av src={avatarUrlForHandle(sourceHandle)} name={sourceName} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-bold text-[#0f1419]">{sourceName}</div>
                        <div className="text-sm text-[#536471]">{sourceHandle}</div>
                        {source.categories.length > 0 ? (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {source.categories.map((category) => (
                              <span
                                key={category.id}
                                className="rounded-full bg-[#f7f9f9] px-2.5 py-0.5 text-xs font-medium text-[#536471]"
                              >
                                {category.name}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <p className="mt-1 text-[13px] text-[#0f1419]">{statsText}</p>
                        <p className="text-[13px] text-[#536471]">{lastActiveText}</p>
                        <p className="text-[12px] text-[#536471]">
                          Following since{" "}
                          {source.subscribed_at ? formatSubscribedDate(source.subscribed_at) : "Unknown"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => void handleUnfollowFromFollowing(source)}
                        className="shrink-0 rounded-full px-4"
                      >
                        {isBusy ? "Unfollowing..." : "Unfollow"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {followingHasMore ? (
              <div className="mt-4 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLoadMoreFollowing}
                  disabled={followingLoading}
                  className="rounded-full px-5"
                >
                  {followingLoading ? "Loading..." : "Load More"}
                </Button>
              </div>
            ) : null}
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
