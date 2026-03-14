import { useState, useEffect } from "react";
import { useRouteLoaderData, useNavigate } from "react-router";
import { resolveStringField } from "~/lib/resolve-string-field";
import { getContentfulManagementEntries } from "~/lib/contentful";
import type { RefGroup } from "~/lib/contentful/get-entry-tree";

type Locale = {
  code: string;
  name: string;
  default?: boolean;
  fallbackCode?: string | null;
  optional?: boolean;
};

type ParentLoaderData = {
  opcos: { items: any[] };
  opcoId: string;
  opcoPartners: { items: any[] };
  partnerId: string;
  opcoPages: { items: any[] };
  opcoMessages: { items: any[] };
  partnerPages: { items: any[] };
  partnerMessages: { items: any[] };
  partnerEmails: { items: any[] };
  opcoRefGroups: RefGroup[];
  partnerRefGroups: RefGroup[];
  locales: { items: Locale[] };
  allLocales: { items: Locale[] };
  spaceId: string;
  spaceName: string;
  environmentId: string;
  environmentName: string;
  localizableContentTypes: string[];
  localizableFieldsMap: Record<string, string[]>;
  envStats: {
    totalEntries: number | null;
    totalContentTypes: number | null;
    totalAssets: number | null;
  };
  scheduledActions: {
    id: string;
    action: "publish" | "unpublish";
    entityId: string;
    entityType: string;
    scheduledAt: string;
    status: string;
  }[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMissingStats(
  entries: any[],
  locales: Locale[],
  localizableContentTypes: string[],
  localizableFieldsMap: Record<string, string[]>,
) {
  const defaultLocale =
    locales.find((l) => l.default)?.code ?? locales[0]?.code;
  const nonDefaultLocales = locales.filter((l) => !l.default);

  const missingPerLocale: Record<string, number> = {};
  nonDefaultLocales.forEach((l) => {
    missingPerLocale[l.code] = 0;
  });

  let localizableEntries = 0;
  let entriesWithMissing = 0;

  const isMissing = (val: unknown) =>
    val === undefined ||
    val === null ||
    val === "" ||
    (Array.isArray(val) && val.length === 0);

  for (const entry of entries) {
    const ctId = entry.sys?.contentType?.sys?.id as string | undefined;
    if (!ctId || !localizableContentTypes.includes(ctId)) continue;

    const fieldIds = localizableFieldsMap[ctId] ?? [];
    if (fieldIds.length === 0) continue;

    const fields = entry.fields ?? {};

    // Check if this entry actually has any localizable field with a default-locale value
    const hasAnyDefault = fieldIds.some(
      (fId) => !isMissing(fields[fId]?.[defaultLocale]),
    );
    if (!hasAnyDefault) continue;

    localizableEntries++;
    let entryHasMissing = false;

    for (const locale of nonDefaultLocales) {
      const hasMissingField = fieldIds.some((fId) => {
        const defaultVal = fields[fId]?.[defaultLocale];
        if (isMissing(defaultVal)) return false; // no source value, skip
        return isMissing(fields[fId]?.[locale.code]);
      });
      if (hasMissingField) {
        missingPerLocale[locale.code] =
          (missingPerLocale[locale.code] ?? 0) + 1;
        entryHasMissing = true;
      }
    }
    if (entryHasMissing) entriesWithMissing++;
  }

  return { localizableEntries, entriesWithMissing, missingPerLocale };
}

// ── Components ────────────────────────────────────────────────────────────────

function Tile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number | null;
  accent: string;
}) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${accent}`}>
      <p className="text-[9px] font-bold uppercase tracking-widest opacity-50 mb-0.5">
        {label}
      </p>
      <p className="text-xl font-bold tabular-nums leading-none">
        {value ?? "—"}
      </p>
    </div>
  );
}

function TranslationCoverageCard({
  entryCount,
  combinedStats,
  locales,
  localeCount,
  onViewOpco,
  onViewPartner,
  opcoHasLocalizable,
  partnerHasLocalizable,
}: {
  entryCount: number;
  combinedStats: ReturnType<typeof getMissingStats>;
  locales: Locale[];
  localeCount: number;
  onViewOpco?: () => void;
  onViewPartner?: () => void;
  opcoHasLocalizable: boolean;
  partnerHasLocalizable: boolean;
}) {
  const nonDefaultLocales = locales.filter((l) => !l.default);
  const { localizableEntries, entriesWithMissing, missingPerLocale } =
    combinedStats;
  const coveragePct =
    localizableEntries > 0
      ? Math.round(
          ((localizableEntries - entriesWithMissing) / localizableEntries) *
            100,
        )
      : 100;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/60">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          Translation Coverage
        </p>
        <span className="text-[10px] font-medium text-sky-600 bg-sky-500/8 border border-sky-200/60 rounded px-1.5 py-0.5">
          {localeCount} locale{localeCount !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3">
        {/* Summary counters */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-2 py-1.5 text-center">
            <p className="text-[8px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">
              Entries
            </p>
            <p className="text-sm font-bold tabular-nums text-gray-800">
              {entryCount}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-2 py-1.5 text-center">
            <p className="text-[8px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">
              Localizable
            </p>
            <p className="text-sm font-bold tabular-nums text-gray-800">
              {localizableEntries}
            </p>
          </div>
          <div
            className={`rounded-lg px-2 py-1.5 text-center border ${
              entriesWithMissing > 0
                ? "bg-amber-50 border-amber-200/60"
                : "bg-emerald-50 border-emerald-200/60"
            }`}
          >
            <p
              className={`text-[8px] font-bold uppercase tracking-wider mb-0.5 ${
                entriesWithMissing > 0 ? "text-amber-500" : "text-emerald-500"
              }`}
            >
              Missing
            </p>
            <p
              className={`text-sm font-bold tabular-nums ${
                entriesWithMissing > 0 ? "text-amber-700" : "text-emerald-700"
              }`}
            >
              {entriesWithMissing}
            </p>
          </div>
        </div>

        {/* Coverage bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Coverage
            </span>
            <span
              className={`text-[11px] font-bold tabular-nums ${
                coveragePct === 100
                  ? "text-emerald-600"
                  : coveragePct >= 80
                    ? "text-amber-600"
                    : "text-red-600"
              }`}
            >
              {coveragePct}%
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                coveragePct === 100
                  ? "bg-emerald-500"
                  : coveragePct >= 80
                    ? "bg-amber-400"
                    : "bg-red-400"
              }`}
              style={{ width: `${coveragePct}%` }}
            />
          </div>
        </div>

        {/* Per-locale breakdown */}
        {nonDefaultLocales.length > 0 && (
          <div className="border-t border-gray-100 pt-2.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-2">
              Missing by locale
            </p>
            <div className="flex flex-col gap-1.5">
              {nonDefaultLocales.map((locale) => {
                const missing = missingPerLocale[locale.code] ?? 0;
                const pct =
                  localizableEntries > 0
                    ? Math.round((missing / localizableEntries) * 100)
                    : 0;
                return (
                  <div key={locale.code} className="flex items-center gap-2">
                    <span className="w-12 text-[9px] font-mono text-gray-400 shrink-0 uppercase">
                      {locale.code}
                    </span>
                    <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          missing === 0 ? "bg-emerald-400" : "bg-amber-400"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-[10px] font-semibold tabular-nums text-gray-600 shrink-0">
                      {missing}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Links */}
        {(onViewOpco || onViewPartner) && (
          <div className="border-t border-gray-100 pt-2.5 flex gap-3">
            {onViewOpco && (
              <button
                onClick={onViewOpco}
                className="flex-1 text-left flex items-center justify-between gap-2 text-xs font-medium text-violet-600 hover:opacity-70 transition-opacity group"
              >
                <span>OPCO overview</span>
                <svg
                  className="w-3 h-3 shrink-0 group-hover:translate-x-0.5 transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}
            {onViewOpco && onViewPartner && (
              <div className="w-px bg-gray-100" />
            )}
            {onViewPartner && (
              <button
                onClick={onViewPartner}
                className="flex-1 text-left flex items-center justify-between gap-2 text-xs font-medium text-emerald-600 hover:opacity-70 transition-opacity group"
              >
                <span>Partner overview</span>
                <svg
                  className="w-3 h-3 shrink-0 group-hover:translate-x-0.5 transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ScheduledCard({
  actions,
  allEntries,
  firstLocale,
  spaceId,
  environmentId,
}: {
  actions: {
    id: string;
    action: "publish" | "unpublish";
    entityId: string;
    entityType: string;
    scheduledAt: string;
    status: string;
  }[];
  allEntries: { item: any; scope: "opco" | "partner" }[];
  firstLocale: string;
  spaceId: string;
  environmentId: string;
}) {
  const entryMap = new Map(
    allEntries.map(({ item, scope }) => [item.sys.id, { item, scope }]),
  );

  const sorted = [...actions].sort(
    (a, b) =>
      new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/60">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          Scheduled
        </p>
        {actions.length > 0 && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200/60">
            {actions.length}
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-10 gap-2 text-gray-400">
          <svg
            className="w-7 h-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-xs font-medium">No scheduled actions</p>
        </div>
      ) : (
        <div className="overflow-y-auto flex-1 max-h-72">
          <div className="divide-y divide-gray-50">
            {sorted.map((action) => {
              const matched = entryMap.get(action.entityId);
              const name = matched
                ? (matched.item.fields?.["internalName"]?.[firstLocale] ??
                  matched.item.fields?.["title"]?.[firstLocale] ??
                  action.entityId)
                : action.entityId;
              const scope = matched?.scope;
              const date = new Date(action.scheduledAt);
              const dateStr = date.toLocaleDateString(undefined, {
                day: "2-digit",
                month: "short",
              });
              const timeStr = date.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              });
              const url = `https://app.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries/${action.entityId}`;
              return (
                <a
                  key={action.id}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-gray-50 transition-colors group"
                >
                  {scope && (
                    <span
                      className={`shrink-0 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                        scope === "opco"
                          ? "text-violet-500 bg-violet-50 border-violet-200/60"
                          : "text-emerald-600 bg-emerald-50 border-emerald-200/60"
                      }`}
                    >
                      {scope === "opco" ? "OPCO" : "Partner"}
                    </span>
                  )}
                  <span className="flex-1 text-xs text-gray-700 truncate group-hover:text-gray-900">
                    {name}
                  </span>
                  <span
                    className={`shrink-0 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      action.action === "publish"
                        ? "bg-sky-100 text-sky-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {action.action}
                  </span>
                  <span className="shrink-0 text-[9px] tabular-nums text-gray-400 text-right">
                    <span className="block">{dateStr}</span>
                    <span className="block">{timeStr}</span>
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sitemap ───────────────────────────────────────────────────────────────

type SitemapPage = {
  sysId: string;
  name: string;
  slug: string | null;
  pageType: string | null;
  sectionsCount: number;
  scope: "opco" | "partner";
  opcoId: string | null;
  opcoLabel: string | null;
  status: "published" | "changed" | "draft";
  sitemapIncluded: boolean;
  sitemapReason: string;
  sitemapField: string | null;
};

// Detect whether a page entry should appear in a sitemap.
// Priority order:
//   1. Explicit "include" boolean fields (addToSitemap, includeInSitemap, …)
//   2. Explicit "exclude" boolean fields (noIndex, hideFromSearch, …)
//   3. Heuristic: has a slug + not a draft
function detectSitemapEligibility(
  fields: Record<string, any>,
  slug: string | null,
  status: "published" | "changed" | "draft",
  firstLocale: string,
): { included: boolean; reason: string; field: string | null } {
  const resolveBool = (val: unknown): boolean | null => {
    if (val === null || val === undefined) return null;
    if (typeof val === "boolean") return val;
    if (typeof val === "object") {
      const v =
        (val as Record<string, unknown>)[firstLocale] ??
        Object.values(val as Record<string, unknown>)[0];
      if (typeof v === "boolean") return v;
    }
    return null;
  };

  // Positive fields — true means "include in sitemap"
  for (const key of [
    "addToSitemap",
    "includeInSitemap",
    "sitemap",
    "indexable",
    "searchable",
  ]) {
    const b = resolveBool(fields[key]);
    if (b === true)
      return { included: true, reason: `${key} = true`, field: key };
    if (b === false)
      return { included: false, reason: `${key} = false`, field: key };
  }

  // Negative fields — true means "exclude from sitemap"
  for (const key of [
    "noIndex",
    "noindex",
    "hideFromSearch",
    "excludeFromSitemap",
    "hidden",
    "isPrivate",
    "private",
  ]) {
    const b = resolveBool(fields[key]);
    if (b === true)
      return { included: false, reason: `${key} = true`, field: key };
    if (b === false)
      return { included: true, reason: `${key} = false`, field: key };
  }

  // Heuristics
  if (!slug) return { included: false, reason: "No slug", field: null };
  if (status === "draft")
    return { included: false, reason: "Draft — not published", field: null };
  return { included: true, reason: "Published with slug", field: null };
}

function buildSitemapPages(
  allItems: any[],
  firstLocale: string,
  defaultOpcoLabel?: string,
): SitemapPage[] {
  const resolve = (fields: Record<string, any>, key: string): string | null => {
    const val = fields[key];
    if (!val) return null;
    if (typeof val === "string") return val;
    return val[firstLocale] ?? (Object.values(val)[0] as string | null) ?? null;
  };

  return allItems.map((item): SitemapPage => {
    const fields: Record<string, any> = item.fields ?? {};
    const name =
      resolve(fields, "internalName") ||
      resolve(fields, "title") ||
      resolve(fields, "name") ||
      item.sys.id;
    const slug =
      resolve(fields, "slug") ||
      resolve(fields, "path") ||
      resolve(fields, "url") ||
      resolve(fields, "route") ||
      null;
    const pageType =
      resolve(fields, "pageType") || resolve(fields, "type") || null;
    const sections = fields["sections"];
    const sectionsCount = Array.isArray(sections?.[firstLocale])
      ? sections[firstLocale].length
      : Array.isArray(sections)
        ? sections.length
        : 0;
    const pub = item.sys?.publishedAt;
    const upd = item.sys?.updatedAt;
    const status: SitemapPage["status"] = !pub
      ? "draft"
      : upd && new Date(upd) > new Date(pub)
        ? "changed"
        : "published";
    const { included, reason, field } = detectSitemapEligibility(
      fields,
      slug,
      status,
      firstLocale,
    );

    // Determine scope from the presence of a partner link field
    const scope: "opco" | "partner" =
      fields["partner"] !== undefined && fields["partner"] !== null
        ? "partner"
        : "opco";

    // Resolve the OPCO this page belongs to (via its opco link field)
    const opcoLink = fields["opco"];
    const opcoFields: Record<string, any> | null =
      opcoLink?.[firstLocale]?.fields ?? opcoLink?.fields ?? null;
    const opcoId: string | null = opcoFields
      ? (resolve(opcoFields, "id") ?? null)
      : null;
    const opcoLabel: string | null = opcoFields
      ? (resolve(opcoFields, "internalName") ??
        resolve(opcoFields, "title") ??
        opcoId)
      : (defaultOpcoLabel ?? null);

    return {
      sysId: item.sys.id,
      name: name as string,
      slug,
      pageType,
      sectionsCount,
      scope,
      opcoId,
      opcoLabel,
      status,
      sitemapIncluded: included,
      sitemapReason: reason,
      sitemapField: field,
    };
  });
}

// Build a flat URL tree. Each node = one path segment.
type TreeNode = {
  segment: string;
  fullSlug: string;
  page: SitemapPage | null;
  children: TreeNode[];
};

function buildTree(pages: SitemapPage[]): TreeNode[] {
  const root: TreeNode = {
    segment: "",
    fullSlug: "",
    page: null,
    children: [],
  };

  const pagesWithSlug = pages.filter((p) => p.slug);
  const pagesWithout = pages.filter((p) => !p.slug);

  for (const page of pagesWithSlug) {
    const stripped = page.slug!.replace(/^\//, "").replace(/\/$/, "");

    // Root page "/" — slug becomes empty after stripping
    if (!stripped) {
      root.page = page;
      continue;
    }

    const parts = stripped.split("/").filter(Boolean);
    let node = root;
    let accumulated = "";
    for (let i = 0; i < parts.length; i++) {
      accumulated = accumulated ? `${accumulated}/${parts[i]}` : parts[i];
      let child = node.children.find((c) => c.segment === parts[i]);
      if (!child) {
        child = {
          segment: parts[i],
          fullSlug: accumulated,
          page: null,
          children: [],
        };
        node.children.push(child);
      }
      if (i === parts.length - 1) child.page = page;
      node = child;
    }
  }

  // If root itself has a page (slug="/"), promote it as first entry with children attached
  const rootEntries: TreeNode[] =
    root.page !== null
      ? [
          {
            segment: "",
            fullSlug: "/",
            page: root.page,
            children: root.children,
          },
        ]
      : root.children;

  // Pages with no slug — show by name, no path segment
  const fallbackEntries: TreeNode[] = pagesWithout.map((p) => ({
    segment: p.name, // use readable name instead of sys.id
    fullSlug: "",
    page: p,
    children: [],
  }));

  return [...rootEntries, ...fallbackEntries];
}

function StatusDot({ status }: { status: SitemapPage["status"] }) {
  const cls =
    status === "published"
      ? "bg-emerald-400"
      : status === "changed"
        ? "bg-amber-400"
        : "bg-gray-300";
  return (
    <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${cls}`} />
  );
}

function ScopeTag({ scope }: { scope: "opco" | "partner" }) {
  const cls =
    scope === "opco"
      ? "text-violet-500 bg-violet-50 border-violet-200/60"
      : "text-emerald-600 bg-emerald-50 border-emerald-200/60";
  return (
    <span
      className={`text-[7px] font-bold uppercase px-1 py-px rounded border ${cls}`}
    >
      {scope === "opco" ? "OPCO" : "Partner"}
    </span>
  );
}

function PageCard({
  page,
  spaceId,
  environmentId,
}: {
  page: SitemapPage;
  spaceId: string;
  environmentId: string;
}) {
  const url = `https://app.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries/${page.sysId}`;
  const included = page.sitemapIncluded;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex flex-col gap-1.5 rounded-lg border px-3 py-2.5 hover:shadow-sm transition-all ${
        included
          ? "bg-white border-gray-200 hover:border-emerald-300"
          : "bg-gray-50/60 border-gray-200 hover:border-gray-300 opacity-70 hover:opacity-90"
      }`}
    >
      {/* Sitemap badge row */}
      <div className="flex items-center justify-between gap-1.5">
        {included ? (
          <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded">
            <svg
              className="w-2.5 h-2.5"
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
            In sitemap
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-gray-400 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">
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
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
            Excluded
          </span>
        )}
        <StatusDot status={page.status} />
      </div>

      {/* Page name */}
      <p className="text-[11px] font-semibold text-gray-800 leading-snug break-words group-hover:text-gray-900">
        {page.name}
      </p>

      {/* Slug */}
      {page.slug ? (
        <p className="text-[10px] font-mono text-gray-400 truncate">
          /{page.slug.replace(/^\//, "")}
        </p>
      ) : (
        <p className="text-[10px] text-gray-300 italic">no slug</p>
      )}

      {/* Reason */}
      <p
        className={`text-[9px] truncate ${
          included ? "text-emerald-600/70" : "text-gray-400"
        }`}
      >
        {page.sitemapField ? (
          <>
            <span className="font-mono">{page.sitemapField}</span>
            {" — "}
            {page.sitemapReason.split(" = ")[1]}
          </>
        ) : (
          page.sitemapReason
        )}
      </p>

      {/* Footer tags */}
      <div className="flex items-center gap-1 flex-wrap mt-0.5">
        {page.opcoLabel ? (
          <span className="text-[7px] font-bold uppercase px-1 py-px rounded border text-violet-500 bg-violet-50 border-violet-200/60">
            {page.opcoLabel}
          </span>
        ) : (
          <ScopeTag scope={page.scope} />
        )}
        {page.scope === "partner" && (
          <span className="text-[7px] font-bold uppercase px-1 py-px rounded border text-emerald-600 bg-emerald-50 border-emerald-200/60">
            Partner
          </span>
        )}
        {page.pageType && (
          <span className="text-[7px] font-semibold uppercase px-1 py-px rounded border border-sky-200/60 text-sky-500 bg-sky-50">
            {page.pageType}
          </span>
        )}
        {page.sectionsCount > 0 && (
          <span className="text-[7px] font-semibold text-gray-400 ml-auto">
            {page.sectionsCount}§
          </span>
        )}
      </div>
    </a>
  );
}

function TreeNodeRow({
  node,
  depth,
  spaceId,
  environmentId,
}: {
  node: TreeNode;
  depth: number;
  spaceId: string;
  environmentId: string;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  const isRoot = node.fullSlug !== "" || node.page !== null;

  if (!isRoot) return null;

  // Label shown in the path segment row
  const segmentLabel =
    node.fullSlug === "/" || node.segment === ""
      ? "/" // root page
      : node.page && !node.page.slug
        ? node.segment // no-slug page: segment IS already the name
        : `/${node.segment}`; // normal path segment

  return (
    <div className="flex flex-col">
      {/* Segment row */}
      <div
        className="flex items-center gap-1.5 mb-1"
        style={{ paddingLeft: `${depth * 14}px` }}
      >
        {depth > 0 && (
          <div className="flex items-center gap-0.5 shrink-0">
            <span className="text-gray-200 text-xs">└</span>
          </div>
        )}
        {hasChildren && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 text-gray-400 hover:text-gray-600"
          >
            <svg
              className={`w-2.5 h-2.5 transition-transform ${open ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}
        {!hasChildren && <span className="w-2.5 shrink-0" />}
        <span
          className={`text-[9px] font-mono truncate max-w-[220px] ${
            node.page && !node.page.slug
              ? "text-gray-400 italic not-italic" // no-slug: show name dimly
              : "text-gray-400"
          }`}
        >
          {segmentLabel}
        </span>
        {node.page && (
          <div className="flex items-center gap-1 ml-auto">
            {node.page.sitemapIncluded ? (
              <svg
                className="w-3 h-3 text-emerald-500 shrink-0"
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
            ) : (
              <svg
                className="w-3 h-3 text-gray-300 shrink-0"
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
            )}
            <StatusDot status={node.page.status} />
            <ScopeTag scope={node.page.scope} />
          </div>
        )}
      </div>
      {/* Card if this node has a page */}
      {node.page && (
        <div style={{ paddingLeft: `${depth * 14 + 18}px` }} className="mb-1.5">
          <PageCard
            page={node.page}
            spaceId={spaceId}
            environmentId={environmentId}
          />
        </div>
      )}
      {/* Children */}
      {open &&
        node.children.map((child) => (
          <TreeNodeRow
            key={child.fullSlug || child.segment}
            node={child}
            depth={depth + 1}
            spaceId={spaceId}
            environmentId={environmentId}
          />
        ))}
    </div>
  );
}

function SitemapSection({
  opcoName,
  opcoPages,
  opcoPartners,
  firstLocale,
  spaceId,
  environmentId,
}: {
  opcoName: string;
  opcoPages: { items: any[] };
  opcoPartners: { items: any[] };
  firstLocale: string;
  spaceId: string;
  environmentId: string;
}) {
  const [allPages, setAllPages] = useState<SitemapPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const partnerSysIds = opcoPartners.items.map((p: any) => p.sys.id);

    // Fetch partner pages for ALL partners of this OPCO in one query.
    // If there are no partners just resolve immediately with an empty list.
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
        // Combine: pre-loaded OPCO pages + fetched partner pages
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

  const inSitemap = allPages.filter((p) => p.sitemapIncluded).length;
  const excluded = allPages.filter((p) => !p.sitemapIncluded).length;
  const tree = loading ? [] : buildTree(allPages);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/60 flex items-center gap-3 flex-wrap">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          Sitemap
        </p>
        <div className="flex items-center gap-1.5 text-[9px] font-semibold">
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200/60 text-emerald-700">
            <svg
              className="w-2.5 h-2.5"
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
            {inSitemap} in sitemap
          </span>
          {excluded > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-500">
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
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
              {excluded} excluded
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-12 text-gray-400">
          <svg
            className="w-4 h-4 animate-spin shrink-0"
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
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          <span className="text-xs font-medium">Loading all pages…</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center gap-2 py-10 text-red-500">
          <svg
            className="w-4 h-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
          <span className="text-xs font-medium">{error}</span>
        </div>
      ) : allPages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
          <svg
            className="w-7 h-7"
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
          <p className="text-xs font-medium">No pages found</p>
        </div>
      ) : (
        <div className="px-4 py-4 overflow-x-auto">
          {/* Legend */}
          <div className="flex items-center gap-4 mb-3 text-[8px] font-semibold text-gray-400 uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Published
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              Unpublished changes
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />
              Draft
            </span>
            <span className="ml-auto flex items-center gap-1 text-emerald-600">
              <svg
                className="w-2.5 h-2.5"
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
              In sitemap
            </span>
            <span className="flex items-center gap-1">
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
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
              Excluded
            </span>
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            {tree.map((node) => (
              <TreeNodeRow
                key={node.fullSlug || node.segment}
                node={node}
                depth={0}
                spaceId={spaceId}
                environmentId={environmentId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/40 flex items-center gap-2">
        <span className="text-[9px] text-gray-400">
          {loading
            ? "Loading…"
            : `${allPages.filter((p) => p.scope === "opco").length} OPCO · ${allPages.filter((p) => p.scope === "partner").length} partner pages`}
        </span>
        <span className="text-[9px] text-gray-300">·</span>
        <span className="text-[9px] text-gray-400">
          Sitemap eligibility is determined by{" "}
          <span className="font-mono">addToSitemap</span>,{" "}
          <span className="font-mono">noIndex</span>, slug presence, and publish
          status
        </span>
      </div>
    </div>
  );
}

function UnpublishedCard({
  entries,
  firstLocale,
  spaceId,
  environmentId,
}: {
  entries: { item: any; scope: "opco" | "partner" }[];
  firstLocale: string;
  spaceId: string;
  environmentId: string;
}) {
  const unpublished = entries.filter(({ item }) => {
    const pub = item.sys?.publishedAt;
    const upd = item.sys?.updatedAt;
    if (!pub) return true; // draft
    return upd && new Date(upd) > new Date(pub); // modified
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/60">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          Unpublished Content
        </p>
        {unpublished.length > 0 && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200/60">
            {unpublished.length}
          </span>
        )}
      </div>

      {unpublished.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-10 gap-2 text-gray-400">
          <svg
            className="w-7 h-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-xs font-medium">All entries are published</p>
        </div>
      ) : (
        <div className="overflow-y-auto flex-1 max-h-72">
          <div className="divide-y divide-gray-50">
            {unpublished.map(({ item, scope }) => {
              const name =
                item.fields?.["internalName"]?.[firstLocale] ??
                item.fields?.["title"]?.[firstLocale] ??
                item.sys.id;
              const isDraft = !item.sys?.publishedAt;
              const ctId = item.sys?.contentType?.sys?.id as string | undefined;
              const url = `https://app.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries/${item.sys.id}`;
              return (
                <a
                  key={item.sys.id}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-gray-50 transition-colors group"
                >
                  <span
                    className={`shrink-0 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                      scope === "opco"
                        ? "text-violet-500 bg-violet-50 border-violet-200/60"
                        : "text-emerald-600 bg-emerald-50 border-emerald-200/60"
                    }`}
                  >
                    {scope === "opco" ? "OPCO" : "Partner"}
                  </span>
                  <span className="flex-1 text-xs text-gray-700 truncate group-hover:text-gray-900">
                    {name}
                  </span>
                  {ctId && (
                    <span className="shrink-0 text-[8px] font-mono text-gray-300 truncate max-w-20">
                      {ctId}
                    </span>
                  )}
                  <span
                    className={`shrink-0 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      isDraft
                        ? "bg-gray-100 text-gray-500"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {isDraft ? "Draft" : "Modified"}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EnvironmentOverview() {
  const data = useRouteLoaderData("routes/home") as ParentLoaderData;
  const navigate = useNavigate();
  if (!data) return null;

  const {
    opcos,
    opcoId,
    opcoPartners,
    partnerId,
    opcoPages,
    opcoMessages,
    partnerPages,
    partnerMessages,
    partnerEmails,
    opcoRefGroups,
    partnerRefGroups,
    locales,
    allLocales,
    spaceId,
    spaceName,
    environmentId,
    environmentName,
    localizableContentTypes,
    localizableFieldsMap,
    envStats,
    scheduledActions,
  } = data;

  const firstLocale = locales.items[0]?.code ?? "en";

  const getName = (fields: Record<string, any>) =>
    resolveStringField(fields["internalName"], firstLocale) ||
    resolveStringField(fields["title"], firstLocale) ||
    null;

  const selectedOpcoEntry = opcos.items.find(
    (o: any) =>
      (resolveStringField(o.fields["id"], firstLocale) || o.sys.id) === opcoId,
  );
  const selectedPartnerEntry = opcoPartners.items.find(
    (p: any) =>
      (resolveStringField(p.fields["id"], firstLocale) || p.sys.id) ===
      partnerId,
  );

  const opcoName =
    (selectedOpcoEntry ? getName(selectedOpcoEntry.fields) : null) ?? opcoId;
  const partnerName =
    (selectedPartnerEntry ? getName(selectedPartnerEntry.fields) : null) ??
    partnerId;

  const allOpcoEntries = [
    ...opcoPages.items,
    ...opcoMessages.items,
    ...opcoRefGroups.flatMap((g) => g.items),
  ];
  const allPartnerEntries = [
    ...partnerPages.items,
    ...partnerMessages.items,
    ...partnerEmails.items,
    ...partnerRefGroups.flatMap((g) => g.items),
  ];

  // Deduplicate by sys.id so overlapping entries are only counted once.
  const seenIds = new Set<string>();
  const allEntries: any[] = [];
  for (const entry of [...allOpcoEntries, ...allPartnerEntries]) {
    if (!seenIds.has(entry.sys.id)) {
      seenIds.add(entry.sys.id);
      allEntries.push(entry);
    }
  }

  const combinedStats = getMissingStats(
    allEntries,
    locales.items,
    localizableContentTypes,
    localizableFieldsMap,
  );

  const isLocalizable = (items: any[]) => {
    const id = items[0]?.sys?.contentType?.sys?.id as string | undefined;
    return !!id && localizableContentTypes.includes(id);
  };

  const opcoHasLocalizable =
    isLocalizable(opcoPages.items) ||
    isLocalizable(opcoMessages.items) ||
    opcoRefGroups.some((g) => isLocalizable(g.items));
  const partnerHasLocalizable =
    isLocalizable(partnerPages.items) ||
    isLocalizable(partnerMessages.items) ||
    isLocalizable(partnerEmails.items) ||
    partnerRefGroups.some((g) => isLocalizable(g.items));

  return (
    <main className="flex-1 overflow-y-auto px-5 py-4 bg-gray-50">
      {/* Header */}
      <div className="mb-2 flex items-center gap-1.5 flex-wrap">
        <div>
          <span className="text-[6px] leading-snug font-semibold text-sky-600 bg-sky-500/15 px-1 py-px rounded-full">
            Environment
          </span>
          <h2 className="text-[9px] leading-tight font-bold text-gray-900 mt-px">
            {environmentName}
            <span className="text-[7px] font-mono text-gray-400 font-normal ml-1">
              {spaceName}
            </span>
          </h2>
        </div>
        <a
          href={`https://app.contentful.com/spaces/${spaceId}/environments/${environmentId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-0.5 rounded border border-gray-300 px-1.5 py-0.5 text-[8px] font-medium text-gray-600 hover:bg-gray-200 transition-colors"
        >
          <svg
            className="w-2 h-2 shrink-0"
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

      {/* Stat tiles */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-5">
        <Tile
          label="Entries"
          value={envStats.totalEntries}
          accent="bg-white border-gray-200 text-gray-900"
        />
        <Tile
          label="Content Types"
          value={envStats.totalContentTypes}
          accent="bg-white border-gray-200 text-gray-900"
        />
        <Tile
          label="Assets"
          value={envStats.totalAssets}
          accent="bg-white border-gray-200 text-gray-900"
        />
        <Tile
          label="Locales"
          value={allLocales.items.length}
          accent="bg-sky-500/5 border-sky-200/60 text-sky-900"
        />
        <Tile
          label="Partners"
          value={opcoPartners.items.length}
          accent="bg-emerald-500/5 border-emerald-200/60 text-emerald-900"
        />
      </div>

      {/* Row 2: translation coverage + placeholder */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <TranslationCoverageCard
          entryCount={allEntries.length}
          combinedStats={combinedStats}
          locales={locales.items}
          localeCount={locales.items.length}
          onViewOpco={
            opcoHasLocalizable ? () => navigate("/overview/opco") : undefined
          }
          onViewPartner={
            partnerHasLocalizable
              ? () => navigate("/overview/partner")
              : undefined
          }
          opcoHasLocalizable={opcoHasLocalizable}
          partnerHasLocalizable={partnerHasLocalizable}
        />
        {/* Placeholder for future card */}
      </div>

      {/* Row 3: unpublished + scheduled */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5">
        <UnpublishedCard
          entries={[
            ...allOpcoEntries.map((item) => ({ item, scope: "opco" as const })),
            ...allPartnerEntries.map((item) => ({
              item,
              scope: "partner" as const,
            })),
          ]}
          firstLocale={firstLocale}
          spaceId={spaceId}
          environmentId={environmentId}
        />
        <ScheduledCard
          actions={scheduledActions}
          allEntries={[
            ...allOpcoEntries.map((item) => ({ item, scope: "opco" as const })),
            ...allPartnerEntries.map((item) => ({
              item,
              scope: "partner" as const,
            })),
          ]}
          firstLocale={firstLocale}
          spaceId={spaceId}
          environmentId={environmentId}
        />
      </div>

      {/* Sitemap section */}
      <div className="mt-5">
        <SitemapSection
          opcoName={opcoName as string}
          opcoPages={opcoPages}
          opcoPartners={opcoPartners}
          firstLocale={firstLocale}
          spaceId={spaceId}
          environmentId={environmentId}
        />
      </div>
    </main>
  );
}
