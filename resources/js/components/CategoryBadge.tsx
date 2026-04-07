import React from "react";
import { cn } from "@/lib/utils";

export type CategoryKey =
  | "ai-ml"
  | "dev-tools"
  | "indie-saas"
  | "marketing"
  | "startup-vc"
  | "crypto"
  | "finance"
  | "design-product"
  | "creator"
  | "tech-policy";

const categoryConfig: Record<CategoryKey, { label: string; bgVar: string; textVar: string }> = {
  "ai-ml": { label: "AI / ML", bgVar: "var(--cat-ai-ml-bg)", textVar: "var(--cat-ai-ml-text)" },
  "dev-tools": { label: "Dev Tools", bgVar: "var(--cat-dev-tools-bg)", textVar: "var(--cat-dev-tools-text)" },
  "indie-saas": { label: "Indie SaaS", bgVar: "var(--cat-indie-saas-bg)", textVar: "var(--cat-indie-saas-text)" },
  "marketing": { label: "Marketing", bgVar: "var(--cat-marketing-bg)", textVar: "var(--cat-marketing-text)" },
  "startup-vc": { label: "Startup / VC", bgVar: "var(--cat-startup-vc-bg)", textVar: "var(--cat-startup-vc-text)" },
  "crypto": { label: "Crypto", bgVar: "var(--cat-crypto-bg)", textVar: "var(--cat-crypto-text)" },
  "finance": { label: "Finance", bgVar: "var(--cat-finance-bg)", textVar: "var(--cat-finance-text)" },
  "design-product": { label: "Design", bgVar: "var(--cat-design-product-bg)", textVar: "var(--cat-design-product-text)" },
  "creator": { label: "Creator", bgVar: "var(--cat-creator-bg)", textVar: "var(--cat-creator-text)" },
  "tech-policy": { label: "Tech Policy", bgVar: "var(--cat-tech-policy-bg)", textVar: "var(--cat-tech-policy-text)" },
};

interface CategoryBadgeProps {
  category: CategoryKey;
  className?: string;
}

const CategoryBadge: React.FC<CategoryBadgeProps> = ({ category, className }) => {
  const config = categoryConfig[category];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-default",
        className,
      )}
      style={{
        backgroundColor: `hsl(${config.bgVar})`,
        color: `hsl(${config.textVar})`,
      }}
    >
      {config.label}
    </span>
  );
};

export default CategoryBadge;
