import type { EntryDiffModalState } from "~/types/contentful";

interface Props {
  modal: EntryDiffModalState | null;
  onClose: () => void;
  spaceId: string;
  environmentId: string;
}

export function EntryDiffModal({
  modal,
  onClose,
  spaceId,
  environmentId,
}: Props) {
  if (!modal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[85vh] flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 shrink-0">
          <svg
            className="w-5 h-5 text-amber-500 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800">
              Changes in <span className="font-mono">{modal.entryName}</span>
            </p>
            <p className="text-[10px] font-mono text-gray-400 mt-0.5">
              {modal.entryId} &middot; published ↔ current draft
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {modal.loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
              <svg
                className="w-5 h-5 animate-spin"
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
              <span className="text-sm">Loading snapshot…</span>
            </div>
          ) : modal.error ? (
            <div className="flex items-center gap-2 py-16 justify-center text-red-500">
              <svg
                className="w-4 h-4 shrink-0"
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
              <span className="text-sm">{modal.error}</span>
            </div>
          ) : modal.rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
              <svg
                className="w-8 h-8"
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
              <p className="text-sm font-medium">No field changes detected</p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">
                    Field
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">
                    Locale
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-1/2">
                    Published
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-1/2">
                    Current draft
                  </th>
                </tr>
              </thead>
              <tbody>
                {modal.rows.map((row, i) => (
                  <tr
                    key={`${row.fieldId}-${row.locale}`}
                    className={i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}
                  >
                    <td className="py-3 px-3 align-top font-mono text-[11px] text-gray-500 border-b border-gray-100">
                      {row.fieldId}
                    </td>
                    <td className="py-3 px-3 align-top text-[11px] font-semibold text-blue-600 border-b border-gray-100">
                      {row.locale}
                    </td>
                    <td className="py-3 px-3 align-top text-xs border-b border-gray-100 wrap-break-word max-w-0">
                      {row.published ? (
                        <span className="inline-block bg-red-50 text-red-700 px-1.5 py-0.5 rounded whitespace-pre-wrap">
                          {row.published}
                        </span>
                      ) : (
                        <span className="italic text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 align-top text-xs border-b border-gray-100 wrap-break-word max-w-0">
                      {row.draft ? (
                        <span className="inline-block bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded whitespace-pre-wrap">
                          {row.draft}
                        </span>
                      ) : (
                        <span className="italic text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
