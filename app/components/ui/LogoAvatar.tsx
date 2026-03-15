import { useAsset } from "~/lib/contentful/get-asset";
import { resolveImageUrl } from "~/lib/format";

/**
 * Renders a logo image loaded lazily from a Contentful asset ID.
 * Falls back to an initials span when the asset is loading or unavailable.
 * `className` is applied to both the fallback <span> and the <img> – it should
 * include size, border, background, text-color, and rounding utility classes.
 *
 * The image is fetched at `size * 2` pixels wide (retina-ready) in WebP format
 * via the Contentful Images API, then cached by TanStack Query.
 */
export function LogoAvatar({
  assetId,
  fallback,
  className,
  /** Rendered pixel size (used to request a 2× WebP thumbnail). Default 24. */
  size = 24,
}: {
  assetId?: string;
  fallback: string;
  className: string;
  size?: number;
}) {
  const { data: asset } = useAsset(assetId);

  const fields = asset?.fields ?? {};
  const file = (Object.values(fields["file"] ?? {}) as any[])[0] as any;
  const imgUrl = resolveImageUrl(file?.url, {
    w: size * 2,
    h: size * 2,
    fm: "webp",
    q: 80,
    fit: "thumb",
    f: "center",
  });

  if (imgUrl) {
    return (
      <img
        src={imgUrl}
        alt={fallback}
        className={`${className} object-contain`}
        style={{ padding: "2px" }}
      />
    );
  }

  return (
    <span className={`flex items-center justify-center ${className}`}>
      {fallback}
    </span>
  );
}
