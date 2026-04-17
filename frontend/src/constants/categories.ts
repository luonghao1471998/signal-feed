/** 10 category cố định (khớp CategorySeeder — id 1…10). */
export const ALL_CATEGORIES = [
  { id: 1, name: "AI / ML", slug: "ai-ml" },
  { id: 2, name: "Crypto & Web3", slug: "crypto-web3" },
  { id: 3, name: "Marketing", slug: "marketing" },
  { id: 4, name: "Startups", slug: "startups" },
  { id: 5, name: "Tech News", slug: "tech-news" },
  { id: 6, name: "Developer Tools", slug: "dev-tools" },
  { id: 7, name: "Design", slug: "design" },
  { id: 8, name: "SaaS", slug: "saas" },
  { id: 9, name: "Indie Hacking", slug: "indie-hacking" },
  { id: 10, name: "Productivity", slug: "productivity" },
] as const;

export type AllCategoryRow = (typeof ALL_CATEGORIES)[number];
