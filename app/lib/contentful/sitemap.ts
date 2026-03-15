// ── Types ─────────────────────────────────────────────────────────────────────

export type SitemapPage = {
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

export type TreeNode = {
  segment: string;
  fullSlug: string;
  page: SitemapPage | null;
  children: TreeNode[];
};

// ── Detection helpers ─────────────────────────────────────────────────────────

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

  if (!slug) return { included: false, reason: "No slug", field: null };
  if (status === "draft")
    return { included: false, reason: "Draft — not published", field: null };
  return { included: true, reason: "Published with slug", field: null };
}

// ── Build helpers ─────────────────────────────────────────────────────────────

export function buildSitemapPages(
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

  /** Resolve a linked entry's fields (handles locale-wrapped and plain forms). */
  const resolveLinkedFields = (
    fields: Record<string, any>,
    linkKey: string,
  ): Record<string, any> | null => {
    const raw = fields[linkKey];
    if (!raw) return null;
    // locale-wrapped: { "en-US": { sys, fields } }
    const localeVal = raw[firstLocale] ?? Object.values(raw)[0];
    if (localeVal?.fields) return localeVal.fields as Record<string, any>;
    // plain: { sys, fields }
    if (raw.fields) return raw.fields as Record<string, any>;
    return null;
  };

  /** Try to resolve a path string from a linked entry (seo, metadata, etc.). */
  const resolveLinkedPath = (
    fields: Record<string, any>,
    linkKey: string,
  ): string | null => {
    const linked = resolveLinkedFields(fields, linkKey);
    if (!linked) return null;
    return (
      resolve(linked, "slug") ||
      resolve(linked, "path") ||
      resolve(linked, "canonicalUrl") ||
      resolve(linked, "url") ||
      null
    );
  };

  /** Scan every field for a value that looks like a URL path (starts with /). */
  const resolveAnyPath = (fields: Record<string, any>): string | null => {
    const SKIP = new Set([
      "id",
      "internalName",
      "title",
      "name",
      "partner",
      "opco",
      "sections",
      "pageType",
      "type",
      "addToSitemap",
      "includeInSitemap",
      "sitemap",
      "indexable",
      "searchable",
      "noIndex",
      "noindex",
      "hideFromSearch",
      "excludeFromSitemap",
      "hidden",
      "isPrivate",
      "private",
    ]);
    for (const key of Object.keys(fields)) {
      if (SKIP.has(key)) continue;
      const val = resolve(fields, key);
      if (val && typeof val === "string" && val.startsWith("/")) return val;
    }
    return null;
  };

  return allItems.map((item): SitemapPage => {
    const fields: Record<string, any> = item.fields ?? {};
    const name =
      resolve(fields, "internalName") ||
      resolve(fields, "title") ||
      resolve(fields, "name") ||
      item.sys.id;

    // 1. Try well-known direct fields
    // 2. Try linked metadata entries (only works if fields are resolved)
    // 3. Fall back to scanning all fields for anything that looks like a path
    const slug =
      resolve(fields, "slug") ||
      resolve(fields, "path") ||
      resolve(fields, "url") ||
      resolve(fields, "route") ||
      resolveLinkedPath(fields, "seo") ||
      resolveLinkedPath(fields, "metadata") ||
      resolveLinkedPath(fields, "seoMetadata") ||
      resolveLinkedPath(fields, "pageMetadata") ||
      resolveLinkedPath(fields, "seoData") ||
      resolveAnyPath(fields) ||
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

    const scope: "opco" | "partner" =
      fields["partner"] !== undefined && fields["partner"] !== null
        ? "partner"
        : "opco";

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

export function buildTree(pages: SitemapPage[]): TreeNode[] {
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

  const fallbackEntries: TreeNode[] = pagesWithout.map((p) => ({
    segment: p.name,
    fullSlug: "",
    page: p,
    children: [],
  }));

  return [...rootEntries, ...fallbackEntries];
}
