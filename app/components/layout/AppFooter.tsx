import { formatCacheTime } from "~/lib/format";

interface Props {
  maskedToken: string;
  cacheLastUpdated: number | null;
  isLoading: boolean;
  onRefreshCache: () => void;
  cacheTtlMs: number;
}

export function AppFooter({
  maskedToken,
  cacheLastUpdated,
  isLoading,
  onRefreshCache,
  cacheTtlMs,
}: Props) {
  return (
    <footer className="shrink-0 bg-gray-50 border-t border-gray-200/70 px-3 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 min-h-10">
      <span
        className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-gray-400 tracking-tight select-all"
        title="Contentful Management API token"
      >
        <span className="font-sans font-semibold text-gray-400 not-italic">
          CMA TOKEN:
        </span>
        {maskedToken}
      </span>
      <div className="flex items-center gap-4 sm:gap-6 ml-auto">
        {cacheLastUpdated && (
          <span className="text-xs text-gray-700 tabular-nums tracking-tight">
            Cache updated {formatCacheTime(cacheLastUpdated)}
            <span className="ml-1.5 text-gray-400 hidden sm:inline">
              · {cacheTtlMs / 60_000} min TTL
            </span>
          </span>
        )}
        <button
          onClick={onRefreshCache}
          disabled={isLoading}
          title={`Clear the ${cacheTtlMs / 60_000}-minute cache and reload`}
          className="flex items-center gap-2 text-xs font-medium text-gray-700 hover:text-gray-400 transition-colors disabled:opacity-40 disabled:cursor-wait"
        >
          <svg
            className={`w-4 h-4 shrink-0 ${isLoading ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh cache
        </button>
      </div>
    </footer>
  );
}
