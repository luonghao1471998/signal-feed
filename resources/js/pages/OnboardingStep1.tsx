import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

const categories = [
  { id: "ai-ml", emoji: "🤖", label: "AI & Machine Learning" },
  { id: "dev-tools", emoji: "🔧", label: "Developer Tools" },
  { id: "indie-saas", emoji: "🚀", label: "Indie Hackers & SaaS" },
  { id: "marketing", emoji: "📈", label: "Marketing & Growth" },
  { id: "startup-vc", emoji: "💼", label: "Startup & VC" },
  { id: "crypto", emoji: "₿", label: "Crypto & Web3" },
  { id: "finance", emoji: "📊", label: "Finance & Markets" },
  { id: "design-product", emoji: "🎨", label: "Design & Product" },
  { id: "creator", emoji: "🎬", label: "Creator Economy" },
  { id: "tech-policy", emoji: "🏛️", label: "Tech Policy" },
];

const OnboardingStep1: React.FC = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>(["ai-ml", "startup-vc"]);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const overMax = false; // Can't exceed 3 with the toggle logic above
  const canContinue = selected.length >= 1 && selected.length <= 3;

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Top bar */}
      <div className="border-b border-border/50 py-3 px-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1 hover:bg-secondary rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div className="h-full w-1/2 bg-slate-900 rounded-full" />
        </div>
        <span className="text-xs text-primary font-medium hidden md:block whitespace-nowrap">50% Complete</span>
      </div>

      {/* Content */}
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

        {/* Category grid */}
        <div className="px-6 mt-8 grid grid-cols-2 md:grid-cols-3 gap-3 auto-rows-fr">
          {categories.map((cat, index) => {
            const isSelected = selected.includes(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => toggle(cat.id)}
                className={`relative rounded-2xl p-4 text-left cursor-pointer transition-colors min-h-[100px] md:min-h-[108px] h-full ${
                  index === categories.length - 1 ? "md:col-start-2" : ""
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
                <span className="text-2xl">{cat.emoji}</span>
                <p className="text-sm font-semibold text-foreground mt-2">{cat.label}</p>
              </button>
            );
          })}
        </div>

        {/* CTA */}
        <div className="px-6 mt-8 pb-8 flex justify-center">
          <button
            disabled={!canContinue}
            onClick={() => navigate("/onboarding/follow")}
            className={`w-full md:max-w-xs bg-slate-900 text-white rounded-full py-3.5 font-bold text-base flex items-center justify-center gap-2 transition-colors ${
              !canContinue ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-800"
            }`}
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingStep1;
