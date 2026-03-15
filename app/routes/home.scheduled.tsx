import { useRouteLoaderData } from "react-router";
import { useState, useEffect } from "react";
import type { RefGroup } from "~/lib/contentful/get-entry-tree";
import { resolveStringField } from "~/lib/resolve-string-field";
import { getEntry } from "~/lib/contentful/get-entry";
import { getContentfulManagementClient } from "~/lib/contentful";

// ── Types ─────────────────────────────────────────────────────────────────────

type ScheduledAction = {
  id: string;
  action: "publish" | "unpublish";
  entityId: string;
  entityType: string;
  scheduledAt: string;
  status: string;
};

type ContextData = {
  opcoId: string;
  partnerId: string;
  locales: { items: { code: string; name: string; default?: boolean }[] };
  spaceId: string;
  environmentId: string;
  scheduledActions: ScheduledAction[];
  // entry collections for name resolution
  opcoPages: { items: any[] };
  opcoMessages: { items: any[] };
  opcoRefGroups: RefGroup[];
  partnerPages: { items: any[] };
  partnerMessages: { items: any[] };
  partnerEmails: { items: any[] };
  partnerRefGroups: RefGroup[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getName(item: any, locale: string): string {
  return (
    resolveStringField(item.fields?.["internalName"], locale) ||
    resolveStringField(item.fields?.["title"], locale) ||
    item.sys?.id
  );
}

// ── Lazy entry name resolver ─────────────────────────────────────────────────

function EntryName({
  entryId,
  firstLocale,
}: {
  entryId: string;
  firstLocale: string;
}) {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getEntry(entryId)
      .then((entry) => {
        if (cancelled || !entry) return;
        const resolved =
          resolveStringField(entry.fields?.["internalName"], firstLocale) ||
          resolveStringField(entry.fields?.["title"], firstLocale) ||
          null;
        setName(resolved);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [entryId, firstLocale]);

  if (name === null) {
    return (
      <span className="inline-block h-3.5 w-40 bg-gray-200 rounded animate-pulse" />
    );
  }
  return <span>{name}</span>;
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <main className="flex-1 overflow-y-auto p-6 sm:p-8 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="mb-8">
        <div className="h-3 w-20 bg-gray-200 rounded animate-pulse mb-2" />
        <div className="h-7 w-52 bg-gray-200 rounded animate-pulse mb-1" />
        <div className="h-3 w-64 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="flex flex-col gap-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 animate-pulse"
          >
            <div className="w-4 h-4 rounded bg-gray-200 shrink-0" />
            <div className="w-14 h-4 bg-gray-200 rounded shrink-0" />
            <div className="flex-1 h-4 bg-gray-200 rounded" />
            <div className="w-16 h-4 bg-gray-200 rounded shrink-0" />
          </div>
        ))}
      </div>
    </main>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScheduledPage() {
  const ctx = useRouteLoaderData("routes/home") as ContextData | undefined;

  if (!ctx) return <LoadingSkeleton />;

  const {
    spaceId,
    environmentId,
    scheduledActions,
    opcoPages,
    opcoMessages,
    opcoRefGroups,
    partnerPages,
    partnerMessages,
    partnerEmails,
    partnerRefGroups,
    locales,
    opcoId,
    partnerId,
  } = ctx;

  const firstLocale = locales.items[0]?.code ?? "en";

  // Build entry lookup map: entityId → { name, scope }
  const entryMap = new Map<
    string,
    { name: string; scope: "opco" | "partner" }
  >();

  const register = (items: any[], scope: "opco" | "partner") => {
    for (const item of items) {
      entryMap.set(item.sys.id, { name: getName(item, firstLocale), scope });
    }
  };

  register(opcoPages.items, "opco");
  register(opcoMessages.items, "opco");
  for (const g of opcoRefGroups) register(g.items, "opco");
  register(partnerPages.items, "partner");
  register(partnerMessages.items, "partner");
  register(partnerEmails.items, "partner");
  for (const g of partnerRefGroups) register(g.items, "partner");

  const sorted = [...scheduledActions].sort(
    (a, b) =>
      new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );

  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());

  const handleCancel = async (actionId: string) => {
    setCancellingIds((prev) => new Set(prev).add(actionId));
    try {
      const client = getContentfulManagementClient();
      const space = await (client as any).getSpace(spaceId);
      await space.deleteScheduledAction({
        scheduledActionId: actionId,
        environmentId,
      });
      setCancelledIds((prev) => new Set(prev).add(actionId));
    } catch {
      // silently ignore — action may have already been cancelled
    } finally {
      setCancellingIds((prev) => {
        const next = new Set(prev);
        next.delete(actionId);
        return next;
      });
    }
  };

  const publishCount = sorted.filter((a) => a.action === "publish").length;
  const unpublishCount = sorted.filter((a) => a.action === "unpublish").length;
  const total = sorted.length;

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-6 sm:px-8 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-sky-600 uppercase tracking-widest mb-1">
              {opcoId}
              {partnerId ? ` · ${partnerId}` : ""}
            </p>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              Scheduled Actions
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {total === 0
                ? "No scheduled actions"
                : `${total} action${total !== 1 ? "s" : ""} scheduled`}
            </p>
          </div>
          {total > 0 && (
            <span className="shrink-0 text-sm font-bold px-2.5 py-1 rounded-full bg-sky-100 text-sky-700 border border-sky-200/60 tabular-nums mt-1">
              {total}
            </span>
          )}
        </div>
      </div>

      <div className="p-6 sm:p-8">
        {total === 0 ? (
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm font-medium">No scheduled actions</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Summary row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-white border border-gray-200 px-4 py-3 flex flex-col gap-0.5 shadow-sm">
                <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400">
                  Total
                </span>
                <span className="text-2xl font-extrabold text-sky-500 tabular-nums leading-tight">
                  {total}
                </span>
              </div>
              <div className="rounded-xl bg-white border border-gray-200 px-4 py-3 flex flex-col gap-0.5 shadow-sm">
                <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400">
                  Publish
                </span>
                <span className="text-2xl font-extrabold text-emerald-500 tabular-nums leading-tight">
                  {publishCount}
                </span>
              </div>
              <div className="rounded-xl bg-white border border-gray-200 px-4 py-3 flex flex-col gap-0.5 shadow-sm">
                <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400">
                  Unpublish
                </span>
                <span className="text-2xl font-extrabold text-orange-500 tabular-nums leading-tight">
                  {unpublishCount}
                </span>
              </div>
            </div>

            {/* Entry list */}
            <div className="flex flex-col gap-2">
              {sorted.map((action) => {
                const matched = entryMap.get(action.entityId);
                const name = matched?.name ?? action.entityId;
                const scope = matched?.scope;
                const date = new Date(action.scheduledAt);
                const dateStr = date.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });
                const timeStr = date.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const url = `https://app.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries/${action.entityId}`;
                const isCancelling = cancellingIds.has(action.id);
                const isCancelled = cancelledIds.has(action.id);

                return (
                  <div
                    key={action.id}
                    className={`flex items-center gap-4 px-5 py-3.5 rounded-xl border transition-colors bg-white ${
                      isCancelled
                        ? "border-gray-200 opacity-50"
                        : action.action === "publish"
                          ? "border-emerald-100"
                          : "border-orange-100"
                    }`}
                  >
                    {/* Action badge */}
                    <span
                      className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        action.action === "publish"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {action.action === "publish" ? "Publish" : "Unpublish"}
                    </span>

                    {/* Scope badge */}
                    {scope && (
                      <span
                        className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          scope === "opco"
                            ? "bg-violet-100 text-violet-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {scope === "opco" ? "OPCO" : "Partner"}
                      </span>
                    )}

                    {/* Entry name + Open in Contentful inline */}
                    <div className="flex-1 min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 min-w-0">
                        <span className="truncate">
                          {matched ? (
                            name
                          ) : (
                            <EntryName
                              entryId={action.entityId}
                              firstLocale={firstLocale}
                            />
                          )}
                        </span>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open in Contentful"
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded border border-gray-200 text-[10px] font-medium text-gray-400 hover:text-sky-500 hover:border-sky-300 hover:bg-sky-50 transition-colors"
                        >
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
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                          Contentful
                        </a>
                      </p>
                      <p className="text-[10px] font-mono text-gray-400">
                        {action.entityId}
                      </p>
                    </div>

                    {/* Scheduled date/time */}
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-semibold text-gray-700 tabular-nums">
                        {dateStr}
                      </p>
                      <p className="text-[10px] text-gray-400 tabular-nums">
                        {timeStr}
                      </p>
                    </div>

                    {/* Cancel button */}
                    {isCancelled ? (
                      <span className="shrink-0 text-[10px] font-semibold text-gray-400 px-2.5 py-1 rounded-lg border border-gray-200">
                        Cancelled
                      </span>
                    ) : (
                      <button
                        onClick={() => handleCancel(action.id)}
                        disabled={isCancelling}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-200 text-[10px] font-semibold text-red-500 hover:bg-red-50 hover:border-red-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {isCancelling && (
                          <svg
                            className="w-2.5 h-2.5 animate-spin"
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
                        )}
                        {isCancelling ? "Cancelling…" : "Cancel"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
