import { useRouteLoaderData } from "react-router";

type ParentLoaderData = {
  allLocales: {
    items: {
      code: string;
      name: string;
      default?: boolean;
      fallbackCode?: string | null;
      optional?: boolean;
    }[];
  };
  spaceId: string;
  environmentId: string;
};

export default function LocalesPage() {
  const parentData = useRouteLoaderData("routes/home") as ParentLoaderData;
  if (!parentData) return null;

  const { allLocales: locales, spaceId, environmentId } = parentData;

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-gray-50">
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
          Space configuration
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Locales</h1>
        <p className="text-sm text-gray-500 mt-1">
          {locales.items.length} locale
          {locales.items.length !== 1 ? "s" : ""} configured in this
          environment.
        </p>
      </div>

      {/* Locale cards */}
      <div className="flex flex-col gap-3 max-w-2xl">
        {locales.items.map((locale) => (
          <div
            key={locale.code}
            className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-4 shadow-sm"
          >
            {/* Badge */}
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wide leading-none text-center">
                {locale.code.split("-")[0]}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-900">
                  {locale.name}
                </span>
                {locale.default && (
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-blue-500/10 text-blue-600 border border-blue-200/60 px-1.5 py-0.5 rounded">
                    Default
                  </span>
                )}
                {locale.optional && (
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-500/10 text-amber-600 border border-amber-200/60 px-1.5 py-0.5 rounded">
                    Optional
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <span className="text-xs font-mono text-gray-500">
                  {locale.code}
                </span>
                {locale.fallbackCode && (
                  <span className="text-xs text-gray-400">
                    Fallback:{" "}
                    <span className="font-mono text-gray-500">
                      {locale.fallbackCode}
                    </span>
                  </span>
                )}
              </div>
            </div>

            <a
              href={`https://app.contentful.com/spaces/${spaceId}/environments/${environmentId}/locales`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
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
              Contentful
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
