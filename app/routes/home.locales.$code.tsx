import { useParams, useRouteLoaderData } from "react-router";

type ParentLoaderData = {
  locales: {
    items: {
      code: string;
      name: string;
      default?: boolean;
      fallbackCode?: string | null;
      optional?: boolean;
    }[];
  };
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

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 px-4 py-3 border-b border-gray-200/70 last:border-0">
      <span className="font-mono text-[11px] text-gray-500 w-32 shrink-0 pt-0.5 truncate">
        {label}
      </span>
      <span className="text-sm text-gray-800 min-w-0 break-all">
        {children}
      </span>
    </div>
  );
}

export default function LocaleDetailPage() {
  const { code } = useParams<{ code: string }>();
  const parentData = useRouteLoaderData("routes/home") as ParentLoaderData;
  if (!parentData) return null;

  const { allLocales, spaceId, environmentId } = parentData;
  const locale = allLocales.items.find((l) => l.code === code);

  if (!locale) {
    return (
      <main className="flex-1 overflow-y-auto p-6 sm:p-8 bg-gray-50">
        <div className="pt-16 text-gray-600 text-sm">Locale not found.</div>
      </main>
    );
  }

  const fallbackLocale = locale.fallbackCode
    ? allLocales.items.find((l) => l.code === locale.fallbackCode)
    : null;

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-6 sm:px-8 pt-6">
        {/* Title row */}
        <div className="flex items-start justify-between gap-4 pb-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-sky-600 uppercase tracking-widest mb-1">
              Locale
            </p>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight flex items-center gap-2">
              {locale.name}
              {locale.default && (
                <span className="text-[10px] font-bold uppercase tracking-wide bg-sky-500/10 text-sky-600 border border-sky-200/60 px-1.5 py-0.5 rounded-full">
                  Default
                </span>
              )}
              {locale.optional && (
                <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-500/10 text-amber-600 border border-amber-200/60 px-1.5 py-0.5 rounded-full">
                  Optional
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-400 mt-1 font-mono">
              {locale.code}
            </p>
          </div>
        </div>

        {/* Toolbar row */}
        <div className="flex items-center gap-2 flex-wrap pb-3">
          <a
            href={`https://app.contentful.com/spaces/${spaceId}/environments/${environmentId}/locales`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-[10px] font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <svg
              className="w-3 h-3 shrink-0"
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
            Open in Contentful
          </a>
        </div>
      </div>

      {/* Fields */}
      <div className="px-6 sm:px-8 py-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <FieldRow label="name">{locale.name}</FieldRow>
          <FieldRow label="code">
            <span className="font-mono">{locale.code}</span>
          </FieldRow>
          <FieldRow label="default">
            {locale.default ? (
              <span className="inline-flex items-center gap-1 text-sky-700">
                <svg
                  className="w-3.5 h-3.5 text-sky-500"
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
              <span className="italic text-gray-400">false</span>
            )}
          </FieldRow>
          <FieldRow label="optional">
            {locale.optional ? (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <svg
                  className="w-3.5 h-3.5 text-amber-500"
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
              <span className="italic text-gray-400">false</span>
            )}
          </FieldRow>
          <FieldRow label="fallbackCode">
            {fallbackLocale ? (
              <>
                {fallbackLocale.name}{" "}
                <span className="font-mono text-gray-500">
                  ({fallbackLocale.code})
                </span>
              </>
            ) : locale.fallbackCode ? (
              <span className="font-mono">{locale.fallbackCode}</span>
            ) : (
              <span className="italic text-gray-400">—</span>
            )}
          </FieldRow>
        </div>
      </div>
    </main>
  );
}
