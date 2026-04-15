import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, BarChart3, Check, Loader2, Plus, RefreshCw, Search, TrendingUp, UserPlus, Users } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
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
  getMySubmissionsAPI,
  getMySourcesAPI,
  getMySourcesStatsAPI,
  type MySource,
  type MySubmissionSource,
  type MySourcesResponse,
  type MySourcesStats,
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

const formatShortDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
};

const formatSubmissionDate = (value: string): string => {
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

const SUBMISSION_STATUS_STYLES: Record<string, string> = {
  pending_review: "border border-yellow-300 bg-yellow-100 text-yellow-800",
  active: "border border-green-300 bg-green-100 text-green-800",
  spam: "border border-red-300 bg-red-100 text-red-800",
  deleted: "border border-gray-300 bg-gray-100 text-gray-800",
};

const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  pending_review: "Pending Review",
  active: "Active",
  spam: "Marked as Spam",
  deleted: "Removed",
};

const MyKOLsPage = () => {
  const { user, authReady } = useAuth();
  const canAddSource = Boolean(user && (user.plan === "pro" || user.plan === "power"));
  const canViewSubmittedTab = Boolean(user && (user.plan === "pro" || user.plan === "power"));

  const [tab, setTab] = useState<"browse" | "following" | "submitted" | "stats">("browse");
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
  const [statsData, setStatsData] = useState<MySourcesStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<MySubmissionSource[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  const [submissionsPage, setSubmissionsPage] = useState(1);
  const [submissionsMeta, setSubmissionsMeta] = useState<{
    current_page: number;
    total: number;
    per_page: number;
    last_page: number;
  } | null>(null);
  const [submissionsBusySourceId, setSubmissionsBusySourceId] = useState<number | null>(null);
  const availableTabs = useMemo(
    () => (canViewSubmittedTab ? (["browse", "following", "submitted", "stats"] as const) : (["browse", "following", "stats"] as const)),
    [canViewSubmittedTab],
  );

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

  const subscriptionLimit =
    user?.plan === "power" ? 50 : user?.plan === "pro" ? 10 : user ? 5 : 0;
  const currentSubscriptions = apiSources.filter((source) => source.is_subscribed).length;
  const followingQuotaLabel =
    subscriptionLimit > 0 ? `${currentSubscriptions}/${subscriptionLimit}` : `${currentSubscriptions}/—`;

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

  const loadSubmissions = useCallback(async (page: number) => {
    setSubmissionsLoading(true);
    setSubmissionsError(null);
    try {
      const response = await getMySubmissionsAPI(page);
      setSubmissions(response.data);
      setSubmissionsMeta(response.meta);
      setSubmissionsPage(response.meta.current_page);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load submitted sources";
      setSubmissionsError(message);
      toast.error(message);
    } finally {
      setSubmissionsLoading(false);
    }
  }, []);

  const handleAddSourceSuccess = useCallback(() => {
    if (tab !== "submitted") {
      return;
    }
    if (submissionsPage !== 1) {
      setSubmissionsPage(1);
    } else {
      void loadSubmissions(1);
    }
  }, [tab, submissionsPage, loadSubmissions]);

  useEffect(() => {
    if (tab !== "submitted" || !canViewSubmittedTab) {
      return;
    }

    void loadSubmissions(submissionsPage);
  }, [tab, submissionsPage, canViewSubmittedTab, loadSubmissions]);

  useEffect(() => {
    if (tab === "submitted" && !canViewSubmittedTab) {
      setTab("browse");
    }
  }, [tab, canViewSubmittedTab]);

  const handleFollowSubmission = async (source: MySubmissionSource) => {
    if (source.status !== "active" || source.is_subscribed || submissionsBusySourceId !== null) {
      return;
    }

    setSubmissionsBusySourceId(source.id);
    setSubmissions((prev) =>
      prev.map((item) => (item.id === source.id ? { ...item, is_subscribed: true } : item)),
    );
    setApiSources((prev) =>
      prev.map((item) => (item.id === source.id ? { ...item, is_subscribed: true } : item)),
    );

    try {
      await subscribeToSource(source.id);
      toast.success(`Following ${source.handle}`);
    } catch (error) {
      setSubmissions((prev) =>
        prev.map((item) => (item.id === source.id ? { ...item, is_subscribed: false } : item)),
      );
      setApiSources((prev) =>
        prev.map((item) => (item.id === source.id ? { ...item, is_subscribed: false } : item)),
      );
      if (error instanceof SourceSubscriptionError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to follow source");
      }
    } finally {
      setSubmissionsBusySourceId((prev) => (prev === source.id ? null : prev));
    }
  };

  const loadStatsData = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const response = await getMySourcesStatsAPI();
      setStatsData(response.data);
    } catch (error) {
      setStatsError(error instanceof Error ? error.message : "Failed to load stats. Please try again.");
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== "stats") {
      return;
    }

    if (!statsData && !statsLoading) {
      void loadStatsData();
    }
  }, [tab, statsData, statsLoading, loadStatsData]);

  const handleToggleSubscription = async (source: BrowseSource) => {
    const sourceHandle = `@${source.x_handle}`;
    const isSubscribed = source.is_subscribed;

    if (!user) {
      toast.error("Please sign in to manage subscriptions");
      return;
    }

    const atLimit = !isSubscribed && currentSubscriptions >= subscriptionLimit;
    if (atLimit) {
      toast.error(
        user.plan === "free"
          ? "Subscription limit reached (5). Upgrade to Pro for up to 10 follows."
          : user.plan === "pro"
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
          {availableTabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "pb-2 text-sm font-bold transition-colors",
                tab === t ? "border-b-2 border-[#0f1419] text-[#0f1419]" : "text-[#536471] hover:text-[#0f1419]",
              )}
            >
              {t === "browse"
                ? "Browse"
                : t === "following"
                  ? "Following"
                  : t === "submitted"
                    ? "Submitted"
                    : "Stats"}
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
                  const blockedByCap =
                    !isSubscribed && subscriptionLimit > 0 && currentSubscriptions >= subscriptionLimit;
                  const isBlocked = blockedByCap;
                  const shouldShowTooltip = !user || blockedByCap;
                  const tooltipLabel = !user
                    ? "Please sign in to follow KOLs"
                    : blockedByCap
                      ? user.plan === "free"
                        ? "Limit reached (5). Upgrade to Pro for more follows."
                        : user.plan === "pro"
                          ? "Limit reached (10). Upgrade to Power."
                          : "Limit reached (50)."
                      : "";
                  return (
                    <div key={source.id} className="flex items-center gap-3 py-4">
                      <Av src={source.avatar_url ?? avatarUrlForHandle(handle)} name={title} size={40} />
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
                {followingSources.length} / {subscriptionLimit > 0 ? subscriptionLimit : "—"} KOLs
              </span>
              <div className="mx-3 h-1 flex-1 rounded-full bg-[#eff3f4]">
                <div
                  className="h-full rounded-full bg-[#1d9bf0] transition-all"
                  style={{
                    width: `${subscriptionLimit > 0 ? Math.min(100, (followingSources.length / subscriptionLimit) * 100) : 0}%`,
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
                      <Av src={source.avatar_url ?? avatarUrlForHandle(sourceHandle)} name={sourceName} size={40} />
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

        {tab === "submitted" && canViewSubmittedTab && (
          <div>
            {submissionsLoading ? (
              <p className="py-8 text-center text-sm text-[#536471]">Loading submitted sources...</p>
            ) : null}

            {!submissionsLoading && submissionsError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center">
                <AlertCircle className="mx-auto mb-2 h-6 w-6 text-red-500" />
                <p className="text-sm text-red-700">{submissionsError}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 rounded-full"
                  onClick={() => void loadSubmissions(submissionsPage)}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </div>
            ) : null}

            {!submissionsLoading && !submissionsError && submissions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#dbe2e8] px-4 py-10 text-center">
                <Users className="mx-auto mb-3 h-10 w-10 text-[#536471]" />
                <h3 className="text-base font-bold text-[#0f1419]">You haven&apos;t submitted any KOLs yet</h3>
                <p className="mt-2 text-sm text-[#536471]">
                  Use the &quot;Add KOL&quot; button to contribute sources to the community.
                </p>
              </div>
            ) : null}

            {!submissionsLoading && !submissionsError && submissions.length > 0 ? (
              <div className="divide-y divide-[#eff3f4] border-t border-[#eff3f4]">
                {submissions.map((source) => {
                  const sourceName = source.display_name?.trim() || source.handle.replace(/^@/, "");
                  const statusStyle =
                    SUBMISSION_STATUS_STYLES[source.status] ??
                    "border border-gray-300 bg-gray-100 text-gray-800";
                  const statusLabel = SUBMISSION_STATUS_LABELS[source.status] ?? source.status;
                  const isBusy = submissionsBusySourceId === source.id;

                  return (
                    <div key={source.id} className="flex items-center gap-3 py-4">
                      <Av src={source.avatar_url ?? avatarUrlForHandle(source.handle)} name={sourceName} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-bold text-[#0f1419]">{source.handle}</span>
                          <span className={cn("rounded-full px-2 py-1 text-xs font-medium", statusStyle)}>
                            {statusLabel}
                          </span>
                        </div>
                        <div className="text-sm text-[#536471]">{sourceName}</div>
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
                        <p className="mt-1 text-[12px] text-[#536471]">
                          Submitted: {formatSubmissionDate(source.submitted_at)}
                        </p>
                      </div>
                      {source.status === "active" && !source.is_subscribed ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => void handleFollowSubmission(source)}
                          className="shrink-0 rounded-full px-4"
                        >
                          {isBusy ? "Following..." : "Follow"}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {!submissionsLoading &&
            !submissionsError &&
            submissionsMeta &&
            submissionsMeta.total > submissionsMeta.per_page ? (
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={submissionsPage <= 1}
                  onClick={() => setSubmissionsPage((prev) => Math.max(1, prev - 1))}
                  className="rounded-full px-4"
                >
                  Previous
                </Button>
                <span className="text-sm text-[#536471]">
                  Page {submissionsMeta.current_page} / {submissionsMeta.last_page}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={submissionsPage >= submissionsMeta.last_page}
                  onClick={() => setSubmissionsPage((prev) => prev + 1)}
                  className="rounded-full px-4"
                >
                  Next
                </Button>
              </div>
            ) : null}
          </div>
        )}

        {tab === "stats" && (
          <div>
            {statsLoading ? (
              <div className="space-y-4">
                <div className="h-28 animate-pulse rounded-xl bg-[#f2f4f5]" />
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="h-72 animate-pulse rounded-xl bg-[#f2f4f5]" />
                  <div className="h-72 animate-pulse rounded-xl bg-[#f2f4f5]" />
                </div>
              </div>
            ) : null}

            {!statsLoading && statsError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center">
                <AlertCircle className="mx-auto mb-2 h-6 w-6 text-red-500" />
                <p className="text-sm text-red-700">{statsError}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 rounded-full"
                  onClick={() => void loadStatsData()}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </div>
            ) : null}

            {!statsLoading &&
            !statsError &&
            (!statsData ||
              (statsData.total_signals_today === 0 &&
                statsData.top_active_sources.length === 0 &&
                statsData.per_category_breakdown.length === 0)) ? (
              <div className="rounded-xl border border-dashed border-[#dbe2e8] px-4 py-10 text-center">
                <BarChart3 className="mx-auto mb-3 h-10 w-10 text-[#536471]" />
                <h3 className="text-base font-bold text-[#0f1419]">No stats available yet</h3>
                <p className="mt-2 text-sm text-[#536471]">
                  Follow KOLs to see your personalized stats dashboard with signal trends and insights.
                </p>
                <Button type="button" className="mt-4 rounded-full px-5" onClick={() => setTab("browse")}>
                  Browse KOLs
                </Button>
              </div>
            ) : null}

            {!statsLoading && !statsError && statsData ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-[#eff3f4] bg-white p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#536471]">
                    <TrendingUp className="h-4 w-4 text-[#1d9bf0]" />
                    Signals Today
                  </div>
                  <div className="text-4xl font-bold text-[#0f1419]">
                    {statsData.total_signals_today.toLocaleString()}
                  </div>
                  <p className="mt-1 text-sm text-[#536471]">from your followed KOLs</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-[#eff3f4] bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold text-[#0f1419]">Top Active Sources (7 days)</h3>
                    {statsData.top_active_sources.length === 0 ? (
                      <p className="text-sm text-[#536471]">No active sources this week.</p>
                    ) : (
                      <div className="space-y-2">
                        {statsData.top_active_sources.slice(0, 3).map((source, index) => {
                          const sourceName = source.display_name?.trim() || source.handle.replace(/^@/, "");
                          return (
                            <div key={source.source_id} className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-[#0f1419]">
                                  #{index + 1} {sourceName}
                                </p>
                                <p className="truncate text-xs text-[#536471]">{source.handle}</p>
                              </div>
                              <span className="shrink-0 rounded-full bg-[#e8f5fd] px-2.5 py-0.5 text-xs font-medium text-[#1d9bf0]">
                                {source.signal_count} signals
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-[#eff3f4] bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold text-[#0f1419]">Signals by Category (7 days)</h3>
                    {statsData.per_category_breakdown.length === 0 ? (
                      <p className="text-sm text-[#536471]">No category data available.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {[...statsData.per_category_breakdown]
                          .sort((a, b) => b.signal_count - a.signal_count)
                          .slice(0, 5)
                          .map((category) => {
                            const totalSignals = statsData.per_category_breakdown.reduce(
                              (sum, item) => sum + item.signal_count,
                              0,
                            );
                            const percentage =
                              totalSignals > 0 ? Math.round((category.signal_count / totalSignals) * 100) : 0;
                            return (
                              <div key={category.category_id}>
                                <div className="mb-1 flex items-center justify-between text-xs">
                                  <span className="font-medium text-[#0f1419]">{category.name}</span>
                                  <span className="text-[#536471]">
                                    {category.signal_count} ({percentage}%)
                                  </span>
                                </div>
                                <div className="h-2 rounded-full bg-[#eff3f4]">
                                  <div
                                    className="h-2 rounded-full bg-[#1d9bf0]"
                                    style={{ width: `${Math.min(100, percentage)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-[#eff3f4] bg-white p-4">
                  <h3 className="mb-3 text-sm font-semibold text-[#0f1419]">7-Day Signal Trend</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={statsData.trend_7day.map((point) => ({
                          ...point,
                          display_date: formatShortDate(point.date),
                        }))}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#eff3f4" />
                        <XAxis dataKey="display_date" tick={{ fontSize: 12, fill: "#536471" }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#536471" }} />
                        <RechartsTooltip
                          formatter={(value: number) => [`${value} signals`, "Count"]}
                          labelFormatter={(label) => `Date: ${label}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="#1d9bf0"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        <AddSourceModal
          isOpen={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          onSuccess={handleAddSourceSuccess}
        />

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
