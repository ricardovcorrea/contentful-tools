import { useAsset } from "~/lib/contentful/get-asset";
import { resolveImageUrl } from "~/lib/format";

/**
 * Renders a logo image loaded lazily from a Contentful asset ID.
 * Falls back to an initials span when the asset is loading or unavailable.
 *
 * Two rendering modes:
 *
 * 1. Free-form (default): image renders at natural aspect ratio, `size` px tall.
 *    `className` applies only to the fallback span.
 *
 * 2. Fixed-box (when `boxWidth` is provided): both the image and the fallback
 *    span are rendered inside a fixed `boxWidth × size` box. The image uses
 *    `object-contain` so it scales to fill without cropping or overflow.
 *    All items with the same `boxWidth`/`size` will occupy identical space.
 */
export function LogoAvatar({
  assetId,
  fallback,
  className,
  size = 24,
  boxWidth,
}: {
  assetId?: string;
  fallback: string;
  className: string;
  /** Height in px for the rendered image / fallback box. Default 24. */
  size?: number;
  /** When set, renders image in a fixed width×height box using object-contain. */
  boxWidth?: number;
}) {
  const { data: asset } = useAsset(assetId);

  const fields = asset?.fields ?? {};
  const file = (Object.values(fields["file"] ?? {}) as any[])[0] as any;

  const imgUrl = resolveImageUrl(file?.url, {
    w: (boxWidth ?? size * 4) * 2,
    fm: "webp",
    q: 85,
    fit: "scale",
  });

  if (imgUrl) {
    if (boxWidth) {
      return (
        <img
          src={imgUrl}
          alt={fallback}
          className="shrink-0 block object-contain"
          style={{ width: boxWidth, height: size }}
        />
      );
    }
    return (
      <img
        src={imgUrl}
        alt={fallback}
        className="object-contain shrink-0 block"
        style={{ height: size, width: "auto", maxWidth: size * 4 }}
      />
    );
  }

  if (boxWidth) {
    return (
      <span
        className={`flex items-center justify-center shrink-0 ${className}`}
        style={{ width: boxWidth, height: size }}
      >
        {fallback}
      </span>
    );
  }

  return (
    <span className={`flex items-center justify-center ${className}`}>
      {fallback}
    </span>
  );
}
