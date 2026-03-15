import { useState, useCallback } from "react";
import { useLoaderData, useRouteLoaderData } from "react-router";
import {
  getContentfulManagementEnvironment,
  getContentfulManagementEntries,
} from "~/lib/contentful";
import { invalidateEntry } from "~/lib/contentful/get-entry";
import { queryClient } from "~/lib/query-client";
import { queryKeys } from "~/lib/query-keys";
import { resolveStringField } from "~/lib/resolve-string-field";
import { useToast } from "~/lib/toast";
import { useEditMode } from "~/lib/edit-mode";
import { serializeCsvValue } from "~/lib/csv";
import { EntryDiffModal } from "~/components/overview/modals/EntryDiffModal";
import type { EntryDiffModalState } from "~/types/contentful";

// ── Types ─────────────────────────────────────────────────────────────────────

type ContextData = {
  opcoId: string;
  partnerId: string;
  locales: { items: { code: string; name: string; default?: boolean }[] };
  spaceId: string;
  environmentId: string;
};

type LoaderData = {
  opcoPages: { items: any[] };
  opcoMessages: { items: any[] };
  partnerPages: { items: any[] };
  partnerMessages: { items: any[] };
  partnerEmails: { items: any[] };
};

type UnpublishedItem = {
  item: any;
  scope: "opco" | "partner";
  groupLabel: string;
  status: "draft" | "changed";
};

// ── clientLoader — always fetches fresh, bypasses cache entirely ─────────────

export async function clientLoader(): Promise<LoaderData> {
  const opcoId = localStorage.getItem("selectedOpco") ?? "";
  const partnerId = localStorage.getItem("selectedPartner") ?? "";

  if (!opcoId || !partnerId) {
    const empty = { items: [] };
    return {
      opcoPages: empty,
      opcoMessages: empty,
      partnerPages: empty,
      partnerMessages: empty,
      partnerEmails: empty,
    };
  }

  const [
    rawOpcoPages,
    rawOpcoMessages,
    rawPartnerPages,
    rawPartnerMessages,
    rawPartnerEmails,
  ] = await Promise.all([
    getContentfulManagementEntries({
      content_type: "page",
      "fields.opco.fields.id": opcoId.toLowerCase(),
      "fields.opco.sys.contentType.sys.id": "opco",
      limit: 1000,
    }),
    getContentfulManagementEntries({
      content_type: "message",
      "fields.opco.fields.id": opcoId.toLowerCase(),
      "fields.opco.sys.contentType.sys.id": "opco",
      limit: 1000,
    }),
    getContentfulManagementEntries({
      content_type: "page",
      "fields.opco.fields.id": opcoId.toLowerCase(),
      "fields.opco.sys.contentType.sys.id": "opco",
      "fields.partner.fields.id": partnerId.toLowerCase(),
      "fields.partner.sys.contentType.sys.id": "partner",
      limit: 1000,
    }),
    getContentfulManagementEntries({
      content_type: "message",
      "fields.opco.fields.id": opcoId.toLowerCase(),
      "fields.opco.sys.contentType.sys.id": "opco",
      "fields.partner.fields.id": partnerId.toLowerCase(),
      "fields.partner.sys.contentType.sys.id": "partner",
      limit: 1000,
    }),
    getContentfulManagementEntries({
      content_type: "emailVoucherConfirmation",
      "fields.opco.fields.id": opcoId.toLowerCase(),
      "fields.opco.sys.contentType.sys.id": "opco",
      "fields.partner.fields.id": partnerId.toLowerCase(),
      "fields.partner.sys.contentType.sys.id": "partner",
      limit: 1000,
    }),
  ]);

  return {
    // OPCO-only: exclude entries that also belong to a partner
    opcoPages: {
      items: rawOpcoPages.items.filter((i: any) => !i.fields?.partner),
    },
    opcoMessages: {
      items: rawOpcoMessages.items.filter((i: any) => !i.fields?.partner),
    },
    partnerPages: { items: rawPartnerPages.items },
    partnerMessages: { items: rawPartnerMessages.items },
    partnerEmails: { items: rawPartnerEmails.items },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildUnpublishedItems(
  opcoEntries: { items: any[]; label: string }[],
  partnerEntries: { items: any[]; label: string }[],
): UnpublishedItem[] {
  const fromGroup = (
    group: { items: any[]; label: string },
    scope: "opco" | "partner",
  ): UnpublishedItem[] =>
    group.items
      .map((item): UnpublishedItem | null => {
        const neverPublished = !item.sys?.publishedAt;
        const hasChanges =
          !neverPublished &&
          !!item.sys?.updatedAt &&
          new Date(item.sys.updatedAt) > new Date(item.sys.publishedAt);
        if (!neverPublished && !hasChanges) return null;
        return {
          item,
          scope,
          groupLabel: group.label,
          status: neverPublished ? "draft" : "changed",
        };
      })
      .filter(Boolean) as UnpublishedItem[];

  return [
    ...opcoEntries.flatMap((g) => fromGroup(g, "opco")),
    ...partnerEntries.flatMap((g) => fromGroup(g, "partner")),
  ];
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <main className="flex-1 overflow-y-auto bg-gray-50">
      <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-6 pt-5 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-300 animate-pulse" />
          <div className="flex-1">
            <div className="h-3 w-20 bg-gray-200 rounded animate-pulse mb-1" />
            <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex gap-2">
          {[80, 60, 80].map((w, i) => (
            <div
              key={i}
              className={`h-7 w-${w === 80 ? "20" : "16"} bg-gray-200 rounded animate-pulse`}
            />
          ))}
        </div>
      </div>
      <div className="px-6 py-4 flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3"
          >
            <div className="w-4 h-4 rounded bg-gray-200 animate-pulse shrink-0" />
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="h-3 bg-gray-200 rounded w-1/3 animate-pulse" />
              <div className="h-2.5 bg-gray-100 rounded w-1/4 animate-pulse" />
            </div>
            <div className="w-16 h-6 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </main>
  );
}

// ── Page component ────────────────────────────────────────────────────────────

export default function UnpublishedPage() {
  const loaderData = useLoaderData() as LoaderData | null;
  const ctx = useRouteLoaderData("routes/home") as ContextData | null;
  const { addToast } = useToast();
  const { editMode } = useEditMode();

  const [publishingEntries, setPublishingEntries] = useState<
    Record<string, "loading" | "done" | "error">
  >({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "draft" | "changed">("all");
  const [search, setSearch] = useState("");
  const [entryDiffModal, setEntryDiffModal] =
    useState<EntryDiffModalState>(null);

  // Stable IDs — fall back to empty string until data is ready (guard handles null).
  const opcoId = ctx?.opcoId ?? "";
  const partnerId = ctx?.partnerId ?? "";
  const firstLocale = ctx?.locales.items[0]?.code ?? "en";

  // Build list up-front so handlePublish callbacks close over it correctly.
  // (Uses nullish fallbacks so hookorder is preserved before the guard below.)
  const allUnpublished = buildUnpublishedItems(
    [
      { items: loaderData?.opcoPages.items ?? [], label: "Pages" },
      { items: loaderData?.opcoMessages.items ?? [], label: "Messages" },
    ],
    [
      { items: loaderData?.partnerPages.items ?? [], label: "Pages" },
      { items: loaderData?.partnerMessages.items ?? [], label: "Messages" },
      { items: loaderData?.partnerEmails.items ?? [], label: "Emails" },
    ],
  );

  // Invalidate all group-level cache keys so other views reload fresh data.
  const invalidateGroupCaches = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.opcoPages(opcoId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.opcoMessages(opcoId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.opcoRefs(opcoId) });
    queryClient.invalidateQueries({
      queryKey: queryKeys.partnerPages(opcoId, partnerId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.partnerMessages(opcoId, partnerId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.partnerEmails(opcoId, partnerId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.partnerRefs(opcoId, partnerId),
    });
    // Also bust the unpublished-specific queries so next visit reloads fresh.
    queryClient.invalidateQueries({
      queryKey: queryKeys.unpublishedOpcoPages(opcoId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.unpublishedOpcoMessages(opcoId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.unpublishedPartnerPages(opcoId, partnerId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.unpublishedPartnerMessages(opcoId, partnerId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.unpublishedPartnerEmails(opcoId, partnerId),
    });
  }, [opcoId, partnerId]);

  /** Publish one entry. The Contentful SDK occasionally throws even when the
   *  publish succeeds (response-parsing race, 502 from their CDN, etc.).
   *  We retry the status check a few times before surfacing the error.
   *  "Success" = publishedVersion is current (or one behind, since publish
   *  itself increments the version) OR publishedAt is fresh (< 60 s). */
  const publishEntry = useCallback(async (entryId: string): Promise<any> => {
    const env = await getContentfulManagementEnvironment();
    const mgmtEntry = await env.getEntry(entryId);
    // Snapshot the pre-publish publishedVersion so we can detect advancement.
    const initialPv = mgmtEntry.sys?.publishedVersion ?? -1;
    const attemptedAt = Date.now();
    try {
      const result = await mgmtEntry.publish();
      return result?.sys ?? result;
    } catch (publishErr) {
      // The Contentful SDK sometimes throws even when the publish succeeds
      // (response-parsing race, 502 from CDN, etc.).  Re-check up to 5 times
      // with increasing back-off to let the Management API propagate.
      //
      // "Success" criteria (either is sufficient):
      //   1. publishedVersion advanced past the pre-publish snapshot.
      //   2. publishedAt is a timestamp that post-dates our attempt start
      //      (5 s tolerance for server/client clock drift).
      for (let attempt = 0; attempt < 5; attempt++) {
        // Back-off: 2 s, 2 s, 3 s, 3 s, 4 s
        const wait = attempt < 2 ? 2000 : attempt < 4 ? 3000 : 4000;
        await new Promise((r) => setTimeout(r, wait));
        try {
          const rechecked = await env.getEntry(entryId);
          const pv = rechecked.sys?.publishedVersion ?? -1;
          const publishedAt = rechecked.sys?.publishedAt
            ? new Date(rechecked.sys.publishedAt).getTime()
            : 0;
          // publishedVersion advanced: the publish definitely went through.
          // publishedAt >= attemptedAt - 5_000: published right around when
          // we attempted (handles entries that were never published before,
          // or when the version is temporarily stale on the read replica).
          if (pv > initialPv || publishedAt >= attemptedAt - 5_000) {
            return rechecked.sys;
          }
        } catch {
          // re-check network error — keep retrying
        }
      }
      throw publishErr;
    }
  }, []);

  const handlePublish = useCallback(
    async (entryId: string) => {
      setPublishingEntries((prev) => ({ ...prev, [entryId]: "loading" }));
      try {
        const publishedSys = await publishEntry(entryId);
        const cached = allUnpublished.find((u) => u.item.sys.id === entryId);
        if (cached && publishedSys)
          Object.assign(cached.item.sys, publishedSys);
        invalidateGroupCaches();
        invalidateEntry(entryId, opcoId, partnerId);
        setPublishingEntries((prev) => ({ ...prev, [entryId]: "done" }));
        addToast("Entry published", "success");
      } catch {
        setPublishingEntries((prev) => ({ ...prev, [entryId]: "error" }));
        addToast("Failed to publish entry", "error");
      }
    },
    [
      allUnpublished,
      addToast,
      publishEntry,
      invalidateGroupCaches,
      opcoId,
      partnerId,
    ],
  );

  const handlePublishSelected = useCallback(async () => {
    const ids = Array.from(selected);
    setSelected(new Set());
    setPublishingEntries((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = "loading";
      return next;
    });
    let ok = 0;
    let fail = 0;
    await Promise.all(
      ids.map(async (id) => {
        try {
          const publishedSys = await publishEntry(id);
          const cached = allUnpublished.find((u) => u.item.sys.id === id);
          if (cached && publishedSys)
            Object.assign(cached.item.sys, publishedSys);
          invalidateEntry(id, opcoId, partnerId);
          setPublishingEntries((prev) => ({ ...prev, [id]: "done" }));
          ok++;
        } catch {
          setPublishingEntries((prev) => ({ ...prev, [id]: "error" }));
          fail++;
        }
      }),
    );
    if (ok > 0) invalidateGroupCaches();
    if (ok > 0)
      addToast(`Published ${ok} entr${ok === 1 ? "y" : "ies"}`, "success");
    if (fail > 0)
      addToast(`${fail} entr${fail === 1 ? "y" : "ies"} failed`, "error");
  }, [selected, allUnpublished, addToast, publishEntry, invalidateGroupCaches]);

  const handleViewEntryDiff = useCallback(
    async (item: any) => {
      const entryId = item.sys.id;
      const name =
        resolveStringField(item.fields?.["internalName"], firstLocale) ||
        resolveStringField(item.fields?.["title"], firstLocale) ||
        entryId;
      setEntryDiffModal({
        entryId,
        entryName: name,
        loading: true,
        error: null,
        rows: [],
      });
      try {
        const environment = await getContentfulManagementEnvironment();
        const snapshots = await environment.getEntrySnapshots(entryId);
        // publishedVersion is the entry's sys.version at the time it was published.
        // Contentful stores a snapshot of that exact version.
        const publishedVersion = item.sys.publishedVersion ?? 0;
        const publishedSnapshot =
          snapshots.items.find(
            (s: any) => s.snapshot?.sys?.version === publishedVersion,
          ) ??
          // Fallback: try publishedVersion+1 in case of off-by-one in older entries
          snapshots.items.find(
            (s: any) => s.snapshot?.sys?.version === publishedVersion + 1,
          ) ??
          snapshots.items[0];
        if (!publishedSnapshot) {
          setEntryDiffModal({
            entryId,
            entryName: name,
            loading: false,
            error: "No published snapshot found for this entry.",
            rows: [],
          });
          return;
        }
        const publishedFields: Record<
          string,
          Record<string, unknown>
        > = publishedSnapshot.snapshot?.fields ?? {};
        const draftFields: Record<
          string,
          Record<string, unknown>
        > = item.fields ?? {};
        const allFieldIds = Array.from(
          new Set([
            ...Object.keys(publishedFields),
            ...Object.keys(draftFields),
          ]),
        );
        const rows: NonNullable<EntryDiffModalState>["rows"] = [];
        for (const fieldId of allFieldIds) {
          const pubField = publishedFields[fieldId] ?? {};
          const draftField = draftFields[fieldId] ?? {};
          const allLocales = Array.from(
            new Set([...Object.keys(pubField), ...Object.keys(draftField)]),
          );
          for (const locale of allLocales) {
            const published = serializeCsvValue(pubField[locale]);
            const draft = serializeCsvValue(draftField[locale]);
            if (published !== draft) {
              rows.push({ fieldId, locale, published, draft });
            }
          }
        }
        setEntryDiffModal({
          entryId,
          entryName: name,
          loading: false,
          error: null,
          rows,
        });
      } catch (err: any) {
        setEntryDiffModal({
          entryId,
          entryName: name,
          loading: false,
          error: err?.message ?? "Failed to load diff",
          rows: [],
        });
      }
    },
    [firstLocale],
  );

  // ── All hooks above this line ─────────────────────────────────────────────

  // Guard — clientLoader always resolves before render in RR7; safety net only.
  if (!loaderData || !ctx) return <LoadingSkeleton />;

  const { spaceId, environmentId } = ctx;

  const getName = (item: any) =>
    resolveStringField(item.fields?.["internalName"], firstLocale) ||
    resolveStringField(item.fields?.["title"], firstLocale) ||
    item.sys.id;

  const q = search.trim().toLowerCase();
  const visible = allUnpublished.filter((u) => {
    if (publishingEntries[u.item.sys.id] === "done") return false;
    if (filter !== "all" && u.status !== filter) return false;
    if (q) {
      const name = getName(u.item).toLowerCase();
      const ct = (u.item.sys?.contentType?.sys?.id ?? "").toLowerCase();
      if (
        !name.includes(q) &&
        !ct.includes(q) &&
        !u.groupLabel.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const selectableIds = visible
    .filter((u) => publishingEntries[u.item.sys.id] !== "loading")
    .map((u) => u.item.sys.id);

  const allChecked =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someChecked =
    !allChecked && selectableIds.some((id) => selected.has(id));

  const draftCount = allUnpublished.filter(
    (u) => u.status === "draft" && publishingEntries[u.item.sys.id] !== "done",
  ).length;
  const changedCount = allUnpublished.filter(
    (u) =>
      u.status === "changed" && publishingEntries[u.item.sys.id] !== "done",
  ).length;

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-6 sm:px-8 pt-6">
        <div className="flex items-start justify-between gap-4 pb-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">
              {opcoId}
              {partnerId ? ` · ${partnerId}` : ""}
            </p>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              Unpublished Content
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {draftCount + changedCount === 0
                ? "All entries are published"
                : `${draftCount + changedCount} entr${
                    draftCount + changedCount !== 1 ? "ies" : "y"
                  } need publishing`}
            </p>
          </div>
          {allUnpublished.filter(
            (u) => publishingEntries[u.item.sys.id] !== "done",
          ).length > 0 && (
            <span className="shrink-0 text-sm font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200/60 tabular-nums mt-1">
              {
                allUnpublished.filter(
                  (u) => publishingEntries[u.item.sys.id] !== "done",
                ).length
              }
            </span>
          )}
        </div>

        {/* Filters + search */}
        <div className="flex items-center gap-2 flex-wrap pb-3">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-[10px] font-semibold">
            {(["all", "draft", "changed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 transition-colors capitalize ${
                  filter === f
                    ? "bg-gray-800 text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                {f === "all"
                  ? `All (${draftCount + changedCount})`
                  : f === "draft"
                    ? `Draft (${draftCount})`
                    : `Modified (${changedCount})`}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-45 max-w-xs">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search entries…"
              className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-sky-400"
            />
          </div>
          {selected.size > 0 && (
            <button
              onClick={handlePublishSelected}
              disabled={!editMode}
              title={!editMode ? "Enable edit mode to publish" : undefined}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-semibold hover:bg-blue-600 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg
                className="w-3.5 h-3.5 shrink-0"
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
              Publish {selected.size}{" "}
              {selected.size === 1 ? "entry" : "entries"}
            </button>
          )}
        </div>
      </div>

      <div className="px-6 py-4">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
            {allUnpublished.filter(
              (u) => publishingEntries[u.item.sys.id] !== "done",
            ).length === 0 ? (
              <>
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
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm font-medium">All content is published</p>
                <p className="text-xs">No draft or modified entries found</p>
              </>
            ) : (
              <>
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
                <p className="text-sm font-medium">
                  No results match your search
                </p>
              </>
            )}
          </div>
        ) : (
          <div>
            {/* Select-all toolbar */}
            <div className="flex items-center gap-2 mb-4 px-1">
              <label className="flex items-center gap-2 text-xs text-gray-500 select-none cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!editMode}
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = someChecked;
                  }}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked ? new Set(selectableIds) : new Set(),
                    )
                  }
                  className="w-4 h-4 rounded border-gray-300 accent-blue-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                />
                Select all
              </label>
              <span className="text-[10px] text-gray-400 font-medium">
                {visible.length} {visible.length === 1 ? "entry" : "entries"}
              </span>
            </div>

            {(["opco", "partner"] as const).map((scope) => {
              const scopeItems = visible.filter((u) => u.scope === scope);
              if (scopeItems.length === 0) return null;
              const isOpco = scope === "opco";
              return (
                <section key={scope} className="mb-8">
                  {/* Section header */}
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        isOpco
                          ? "bg-violet-100 text-violet-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {isOpco ? "OPCO" : "Partner"}
                    </span>
                    <h2 className="text-sm font-bold text-gray-700">
                      {isOpco ? opcoId : partnerId}
                    </h2>
                    <span
                      className={`text-[11px] font-semibold border px-1.5 py-0.5 rounded-full tabular-nums ${
                        isOpco
                          ? "bg-violet-500/10 text-violet-600 border-violet-300/30"
                          : "bg-emerald-500/10 text-emerald-600 border-emerald-300/30"
                      }`}
                    >
                      {scopeItems.length}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {scopeItems.map(({ item, groupLabel, status }) => {
                      const name = getName(item);
                      const entryId = item.sys.id;
                      const publishState = publishingEntries[entryId];
                      const ctId = item.sys?.contentType?.sys?.id ?? "";
                      const updatedAt = item.sys.updatedAt
                        ? new Date(item.sys.updatedAt)
                        : null;
                      const isChecked = selected.has(entryId);
                      const url = `https://app.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries/${entryId}`;

                      return (
                        <div
                          key={entryId}
                          className={`flex items-center gap-4 px-5 py-3.5 rounded-xl border transition-colors ${
                            publishState === "done"
                              ? "bg-emerald-50 border-emerald-200 opacity-60"
                              : publishState === "error"
                                ? "bg-red-50 border-red-200"
                                : isChecked
                                  ? status === "draft"
                                    ? "bg-blue-50 border-blue-200"
                                    : "bg-amber-50 border-amber-300"
                                  : status === "draft"
                                    ? "bg-white border-gray-200"
                                    : "bg-amber-50/40 border-amber-200/60"
                          }`}
                        >
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            disabled={
                              !editMode ||
                              publishState === "loading" ||
                              publishState === "done"
                            }
                            checked={isChecked}
                            onChange={(e) => {
                              const next = new Set(selected);
                              if (e.target.checked) next.add(entryId);
                              else next.delete(entryId);
                              setSelected(next);
                            }}
                            className="w-4 h-4 rounded border-gray-300 accent-blue-500 cursor-pointer shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                          />

                          {/* Status badge */}
                          <span
                            className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              publishState === "done"
                                ? "bg-emerald-100 text-emerald-700"
                                : publishState === "error"
                                  ? "bg-red-100 text-red-700"
                                  : status === "draft"
                                    ? "bg-gray-100 text-gray-500"
                                    : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {publishState === "done"
                              ? "Published"
                              : publishState === "error"
                                ? "Error"
                                : status === "draft"
                                  ? "Draft"
                                  : "Modified"}
                          </span>

                          {/* Entry info */}
                          <div className="flex-1 min-w-0">
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-semibold text-gray-800 truncate hover:text-sky-600 transition-colors block"
                            >
                              {name}
                            </a>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                                {groupLabel}
                              </span>
                              {ctId && (
                                <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {ctId}
                                </span>
                              )}
                              {updatedAt && (
                                <span className="text-[10px] text-gray-400">
                                  {updatedAt.toLocaleDateString("en-GB", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Open in Contentful — minimalist icon button */}
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open in Contentful"
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-gray-200 text-gray-400 hover:text-sky-500 hover:border-sky-300 hover:bg-sky-50 transition-colors"
                            >
                              <svg
                                className="w-3.5 h-3.5"
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
                            </a>

                            {/* Changes diff button — only for modified entries */}
                            {status === "changed" &&
                              publishState !== "done" && (
                                <button
                                  onClick={() => handleViewEntryDiff(item)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
                                >
                                  Changes
                                </button>
                              )}

                            {/* Publish button */}
                            {publishState !== "done" && (
                              <button
                                disabled={
                                  !editMode || publishState === "loading"
                                }
                                title={
                                  !editMode
                                    ? "Enable edit mode to publish"
                                    : undefined
                                }
                                onClick={() => handlePublish(entryId)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                                  publishState === "error"
                                    ? "bg-red-500 hover:bg-red-600 text-white"
                                    : "bg-blue-500 hover:bg-blue-600 text-white"
                                }`}
                              >
                                {publishState === "loading" ? (
                                  <>
                                    <svg
                                      className="w-3.5 h-3.5 animate-spin shrink-0"
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
                                    Publishing…
                                  </>
                                ) : publishState === "error" ? (
                                  <>
                                    <svg
                                      className="w-3.5 h-3.5 shrink-0"
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
                                    Retry
                                  </>
                                ) : (
                                  <>
                                    <svg
                                      className="w-3.5 h-3.5 shrink-0"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      strokeWidth={2.5}
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                                      />
                                    </svg>
                                    Publish
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* Entry diff modal */}
      <EntryDiffModal
        modal={entryDiffModal}
        onClose={() => setEntryDiffModal(null)}
        spaceId={spaceId}
        environmentId={environmentId}
      />
    </main>
  );
}
