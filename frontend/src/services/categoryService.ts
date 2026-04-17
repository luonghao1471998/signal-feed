/**
 * GET /api/categories — public list (seeded categories table).
 */

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
}

/**
 * Fetch all categories from API.
 */
export async function getCategories(): Promise<Category[]> {
  const response = await fetch("/api/categories", {
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch categories");
  }

  const json = (await response.json()) as { data?: Category[] };
  return json.data ?? [];
}
