import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Av, KOL_AVATARS } from "../components/Avatar";

/** DiceBear seed keys aligned with KOL_AVATARS (levelsie row → levelsio). */
const AVATAR_SEED_BY_ID: Record<string, keyof typeof KOL_AVATARS> = {
  karpathy: "karpathy",
  sama: "sama",
  emollick: "emollick",
  naval: "naval",
  levelsie: "levelsio",
  paulg: "paulg",
  patio11: "patio11",
  gregkamradt: "gregkamradt",
  balajis: "balajis",
  paulg2: "paulg",
};

function avatarSrcForKol(kolId: string): string {
  const seed = AVATAR_SEED_BY_ID[kolId];
  if (seed && KOL_AVATARS[seed]) return KOL_AVATARS[seed];
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(kolId)}&backgroundColor=b6e3f4`;
}

const kols = [
  { id: "karpathy", name: "Andrej Karpathy", handle: "@karpathy", bio: "AI researcher & former Tesla AI director", defaultFollow: true },
  { id: "sama", name: "Sam Altman", handle: "@sama", bio: "OpenAI CEO, frequent AI policy commentary", defaultFollow: true },
  { id: "emollick", name: "Ethan Mollick", handle: "@emollick", bio: "Wharton professor, AI in education & work", defaultFollow: true },
  { id: "naval", name: "Naval", handle: "@naval", bio: "Investor & philosopher, startup + wealth thinking", defaultFollow: false },
  { id: "levelsie", name: "Pieter Levels", handle: "@levelsio", bio: "Indie hacker, bootstrapped SaaS & nomad lifestyle", defaultFollow: false },
  { id: "paulg", name: "Paul Graham", handle: "@paulg", bio: "YC founder, startup essays & founder advice", defaultFollow: false },
  { id: "patio11", name: "Patrick McKenzie", handle: "@patio11", bio: "Stripe, fintech & software business insights", defaultFollow: false },
  { id: "gregkamradt", name: "Greg Kamradt", handle: "@gregkamradt", bio: "LLM developer tutorials & AI tool breakdowns", defaultFollow: false },
  { id: "balajis", name: "Balaji Srinivasan", handle: "@balajis", bio: "Tech investor, crypto & biotech analyst", defaultFollow: false },
  { id: "paulg2", name: "Paul Graham", handle: "@paulg", bio: "YC founder, startup essays & founder advice", defaultFollow: false },
];

const OnboardingStep2: React.FC = () => {
  const navigate = useNavigate();
  const [following, setFollowing] = useState<Set<string>>(
    new Set(kols.filter((k) => k.defaultFollow).map((k) => k.id))
  );

  const toggle = (id: string) => {
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

  const followAll = () => setFollowing(new Set(kols.map((k) => k.id)));

  const finish = () => {
    // TODO: set onboarding_completed = true in DB
    navigate("/digest");
  };

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
          <span className="text-[13px] text-slate-400">{following.size} following</span>
          <button type="button" onClick={followAll} className="text-xs text-blue-500 underline font-medium">Follow all</button>
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
        <div
          className="px-6 mt-6 border-t border-slate-100"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          {kols.map((kol) => {
            const isFollowing = following.has(kol.id);
            return (
              <div
                key={kol.id}
                className="border-b border-slate-100 py-3 hover:bg-slate-50/50 transition-colors"
                style={{ minWidth: 0 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
                  <div style={{ flexShrink: 0 }}>
                    <Av src={avatarSrcForKol(kol.id)} name={kol.name} size={48} />
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
                      {kol.name}
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
                      {kol.handle}
                    </p>
                    <p
                      title={kol.bio}
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
                      {kol.bio}
                    </p>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => toggle(kol.id)}
                      style={{ whiteSpace: "nowrap" }}
                      className={cn(
                        "rounded-full px-4 py-1.5 text-sm font-bold min-h-[36px] transition-colors",
                        isFollowing
                          ? "bg-transparent text-slate-900 border border-slate-300 hover:border-red-300 hover:text-red-500 hover:bg-red-50 group"
                          : "bg-slate-900 text-white hover:bg-slate-800",
                      )}
                    >
                      {isFollowing ? (
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
