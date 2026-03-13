import { useState, useEffect, useCallback } from "react";
import { Editor, Frame, useNode, useEditor } from "@craftjs/core";
import { getEntry } from "~/lib/contentful/get-entry";

// ── Types ─────────────────────────────────────────────────────────────────

type ResolvedEntry = {
  id: string;
  contentTypeId: string;
  displayName: string;
  fields: Record<string, any>;
  children: ResolvedEntry[];
  role: "page" | "section" | "container" | "component";
};

type EntryCardProps = {
  entryId: string;
  contentTypeId: string;
  displayName: string;
  fields: Record<string, any>;
  locale: string;
  children?: React.ReactNode;
};

// ── Helpers ───────────────────────────────────────────────────────────────

function getDisplayName(
  fields: Record<string, any>,
  locale: string,
  fallback: string,
): string {
  const pick = (f: string) =>
    fields[f]?.[locale] ??
    (fields[f] ? (Object.values(fields[f]) as any[])[0] : undefined);
  return (pick("internalName") ??
    pick("title") ??
    pick("name") ??
    pick("slug") ??
    fallback) as string;
}

/** Reads only the `sections` array field from a page entry */
function getSectionIds(fields: Record<string, any>, locale: string): string[] {
  const sectionsField = fields["sections"];
  if (!sectionsField) return [];
  const val =
    sectionsField[locale] ?? (Object.values(sectionsField) as any[])[0];
  if (!Array.isArray(val)) return [];
  return val
    .filter((v: any) => v?.sys?.linkType === "Entry")
    .map((v: any) => v.sys.id as string);
}

/** Reads all entry-link fields from a section entry (these are containers) */
function getContainerIds(
  fields: Record<string, any>,
  locale: string,
): string[] {
  const ids: string[] = [];
  for (const localeMap of Object.values(fields)) {
    const val =
      (localeMap as any)?.[locale] ??
      (Object.values((localeMap as any) ?? {}) as any[])[0];
    if (!val) continue;
    if (Array.isArray(val) && val[0]?.sys?.linkType === "Entry")
      ids.push(...val.map((v: any) => v.sys.id as string));
    if (!Array.isArray(val) && val?.sys?.linkType === "Entry")
      ids.push(val.sys.id as string);
  }
  return ids;
}

/** Reads only the `components` field from a container entry */
function getContainerComponentIds(
  fields: Record<string, any>,
  locale: string,
): string[] {
  const f = fields["components"];
  if (!f) return [];
  const val = f[locale] ?? (Object.values(f) as any[])[0];
  if (!Array.isArray(val)) return [];
  return val
    .filter((v: any) => v?.sys?.linkType === "Entry")
    .map((v: any) => v.sys.id as string);
}

function scalarFields(
  fields: Record<string, any>,
  locale: string,
  limit = 4,
): Array<[string, string]> {
  const results: Array<[string, string]> = [];
  for (const [fieldId, localeMap] of Object.entries(fields)) {
    const val =
      (localeMap as any)?.[locale] ??
      (Object.values((localeMap as any) ?? {}) as any[])[0];
    if (
      val !== null &&
      val !== undefined &&
      (typeof val === "string" ||
        typeof val === "number" ||
        typeof val === "boolean")
    ) {
      results.push([fieldId, String(val)]);
      if (results.length >= limit) break;
    }
  }
  return results;
}

// ── Shared drag handle icon ───────────────────────────────────────────────

function DragHandle() {
  return (
    <svg
      viewBox="0 0 10 16"
      className="w-2.5 h-4 text-current shrink-0"
      fill="currentColor"
    >
      <circle cx="2" cy="2" r="1.5" />
      <circle cx="8" cy="2" r="1.5" />
      <circle cx="2" cy="8" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="2" cy="14" r="1.5" />
      <circle cx="8" cy="14" r="1.5" />
    </svg>
  );
}

// ── Craft.js Components ────────────────────────────────────────────────────

/** Root canvas — represents the page itself */
function PageCanvas({ children }: { children?: React.ReactNode }) {
  const {
    connectors: { connect },
  } = useNode();
  return (
    <div
      ref={(r) => {
        if (r) connect(r);
      }}
      className="min-h-full p-6 bg-gray-100 flex flex-col gap-3"
    >
      {children}
    </div>
  );
}
PageCanvas.craft = { displayName: "Page", isCanvas: true };

/** A top-level page section */
function SectionCard({
  entryId,
  contentTypeId,
  displayName,
  fields,
  locale,
  children,
}: EntryCardProps) {
  const {
    connectors: { connect, drag },
    selected,
    hovered,
  } = useNode((n) => ({
    selected: n.events.selected,
    hovered: n.events.hovered,
  }));
  const [open, setOpen] = useState(true);
  const preview = scalarFields(fields, locale, 2);

  return (
    <div
      ref={(r) => {
        if (r) connect(r);
      }}
      className={`rounded-xl overflow-hidden transition-all duration-150 ${
        selected
          ? "ring-2 ring-indigo-500 shadow-lg shadow-indigo-100"
          : hovered
            ? "ring-1 ring-indigo-300 shadow-md"
            : "ring-1 ring-gray-200 shadow-sm"
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center gap-0 ${
          selected
            ? "bg-indigo-600"
            : hovered
              ? "bg-indigo-500"
              : "bg-indigo-500"
        }`}
      >
        {/* Drag handle */}
        <div
          ref={(r) => {
            if (r) drag(r);
          }}
          title="Drag to reorder"
          className="flex items-center justify-center w-8 self-stretch cursor-grab active:cursor-grabbing text-indigo-300 hover:text-white transition-colors shrink-0"
        >
          <DragHandle />
        </div>
        {/* Click area to expand */}
        <button
          onClick={() => setOpen((p) => !p)}
          className="flex items-center gap-2 flex-1 min-w-0 py-3 pr-4 text-left"
        >
          <span className="text-[10px] font-bold bg-white/20 text-white px-1.5 py-0.5 rounded shrink-0 tracking-wide">
            SECTION
          </span>
          <span className="text-[10px] font-medium bg-indigo-400/40 text-indigo-100 px-1.5 py-0.5 rounded shrink-0">
            {contentTypeId}
          </span>
          <span className="font-semibold text-white text-sm flex-1 truncate">
            {displayName}
          </span>
          {preview.map(([, v]) => (
            <span
              key={v}
              className="text-[10px] text-indigo-200 truncate max-w-28 hidden md:block"
            >
              {v}
            </span>
          ))}
          <svg
            className={`w-3.5 h-3.5 text-indigo-200 transition-transform duration-200 shrink-0 ${
              open ? "rotate-180" : ""
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
      </div>

      {/* Body */}
      {open && (
        <div className="p-3 bg-white flex flex-col gap-2 border-t border-indigo-100">
          {children}
        </div>
      )}
    </div>
  );
}
SectionCard.craft = { displayName: "Section", isCanvas: true };

/** A container inside a section — canvas that holds components */
function ContainerCard({
  entryId,
  contentTypeId,
  displayName,
  fields,
  locale,
  children,
}: EntryCardProps) {
  const {
    connectors: { connect, drag },
    selected,
    hovered,
  } = useNode((n) => ({
    selected: n.events.selected,
    hovered: n.events.hovered,
  }));
  const [open, setOpen] = useState(true);
  const preview = scalarFields(fields, locale, 2);

  return (
    <div
      ref={(r) => {
        if (r) connect(r);
      }}
      className={`rounded-lg overflow-hidden transition-all duration-150 ${
        selected
          ? "ring-2 ring-amber-500 shadow-md shadow-amber-100"
          : hovered
            ? "ring-1 ring-amber-300 shadow-sm"
            : "ring-1 ring-amber-200/80"
      }`}
    >
      <div
        className={`flex items-center gap-0 ${
          selected ? "bg-amber-500" : hovered ? "bg-amber-400" : "bg-amber-400"
        }`}
      >
        {/* Drag handle */}
        <div
          ref={(r) => {
            if (r) drag(r);
          }}
          title="Drag to reorder"
          className="flex items-center justify-center w-7 self-stretch cursor-grab active:cursor-grabbing text-amber-200 hover:text-white transition-colors shrink-0"
        >
          <DragHandle />
        </div>
        <button
          onClick={() => setOpen((p) => !p)}
          className="flex items-center gap-2 flex-1 min-w-0 py-2 pr-3 text-left"
        >
          <span className="text-[10px] font-bold bg-white/20 text-white px-1.5 py-0.5 rounded shrink-0 tracking-wide">
            CONTAINER
          </span>
          <span className="text-[10px] font-medium bg-amber-300/40 text-amber-100 px-1.5 py-0.5 rounded shrink-0">
            {contentTypeId}
          </span>
          <span className="font-medium text-white text-xs flex-1 truncate">
            {displayName}
          </span>
          {preview.map(([, v]) => (
            <span
              key={v}
              className="text-[10px] text-amber-100 truncate max-w-24 hidden md:block"
            >
              {v}
            </span>
          ))}
          <svg
            className={`w-3 h-3 text-amber-100 transition-transform duration-200 shrink-0 ${
              open ? "rotate-180" : ""
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
      </div>
      {open && (
        <div className="p-2 bg-amber-50/50 flex flex-col gap-1.5 border-t border-amber-100">
          {children}
        </div>
      )}
    </div>
  );
}
ContainerCard.craft = { displayName: "Container", isCanvas: true };

/** A leaf component inside a container */
function ComponentCard({
  entryId,
  contentTypeId,
  displayName,
  fields,
  locale,
}: EntryCardProps) {
  const {
    connectors: { connect, drag },
    selected,
    hovered,
  } = useNode((n) => ({
    selected: n.events.selected,
    hovered: n.events.hovered,
  }));
  const preview = scalarFields(fields, locale, 3);

  return (
    <div
      ref={(r) => {
        if (r) connect(r);
      }}
      className={`rounded-md overflow-hidden transition-all duration-150 ${
        selected
          ? "ring-2 ring-emerald-500 shadow-sm shadow-emerald-100"
          : hovered
            ? "ring-1 ring-emerald-300"
            : "ring-1 ring-gray-200"
      } bg-white`}
    >
      <div className="flex items-center gap-0">
        {/* Drag handle */}
        <div
          ref={(r) => {
            if (r) drag(r);
          }}
          title="Drag to reorder"
          className={`flex items-center justify-center w-6 self-stretch cursor-grab active:cursor-grabbing transition-colors shrink-0 ${
            selected
              ? "bg-emerald-500 text-white"
              : "bg-gray-100 text-gray-300 hover:text-gray-500"
          }`}
        >
          <DragHandle />
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0 px-3 py-2">
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
              selected
                ? "bg-emerald-100 text-emerald-700"
                : "bg-emerald-500/10 text-emerald-600"
            }`}
          >
            {contentTypeId}
          </span>
          <span className="font-medium text-gray-800 text-xs flex-1 truncate">
            {displayName}
          </span>
          <span className="text-[10px] font-mono text-gray-300 shrink-0">
            {entryId.slice(0, 8)}…
          </span>
        </div>
      </div>
      {preview.length > 0 && (
        <div className="border-t border-gray-100 px-3 py-1.5 ml-6 flex flex-col gap-0.5">
          {preview.map(([fieldId, val]) => (
            <div key={fieldId} className="flex gap-2 text-xs">
              <span className="font-mono text-gray-400 shrink-0 w-24 truncate">
                {fieldId}
              </span>
              <span className="text-gray-600 truncate flex-1">{val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
ComponentCard.craft = { displayName: "Component", isCanvas: false };

const RESOLVER = { PageCanvas, SectionCard, ContainerCard, ComponentCard };

// ── Properties panel ───────────────────────────────────────────────────────

function PropertiesPanel({ locale }: { locale: string }) {
  const { nodeProps } = useEditor((state) => {
    const id = [...state.events.selected][0];
    if (!id) return { nodeProps: null };
    return { nodeProps: state.nodes[id]?.data?.props ?? null };
  });

  if (!nodeProps) {
    return (
      <div className="p-4 text-xs text-gray-400 italic">
        Click a node on the canvas to inspect its properties.
      </div>
    );
  }

  const { entryId, contentTypeId, displayName, fields } = nodeProps as any;
  const allFields: Array<[string, string]> = [];

  for (const [fieldId, localeMap] of Object.entries(fields ?? {})) {
    const val =
      (localeMap as any)?.[locale] ??
      (Object.values((localeMap as any) ?? {}) as any[])[0];
    if (val === null || val === undefined) continue;
    if (typeof val === "object") {
      const isRich = "nodeType" in val;
      const isLink = val?.sys?.type === "Link";
      const isLinkArr =
        Array.isArray(val) && (val as any)[0]?.sys?.type === "Link";
      if (isRich) {
        allFields.push([fieldId, "(rich text)"]);
      } else if (isLink) {
        allFields.push([fieldId, `→ ${val.sys.id}`]);
      } else if (isLinkArr) {
        allFields.push([fieldId, `→ [${(val as any[]).length} refs]`]);
      }
    } else {
      allFields.push([fieldId, String(val)]);
    }
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Identity */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold bg-violet-500/15 text-violet-600 px-1.5 py-0.5 rounded">
            {contentTypeId}
          </span>
          <span className="font-semibold text-gray-800 text-sm">
            {displayName}
          </span>
        </div>
        <p className="font-mono text-[10px] text-gray-400 break-all">
          {entryId}
        </p>
      </div>

      {/* Fields */}
      {allFields.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
            Fields
          </span>
          {allFields.map(([fieldId, val]) => (
            <div key={fieldId} className="text-xs flex flex-col gap-0.5">
              <span className="font-mono text-gray-400">{fieldId}</span>
              <span className="text-gray-700 break-all">{val}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400">No fields.</p>
      )}
    </div>
  );
}

// ── Craft JSON builder ─────────────────────────────────────────────────────

function buildCraftJson(root: ResolvedEntry, locale: string): string {
  const nodes: Record<string, any> = {};
  let counter = 0;

  const ROLE_COMPONENT: Record<ResolvedEntry["role"], string> = {
    page: "PageCanvas",
    section: "SectionCard",
    container: "ContainerCard",
    component: "ComponentCard",
  };

  function buildNode(entry: ResolvedEntry, parent: string): string {
    const id = `n${++counter}`;
    const childIds = entry.children.map((c) => buildNode(c, id));
    const resolvedName = ROLE_COMPONENT[entry.role];
    const isLeaf = entry.role === "component";

    nodes[id] = {
      type: { resolvedName },
      isCanvas: !isLeaf,
      props: {
        entryId: entry.id,
        contentTypeId: entry.contentTypeId,
        displayName: entry.displayName,
        fields: entry.fields,
        locale,
      },
      displayName: resolvedName,
      custom: {},
      hidden: false,
      nodes: childIds,
      linkedNodes: {},
      parent,
    };
    return id;
  }

  const sectionIds = root.children.map((s) => buildNode(s, "ROOT"));

  nodes["ROOT"] = {
    type: { resolvedName: "PageCanvas" },
    isCanvas: true,
    props: {},
    displayName: "Page",
    custom: {},
    hidden: false,
    nodes: sectionIds,
    linkedNodes: {},
    parent: null,
  };

  return JSON.stringify(nodes);
}

// ── Data fetching ──────────────────────────────────────────────────────────

async function resolveTree(
  entryId: string,
  locale: string,
  visited: Set<string> = new Set(),
  depth = 0,
): Promise<ResolvedEntry | null> {
  if (visited.has(entryId)) return null;
  visited.add(entryId);
  try {
    const entry = await getEntry(entryId);
    const fields = (entry.fields ?? {}) as Record<string, any>;
    const ctId: string = entry.sys.contentType.sys.id;
    const displayName = getDisplayName(fields, locale, entryId);

    // depth 0 = page      → follow sections field
    // depth 1 = section   → follow all entry links (containers)
    // depth 2 = container → follow components field only
    // depth 3 = component → leaf, no children
    let childIds: string[] = [];
    let role: ResolvedEntry["role"];
    if (depth === 0) {
      role = "page";
      childIds = getSectionIds(fields, locale);
    } else if (depth === 1) {
      role = "section";
      childIds = getContainerIds(fields, locale);
    } else if (depth === 2) {
      role = "container";
      childIds = getContainerComponentIds(fields, locale);
    } else {
      role = "component";
      childIds = []; // leaf
    }

    const results = await Promise.all(
      childIds.map((id) => resolveTree(id, locale, visited, depth + 1)),
    );
    const children = results.filter(Boolean) as ResolvedEntry[];

    return {
      id: entryId,
      contentTypeId: ctId,
      displayName,
      fields,
      children,
      role,
    };
  } catch {
    return null;
  }
}

// ── Layers panel ───────────────────────────────────────────────────────────

function LayerItem({ nodeId, depth = 0 }: { nodeId: string; depth?: number }) {
  const { nodeData, actions } = useEditor((state) => ({
    nodeData: state.nodes[nodeId]?.data,
  }));
  const [open, setOpen] = useState(true);
  const children: string[] = nodeData?.nodes ?? [];
  const isRoot = nodeId === "ROOT";

  const label =
    nodeData?.props?.displayName ??
    nodeData?.props?.contentTypeId ??
    nodeData?.displayName ??
    nodeId;

  return (
    <div>
      <div
        className="flex items-center gap-1 py-0.5 pr-2 rounded cursor-pointer hover:bg-gray-100 transition-colors text-xs text-gray-700"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={() => {
          if (!isRoot) actions.selectNode(nodeId);
        }}
      >
        {children.length > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpen((p) => !p);
            }}
            className="shrink-0 w-4 h-4 flex items-center justify-center"
          >
            <svg
              className={`w-2.5 h-2.5 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <span
          className={`text-[10px] font-semibold px-1 py-0.5 rounded shrink-0 ${
            isRoot
              ? "bg-blue-500/15 text-blue-600"
              : nodeData?.displayName === "Container"
                ? "bg-amber-500/15 text-amber-600"
                : nodeData?.isCanvas
                  ? "bg-violet-500/15 text-violet-600"
                  : "bg-emerald-500/15 text-emerald-600"
          }`}
        >
          {isRoot
            ? "page"
            : (nodeData?.props?.contentTypeId ?? nodeData?.displayName ?? "—")}
        </span>
        <span className="truncate">{isRoot ? "Page" : label}</span>
      </div>
      {open &&
        children.map((childId) => (
          <LayerItem key={childId} nodeId={childId} depth={depth + 1} />
        ))}
    </div>
  );
}

function LayersPanel() {
  return (
    <div className="flex flex-col">
      <LayerItem nodeId="ROOT" />
    </div>
  );
}

// ── Toolbar ────────────────────────────────────────────────────────────────

function EditorToolbar() {
  const { enabled, actions } = useEditor((state) => ({
    enabled: state.options.enabled,
  }));

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-300 bg-white shrink-0">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex-1">
        Visual Editor
        <span className="ml-2 text-[10px] font-normal text-gray-400 normal-case">
          (scaffolding — editing coming soon)
        </span>
      </span>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <span className="text-xs text-gray-600">Enable editing</span>
        <div
          onClick={() =>
            actions.setOptions((o) => {
              o.enabled = !o.enabled;
            })
          }
          className={`relative w-9 h-5 rounded-full transition-colors ${
            enabled ? "bg-blue-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              enabled ? "translate-x-4" : ""
            }`}
          />
        </div>
      </label>
    </div>
  );
}

// ── Main export ─────────────────────────────────────────────────────────────

export function PageEditorTab({
  entryId,
  locale,
}: {
  entryId: string;
  locale: string;
}) {
  const [craftJson, setCraftJson] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"layers" | "properties">(
    "layers",
  );

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCraftJson(null);

    resolveTree(entryId, locale)
      .then((root) => {
        if (cancelled) return;
        if (!root) {
          setError("Failed to resolve page entry.");
          return;
        }
        setCraftJson(buildCraftJson(root, locale));
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message ?? "Unknown error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [entryId, locale]);

  useEffect(() => load(), [load]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-gray-50 rounded-xl border border-gray-300 p-12">
        <div
          className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent"
          style={{ animation: "spin 0.8s linear infinite" }}
        />
        <p className="text-sm text-gray-500">
          Resolving page sections and components…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-gray-50 rounded-xl border border-gray-300 p-12">
        <p className="text-sm text-red-500">{error}</p>
        <button
          onClick={load}
          className="text-xs px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!craftJson) return null;

  return (
    // key forces re-mount when entry/locale changes so Frame picks up new data
    <div
      key={`${entryId}:${locale}`}
      className="h-full flex flex-col overflow-hidden rounded-xl border border-gray-300 bg-white"
    >
      <Editor resolver={RESOLVER} enabled={false}>
        <EditorToolbar />

        <div className="flex flex-1 overflow-hidden">
          {/* Canvas */}
          <div className="flex-1 overflow-y-auto bg-gray-100">
            <Frame data={craftJson} />
          </div>

          {/* Right panel */}
          <div className="w-72 shrink-0 border-l border-gray-300 flex flex-col overflow-hidden">
            {/* Panel tabs */}
            <div className="flex border-b border-gray-200 bg-gray-50 shrink-0">
              {(["layers", "properties"] as const).map((panel) => (
                <button
                  key={panel}
                  onClick={() => setActivePanel(panel)}
                  className={`flex-1 py-2 text-xs font-semibold capitalize transition-colors ${
                    activePanel === panel
                      ? "text-blue-600 border-b-2 border-blue-500 bg-white"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {panel}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {activePanel === "layers" ? (
                <div className="py-2">
                  <LayersPanel />
                </div>
              ) : (
                <PropertiesPanel locale={locale} />
              )}
            </div>
          </div>
        </div>
      </Editor>
    </div>
  );
}
