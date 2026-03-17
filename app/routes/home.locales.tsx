import { useState } from "react";
import { useRouteLoaderData } from "react-router";

type Locale = {
  code: string;
  name: string;
  default?: boolean;
  fallbackCode?: string | null;
  optional?: boolean;
};

type ParentLoaderData = {
  allLocales: { items: Locale[] };
  spaceId: string;
  environmentId: string;
};

export default function LocalesPage() {
  const parentData = useRouteLoaderData("routes/home") as ParentLoaderData;
  if (!parentData) return null;

  const { allLocales, spaceId, environmentId } = parentData;
  const allItems = allLocales.items;

  const [filterType, setFilterType] = useState<"all" | "default" | "optional">(
    "all",
  );

  const visible = allItems.filter((l) => {
    if (filterType === "default" && !l.default) return false;
    if (filterType === "optional" && !l.optional) return false;
    return true;
  });

  const defaultCount = allItems.filter((l) => l.default).length;
  const optionalCount = allItems.filter((l) => l.optional).length;

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-6 sm:px-8 pt-6">
        <div className="flex items-start justify-between gap-4 pb-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-sky-600 uppercase tracking-widest mb-1">
              Environment · OPCO
            </p>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              Locales
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Language and region settings available for content translation
            </p>
          </div>
          {allItems.length > 0 && (
            <span className="shrink-0 text-sm font-bold px-2.5 py-1 rounded-full bg-sky-100 text-sky-700 border border-sky-200/60 tabular-nums mt-1">
              {allItems.length}
            </span>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap pb-3">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-[10px] font-semibold">
            {(["all", "default", "optional"] as const).map((f) => (
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
                  ? `All (${allItems.length})`
                  : f === "default"
                    ? `Default (${defaultCount})`
                    : `Optional (${optionalCount})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 sm:px-8 py-6">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-400">
            <div className="w-16 h-16 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-sky-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0 0c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 18c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3M3.5 9h17M3.5 15h17"
                />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-600">
                No locales found
              </p>
              <p className="text-xs text-gray-400 mt-1">
                This environment has no locales configured yet
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map((locale) => (
              <div
                key={locale.code}
                className="flex items-center gap-4 px-5 py-3.5 rounded-xl border border-gray-200 bg-white transition-colors"
              >
                {/* Language tag badge */}
                <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">
                  {locale.code.split("-")[0].toUpperCase()}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">
                      {locale.name}
                    </span>
                    {locale.default && (
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-sky-500/10 text-sky-600 border border-sky-200/60 px-1.5 py-0.5 rounded">
                        Default
                      </span>
                    )}
                    {locale.optional && (
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-500/10 text-amber-600 border border-amber-200/60 px-1.5 py-0.5 rounded">
                        Optional
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      {locale.code}
                    </span>
                    {locale.fallbackCode && (
                      <span className="text-[10px] text-gray-400">
                        Fallback:{" "}
                        <span className="font-mono text-gray-500">
                          {locale.fallbackCode}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Open in Contentful */}
                <a
                  href={`https://app.contentful.com/spaces/${spaceId}/environments/${environmentId}/settings/locales`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in Contentful"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-gray-200 text-gray-400 hover:text-sky-500 hover:border-sky-300 hover:bg-sky-50 transition-colors shrink-0"
                >
                  <svg
                    className="w-3.5 h-3.5"
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
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
