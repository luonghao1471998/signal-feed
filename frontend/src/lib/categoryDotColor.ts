/**
 * Tailwind classes for category filter dots — maps API `categories.slug` to theme CSS vars in `resources/css/app.css`.
 */
const SLUG_TO_DOT_FILLED: Record<string, string> = {
  "ai-ml": "bg-[hsl(var(--cat-ai-ml-text))]",
  "crypto-web3": "bg-[hsl(var(--cat-crypto-text))]",
  "crypto": "bg-[hsl(var(--cat-crypto-text))]",
  /** Seeded slug `CategorySeeder` — VC/startup tone */
  startups: "bg-[hsl(var(--cat-startup-vc-text))]",
  "startup-vc": "bg-[hsl(var(--cat-startup-vc-text))]",
  "tech-news": "bg-[hsl(var(--cat-tech-policy-text))]",
  "saas-product": "bg-[hsl(var(--cat-indie-saas-text))]",
  /** Seeded slug */
  saas: "bg-[hsl(var(--cat-indie-saas-text))]",
  "indie-saas": "bg-[hsl(var(--cat-indie-saas-text))]",
  /** Seeded slug — indie / solo founder vibe */
  "indie-hacking": "bg-[hsl(var(--cat-creator-text))]",
  "marketing-growth": "bg-[hsl(var(--cat-marketing-text))]",
  marketing: "bg-[hsl(var(--cat-marketing-text))]",
  "design-ux": "bg-[hsl(var(--cat-design-product-text))]",
  /** Seeded slug */
  design: "bg-[hsl(var(--cat-design-product-text))]",
  "design-product": "bg-[hsl(var(--cat-design-product-text))]",
  "dev-tools": "bg-[hsl(var(--cat-dev-tools-text))]",
  "finance-economy": "bg-[hsl(var(--cat-finance-text))]",
  finance: "bg-[hsl(var(--cat-finance-text))]",
  /** Seeded slug — productivity / workflows */
  productivity: "bg-[hsl(var(--cat-finance-text))]",
  "career-productivity": "bg-[hsl(var(--cat-creator-text))]",
  creator: "bg-[hsl(var(--cat-creator-text))]",
  "tech-policy": "bg-[hsl(var(--cat-tech-policy-text))]",
};

function dotClassFromSlugHash(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = slug.charCodeAt(i) + ((h << 5) - h);
  }
  const hue = Math.abs(h) % 360;
  return `bg-[hsl(${hue}_65%_42%)]`;
}

/**
 * Filled dot on light (unselected) pill — category hue.
 */
export function categoryDotFilledClass(slug: string): string {
  return SLUG_TO_DOT_FILLED[slug] ?? dotClassFromSlugHash(slug);
}

/**
 * Selected pill has dark background — dot stays readable as white.
 */
export function categoryDotActiveClass(): string {
  return "bg-white";
}
