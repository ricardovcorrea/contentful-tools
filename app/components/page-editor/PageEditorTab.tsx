import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  createContext,
  useContext,
} from "react";
import { Editor, Frame, useNode, useEditor } from "@craftjs/core";
import { getEntry } from "~/lib/contentful/get-entry";
import { getContentfulManagementEnvironment } from "~/lib/contentful";
import { useToast } from "~/lib/toast";
import { useEditMode as useGlobalEditMode } from "~/lib/edit-mode";

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

type OrderRecord = {
  parentEntryId: string;
  parentDisplayName: string;
  fieldName: string;
  locale: string;
  originalIds: string[];
};

type PendingChange = OrderRecord & { newIds: string[] };

// ── Edit mode context ─────────────────────────────────────────────────────
// Separates "selection is always on" from "dragging is on"
const EditModeContext = createContext(false);

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

/** Finds the field name on a section entry that contains entry links matching the given IDs */
function findEntryLinkArrayField(
  fields: Record<string, any>,
  locale: string,
  targetIds: string[],
): string | null {
  for (const [fieldName, localeMap] of Object.entries(fields)) {
    const val =
      (localeMap as any)?.[locale] ??
      (Object.values((localeMap as any) ?? {}) as any[])[0];
    if (
      Array.isArray(val) &&
      val.length > 0 &&
      val[0]?.sys?.linkType === "Entry" &&
      targetIds.some((id) => val.some((v: any) => v.sys?.id === id))
    )
      return fieldName;
  }
  return null;
}

/** Builds a map of parentEntryId → OrderRecord from the resolved tree.
 *  IMPORTANT: originalIds must be derived from the ResolvedEntry children
 *  arrays — not from the raw Contentful fields — because resolveTree filters
 *  out entries that failed to fetch (returning null). If we used the raw field
 *  arrays, any missing/deleted linked entry would cause a permanent length
 *  mismatch and the save button would always show a false "1 change". */
function buildOrderMap(
  root: ResolvedEntry,
  locale: string,
): Map<string, OrderRecord> {
  const map = new Map<string, OrderRecord>();

  // Page → sections
  if (root.children.length > 0) {
    map.set(root.id, {
      parentEntryId: root.id,
      parentDisplayName: root.displayName,
      fieldName: "sections",
      locale,
      originalIds: root.children.map((c) => c.id),
    });
  }

  for (const section of root.children) {
    const containerIds = section.children.map((c) => c.id);
    if (containerIds.length > 0) {
      const fieldName = findEntryLinkArrayField(
        section.fields,
        locale,
        containerIds,
      );
      if (fieldName) {
        map.set(section.id, {
          parentEntryId: section.id,
          parentDisplayName: section.displayName,
          fieldName,
          locale,
          originalIds: containerIds,
        });
      }
    }

    for (const container of section.children) {
      const compIds = container.children.map((c) => c.id);
      if (compIds.length > 0) {
        map.set(container.id, {
          parentEntryId: container.id,
          parentDisplayName: container.displayName,
          fieldName: "components",
          locale,
          originalIds: compIds,
        });
      }
    }
  }

  return map;
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

/** Try to find a usable image URL from any field in an entry */
function findImageUrl(
  fields: Record<string, any>,
  locale: string,
): string | null {
  function extractUrl(val: any): string | null {
    if (val === null || val === undefined) return null;
    // Resolved CDA asset: { sys: { type: "Asset" }, fields: { file: { url: "//..." } } }
    if (
      val?.sys?.type === "Asset" &&
      typeof val?.fields?.file?.url === "string"
    ) {
      const u = val.fields.file.url as string;
      return u.startsWith("//") ? `https:${u}` : u;
    }
    // Contentful file object directly: { url: "//images.ctfassets.net/..." }
    if (typeof val?.url === "string" && val.url.includes("ctfassets.net")) {
      const u = val.url as string;
      return u.startsWith("//") ? `https:${u}` : u;
    }
    // Nested: { file: { url: "//..." } }
    if (typeof val?.file?.url === "string") {
      const u = val.file.url as string;
      return u.startsWith("//") ? `https:${u}` : u;
    }
    // Direct URL string — image extension or ctfassets hostname
    if (typeof val === "string") {
      if (
        /\.(jpe?g|png|gif|webp|svg|avif)(\?.*)?$/i.test(val) ||
        val.includes("ctfassets.net")
      ) {
        return val.startsWith("//") ? `https:${val}` : val;
      }
    }
    // Array — take first resolvable element
    if (Array.isArray(val)) {
      for (const item of val) {
        const found = extractUrl(item);
        if (found) return found;
      }
    }
    return null;
  }

  for (const [, localeMap] of Object.entries(fields)) {
    const val =
      (localeMap as any)?.[locale] ??
      (Object.values((localeMap as any) ?? {}) as any[])[0];
    const found = extractUrl(val);
    if (found) return found;
    // Also search one level deeper into plain objects (e.g. image: { url, title })
    if (val && typeof val === "object" && !Array.isArray(val)) {
      for (const subVal of Object.values(val)) {
        const sub = extractUrl(subVal);
        if (sub) return sub;
      }
    }
  }
  return null;
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

// ── Drag grip icon ────────────────────────────────────────────────────────

function GripIcon() {
  return (
    <svg viewBox="0 0 10 16" className="w-2.5 h-4 shrink-0" fill="currentColor">
      <circle cx="2" cy="2" r="1.5" />
      <circle cx="8" cy="2" r="1.5" />
      <circle cx="2" cy="8" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="2" cy="14" r="1.5" />
      <circle cx="8" cy="14" r="1.5" />
    </svg>
  );
}

// ── Floating editor badge (shown on hover / select) ───────────────────────

function EditorBadge({
  label,
  visible,
  dragRef,
  color,
}: {
  label: string;
  visible: boolean;
  dragRef?: (el: HTMLElement | null) => void;
  color: string;
}) {
  const editMode = useContext(EditModeContext);
  return (
    <div
      className={`absolute top-0 left-0 z-30 flex items-stretch transition-opacity duration-100 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Only attach drag ref when actively in edit mode */}
      {dragRef && (
        <div
          ref={editMode ? (dragRef as any) : undefined}
          title={editMode ? "Drag to reorder" : undefined}
          className={`${color} flex items-center justify-center px-1.5 text-white ${
            editMode ? "cursor-grab active:cursor-grabbing" : "cursor-default"
          }`}
        >
          <GripIcon />
        </div>
      )}
      <div
        className={`${color} px-2 py-0.5 text-white text-[10px] font-semibold tracking-wide whitespace-nowrap`}
      >
        {label}
      </div>
    </div>
  );
}

// ── Visual component shape guesser ──────────────────────────────────────

function guessRole(
  contentTypeId: string,
):
  | "hero"
  | "split"
  | "steps"
  | "cards"
  | "card"
  | "banner"
  | "faq"
  | "terms"
  | "partner"
  | "text"
  | "image"
  | "button"
  | "generic" {
  const id = contentTypeId.toLowerCase();
  if (/hero/.test(id)) return "hero";
  if (/banner|promo|callout|highlight|notification|alert|info/.test(id))
    return "banner";
  if (/split|imagewith|withimage|sideby|twocol|half/.test(id)) return "split";
  if (/step|numbered|howit|how_it|howitwork|instruction|process/.test(id))
    return "steps";
  if (/faq|accordion|question|collapse|expand/.test(id)) return "faq";
  if (/term|legal|condition|tnc|t_and_c|tandcs/.test(id)) return "terms";
  if (/partner|voucher.*pick|pick.*voucher|retailer|merchant/.test(id))
    return "partner";
  // text/richtext before cards so "textBlock" doesn't match "block"
  if (/text|richtext|body|prose|paragraph|copy|editorial/.test(id))
    return "text";
  // plural / grid → cards; singular → card
  if (/cards|grid|tiles|features|teasers|reasons|benefits/.test(id))
    return "cards";
  if (/card|tile|feature|teaser|reason|benefit|item|block/.test(id))
    return "card";
  if (/image|photo|media|picture|gallery/.test(id)) return "image";
  if (/button|cta|action|link/.test(id)) return "button";
  return "generic";
}

/** Bg image with graceful error fallback */
function BgImage({ src, alt }: { src: string | null; alt: string }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      className="absolute inset-0 w-full h-full object-cover"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

/** Visual stand-in for a component — styled per its role */
function ComponentVisual({
  contentTypeId,
  displayName,
  fields,
  locale,
}: {
  contentTypeId: string;
  displayName: string;
  fields: Record<string, any>;
  locale: string;
}) {
  const role = guessRole(contentTypeId);
  const scalars = scalarFields(fields, locale, 4);
  const title = scalars[0]?.[1] ?? displayName;
  const imgUrl = findImageUrl(fields, locale);

  // ── Hero ──────────────────────────────────────────────────────────────────
  if (role === "hero") {
    return (
      <div className="w-full relative overflow-hidden bg-slate-800 min-h-40">
        <BgImage src={imgUrl} alt={displayName} />
        <div className="relative px-8 py-10 flex flex-col gap-3 bg-linear-to-r from-black/50 to-transparent">
          <p className="text-[9px] font-mono text-slate-300/70 uppercase tracking-widest">
            {contentTypeId}
          </p>
          <div className="h-7 w-3/5 bg-white/30 rounded" />
          <div className="h-4 w-2/5 bg-white/20 rounded" />
          <div className="h-3 w-1/2 bg-white/15 rounded" />
          <div className="flex gap-2 mt-2">
            <div className="h-8 w-28 bg-white/70 rounded" />
            <div className="h-8 w-24 border border-white/40 rounded" />
          </div>
        </div>
      </div>
    );
  }

  // ── Banner / promo strip ──────────────────────────────────────────────────
  if (role === "banner") {
    return (
      <div className="w-full bg-slate-700 relative overflow-hidden">
        <BgImage src={imgUrl} alt={displayName} />
        <div className="relative px-6 py-4 flex items-center gap-4 bg-slate-800/70">
          <div className="flex flex-col gap-1.5 flex-1">
            <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
              {contentTypeId}
            </p>
            <div className="h-4 w-3/5 bg-slate-400/60 rounded" />
            <div className="h-2.5 w-2/5 bg-slate-500/60 rounded" />
          </div>
          <div className="h-8 w-20 bg-white/20 border border-white/30 rounded shrink-0" />
        </div>
      </div>
    );
  }

  // ── Split: image + text side by side ─────────────────────────────────────
  if (role === "split") {
    return (
      <div className="w-full flex">
        {/* Image side */}
        <div
          className="w-1/2 relative bg-slate-200 overflow-hidden"
          style={{ minHeight: 120 }}
        >
          {imgUrl ? (
            <img
              src={imgUrl}
              alt={displayName}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-slate-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 15l-5-5L5 21"
                />
              </svg>
            </div>
          )}
        </div>
        {/* Text side */}
        <div className="w-1/2 px-5 py-5 flex flex-col gap-2 bg-white">
          <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
            {contentTypeId}
          </p>
          <div className="h-5 w-4/5 bg-slate-200 rounded" />
          <div className="flex flex-col gap-1 mt-1">
            <div className="h-2 bg-slate-100 rounded-full w-full" />
            <div className="h-2 bg-slate-100 rounded-full w-11/12" />
            <div className="h-2 bg-slate-100 rounded-full w-4/5" />
            <div className="h-2 bg-slate-100 rounded-full w-3/4" />
          </div>
          <div className="h-7 w-24 bg-slate-700 rounded mt-2" />
        </div>
      </div>
    );
  }

  // ── Numbered steps / how it works ─────────────────────────────────────────
  if (role === "steps") {
    return (
      <div className="w-full px-6 py-5 flex flex-col gap-4 bg-slate-50">
        <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
          {contentTypeId}
        </p>
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-700 text-white text-xs font-bold flex items-center justify-center shrink-0">
              {String(n).padStart(2, "0")}
            </div>
            <div className="flex flex-col gap-1 flex-1 pt-1">
              <div className="h-3.5 bg-slate-200 rounded w-2/3" />
              <div className="h-2 bg-slate-100 rounded w-full" />
              <div className="h-2 bg-slate-100 rounded w-5/6" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Feature / product card grid ────────────────────────────────────────────
  if (role === "cards") {
    return (
      <div className="w-full px-4 py-4 bg-white flex flex-col gap-2">
        <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
          {contentTypeId}
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-col rounded overflow-hidden border border-slate-100"
            >
              <div className="w-full h-16 bg-slate-200" />
              <div className="px-2 py-2 flex flex-col gap-1">
                <div className="h-2.5 bg-slate-200 rounded w-3/4" />
                <div className="h-2 bg-slate-100 rounded w-full" />
                <div className="h-2 bg-slate-100 rounded w-5/6" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Partner / voucher picker ──────────────────────────────────────────────
  if (role === "partner") {
    return (
      <div className="w-full px-4 py-4 bg-white flex flex-col gap-2">
        <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
          {contentTypeId}
        </p>
        <div className="flex gap-4">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="flex-1 flex flex-col rounded-lg overflow-hidden border border-slate-200 bg-slate-50"
            >
              {imgUrl && i === 0 ? (
                <img
                  src={imgUrl}
                  alt={title}
                  className="w-full h-20 object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display =
                      "none";
                  }}
                />
              ) : (
                <div className="w-full h-20 bg-slate-200" />
              )}
              <div className="px-3 py-2 flex flex-col gap-1.5">
                <div className="h-3 bg-slate-300 rounded w-1/2" />
                <div className="h-2 bg-slate-100 rounded w-full" />
                <div className="h-2 bg-slate-100 rounded w-4/5" />
                <div className="flex gap-1.5 mt-1">
                  <div className="h-6 w-14 bg-slate-700 rounded" />
                  <div className="h-6 w-16 border border-slate-300 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── FAQ accordion ─────────────────────────────────────────────────────────
  if (role === "faq") {
    return (
      <div className="w-full px-5 py-4 flex flex-col gap-0 divide-y divide-slate-100 bg-white">
        <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest pb-3">
          {contentTypeId}
        </p>
        {[0.7, 0.5, 0.6, 0.55].map((w, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <div
              className="h-2.5 bg-slate-200 rounded flex-1"
              style={{ width: `${w * 100}%` }}
            />
            <svg
              className="w-3.5 h-3.5 text-slate-300 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        ))}
      </div>
    );
  }

  // ── Terms / legal accordion ───────────────────────────────────────────────
  if (role === "terms") {
    return (
      <div className="w-full px-5 py-4 flex flex-col gap-0 divide-y divide-slate-100 bg-slate-50">
        <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest pb-3">
          {contentTypeId}
        </p>
        {[0.6, 0.5].map((w, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <div
              className="h-2.5 bg-slate-300 rounded"
              style={{ width: `${w * 100}%` }}
            />
            <svg
              className="w-3 h-3 text-slate-300 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        ))}
      </div>
    );
  }

  // ── Image ─────────────────────────────────────────────────────────────────
  if (role === "image") {
    if (imgUrl) {
      return (
        <div className="w-full bg-slate-100 overflow-hidden">
          <img
            src={imgUrl}
            alt={displayName}
            className="w-full h-auto max-h-52 object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      );
    }
    return (
      <div className="w-full bg-slate-200 flex flex-col items-center justify-center gap-2 py-10">
        <svg
          className="w-8 h-8 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1}
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 15l-5-5L5 21"
          />
        </svg>
        <p className="text-[9px] font-mono text-slate-400">{contentTypeId}</p>
      </div>
    );
  }

  // ── CTA button group ──────────────────────────────────────────────────────
  if (role === "button") {
    const scalars2 = scalarFields(fields, locale, 2);
    const label1 = scalars2[0]?.[1] ?? title;
    const label2 = scalars2[1]?.[1];
    return (
      <div className="flex flex-wrap items-center gap-2 py-3 px-3">
        <div className="h-8 px-5 bg-slate-800 rounded text-white text-xs font-medium flex items-center">
          {label1.slice(0, 24)}
        </div>
        {label2 && (
          <div className="h-8 px-5 border border-slate-300 rounded text-slate-500 text-xs flex items-center">
            {label2.slice(0, 24)}
          </div>
        )}
      </div>
    );
  }

  // ── Text / rich content ───────────────────────────────────────────────────
  if (role === "text") {
    return (
      <div className="flex flex-col gap-3 py-6 px-6 bg-white">
        <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
          {contentTypeId}
        </p>
        {/* Title */}
        <div className="h-6 w-3/5 bg-slate-800/20 rounded" />
        {/* Description paragraph */}
        <div className="flex flex-col gap-1.5 mt-1">
          <div className="h-2.5 bg-slate-200 rounded w-full" />
          <div className="h-2.5 bg-slate-200 rounded w-11/12" />
          <div className="h-2.5 bg-slate-200 rounded w-4/5" />
          <div className="h-2.5 bg-slate-100 rounded w-2/3" />
        </div>
      </div>
    );
  }

  // ── Single card ───────────────────────────────────────────────────────────
  if (role === "card") {
    return (
      <div className="flex flex-col bg-white rounded overflow-hidden border border-slate-100">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={displayName}
            className="w-full h-28 object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-28 bg-slate-200" />
        )}
        <div className="px-4 py-3 flex flex-col gap-2">
          <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
            {contentTypeId}
          </p>
          {/* Title */}
          <div className="h-4 w-2/3 bg-slate-700/25 rounded" />
          {/* Description */}
          <div className="flex flex-col gap-1">
            <div className="h-2 bg-slate-100 rounded w-full" />
            <div className="h-2 bg-slate-100 rounded w-5/6" />
            <div className="h-2 bg-slate-100 rounded w-3/4" />
          </div>
          {/* CTA */}
          <div className="h-7 w-20 bg-slate-700 rounded mt-1" />
        </div>
      </div>
    );
  }

  // ── Generic / card fallback ───────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-0 bg-white">
      {imgUrl ? (
        <img
          src={imgUrl}
          alt={displayName}
          className="w-full h-28 object-cover"
          onError={(e) => {
            const el = e.currentTarget as HTMLImageElement;
            el.style.display = "none";
            const ph = el.nextElementSibling as HTMLElement | null;
            if (ph) ph.style.display = "block";
          }}
        />
      ) : null}
      <div
        className="w-full h-28 bg-slate-200"
        style={{ display: imgUrl ? "none" : "block" }}
      />
      <div className="px-3 pb-3 pt-2 flex flex-col gap-1">
        <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
          {contentTypeId}
        </p>
        <div className="h-4 w-3/4 bg-slate-200 rounded" />
        <div className="h-2.5 w-1/2 bg-slate-100 rounded" />
      </div>
    </div>
  );
}

// ── Contentful link helper ────────────────────────────────────────────────

function contentfulEntryUrl(entryId: string): string {
  const space = localStorage.getItem("contentfulSpaceId") ?? "";
  const env = localStorage.getItem("contentfulEnvironment") ?? "master";
  return `https://app.contentful.com/spaces/${space}/environments/${env}/entries/${entryId}`;
}

function ContentfulLink({
  entryId,
  label,
}: {
  entryId: string;
  label?: string;
}) {
  return (
    <a
      href={contentfulEntryUrl(entryId)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`Open in Contentful: ${entryId}`}
      className="inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-blue-500 transition-colors shrink-0"
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
      {label ?? "Open"}
    </a>
  );
}

// ── Field display ─────────────────────────────────────────────────────────

function renderFieldValue(val: any): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number") return String(val);
  if (typeof val === "string")
    return val.length > 120 ? val.slice(0, 120) + "…" : val;
  if (typeof val === "object") {
    if ("nodeType" in val) return "(rich text)";
    if (val?.sys?.type === "Link" && val?.sys?.linkType === "Asset")
      return "(asset)";
    if (val?.sys?.type === "Link") return `→ ${val.sys.id}`;
    if (Array.isArray(val)) {
      if (val.length === 0) return "(empty)";
      if (val[0]?.sys?.type === "Link") return `→ [${val.length} refs]`;
      return `[${val.length} items]`;
    }
  }
  return null;
}

function FieldsDisplay({
  fields,
  locale,
}: {
  fields: Record<string, any>;
  locale: string;
}) {
  const rows: Array<{
    key: string;
    value: string;
    isRef: boolean;
    isRich: boolean;
  }> = [];

  for (const [fieldId, localeMap] of Object.entries(fields)) {
    const val =
      (localeMap as any)?.[locale] ??
      (Object.values((localeMap as any) ?? {}) as any[])[0];
    const rendered = renderFieldValue(val);
    if (!rendered) continue;

    const isRef =
      typeof val === "object" &&
      !Array.isArray(val) &&
      (val?.sys?.type === "Link" ||
        (Array.isArray(val) && val[0]?.sys?.type === "Link"));
    const isRich =
      typeof val === "object" && !Array.isArray(val) && "nodeType" in val;
    const isLinkArr =
      Array.isArray(val) && val.length > 0 && val[0]?.sys?.type === "Link";

    rows.push({
      key: fieldId,
      value: rendered,
      isRef: isRef || isLinkArr,
      isRich,
    });
  }

  if (rows.length === 0)
    return <p className="text-xs text-gray-400 italic">No fields</p>;

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 w-full">
      {rows.map(({ key, value, isRef, isRich }) => (
        <>
          <dt
            key={`dt-${key}`}
            className="font-mono text-[10px] text-gray-400 whitespace-nowrap self-start pt-px"
          >
            {key}
          </dt>
          <dd
            key={`dd-${key}`}
            className={`text-xs wrap-break-word ${
              isRef
                ? "text-gray-400 italic"
                : isRich
                  ? "text-gray-400 italic"
                  : "text-gray-700"
            }`}
          >
            {value}
          </dd>
        </>
      ))}
    </dl>
  );
}

// ── Craft.js Components ────────────────────────────────────────────────────

/** Root canvas — simulates the page viewport */
function PageCanvas({ children }: { children?: React.ReactNode }) {
  const {
    connectors: { connect },
  } = useNode();
  return (
    <div className="min-h-full bg-neutral-200 pt-8 pb-16">
      <div
        ref={(r) => {
          if (r) connect(r);
        }}
        className="bg-white mx-auto min-h-screen flex flex-col"
        style={{ maxWidth: 900 }}
      >
        {children}
      </div>
    </div>
  );
}
PageCanvas.craft = {
  displayName: "Page",
  isCanvas: true,
  rules: {
    canMoveIn: (incoming: any[]) =>
      incoming.every((n) => n.data?.displayName === "Section"),
  },
};

/** A full-bleed page section — looks like a real page band */
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

  const active = selected || hovered;

  return (
    <div
      ref={(r) => {
        if (r) connect(r);
      }}
      className="relative w-full"
      style={{
        outline: selected
          ? "2px solid #3b82f6"
          : hovered
            ? "2px solid #93c5fd"
            : "none",
        outlineOffset: "-2px",
      }}
    >
      <EditorBadge
        label={`Section · ${contentTypeId}`}
        visible={active}
        dragRef={(r) => {
          if (r) drag(r);
        }}
        color="bg-blue-500"
      />

      {/* Always-visible section boundary */}
      <div className="border-t border-dashed border-gray-200 relative">
        {/* Section label pill */}
        <div className="absolute -top-2.5 left-12 z-10 flex items-center gap-2">
          <span className="bg-white border border-gray-200 rounded px-2 py-0.5 text-[9px] font-mono text-gray-400 leading-none">
            {contentTypeId} · {displayName}
          </span>
          <ContentfulLink entryId={entryId} />
        </div>

        {/* Section body */}
        <div className="w-full py-14 px-12 flex flex-col gap-6">{children}</div>
      </div>
    </div>
  );
}
SectionCard.craft = {
  displayName: "Section",
  isCanvas: true,
  rules: {
    canMoveIn: (incoming: any[]) =>
      incoming.every((n) => n.data?.displayName === "Container"),
  },
};

/** A layout row — arranges child components side by side */
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

  const active = selected || hovered;

  return (
    <div
      ref={(r) => {
        if (r) connect(r);
      }}
      className="relative w-full rounded-sm"
      style={{
        outline: selected
          ? "2px solid #8b5cf6"
          : hovered
            ? "2px dashed #c4b5fd"
            : "none",
        outlineOffset: "-2px",
        background: selected
          ? "rgba(139,92,246,0.03)"
          : hovered
            ? "rgba(139,92,246,0.02)"
            : "rgba(0,0,0,0.015)",
      }}
    >
      <EditorBadge
        label={`Container · ${contentTypeId}`}
        visible={active}
        dragRef={(r) => {
          if (r) drag(r);
        }}
        color="bg-violet-500"
      />

      {/* Always-visible container label */}
      <div className="px-2 pt-2 pb-1 flex items-center gap-2">
        <span className="text-[9px] font-mono text-gray-300 uppercase tracking-widest">
          {contentTypeId} · {displayName}
        </span>
        <ContentfulLink entryId={entryId} />
      </div>

      {/* Column row — children share equal width, separated by a dashed divider */}
      <div className="flex flex-row w-full divide-x divide-dashed divide-gray-200 *:flex-1 *:min-w-0 *:px-4 *:pb-4">
        {children}
      </div>
    </div>
  );
}
ContainerCard.craft = {
  displayName: "Container",
  isCanvas: true,
  rules: {
    canMoveIn: (incoming: any[]) =>
      incoming.every((n) => n.data?.displayName === "Component"),
  },
};

/** A leaf component — visual shape + key field data */
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

  const active = selected || hovered;

  return (
    <div
      ref={(r) => {
        if (r) connect(r);
      }}
      className="relative rounded border border-gray-200 bg-white overflow-hidden"
      style={{
        outline: selected
          ? "2px solid #10b981"
          : hovered
            ? "2px dashed #6ee7b7"
            : "none",
        outlineOffset: "-2px",
      }}
    >
      <EditorBadge
        label={contentTypeId}
        visible={active}
        dragRef={(r) => {
          if (r) drag(r);
        }}
        color="bg-emerald-500"
      />

      {/* Visual placeholder only — fields are in the properties panel */}
      <ComponentVisual
        contentTypeId={contentTypeId}
        displayName={displayName}
        fields={fields}
        locale={locale}
      />

      {/* Minimal footer: type label + Contentful link */}
      <div className="flex items-center gap-2 px-2 py-1 bg-white border-t border-gray-100">
        <span className="text-[9px] font-mono text-gray-400 flex-1 truncate">
          {contentTypeId}
        </span>
        <ContentfulLink entryId={entryId} />
      </div>
    </div>
  );
}
ComponentCard.craft = { displayName: "Component", isCanvas: false };

const RESOLVER = { PageCanvas, SectionCard, ContainerCard, ComponentCard };

// ── Properties panel ───────────────────────────────────────────────────────

/** Renders a single field value cell in the properties panel */
function FieldValueCell({
  fieldId,
  val,
  activeLocale,
  selectedId,
  actions,
}: {
  fieldId: string;
  val: any;
  activeLocale: string;
  selectedId: string;
  actions: any;
}) {
  const rendered = renderFieldValue(val);

  if (val === null || val === undefined || rendered === null) {
    return <span className="text-xs text-gray-300 italic">—</span>;
  }

  const isRich =
    typeof val === "object" && !Array.isArray(val) && "nodeType" in val;

  // Single entry/asset link
  if (
    !Array.isArray(val) &&
    typeof val === "object" &&
    val?.sys?.type === "Link"
  ) {
    return (
      <ContentfulLink
        entryId={val.sys.id}
        label={`${val.sys.linkType ?? "Entry"} → ${val.sys.id.slice(0, 8)}…`}
      />
    );
  }

  // Array of entry/asset links
  if (Array.isArray(val) && val.length > 0 && val[0]?.sys?.type === "Link") {
    return (
      <div className="flex flex-col gap-1">
        {(val as any[]).map((ref: any) => (
          <ContentfulLink
            key={ref.sys.id}
            entryId={ref.sys.id}
            label={`${ref.sys.linkType ?? "Entry"} → ${ref.sys.id.slice(0, 8)}…`}
          />
        ))}
      </div>
    );
  }

  if (isRich) {
    return <span className="text-xs text-gray-400 italic">(rich text)</span>;
  }

  const isEditable =
    typeof val === "string" ||
    typeof val === "number" ||
    typeof val === "boolean";
  const isLong = typeof val === "string" && val.length > 60;

  function commit(newValue: string) {
    actions.setProp(selectedId, (p: any) => {
      if (!p.fields[fieldId]) p.fields[fieldId] = {};
      const localeMap = p.fields[fieldId];
      if (activeLocale in localeMap) {
        localeMap[activeLocale] = newValue;
      } else {
        const firstKey = Object.keys(localeMap)[0];
        if (firstKey) localeMap[firstKey] = newValue;
        else localeMap[activeLocale] = newValue;
      }
    });
  }

  if (isEditable && isLong) {
    return (
      <textarea
        key={`${selectedId}-${fieldId}-${activeLocale}`}
        defaultValue={String(val)}
        rows={3}
        onBlur={(e) => commit(e.currentTarget.value)}
        className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded px-2 py-1.5 w-full resize-y focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
      />
    );
  }

  if (isEditable) {
    return (
      <input
        key={`${selectedId}-${fieldId}-${activeLocale}`}
        type="text"
        defaultValue={String(val)}
        onBlur={(e) => commit(e.currentTarget.value)}
        className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded px-2 py-1 w-full focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
      />
    );
  }

  return (
    <span className="text-xs text-gray-400 italic wrap-break-word">
      {rendered}
    </span>
  );
}

type PropTab = "common" | "all" | string; // string = a locale code

function PropertiesPanel({ locale: defaultLocale }: { locale: string }) {
  const { selectedId, nodeProps, nodeRole, actions } = useEditor((state) => {
    const id = [...state.events.selected][0];
    if (!id || id === "ROOT")
      return { selectedId: null, nodeProps: null, nodeRole: null };
    return {
      selectedId: id,
      nodeProps: state.nodes[id]?.data?.props ?? null,
      nodeRole: state.nodes[id]?.data?.displayName ?? null,
    };
  });

  const { entryId, contentTypeId, displayName, fields } =
    (nodeProps as any) ?? {};

  // Derive all unique locale keys and split fields into translatable / common
  const { allLocales, translatableFields, commonFields } = useMemo(() => {
    const localeSet = new Set<string>();
    const trans: [string, any][] = [];
    const common: [string, any][] = [];
    for (const [fieldId, localeMap] of Object.entries(fields ?? {})) {
      const keys = Object.keys((localeMap as any) ?? {});
      keys.forEach((k) => localeSet.add(k));
      if (keys.length > 1) {
        trans.push([fieldId, localeMap]);
      } else {
        common.push([fieldId, localeMap]);
      }
    }
    const locales = localeSet.size > 0 ? [...localeSet] : [defaultLocale];
    return {
      allLocales: locales,
      translatableFields: trans,
      commonFields: common,
    };
  }, [fields, defaultLocale]);

  const hasTranslatable = translatableFields.length > 0;
  const [activeTab, setActiveTab] = useState<PropTab>("common");

  // Ensure the active tab is valid when the selected node changes
  const validTabs: PropTab[] = ["common", "all", ...allLocales];
  const resolvedTab = validTabs.includes(activeTab) ? activeTab : "common";

  if (!nodeProps || !selectedId) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8 text-center h-full">
        <svg
          className="w-8 h-8 text-gray-200"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 15l-6-6m0 0l6-6m-6 6h12"
          />
        </svg>
        <p className="text-xs text-gray-400">
          Click any element on the canvas to inspect it.
        </p>
      </div>
    );
  }

  const roleColor: Record<string, string> = {
    Section: "bg-blue-50 text-blue-600 border-blue-200",
    Container: "bg-violet-50 text-violet-600 border-violet-200",
    Component: "bg-emerald-50 text-emerald-600 border-emerald-200",
  };
  const badge =
    roleColor[nodeRole ?? ""] ?? "bg-gray-100 text-gray-500 border-gray-200";

  function tabCls(tab: PropTab) {
    return `px-3 py-2 text-xs font-semibold rounded-t-lg whitespace-nowrap transition-colors ${
      resolvedTab === tab
        ? "bg-gray-100 border border-b-gray-100 border-gray-300 text-blue-600 -mb-px"
        : "text-gray-500 hover:text-gray-700"
    }`;
  }

  function FieldRow({
    fieldId,
    localeMap,
    locale,
  }: {
    fieldId: string;
    localeMap: any;
    locale: string;
  }) {
    const val =
      localeMap?.[locale] ?? (Object.values(localeMap ?? {}) as any[])[0];
    return (
      <div className="flex flex-col gap-0.5 py-2 border-b border-gray-200 last:border-0">
        <label className="font-mono text-[10px] text-gray-400">{fieldId}</label>
        <FieldValueCell
          fieldId={fieldId}
          val={val}
          activeLocale={locale}
          selectedId={selectedId!}
          actions={actions}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 flex flex-col gap-2 border-b border-gray-200">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[9px] font-semibold border px-1.5 py-0.5 rounded uppercase tracking-widest ${badge}`}
          >
            {nodeRole}
          </span>
          <span
            className={`text-[10px] font-mono border px-1.5 py-0.5 rounded ${badge}`}
          >
            {contentTypeId}
          </span>
        </div>
        <p className="font-semibold text-gray-800 text-sm leading-tight">
          {displayName}
        </p>
        <div className="flex items-center gap-2">
          <p className="font-mono text-[9px] text-gray-400 truncate flex-1">
            {entryId}
          </p>
          <ContentfulLink entryId={entryId} />
        </div>
      </div>

      {/* Tab bar — only when there are translatable fields */}
      {hasTranslatable && (
        <div className="flex gap-0.5 border-b border-gray-300 px-2 pt-1 overflow-x-auto shrink-0 bg-gray-50">
          <button
            onClick={() => setActiveTab("common")}
            className={tabCls("common")}
          >
            Common Fields
          </button>
          <button onClick={() => setActiveTab("all")} className={tabCls("all")}>
            All locales
          </button>
          {allLocales.map((loc) => (
            <button
              key={loc}
              onClick={() => setActiveTab(loc)}
              className={tabCls(loc)}
            >
              {loc}
            </button>
          ))}
        </div>
      )}

      {/* Field content */}
      <div className="px-4 py-1 overflow-y-auto">
        {/* No translatable fields — flat list */}
        {!hasTranslatable && (
          <>
            {Object.entries(fields ?? {}).length === 0 && (
              <p className="text-xs text-gray-400 italic py-4">No fields</p>
            )}
            {Object.entries(fields ?? {}).map(([fieldId, localeMap]) => (
              <FieldRow
                key={fieldId}
                fieldId={fieldId}
                localeMap={localeMap}
                locale={allLocales[0] ?? defaultLocale}
              />
            ))}
          </>
        )}

        {/* Common Fields tab — non-translatable */}
        {hasTranslatable && resolvedTab === "common" && (
          <>
            {commonFields.length === 0 && (
              <p className="text-xs text-gray-400 italic py-4">
                No non-translatable fields
              </p>
            )}
            {commonFields.map(([fieldId, localeMap]) => (
              <FieldRow
                key={fieldId}
                fieldId={fieldId}
                localeMap={localeMap}
                locale={
                  Object.keys(localeMap ?? {})[0] ??
                  allLocales[0] ??
                  defaultLocale
                }
              />
            ))}
          </>
        )}

        {/* All locales tab — translatable fields × each locale stacked */}
        {hasTranslatable && resolvedTab === "all" && (
          <>
            {translatableFields.length === 0 && (
              <p className="text-xs text-gray-400 italic py-4">
                No translatable fields
              </p>
            )}
            {translatableFields.map(([fieldId, localeMap]) => (
              <div
                key={fieldId}
                className="py-2 border-b border-gray-200 last:border-0 flex flex-col gap-2"
              >
                <label className="font-mono text-[10px] text-gray-400">
                  {fieldId}
                </label>
                {allLocales.map((loc) => (
                  <div key={loc} className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-semibold text-gray-300 uppercase tracking-widest">
                      {loc}
                    </span>
                    <FieldValueCell
                      fieldId={fieldId}
                      val={(localeMap as any)?.[loc] ?? null}
                      activeLocale={loc}
                      selectedId={selectedId}
                      actions={actions}
                    />
                  </div>
                ))}
              </div>
            ))}
          </>
        )}

        {/* Per-locale tab — only translatable fields for that locale */}
        {hasTranslatable &&
          resolvedTab !== "common" &&
          resolvedTab !== "all" && (
            <>
              {translatableFields.length === 0 && (
                <p className="text-xs text-gray-400 italic py-4">
                  No translatable fields
                </p>
              )}
              {translatableFields.map(([fieldId, localeMap]) => (
                <FieldRow
                  key={fieldId}
                  fieldId={fieldId}
                  localeMap={localeMap}
                  locale={resolvedTab}
                />
              ))}
            </>
          )}
      </div>
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

// ── Save controller (inside Editor) ───────────────────────────────────────

function SaveController({
  pageEntryId,
  orderMap,
  onChanges,
}: {
  pageEntryId: string;
  orderMap: Map<string, OrderRecord>;
  onChanges: (changes: PendingChange[]) => void;
}) {
  const { nodes } = useEditor((state) => ({ nodes: state.nodes }));
  const onChangesRef = useRef(onChanges);
  useEffect(() => {
    onChangesRef.current = onChanges;
  });

  useEffect(() => {
    if (!nodes || orderMap.size === 0) return;

    // Map entryId → ordered child entryIds from current craft state
    const entryToChildIds = new Map<string, string[]>();

    // ROOT's children → section entryIds (page level)
    const rootChildNodeIds: string[] = nodes["ROOT"]?.data?.nodes ?? [];
    const pageChildIds = rootChildNodeIds
      .map((nId) => nodes[nId]?.data?.props?.entryId as string)
      .filter(Boolean);
    entryToChildIds.set(pageEntryId, pageChildIds);

    // All other non-leaf nodes
    for (const node of Object.values(nodes) as any[]) {
      const entryId = node.data?.props?.entryId as string;
      if (!entryId) continue;
      const childNodeIds: string[] = node.data?.nodes ?? [];
      if (childNodeIds.length === 0) continue;
      const childIds = childNodeIds
        .map((nId: string) => nodes[nId]?.data?.props?.entryId as string)
        .filter(Boolean);
      entryToChildIds.set(entryId, childIds);
    }

    const changes: PendingChange[] = [];
    for (const [parentId, record] of orderMap.entries()) {
      const currentIds = entryToChildIds.get(parentId);
      if (!currentIds) continue;
      const changed =
        currentIds.length !== record.originalIds.length ||
        currentIds.some((id, i) => id !== record.originalIds[i]);
      if (changed) {
        changes.push({ ...record, newIds: currentIds });
      }
    }

    onChangesRef.current(changes);
  }, [nodes, orderMap, pageEntryId]);

  return null;
}

// ── Save confirmation modal ────────────────────────────────────────────────

function SaveConfirmModal({
  changes,
  saving,
  saveError,
  onConfirm,
  onCancel,
}: {
  changes: PendingChange[];
  saving: boolean;
  saveError: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-800">
            Save changes as draft
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            The following entries will be updated in Contentful but{" "}
            <strong>not published</strong>.
          </p>
        </div>

        {/* Change list */}
        <div className="px-5 py-4 max-h-72 overflow-y-auto flex flex-col gap-4">
          {changes.map((c) => (
            <div key={c.parentEntryId} className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-gray-700">
                  {c.parentDisplayName}
                </span>
                <span className="text-[10px] font-mono text-gray-400">
                  {c.fieldName}
                </span>
              </div>
              <div className="text-xs text-gray-500 flex flex-col gap-1">
                <div className="flex gap-1.5 items-start">
                  <span className="shrink-0 text-gray-400 w-12 text-right">
                    before
                  </span>
                  <span className="text-gray-500 break-all">
                    {c.originalIds.join(" → ")}
                  </span>
                </div>
                <div className="flex gap-1.5 items-start">
                  <span className="shrink-0 text-gray-400 w-12 text-right">
                    after
                  </span>
                  <span className="text-gray-700 font-medium break-all">
                    {c.newIds.join(" → ")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Error */}
        {saveError && (
          <p className="px-5 pb-2 text-xs text-red-500">{saveError}</p>
        )}

        {/* Actions */}
        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="text-xs px-3 py-1.5 rounded bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving && (
              <span
                className="w-3 h-3 rounded-full border border-white border-t-transparent shrink-0"
                style={{ animation: "spin 0.7s linear infinite" }}
              />
            )}
            Save as draft
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Toolbar ────────────────────────────────────────────────────────────────

function EditorToolbar({
  pendingChanges,
  onSaveClick,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  fullscreen,
  onFullscreenToggle,
  onEditToggle,
  editingEnabled,
}: {
  pendingChanges: PendingChange[];
  onSaveClick: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  fullscreen: boolean;
  onFullscreenToggle: () => void;
  onEditToggle: () => void;
  editingEnabled: boolean;
}) {
  const editMode = useContext(EditModeContext);
  const hasChanges = pendingChanges.length > 0;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 bg-white shrink-0">
      {/* Left: title */}
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex-1 select-none">
        Visual Editor
      </span>

      {/* Zoom controls */}
      <div className="flex items-center gap-0.5 border border-gray-200 rounded overflow-hidden">
        <button
          onClick={onZoomOut}
          disabled={zoom <= 0.25}
          title="Zoom out"
          className="px-2 py-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
          </svg>
        </button>
        <button
          onClick={onZoomReset}
          title="Reset zoom"
          className="px-2 py-1 text-[10px] font-mono text-gray-600 hover:bg-gray-100 transition-colors min-w-9 text-center tabular-nums border-x border-gray-200"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={onZoomIn}
          disabled={zoom >= 2}
          title="Zoom in"
          className="px-2 py-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      </div>

      {/* Fullscreen */}
      <button
        onClick={onFullscreenToggle}
        title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
        className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
      >
        {fullscreen ? (
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 9L4 4m0 0v5m0-5h5M15 9l5-5m0 0v5m0-5h-5M9 15l-5 5m0 0v-5m0 5h5M15 15l5 5m0 0v-5m0 5h-5"
            />
          </svg>
        ) : (
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m4 0v-4m0 4l-5-5"
            />
          </svg>
        )}
      </button>

      {/* Divider */}
      <div className="w-px h-4 bg-gray-200 mx-1" />

      {/* Save */}
      {hasChanges && (
        <button
          onClick={onSaveClick}
          className="text-xs px-3 py-1.5 rounded bg-gray-800 text-white hover:bg-gray-700 font-medium flex items-center gap-1.5"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          Save {pendingChanges.length} change
          {pendingChanges.length > 1 ? "s" : ""}
        </button>
      )}

      {/* Edit toggle */}
      <label
        className={`flex items-center gap-1.5 select-none ${
          editingEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"
        }`}
        title={
          editingEnabled ? undefined : "Enable Edit mode to reorder sections"
        }
      >
        <span className="text-xs text-gray-500">
          {editMode ? "Editing" : "Viewing"}
        </span>
        <div
          onClick={() => editingEnabled && onEditToggle()}
          className={`relative w-9 h-5 rounded-full transition-colors ${editMode ? "bg-gray-700" : "bg-gray-300"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${editMode ? "translate-x-4" : ""}`}
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
  const [orderMap, setOrderMap] = useState<Map<string, OrderRecord>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"layers" | "properties">(
    "properties",
  );
  const [editMode, setEditMode] = useState(false);
  const { editMode: globalEditMode } = useGlobalEditMode();

  // Reset local drag-edit mode whenever the global edit mode is turned off
  useEffect(() => {
    if (!globalEditMode) setEditMode(false);
  }, [globalEditMode]);

  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const { addToast } = useToast();

  function adjustZoom(delta: number) {
    setZoom((z) =>
      Math.min(2, Math.max(0.25, Math.round((z + delta) * 4) / 4)),
    );
  }

  // Ctrl/Cmd + wheel to zoom on the canvas
  function handleWheel(e: React.WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    adjustZoom(e.deltaY < 0 ? 0.25 : -0.25);
  }

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCraftJson(null);
    setPendingChanges([]);

    resolveTree(entryId, locale)
      .then((root) => {
        if (cancelled) return;
        if (!root) {
          setError("Failed to resolve page entry.");
          return;
        }
        setOrderMap(buildOrderMap(root, locale));
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

  async function handleSaveConfirm() {
    setSaving(true);
    setSaveError(null);
    try {
      const environment = await getContentfulManagementEnvironment();
      for (const change of pendingChanges) {
        const cfEntry = await environment.getEntry(change.parentEntryId);
        // Reconstruct entry-link array in new order
        const newLinks = change.newIds.map((id) => ({
          sys: { type: "Link", linkType: "Entry", id },
        }));
        cfEntry.fields[change.fieldName] ??= {};
        cfEntry.fields[change.fieldName][change.locale] = newLinks;
        await cfEntry.update(); // draft only — no .publish()
      }
      setShowConfirm(false);
      setPendingChanges([]);
      // Rebuild orderMap so future diffs are against the saved state
      setOrderMap((prev) => {
        const next = new Map(prev);
        for (const change of pendingChanges) {
          const existing = next.get(change.parentEntryId);
          if (existing)
            next.set(change.parentEntryId, {
              ...existing,
              originalIds: change.newIds,
            });
        }
        return next;
      });
      addToast("Page order saved as draft.", "success");
    } catch (err: any) {
      const msg = err?.message ?? "Save failed";
      setSaveError(msg);
      addToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-gray-50 rounded-xl border border-gray-200 p-12">
        <div
          className="w-8 h-8 rounded-full border-2 border-gray-400 border-t-transparent"
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
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-gray-50 rounded-xl border border-gray-200 p-12">
        <p className="text-sm text-red-500">{error}</p>
        <button
          onClick={load}
          className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!craftJson) return null;

  return (
    <>
      {showConfirm && (
        <SaveConfirmModal
          changes={pendingChanges}
          saving={saving}
          saveError={saveError}
          onConfirm={handleSaveConfirm}
          onCancel={() => {
            setShowConfirm(false);
            setSaveError(null);
          }}
        />
      )}

      {/* key forces re-mount when entry/locale changes so Frame picks up new data */}
      <div
        key={`${entryId}:${locale}`}
        className={`flex flex-col overflow-hidden border border-gray-200 bg-white ${
          fullscreen ? "fixed inset-0 z-50 rounded-none" : "h-full rounded-xl"
        }`}
      >
        <EditModeContext.Provider value={editMode}>
          <Editor resolver={RESOLVER} enabled={true}>
            <SaveController
              pageEntryId={entryId}
              orderMap={orderMap}
              onChanges={setPendingChanges}
            />

            <EditorToolbar
              pendingChanges={pendingChanges}
              onSaveClick={() => {
                setSaveError(null);
                setShowConfirm(true);
              }}
              zoom={zoom}
              onZoomIn={() => adjustZoom(0.25)}
              onZoomOut={() => adjustZoom(-0.25)}
              onZoomReset={() => setZoom(1)}
              fullscreen={fullscreen}
              onFullscreenToggle={() => setFullscreen((f) => !f)}
              onEditToggle={() => setEditMode((m) => !m)}
              editingEnabled={globalEditMode}
            />

            <div className="flex flex-1 overflow-hidden">
              {/* Canvas — Ctrl+wheel to zoom */}
              <div
                className="flex-1 overflow-auto bg-neutral-200"
                onWheel={handleWheel}
              >
                <div style={{ zoom }}>
                  <Frame data={craftJson} />
                </div>
              </div>

              {/* Right panel */}
              <div className="w-96 shrink-0 border-l border-gray-200 flex flex-col overflow-hidden">
                {/* Panel tabs */}
                <div className="flex border-b border-gray-200 bg-gray-50 shrink-0">
                  {(["properties", "layers"] as const).map((panel) => (
                    <button
                      key={panel}
                      onClick={() => setActivePanel(panel)}
                      className={`flex-1 py-2 text-xs font-semibold capitalize transition-colors ${
                        activePanel === panel
                          ? "text-gray-800 border-b-2 border-gray-700 bg-white"
                          : "text-gray-400 hover:text-gray-600"
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
        </EditModeContext.Provider>
      </div>
    </>
  );
}
