import { useState } from "react";
import { useRouteLoaderData } from "react-router";
import { resolveStringField } from "~/lib/resolve-string-field";
import { SitemapSection } from "~/components/overview/SitemapSection";
import { useEditMode } from "~/lib/edit-mode";

export default function SitemapPage() {
  const loaderData = useRouteLoaderData("routes/home") as any;
  if (!loaderData) return null;

  const {
    opcos,
    opcoId,
    partnerId,
    opcoPartners,
    opcoPages,
    locales,
    spaceId,
    environmentId,
  } = loaderData;

  const firstLocale = locales.items[0]?.code ?? "en";

  const opcoEntry = opcos.items.find(
    (o: any) => resolveStringField(o.fields["id"], firstLocale) === opcoId,
  );
  const opcoName: string =
    resolveStringField(opcoEntry?.fields?.["internalName"], firstLocale) ||
    resolveStringField(opcoEntry?.fields?.["title"], firstLocale) ||
    opcoId;

  const partnerEntry = opcoPartners.items.find(
    (p: any) =>
      (resolveStringField(p.fields["id"], firstLocale) || p.sys.id) ===
      partnerId,
  );
  const partnerName: string =
    (partnerEntry
      ? resolveStringField(partnerEntry.fields["internalName"], firstLocale) ||
        resolveStringField(partnerEntry.fields["title"], firstLocale)
      : null) ?? partnerId;

  const { editMode } = useEditMode();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "included" | "excluded">(
    "all",
  );
  const [counts, setCounts] = useState({ included: 0, excluded: 0 });

  const totalCount = counts.included + counts.excluded;

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-6 sm:px-8 pt-6">
        <div className="flex items-start justify-between gap-4 pb-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-sky-600 uppercase tracking-widest mb-1">
              {opcoName}
              {partnerId ? ` · ${partnerName}` : ""}
            </p>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              Sitemap
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Page inclusion status across the selected OPCO and partner
              configuration
            </p>
          </div>
          {totalCount > 0 && (
            <span className="shrink-0 text-sm font-bold px-2.5 py-1 rounded-full bg-sky-100 text-sky-700 border border-sky-200/60 tabular-nums mt-1">
              {totalCount}
            </span>
          )}
        </div>

        {/* Filters + search */}
        <div className="flex items-center gap-2 flex-wrap pb-3">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-[10px] font-semibold">
            {(["all", "included", "excluded"] as const).map((f) => (
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
                  ? `All (${totalCount})`
                  : f === "included"
                    ? `In sitemap (${counts.included})`
                    : `Not in sitemap (${counts.excluded})`}
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
              placeholder="Search by name or slug…"
              className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-sky-400"
            />
          </div>
        </div>
      </div>

      <div className="px-6 sm:px-8 py-6">
        <SitemapSection
          opcoName={opcoName}
          opcoPages={opcoPages}
          opcoPartners={opcoPartners}
          firstLocale={firstLocale}
          spaceId={spaceId}
          environmentId={environmentId}
          opcoId={opcoId}
          partnerId={partnerId}
          search={search}
          filterType={filterType}
          editMode={editMode}
          onCountsChange={(included, excluded) =>
            setCounts((prev) =>
              prev.included === included && prev.excluded === excluded
                ? prev
                : { included, excluded },
            )
          }
        />
      </div>
    </main>
  );
}
