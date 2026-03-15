import { queryClient, QUERY_STALE_TIME } from "~/lib/query-client";
import { queryKeys } from "~/lib/query-keys";
import { getContentfulManagementEnvironment } from ".";

export type RefGroup = {
  contentTypeId: string;
  label: string;
  slug: string;
  items: any[];
};

/** Batch size for sys.id[in] queries – stay well under URL length limits */
const BATCH = 50;

/**
 * Recursively collect all Entry-link IDs from a management-API field value.
 * The management API stores fields as { [fieldId]: { [locale]: value } }.
 * Links appear as { sys: { type: "Link", linkType: "Entry", id: "..." } }.
 */
function collectLinks(val: unknown, out: Set<string>): void {
  if (!val || typeof val !== "object") return;
  if (Array.isArray(val)) {
    for (const item of val) collectLinks(item, out);
    return;
  }
  const v = val as Record<string, any>;
  if (v.sys?.type === "Link" && v.sys?.linkType === "Entry" && v.sys?.id) {
    out.add(v.sys.id as string);
    return;
  }
  // Walk all object properties (skip `sys` to avoid circular noise)
  for (const key of Object.keys(v)) {
    if (key !== "sys") collectLinks(v[key], out);
  }
}

/** Return all Entry-link IDs referenced in the fields of a management entry */
function extractLinkIds(entry: any): string[] {
  const out = new Set<string>();
  const fields: Record<string, Record<string, unknown>> = entry.fields ?? {};
  for (const localeMap of Object.values(fields)) {
    if (localeMap && typeof localeMap === "object") {
      for (const val of Object.values(localeMap)) {
        collectLinks(val, out);
      }
    }
  }
  return [...out];
}

/**
 * Batch-fetch the given IDs from the management API and store them in
 * `collected`. Returns the IDs of entries that were newly fetched and are
 * NOT excluded by `excludeSet` (these form the next BFS frontier).
 */
async function fetchBatch(
  env: any,
  ids: string[],
  collected: Map<string, any>,
  excludeSet: Set<string>,
): Promise<string[]> {
  const frontier: string[] = [];
  const toFetch = ids.filter((id) => !collected.has(id));

  for (let i = 0; i < toFetch.length; i += BATCH) {
    const batch = toFetch.slice(i, i + BATCH);
    try {
      const result = await env.getEntries({
        "sys.id[in]": batch.join(","),
        limit: BATCH,
      });
      for (const entry of result.items) {
        if (!collected.has(entry.sys.id)) {
          collected.set(entry.sys.id, entry);
          const ctId: string = entry.sys.contentType.sys.id;
          if (!excludeSet.has(ctId)) {
            frontier.push(entry.sys.id);
          }
        }
      }
    } catch {
      // ignore API errors for individual batches
    }
  }
  return frontier;
}

/**
 * Given a list of root entry IDs (e.g. page IDs), walks the entry reference
 * graph up to `maxDepth` levels by manually following Entry links found in
 * each entry's fields.
 *
 * NOTE: The Contentful Management API does NOT support the `include` parameter
 * for link resolution (that is a CDA-only feature). We therefore perform a
 * manual BFS: fetch entries → extract link IDs from their fields → fetch those
 * → repeat.
 *
 * Returns the discovered entries grouped by content type, excluding any
 * content type IDs listed in `excludeContentTypeIds`.
 *
 * Results are cached under `cacheKey`.
 */
export const getEntryTree = (
  rootEntryIds: string[],
  excludeContentTypeIds: string[],
  cacheKey: string,
  maxDepth = 15,
): Promise<RefGroup[]> =>
  queryClient.ensureQueryData({
    queryKey: ["entry-tree", cacheKey],
    queryFn: async () => {
      if (rootEntryIds.length === 0) return [];

      const env = await getContentfulManagementEnvironment();

      const allContentTypes = await queryClient.ensureQueryData({
        queryKey: queryKeys.allContentTypes(),
        queryFn: () => env.getContentTypes({ limit: 1000 }),
        staleTime: QUERY_STALE_TIME,
      });
      const ctNameById = new Map<string, string>(
        allContentTypes.items.map((ct: any) => [ct.sys.id, ct.name as string]),
      );

      const excludeSet = new Set(excludeContentTypeIds);
      const collected = new Map<string, any>(); // entryId → entry
      const allSeen = new Set<string>(rootEntryIds); // every ID ever queued

      // Seed: fetch root entries (we need them to read their links).
      // Pass an empty excludeSet so root entries themselves are always fetched.
      let frontier = await fetchBatch(env, rootEntryIds, collected, new Set());

      // BFS – each iteration follows one level of links
      for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
        // Gather all link IDs referenced by entries in the current frontier
        const nextIds: string[] = [];
        for (const id of frontier) {
          const entry = collected.get(id);
          if (!entry) continue;
          for (const linkId of extractLinkIds(entry)) {
            if (!allSeen.has(linkId)) {
              allSeen.add(linkId);
              nextIds.push(linkId);
            }
          }
        }
        if (nextIds.length === 0) break;
        frontier = await fetchBatch(env, nextIds, collected, excludeSet);
      }

      // Group by content type, skipping excluded CTs
      const groupMap = new Map<string, any[]>();
      for (const entry of collected.values()) {
        const ctId: string = entry.sys.contentType.sys.id;
        if (excludeSet.has(ctId)) continue;
        if (!groupMap.has(ctId)) groupMap.set(ctId, []);
        groupMap.get(ctId)!.push(entry);
      }

      return [...groupMap.entries()].map(([ctId, items]) => ({
        contentTypeId: ctId,
        label: ctNameById.get(ctId) ?? ctId,
        slug: ctId,
        items,
      }));
    },
    staleTime: QUERY_STALE_TIME,
  });
