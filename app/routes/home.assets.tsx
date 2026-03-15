import { useState, useEffect, useMemo } from "react";
import { useRouteLoaderData, useNavigate } from "react-router";
import { getContentfulManagementEnvironment } from "~/lib/contentful";
import { resolveStringField } from "~/lib/resolve-string-field";
import type { RefGroup } from "~/lib/contentful/get-entry-tree";

type ParentLoaderData = {
  spaceId: string;
  environmentId: string;
  envStats: { totalAssets: number | null };
  firstLocale?: string;
  opcoId: string;
  partnerId: string;
  opcoPages: { items: any[] };
  opcoMessages: { items: any[] };
  partnerPages: { items: any[] };
  partnerMessages: { items: any[] };
  partnerEmails: { items: any[] };
  opcoRefGroups: RefGroup[];
  partnerRefGroups: RefGroup[];
};

type Asset = {
  sys: { id: string; updatedAt: string; createdAt: string };
  fields: {
    title?: Record<string, string>;
    description?: Record<string, string>;
    file?: Record<
      string,
      {
        url: string;
        fileName: string;
        contentType: string;
        details?: { size?: number; image?: { width: number; height: number } };
      }
    >;
  };
};

type AssetRef = { entryId: string; name: string; scope: string };

/** Walk all field values of an entry and collect referenced asset IDs */
function collectAssetIds(fields: Record<string, any>): string[] {
  const ids: string[] = [];
  function walk(val: unknown) {
    if (!val || typeof val !== "object") return;
    if (Array.isArray(val)) {
      val.forEach(walk);
      return;
    }
    const s = (val as any)?.sys;
    if (s?.linkType === "Asset" && s?.id) {
      ids.push(s.id);
      return;
    }
    // recurse into object values (rich text nodes, nested objects)
    for (const v of Object.values(val as object)) walk(v);
  }
  for (const localeMap of Object.values(fields)) {
    if (localeMap && typeof localeMap === "object") {
      for (const v of Object.values(localeMap as object)) walk(v);
    }
  }
  return ids;
}

/** Build a map of assetId → list of unique entries that reference it */
function buildAssetRefMap(
  groups: { items: any[]; scope: string; label: string }[],
  firstLocale: string,
): Map<string, AssetRef[]> {
  const map = new Map<string, AssetRef[]>();
  for (const { items, scope, label } of groups) {
    for (const entry of items) {
      const name =
        resolveStringField(entry.fields?.["internalName"], firstLocale) ||
        resolveStringField(entry.fields?.["title"], firstLocale) ||
        entry.sys.id;
      const assetIds = collectAssetIds(entry.fields ?? {});
      for (const assetId of [...new Set(assetIds)]) {
        const refs = map.get(assetId) ?? [];
        if (!refs.some((r) => r.entryId === entry.sys.id)) {
          refs.push({
            entryId: entry.sys.id,
            name,
            scope: `${scope} · ${label}`,
          });
        }
        map.set(assetId, refs);
      }
    }
  }
  return map;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function resolveAssetUrl(url: string | undefined): string | null {
  if (!url) return null;
  return url.startsWith("//") ? `https:${url}` : url;
}

export default function AssetsPage() {
  const parentData = useRouteLoaderData("routes/home") as ParentLoaderData;
  const {
    spaceId,
    environmentId,
    envStats,
    opcoId,
    partnerId,
    opcoPages,
    opcoMessages,
    partnerPages,
    partnerMessages,
    partnerEmails,
    opcoRefGroups,
    partnerRefGroups,
  } = parentData ?? {};
  const firstLocale = parentData?.firstLocale ?? "en-GB";
  const navigate = useNavigate();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "images" | "documents">(
    "all",
  );

  // Build asset → entry reference map from all loaded entry collections
  const assetRefMap = useMemo<Map<string, AssetRef[]>>(() => {
    const groups: { items: any[]; scope: string; label: string }[] = [
      ...(opcoPages
        ? [{ items: opcoPages.items, scope: "opco", label: "Pages" }]
        : []),
      ...(opcoMessages
        ? [{ items: opcoMessages.items, scope: "opco", label: "Messages" }]
        : []),
      ...(opcoRefGroups ?? []).map((g) => ({
        items: g.items,
        scope: "opco",
        label: g.label,
      })),
      ...(partnerPages
        ? [{ items: partnerPages.items, scope: "partner", label: "Pages" }]
        : []),
      ...(partnerMessages
        ? [
            {
              items: partnerMessages.items,
              scope: "partner",
              label: "Messages",
            },
          ]
        : []),
      ...(partnerEmails
        ? [{ items: partnerEmails.items, scope: "partner", label: "Emails" }]
        : []),
      ...(partnerRefGroups ?? []).map((g) => ({
        items: g.items,
        scope: "partner",
        label: g.label,
      })),
    ];
    return buildAssetRefMap(groups, firstLocale);
  }, [
    opcoPages,
    opcoMessages,
    opcoRefGroups,
    partnerPages,
    partnerMessages,
    partnerEmails,
    partnerRefGroups,
    firstLocale,
  ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const environment = await getContentfulManagementEnvironment();
        const total = envStats?.totalAssets ?? 0;
        const limit = 200;
        const batches = Math.ceil(Math.max(total, 1) / limit);
        const results: Asset[] = [];

        for (let i = 0; i < batches; i++) {
          if (cancelled) return;
          const page = await environment.getAssets({
            limit,
            skip: i * limit,
          });
          results.push(...(page.items as Asset[]));
        }

        if (!cancelled) {
          setAssets(results);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Failed to load assets");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [environmentId, spaceId]);

  const filtered = search.trim()
    ? assets.filter((a) => {
        const q = search.toLowerCase();
        const title = Object.values(a.fields.title ?? {})
          .join(" ")
          .toLowerCase();
        const file = Object.values(a.fields.file ?? {})
          .map((f) => f.fileName)
          .join(" ")
          .toLowerCase();
        const refs = (assetRefMap.get(a.sys.id) ?? [])
          .map((r) => r.name + " " + r.scope)
          .join(" ")
          .toLowerCase();
        return (
          title.includes(q) ||
          file.includes(q) ||
          a.sys.id.toLowerCase().includes(q) ||
          refs.includes(q)
        );
      })
    : assets;

  // Show assets referenced by OPCO or partner content
  const opcoFiltered = filtered.filter((a) =>
    (assetRefMap.get(a.sys.id) ?? []).some(
      (r) => r.scope.startsWith("opco") || r.scope.startsWith("partner"),
    ),
  );

  const imagesCount = opcoFiltered.filter((a) => {
    const file =
      a.fields.file?.[firstLocale] ??
      (Object.values(a.fields.file ?? {}) as any[])[0];
    return (file?.contentType ?? "").startsWith("image/");
  }).length;
  const documentsCount = opcoFiltered.length - imagesCount;

  const visibleAssets = opcoFiltered.filter((a) => {
    if (filterType === "all") return true;
    const file =
      a.fields.file?.[firstLocale] ??
      (Object.values(a.fields.file ?? {}) as any[])[0];
    const isImg = (file?.contentType ?? "").startsWith("image/");
    return filterType === "images" ? isImg : !isImg;
  });

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50">
      {/* Sticky inner header */}
      <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-6 sm:px-8 pt-6">
        <div className="flex items-start justify-between gap-4 pb-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-sky-600 uppercase tracking-widest mb-1">
              {opcoId}
              {partnerId ? ` · ${partnerId}` : ""}
            </p>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              Assets
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {loading
                ? "Loading assets…"
                : `${visibleAssets.length} asset${
                    visibleAssets.length !== 1 ? "s" : ""
                  } referenced by content`}
            </p>
          </div>
          {!loading && opcoFiltered.length > 0 && (
            <span className="shrink-0 text-sm font-bold px-2.5 py-1 rounded-full bg-sky-100 text-sky-700 border border-sky-200/60 tabular-nums mt-1">
              {opcoFiltered.length}
            </span>
          )}
        </div>

        {/* Filters + search */}
        <div className="flex items-center gap-2 flex-wrap pb-3">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-[10px] font-semibold">
            {(["all", "images", "documents"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-2.5 py-1 transition-colors capitalize ${
                  filterType === f
                    ? "bg-gray-800 text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                {f === "all"
                  ? `All (${opcoFiltered.length})`
                  : f === "images"
                    ? `Images (${imagesCount})`
                    : `Documents (${documentsCount})`}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-45 max-w-xs">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or filename…"
              className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-sky-400"
            />
          </div>
        </div>
      </div>

      <div className="px-6 sm:px-8 py-4">
        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4">
            {Array.from({ length: 18 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                style={{
                  animation: "skeleton-shimmer 1.4s ease-in-out infinite",
                }}
              >
                <div className="h-32 bg-gray-200" />
                <div className="p-3 flex flex-col gap-1.5">
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-2.5 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && visibleAssets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
            <svg
              className="w-10 h-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm font-medium">
              {search ? "No assets match your search" : "No assets found"}
            </p>
          </div>
        )}

        {/* Grid — grouped by content type (OPCO then Partner) */}
        {!loading &&
          visibleAssets.length > 0 &&
          (() => {
            // Build ordered map: "opco · Pages" / "partner · Pages" → assets
            const groupMap = new Map<string, typeof filtered>();
            for (const asset of visibleAssets) {
              const relevantRefs = (assetRefMap.get(asset.sys.id) ?? []).filter(
                (r) =>
                  r.scope.startsWith("opco") || r.scope.startsWith("partner"),
              );
              const scopeKeys = [...new Set(relevantRefs.map((r) => r.scope))];
              // Sort so opco groups come before partner groups
              scopeKeys.sort((a, b) => {
                const aIsOpco = a.startsWith("opco") ? 0 : 1;
                const bIsOpco = b.startsWith("opco") ? 0 : 1;
                return aIsOpco - bIsOpco || a.localeCompare(b);
              });
              for (const key of scopeKeys) {
                const group = groupMap.get(key) ?? [];
                if (!group.some((a) => a.sys.id === asset.sys.id))
                  group.push(asset);
                groupMap.set(key, group);
              }
            }

            const renderGrid = (items: typeof filtered) => (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4">
                {items.map((asset) => {
                  const fileMap = asset.fields.file ?? {};
                  const file =
                    fileMap[firstLocale] ?? Object.values(fileMap)[0] ?? null;
                  const titleMap = asset.fields.title ?? {};
                  const title =
                    titleMap[firstLocale] ??
                    Object.values(titleMap)[0] ??
                    file?.fileName ??
                    asset.sys.id;
                  const url = resolveAssetUrl(file?.url);
                  const contentType = file?.contentType ?? "";
                  const isImage = contentType.startsWith("image/");
                  const size = file?.details?.size;
                  const dims = file?.details?.image;
                  const ext =
                    file?.fileName?.split(".").pop()?.toUpperCase() ?? "";
                  const refs = assetRefMap.get(asset.sys.id) ?? [];

                  return (
                    <div
                      key={asset.sys.id}
                      className="group rounded-xl border border-gray-200 bg-white overflow-hidden hover:border-sky-300 hover:shadow-md transition-all flex flex-col"
                    >
                      {/* Thumbnail area */}
                      <div className="h-32 bg-gray-100 flex items-center justify-center overflow-hidden relative shrink-0">
                        {isImage && url ? (
                          <img
                            src={`${url}?w=260&h=128&fit=thumb`}
                            alt={title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 text-gray-400">
                            <svg
                              className="w-8 h-8"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={1.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            {ext && (
                              <span className="text-[10px] font-bold uppercase tracking-wide bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">
                                {ext}
                              </span>
                            )}
                          </div>
                        )}
                        {/* Used-in count badge */}
                        {refs.length > 0 && (
                          <div className="absolute top-1.5 left-1.5">
                            <span className="flex items-center gap-0.5 text-[9px] font-bold bg-black/50 text-white px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                              <svg
                                className="w-2.5 h-2.5 shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2.5}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                                />
                              </svg>
                              {refs.length}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-2.5 flex flex-col gap-0.5 flex-1 min-w-0">
                        <p
                          className="text-xs font-semibold text-gray-800 truncate leading-snug"
                          title={title}
                        >
                          {title}
                        </p>
                        {dims && (
                          <p className="text-[10px] text-gray-400 tabular-nums">
                            {dims.width} × {dims.height}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {ext && !isImage && (
                            <span className="text-[9px] font-bold bg-gray-100 text-gray-500 px-1 py-0.5 rounded uppercase">
                              {ext}
                            </span>
                          )}
                          {size !== undefined && (
                            <span className="text-[9px] text-gray-400 tabular-nums">
                              {formatBytes(size)}
                            </span>
                          )}
                        </div>
                        {/* Referenced-by list */}
                        {refs.length > 0 && (
                          <div className="mt-1.5 flex flex-col gap-0.5">
                            {refs.slice(0, 3).map((ref) => (
                              <button
                                key={ref.entryId}
                                onClick={() =>
                                  navigate(`/entry/${ref.entryId}`)
                                }
                                className="flex items-center gap-1 min-w-0 text-left hover:opacity-70 transition-opacity"
                                title={`Open ${ref.name} (${ref.scope})`}
                              >
                                <div
                                  className={`w-1 h-1 rounded-full shrink-0 ${ref.scope.startsWith("opco") ? "bg-violet-400" : "bg-emerald-400"}`}
                                />
                                <span className="text-[9px] text-gray-500 truncate underline underline-offset-2 decoration-gray-300">
                                  {ref.name}
                                </span>
                              </button>
                            ))}
                            {refs.length > 3 && (
                              <span className="text-[9px] text-gray-400 italic">
                                +{refs.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-1.5">
                          <p className="text-[9px] font-mono text-gray-300 truncate">
                            {asset.sys.id}
                          </p>
                          <a
                            href={`https://app.contentful.com/spaces/${spaceId}/environments/${environmentId}/assets/${asset.sys.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 ml-1.5 flex items-center gap-0.5 text-[9px] text-gray-400 hover:text-gray-700 transition-colors"
                            title="Open in Contentful"
                          >
                            <svg
                              className="w-2.5 h-2.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                            Contentful
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );

            return (
              <div className="flex flex-col gap-8">
                {[...groupMap.entries()].map(([scopeKey, items]) => {
                  const isOpco = scopeKey.startsWith("opco");
                  const label = scopeKey.split(" · ")[1] ?? scopeKey;
                  const prefix = isOpco
                    ? opcoId || "OPCO"
                    : partnerId || "Partner";
                  return (
                    <section key={scopeKey}>
                      <div className="flex items-center gap-2 mb-3">
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                            isOpco
                              ? "bg-violet-100 text-violet-600"
                              : "bg-emerald-100 text-emerald-600"
                          }`}
                        >
                          {prefix}
                        </span>
                        <h2 className="text-sm font-bold text-gray-700">
                          {label}
                        </h2>
                        <span
                          className={`text-[11px] font-semibold border px-1.5 py-0.5 rounded-full tabular-nums ${
                            isOpco
                              ? "bg-violet-500/10 text-violet-600 border-violet-300/30"
                              : "bg-emerald-500/10 text-emerald-600 border-emerald-300/30"
                          }`}
                        >
                          {items.length}
                        </span>
                      </div>
                      {renderGrid(items)}
                    </section>
                  );
                })}
              </div>
            );
          })()}
      </div>
    </main>
  );
}
