/** Gần với Laravel `Str::slug` cho chữ Latin; slug chỉ để hiển thị / gửi kèm create. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
