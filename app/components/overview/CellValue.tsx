import { useState, useEffect } from "react";
import { getAsset } from "~/lib/contentful/get-asset";
import { getEntry } from "~/lib/contentful/get-entry";
import { isRichText, extractRichTextPlain } from "~/lib/rich-text";

// ── Asset helpers ─────────────────────────────────────────────────────────

function resolveAssetUrl(url: string | undefined): string | null {
  if (!url) return null;
  return url.startsWith("//") ? `https:${url}` : url;
}

export function AssetCell({
  assetId,
  firstLocale,
}: {
  assetId: string;
  firstLocale: string;
}) {
  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAsset(assetId)
      .then((a) => {
        if (!cancelled) {
          setAsset(a);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  const fields = asset?.fields ?? {};
  const title =
    fields["title"]?.[firstLocale] ??
    (Object.values(fields["title"] ?? {}) as string[])[0] ??
    assetId;
  const fileObj =
    fields["file"]?.[firstLocale] ??
    (Object.values(fields["file"] ?? {}) as any[])[0];
  const url = resolveAssetUrl(fileObj?.url);
  const contentType: string = fileObj?.contentType ?? "";
  const isImage = contentType.startsWith("image/");

  if (loading) {
    return (
      <span
        className="inline-block h-4 w-20 bg-gray-200 rounded"
        style={{ animation: "skeleton-shimmer 1.4s ease-in-out infinite" }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-1 py-0.5">
      {isImage && url && (
        <img
          src={url}
          alt={typeof title === "string" ? title : assetId}
          className="max-h-20 max-w-full rounded object-contain"
        />
      )}
      <span className="text-xs text-gray-500">
        {typeof title === "string" ? title : assetId}
      </span>
      <span className="font-mono text-[10px] text-gray-600">
        {assetId.slice(0, 8)}…
      </span>
    </div>
  );
}

/** Fetches an entry and renders the first image asset it contains. */
function EntryImageCell({
  entryId,
  firstLocale,
}: {
  entryId: string;
  firstLocale: string;
}) {
  const [assetId, setAssetId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getEntry(entryId)
      .then((entry) => {
        if (cancelled) return;
        const fields = entry?.fields ?? {};
        let found: string | null = null;
        outer: for (const localeMap of Object.values(fields)) {
          const val =
            (localeMap as any)?.[firstLocale] ??
            Object.values((localeMap as any) ?? {})[0];
          if (val?.sys?.linkType === "Asset" && val?.sys?.id) {
            found = val.sys.id;
            break outer;
          }
          if (Array.isArray(val)) {
            for (const v of val) {
              if (v?.sys?.linkType === "Asset" && v?.sys?.id) {
                found = v.sys.id;
                break outer;
              }
            }
          }
        }
        setAssetId(found);
        setChecked(true);
      })
      .catch(() => setChecked(true));
    return () => {
      cancelled = true;
    };
  }, [entryId, firstLocale]);

  return (
    <div className="flex flex-col gap-1">
      {!checked && (
        <span
          className="inline-block h-4 w-20 bg-gray-200 rounded"
          style={{ animation: "skeleton-shimmer 1.4s ease-in-out infinite" }}
        />
      )}
      {assetId && <AssetCell assetId={assetId} firstLocale={firstLocale} />}
      <span className="font-mono text-[10px] text-gray-600">
        ref:{entryId.slice(0, 8)}…
      </span>
    </div>
  );
}

// ── Main CellValue component ───────────────────────────────────────────────

/** Renders a single locale cell value from a Contentful field. */
export function CellValue({
  value,
  firstLocale,
  fieldId,
}: {
  value: unknown;
  firstLocale: string;
  fieldId?: string;
}) {
  if (value === undefined || value === null || value === "") {
    return (
      <span className="inline-flex items-center gap-1 text-red-400/80 italic text-xs font-medium">
        <svg
          className="w-3 h-3 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
        missing
      </span>
    );
  }
  if (typeof value === "string") {
    return (
      <span className="text-gray-700 text-sm wrap-break-word">{value}</span>
    );
  }
  if (typeof value === "boolean") {
    return value ? (
      <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold">
        <svg
          className="w-3.5 h-3.5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
        true
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-gray-400 text-xs font-semibold">
        <svg
          className="w-3.5 h-3.5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
        false
      </span>
    );
  }
  // Contentful Rich Text Document — render as readable plain text
  if (isRichText(value)) {
    const text = extractRichTextPlain(value).trim();
    return text ? (
      <span className="text-gray-700 text-sm wrap-break-word whitespace-pre-wrap leading-relaxed">
        {text}
      </span>
    ) : (
      <span className="text-gray-400 italic text-xs">empty rich text</span>
    );
  }
  if (typeof value === "object" && value !== null) {
    const sys = (value as any)?.sys;
    if (sys?.linkType === "Asset" && sys?.id)
      return <AssetCell assetId={sys.id} firstLocale={firstLocale} />;
    if (Array.isArray(value)) {
      const allAssets = value.every(
        (v) => (v as any)?.sys?.linkType === "Asset",
      );
      if (allAssets && value.length > 0) {
        return (
          <div className="flex flex-col gap-1.5">
            {(value as any[]).map((v) => (
              <AssetCell
                key={v.sys.id}
                assetId={v.sys.id}
                firstLocale={firstLocale}
              />
            ))}
          </div>
        );
      }
      return (
        <span className="text-xs text-gray-500 italic">
          {value.length} reference{value.length !== 1 ? "s" : ""}
        </span>
      );
    }
    if (sys?.linkType === "Entry" && sys?.id) {
      const looksLikeImage = fieldId != null && /image/i.test(fieldId);
      if (looksLikeImage)
        return <EntryImageCell entryId={sys.id} firstLocale={firstLocale} />;
      return (
        <span className="font-mono text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
          ref:{sys.id.slice(0, 8)}…
        </span>
      );
    }
    if (sys?.id) {
      return (
        <span className="font-mono text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
          ref:{sys.id.slice(0, 8)}…
        </span>
      );
    }
  }
  return (
    <span className="font-mono text-xs text-gray-600">
      {JSON.stringify(value).slice(0, 80)}
    </span>
  );
}
