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
  opcoName,
  partnerName,
}: {
  entryCount: number;
  combinedStats: ReturnType<typeof getMissingStats>;
  locales: Locale[];
  localeCount: number;
  onViewOpco?: () => void;
  onViewPartner?: () => void;
  opcoHasLocalizable: boolean;
  partnerHasLocalizable: boolean;
  opcoName: string;
  partnerName: string;
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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/60 shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          Translation Coverage
        </p>
        <span className="text-[10px] font-medium text-sky-600 bg-sky-500/8 border border-sky-200/60 rounded px-1.5 py-0.5">
          {localeCount} locale{localeCount !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="px-4 py-4 flex flex-col gap-3 flex-1">
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
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/60 mt-auto -mx-4 -mb-4 flex items-center gap-4">
            {onViewOpco && (
              <button
                onClick={onViewOpco}
                className="flex items-center gap-1.5 text-[10px] font-semibold text-sky-600 hover:text-sky-700 transition-colors group"
              >
                {opcoName} translations
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
            {onViewPartner && (
              <button
                onClick={onViewPartner}
                className="flex items-center gap-1.5 text-[10px] font-semibold text-sky-600 hover:text-sky-700 transition-colors group"
              >
                {partnerName} translations
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
}: {
  actions: {
    id: string;
    action: "publish" | "unpublish";
    entityId: string;
    entityType: string;
    scheduledAt: string;
    status: string;
  }[];
}) {
  const navigate = useNavigate();

  const total = actions.length;
  const publishCount = actions.filter((a) => a.action === "publish").length;
  const unpublishCount = actions.filter((a) => a.action === "unpublish").length;

  const next = [...actions]
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    )
    .at(0);
  const nextDate = next ? new Date(next.scheduledAt) : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/60">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          Scheduled
        </p>
        {total > 0 && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200/60">
            {total}
          </span>
        )}
      </div>

      {/* Body */}
      {total === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-10 gap-3 text-gray-400">
          <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-violet-300"
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
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-gray-600">
              No scheduled actions
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Entries queued for publish or unpublish will appear here
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-5 py-4 flex-1">
          {/* Big stat */}
          <div className="flex items-end gap-3">
            <span className="text-4xl font-extrabold text-sky-500 leading-none tabular-nums">
              {total}
            </span>
            <span className="text-xs font-medium text-gray-400 mb-1">
              {total === 1 ? "action" : "actions"} scheduled
            </span>
          </div>

          {/* Action type breakdown */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 flex flex-col gap-0.5">
              <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-500">
                Publish
              </span>
              <span className="text-xl font-bold text-emerald-600 tabular-nums leading-tight">
                {publishCount}
              </span>
            </div>
            <div className="flex-1 rounded-lg bg-orange-50 border border-orange-100 px-3 py-2 flex flex-col gap-0.5">
              <span className="text-[9px] font-bold uppercase tracking-wide text-orange-500">
                Unpublish
              </span>
              <span className="text-xl font-bold text-orange-600 tabular-nums leading-tight">
                {unpublishCount}
              </span>
            </div>
          </div>

          {/* Next scheduled */}
          {nextDate && (
            <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
              <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400 block mb-0.5">
                Next
              </span>
              <span className="text-xs font-semibold text-gray-700 tabular-nums">
                {nextDate.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}{" "}
                at{" "}
                {nextDate.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Footer links */}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/60 mt-auto flex items-center gap-2">
        <button
          onClick={() => navigate("/scheduled")}
          className="flex items-center gap-1.5 text-[10px] font-semibold text-sky-600 hover:text-sky-700 transition-colors group"
        >
          View all scheduled actions
          <svg
            className="w-3 h-3 group-hover:translate-x-0.5 transition-transform"
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
      </div>
    </div>
  );
}

function UnpublishedCard({
  opcoId,
  partnerId,
}: {
  opcoId: string;
  partnerId: string;
}) {
  const navigate = useNavigate();

  type FetchState =
    | { status: "loading" }
    | { status: "error" }
    | {
        status: "done";
        total: number;
        drafts: number;
        modified: number;
        opcoCount: number;
        partnerCount: number;
      };

  const [state, setState] = useState<FetchState>({ status: "loading" });

  useEffect(() => {
    if (!opcoId || !partnerId) {
      setState({
        status: "done",
        total: 0,
        drafts: 0,
        modified: 0,
        opcoCount: 0,
        partnerCount: 0,
      });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });

    const isUnpublished = (item: any) => {
      const neverPublished = !item.sys?.publishedAt;
      if (neverPublished) return true;
      return (
        !!item.sys?.updatedAt &&
        new Date(item.sys.updatedAt) > new Date(item.sys.publishedAt)
      );
    };

    Promise.all([
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
    ])
      .then(
        ([
          opcoPages,
          opcoMessages,
          partnerPages,
          partnerMessages,
          partnerEmails,
        ]) => {
          if (cancelled) return;
          const opcoItems = [
            ...opcoPages.items.filter((i: any) => !i.fields?.partner),
            ...opcoMessages.items.filter((i: any) => !i.fields?.partner),
          ].filter(isUnpublished);
          const partnerItems = [
            ...partnerPages.items,
            ...partnerMessages.items,
            ...partnerEmails.items,
          ].filter(isUnpublished);
          const all = [...opcoItems, ...partnerItems];
          setState({
            status: "done",
            total: all.length,
            drafts: all.filter((i) => !i.sys?.publishedAt).length,
            modified: all.filter((i) => !!i.sys?.publishedAt).length,
            opcoCount: opcoItems.length,
            partnerCount: partnerItems.length,
          });
        },
      )
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [opcoId, partnerId]);

  const allGood = state.status === "done" && state.total === 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/60">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          Unpublished Content
        </p>
        {state.status === "done" && !allGood && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200/60">
            {state.total}
          </span>
        )}
      </div>

      {/* Body */}
      {state.status === "loading" ? (
        <div className="flex flex-col items-center justify-center flex-1 py-10 gap-2 text-gray-300">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
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
          <p className="text-xs">Loading…</p>
        </div>
      ) : state.status === "error" ? (
        <div className="flex flex-col items-center justify-center flex-1 py-10 gap-2 text-red-400">
          <p className="text-xs font-medium">Failed to load</p>
        </div>
      ) : allGood ? (
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
        <div className="flex flex-col gap-4 px-5 py-4 flex-1">
          {/* Big stat */}
          <div className="flex items-end gap-3">
            <span className="text-4xl font-extrabold text-amber-500 leading-none tabular-nums">
              {state.total}
            </span>
            <span className="text-xs font-medium text-gray-400 mb-1">
              {state.total === 1 ? "entry" : "entries"} need publishing
            </span>
          </div>

          {/* Status breakdown */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 flex flex-col gap-0.5">
              <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400">
                Draft
              </span>
              <span className="text-xl font-bold text-gray-700 tabular-nums leading-tight">
                {state.drafts}
              </span>
            </div>
            <div className="flex-1 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 flex flex-col gap-0.5">
              <span className="text-[9px] font-bold uppercase tracking-wide text-amber-500">
                Modified
              </span>
              <span className="text-xl font-bold text-amber-600 tabular-nums leading-tight">
                {state.modified}
              </span>
            </div>
          </div>

          {/* Scope breakdown */}
          <div className="flex gap-2 flex-wrap">
            {state.opcoCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-200/60">
                <span className="font-bold">{state.opcoCount}</span> OPCO{" "}
                {state.opcoCount === 1 ? "entry" : "entries"}
              </span>
            )}
            {state.partnerCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/60">
                <span className="font-bold">{state.partnerCount}</span> Partner{" "}
                {state.partnerCount === 1 ? "entry" : "entries"}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Footer link */}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/60 mt-auto">
        <button
          onClick={() => navigate("/unpublished")}
          className="flex items-center gap-1.5 text-[10px] font-semibold text-sky-600 hover:text-sky-700 transition-colors group"
        >
          View all unpublished content
          <svg
            className="w-3 h-3 group-hover:translate-x-0.5 transition-transform"
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
      </div>
    </div>
  );
}

// ── Content Freshness Card ────────────────────────────────────────────────────

function ContentFreshnessCard({
  entries,
  opcoName,
  partnerName,
}: {
  entries: any[];
  opcoName: string;
  partnerName: string;
}) {
  const now = Date.now();
  const DAY = 86_400_000;

  let today = 0;
  let week = 0;
  let month = 0;
  let older = 0;
  let mostRecentTs = 0;

  for (const entry of entries) {
    const ts = entry.sys?.updatedAt
      ? new Date(entry.sys.updatedAt).getTime()
      : 0;
    if (ts > mostRecentTs) mostRecentTs = ts;
    const age = now - ts;
    if (age < DAY) today++;
    else if (age < 7 * DAY) week++;
    else if (age < 30 * DAY) month++;
    else older++;
  }

  const total = entries.length;
  const mostRecentDate = mostRecentTs
    ? new Date(mostRecentTs).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  type Band = {
    label: string;
    value: number;
    bar: string;
    text: string;
    bg: string;
    border: string;
  };
  const bands: Band[] = [
    {
      label: "Today",
      value: today,
      bar: "bg-emerald-400",
      text: "text-emerald-700",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
    },
    {
      label: "Last 7 days",
      value: week,
      bar: "bg-sky-400",
      text: "text-sky-700",
      bg: "bg-sky-50",
      border: "border-sky-100",
    },
    {
      label: "Last 30 days",
      value: month,
      bar: "bg-amber-400",
      text: "text-amber-700",
      bg: "bg-amber-50",
      border: "border-amber-100",
    },
    {
      label: "Older",
      value: older,
      bar: "bg-gray-300",
      text: "text-gray-500",
      bg: "bg-gray-50",
      border: "border-gray-100",
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/60">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          Content Freshness
        </p>
        {total > 0 && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200/60">
            {total}
          </span>
        )}
      </div>

      {/* Body */}
      {total === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-10 gap-3 text-gray-400">
          <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-sky-300"
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
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-gray-600">
              No entries found
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Recent Contentful entries for this OPCO &amp; partner will appear
              here
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-5 py-4 flex-1">
          {/* Most recent update */}
          {mostRecentDate && (
            <div className="flex items-end gap-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">
                  Last updated
                </p>
                <p className="text-lg font-extrabold text-gray-800 leading-none">
                  {mostRecentDate}
                </p>
              </div>
              <span className="text-xs text-gray-400 mb-0.5">
                across {opcoName} &amp; {partnerName}
              </span>
            </div>
          )}

          {/* Age bands */}
          <div className="flex flex-col gap-2">
            {bands.map((b) => (
              <div key={b.label} className="flex items-center gap-2.5">
                <div className="flex-1 flex flex-col gap-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-gray-500">
                      {b.label}
                    </span>
                    <span
                      className={`text-[10px] font-bold tabular-nums ${b.text}`}
                    >
                      {b.value}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${b.bar} transition-all`}
                      style={{
                        width:
                          total > 0
                            ? `${Math.round((b.value / total) * 100)}%`
                            : "0%",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Active entries badge row */}
          <div className="flex gap-2 flex-wrap">
            {today + week > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <span className="font-bold">{today + week}</span> updated this
                week
              </span>
            )}
            {older > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200/60">
                <span className="font-bold">{older}</span> not touched in 30d+
              </span>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/60 mt-auto">
        <p className="text-[10px] text-gray-400">
          Based on <span className="font-semibold">{total}</span> entries scoped
          to {opcoName}
        </p>
      </div>
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
    <main className="flex-1 overflow-y-auto bg-gray-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-6 sm:px-8 pt-6">
        {/* Title row */}
        <div className="flex items-start justify-between gap-4 pb-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-sky-600 uppercase tracking-widest mb-1">
              Environment
            </p>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              {environmentName}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {environmentId !== environmentName
                ? environmentId
                : "Content entries, statistics and scheduled actions for this environment"}
            </p>
          </div>
          {envStats.totalEntries !== null && (
            <span className="shrink-0 text-sm font-bold px-2.5 py-1 rounded-full bg-sky-100 text-sky-700 border border-sky-200/60 tabular-nums mt-1">
              {envStats.totalEntries}
            </span>
          )}
        </div>

        {/* Toolbar row */}
        <div className="flex items-center gap-2 flex-wrap pb-3">
          <a
            href={`https://app.contentful.com/spaces/${spaceId}/environments/${environmentId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-[10px] font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <svg
              className="w-3 h-3 shrink-0"
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
      </div>

      <div className="px-6 sm:px-8 py-6">
        {/* Row 1: environment stats (full width) */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col mb-5">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/60">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Environment Stats
            </p>
          </div>
          <div className="px-4 py-4 grid grid-cols-3 sm:grid-cols-5 gap-2.5">
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
        </div>

        {/* Row 2: translation coverage + content freshness */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
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
            opcoName={opcoName}
            partnerName={partnerName}
          />
          <ContentFreshnessCard
            entries={allEntries}
            opcoName={opcoName}
            partnerName={partnerName}
          />
        </div>

        {/* Row 3: unpublished + scheduled */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <UnpublishedCard opcoId={opcoId} partnerId={partnerId} />
          <ScheduledCard actions={scheduledActions} />
        </div>
      </div>
    </main>
  );
}
