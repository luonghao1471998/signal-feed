import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchCategories, type ApiCategory } from "@/services/signalService";
import { updateCurrentUserMyCategories } from "@/services/authService";

/** Emoji gợi ý theo slug DB (CategorySeeder). */
const SLUG_EMOJI: Record<string, string> = {
  "ai-ml": "🤖",
  "crypto-web3": "₿",
  marketing: "📈",
  startups: "💼",
  "tech-news": "📰",
  "dev-tools": "🔧",
  design: "🎨",
  saas: "🏢",
  "indie-hacking": "🚀",
  productivity: "⚡",
};

const OnboardingStep1: React.FC = () => {
  const navigate = useNavigate();
  const { user, authReady, refreshUser } = useAuth();

  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady) {
      return;
    }
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    if ((user.my_categories?.length ?? 0) > 0) {
      navigate("/digest", { replace: true });
    }
  }, [authReady, user, navigate]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchCategories();
        if (!cancelled) {
          setCategories(list);
        }
      } catch {
        if (!cancelled) {
          setLoadError("Could not load categories. Please refresh.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback((id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, id];
    });
  }, []);

  const canContinue = selectedIds.length >= 1 && selectedIds.length <= 3;

  const onContinue = async () => {
    if (!canContinue || saving) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await updateCurrentUserMyCategories(selectedIds);
      await refreshUser();
      navigate("/onboarding/follow");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!authReady || !user) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="border-b border-border/50 py-3 px-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/digest")}
          className="p-1 hover:bg-secondary rounded-lg transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div className="h-full w-1/2 bg-slate-900 rounded-full" />
        </div>
        <span className="text-xs text-primary font-medium hidden md:block whitespace-nowrap">50% Complete</span>
      </div>

      <div className="max-w-[560px] w-full mx-auto flex-1 flex flex-col">
        <p className="text-xs font-medium text-slate-400 tracking-widest uppercase mt-6 px-6 block w-full">
          STEP 1 OF 2
        </p>

        <div className="px-6 mt-3">
          <h1 className="text-3xl font-bold text-foreground">What do you follow on X?</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            Pick 1–3 categories to personalize your SignalFeed and cut through the noise.
          </p>
        </div>

        {loadError ? (
          <p className="px-6 mt-4 text-sm text-red-600">{loadError}</p>
        ) : null}
        {saveError ? (
          <p className="px-6 mt-2 text-sm text-red-600">{saveError}</p>
        ) : null}

        <div className="px-6 mt-8 grid grid-cols-2 md:grid-cols-3 gap-3 auto-rows-fr">
          {categories.map((cat, index) => {
            const isSelected = selectedIds.includes(cat.id);
            const emoji = SLUG_EMOJI[cat.slug] ?? "📌";
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggle(cat.id)}
                className={`relative rounded-2xl p-4 text-left cursor-pointer transition-colors min-h-[100px] md:min-h-[108px] h-full ${
                  index === categories.length - 1 && categories.length % 3 === 1 ? "md:col-start-2" : ""
                } ${
                  isSelected
                    ? "border-2 border-slate-900 bg-slate-50"
                    : "border border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </div>
                )}
                <span className="text-2xl" aria-hidden>
                  {emoji}
                </span>
                <p className="text-sm font-semibold text-foreground mt-2">{cat.name}</p>
              </button>
            );
          })}
        </div>

        <div className="px-6 mt-8 pb-8 flex justify-center">
          <button
            type="button"
            disabled={!canContinue || saving || categories.length === 0}
            onClick={() => void onContinue()}
            className={`w-full md:max-w-xs bg-slate-900 text-white rounded-full py-3.5 font-bold text-base flex items-center justify-center gap-2 transition-colors ${
              !canContinue || saving || categories.length === 0 ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-800"
            }`}
          >
            {saving ? "Saving…" : "Continue"}
            {!saving ? <ArrowRight className="w-4 h-4" /> : null}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingStep1;
