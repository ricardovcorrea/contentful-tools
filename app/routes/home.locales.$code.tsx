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

  const { locales, spaceId, environmentId } = parentData;
  const locale = locales.items.find((l) => l.code === code);

  if (!locale) {
    return (
      <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-gray-50">
        <div className="pt-16 text-gray-600 text-sm">Locale not found.</div>
      </main>
    );
  }

  const fallbackLocale = locale.fallbackCode
    ? locales.items.find((l) => l.code === locale.fallbackCode)
    : null;

  return (
    <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-gray-50">
      {/* Header */}
      <div className="mb-4">
        <span className="text-xs font-semibold text-sky-600 bg-sky-500/15 px-2 py-0.5 rounded-full">
          Locale
        </span>
        <div className="mt-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
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
            </h2>
            <a
              href={`https://app.contentful.com/spaces/${spaceId}/environments/${environmentId}/locales`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors"
            >
              <svg
                className="w-3.5 h-3.5 shrink-0"
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
          <p className="text-xs text-gray-500 mt-1 font-mono">{locale.code}</p>
        </div>
      </div>

      {/* Fields */}
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
    </main>
  );
}
