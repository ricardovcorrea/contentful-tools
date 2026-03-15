import type { DiffRow } from "~/types/contentful";

interface Props {
  open: boolean;
  diffRows: DiffRow[];
  acceptedKeys: Set<string>;
  onAcceptedKeysChange: (next: Set<string>) => void;
  expandedEntries: Set<string>;
  onExpandedEntriesChange: (next: Set<string>) => void;
  onClose: () => void;
  onApply: () => void;
  localeCodes: string[];
  firstLocale: string;
  spaceId: string;
  environmentId: string;
}

export function ImportDiffModal({
  open,
  diffRows,
  acceptedKeys,
  onAcceptedKeysChange,
  expandedEntries,
  onExpandedEntriesChange,
  onClose,
  onApply,
}: Props) {
  if (!open) return null;

  const totalKeys = diffRows.reduce(
    (s, r) => s + Object.keys(r.changes).length,
    0,
  );
  const allSelected = acceptedKeys.size === totalKeys;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-5xl lg:max-w-7xl xl:max-w-[1400px] 2xl:max-w-[1600px] max-h-[90vh] flex flex-col mx-4"
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
                : `${diffRows.length} field${diffRows.length !== 1 ? "s" : ""} with changes across ${new Set(diffRows.map((r) => r.entryId)).size} entr${new Set(diffRows.map((r) => r.entryId)).size !== 1 ? "ies" : "y"}`}
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
            {diffRows.length > 0 && (
              <button
                onClick={() => {
                  if (allSelected) {
                    onAcceptedKeysChange(new Set());
                  } else {
                    onAcceptedKeysChange(
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
            )}
            <button
              disabled={acceptedKeys.size === 0}
              onClick={onApply}
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
              onClick={onClose}
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
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
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
              <p className="text-sm">All translations are up to date</p>
            </div>
          ) : (
            (() => {
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
                const entryKeys = rows.flatMap((row) =>
                  Object.keys(row.changes).map(
                    (lc) => `${row.entryId}-${row.field}-${lc}`,
                  ),
                );
                const checkedCount = entryKeys.filter((k) =>
                  acceptedKeys.has(k),
                ).length;
                const entryAllChecked = checkedCount === entryKeys.length;
                const entryIndeterminate = checkedCount > 0 && !entryAllChecked;
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
                      onClick={() => {
                        const next = new Set(expandedEntries);
                        if (next.has(entryId)) next.delete(entryId);
                        else next.add(entryId);
                        onExpandedEntriesChange(next);
                      }}
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 accent-blue-500 cursor-pointer shrink-0"
                        checked={entryAllChecked}
                        ref={(el) => {
                          if (el) el.indeterminate = entryIndeterminate;
                        }}
                        onChange={(e) => {
                          e.stopPropagation();
                          const next = new Set(acceptedKeys);
                          if (e.target.checked)
                            entryKeys.forEach((k) => next.add(k));
                          else entryKeys.forEach((k) => next.delete(k));
                          onAcceptedKeysChange(next);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <svg
                        className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
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
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-sm text-gray-800 wrap-break-word">
                          {first.entryName}
                        </span>
                        <span className="ml-2 font-mono text-xs text-gray-400">
                          {entryId}
                        </span>
                      </div>
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
                                const rowSpan = Object.keys(row.changes).length;
                                const ck = `${row.entryId}-${row.field}-${lc}`;
                                const accepted = acceptedKeys.has(ck);
                                const bg =
                                  change.kind === "added"
                                    ? "bg-emerald-50"
                                    : "bg-amber-50";

                                return (
                                  <tr
                                    key={ck}
                                    className={`${accepted ? bg : "bg-gray-50 opacity-50"} hover:brightness-95 transition-all border-t border-gray-100`}
                                  >
                                    <td className="px-4 py-2 align-top w-10 border-r border-gray-200">
                                      <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-gray-300 accent-blue-500 cursor-pointer"
                                        checked={accepted}
                                        onChange={(e) => {
                                          const next = new Set(acceptedKeys);
                                          if (e.target.checked) next.add(ck);
                                          else next.delete(ck);
                                          onAcceptedKeysChange(next);
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
  );
}
