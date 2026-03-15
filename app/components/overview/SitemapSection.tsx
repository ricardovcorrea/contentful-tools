import { useState, useEffect } from "react";
import {
  getContentfulManagementEntries,
  getContentfulManagementEnvironment,
} from "~/lib/contentful";
import { invalidateCacheKey } from "~/lib/contentful/cache";
import { buildSitemapPages, type SitemapPage } from "~/lib/contentful/sitemap";
import { POSITIVE_SITEMAP_FIELDS } from "./sitemap/SitemapToggle";
import { PageRow } from "./sitemap/PageRow";

const SitemapLegend = () => (
  <div className="flex items-center gap-4 px-4 py-1.5 border-b border-gray-100 bg-gray-50/40 text-[8px] font-semibold text-gray-400 uppercase tracking-wider">
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shrink-0" />
      Published
    </span>
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-amber-400 inline-block shrink-0" />
      Changed
    </span>
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-gray-300 inline-block shrink-0" />
      Draft
    </span>
  </div>
);

// ── SitemapSection ─────────────────────────────────────────────────────────────
// Types/helpers live in ~/lib/contentful/sitemap.ts
// Sub-components live in ~/components/overview/sitemap/

// ── Main exported component ───────────────────────────────────────────────────

export function SitemapSection({
  opcoName,
  opcoPages,
  opcoPartners,
  firstLocale,
  spaceId,
  environmentId,
  opcoId,
  partnerId,
  search = "",
}: {
  opcoName: string;
  opcoPages: { items: any[] };
  opcoPartners: { items: any[] };
  firstLocale: string;
  spaceId: string;
  environmentId: string;
  opcoId: string;
  partnerId: string;
  search?: string;
}) {
  const [allPages, setAllPages] = useState<SitemapPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const handleToggle = async (page: SitemapPage, newIncluded: boolean) => {
    if (pendingIds.has(page.sysId) || !page.sitemapField) return;
    const fieldName = page.sitemapField;
    const isPositive = POSITIVE_SITEMAP_FIELDS.has(fieldName);
    const newFieldValue = isPositive ? newIncluded : !newIncluded;

    // Optimistic update
    setPendingIds((prev) => new Set([...prev, page.sysId]));
    setAllPages((prev) =>
      prev.map((p) =>
        p.sysId === page.sysId ? { ...p, sitemapIncluded: newIncluded } : p,
      ),
    );

    try {
      const env = await getContentfulManagementEnvironment();
      const cfEntry = await env.getEntry(page.sysId);
      if (!cfEntry.fields[fieldName]) cfEntry.fields[fieldName] = {};
      cfEntry.fields[fieldName][firstLocale] = newFieldValue;
      const updated = await cfEntry.update();

      // Patch the raw loader item so the unpublished view picks it up immediately.
      const rawItem = opcoPages.items.find(
        (i: any) => i.sys?.id === page.sysId,
      );
      if (rawItem && updated?.sys) {
        Object.assign(rawItem.sys, updated.sys);
      }

      // Bust group-level caches so next visit fetches fresh data.
      invalidateCacheKey(`opco-pages:${opcoId}`);
      invalidateCacheKey(`opco-messages:${opcoId}`);
      invalidateCacheKey(`opco-refs:${opcoId}`);
      invalidateCacheKey(`partner-pages:${opcoId}:${partnerId}`);
      invalidateCacheKey(`partner-messages:${opcoId}:${partnerId}`);
      invalidateCacheKey(`partner-emails:${opcoId}:${partnerId}`);
      invalidateCacheKey(`partner-refs:${opcoId}:${partnerId}`);
    } catch {
      // Revert on failure
      setAllPages((prev) =>
        prev.map((p) =>
          p.sysId === page.sysId
            ? { ...p, sitemapIncluded: page.sitemapIncluded }
            : p,
        ),
      );
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(page.sysId);
        return next;
      });
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const partnerSysIds = opcoPartners.items.map((p: any) => p.sys.id);

    const partnerPagePromise =
      partnerSysIds.length > 0
        ? getContentfulManagementEntries({
            content_type: "page",
            "fields.partner.sys.id[in]": partnerSysIds.join(","),
            limit: 1000,
          }).then((res) => res.items)
        : Promise.resolve([] as any[]);

    partnerPagePromise
      .then((partnerItems) => {
        if (cancelled) return;
        const combined = [...opcoPages.items, ...partnerItems];
        setAllPages(buildSitemapPages(combined, firstLocale, opcoName));
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message ?? "Failed to load partner pages");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstLocale, opcoPages, opcoPartners, opcoName]);

  const q = search.trim().toLowerCase();

  const filterPage = (p: SitemapPage) => {
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.slug ?? "").toLowerCase().includes(q) ||
      (p.pageType ?? "").toLowerCase().includes(q) ||
      (p.opcoLabel ?? "").toLowerCase().includes(q)
    );
  };

  const includedPages = allPages
    .filter((p) => p.sitemapIncluded && filterPage(p))
    .sort((a, b) => (a.slug ?? a.name).localeCompare(b.slug ?? b.name));
  const excludedPages = allPages
    .filter((p) => !p.sitemapIncluded && filterPage(p))
    .sort((a, b) => (a.slug ?? a.name).localeCompare(b.slug ?? b.name));

  // ── Loading state ── (skeleton rows)
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[12, 8].map((count, gi) => (
          <div
            key={gi}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            <div className="h-9 bg-gray-100 border-b border-gray-100" />
            <div className="divide-y divide-gray-50">
              {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-2 h-2 rounded-full bg-gray-200 shrink-0" />
                  <div className="w-14 h-4 bg-gray-200 rounded shrink-0" />
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="h-3 bg-gray-200 rounded w-2/5" />
                    <div className="h-2.5 bg-gray-100 rounded w-1/3" />
                  </div>
                  <div className="w-16 h-3 bg-gray-100 rounded shrink-0 hidden sm:block" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Error state ── (banner)
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  // ── Empty state ──
  if (allPages.length === 0) {
    return (
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
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="text-sm font-medium">No pages found</p>
      </div>
    );
  }

  // ── No search results ──
  const noResults =
    q && includedPages.length === 0 && excludedPages.length === 0;
  if (noResults) {
    return (
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
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <p className="text-sm font-medium">No pages match your search</p>
      </div>
    );
  }

  const legend = (
    <div className="flex items-center gap-4 px-4 py-1.5 border-b border-gray-100 bg-gray-50/40 text-[8px] font-semibold text-gray-400 uppercase tracking-wider">
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shrink-0" />
        Published
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block shrink-0" />
        Changed
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-gray-300 inline-block shrink-0" />
        Draft
      </span>
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      {/* ── In sitemap section ── */}
      {includedPages.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
              In sitemap
            </span>
            <h2 className="text-sm font-bold text-gray-700">Pages</h2>
            <span className="text-[11px] font-semibold border px-1.5 py-0.5 rounded-full tabular-nums bg-emerald-500/10 text-emerald-600 border-emerald-300/30">
              {includedPages.length}
            </span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {legend}
            <div className="divide-y divide-gray-50">
              {includedPages.map((page) => (
                <PageRow
                  key={page.sysId}
                  page={page}
                  spaceId={spaceId}
                  environmentId={environmentId}
                  pending={pendingIds.has(page.sysId)}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Excluded section ── */}
      {excludedPages.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
              Excluded
            </span>
            <h2 className="text-sm font-bold text-gray-700">Pages</h2>
            <span className="text-[11px] font-semibold border px-1.5 py-0.5 rounded-full tabular-nums bg-gray-500/10 text-gray-500 border-gray-300/30">
              {excludedPages.length}
            </span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {legend}
            <div className="divide-y divide-gray-50">
              {excludedPages.map((page) => (
                <PageRow
                  key={page.sysId}
                  page={page}
                  spaceId={spaceId}
                  environmentId={environmentId}
                  pending={pendingIds.has(page.sysId)}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
