import type { ApplyEntry } from "~/types/contentful";

interface Props {
  open: boolean;
  entries: ApplyEntry[];
  spaceId: string;
  environmentId: string;
  onClose: () => void;
  onDoneAndReload: () => void;
}

export function ApplyProgressModal({
  open,
  entries,
  spaceId,
  environmentId,
  onClose,
  onDoneAndReload,
}: Props) {
  if (!open) return null;

  const total = entries.length;
  const done = entries.filter(
    (e) => e.status === "success" || e.status === "error",
  ).length;
  const errors = entries.filter((e) => e.status === "error").length;
  const allDone = done === total;
  const changeCount = entries.reduce(
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
              {changeCount} change{changeCount !== 1 ? "s" : ""} across {total}{" "}
              entr{total !== 1 ? "ies" : "y"}
              {!allDone && ` · ${done}/${total} done`}
            </p>
          </div>
          {allDone && (
            <button
              onClick={onDoneAndReload}
              className="ml-auto px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-700 transition-colors"
            >
              {errors === 0 ? "Done & Reload" : "Close & Reload"}
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100 shrink-0">
          <div
            className={`h-full transition-all duration-500 ${errors > 0 ? "bg-red-400" : "bg-blue-500"}`}
            style={{ width: `${total === 0 ? 0 : (done / total) * 100}%` }}
          />
        </div>

        {/* Entry list */}
        <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
          {entries.map((entry) => {
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

                {(entry.status === "success" || entry.status === "error") && (
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
}
