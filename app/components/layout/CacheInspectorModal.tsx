import { useState, useEffect, useCallback, useMemo } from "react";
import React from "react";
import { queryClient } from "~/lib/query-client";
import { getCacheLastUpdated } from "~/lib/contentful/cache";
import { formatCacheTime } from "~/lib/format";
import type { Query } from "@tanstack/react-query";

// ─── helpers ────────────────────────────────────────────────────────────────

function timeAgo(ms: number): string {
  if (!ms) return "—";
  const secs = Math.floor((Date.now() - ms) / 1000);
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isoShort(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString();
}

/** Classify a raw queryKey into a human-readable group + label. */
function classify(key: readonly unknown[]): {
  group: Group;
  label: string;
  opco?: string;
  partner?: string;
  subLabel?: string;
} {
  const [root, a, b, c] = key as string[];

  switch (root) {
    case "entry":
      return {
        group: "Entries",
        label: c ? `Entry ${c.slice(0, 8)}…` : "Entries (all)",
        opco: a || undefined,
        partner: b || undefined,
        subLabel: c,
      };
    case "asset":
      return {
        group: "Assets",
        label: a ? `Asset ${a.slice(0, 8)}…` : "Assets (all)",
        subLabel: a,
      };
    case "content-type":
      return {
        group: "Content Types",
        label: a ? `CT ${a}` : "Content Types (all)",
        subLabel: a,
      };
    case "opco-pages":
      return { group: "Collections", label: "OPCO Pages", opco: a };
    case "opco-messages":
      return { group: "Collections", label: "OPCO Messages", opco: a };
    case "opco-refs":
      return { group: "Collections", label: "OPCO Refs", opco: a };
    case "opco-partners":
      return { group: "Collections", label: "Partners (for OPCO)", opco: a };
    case "partner-pages":
      return {
        group: "Collections",
        label: "Partner Pages",
        opco: a,
        partner: b,
      };
    case "partner-messages":
      return {
        group: "Collections",
        label: "Partner Messages",
        opco: a,
        partner: b,
      };
    case "partner-emails":
      return {
        group: "Collections",
        label: "Partner Emails",
        opco: a,
        partner: b,
      };
    case "partner-refs":
      return {
        group: "Collections",
        label: "Partner Refs",
        opco: a,
        partner: b,
      };
    case "opcos":
      return { group: "Collections", label: "OPCOs" };
    case "locales":
      return { group: "Collections", label: "Locales" };
    case "all-partners":
      return { group: "Collections", label: "All Partners" };
    case "all-content-types":
      return { group: "Collections", label: "All Content Types" };
    case "unpublished-opco-pages":
      return {
        group: "Unpublished",
        label: "OPCO Pages (unpublished)",
        opco: a,
      };
    case "unpublished-opco-messages":
      return {
        group: "Unpublished",
        label: "OPCO Messages (unpublished)",
        opco: a,
      };
    case "unpublished-partner-pages":
      return {
        group: "Unpublished",
        label: "Partner Pages (unpublished)",
        opco: a,
        partner: b,
      };
    case "unpublished-partner-messages":
      return {
        group: "Unpublished",
        label: "Partner Messages (unpublished)",
        opco: a,
        partner: b,
      };
    case "unpublished-partner-emails":
      return {
        group: "Unpublished",
        label: "Partner Emails (unpublished)",
        opco: a,
        partner: b,
      };
    case "scheduled-actions":
      return { group: "Scheduled", label: "Scheduled Actions" };
    case "env-entries-total":
      return { group: "System", label: "Env Entries Total" };
    case "env-ct-total":
      return { group: "System", label: "Env Content Types Total" };
    case "env-assets-total":
      return { group: "System", label: "Env Assets Total" };
    case "management-environment":
      return { group: "System", label: "Management Environment (SDK)" };
    case "space":
      return { group: "System", label: `Space ${a}` };
    case "spaces":
      return { group: "System", label: "Spaces" };
    case "env-obj":
      return { group: "System", label: `Env Object (${b})` };
    case "environments":
      return { group: "System", label: "Environments" };
    case "current-user":
      return { group: "System", label: "Current User" };
    default:
      return { group: "Other", label: key.join(" / ") };
  }
}

function dataCount(data: unknown): string | null {
  if (data === undefined || data === null) return null;
  if (Array.isArray(data)) return `${data.length} items`;
  if (typeof data === "object" && data !== null) {
    const d = data as any;
    if (typeof d.total === "number")
      return `${d.items?.length ?? "?"} / ${d.total}`;
    if (Array.isArray(d.items)) return `${d.items.length} items`;
  }
  return null;
}

// ─── types ─────────────────────────────────────────────────────────────────

type Group =
  | "All"
  | "Entries"
  | "Assets"
  | "Content Types"
  | "Collections"
  | "Unpublished"
  | "Scheduled"
  | "System"
  | "Other";

const ALL_GROUPS: Group[] = [
  "All",
  "Entries",
  "Assets",
  "Collections",
  "Unpublished",
  "Content Types",
  "Scheduled",
  "System",
  "Other",
];

interface CacheRow {
  key: string; // JSON stringified for uniqueness
  rawQuery: Query;
  group: Group;
  label: string;
  opco?: string;
  partner?: string;
  subLabel?: string;
  updatedAt: number;
  status: string;
  count: string | null;
  isStale: boolean;
}

// ─── tree helpers ─────────────────────────────────────────────────────────

interface TreeNode {
  segment: string;
  pathKey: string; // joined full path, used as stable id
  children: Map<string, TreeNode>;
  rows: CacheRow[];
}

function buildTree(rows: CacheRow[]): TreeNode {
  const root: TreeNode = {
    segment: "",
    pathKey: "",
    children: new Map(),
    rows: [],
  };
  for (const row of rows) {
    const segments = (row.rawQuery.queryKey as unknown[]).map(String);
    let node = root;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const pk = segments.slice(0, i + 1).join("\x00");
      if (!node.children.has(seg)) {
        node.children.set(seg, {
          segment: seg,
          pathKey: pk,
          children: new Map(),
          rows: [],
        });
      }
      node = node.children.get(seg)!;
    }
    node.rows.push(row);
  }
  return root;
}

/** Collect every pathKey in a subtree (for expand-all). */
function allPathKeys(node: TreeNode): string[] {
  const keys: string[] = [];
  if (node.pathKey) keys.push(node.pathKey);
  for (const child of node.children.values()) {
    keys.push(...allPathKeys(child));
  }
  return keys;
}

// ─── component ─────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CacheInspectorModal({ open, onClose }: Props) {
  const [rows, setRows] = useState<CacheRow[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group>("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"label" | "updated">("updated");
  const [refreshing, setRefreshing] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const buildRows = useCallback(() => {
    const queries = queryClient.getQueryCache().getAll();
    const next: CacheRow[] = queries.map((q) => {
      const info = classify(q.queryKey);
      return {
        key: JSON.stringify(q.queryKey),
        rawQuery: q,
        group: info.group,
        label: info.label,
        opco: info.opco,
        partner: info.partner,
        subLabel: info.subLabel,
        updatedAt: q.state.dataUpdatedAt,
        status: q.state.status,
        count: dataCount(q.state.data),
        isStale: q.isStale(),
      };
    });
    setRows(next);
  }, []);

  // Rebuild whenever the modal opens or tick changes (manual refresh).
  useEffect(() => {
    if (!open) return;
    buildRows();
    // Subscribe to cache changes while open.
    const unsub = queryClient.getQueryCache().subscribe(() => buildRows());
    return unsub;
  }, [open, tick, buildRows]);

  // Auto-expand everything when a search is active; collapse all when cleared.
  useEffect(() => {
    if (search.trim()) {
      const tree = buildTree(filtered);
      setExpandedPaths(new Set(allPathKeys(tree)));
    } else {
      setExpandedPaths(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, activeGroup]);

  // Collapse all when the modal closes.
  useEffect(() => {
    if (!open) setExpandedPaths(new Set());
  }, [open]);

  // Relative-time ticker
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, [open]);

  const groupCounts = useMemo(() => {
    const counts: Partial<Record<Group, number>> = { All: rows.length };
    for (const r of rows) {
      counts[r.group] = (counts[r.group] ?? 0) + 1;
    }
    return counts;
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (activeGroup !== "All")
      list = list.filter((r) => r.group === activeGroup);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          (r.opco?.toLowerCase().includes(q) ?? false) ||
          (r.partner?.toLowerCase().includes(q) ?? false) ||
          (r.subLabel?.toLowerCase().includes(q) ?? false) ||
          r.key.toLowerCase().includes(q),
      );
    }

    return [...list].sort((a, b) =>
      sortBy === "updated"
        ? (b.updatedAt || 0) - (a.updatedAt || 0)
        : a.label.localeCompare(b.label),
    );
  }, [rows, activeGroup, search, sortBy]);

  const handleRemove = useCallback(
    (row: CacheRow) => {
      setRemoving((s) => new Set(s).add(row.key));
      queryClient.removeQueries({ queryKey: row.rawQuery.queryKey });
      setTimeout(() => {
        setRemoving((s) => {
          const next = new Set(s);
          next.delete(row.key);
          return next;
        });
        buildRows();
      }, 300);
    },
    [buildRows],
  );

  const handleRefetch = useCallback(
    async (row: CacheRow) => {
      setRefreshing((s) => new Set(s).add(row.key));
      try {
        await queryClient.refetchQueries({ queryKey: row.rawQuery.queryKey });
      } finally {
        setRefreshing((s) => {
          const next = new Set(s);
          next.delete(row.key);
          return next;
        });
        buildRows();
      }
    },
    [buildRows],
  );

  const handleClearAll = useCallback(() => {
    queryClient.clear();
    // Full page reload so the app re-fetches all data from Contentful.
    window.location.reload();
  }, []);

  const handleClearFiltered = useCallback(() => {
    for (const row of filtered) {
      queryClient.removeQueries({ queryKey: row.rawQuery.queryKey });
    }
    buildRows();
  }, [filtered, buildRows]);

  const toggleExpand = useCallback((pathKey: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(pathKey)) next.delete(pathKey);
      else next.add(pathKey);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const tree = buildTree(filtered);
    setExpandedPaths(new Set(allPathKeys(tree)));
  }, [filtered]);

  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set());
  }, []);

  if (!open) return null;

  // ── tree renderer ──────────────────────────────────────────────────────────
  const renderTree = (node: TreeNode, depth: number): React.ReactNode => {
    const sortedChildren = [...node.children.entries()].sort(([a], [b]) =>
      sortBy === "label" ? a.localeCompare(b) : a.localeCompare(b),
    );
    const sortedRows = [...node.rows].sort((a, b) =>
      sortBy === "updated"
        ? (b.updatedAt || 0) - (a.updatedAt || 0)
        : a.label.localeCompare(b.label),
    );

    return (
      <>
        {sortedChildren.map(([, child]) => {
          const isExpanded = expandedPaths.has(child.pathKey);
          const hasChildren = child.children.size > 0 || child.rows.length > 0;
          const leafCount = countLeaves(child);
          return (
            <div key={child.pathKey}>
              {/* Branch row */}
              <div className="w-full flex items-center hover:bg-gray-50 transition-colors group">
                <button
                  onClick={() => toggleExpand(child.pathKey)}
                  className="flex-1 flex items-center gap-1.5 py-2 text-left"
                  style={{ paddingLeft: `${12 + depth * 16}px` }}
                >
                  <svg
                    className={`w-3 h-3 shrink-0 text-gray-400 transition-transform duration-150 ${
                      isExpanded ? "rotate-90" : ""
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
                  <span
                    className={`text-xs font-semibold truncate ${
                      depth === 0
                        ? "text-indigo-700"
                        : depth === 1
                          ? "text-violet-700"
                          : "text-gray-700"
                    }`}
                  >
                    {child.segment}
                  </span>
                  {hasChildren && (
                    <span className="ml-1 shrink-0 text-[9px] bg-gray-100 text-gray-400 rounded-full px-1.5 py-0.5 font-semibold">
                      {leafCount}
                    </span>
                  )}
                </button>
                {/* Per-branch actions */}
                <div className="flex items-center gap-0.5 pr-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      collectRows(child).forEach((r) => {
                        setRefreshing((s) => new Set(s).add(r.key));
                        queryClient
                          .refetchQueries({ queryKey: r.rawQuery.queryKey })
                          .finally(() => {
                            setRefreshing((s) => {
                              const n = new Set(s);
                              n.delete(r.key);
                              return n;
                            });
                            buildRows();
                          });
                      });
                    }}
                    title="Refetch all in branch"
                    className="w-5 h-5 rounded hover:bg-indigo-50 flex items-center justify-center text-gray-300 hover:text-indigo-500 transition-colors"
                  >
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
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      collectRows(child).forEach((r) =>
                        queryClient.removeQueries({
                          queryKey: r.rawQuery.queryKey,
                        }),
                      );
                      buildRows();
                    }}
                    title="Remove all in branch"
                    className="w-5 h-5 rounded hover:bg-red-50 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors"
                  >
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
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              {/* Children */}
              {isExpanded && <div>{renderTree(child, depth + 1)}</div>}
            </div>
          );
        })}
        {sortedRows.map((row) => {
          const isRefreshing = refreshing.has(row.key);
          const isRemoving = removing.has(row.key);
          return (
            <div
              key={row.key}
              className={`flex items-start gap-2.5 py-2 pr-3 hover:bg-gray-50/80 transition-colors border-b border-gray-50 last:border-0 ${
                isRemoving ? "opacity-30" : ""
              }`}
              style={{ paddingLeft: `${12 + depth * 16 + 14}px` }}
            >
              {/* status dot */}
              <span
                className={`mt-1.5 block w-2 h-2 rounded-full shrink-0 ${statusColor(row.status, row.isStale)}`}
                title={statusLabel(row.status, row.isStale)}
              />
              {/* info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-gray-800 truncate">
                    {row.label}
                  </span>
                  <span
                    className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                      row.status === "error"
                        ? "bg-red-100 text-red-500"
                        : row.status === "pending"
                          ? "bg-amber-100 text-amber-600"
                          : row.isStale
                            ? "bg-gray-100 text-gray-400"
                            : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    {statusLabel(row.status, row.isStale)}
                  </span>
                  {row.count && (
                    <span className="shrink-0 text-[9px] text-gray-400">
                      {row.count}
                    </span>
                  )}
                </div>
                <div
                  className="text-[10px] text-gray-400 mt-0.5"
                  title={isoShort(row.updatedAt)}
                >
                  {row.updatedAt
                    ? `Updated ${timeAgo(row.updatedAt)}`
                    : "Never fetched"}
                </div>
              </div>
              {/* actions */}
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => handleRefetch(row)}
                  disabled={isRefreshing}
                  title="Refetch"
                  className="w-6 h-6 rounded hover:bg-indigo-50 flex items-center justify-center text-gray-400 hover:text-indigo-500 transition-colors disabled:opacity-40"
                >
                  <svg
                    className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`}
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
                </button>
                <button
                  onClick={() => handleRemove(row)}
                  disabled={isRemoving}
                  title="Remove"
                  className="w-6 h-6 rounded hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                >
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </>
    );
  };

  const countLeaves = (node: TreeNode): number => {
    let count = node.rows.length;
    for (const child of node.children.values()) count += countLeaves(child);
    return count;
  };

  const collectRows = (node: TreeNode): CacheRow[] => {
    const result = [...node.rows];
    for (const child of node.children.values())
      result.push(...collectRows(child));
    return result;
  };

  const tree = buildTree(filtered);

  const statusColor = (status: string, isStale: boolean) => {
    if (status === "error") return "bg-red-500";
    if (status === "pending") return "bg-amber-400 animate-pulse";
    if (isStale) return "bg-gray-300";
    return "bg-emerald-500";
  };

  const statusLabel = (status: string, isStale: boolean) => {
    if (status === "error") return "error";
    if (status === "pending") return "loading";
    if (isStale) return "stale";
    return "fresh";
  };

  return (
    <div
      className="fixed inset-0 z-9998 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* panel */}
      <div className="relative z-10 w-full sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-400 bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 flex flex-col h-[90vh]">
        {/* header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200/60 flex items-center justify-center shrink-0">
            <svg
              className="w-4 h-4 text-indigo-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-gray-900 leading-none">
              Cache Inspector
            </h2>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {rows.length} cached queries · {filtered.length} visible
              {(() => {
                const t = getCacheLastUpdated();
                return t
                  ? ` · Updated ${formatCacheTime(t)}`
                  : " · Not yet loaded";
              })()}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleClearFiltered}
              disabled={filtered.length === 0}
              title="Remove all visible entries from cache"
              className="flex items-center gap-1.5 text-[10px] font-medium text-amber-600 hover:text-amber-700 px-2.5 py-1.5 rounded-lg border border-amber-200 hover:bg-amber-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Clear visible
            </button>
            <button
              onClick={handleClearAll}
              title="Clear the entire React Query cache"
              className="flex items-center gap-1.5 text-[10px] font-medium text-red-600 hover:text-red-700 px-2.5 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
            >
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              Clear all
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors ml-1"
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

        {/* toolbar */}
        <div
          className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 shrink-0 flex-wrap"
          onClick={(e) => e.stopPropagation()}
        >
          {/* search */}
          <div className="relative flex-1 min-w-40">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
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
              placeholder="Search keys, labels, opco, partner…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-gray-50"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
          {/* sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "label" | "updated")}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-gray-700 shrink-0"
          >
            <option value="updated">Sort: Newest first</option>
            <option value="label">Sort: A–Z</option>
          </select>
          {/* expand / collapse all */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={expandAll}
              title="Expand all"
              className="flex items-center gap-1 text-[10px] font-medium text-gray-500 hover:text-indigo-600 px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-indigo-50 transition-colors"
            >
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
                  d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
              Expand all
            </button>
            <button
              onClick={collapseAll}
              title="Collapse all"
              className="flex items-center gap-1 text-[10px] font-medium text-gray-500 hover:text-indigo-600 px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-indigo-50 transition-colors"
            >
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
                  d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                />
              </svg>
              Collapse
            </button>
          </div>
        </div>

        {/* group tabs */}
        <div className="px-5 py-2 border-b border-gray-100 flex items-center gap-1 overflow-x-auto shrink-0 scrollbar-thin">
          {ALL_GROUPS.map((g) => {
            const count = groupCounts[g] ?? 0;
            if (g !== "All" && count === 0) return null;
            return (
              <button
                key={g}
                onClick={() => setActiveGroup(g)}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors ${
                  activeGroup === g
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {g}
                <span
                  className={`text-[9px] rounded-full px-1 py-0 ${activeGroup === g ? "bg-white/20 text-white" : "bg-gray-200 text-gray-500"}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* tree */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-3">
                <svg
                  className="w-6 h-6 text-indigo-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
              </div>
              <p className="text-xs font-semibold text-gray-600">
                No entries match
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Try a different filter or keyword
              </p>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="mt-2 text-[10px] text-indigo-500 hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="py-1">{renderTree(tree, 0)}</div>
          )}
        </div>

        {/* footer */}
        <div className="px-5 py-2.5 border-t border-gray-100 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-gray-400">
            {filtered.length} of {rows.length} entries shown
          </span>
          <button
            onClick={() => buildRows()}
            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-indigo-500 transition-colors"
          >
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh view
          </button>
        </div>
      </div>
    </div>
  );
}
