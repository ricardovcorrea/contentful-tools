import type { SitemapPage } from "~/lib/contentful/sitemap";

export const POSITIVE_SITEMAP_FIELDS = new Set([
  "addToSitemap",
  "includeInSitemap",
  "sitemap",
  "indexable",
  "searchable",
]);

export function StatusDot({ status }: { status: SitemapPage["status"] }) {
  const cls =
    status === "published"
      ? "bg-emerald-400"
      : status === "changed"
        ? "bg-amber-400"
        : "bg-gray-300";
  return (
    <span
      title={status}
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${cls}`}
    />
  );
}

export function ScopeTag({ scope }: { scope: "opco" | "partner" }) {
  const cls =
    scope === "opco"
      ? "text-violet-500 bg-violet-50 border-violet-200/60"
      : "text-emerald-600 bg-emerald-50 border-emerald-200/60";
  return (
    <span
      className={`text-[7px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${cls}`}
    >
      {scope === "opco" ? "OPCO" : "Partner"}
    </span>
  );
}

export function SitemapToggle({
  included,
  pending,
  fieldName,
  onChange,
}: {
  included: boolean;
  pending: boolean;
  fieldName: string | null;
  onChange: () => void;
}) {
  if (!fieldName) {
    return <div className="w-9 shrink-0" />;
  }
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!pending) onChange();
      }}
      disabled={pending}
      title={included ? "Remove from sitemap" : "Add to sitemap"}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
        pending
          ? "opacity-60 cursor-not-allowed bg-gray-200"
          : included
            ? "bg-emerald-500 hover:bg-emerald-600"
            : "bg-gray-300 hover:bg-gray-400"
      }`}
    >
      {pending ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <svg
            className="w-3 h-3 animate-spin text-white"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        </span>
      ) : (
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            included ? "translate-x-4" : "translate-x-0"
          }`}
        />
      )}
    </button>
  );
}
