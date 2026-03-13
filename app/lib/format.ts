export function formatCacheTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin === 1) return "1 min ago";
  if (diffMin < 60) return `${diffMin} min ago`;
  const h = new Date(ts).getHours().toString().padStart(2, "0");
  const m = new Date(ts).getMinutes().toString().padStart(2, "0");
  return `at ${h}:${m}`;
}
