/**
 * Centralised query-key factories.
 *
 * Using arrays as keys lets TanStack Query do granular invalidation:
 *   queryClient.invalidateQueries({ queryKey: queryKeys.entries() })
 *     → invalidates ALL entry queries
 *   queryClient.invalidateQueries({ queryKey: queryKeys.entry("abc123", "opcoA", "partnerB") })
 *     → invalidates only that one entry
 */
export const queryKeys = {
  // ── Individual resources ─────────────────────────────────────────────────
  /**
   * Entries are scoped by opcoId (and optionally partnerId) so that cached
   * data from one OPCO/partner context never bleeds into another.
   *   opco-only:    entry(id, opcoId)          → ["entry", opcoId, "", id]
   *   partner:      entry(id, opcoId, partnerId) → ["entry", opcoId, partnerId, id]
   *   unscoped:     entry(id)                  → ["entry", "", "", id]
   */
  entry: (entryId: string, opcoId = "", partnerId = "") =>
    ["entry", opcoId, partnerId, entryId] as const,
  entries: (opcoId = "", partnerId = "") =>
    ["entry", opcoId, partnerId] as const,

  asset: (assetId: string) => ["asset", assetId] as const,
  assets: () => ["asset"] as const,

  contentType: (ctId: string) => ["content-type", ctId] as const,
  contentTypes: () => ["content-type"] as const,

  // ── Collections ──────────────────────────────────────────────────────────
  opcos: () => ["opcos"] as const,
  locales: () => ["locales"] as const,
  currentUser: () => ["current-user"] as const,
  allPartners: () => ["all-partners"] as const,
  allContentTypes: () => ["all-content-types"] as const,

  opcoPages: (opcoId: string) => ["opco-pages", opcoId] as const,
  opcoMessages: (opcoId: string) => ["opco-messages", opcoId] as const,
  opcoPartners: (opcoId: string) => ["opco-partners", opcoId] as const,
  opcoRefs: (opcoId: string) => ["opco-refs", opcoId] as const,

  partnerPages: (opcoId: string, partnerId: string) =>
    ["partner-pages", opcoId, partnerId] as const,
  partnerMessages: (opcoId: string, partnerId: string) =>
    ["partner-messages", opcoId, partnerId] as const,
  partnerEmails: (opcoId: string, partnerId: string) =>
    ["partner-emails", opcoId, partnerId] as const,
  partnerRefs: (opcoId: string, partnerId: string) =>
    ["partner-refs", opcoId, partnerId] as const,

  // ── Unpublished page (full lists, limit=1000) ─────────────────────────────
  unpublishedOpcoPages: (opcoId: string) =>
    ["unpublished-opco-pages", opcoId] as const,
  unpublishedOpcoMessages: (opcoId: string) =>
    ["unpublished-opco-messages", opcoId] as const,
  unpublishedPartnerPages: (opcoId: string, partnerId: string) =>
    ["unpublished-partner-pages", opcoId, partnerId] as const,
  unpublishedPartnerMessages: (opcoId: string, partnerId: string) =>
    ["unpublished-partner-messages", opcoId, partnerId] as const,
  unpublishedPartnerEmails: (opcoId: string, partnerId: string) =>
    ["unpublished-partner-emails", opcoId, partnerId] as const,

  // ── Session-scoped SDK objects (in-memory only, Infinity stale) ──────────
  managementEnvironment: () => ["management-environment"] as const,
  space: (spaceId: string) => ["space", spaceId] as const,
  spaces: () => ["spaces"] as const,
  envObj: (spaceId: string, envId: string) =>
    ["env-obj", spaceId, envId] as const,
  environments: (spaceId: string) => ["environments", spaceId] as const,

  // ── Env-level stats & actions ─────────────────────────────────────────────
  scheduledActions: (spaceId: string, envId: string) =>
    ["scheduled-actions", spaceId, envId] as const,
  envEntriesTotal: (spaceId: string, envId: string) =>
    ["env-entries-total", spaceId, envId] as const,
  envContentTypesTotal: (spaceId: string, envId: string) =>
    ["env-ct-total", spaceId, envId] as const,
  envAssetsTotal: (spaceId: string, envId: string) =>
    ["env-assets-total", spaceId, envId] as const,
};
