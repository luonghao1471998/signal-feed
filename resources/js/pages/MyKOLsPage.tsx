import React, { useState } from "react";
import { Plus, Search, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Av, avatarUrlForHandle } from "@/components/Avatar";
import CategoryBadge, { type CategoryKey } from "@/components/CategoryBadge";
import { DIGEST_FILTER_CATEGORIES, useCategoryFilter } from "@/contexts/CategoryFilterContext";

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

const allCategories: CategoryKey[] = [
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
];
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

const categoryLabels: Record<CategoryKey, string> = {
  "ai-ml": "AI & Machine Learning",
  "dev-tools": "Developer Tools",
  "indie-saas": "Indie Hackers & SaaS",
  marketing: "Marketing & Growth",
  "startup-vc": "Startup & VC",
  crypto: "Crypto & Web3",
  finance: "Finance & Markets",
  "design-product": "Design & Product",
  creator: "Creator Economy",
  "tech-policy": "Tech Policy",
};

const MyKOLsPage: React.FC = () => {
  const { activeCategory, selectCategory } = useCategoryFilter();
  const [tab, setTab] = useState<"browse" | "following">("browse");
  const [following, setFollowing] = useState<Set<string>>(
    new Set(["karpathy", "sama", "levelsio", "rauchg", "randfish", "emollick", "swyx"]),
  );
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalHandle, setModalHandle] = useState("");
  const [modalValidated, setModalValidated] = useState(false);
  const [modalCats, setModalCats] = useState<Set<CategoryKey>>(new Set());

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

  const filteredPool = poolSources.filter((s) => {
    const matchSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.handle.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === "all" || s.categories.includes(activeCategory as CategoryKey);
    return matchSearch && matchCat;
  });

  const followingList = poolSources.filter((s) => following.has(s.id));
  const planLimit = 10;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-5 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-[#0f1419]">My KOLs</h1>
          <button
            type="button"
            onClick={() => {
              setShowModal(true);
              setModalHandle("");
              setModalValidated(false);
              setModalCats(new Set());
            }}
            className="rounded-full bg-[#0f1419] px-5 py-2 text-sm font-bold text-white"
          >
            <span className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add KOL
            </span>
          </button>
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

            <div className="mb-3 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {DIGEST_FILTER_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => selectCategory(cat.key)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-sm",
                    activeCategory === cat.key
                      ? "border-none bg-[#0f1419] font-bold text-white"
                      : "border border-[#eff3f4] bg-transparent font-medium text-[#536471]",
                  )}
                >
                  {cat.key !== "all" && (
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        activeCategory === cat.key ? "bg-white" : cat.dotColor,
                      )}
                    />
                  )}
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="divide-y divide-[#eff3f4] border-t border-[#eff3f4]">
              {filteredPool.map((source) => {
                const isFollowing = following.has(source.id);
                const bio = kolBios[source.handle];
                return (
                  <div key={source.id} className="flex items-center gap-3 py-4">
                    <Av src={avatarUrlForHandle(source.handle)} name={source.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-bold text-[#0f1419]">{source.name}</div>
                      <div className="text-sm text-[#536471]">{source.handle}</div>
                      {bio ? <p className="mt-0.5 truncate text-[13px] italic text-[#536471]">{bio}</p> : null}
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {source.categories.map((cat) => (
                          <CategoryBadge key={cat} category={cat} />
                        ))}
                        <span className="ml-1 text-xs text-[#536471]">{source.signals7d} signals/7d</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFollow(source.id)}
                      className={cn(
                        "group shrink-0 rounded-full font-bold transition-colors",
                        isFollowing
                          ? "border border-[#cfd9de] bg-white text-[#0f1419] hover:border-[#f4212e] hover:text-[#f4212e]"
                          : "border-none bg-[#0f1419] text-white hover:bg-[#333]",
                      )}
                      style={{ padding: "6px 16px", fontSize: 14, fontWeight: 700, borderRadius: 9999 }}
                    >
                      {isFollowing ? (
                        <>
                          <span className="group-hover:hidden">Following</span>
                          <span className="hidden group-hover:inline">Unfollow</span>
                        </>
                      ) : (
                        "Follow"
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "following" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-[#536471]">
                {followingList.length} / {planLimit} KOLs
              </span>
              <div className="mx-3 h-1 flex-1 rounded-full bg-[#eff3f4]">
                <div
                  className="h-full rounded-full bg-[#1d9bf0] transition-all"
                  style={{ width: `${Math.min(100, (followingList.length / planLimit) * 100)}%` }}
                />
              </div>
              <span className="text-[13px] font-medium text-[#1d9bf0]">Pro plan</span>
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

        {showModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          >
            <div
              className="mx-4 w-full max-w-sm rounded-2xl border border-[#eff3f4] bg-white p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-[#0f1419]">Add KOL</h3>
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg p-1 hover:bg-[#f7f9f9]">
                  <X className="h-4 w-4 text-[#536471]" />
                </button>
              </div>

              <label className="text-xs font-medium text-[#536471]">Handle</label>
              <input
                value={modalHandle}
                onChange={(e) => {
                  setModalHandle(e.target.value);
                  setModalValidated(false);
                }}
                placeholder="@handle"
                className="mt-1 w-full rounded-lg border border-[#eff3f4] bg-white px-3 py-2.5 text-sm focus:border-[#1d9bf0] focus:outline-none"
              />
              {!modalValidated && (
                <button
                  type="button"
                  onClick={() => modalHandle.length > 1 && setModalValidated(true)}
                  className="mt-3 w-full rounded-lg border border-[#eff3f4] py-2 text-sm font-medium hover:bg-[#f7f9f9]"
                >
                  Validate handle
                </button>
              )}

              {modalValidated && (
                <>
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                    <Check className="h-3.5 w-3.5" /> Handle found
                  </p>
                  <label className="mt-4 block text-xs font-medium text-[#536471]">Categories</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {allCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() =>
                          setModalCats((prev) => {
                            const next = new Set(prev);
                            if (next.has(cat)) {
                              next.delete(cat);
                            } else {
                              next.add(cat);
                            }
                            return next;
                          })
                        }
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          modalCats.has(cat)
                            ? "border-[#0f1419] bg-[#0f1419] text-white"
                            : "border-[#eff3f4] text-[#536471] hover:bg-[#f7f9f9]",
                        )}
                      >
                        {categoryLabels[cat]}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    disabled={modalCats.size === 0}
                    className="mt-4 w-full rounded-full bg-[#0f1419] py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Add KOL
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyKOLsPage;
