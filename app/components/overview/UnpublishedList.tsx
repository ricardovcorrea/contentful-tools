import type { UnpublishedItem } from "~/types/contentful";
import { resolveStringField } from "~/lib/resolve-string-field";

interface Props {
  items: UnpublishedItem[];
  firstLocale: string;
  publishingEntries: Record<string, "loading" | "done" | "error">;
  selectedUnpublished: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
  onPublish: (entryId: string) => void;
  onPublishSelected: (ids: string[]) => void;
  onViewDiff: (item: UnpublishedItem["item"]) => void;
  spaceId: string;
  environmentId: string;
}

export function UnpublishedList({
  items,
  firstLocale,
  publishingEntries,
  selectedUnpublished,
  onSelectionChange,
  onPublish,
  onPublishSelected,
  onViewDiff,
  spaceId,
  environmentId,
}: Props) {
  if (items.length === 0) {
    return (
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
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-sm font-medium">All entries are published</p>
        <p className="text-xs">
          No draft or modified entries found in this view
        </p>
      </div>
    );
  }

  const selectableIds = items
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
    !allSelected && selectableIds.some((id) => selectedUnpublished.has(id));

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
              onSelectionChange(
                e.target.checked ? new Set(selectableIds) : new Set(),
              );
            }}
            className="w-4 h-4 rounded border-gray-300 accent-blue-500 cursor-pointer"
          />
          Select all
        </label>
        {selectedUnpublished.size > 0 && (
          <button
            onClick={() => onPublishSelected(Array.from(selectedUnpublished))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-semibold hover:bg-blue-600 transition-colors shadow-sm"
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
        {items.map(({ item, scope, groupLabel, status }) => {
          const name =
            resolveStringField(item.fields?.["internalName"], firstLocale) ||
            resolveStringField(item.fields?.["title"], firstLocale) ||
            item.sys.id;
          const updatedAt = item.sys.updatedAt
            ? new Date(item.sys.updatedAt)
            : null;
          const publishedAt = item.sys.publishedAt
            ? new Date(item.sys.publishedAt)
            : null;
          const contentTypeId = item.sys.contentType?.sys?.id ?? "unknown";
          const isSelectable =
            publishingEntries[item.sys.id] !== "done" &&
            publishingEntries[item.sys.id] !== "loading";
          const isChecked = selectedUnpublished.has(item.sys.id);

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
                  const next = new Set(selectedUnpublished);
                  if (e.target.checked) next.add(item.sys.id);
                  else next.delete(item.sys.id);
                  onSelectionChange(next);
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
                    <p className="text-sm italic text-gray-300">Never</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="shrink-0 flex items-center gap-2">
                {status === "changed" && (
                  <button
                    onClick={() => onViewDiff(item)}
                    className="px-2.5 py-1 rounded-md border border-amber-300 bg-amber-50 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                  >
                    Changes
                  </button>
                )}

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
                        onClick={() => onPublish(item.sys.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-50 border border-red-200 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
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
                      onClick={() => onPublish(item.sys.id)}
                      className="px-2.5 py-1 rounded-md border border-blue-300 bg-blue-50 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors"
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
        })}
      </div>
    </div>
  );
}
