import type { SitemapPage } from "~/lib/contentful/sitemap";
import { StatusDot, ScopeTag, SitemapToggle } from "./SitemapToggle";

export function PageRow({
  page,
  spaceId,
  environmentId,
  pending = false,
  onToggle,
}: {
  page: SitemapPage;
  spaceId: string;
  environmentId: string;
  pending?: boolean;
  onToggle?: (page: SitemapPage, newIncluded: boolean) => void;
}) {
  const url = `https://app.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries/${page.sysId}`;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors group">
      <StatusDot status={page.status} />
      <ScopeTag scope={page.scope} />

      {/* Name + path — link to Contentful */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 min-w-0"
      >
        <p className="text-xs font-semibold text-gray-800 truncate group-hover:text-gray-900 hover:text-sky-600 transition-colors">
          {page.name}
        </p>
        {page.slug ? (
          <p className="flex items-center gap-1 text-[10px] font-mono text-gray-400 truncate tracking-tight mt-0.5">
            <svg
              className="w-2.5 h-2.5 shrink-0 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            {page.slug.startsWith("/") ? page.slug : `/${page.slug}`}
          </p>
        ) : (
          <p className="flex items-center gap-1 text-[10px] text-gray-300 italic mt-0.5">
            <svg
              className="w-2.5 h-2.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
            no path
          </p>
        )}
      </a>

      {/* Page type badge */}
      {page.pageType && (
        <span className="shrink-0 text-[8px] font-semibold uppercase px-1.5 py-0.5 rounded border border-sky-200/60 text-sky-500 bg-sky-50">
          {page.pageType}
        </span>
      )}

      {/* Sitemap field / reason label */}
      <div className="shrink-0 hidden sm:flex items-center gap-1 max-w-[160px]">
        {page.sitemapField ? (
          <span className="inline-flex items-center gap-1 text-[9px] font-medium bg-sky-50 border border-sky-200/60 text-sky-600 px-1.5 py-0.5 rounded truncate">
            Add to sitemap
          </span>
        ) : (
          <span className="text-[9px] text-gray-400 truncate leading-tight">
            {page.sitemapReason}
          </span>
        )}
      </div>

      {/* Toggle */}
      <SitemapToggle
        included={page.sitemapIncluded}
        pending={pending}
        fieldName={page.sitemapField}
        onChange={() => onToggle?.(page, !page.sitemapIncluded)}
      />
    </div>
  );
}
