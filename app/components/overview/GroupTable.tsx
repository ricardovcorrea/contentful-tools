import { useState, useEffect, useCallback } from "react";
import { getContentType } from "~/lib/contentful/get-content-type";
import { getContentfulManagementEnvironment } from "~/lib/contentful";
import { CellValue } from "~/components/overview/CellValue";
import type { EntryGroup } from "~/types/contentful";

// ── Hook ──────────────────────────────────────────────────────────────────

/** Fetches content type and returns sorted list of localizable field IDs */
export function useLocalizableFields(contentTypeId: string | undefined) {
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
        setFields(
          ct.fields.filter((f: any) => f.localized).map((f: any) => f.id),
        );
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

// ── GroupTable ─────────────────────────────────────────────────────────────

/**
 * Renders a single content-type group as an expandable table with one row
 * per entry × localizable field. Missing cells can be click-edited inline.
 */
export function GroupTable({
  group,
  localeCodes,
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

  const [localEdits, setLocalEdits] = useState<Record<string, string>>({});
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [saveCellError, setSaveCellError] = useState<Record<string, string>>(
    {},
  );

  const handleSaveInline = useCallback(
    async (entryId: string, fieldId: string, lc: string, value: string) => {
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
        cfEntry.fields[fieldId][lc] = value;
        await cfEntry.update();
        setLocalEdits((prev) => ({ ...prev, [ck]: value }));
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
    [],
  );

  const getName = (fields: Record<string, any>) =>
    fields["internalName"]?.[firstLocale] ??
    fields["title"]?.[firstLocale] ??
    null;

  const isMissingValue = (val: unknown) =>
    val === undefined ||
    val === null ||
    val === "" ||
    (Array.isArray(val) && val.length === 0);

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
            localeCodes.some((lc) => isFieldMissing(item.fields[fieldId], lc)),
          ),
        ).length
      : 0;

  useEffect(() => {
    if (!loading && localizableFields !== null) {
      onMissingResolved(groupKey, entriesWithMissing);
      onFieldsResolved(groupKey, localizableFields);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, localizableFields]);

  if (!loading && localizableFields && localizableFields.length === 0)
    return null;

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
          className={`ml-auto w-4 h-4 text-gray-500 transition-transform duration-200 shrink-0 ${expanded ? "" : "-rotate-90"}`}
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
                        className="text-left px-4 py-2.5 text-xs font-semibold text-blue-600 uppercase tracking-wide min-w-48 border-l border-gray-300"
                      >
                        {lc}
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
                      localeCodes.some((lc) =>
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
                                  <p className="text-sm font-medium text-gray-800 leading-snug">
                                    {name}
                                  </p>
                                  <p className="text-[10px] font-mono text-gray-600 mt-0.5">
                                    {item.sys.id}
                                  </p>
                                  <a
                                    href={`https://app.contentful.com/spaces/${spaceId}/environments/${environmentId}/entries/${item.sys.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1.5 mt-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors"
                                  >
                                    <svg
                                      className="w-3.5 h-3.5 shrink-0"
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
                              isFieldMissing(item.fields[fieldId], lc);
                            const isEditing = editingCell === ck;
                            const isSaving = savingCell === ck;
                            const cellError = saveCellError[ck];

                            if (isEditing) {
                              return (
                                <td
                                  key={lc}
                                  className={`px-2 py-2 align-top border-l border-gray-300/60 max-w-72 ${topBorder} ${isLastField ? "pb-3" : ""} bg-blue-50`}
                                >
                                  <textarea
                                    autoFocus
                                    rows={3}
                                    value={editingValue}
                                    onChange={(e) =>
                                      setEditingValue(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Escape") {
                                        setEditingCell(null);
                                        setEditingValue("");
                                      }
                                      if (
                                        e.key === "Enter" &&
                                        (e.metaKey || e.ctrlKey)
                                      )
                                        handleSaveInline(
                                          item.sys.id,
                                          fieldId,
                                          lc,
                                          editingValue.trim(),
                                        );
                                    }}
                                    className="w-full text-xs border border-blue-300 rounded px-2 py-1.5 resize-y font-sans text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
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
                                        isSaving || !editingValue.trim()
                                      }
                                      onClick={() =>
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
                                className={`px-4 py-2 align-top border-l border-gray-300/60 max-w-72 ${topBorder} ${isLastField ? "pb-3" : ""} ${
                                  isLocallySaved
                                    ? "bg-emerald-50/60"
                                    : missing
                                      ? "bg-red-950/25 cursor-pointer hover:bg-blue-50 transition-colors group/cell"
                                      : ""
                                }`}
                                onClick={
                                  missing
                                    ? (e) => {
                                        e.stopPropagation();
                                        setEditingCell(ck);
                                        setEditingValue("");
                                      }
                                    : undefined
                                }
                                title={
                                  missing
                                    ? `Click to add translation for ${fieldId} / ${lc}`
                                    : undefined
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
                                  <span className="flex items-center justify-between gap-1">
                                    <span className="text-[10px] text-red-400 italic">
                                      Click to translate…
                                    </span>
                                    <svg
                                      className="w-3.5 h-3.5 shrink-0 text-red-400 group-hover/cell:text-blue-400 transition-colors"
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
                                  </span>
                                ) : (
                                  <CellValue
                                    value={effectiveVal}
                                    firstLocale={firstLocale}
                                    fieldId={fieldId}
                                  />
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
