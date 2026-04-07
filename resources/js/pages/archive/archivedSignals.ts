export interface ArchivedSignal {
  id: number;
  rank: number;
  score: number;
  title: string;
  categories: string[];
  tags: string[];
  summary: string;
  kolCount: number;
  timeAgo: string;
  stackSources: { handle: string; name: string }[];
}

export interface ArchivedDateGroup {
  date: "today" | "yesterday";
  signals: ArchivedSignal[];
}

export const archivedSignals: ArchivedDateGroup[] = [
  {
    date: "today",
    signals: [
      {
        id: 1,
        rank: 1,
        score: 0.94,
        title: "OpenAI releases o3-mini with aggressive pricing",
        categories: ["AI/ML", "Dev Tools"],
        tags: ["#model-release", "#pricing"],
        summary:
          "OpenAI launched o3-mini, a reasoning-focused model competitive with o1 at significantly lower cost.",
        kolCount: 7,
        timeAgo: "2h ago",
        stackSources: [
          { handle: "@sama", name: "Sam Altman" },
          { handle: "@karpathy", name: "Andrej Karpathy" },
          { handle: "@swyx", name: "swyx" },
        ],
      },
      {
        id: 2,
        rank: 2,
        score: 0.81,
        title: "Vercel ships v0 with full-stack generation",
        categories: ["Dev Tools", "Indie SaaS"],
        tags: ["#tool-launch", "#ai-coding"],
        summary:
          "v0 from Vercel now generates full-stack apps including backend, DB schema, and API routes.",
        kolCount: 5,
        timeAgo: "4h ago",
        stackSources: [
          { handle: "@levelsio", name: "Pieter Levels" },
          { handle: "@rauchg", name: "Guillermo Rauch" },
        ],
      },
      {
        id: 3,
        rank: 3,
        score: 0.72,
        title: "Google cuts search ad CPCs by 15%",
        categories: ["Marketing"],
        tags: ["#market-data", "#google"],
        summary: "Google confirmed an algorithm update affecting search ad CPCs across verticals.",
        kolCount: 3,
        timeAgo: "6h ago",
        stackSources: [
          { handle: "@randfish", name: "Rand Fishkin" },
          { handle: "@emollick", name: "Ethan Mollick" },
        ],
      },
    ],
  },
  {
    date: "yesterday",
    signals: [
      {
        id: 4,
        rank: 1,
        score: 0.97,
        title: "Anthropic releases Claude 4 with extended context",
        categories: ["AI/ML"],
        tags: ["#model-release"],
        summary:
          "Anthropic released Claude 4 featuring 1M token context window and improved reasoning.",
        kolCount: 12,
        timeAgo: "1d ago",
        stackSources: [
          { handle: "@sama", name: "Sam Altman" },
          { handle: "@karpathy", name: "Andrej Karpathy" },
          { handle: "@emollick", name: "Ethan Mollick" },
        ],
      },
      {
        id: 5,
        rank: 2,
        score: 0.85,
        title: "Stripe launches AI billing API",
        categories: ["Dev Tools", "Startup/VC"],
        tags: ["#tool-launch", "#fintech"],
        summary:
          "Stripe announced a new AI-native billing API supporting usage-based pricing models.",
        kolCount: 6,
        timeAgo: "1d ago",
        stackSources: [
          { handle: "@patio11", name: "Patrick McKenzie" },
          { handle: "@rauchg", name: "Guillermo Rauch" },
        ],
      },
      {
        id: 6,
        rank: 3,
        score: 0.76,
        title: "Y Combinator opens W27 applications",
        categories: ["Startup/VC"],
        tags: ["#vc", "#yc"],
        summary: "YC opened applications for Winter 2027 batch with new AI-focused tracks.",
        kolCount: 4,
        timeAgo: "1d ago",
        stackSources: [{ handle: "@paulg", name: "Paul Graham" }],
      },
    ],
  },
];
