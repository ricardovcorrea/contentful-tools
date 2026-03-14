import { useState, useEffect } from "react";
import { getAsset } from "~/lib/contentful/get-asset";

/**
 * Renders a logo image loaded lazily from a Contentful asset ID.
 * Falls back to an initials span when the asset is loading or unavailable.
 * `className` is applied to both the fallback <span> and the <img> – it should
 * include size, border, background, text-color, and rounding utility classes.
 */
export function LogoAvatar({
  assetId,
  fallback,
  className,
}: {
  assetId?: string;
  fallback: string;
  className: string;
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    getAsset(assetId)
      .then((a) => {
        if (cancelled) return;
        const fields = a?.fields ?? {};
        const file = (Object.values(fields["file"] ?? {}) as any[])[0] as any;
        const url: string | undefined = file?.url;
        if (url) setImgUrl(url.startsWith("//") ? `https:${url}` : url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [assetId]);

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
