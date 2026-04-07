import { type CategoryKey } from "../components/CategoryBadge";

export interface KOLSource {
  handle: string;
  /** Display name for Av / AvStack */
  name: string;
  avatar: string;
  tweetPreview?: string;
  timeAgo: string;
  category: string;
}

export interface DigestSignal {
  id: string;
  rank: number;
  rankScore: number;
  title: string;
  categories: CategoryKey[];
  tags: string[];
  summary: string;
  draftTweet?: string;
  kolCount: number;
  /** Total sources (defaults to kolCount in UI when omitted). */
  sourceCount?: number;
  sources: KOLSource[];
  timeAgo: string;
  defaultExpanded?: boolean;
}

export const digestSignals: DigestSignal[] = [
  {
    id: "d1",
    rank: 1,
    rankScore: 0.94,
    title: "OpenAI releases o3-mini with aggressive pricing",
    categories: ["ai-ml", "dev-tools"],
    tags: ["#model-release", "#pricing"],
    summary:
      "OpenAI launched o3-mini, a reasoning-focused model competitive with o1 at significantly lower cost. Benchmarks show strong performance on coding and math tasks. Pricing is 80% cheaper than o1.",
    draftTweet:
      "o3-mini just dropped 🧠 Reasoning model, o1-level benchmarks, fraction of the price. If you're building AI products — your cost math just changed.",
    kolCount: 7,
    sources: [
      {
        handle: "@sama",
        name: "Sam Altman",
        avatar: "",
        tweetPreview: "o3-mini is live — our most efficient reasoning model yet. Great for coding and math.",
        timeAgo: "2h ago",
        category: "AI & ML",
      },
      {
        handle: "@karpathy",
        name: "Andrej Karpathy",
        avatar: "",
        tweetPreview: "Benchmarks look solid. The price/performance ratio is getting interesting.",
        timeAgo: "2h ago",
        category: "AI & ML",
      },
      {
        handle: "@swyx",
        name: "swyx",
        avatar: "",
        tweetPreview: "80% cheaper reasoning. The API cost wars continue.",
        timeAgo: "3h ago",
        category: "Dev Tools",
      },
    ],
    timeAgo: "2h ago",
    defaultExpanded: true,
  },
  {
    id: "d2",
    rank: 2,
    rankScore: 0.81,
    title: "Vercel ships v0 with full-stack generation",
    categories: ["dev-tools", "indie-saas"],
    tags: ["#tool-launch", "#ai-coding"],
    summary:
      "v0 from Vercel now generates full-stack apps including backend, DB schema, and API routes, not just UI components.",
    draftTweet:
      "v0 from @vercel now generates full-stack apps. Not just UI. Backend, DB schema, API routes. The gap between idea and deployed product just collapsed.",
    kolCount: 5,
    sources: [
      {
        handle: "@levelsio",
        name: "Pieter Levels",
        avatar: "",
        tweetPreview: "v0 now does full-stack. Backend, database, APIs — all generated.",
        timeAgo: "4h ago",
        category: "Dev Tools",
      },
      {
        handle: "@rauchg",
        name: "Guillermo Rauch",
        avatar: "",
        tweetPreview: "From idea to deployed product in minutes. v0 full-stack is here.",
        timeAgo: "4h ago",
        category: "Dev Tools",
      },
    ],
    timeAgo: "4h ago",
  },
  {
    id: "d3",
    rank: 3,
    rankScore: 0.72,
    title: "Google cuts search ad CPCs by 15% — algo update confirmed",
    categories: ["marketing"],
    tags: ["#market-data", "#google"],
    summary:
      "Google confirmed an algorithm update affecting search ad cost-per-clicks, with advertisers reporting an average 15% decrease across verticals.",
    kolCount: 3,
    sources: [
      {
        handle: "@randfish",
        name: "Rand Fishkin",
        avatar: "",
        tweetPreview: "CPCs are down across the board. Google confirmed the algo update.",
        timeAgo: "6h ago",
        category: "Marketing",
      },
      {
        handle: "@emollick",
        name: "Ethan Mollick",
        avatar: "",
        tweetPreview: "15% CPC reduction — biggest shift I've seen in search ads this year.",
        timeAgo: "6h ago",
        category: "Marketing",
      },
    ],
    timeAgo: "6h ago",
  },
  {
    id: "d4",
    rank: 4,
    rankScore: 0.68,
    title: "Solana DEX volume hits ATH, Raydium dominates",
    categories: ["crypto"],
    tags: ["#defi", "#dex"],
    summary:
      "Solana DEX trading volume reached an all-time high with Raydium capturing over 60% of market share.",
    kolCount: 2,
    sources: [
      {
        handle: "@balajis",
        name: "Balaji Srinivasan",
        avatar: "",
        tweetPreview: "Solana DEX volume ATH — Raydium leading the charge.",
        timeAgo: "8h ago",
        category: "Crypto",
      },
      {
        handle: "@gregkamradt",
        name: "Greg Kamradt",
        avatar: "",
        tweetPreview: "On-chain volume metrics breaking records this week.",
        timeAgo: "8h ago",
        category: "Crypto",
      },
    ],
    timeAgo: "8h ago",
  },
  {
    id: "d5",
    rank: 5,
    rankScore: 0.55,
    title: "Y Combinator W26 batch: 40% AI infrastructure startups",
    categories: ["startup-vc"],
    tags: ["#vc", "#yc", "#fintech"],
    summary:
      "Y Combinator's Winter 2026 batch is heavily weighted toward AI infrastructure, with 40% of accepted startups building foundational AI tooling.",
    kolCount: 2,
    sources: [
      {
        handle: "@paulg",
        name: "Paul Graham",
        avatar: "",
        tweetPreview: "W26 is our most AI-heavy batch ever. 40% building infra.",
        timeAgo: "12h ago",
        category: "Startup/VC",
      },
      {
        handle: "@naval",
        name: "Naval",
        avatar: "",
        tweetPreview: "Infrastructure plays dominating this cycle.",
        timeAgo: "12h ago",
        category: "Startup/VC",
      },
    ],
    timeAgo: "12h ago",
  },
];
