import { type CategoryKey } from "../components/CategoryBadge";

export interface SignalItem {
  id: string;
  title: string;
  source: string;
  sourceIcon?: string;
  summary: string;
  category: CategoryKey;
  rank: "high" | "mid" | "low";
  timeAgo: string;
  url: string;
}

export const mockSignals: SignalItem[] = [
  {
    id: "1",
    title: "OpenAI announces GPT-5 with real-time reasoning capabilities",
    source: "TechCrunch",
    summary: "The new model demonstrates significant improvements in multi-step reasoning, code generation, and real-time data analysis across benchmarks.",
    category: "ai-ml",
    rank: "high",
    timeAgo: "12m ago",
    url: "#",
  },
  {
    id: "2",
    title: "Vercel ships Turbopack as stable default in Next.js 15",
    source: "Vercel Blog",
    summary: "Turbopack replaces Webpack as the default bundler, offering 10x faster cold starts and near-instant HMR in development.",
    category: "dev-tools",
    rank: "high",
    timeAgo: "34m ago",
    url: "#",
  },
  {
    id: "3",
    title: "Indie SaaS founder hits $1M ARR with a two-person team",
    source: "IndieHackers",
    summary: "Building in public since 2023, the team shares their growth playbook including PLG tactics and community-driven development.",
    category: "indie-saas",
    rank: "mid",
    timeAgo: "1h ago",
    url: "#",
  },
  {
    id: "4",
    title: "Google rolls out AI Overviews to 100+ countries",
    source: "Search Engine Land",
    summary: "The expansion includes new citation formats and opt-out mechanisms for publishers concerned about traffic impact.",
    category: "marketing",
    rank: "mid",
    timeAgo: "2h ago",
    url: "#",
  },
  {
    id: "5",
    title: "Stripe acquires AI billing startup for $200M",
    source: "Bloomberg",
    summary: "The deal signals Stripe's push into AI-native pricing models as usage-based billing becomes the SaaS default.",
    category: "startup-vc",
    rank: "high",
    timeAgo: "3h ago",
    url: "#",
  },
  {
    id: "6",
    title: "Bitcoin ETF inflows hit record $2.4B in single week",
    source: "CoinDesk",
    summary: "Institutional adoption accelerates as BlackRock's IBIT leads the charge with over $800M in weekly net inflows.",
    category: "crypto",
    rank: "mid",
    timeAgo: "4h ago",
    url: "#",
  },
  {
    id: "7",
    title: "Figma introduces AI-powered design-to-code with variable support",
    source: "Figma Blog",
    summary: "The new Dev Mode update generates production-ready React and Swift code that respects design tokens and component variants.",
    category: "design-product",
    rank: "high",
    timeAgo: "5h ago",
    url: "#",
  },
  {
    id: "8",
    title: "EU Digital Markets Act enforcement begins with first fines",
    source: "Reuters",
    summary: "Apple and Meta face preliminary penalties for non-compliance with interoperability and data portability requirements.",
    category: "tech-policy",
    rank: "low",
    timeAgo: "6h ago",
    url: "#",
  },
];
