import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams, useRouteLoaderData, useNavigate } from "react-router";
import { useToast } from "~/lib/toast";
import { useEditMode } from "~/lib/edit-mode";
import { getContentType } from "~/lib/contentful/get-content-type";
import { useAsset } from "~/lib/contentful/get-asset";
import { resolveImageUrl } from "~/lib/format";
import { getEntry, invalidateEntry } from "~/lib/contentful/get-entry";
import { queryKeys } from "~/lib/query-keys";
import { getContentfulManagementEnvironment } from "~/lib/contentful";
import { resolveStringField } from "~/lib/resolve-string-field";
import {
  isRichText,
  extractRichTextPlain,
  wrapAsRichText,
} from "~/lib/rich-text";
// ── Extracted components (kept here as fallback; extracted versions in components/) ──
import {
  CellValue as _CellValue,
  AssetCell as _AssetCell,
} from "~/components/overview/CellValue";
import {
  GroupTable as _GroupTable,
  useLocalizableFields as _useLocalizableFields,
} from "~/components/overview/GroupTable";
import { ImportDiffModal } from "~/components/overview/modals/ImportDiffModal";
import { ApplyProgressModal } from "~/components/overview/modals/ApplyProgressModal";
import { EntryDiffModal } from "~/components/overview/modals/EntryDiffModal";
import type { EntryDiffModalState } from "~/types/contentful";
import {
  parseCsv as _parseCsv,
  serializeCsvValue as _serializeCsvValue,
} from "~/lib/csv";

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
  opcoRefGroups: Array<{
    contentTypeId: string;
    label: string;
    slug: string;
    items: any[];
  }>;
  partnerRefGroups: Array<{
    contentTypeId: string;
    label: string;
    slug: string;
    items: any[];
  }>;
  locales: { items: { code: string }[] };
  opcoConfiguredLocaleCodes?: string[];
  spaceId: string;
  environmentId: string;
};

type EntryGroup = {
  label: string;
  slug: string;
  items: any[];
};

function resolveAssetUrl(url: string | undefined): string | null {
  if (!url) return null;
  return url.startsWith("//") ? `https:${url}` : url;
}

function AssetCell({
  assetId,
  firstLocale,
}: {
  assetId: string;
  firstLocale: string;
}) {
  const { data: asset, isLoading: loading } = useAsset(assetId);
  const _pd = useRouteLoaderData("routes/home") as any;
  const _spaceId: string = _pd?.spaceId ?? "";
  const _envId: string = _pd?.environmentId ?? "";

  const fields = asset?.fields ?? {};
  const title =
    fields["title"]?.[firstLocale] ??
    (Object.values(fields["title"] ?? {}) as string[])[0] ??
    assetId;
  const fileObj =
    fields["file"]?.[firstLocale] ??
    (Object.values(fields["file"] ?? {}) as any[])[0];
  const url = resolveAssetUrl(fileObj?.url);
  const contentType: string = fileObj?.contentType ?? "";
  const isImage = contentType.startsWith("image/");

  if (loading) {
    return (
      <span
        className="inline-block h-4 w-20 bg-gray-200 rounded"
        style={{ animation: "skeleton-shimmer 1.4s ease-in-out infinite" }}
      />
    );
  }

  const _cfUrl =
    _spaceId && _envId
      ? `https://app.contentful.com/spaces/${_spaceId}/environments/${_envId}/assets/${assetId}`
      : null;

  return (
    <div className="flex flex-col gap-1 py-0.5">
      {isImage && url && (
        <div className="relative group">
          <img
            src={
              resolveImageUrl(fileObj?.url, { h: 160, fm: "webp", q: 80 }) ??
              url
            }
            alt={typeof title === "string" ? title : assetId}
            className="max-h-20 max-w-full rounded object-contain"
          />
          {_cfUrl && (
            <a
              href={_cfUrl}
              target="_blank"
              rel="noreferrer"
              title="Open in Contentful"
              onClick={(e) => e.stopPropagation()}
              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 hover:bg-white rounded p-0.5 shadow-sm"
            >
              <svg
                className="w-3 h-3 text-gray-500"
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
          )}
        </div>
      )}
      <span className="text-xs text-gray-500">
        {typeof title === "string" ? title : assetId}
      </span>
      <span className="font-mono text-[10px] text-gray-600">
        {assetId.slice(0, 8)}…
      </span>
    </div>
  );
}

/**
 * Fetches an entry (referenced by an entry-link field whose name hints at
 * an image, e.g. `openGraphImage`) and renders the first image asset it
 * contains, together with the existing ref pill.
 */
function EntryImageCell({
  entryId,
  firstLocale,
}: {
  entryId: string;
  firstLocale: string;
}) {
  const [assetId, setAssetId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getEntry(entryId)
      .then((entry) => {
        if (cancelled) return;
        const fields = entry?.fields ?? {};
        let found: string | null = null;
        outer: for (const localeMap of Object.values(fields)) {
          const val =
            (localeMap as any)?.[firstLocale] ??
            Object.values((localeMap as any) ?? {})[0];
          if (val?.sys?.linkType === "Asset" && val?.sys?.id) {
            found = val.sys.id;
            break outer;
          }
          if (Array.isArray(val)) {
            for (const v of val) {
              if (v?.sys?.linkType === "Asset" && v?.sys?.id) {
                found = v.sys.id;
                break outer;
              }
            }
          }
        }
        setAssetId(found);
        setChecked(true);
      })
      .catch(() => setChecked(true));
    return () => {
      cancelled = true;
    };
  }, [entryId, firstLocale]);

  return (
    <div className="flex flex-col gap-1">
      {!checked && (
        <span
          className="inline-block h-4 w-20 bg-gray-200 rounded"
          style={{ animation: "skeleton-shimmer 1.4s ease-in-out infinite" }}
        />
      )}
      {assetId && <AssetCell assetId={assetId} firstLocale={firstLocale} />}
      <span className="font-mono text-[10px] text-gray-600">
        ref:{entryId.slice(0, 8)}…
      </span>
    </div>
  );
}

/** Render a single locale cell value */
function CellValue({
  value,
  firstLocale,
  fieldId,
}: {
  value: unknown;
  firstLocale: string;
  fieldId?: string;
}) {
  if (value === undefined || value === null || value === "") {
    return (
      <span className="inline-flex items-center gap-1 text-red-400/80 italic text-xs font-medium">
        <svg
          className="w-3 h-3 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
        missing
      </span>
    );
  }
  if (typeof value === "string") {
    return (
      <span className="text-gray-700 text-sm wrap-break-word">{value}</span>
    );
  }
  if (typeof value === "object" && value !== null) {
    const sys = (value as any)?.sys;
    // Asset link
    if (sys?.linkType === "Asset" && sys?.id) {
      return <AssetCell assetId={sys.id} firstLocale={firstLocale} />;
    }
    // Array — check if it's a list of asset links
    if (Array.isArray(value)) {
      const allAssets = value.every(
        (v) => (v as any)?.sys?.linkType === "Asset",
      );
      if (allAssets && value.length > 0) {
        return (
          <div className="flex flex-col gap-1.5">
            {(value as any[]).map((v) => (
              <AssetCell
                key={v.sys.id}
                assetId={v.sys.id}
                firstLocale={firstLocale}
              />
            ))}
          </div>
        );
      }
      return (
        <span className="text-xs text-gray-500 italic">
          {value.length} reference{value.length !== 1 ? "s" : ""}
        </span>
      );
    }
    // Entry link — if field name suggests an image, try to surface the asset
    if (sys?.linkType === "Entry" && sys?.id) {
      const looksLikeImage = fieldId != null && /image/i.test(fieldId);
      if (looksLikeImage) {
        return <EntryImageCell entryId={sys.id} firstLocale={firstLocale} />;
      }
      return (
        <span className="font-mono text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
          ref:{sys.id.slice(0, 8)}…
        </span>
      );
    }
    // Generic ref
    if (sys?.id) {
      return (
        <span className="font-mono text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
          ref:{sys.id.slice(0, 8)}…
        </span>
      );
    }
  }
  return (
    <span className="font-mono text-xs text-gray-600">
      {JSON.stringify(value).slice(0, 80)}
    </span>
  );
}

/** Fetches content type and returns sorted list of localizable field IDs */
function useLocalizableFields(contentTypeId: string | undefined) {
  const [fields, setFields] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!contentTypeId) return;
    let cancelled = false;
    setFields(null);
    setLoading(true);
    getContentType(contentTypeId)
      .then((ct) => {
        if (cancelled) return;
        setFields(ct.fields.filter((f) => f.localized).map((f) => f.id));
      })
      .catch(() => {
        if (!cancelled) setFields([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contentTypeId]);

  return { fields, loading };
}

/** Serialize a field value to a plain string suitable for CSV */
function serializeCsvValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string") return value;
  if (typeof value === "boolean" || typeof value === "number")
    return String(value);
  // Contentful Rich Text Document — extract readable plain text
  if (isRichText(value)) return extractRichTextPlain(value).trim();
  if (Array.isArray(value)) {
    return value
      .map((v) => {
        const s = v?.sys;
        if (s?.linkType === "Asset") return `[asset:${s.id}]`;
        if (s?.linkType === "Entry") return `[ref:${s.id}]`;
        return serializeCsvValue(v);
      })
      .join(" | ");
  }
  if (typeof value === "object") {
    const s = (value as any)?.sys;
    if (s?.linkType === "Asset") return `[asset:${s.id}]`;
    if (s?.linkType === "Entry") return `[ref:${s.id}]`;
    return JSON.stringify(value);
  }
  return String(value);
}

// ── Diff types ──────────────────────────────────────────────────────────────
type ApplyStatus = "pending" | "loading" | "success" | "error";
type ApplyEntry = {
  entryId: string;
  entryName: string;
  fields: Record<string, Record<string, string>>;
  status: ApplyStatus;
  error?: string;
};

type DiffChange = {
  old: string;
  new: string;
  enGB: string;
  kind: "added" | "changed";
};
type DiffRow = {
  scope: string;
  group: string;
  entryName: string;
  entryId: string;
  field: string;
  changes: Record<string, DiffChange>;
};

/** Minimal RFC-4180 CSV parser */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        pushField();
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        pushField();
        if (row.some((v) => v !== "")) rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }
  pushField();
  if (row.some((v) => v !== "")) rows.push(row);
  return rows;
}

/** One group table — fetches its own content type to get localizable fields */
function GroupTable({
  group,
  localeCodes,
  targetLocaleCodes,
  firstLocale,
  navigate,
  spaceId,
  environmentId,
  expanded,
  onToggle,
  groupKey,
  onMissingResolved,
  onFieldsResolved,
}: {
  group: EntryGroup;
  localeCodes: string[];
  /** Locales to use for missing-translation detection (excludes en-GB when not in OPCO config) */
  targetLocaleCodes: string[];
  firstLocale: string;
  navigate: (path: string) => void;
  spaceId: string;
  environmentId: string;
  expanded: boolean;
  onToggle: () => void;
  groupKey: string;
  onMissingResolved: (key: string, count: number) => void;
  onFieldsResolved: (key: string, fields: string[]) => void;
}) {
  const contentTypeId: string | undefined =
    group.items[0]?.sys?.contentType?.sys?.id;
  const { fields: localizableFields, loading } =
    useLocalizableFields(contentTypeId);

  const { editMode } = useEditMode();
  const queryClientInstance = useQueryClient();
  const _homeData = useRouteLoaderData("routes/home") as
    | { opcoId?: string; partnerId?: string }
    | undefined;
  const _opcoId = _homeData?.opcoId ?? "";
  const _partnerId = _homeData?.partnerId ?? "";

  // ── Inline edit state ──────────────────────────────────────────────
  const [localEdits, setLocalEdits] = useState<Record<string, unknown>>({});
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [saveCellError, setSaveCellError] = useState<Record<string, string>>(
    {},
  );

  // Close any open inline editor when edit mode is turned off
  useEffect(() => {
    if (!editMode) {
      setEditingCell(null);
      setEditingValue("");
    }
  }, [editMode]);

  const handleSaveInline = useCallback(
    async (
      entryId: string,
      fieldId: string,
      lc: string,
      value: string | boolean,
    ) => {
      const ck = `${entryId}|${fieldId}|${lc}`;
      setSavingCell(ck);
      setSaveCellError((prev) => {
        const n = { ...prev };
        delete n[ck];
        return n;
      });
      try {
        const environment = await getContentfulManagementEnvironment();
        const cfEntry = await environment.getEntry(entryId);
        cfEntry.fields[fieldId] ??= {};
        // Booleans: save as-is. Rich Text: wrap plain-text. Otherwise: save string.
        const existingVal = cfEntry.fields[fieldId][lc];
        const valueToSave =
          typeof value === "boolean"
            ? value
            : isRichText(existingVal)
              ? wrapAsRichText(value)
              : value;
        cfEntry.fields[fieldId][lc] = valueToSave;
        await cfEntry.update();
        // Write the updated value into the TanStack Query cache so all
        // subscribers (useEntry hooks) see fresh data immediately.
        queryClientInstance.setQueryData(
          queryKeys.entry(entryId, _opcoId, _partnerId),
          (old: any) => {
            if (!old) return old;
            return {
              ...old,
              fields: {
                ...old.fields,
                [fieldId]: {
                  ...(old.fields[fieldId] ?? {}),
                  [lc]: valueToSave,
                },
              },
            };
          },
        );
        // Invalidate so next background refetch gets the latest from Contentful.
        invalidateEntry(entryId, _opcoId, _partnerId);
        setLocalEdits((prev) => ({ ...prev, [ck]: valueToSave }));
        setEditingCell(null);
        setEditingValue("");
      } catch (err: any) {
        setSaveCellError((prev) => ({
          ...prev,
          [ck]: err?.message ?? "Save failed",
        }));
      } finally {
        setSavingCell(null);
      }
    },
    [queryClientInstance, _opcoId, _partnerId],
  );

  const getName = (fields: Record<string, any>) => {
    const name =
      resolveStringField(fields["internalName"], firstLocale) ||
      resolveStringField(fields["title"], firstLocale);
    return name || null;
  };

  const isMissingValue = (val: unknown) =>
    val === undefined ||
    val === null ||
    val === "" ||
    (Array.isArray(val) && val.length === 0);

  // en-GB is always the source column (firstLocale is hardcoded to "en-GB").
  // Other locales are only flagged missing when en-GB has a value but they don't.
  const isFieldMissing = (
    fieldLocaleMap: Record<string, unknown> | undefined,
    lc: string,
  ) => {
    if (lc === firstLocale) return false;
    const sourceVal = fieldLocaleMap?.[firstLocale];
    return !isMissingValue(sourceVal) && isMissingValue(fieldLocaleMap?.[lc]);
  };

  const entriesWithMissing =
    localizableFields && localizableFields.length > 0
      ? group.items.filter((item) =>
          localizableFields.some((fieldId) =>
            targetLocaleCodes.some((lc) =>
              isFieldMissing(item.fields[fieldId], lc),
            ),
          ),
        ).length
      : 0;

  // Notify parent once the missing count is known so it can sort sections
  useEffect(() => {
    if (!loading && localizableFields !== null) {
      onMissingResolved(groupKey, entriesWithMissing);
      onFieldsResolved(groupKey, localizableFields);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, localizableFields]);

  // Hide section entirely once we know there are no translatable fields
  if (!loading && localizableFields && localizableFields.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 mb-3 text-left group/header rounded-lg py-1 px-1 -mx-1 hover:bg-gray-200/40 transition-colors"
      >
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">
          {group.label}
        </h3>
        <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full tabular-nums">
          {group.items.length}
        </span>
        {loading && (
          <span
            className="text-xs text-gray-600 italic"
            style={{ animation: "skeleton-shimmer 1.4s ease-in-out infinite" }}
          >
            Loading fields…
          </span>
        )}
        {!loading && localizableFields && entriesWithMissing > 0 && (
          <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
            {entriesWithMissing} with missing translations
          </span>
        )}
        {!loading &&
          localizableFields &&
          entriesWithMissing === 0 &&
          localizableFields.length > 0 && (
            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              All translations present
            </span>
          )}
        <svg
          className={`ml-auto w-4 h-4 text-gray-500 transition-transform duration-200 shrink-0 ${
            expanded ? "" : "-rotate-90"
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {expanded && (
        <div className="rounded-xl border border-gray-300 overflow-hidden mb-2">
          {loading || !localizableFields ? (
            <div
              className="p-4 space-y-2"
              style={{
                animation: "skeleton-shimmer 1.4s ease-in-out infinite",
              }}
            >
              {[80, 60, 70, 55, 65].map((w, i) => (
                <div
                  key={i}
                  className="h-8 bg-gray-200 rounded"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-200 border-b border-gray-300">
                    <th className="sticky left-0 z-10 bg-gray-200 text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide min-w-52">
                      Entry
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-36 border-l border-gray-300">
                      Field
                    </th>
                    {localeCodes.map((lc) => (
                      <th
                        key={lc}
                        className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide min-w-48 border-l border-gray-300"
                      >
                        <span
                          className={
                            lc === firstLocale
                              ? "text-gray-500"
                              : "text-blue-600"
                          }
                        >
                          {lc}
                        </span>
                        {lc === firstLocale && (
                          <span className="ml-1.5 text-[9px] font-bold text-gray-400 bg-gray-200 px-1 py-0.5 rounded normal-case tracking-normal">
                            source
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item, entryIndex) => {
                    const name = getName(item.fields) ?? item.sys.id;
                    const rowCount = localizableFields.length;
                    const entryBg =
                      entryIndex % 2 === 0 ? "bg-gray-100" : "bg-gray-200/40";
                    const entryHasMissing = localizableFields.some((fieldId) =>
                      targetLocaleCodes.some((lc) =>
                        isFieldMissing(item.fields[fieldId], lc),
                      ),
                    );

                    return localizableFields.map((fieldId, fieldIndex) => {
                      const isFirstField = fieldIndex === 0;
                      const isLastField = fieldIndex === rowCount - 1;
                      const topBorder =
                        isFirstField && entryIndex > 0
                          ? "border-t border-gray-300"
                          : "";

                      return (
                        <tr
                          key={`${item.sys.id}-${fieldId}`}
                          className={`${entryBg} hover:bg-blue-500/5 transition-colors group`}
                        >
                          {isFirstField && (
                            <td
                              rowSpan={rowCount}
                              onClick={() => navigate(`/entry/${item.sys.id}`)}
                              className={`sticky left-0 z-10 ${entryBg} group-hover:bg-blue-500/5 px-4 py-3 align-top cursor-pointer transition-colors ${entryIndex > 0 ? "border-t border-gray-300" : ""}`}
                            >
                              <div className="flex items-start gap-2">
                                {entryHasMissing && (
                                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-gray-800 leading-snug">
                                      {name}
                                    </p>
                                    <a
                                      href={`https://app.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries/${item.sys.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      title="Open in Contentful"
                                      className="shrink-0 flex items-center justify-center w-5 h-5 rounded border border-gray-300 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                                    >
                                      <svg
                                        className="w-3 h-3"
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
                                  </div>
                                  <p className="text-[10px] font-mono text-gray-600 mt-0.5">
                                    {item.sys.id}
                                  </p>
                                </div>
                              </div>
                            </td>
                          )}
                          <td
                            className={`px-4 py-2 align-top border-l border-gray-300/60 ${topBorder} ${isLastField ? "pb-3" : ""}`}
                          >
                            <span className="font-mono text-xs text-gray-500">
                              {fieldId}
                            </span>
                          </td>
                          {localeCodes.map((lc) => {
                            const ck = `${item.sys.id}|${fieldId}|${lc}`;
                            const isLocallySaved = ck in localEdits;
                            const effectiveVal = isLocallySaved
                              ? localEdits[ck]
                              : item.fields[fieldId]?.[lc];
                            const missing =
                              !isLocallySaved &&
                              targetLocaleCodes.includes(lc) &&
                              isFieldMissing(item.fields[fieldId], lc);
                            const isEditing = editingCell === ck;
                            const isSaving = savingCell === ck;
                            const cellError = saveCellError[ck];

                            // ── Boolean field: render a toggle checkbox ────
                            const isBooleanField =
                              typeof effectiveVal === "boolean" ||
                              typeof item.fields[fieldId]?.[firstLocale] ===
                                "boolean";
                            if (isBooleanField) {
                              const boolVal = effectiveVal === true;
                              return (
                                <td
                                  key={lc}
                                  className={`px-4 py-2 align-top border-l border-gray-300/60 ${topBorder} ${isLastField ? "pb-3" : ""}`}
                                >
                                  <button
                                    disabled={
                                      isSaving ||
                                      lc === firstLocale ||
                                      !editMode
                                    }
                                    onClick={() =>
                                      lc !== firstLocale &&
                                      editMode &&
                                      handleSaveInline(
                                        item.sys.id,
                                        fieldId,
                                        lc,
                                        !boolVal,
                                      )
                                    }
                                    className={`flex items-center gap-1.5 py-0.5 rounded transition-opacity ${lc === firstLocale ? "cursor-default opacity-60" : editMode ? "cursor-pointer hover:opacity-80" : "cursor-not-allowed opacity-50"} ${isSaving ? "opacity-40" : ""}`}
                                    title={
                                      lc === firstLocale
                                        ? "Source locale"
                                        : !editMode
                                          ? "Enable Edit mode to make changes"
                                          : `Click to toggle ${fieldId} / ${lc}`
                                    }
                                  >
                                    <div
                                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                                        boolVal
                                          ? "bg-blue-500 border-blue-500"
                                          : "bg-white border-gray-300"
                                      }`}
                                    >
                                      {boolVal && (
                                        <svg
                                          className="w-2.5 h-2.5 text-white"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                          strokeWidth={3.5}
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M5 13l4 4L19 7"
                                          />
                                        </svg>
                                      )}
                                    </div>
                                    <span
                                      className={`text-xs font-medium ${
                                        boolVal
                                          ? "text-blue-600"
                                          : "text-gray-400"
                                      }`}
                                    >
                                      {boolVal ? "true" : "false"}
                                    </span>
                                    {isSaving && (
                                      <svg
                                        className="w-3 h-3 animate-spin text-gray-400"
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
                                    {isLocallySaved && (
                                      <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-100 px-1 py-0.5 rounded">
                                        saved
                                      </span>
                                    )}
                                  </button>
                                  {cellError && (
                                    <p className="text-[10px] text-red-500 mt-1">
                                      {cellError}
                                    </p>
                                  )}
                                </td>
                              );
                            }

                            if (isEditing && editMode) {
                              return (
                                <td
                                  key={lc}
                                  className={`px-2 py-2 align-top border-l border-gray-300/60 max-w-72 ${topBorder} ${isLastField ? "pb-3" : ""} bg-blue-50`}
                                >
                                  <textarea
                                    autoFocus
                                    value={editingValue}
                                    ref={(el) => {
                                      if (el) {
                                        el.style.height = "auto";
                                        el.style.height =
                                          el.scrollHeight + "px";
                                      }
                                    }}
                                    onChange={(e) =>
                                      setEditingValue(e.target.value)
                                    }
                                    onInput={(e) => {
                                      const t = e.currentTarget;
                                      t.style.height = "auto";
                                      t.style.height = t.scrollHeight + "px";
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Escape") {
                                        setEditingCell(null);
                                        setEditingValue("");
                                      }
                                      if (
                                        e.key === "Enter" &&
                                        (e.metaKey || e.ctrlKey)
                                      ) {
                                        if (!editMode) return;
                                        handleSaveInline(
                                          item.sys.id,
                                          fieldId,
                                          lc,
                                          editingValue.trim(),
                                        );
                                      }
                                    }}
                                    className="w-full text-xs border border-blue-300 rounded px-2 py-1.5 resize-none overflow-hidden font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    placeholder={`Translation for ${lc}…`}
                                  />
                                  {cellError && (
                                    <p className="text-[10px] text-red-500 mt-1">
                                      {cellError}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    <button
                                      disabled={
                                        isSaving ||
                                        !editingValue.trim() ||
                                        !editMode
                                      }
                                      onClick={() =>
                                        editMode &&
                                        handleSaveInline(
                                          item.sys.id,
                                          fieldId,
                                          lc,
                                          editingValue.trim(),
                                        )
                                      }
                                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                      {isSaving && (
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
                                      {isSaving ? "Saving…" : "Save"}
                                    </button>
                                    <button
                                      disabled={isSaving}
                                      onClick={() => {
                                        setEditingCell(null);
                                        setEditingValue("");
                                      }}
                                      className="px-2 py-0.5 rounded text-[10px] font-semibold text-gray-500 hover:bg-gray-200 disabled:opacity-40 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <span className="ml-auto text-[9px] text-gray-400">
                                      ⌘⏎ save
                                    </span>
                                  </div>
                                </td>
                              );
                            }

                            return (
                              <td
                                key={lc}
                                className={`px-4 py-2 align-top border-l border-gray-300/60 max-w-72 transition-colors group/cell ${topBorder} ${isLastField ? "pb-3" : ""} ${
                                  isLocallySaved
                                    ? editMode
                                      ? "bg-emerald-50/60 hover:bg-emerald-100/60 cursor-pointer"
                                      : "bg-emerald-50/60"
                                    : missing
                                      ? editMode
                                        ? "bg-red-950/25 hover:bg-blue-50 cursor-pointer"
                                        : "bg-red-950/25 cursor-default"
                                      : editMode
                                        ? "hover:bg-blue-50/70 cursor-pointer"
                                        : "cursor-default"
                                }`}
                                onClick={(e) => {
                                  if (!editMode) return;
                                  e.stopPropagation();
                                  setEditingCell(ck);
                                  setEditingValue(
                                    isRichText(effectiveVal)
                                      ? extractRichTextPlain(
                                          effectiveVal,
                                        ).trim()
                                      : typeof effectiveVal === "string"
                                        ? effectiveVal
                                        : typeof effectiveVal === "boolean"
                                          ? String(effectiveVal)
                                          : "",
                                  );
                                }}
                                title={
                                  editMode
                                    ? `Click to edit ${fieldId} / ${lc}`
                                    : "Enable Edit mode to make changes"
                                }
                              >
                                {isLocallySaved ? (
                                  <span className="flex items-center gap-1.5">
                                    <CellValue
                                      value={effectiveVal}
                                      firstLocale={firstLocale}
                                      fieldId={fieldId}
                                    />
                                    <span className="shrink-0 text-[9px] font-semibold text-emerald-600 bg-emerald-100 px-1 py-0.5 rounded">
                                      saved
                                    </span>
                                  </span>
                                ) : missing ? (
                                  <span className="inline-flex items-center gap-1 text-red-400/80 italic text-xs font-medium">
                                    <svg
                                      className="w-3 h-3 shrink-0"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      strokeWidth={2.5}
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M6 18L18 6M6 6l12 12"
                                      />
                                    </svg>
                                    missing
                                  </span>
                                ) : (
                                  <span className="flex items-center justify-between gap-1">
                                    <CellValue
                                      value={effectiveVal}
                                      firstLocale={firstLocale}
                                      fieldId={fieldId}
                                    />
                                    {editMode && (
                                      <svg
                                        className="w-3 h-3 shrink-0 text-gray-300 group-hover/cell:text-blue-400 transition-colors"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                        />
                                      </svg>
                                    )}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OverviewPage() {
  const { scope, group } = useParams<{ scope: string; group?: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { editMode } = useEditMode();
  const queryClientInstance = useQueryClient();
  const parentData = useRouteLoaderData("routes/home") as ParentLoaderData;

  if (!parentData) return null;

  const {
    locales,
    opcos,
    opcoPartners,
    opcoPages,
    opcoMessages,
    partnerPages,
    partnerMessages,
    partnerEmails,
    opcoRefGroups,
    partnerRefGroups,
    opcoId,
    partnerId,
    spaceId,
    environmentId,
    opcoConfiguredLocaleCodes,
  } = parentData;

  // Rule 1: en-GB is always the source column (base language).
  // Rule 2: remaining columns are the OPCO's configured locales (en-GB excluded).
  // Rule 3: a cell is "missing" when en-GB has a value but the OPCO locale does not.
  const EN_GB = "en-GB";
  const opcoLocaleCodes = locales.items.map((l) => l.code);
  const localeCodes = [EN_GB, ...opcoLocaleCodes.filter((l) => l !== EN_GB)];
  const firstLocale = EN_GB;

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
  const opcoDisplayName =
    (selectedOpcoEntry ? getName(selectedOpcoEntry.fields) : null) ?? opcoId;
  const partnerDisplayName =
    (selectedPartnerEntry ? getName(selectedPartnerEntry.fields) : null) ??
    partnerId;
  // Locales to consider for missing-translation detection:
  // Only OPCO-explicitly-configured locales, excluding en-GB (it is the source,
  // never a translation target — unless the OPCO has explicitly listed it AND it
  // is not the default/source locale).
  const configuredCodes = opcoConfiguredLocaleCodes ?? opcoLocaleCodes;
  const missingCheckCodes = configuredCodes.filter((c) => c !== EN_GB);
  const isOpco = scope === "opco";
  const showPartnerInOpco = isOpco && !group;

  // Compute groups early so we can initialise accordion state from them
  const opcoGroups: EntryGroup[] = [
    { label: "Pages", slug: "pages", items: opcoPages.items },
    { label: "Messages", slug: "messages", items: opcoMessages.items },
    ...opcoRefGroups,
  ];
  const partnerGroups: EntryGroup[] = [
    { label: "Pages", slug: "pages", items: partnerPages.items },
    { label: "Messages", slug: "messages", items: partnerMessages.items },
    { label: "Emails", slug: "emails", items: partnerEmails.items },
    ...partnerRefGroups,
  ];

  // Keys for all non-empty group tables that will be rendered
  const initialRenderedKeys: string[] = [
    ...(isOpco
      ? opcoGroups
          .filter((g) => g.items.length > 0)
          .map((g) => `opco-${g.slug}`)
      : []),
    ...(showPartnerInOpco || !isOpco
      ? partnerGroups
          .filter((g) => g.items.length > 0)
          .map((g) => `partner-${g.slug}`)
      : []),
  ];
  const autoExpand = false;

  // Section-level accordion (OPCO / Partner banners)
  const [opcoOpen, setOpcoOpen] = useState(autoExpand);
  const [partnerOpen, setPartnerOpen] = useState(autoExpand);

  // Accordion state — track explicitly expanded group keys; empty = all collapsed
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() =>
    autoExpand ? new Set(initialRenderedKeys) : new Set(),
  );

  const toggleKey = (key: string) =>
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const isExpanded = (key: string) => expandedKeys.has(key);

  // Missing-count map: populated by GroupTable callbacks, used for sorting
  const [missingCounts, setMissingCounts] = useState<Record<string, number>>(
    {},
  );
  const handleMissingResolved = useCallback(
    (key: string, count: number) =>
      setMissingCounts((prev) =>
        prev[key] === count ? prev : { ...prev, [key]: count },
      ),
    [],
  );

  // Resolved localizable fields per group key
  const [resolvedGroupFields, setResolvedGroupFields] = useState<
    Record<string, string[]>
  >({});
  const handleFieldsResolved = useCallback(
    (key: string, fields: string[]) =>
      setResolvedGroupFields((prev) => ({ ...prev, [key]: fields })),
    [],
  );

  /** Sort a group list so sections with missing translations come first */
  const sortByMissing = (list: EntryGroup[], prefix: string) =>
    [...list].sort((a, b) => {
      const ca = missingCounts[`${prefix}-${a.slug}`] ?? -1;
      const cb = missingCounts[`${prefix}-${b.slug}`] ?? -1;
      const hasMissingA = ca > 0 ? 1 : 0;
      const hasMissingB = cb > 0 ? 1 : 0;
      if (hasMissingA !== hasMissingB) return hasMissingB - hasMissingA;
      // Both missing: sort by count desc
      if (hasMissingA && hasMissingB) return cb - ca;
      return 0; // preserve original order otherwise
    });

  const allGroups: EntryGroup[] = isOpco ? opcoGroups : partnerGroups;

  // Filter to a single group when a slug is provided in the URL
  const groups = group ? allGroups.filter((g) => g.slug === group) : allGroups;
  const activeGroupLabel = groups.length === 1 ? groups[0].label : null;

  // On the full OPCO overview (no group filter) also show partner groups
  // (showPartnerInOpco already computed above with the groups)

  const exportCsv = useCallback(() => {
    const getName = (fields: Record<string, any>) => {
      const name =
        resolveStringField(fields["internalName"], firstLocale) ||
        resolveStringField(fields["title"], firstLocale);
      return name || null;
    };

    const escCsv = (v: string) => {
      const s = v.replace(/"/g, '""');
      return /[",\n\r]/.test(s) ? `"${s}"` : s;
    };

    const header = [
      "scope",
      "group",
      "entry_name",
      "entry_id",
      "field",
      ...localeCodes,
    ];
    const rows: string[][] = [header];

    const buildRows = (groupList: EntryGroup[], prefix: string) => {
      for (const grp of groupList) {
        if (grp.items.length === 0) continue;
        const key = `${prefix}-${grp.slug}`;
        const fields = resolvedGroupFields[key];
        if (!fields || fields.length === 0) continue;
        for (const item of grp.items) {
          const name = getName(item.fields) ?? item.sys.id;
          for (const fieldId of fields) {
            const row = [
              prefix,
              grp.label,
              name,
              item.sys.id,
              fieldId,
              ...localeCodes.map((lc) =>
                serializeCsvValue(item.fields[fieldId]?.[lc]),
              ),
            ];
            rows.push(row);
          }
        }
      }
    };

    if (isOpco) {
      buildRows(opcoGroups, "opco");
      if (showPartnerInOpco) buildRows(partnerGroups, "partner");
    } else {
      buildRows(partnerGroups, "partner");
    }

    const csv = rows.map((r) => r.map(escCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `translations-${isOpco ? opcoId : partnerId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [
    resolvedGroupFields,
    localeCodes,
    firstLocale,
    isOpco,
    opcoGroups,
    partnerGroups,
    showPartnerInOpco,
    opcoId,
    partnerId,
  ]);

  // ── Import & Diff ──────────────────────────────────────────────────────────
  const [diffRows, setDiffRows] = useState<DiffRow[]>([]);
  const [acceptedKeys, setAcceptedKeys] = useState<Set<string>>(new Set());
  const [diffOpen, setDiffOpen] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(
    new Set(),
  );
  const [applyProgressOpen, setApplyProgressOpen] = useState(false);
  const [applyEntries, setApplyEntries] = useState<ApplyEntry[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"translations" | "unpublished">(
    "translations",
  );
  const [publishingEntries, setPublishingEntries] = useState<
    Record<string, "loading" | "done" | "error">
  >({});
  const [selectedUnpublished, setSelectedUnpublished] = useState<Set<string>>(
    new Set(),
  );
  const [entryDiffModal, setEntryDiffModal] =
    useState<EntryDiffModalState>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

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
            error: "No snapshot found for this entry.",
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

  // Finds a raw list item by entryId across all groups so we can mutate its sys in-place.
  const findCachedItem = useCallback(
    (entryId: string) =>
      [...opcoGroups, ...partnerGroups]
        .flatMap((g) => g.items)
        .find((i: any) => i.sys.id === entryId),
    [opcoGroups, partnerGroups],
  );

  /** Publish one entry with retry/verification (mirrors home.unpublished.tsx).
   *  The Contentful SDK sometimes throws even when the publish succeeds due to
   *  response-parsing races or CDN 502s.  We re-check up to 5 times. */
  const publishEntryRobust = useCallback(
    async (entryId: string): Promise<any> => {
      const environment = await getContentfulManagementEnvironment();
      const entry = await environment.getEntry(entryId);
      const initialPv = entry.sys?.publishedVersion ?? -1;
      const attemptedAt = Date.now();
      try {
        const result = await entry.publish();
        return result?.sys ?? result;
      } catch (publishErr) {
        for (let attempt = 0; attempt < 5; attempt++) {
          const wait = attempt < 2 ? 2000 : attempt < 4 ? 3000 : 4000;
          await new Promise((r) => setTimeout(r, wait));
          try {
            const rechecked = await environment.getEntry(entryId);
            const pv = rechecked.sys?.publishedVersion ?? -1;
            const publishedAt = rechecked.sys?.publishedAt
              ? new Date(rechecked.sys.publishedAt).getTime()
              : 0;
            if (pv > initialPv || publishedAt >= attemptedAt - 5_000) {
              return rechecked.sys;
            }
          } catch {
            // re-check network error — keep retrying
          }
        }
        throw publishErr;
      }
    },
    [],
  );

  const handlePublishEntry = useCallback(
    async (entryId: string) => {
      setPublishingEntries((prev) => ({ ...prev, [entryId]: "loading" }));
      try {
        const publishedSys = await publishEntryRobust(entryId);
        // Mutate cached item sys so filteredUnpublishedItems stops including it.
        const cached = findCachedItem(entryId);
        if (cached && publishedSys) {
          Object.assign(cached.sys, publishedSys);
        }
        setPublishingEntries((prev) => ({ ...prev, [entryId]: "done" }));
        addToast("Entry published successfully", "success");
      } catch (err) {
        console.error("Failed to publish entry", entryId, err);
        setPublishingEntries((prev) => ({ ...prev, [entryId]: "error" }));
      }
    },
    [findCachedItem, addToast, publishEntryRobust],
  );

  const handlePublishSelected = useCallback(
    async (ids: string[]) => {
      setPublishingEntries((prev) => {
        const next = { ...prev };
        for (const id of ids) next[id] = "loading";
        return next;
      });
      setSelectedUnpublished(new Set());
      let successCount = 0;
      let errorCount = 0;
      await Promise.all(
        ids.map(async (entryId) => {
          try {
            const publishedSys = await publishEntryRobust(entryId);
            // Mutate cached item sys so filteredUnpublishedItems stops including it.
            const cached = findCachedItem(entryId);
            if (cached && publishedSys) {
              Object.assign(cached.sys, publishedSys);
            }
            setPublishingEntries((prev) => ({ ...prev, [entryId]: "done" }));
            successCount++;
          } catch (err) {
            console.error("Failed to publish entry", entryId, err);
            setPublishingEntries((prev) => ({ ...prev, [entryId]: "error" }));
            errorCount++;
          }
        }),
      );
      if (successCount > 0 && errorCount === 0) {
        addToast(
          `${successCount} entr${successCount === 1 ? "y" : "ies"} published successfully`,
          "success",
        );
      } else if (successCount > 0) {
        addToast(`${successCount} published, ${errorCount} failed`, "info");
      }
    },
    [findCachedItem, addToast],
  );

  const handleApplyChanges = useCallback(async () => {
    if (acceptedKeys.size === 0) return;

    // Build plan grouped by entryId
    const plan: Record<
      string,
      { entryName: string; fields: Record<string, Record<string, string>> }
    > = {};
    for (const row of diffRows) {
      for (const [lc, change] of Object.entries(row.changes)) {
        const ck = `${row.entryId}-${row.field}-${lc}`;
        if (!acceptedKeys.has(ck)) continue;
        plan[row.entryId] ??= { entryName: row.entryName, fields: {} };
        plan[row.entryId].fields[row.field] ??= {};
        plan[row.entryId].fields[row.field][lc] = change.new;
      }
    }

    // Log full plan to console
    console.group("[Apply Changes] Planned Contentful updates");
    console.log("Total entries to update:", Object.keys(plan).length);
    for (const [entryId, { entryName, fields }] of Object.entries(plan)) {
      console.group(`Entry: ${entryName} (${entryId})`);
      for (const [field, locales] of Object.entries(fields)) {
        console.group(`  Field: ${field}`);
        for (const [locale, value] of Object.entries(locales)) {
          console.log(`    [${locale}] →`, value);
        }
        console.groupEnd();
      }
      console.groupEnd();
    }
    console.groupEnd();

    // Initialise progress entries all as "pending" and open modal
    const entries: ApplyEntry[] = Object.entries(plan).map(
      ([entryId, { entryName, fields }]) => ({
        entryId,
        entryName,
        fields,
        status: "pending",
      }),
    );
    setApplyEntries(entries);
    setApplyProgressOpen(true);

    const setEntryStatus = (
      entryId: string,
      status: ApplyStatus,
      error?: string,
    ) =>
      setApplyEntries((prev) =>
        prev.map((e) => (e.entryId === entryId ? { ...e, status, error } : e)),
      );

    // Run all updates in parallel
    let applySuccess = 0;
    let applyError = 0;
    await Promise.all(
      entries.map(async (entry) => {
        setEntryStatus(entry.entryId, "loading");
        try {
          // ── Contentful Management API calls ────────────────────────────
          const environment = await getContentfulManagementEnvironment();
          const cfEntry = await environment.getEntry(entry.entryId);
          for (const [field, locales] of Object.entries(entry.fields)) {
            cfEntry.fields[field] ??= {};
            for (const [locale, value] of Object.entries(locales)) {
              // If the existing field value is Rich Text, wrap the plain-text
              // translation in a minimal Contentful Document structure.
              const existingVal = cfEntry.fields[field]?.[locale];
              cfEntry.fields[field][locale] = isRichText(existingVal)
                ? wrapAsRichText(value)
                : value;
            }
          }
          const updated = await cfEntry.update();
          // Patch the in-memory raw item so the table reflects the new
          // values immediately without a full page reload.
          const cachedRaw = findCachedItem(entry.entryId);
          if (cachedRaw) {
            for (const [field, locales] of Object.entries(entry.fields)) {
              cachedRaw.fields[field] ??= {};
              for (const [locale, value] of Object.entries(locales)) {
                const existing = cachedRaw.fields[field]?.[locale];
                cachedRaw.fields[field][locale] = isRichText(existing)
                  ? wrapAsRichText(value)
                  : value;
              }
            }
            if (updated?.sys) Object.assign(cachedRaw.sys, updated.sys);
          }
          // Invalidate the individual entry query so background refetch picks up truth.
          queryClientInstance.invalidateQueries({
            queryKey: queryKeys.entry(entry.entryId, opcoId, partnerId),
          });
          // ───────────────────────────────────────────────────────────────
          setEntryStatus(entry.entryId, "success");
          applySuccess++;
        } catch (err: any) {
          console.error(`[Apply Changes] Failed for ${entry.entryId}:`, err);
          setEntryStatus(
            entry.entryId,
            "error",
            err?.message ?? "Unknown error",
          );
          applyError++;
        }
      }),
    );

    if (applySuccess > 0 && applyError === 0) {
      addToast(
        `${applySuccess} entr${applySuccess === 1 ? "y" : "ies"} imported successfully`,
        "success",
      );
    } else if (applySuccess > 0) {
      addToast(`${applySuccess} imported, ${applyError} failed`, "info");
    }

    // Invalidate group-level queries so the next navigation/background
    // refetch pulls fresh data — without wiping the whole cache.
    queryClientInstance.invalidateQueries({
      queryKey: queryKeys.opcoPages(opcoId),
    });
    queryClientInstance.invalidateQueries({
      queryKey: queryKeys.opcoMessages(opcoId),
    });
    queryClientInstance.invalidateQueries({
      queryKey: queryKeys.opcoRefs(opcoId),
    });
    queryClientInstance.invalidateQueries({
      queryKey: queryKeys.partnerPages(opcoId, partnerId),
    });
    queryClientInstance.invalidateQueries({
      queryKey: queryKeys.partnerMessages(opcoId, partnerId),
    });
    queryClientInstance.invalidateQueries({
      queryKey: queryKeys.partnerEmails(opcoId, partnerId),
    });
    queryClientInstance.invalidateQueries({
      queryKey: queryKeys.partnerRefs(opcoId, partnerId),
    });
  }, [
    acceptedKeys,
    diffRows,
    addToast,
    findCachedItem,
    queryClientInstance,
    opcoId,
    partnerId,
  ]);

  const handleImportCsv = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setImportError(null);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = (ev.target?.result as string) ?? "";
        const parsed = parseCsv(text);
        if (parsed.length < 2) {
          setImportError("The CSV file is empty or has no data rows.");
          if (importInputRef.current) importInputRef.current.value = "";
          return;
        }
        const header = parsed[0];
        // Validate header structure: scope,group,entry_name,entry_id,field,...locales
        if (
          header[0] !== "scope" ||
          header[1] !== "group" ||
          header[2] !== "entry_name" ||
          header[3] !== "entry_id" ||
          header[4] !== "field" ||
          header.length < 6
        ) {
          setImportError(
            "Invalid CSV format. Expected columns: scope, group, entry_name, entry_id, field, <locales…>",
          );
          if (importInputRef.current) importInputRef.current.value = "";
          return;
        }
        const localeStart = 5;
        const csvLocales = header.slice(localeStart);

        // Build current-value lookup and the set of valid entry IDs in this view
        const validEntryIds = new Set<string>();
        const currentMap: Record<
          string,
          Record<string, Record<string, string>>
        > = {};
        for (const grp of [...opcoGroups, ...partnerGroups]) {
          for (const item of grp.items) {
            validEntryIds.add(item.sys.id);
            const em = (currentMap[item.sys.id] ??= {});
            for (const [fieldId, localeMap] of Object.entries(
              item.fields as Record<string, Record<string, unknown>>,
            )) {
              const fm = (em[fieldId] ??= {});
              for (const [lc, val] of Object.entries(localeMap)) {
                fm[lc] = serializeCsvValue(val);
              }
            }
          }
        }

        // Validate that at least one row belongs to entries in this view
        const dataRows = parsed.slice(1).filter((r) => r[3] && r[4]);
        const matchingRows = dataRows.filter((r) => validEntryIds.has(r[3]));
        if (matchingRows.length === 0) {
          const contextLabel = isOpco
            ? `opco "${opcoId}"`
            : `partner "${partnerId}" under opco "${opcoId}"`;
          setImportError(
            `This CSV does not belong to the current ${contextLabel}. None of the ${dataRows.length} entry IDs in the file match the ${validEntryIds.size} entries loaded in this view.`,
          );
          if (importInputRef.current) importInputRef.current.value = "";
          return;
        }

        const diffs: DiffRow[] = [];
        for (let i = 1; i < parsed.length; i++) {
          const cols = parsed[i];
          const [scope, group, entryName, entryId, field] = cols;
          if (!entryId || !field) continue;
          // Always read en-GB from Contentful so it reflects the live source value
          const enGBVal = (
            currentMap[entryId]?.[field]?.[firstLocale] ?? ""
          ).trim();
          const changes: Record<string, DiffChange> = {};
          csvLocales.forEach((lc, idx) => {
            const newVal = (cols[localeStart + idx] ?? "").trim();
            const oldVal = (currentMap[entryId]?.[field]?.[lc] ?? "").trim();
            if (newVal === oldVal || newVal === "") return;
            changes[lc] = {
              old: oldVal,
              new: newVal,
              enGB: enGBVal,
              kind: oldVal === "" ? "added" : "changed",
            };
          });
          if (Object.keys(changes).length > 0) {
            diffs.push({ scope, group, entryName, entryId, field, changes });
          }
        }

        if (diffs.length === 0) {
          setImportError(
            `No translatable differences found. The file matched ${matchingRows.length} entr${matchingRows.length !== 1 ? "ies" : "y"} but all values are already up to date.`,
          );
          if (importInputRef.current) importInputRef.current.value = "";
          return;
        }

        setDiffRows(diffs);
        setAcceptedKeys(
          new Set(
            diffs.flatMap((row) =>
              Object.keys(row.changes).map(
                (lc) => `${row.entryId}-${row.field}-${lc}`,
              ),
            ),
          ),
        );
        setExpandedEntries(new Set(diffs.map((row) => row.entryId)));
        setDiffOpen(true);
        setImportError(null);
        if (importInputRef.current) importInputRef.current.value = "";
      };
      reader.readAsText(file, "utf-8");
    },
    [opcoGroups, partnerGroups, firstLocale, isOpco, opcoId, partnerId],
  );

  // ── Unpublished entries ────────────────────────────────────────────
  type UnpublishedItem = {
    item: any;
    scope: string;
    group: string;
    groupLabel: string;
    status: "draft" | "changed";
  };
  const unpublishedItems: UnpublishedItem[] = [
    ...opcoGroups.flatMap(
      (grp) =>
        grp.items
          .map((item) => {
            const neverPublished = !item.sys.publishedAt;
            const hasChanges =
              !neverPublished &&
              (item.sys.version ?? 1) > (item.sys.publishedVersion ?? 0) + 1;
            if (!neverPublished && !hasChanges) return null;
            return {
              item,
              scope: "opco",
              group: `opco-${grp.slug}`,
              groupLabel: grp.label,
              status: (neverPublished ? "draft" : "changed") as
                | "draft"
                | "changed",
            };
          })
          .filter(Boolean) as UnpublishedItem[],
    ),
    ...(isOpco ? [] : []),
    ...partnerGroups.flatMap(
      (grp) =>
        grp.items
          .map((item) => {
            const neverPublished = !item.sys.publishedAt;
            const hasChanges =
              !neverPublished &&
              (item.sys.version ?? 1) > (item.sys.publishedVersion ?? 0) + 1;
            if (!neverPublished && !hasChanges) return null;
            return {
              item,
              scope: "partner",
              group: `partner-${grp.slug}`,
              groupLabel: grp.label,
              status: (neverPublished ? "draft" : "changed") as
                | "draft"
                | "changed",
            };
          })
          .filter(Boolean) as UnpublishedItem[],
    ),
  ];

  // allRenderedKeys mirrors initialRenderedKeys (computed before state, used by expand/collapse all)
  const allRenderedKeys = initialRenderedKeys;

  // When a group slug is active in the URL, scope the unpublished tab to that group only
  const filteredUnpublishedItems = group
    ? unpublishedItems.filter((u) => u.group === `${u.scope}-${group}`)
    : unpublishedItems;

  const totalEntries =
    groups.reduce((acc, g) => acc + g.items.length, 0) +
    (showPartnerInOpco
      ? partnerGroups.reduce((acc, g) => acc + g.items.length, 0)
      : 0);

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50">
      <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-6 sm:px-8 pt-6">
        {/* Title row */}
        <div className="flex items-start justify-between gap-4 pb-4">
          <div className="min-w-0">
            <p
              className={`text-xs font-bold uppercase tracking-widest mb-1 ${isOpco ? "text-violet-600" : "text-emerald-600"}`}
            >
              {isOpco ? "OPCO" : "Partner"}
            </p>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              {isOpco ? opcoDisplayName : partnerDisplayName}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {isOpco
                ? `OPCO & partner translations · ${localeCodes.length} locales · only localizable fields shown`
                : `Partner translations · ${localeCodes.length} locales · only localizable fields shown`}
            </p>
          </div>
          {totalEntries > 0 && (
            <span
              className={`shrink-0 text-sm font-bold px-2.5 py-1 rounded-full border tabular-nums mt-1 ${isOpco ? "bg-violet-100 text-violet-700 border-violet-200/60" : "bg-emerald-100 text-emerald-700 border-emerald-200/60"}`}
            >
              {totalEntries}
            </span>
          )}
        </div>

        {/* Toolbar row — only visible on the Translations tab */}
        {activeTab === "translations" && (
          <div className="flex items-center gap-2 flex-wrap pb-3">
            {/* Expand / Collapse segmented control */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-[10px] font-semibold">
              <button
                onClick={() => setExpandedKeys(new Set(allRenderedKeys))}
                className="px-2.5 py-1 bg-white text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Expand all
              </button>
              <button
                onClick={() => setExpandedKeys(new Set())}
                className="px-2.5 py-1 bg-white text-gray-500 hover:bg-gray-50 border-l border-gray-200 transition-colors"
              >
                Collapse all
              </button>
            </div>

            <div className="h-4 w-px bg-gray-200 shrink-0" />

            {/* Export */}
            <button
              onClick={exportCsv}
              disabled={Object.keys(resolvedGroupFields).length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-[10px] font-semibold text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Export translations as CSV"
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Export CSV
            </button>

            {/* Import */}
            <input
              ref={importInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportCsv}
            />
            <button
              onClick={() => editMode && importInputRef.current?.click()}
              disabled={!editMode}
              title={
                editMode
                  ? "Import a CSV and review translation changes"
                  : "Enable Edit mode to import"
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition-colors ${
                editMode
                  ? "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 cursor-pointer"
                  : "border-gray-200 bg-white text-gray-300 cursor-not-allowed opacity-50"
              }`}
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12"
                />
              </svg>
              Import &amp; Diff
            </button>

            {importError && (
              <span
                className="text-xs text-red-500 bg-red-50 border border-red-200 rounded px-2 py-1 leading-snug cursor-pointer"
                title={importError}
                onClick={() => setImportError(null)}
              >
                ✕ {importError}
              </span>
            )}

            {/* Legend */}
            <div className="ml-auto flex items-center gap-2 text-[10px] text-gray-400 font-medium">
              <span className="flex items-center gap-1 text-red-400">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                missing
              </span>
              <span className="text-gray-300">·</span>
              <span>click entry to open detail</span>
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex items-end gap-0 -mb-px">
          <button
            onClick={() => setActiveTab("translations")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "translations"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Translations
          </button>
          <button
            onClick={() => setActiveTab("unpublished")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "unpublished"
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Unpublished
            {filteredUnpublishedItems.length > 0 && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === "unpublished"
                    ? "bg-amber-100 text-amber-600"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {filteredUnpublishedItems.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="px-6 py-6 sm:px-8">
        {activeTab === "translations" && (
          <>
            {showPartnerInOpco && (
              <button
                onClick={() => setOpcoOpen((p) => !p)}
                className="w-full flex items-center gap-0 mb-4 rounded-xl border border-violet-200 hover:border-violet-300 overflow-hidden transition-all shadow-sm group"
              >
                <div className="w-1 self-stretch bg-violet-500 shrink-0" />
                <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-violet-50/30 group-hover:bg-violet-50/60 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 border border-violet-200 flex items-center justify-center shrink-0">
                    <svg
                      className="w-4 h-4 text-violet-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064"
                      />
                    </svg>
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500 leading-none mb-0.5">
                      OPCO
                    </p>
                    <p className="text-sm font-bold text-gray-800 truncate">
                      {opcoDisplayName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-500 tabular-nums font-medium bg-white border border-gray-200 px-2.5 py-1 rounded-lg">
                      {opcoGroups.reduce((a, g) => a + g.items.length, 0)}{" "}
                      entries
                    </span>
                    {opcoGroups.reduce(
                      (acc, g) => acc + (missingCounts[`opco-${g.slug}`] ?? 0),
                      0,
                    ) > 0 && (
                      <span className="text-xs font-semibold bg-red-50 text-red-500 border border-red-200 px-2.5 py-1 rounded-lg">
                        {opcoGroups.reduce(
                          (acc, g) =>
                            acc + (missingCounts[`opco-${g.slug}`] ?? 0),
                          0,
                        )}{" "}
                        missing
                      </span>
                    )}
                    {opcoGroups.reduce(
                      (acc, g) => acc + (missingCounts[`opco-${g.slug}`] ?? 0),
                      0,
                    ) === 0 &&
                      Object.keys(missingCounts).some((k) =>
                        k.startsWith("opco-"),
                      ) && (
                        <span className="flex items-center gap-1 text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-1 rounded-lg">
                          <svg
                            className="w-3 h-3 shrink-0"
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
                          Complete
                        </span>
                      )}
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ml-2 ${
                      opcoOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>
            )}
            {(!showPartnerInOpco || opcoOpen) &&
              sortByMissing(groups, isOpco ? "opco" : "partner").map(
                (group) => {
                  if (group.items.length === 0) return null;
                  const key = `${isOpco ? "opco" : "partner"}-${group.slug}`;
                  return (
                    <GroupTable
                      key={key}
                      group={group}
                      localeCodes={localeCodes}
                      targetLocaleCodes={missingCheckCodes}
                      firstLocale={firstLocale}
                      navigate={navigate}
                      spaceId={spaceId}
                      environmentId={environmentId}
                      expanded={isExpanded(key)}
                      onToggle={() => toggleKey(key)}
                      groupKey={key}
                      onMissingResolved={handleMissingResolved}
                      onFieldsResolved={handleFieldsResolved}
                    />
                  );
                },
              )}

            {showPartnerInOpco && (
              <>
                {opcoPartners.items.length > 0 ? (
                  <>
                    <button
                      onClick={() => setPartnerOpen((p) => !p)}
                      className="w-full flex items-center gap-0 mt-4 mb-4 rounded-xl border border-emerald-200 hover:border-emerald-300 overflow-hidden transition-all shadow-sm group"
                    >
                      <div className="w-1 self-stretch bg-emerald-500 shrink-0" />
                      <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-emerald-50/30 group-hover:bg-emerald-50/60 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
                          <svg
                            className="w-4 h-4 text-emerald-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 leading-none mb-0.5">
                            Partner
                          </p>
                          <p className="text-sm font-bold text-gray-800 truncate">
                            {partnerDisplayName}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-gray-500 tabular-nums font-medium bg-white border border-gray-200 px-2.5 py-1 rounded-lg">
                            {partnerGroups.reduce(
                              (a, g) => a + g.items.length,
                              0,
                            )}{" "}
                            entries
                          </span>
                          {partnerGroups.reduce(
                            (acc, g) =>
                              acc + (missingCounts[`partner-${g.slug}`] ?? 0),
                            0,
                          ) > 0 && (
                            <span className="text-xs font-semibold bg-red-50 text-red-500 border border-red-200 px-2.5 py-1 rounded-lg">
                              {partnerGroups.reduce(
                                (acc, g) =>
                                  acc +
                                  (missingCounts[`partner-${g.slug}`] ?? 0),
                                0,
                              )}{" "}
                              missing
                            </span>
                          )}
                          {partnerGroups.reduce(
                            (acc, g) =>
                              acc + (missingCounts[`partner-${g.slug}`] ?? 0),
                            0,
                          ) === 0 &&
                            Object.keys(missingCounts).some((k) =>
                              k.startsWith("partner-"),
                            ) && (
                              <span className="flex items-center gap-1 text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                <svg
                                  className="w-3 h-3 shrink-0"
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
                                Complete
                              </span>
                            )}
                        </div>
                        <svg
                          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ml-2 ${
                            partnerOpen ? "rotate-180" : ""
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </button>
                    {partnerOpen &&
                      sortByMissing(partnerGroups, "partner").map((group) => {
                        if (group.items.length === 0) return null;
                        const key = `partner-${group.slug}`;
                        return (
                          <GroupTable
                            key={key}
                            group={group}
                            localeCodes={localeCodes}
                            targetLocaleCodes={missingCheckCodes}
                            firstLocale={firstLocale}
                            navigate={navigate}
                            spaceId={spaceId}
                            environmentId={environmentId}
                            expanded={isExpanded(key)}
                            onToggle={() => toggleKey(key)}
                            groupKey={key}
                            onMissingResolved={handleMissingResolved}
                            onFieldsResolved={handleFieldsResolved}
                          />
                        );
                      })}
                  </>
                ) : (
                  <div className="mt-4 flex items-center gap-3 px-4 py-4 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 text-emerald-700">
                    <svg
                      className="w-5 h-5 shrink-0 text-emerald-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold">No partners yet</p>
                      <p className="text-xs text-emerald-600 mt-0.5">
                        Use the{" "}
                        <span className="font-semibold">
                          Create first partner
                        </span>{" "}
                        button in the header to add one.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === "unpublished" && (
          <>
            {filteredUnpublishedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-400">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-emerald-400"
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
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-600">
                    All entries are published
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    No draft or modified entries found in this view
                  </p>
                </div>
              </div>
            ) : (
              (() => {
                const selectableIds = filteredUnpublishedItems
                  .filter(
                    ({ item }) =>
                      publishingEntries[item.sys.id] !== "done" &&
                      publishingEntries[item.sys.id] !== "loading",
                  )
                  .map(({ item }) => item.sys.id);
                const allSelected =
                  selectableIds.length > 0 &&
                  selectableIds.every((id) => selectedUnpublished.has(id));
                const someSelected =
                  !allSelected &&
                  selectableIds.some((id) => selectedUnpublished.has(id));
                return (
                  <div>
                    {/* Toolbar */}
                    <div className="flex items-center gap-3 mb-3 px-1">
                      <label className="flex items-center gap-2 text-xs text-gray-500 select-none cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someSelected;
                          }}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUnpublished(new Set(selectableIds));
                            } else {
                              setSelectedUnpublished(new Set());
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 accent-blue-500 cursor-pointer"
                        />
                        Select all
                      </label>
                      {selectedUnpublished.size > 0 && (
                        <button
                          onClick={() =>
                            editMode &&
                            handlePublishSelected(
                              Array.from(selectedUnpublished),
                            )
                          }
                          disabled={!editMode}
                          title={
                            editMode ? undefined : "Enable Edit mode to publish"
                          }
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm ${
                            editMode
                              ? "bg-blue-500 text-white hover:bg-blue-600 cursor-pointer"
                              : "bg-gray-200 text-gray-400 cursor-not-allowed opacity-60"
                          }`}
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
                          Publish {selectedUnpublished.size}{" "}
                          {selectedUnpublished.size === 1 ? "entry" : "entries"}
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      {filteredUnpublishedItems.map(
                        ({ item, scope, groupLabel, status }) => {
                          const name =
                            resolveStringField(
                              item.fields?.["internalName"],
                              firstLocale,
                            ) ||
                            resolveStringField(
                              item.fields?.["title"],
                              firstLocale,
                            ) ||
                            item.sys.id;
                          const updatedAt = item.sys.updatedAt
                            ? new Date(item.sys.updatedAt)
                            : null;
                          const publishedAt = item.sys.publishedAt
                            ? new Date(item.sys.publishedAt)
                            : null;
                          const contentTypeId =
                            item.sys.contentType?.sys?.id ?? "unknown";
                          const isSelectable =
                            publishingEntries[item.sys.id] !== "done" &&
                            publishingEntries[item.sys.id] !== "loading";
                          const isChecked = selectedUnpublished.has(
                            item.sys.id,
                          );
                          return (
                            <div
                              key={item.sys.id}
                              className={`flex items-center gap-4 px-5 py-4 rounded-lg border transition-colors ${
                                isChecked
                                  ? status === "draft"
                                    ? "bg-blue-50 border-blue-200"
                                    : "bg-amber-100/60 border-amber-300"
                                  : status === "draft"
                                    ? "bg-gray-50 border-gray-200"
                                    : "bg-amber-50/50 border-amber-200/60"
                              }`}
                            >
                              {/* Checkbox */}
                              <input
                                type="checkbox"
                                disabled={!isSelectable}
                                checked={isChecked}
                                onChange={(e) => {
                                  setSelectedUnpublished((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(item.sys.id);
                                    else next.delete(item.sys.id);
                                    return next;
                                  });
                                }}
                                className="w-4 h-4 rounded border-gray-300 accent-blue-500 cursor-pointer shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                              />

                              {/* Status badge */}
                              <span
                                className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  status === "draft"
                                    ? "bg-gray-200 text-gray-500"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {status === "draft" ? "Draft" : "Modified"}
                              </span>

                              {/* Entry info */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate">
                                  {name}
                                </p>
                                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                  <span className="text-[10px] font-mono text-gray-400">
                                    {item.sys.id}
                                  </span>
                                  <span
                                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                      scope === "opco"
                                        ? "bg-violet-100 text-violet-600"
                                        : "bg-emerald-100 text-emerald-600"
                                    }`}
                                  >
                                    {scope} · {groupLabel}
                                  </span>
                                  <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                    {contentTypeId}
                                  </span>
                                </div>
                              </div>

                              {/* Timestamps */}
                              <div className="shrink-0 text-right space-y-2">
                                {updatedAt && (
                                  <div>
                                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                                      Modified
                                    </p>
                                    <p className="text-sm font-semibold text-gray-700">
                                      {updatedAt.toLocaleDateString("en-GB", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      })}
                                    </p>
                                  </div>
                                )}
                                {publishedAt ? (
                                  <div>
                                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                                      Last published
                                    </p>
                                    <p className="text-sm font-semibold text-gray-500">
                                      {publishedAt.toLocaleDateString("en-GB", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      })}
                                    </p>
                                  </div>
                                ) : (
                                  <div>
                                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                                      Published
                                    </p>
                                    <p className="text-sm italic text-gray-300">
                                      Never
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="shrink-0 flex items-center gap-2">
                                {/* Changes diff button — only for modified entries */}
                                {status === "changed" && (
                                  <button
                                    onClick={() => handleViewEntryDiff(item)}
                                    className="px-2.5 py-1 rounded-md border border-amber-300 bg-amber-50 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                                  >
                                    Changes
                                  </button>
                                )}
                                {/* Publish button */}
                                {(() => {
                                  const ps = publishingEntries[item.sys.id];
                                  if (ps === "done") {
                                    return (
                                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-600">
                                        <svg
                                          className="w-3 h-3 shrink-0"
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
                                        Published
                                      </span>
                                    );
                                  }
                                  if (ps === "error") {
                                    return (
                                      <button
                                        onClick={() =>
                                          editMode &&
                                          handlePublishEntry(item.sys.id)
                                        }
                                        disabled={!editMode}
                                        title={
                                          editMode
                                            ? undefined
                                            : "Enable Edit mode to publish"
                                        }
                                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                                          editMode
                                            ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100 cursor-pointer"
                                            : "bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed"
                                        }`}
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
                                            d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"
                                          />
                                        </svg>
                                        Retry
                                      </button>
                                    );
                                  }
                                  if (ps === "loading") {
                                    return (
                                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-blue-200 bg-blue-50 text-xs font-medium text-blue-500">
                                        <svg
                                          className="w-3 h-3 shrink-0 animate-spin"
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
                                        Publishing…
                                      </span>
                                    );
                                  }
                                  return (
                                    <button
                                      onClick={() =>
                                        editMode &&
                                        handlePublishEntry(item.sys.id)
                                      }
                                      disabled={!editMode}
                                      title={
                                        editMode
                                          ? undefined
                                          : "Enable Edit mode to publish"
                                      }
                                      className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                                        editMode
                                          ? "border-blue-300 bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer"
                                          : "border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed"
                                      }`}
                                    >
                                      Publish
                                    </button>
                                  );
                                })()}
                                <a
                                  href={`https://app.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries/${item.sys.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
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
                                  Contentful
                                </a>
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                );
              })()
            )}
          </>
        )}
      </div>

      {/* ── Diff modal ──────────────────────────────────────────────────── */}
      {diffOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setDiffOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-[96vw] max-h-[90vh] flex flex-col mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 shrink-0">
              <svg
                className="w-5 h-5 text-blue-500 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Translation Diff
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {diffRows.length === 0
                    ? "No changes detected — all imported values match current translations."
                    : `${diffRows.length} field${diffRows.length !== 1 ? "s" : ""} with changes across ${
                        new Set(diffRows.map((r) => r.entryId)).size
                      } entr${new Set(diffRows.map((r) => r.entryId)).size !== 1 ? "ies" : "y"}`}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-300 shrink-0" />
                    Added
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300 shrink-0" />
                    Changed
                  </span>
                </div>
                {diffRows.length > 0 &&
                  (() => {
                    const totalKeys = diffRows.reduce(
                      (s, r) => s + Object.keys(r.changes).length,
                      0,
                    );
                    const allSelected = acceptedKeys.size === totalKeys;
                    return (
                      <button
                        onClick={() => {
                          if (allSelected) {
                            setAcceptedKeys(new Set());
                          } else {
                            setAcceptedKeys(
                              new Set(
                                diffRows.flatMap((row) =>
                                  Object.keys(row.changes).map(
                                    (lc) => `${row.entryId}-${row.field}-${lc}`,
                                  ),
                                ),
                              ),
                            );
                          }
                        }}
                        className="px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors border-gray-300 text-gray-600 hover:bg-gray-50"
                      >
                        {allSelected ? "Unselect all" : "Select all"}
                      </button>
                    );
                  })()}
                <button
                  disabled={acceptedKeys.size === 0}
                  onClick={handleApplyChanges}
                  title={
                    acceptedKeys.size === 0
                      ? "Select at least one change to apply"
                      : "Apply selected changes to Contentful"
                  }
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors ${
                    acceptedKeys.size === 0
                      ? "bg-blue-500/10 border-blue-300 text-blue-600 opacity-40 cursor-not-allowed"
                      : "bg-blue-500 border-blue-600 text-white hover:bg-blue-600 cursor-pointer"
                  }`}
                >
                  Apply {acceptedKeys.size} change
                  {acceptedKeys.size !== 1 ? "s" : ""}
                </button>
                <button
                  onClick={() => setDiffOpen(false)}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  title="Close"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-2">
              {diffRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-gray-400">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                    <svg
                      className="w-7 h-7 text-emerald-400"
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
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-600">
                      All translations are up to date
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      No differences found between the snapshot and current
                      values
                    </p>
                  </div>
                </div>
              ) : (
                (() => {
                  // group rows by entryId
                  const byEntry = diffRows.reduce<Record<string, DiffRow[]>>(
                    (acc, row) => {
                      (acc[row.entryId] ??= []).push(row);
                      return acc;
                    },
                    {},
                  );
                  return Object.entries(byEntry).map(([entryId, rows]) => {
                    const isOpen = expandedEntries.has(entryId);
                    const first = rows[0];
                    // keys belonging to this entry
                    const entryKeys = rows.flatMap((row) =>
                      Object.keys(row.changes).map(
                        (lc) => `${row.entryId}-${row.field}-${lc}`,
                      ),
                    );
                    const checkedCount = entryKeys.filter((k) =>
                      acceptedKeys.has(k),
                    ).length;
                    const entryAllChecked = checkedCount === entryKeys.length;
                    const entryIndeterminate =
                      checkedCount > 0 && !entryAllChecked;
                    const totalChanges = entryKeys.length;
                    return (
                      <div
                        key={entryId}
                        className="border border-gray-200 rounded-lg overflow-hidden"
                      >
                        {/* Accordion header */}
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 px-4 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                          onClick={() =>
                            setExpandedEntries((prev) => {
                              const next = new Set(prev);
                              if (next.has(entryId)) next.delete(entryId);
                              else next.add(entryId);
                              return next;
                            })
                          }
                        >
                          {/* per-entry checkbox */}
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-gray-300 accent-blue-500 cursor-pointer shrink-0"
                            checked={entryAllChecked}
                            ref={(el) => {
                              if (el) el.indeterminate = entryIndeterminate;
                            }}
                            onChange={(e) => {
                              e.stopPropagation();
                              setAcceptedKeys((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked)
                                  entryKeys.forEach((k) => next.add(k));
                                else entryKeys.forEach((k) => next.delete(k));
                                return next;
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          {/* chevron */}
                          <svg
                            className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${
                              isOpen ? "rotate-90" : ""
                            }`}
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
                          {/* entry info */}
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-sm text-gray-800 wrap-break-word">
                              {first.entryName}
                            </span>
                            <span className="ml-2 font-mono text-xs text-gray-400">
                              {entryId}
                            </span>
                          </div>
                          {/* badges */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                first.scope === "opco"
                                  ? "bg-violet-100 text-violet-600"
                                  : "bg-emerald-100 text-emerald-600"
                              }`}
                            >
                              {first.scope} · {first.group}
                            </span>
                            <span className="text-[10px] font-semibold bg-blue-50 border border-blue-200 text-blue-600 px-1.5 py-0.5 rounded">
                              {checkedCount}/{totalChanges} selected
                            </span>
                          </div>
                        </button>

                        {/* Accordion body */}
                        {isOpen && (
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-gray-200 bg-white">
                                <th className="px-4 py-2 w-10 shrink-0" />
                                <th className="text-left px-4 py-2 font-semibold text-gray-500 uppercase tracking-wide">
                                  Field
                                </th>
                                <th className="text-left px-4 py-2 font-semibold text-gray-500 uppercase tracking-wide w-5/12">
                                  en-GB
                                </th>
                                <th className="text-left px-4 py-2 font-semibold text-gray-500 uppercase tracking-wide w-5/12">
                                  New translation
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row) =>
                                Object.entries(row.changes).map(
                                  ([lc, change], ci) => {
                                    const isFirstLocale = ci === 0;
                                    const rowSpan = Object.keys(
                                      row.changes,
                                    ).length;
                                    const ck = `${row.entryId}-${row.field}-${lc}`;
                                    const accepted = acceptedKeys.has(ck);
                                    const bg =
                                      change.kind === "added"
                                        ? "bg-emerald-50"
                                        : "bg-amber-50";
                                    return (
                                      <tr
                                        key={ck}
                                        className={`${
                                          accepted
                                            ? bg
                                            : "bg-gray-50 opacity-50"
                                        } hover:brightness-95 transition-all border-t border-gray-100`}
                                      >
                                        <td className="px-4 py-2 align-top w-10 border-r border-gray-200">
                                          <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-gray-300 accent-blue-500 cursor-pointer"
                                            checked={accepted}
                                            onChange={(e) => {
                                              setAcceptedKeys((prev) => {
                                                const next = new Set(prev);
                                                if (e.target.checked)
                                                  next.add(ck);
                                                else next.delete(ck);
                                                return next;
                                              });
                                            }}
                                          />
                                        </td>
                                        {isFirstLocale && (
                                          <td
                                            rowSpan={rowSpan}
                                            className="px-4 py-2 align-top font-mono text-gray-600 border-r border-gray-200 break-all"
                                          >
                                            {row.field}
                                          </td>
                                        )}
                                        <td className="px-4 py-2 align-top text-gray-500 border-r border-gray-200">
                                          {change.enGB ? (
                                            <span className="wrap-break-word">
                                              {change.enGB}
                                            </span>
                                          ) : (
                                            <span className="text-[10px] text-gray-300 italic">
                                              —
                                            </span>
                                          )}
                                        </td>
                                        <td
                                          className={`px-4 py-2 align-top font-medium ${
                                            change.kind === "added"
                                              ? "text-emerald-700"
                                              : "text-amber-700"
                                          }`}
                                        >
                                          <div className="flex items-center gap-1.5 mb-1">
                                            <span className="font-semibold text-blue-600 text-[10px] font-mono bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                                              {lc}
                                            </span>
                                            {change.kind === "added" && (
                                              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100 px-1 py-0.5 rounded">
                                                new
                                              </span>
                                            )}
                                            {change.kind === "changed" && (
                                              <span className="text-[10px] font-semibold text-amber-600 bg-amber-100 px-1 py-0.5 rounded">
                                                changed
                                              </span>
                                            )}
                                          </div>
                                          <span className="wrap-break-word">
                                            {change.new}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  },
                                ),
                              )}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  });
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Apply progress modal ─────────────────────────────────────────── */}
      {applyProgressOpen &&
        (() => {
          const total = applyEntries.length;
          const done = applyEntries.filter(
            (e) => e.status === "success" || e.status === "error",
          ).length;
          const errors = applyEntries.filter(
            (e) => e.status === "error",
          ).length;
          const allDone = done === total;
          const changeCount = applyEntries.reduce(
            (s, e) =>
              s +
              Object.values(e.fields).reduce(
                (fs, locs) => fs + Object.keys(locs).length,
                0,
              ),
            0,
          );
          return (
            <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-3xl max-h-[80vh] flex flex-col mx-4">
                {/* Header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 shrink-0">
                  {!allDone ? (
                    <svg
                      className="w-5 h-5 text-blue-500 animate-spin shrink-0"
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
                  ) : errors > 0 ? (
                    <svg
                      className="w-5 h-5 text-red-500 shrink-0"
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
                  ) : (
                    <svg
                      className="w-5 h-5 text-emerald-500 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-gray-900">
                      {allDone
                        ? errors > 0
                          ? `Completed with ${errors} error${errors !== 1 ? "s" : ""}`
                          : "All changes applied successfully"
                        : "Applying changes…"}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {changeCount} change{changeCount !== 1 ? "s" : ""} across{" "}
                      {total} entr{total !== 1 ? "ies" : "y"}
                      {!allDone && ` · ${done}/${total} done`}
                    </p>
                  </div>
                  {allDone && (
                    <button
                      onClick={() => {
                        setApplyProgressOpen(false);
                        setDiffOpen(false);
                      }}
                      className="ml-auto px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 transition-colors"
                    >
                      {errors === 0 ? "Done" : "Close"}
                    </button>
                  )}
                </div>

                {/* Progress bar */}
                <div className="h-1 bg-gray-100 shrink-0">
                  <div
                    className={`h-full transition-all duration-500 ${
                      errors > 0 ? "bg-red-400" : "bg-blue-500"
                    }`}
                    style={{
                      width: `${total === 0 ? 0 : (done / total) * 100}%`,
                    }}
                  />
                </div>

                {/* Entry list */}
                <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
                  {applyEntries.map((entry) => {
                    const fieldCount = Object.keys(entry.fields).length;
                    const localeCount = Object.values(entry.fields).reduce(
                      (s, locs) => s + Object.keys(locs).length,
                      0,
                    );
                    return (
                      <div
                        key={entry.entryId}
                        className={`flex items-center gap-4 px-6 py-4 transition-colors ${
                          entry.status === "success"
                            ? "bg-emerald-50/50"
                            : entry.status === "error"
                              ? "bg-red-50/50"
                              : ""
                        }`}
                      >
                        {/* Status icon */}
                        <div className="shrink-0 w-6 flex justify-center">
                          {entry.status === "pending" && (
                            <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                          )}
                          {entry.status === "loading" && (
                            <svg
                              className="w-5 h-5 text-blue-500 animate-spin"
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
                          {entry.status === "success" && (
                            <svg
                              className="w-5 h-5 text-emerald-500"
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
                          )}
                          {entry.status === "error" && (
                            <svg
                              className="w-5 h-5 text-red-500"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          )}
                        </div>
                        {/* Entry info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {entry.entryName}
                          </p>
                          <p className="text-xs text-gray-400 font-mono truncate">
                            {entry.entryId}
                          </p>
                          {entry.error && (
                            <p className="text-xs text-red-500 mt-0.5 wrap-break-word">
                              {entry.error}
                            </p>
                          )}
                        </div>
                        {/* Counts */}
                        <div className="shrink-0 text-right">
                          <span className="text-xs text-gray-500">
                            {fieldCount} field{fieldCount !== 1 ? "s" : ""}
                          </span>
                          <span className="text-xs text-gray-400 ml-1">
                            · {localeCount} locale{localeCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {/* Status label */}
                        <span
                          className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            entry.status === "pending"
                              ? "bg-gray-100 text-gray-400"
                              : entry.status === "loading"
                                ? "bg-blue-100 text-blue-600"
                                : entry.status === "success"
                                  ? "bg-emerald-100 text-emerald-600"
                                  : "bg-red-100 text-red-600"
                          }`}
                        >
                          {entry.status === "pending" && "Queued"}
                          {entry.status === "loading" && "Updating…"}
                          {entry.status === "success" && "Done"}
                          {entry.status === "error" && "Failed"}
                        </span>
                        {(entry.status === "success" ||
                          entry.status === "error") && (
                          <a
                            href={`https://app.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries/${entry.entryId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded hover:bg-blue-100 transition-colors"
                          >
                            <svg
                              className="w-3 h-3"
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
                            Open
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

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
