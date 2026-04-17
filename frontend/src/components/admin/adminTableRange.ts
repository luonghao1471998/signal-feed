export function formatAdminTableRange(page: number, perPage: number, total: number): string {
  const start = total === 0 ? 0 : (page - 1) * perPage + 1;
  const end = Math.min(total, page * perPage);
  return `Showing ${start} - ${end} of ${total} items`;
}
