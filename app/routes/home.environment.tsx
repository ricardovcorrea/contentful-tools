import { useRouteLoaderData, useNavigate } from "react-router";
import { resolveStringField } from "~/lib/resolve-string-field";
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
    </main>
  );
}
