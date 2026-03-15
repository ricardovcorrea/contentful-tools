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

/**
 * Appends Contentful Images API query parameters to a ctfassets.net URL.
 * Non-Contentful URLs are returned unchanged (with https: normalisation).
 *
 * Useful params:
 *   w / h  – max output dimensions in pixels (aspect ratio preserved)
 *   fm     – output format: "webp" | "jpg" | "png" | "avif"
 *   q      – quality 1-100 (jpeg/webp)
 *   f      – focus area for smart-crop: "thumb" | "face" | "center" etc.
 *   fit    – resize behaviour: "thumb" | "fill" | "scale" | "pad" | "crop"
 */
export function resolveImageUrl(
  raw: string | undefined | null,
  opts: {
    w?: number;
    h?: number;
    q?: number;
    fm?: "webp" | "jpg" | "png" | "avif";
    f?: "thumb" | "face" | "center" | "top" | "bottom" | "left" | "right";
    fit?: "thumb" | "fill" | "scale" | "pad" | "crop";
  } = {},
): string | null {
  if (!raw) return null;
  const url = raw.startsWith("//") ? `https:${raw}` : raw;
  if (!url.includes("ctfassets.net")) return url;
  try {
    const u = new URL(url);
    if (opts.w !== undefined) u.searchParams.set("w", String(opts.w));
    if (opts.h !== undefined) u.searchParams.set("h", String(opts.h));
    if (opts.q !== undefined) u.searchParams.set("q", String(opts.q));
    if (opts.fm) u.searchParams.set("fm", opts.fm);
    if (opts.f) u.searchParams.set("f", opts.f);
    if (opts.fit) u.searchParams.set("fit", opts.fit);
    return u.toString();
  } catch {
    return url;
  }
}
