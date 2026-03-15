import { useState, useEffect } from "react";
import { useParams, useRouteLoaderData } from "react-router";
import { useToast } from "~/lib/toast";
import { useEditMode } from "~/lib/edit-mode";
import { resolveStringField } from "~/lib/resolve-string-field";
import { getContentType } from "~/lib/contentful/get-content-type";
import { useEntry } from "~/lib/contentful/get-entry";
import { useAsset } from "~/lib/contentful/get-asset";
import { getContentfulManagementEnvironment } from "~/lib/contentful";
import { PageEditorTab } from "~/components/page-editor/PageEditorTab";
import { RichTextRenderer } from "~/components/RichTextRenderer";

/** Structural link fields that relate entries to their OPCO/partner hierarchy.
 *  These are never useful to show in the entry preview. */
const STRUCTURAL_FIELD_KEYS = new Set(["opco", "partner"]);

/**
 * Maps Contentful OPCO IDs to the programme codes required by the STG email
 * preview API. Add a new entry here whenever a new OPCO is onboarded.
 */
const OPCO_PROGRAMME_MAP: Record<string, string> = {
  ba: "baec",
  ib: "ibp",
  ei: "aerc",
};

// Shape of data returned by home.tsx's clientLoader
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
  currentUser: any;
  spaceId: string;
  spaceName: string;
  environmentId: string;
  environmentName: string;
};

type SelectedEntry = {
  id: string;
  label: string;
  type: string;
  contentTypeId: string;
  fields: Record<string, any>;
};

function findEntry(
  entryId: string,
  data: ParentLoaderData,
  firstLocale: string,
): SelectedEntry | null {
  const getName = (fields: Record<string, any>, locale: string) => {
    const name =
      resolveStringField(fields["internalName"], locale) ||
      resolveStringField(fields["title"], locale);
    return name || null;
  };

  for (const page of data.opcoPages.items) {
    if (page.sys.id === entryId)
      return {
        id: page.sys.id,
        label: getName(page.fields, firstLocale) ?? page.sys.id,
        type: "OPCO Page",
        contentTypeId: page.sys.contentType.sys.id,
        fields: page.fields,
      };
  }
  for (const msg of data.opcoMessages.items) {
    if (msg.sys.id === entryId)
      return {
        id: msg.sys.id,
        label: msg.fields["title"]?.[firstLocale] ?? msg.sys.id,
        type: "OPCO Message",
        contentTypeId: msg.sys.contentType.sys.id,
        fields: msg.fields,
      };
  }
  for (const page of data.partnerPages.items) {
    if (page.sys.id === entryId)
      return {
        id: page.sys.id,
        label: getName(page.fields, firstLocale) ?? page.sys.id,
        type: "Partner Page",
        contentTypeId: page.sys.contentType.sys.id,
        fields: page.fields,
      };
  }
  for (const msg of data.partnerMessages.items) {
    if (msg.sys.id === entryId)
      return {
        id: msg.sys.id,
        label: getName(msg.fields, firstLocale) ?? msg.sys.id,
        type: "Partner Message",
        contentTypeId: msg.sys.contentType.sys.id,
        fields: msg.fields,
      };
  }
  for (const email of data.partnerEmails.items) {
    if (email.sys.id === entryId)
      return {
        id: email.sys.id,
        label: getName(email.fields, firstLocale) ?? email.sys.id,
        type: "Partner Email",
        contentTypeId: email.sys.contentType.sys.id,
        fields: email.fields,
      };
  }
  for (const g of data.opcoRefGroups) {
    for (const item of g.items) {
      if (item.sys.id === entryId)
        return {
          id: item.sys.id,
          label: getName(item.fields, firstLocale) ?? item.sys.id,
          type: `OPCO Ref — ${g.label}`,
          contentTypeId: item.sys.contentType.sys.id,
          fields: item.fields,
        };
    }
  }
  for (const g of data.partnerRefGroups) {
    for (const item of g.items) {
      if (item.sys.id === entryId)
        return {
          id: item.sys.id,
          label: getName(item.fields, firstLocale) ?? item.sys.id,
          type: `Partner Ref — ${g.label}`,
          contentTypeId: item.sys.contentType.sys.id,
          fields: item.fields,
        };
    }
  }
  for (const opco of data.opcos.items) {
    if (opco.sys.id === entryId)
      return {
        id: opco.sys.id,
        label: getName(opco.fields, firstLocale) ?? opco.sys.id,
        type: "OPCO",
        contentTypeId: opco.sys.contentType?.sys?.id ?? "opco",
        fields: opco.fields,
      };
  }
  for (const partner of data.opcoPartners.items) {
    if (partner.sys.id === entryId)
      return {
        id: partner.sys.id,
        label: getName(partner.fields, firstLocale) ?? partner.sys.id,
        type: "Partner",
        contentTypeId: partner.sys.contentType?.sys?.id ?? "partner",
        fields: partner.fields,
      };
  }
  return null;
}

function isLink(
  v: unknown,
): v is { sys: { type: "Link"; linkType: "Entry"; id: string } } {
  return (
    typeof v === "object" &&
    v !== null &&
    "sys" in v &&
    (v as any).sys?.type === "Link" &&
    (v as any).sys?.linkType === "Entry" &&
    typeof (v as any).sys?.id === "string"
  );
}

function isLinkArray(
  v: unknown,
): v is Array<{ sys: { type: "Link"; linkType: "Entry"; id: string } }> {
  return Array.isArray(v) && v.length > 0 && v.every(isLink);
}

function isAssetLink(
  v: unknown,
): v is { sys: { type: "Link"; linkType: "Asset"; id: string } } {
  return (
    typeof v === "object" &&
    v !== null &&
    "sys" in v &&
    (v as any).sys?.type === "Link" &&
    (v as any).sys?.linkType === "Asset" &&
    typeof (v as any).sys?.id === "string"
  );
}

function isAssetLinkArray(
  v: unknown,
): v is Array<{ sys: { type: "Link"; linkType: "Asset"; id: string } }> {
  return Array.isArray(v) && v.length > 0 && v.every(isAssetLink);
}

function resolveAssetUrl(url: string | undefined): string | null {
  if (!url) return null;
  return url.startsWith("//") ? `https:${url}` : url;
}

/**
 * Compact image-only thumbnail shown above a ReferenceCard header when the
 * referenced entry wraps an image asset.
 */
function AssetThumbnail({
  assetId,
  locale,
}: {
  assetId: string;
  locale: string;
}) {
  const { data: asset } = useAsset(assetId);
  const _pd = useRouteLoaderData("routes/home") as any;
  const _spaceId: string = _pd?.spaceId ?? "";
  const _envId: string = _pd?.environmentId ?? "";

  const fields = asset?.fields ?? {};
  const fileObj =
    fields["file"]?.[locale] ??
    (Object.values(fields["file"] ?? {}) as any[])[0];
  const titleRaw =
    fields["title"]?.[locale] ??
    (Object.values(fields["title"] ?? {}) as string[])[0] ??
    "";
  const raw: string | undefined = fileObj?.url;
  const contentType: string = fileObj?.contentType ?? "";
  const url =
    raw && contentType.startsWith("image/")
      ? raw.startsWith("//")
        ? `https:${raw}`
        : raw
      : null;
  const alt = typeof titleRaw === "string" ? titleRaw : "";

  if (!url) return null;

  const _cfUrl =
    _spaceId && _envId
      ? `https://app.contentful.com/spaces/${_spaceId}/environments/${_envId}/assets/${assetId}`
      : null;

  return (
    <div className="bg-gray-200/40 flex items-center justify-center p-2 border-b border-gray-300 relative group">
      <img
        src={url}
        alt={alt}
        className="max-h-32 max-w-full rounded object-contain"
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
  );
}

function AssetCard({ assetId, locale }: { assetId: string; locale: string }) {
  const { data: asset, isLoading: loading } = useAsset(assetId);
  const _pd = useRouteLoaderData("routes/home") as any;
  const _spaceId: string = _pd?.spaceId ?? "";
  const _envId: string = _pd?.environmentId ?? "";

  const fields = asset?.fields ?? {};
  const title =
    fields["title"]?.[locale] ??
    (Object.values(fields["title"] ?? {}) as string[])[0] ??
    assetId;
  const fileObj =
    fields["file"]?.[locale] ??
    (Object.values(fields["file"] ?? {}) as any[])[0];
  const url = resolveAssetUrl(fileObj?.url);
  const contentType: string = fileObj?.contentType ?? "";
  const isImage = contentType.startsWith("image/");

  if (loading) {
    return (
      <div
        className="h-9 bg-gray-200 rounded-lg"
        style={{ animation: "skeleton-shimmer 1.4s ease-in-out infinite" }}
      />
    );
  }

  return (
    <div className="border border-gray-300/80 rounded-lg overflow-hidden text-sm">
      <div className="flex items-center w-full">
        <div className="flex items-center gap-2 px-3 py-2 flex-1 min-w-0">
          <span className="text-[10px] font-semibold bg-blue-500/15 text-blue-600 px-1.5 py-0.5 rounded shrink-0">
            asset
          </span>
          <span className="text-sm text-gray-800 font-medium truncate flex-1">
            {typeof title === "string" ? title : assetId}
          </span>
          <span className="text-[10px] font-mono text-gray-600 shrink-0">
            {assetId.slice(0, 8)}…
          </span>
        </div>
        {_spaceId && _envId && (
          <a
            href={`https://app.contentful.com/spaces/${_spaceId}/environments/${_envId}/assets/${assetId}`}
            target="_blank"
            rel="noreferrer"
            title="Open in Contentful"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 flex items-center justify-center w-8 h-full border-l border-gray-200 text-gray-400 hover:text-blue-600 hover:bg-gray-100 transition-colors"
          >
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
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        )}
      </div>
      {isImage && url && (
        <div className="border-t border-gray-300 p-2 bg-gray-200/30 flex items-center justify-center">
          <img
            src={url}
            alt={typeof title === "string" ? title : assetId}
            className="max-h-40 max-w-full rounded object-contain"
          />
        </div>
      )}
      {!isImage && url && (
        <div className="border-t border-gray-300 px-3 py-2 bg-gray-200/30 text-xs">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {fileObj?.fileName ?? url}
          </a>
        </div>
      )}
    </div>
  );
}

function AssetsField({
  links,
  locale,
}: {
  links: Array<{ sys: { id: string } }>;
  locale: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 py-0.5">
      {links.map((link) => (
        <AssetCard key={link.sys.id} assetId={link.sys.id} locale={locale} />
      ))}
    </div>
  );
}

/** Return the first asset-link ID found in any field of a management entry */
function findFirstAssetLinkId(
  fields: Record<string, any>,
  locale: string,
): string | null {
  for (const localeMap of Object.values(fields)) {
    const val =
      (localeMap as any)?.[locale] ??
      Object.values((localeMap as any) ?? {})[0];
    if (val?.sys?.linkType === "Asset" && val?.sys?.id) return val.sys.id;
    if (Array.isArray(val)) {
      for (const v of val) {
        if (v?.sys?.linkType === "Asset" && v?.sys?.id) return v.sys.id;
      }
    }
  }
  return null;
}

function ReferenceCard({ linkId, locale }: { linkId: string; locale: string }) {
  const { data: entry, isLoading: loading } = useEntry(linkId);
  const [expanded, setExpanded] = useState(false);
  const _pd = useRouteLoaderData("routes/home") as any;
  const _spaceId: string = _pd?.spaceId ?? "";
  const _envId: string = _pd?.environmentId ?? "";

  const contentTypeId = entry?.sys?.contentType?.sys?.id ?? "—";
  const fields = entry?.fields ?? {};
  const name =
    resolveStringField(fields["internalName"], locale) ||
    resolveStringField(fields["title"], locale) ||
    linkId;

  // If this entry wraps an image asset, surface a thumbnail in the header
  const thumbnailAssetId = entry ? findFirstAssetLinkId(fields, locale) : null;

  if (loading) {
    return (
      <div
        className="h-9 bg-gray-200 rounded-lg"
        style={{ animation: "skeleton-shimmer 1.4s ease-in-out infinite" }}
      />
    );
  }

  return (
    <div className="border border-gray-300/80 rounded-lg overflow-hidden text-sm">
      {thumbnailAssetId && (
        <AssetThumbnail assetId={thumbnailAssetId} locale={locale} />
      )}
      {/* Header row: expand toggle + Contentful link */}
      <div className="flex items-center w-full">
        <button
          onClick={() => setExpanded((p) => !p)}
          className="flex items-center gap-2 px-3 py-2 hover:bg-gray-200/60 transition-colors text-left flex-1 min-w-0"
        >
          <span className="text-[10px] font-semibold bg-violet-500/15 text-violet-400 px-1.5 py-0.5 rounded shrink-0">
            {contentTypeId}
          </span>
          <span className="text-sm text-gray-800 font-medium truncate flex-1">
            {name}
          </span>
          <span className="text-[10px] font-mono text-gray-600 shrink-0">
            {linkId.slice(0, 8)}…
          </span>
          <svg
            className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 shrink-0 ${
              expanded ? "rotate-180" : ""
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
        {_spaceId && _envId && (
          <a
            href={`https://app.contentful.com/spaces/${_spaceId}/environments/${_envId}/entries/${linkId}`}
            target="_blank"
            rel="noreferrer"
            title="Open in Contentful"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 flex items-center justify-center w-8 h-full border-l border-gray-200 text-gray-400 hover:text-blue-600 hover:bg-gray-100 transition-colors"
          >
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
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        )}
      </div>
      {expanded && (
        <div className="border-t border-gray-300 divide-y divide-gray-200 bg-gray-200/30">
          {Object.entries(fields)
            .filter(([key]) => !STRUCTURAL_FIELD_KEYS.has(key))
            .map(([key, localeVals]) => {
              const val =
                (localeVals as any)?.[locale] ??
                Object.values((localeVals as any) ?? {})[0];
              return (
                <div key={key} className="flex gap-3 px-3 py-1.5">
                  <span className="font-mono text-[11px] text-gray-500 w-36 shrink-0 truncate pt-0.5">
                    {key}
                  </span>
                  <span className="text-sm text-gray-700 break-all min-w-0">
                    <FieldValue value={val} locale={locale} />
                  </span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

function ReferencesField({
  links,
  locale,
}: {
  links: Array<{ sys: { id: string } }>;
  locale: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 py-0.5">
      {links.map((link) => (
        <ReferenceCard key={link.sys.id} linkId={link.sys.id} locale={locale} />
      ))}
    </div>
  );
}

function FieldValue({
  value,
  locale = "en",
}: {
  value: unknown;
  locale?: string;
}) {
  if (value === undefined || value === null)
    return <span className="italic text-gray-600">—</span>;
  if (isAssetLink(value))
    return <AssetsField links={[value]} locale={locale} />;
  if (isAssetLinkArray(value))
    return <AssetsField links={value} locale={locale} />;
  if (isLink(value)) return <ReferencesField links={[value]} locale={locale} />;
  if (isLinkArray(value))
    return <ReferencesField links={value} locale={locale} />;
  if (typeof value === "string") return <>{value}</>;
  if (isRichText(value)) return <RichTextRenderer doc={value} />;
  return (
    <span className="font-mono text-xs text-gray-500">
      {JSON.stringify(value)}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function isRichText(v: unknown): boolean {
  return typeof v === "object" && v !== null && "nodeType" in v;
}

/** True for values that can be edited as plain text (strings, numbers, booleans, empty cells) */
function isEditableValue(v: unknown): boolean {
  if (isLink(v) || isLinkArray(v)) return false;
  if (isAssetLink(v) || isAssetLinkArray(v)) return false;
  if (isRichText(v)) return false;
  if (Array.isArray(v)) return false;
  if (typeof v === "object" && v !== null) return false;
  return true;
}

type EditingCell = { fieldKey: string; locale: string } | null;

function EditableCell({
  fieldKey,
  locale,
  rawValue,
  entryId,
  editingCell,
  setEditingCell,
  draftValue,
  setDraftValue,
  localOverrides,
  onSaved,
}: {
  fieldKey: string;
  locale: string;
  rawValue: unknown;
  entryId: string;
  editingCell: EditingCell;
  setEditingCell: (c: EditingCell) => void;
  draftValue: string;
  setDraftValue: (v: string) => void;
  localOverrides: Record<string, Record<string, any>>;
  onSaved: (fieldKey: string, locale: string, value: any) => void;
}) {
  const { addToast } = useToast();
  const { editMode } = useEditMode();
  const isCellEditing =
    editingCell?.fieldKey === fieldKey && editingCell?.locale === locale;
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const effectiveValue =
    localOverrides[fieldKey]?.[locale] !== undefined
      ? localOverrides[fieldKey][locale]
      : rawValue;

  if (!isEditableValue(rawValue)) {
    return <FieldValue value={effectiveValue} locale={locale} />;
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const environment = await getContentfulManagementEnvironment();
      const cfEntry = await environment.getEntry(entryId);
      cfEntry.fields[fieldKey] ??= {};
      cfEntry.fields[fieldKey][locale] = draftValue;
      await cfEntry.update();
      onSaved(fieldKey, locale, draftValue);
      setEditingCell(null);
      addToast("Field saved successfully.", "success");
    } catch (err: any) {
      const msg = err?.message ?? "Save failed";
      setSaveError(msg);
      addToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  // Boolean fields: render an interactive checkbox that saves on click.
  if (typeof rawValue === "boolean" || typeof effectiveValue === "boolean") {
    const boolVal = effectiveValue === true;
    return (
      <button
        disabled={saving || !editMode}
        onClick={async () => {
          if (!editMode) return;
          setSaving(true);
          setSaveError(null);
          try {
            const environment = await getContentfulManagementEnvironment();
            const cfEntry = await environment.getEntry(entryId);
            cfEntry.fields[fieldKey] ??= {};
            const newVal = !boolVal;
            cfEntry.fields[fieldKey][locale] = newVal;
            await cfEntry.update();
            onSaved(fieldKey, locale, newVal);
            addToast("Field saved successfully.", "success");
          } catch (err: any) {
            const msg = err?.message ?? "Save failed";
            setSaveError(msg);
            addToast(msg, "error");
          } finally {
            setSaving(false);
          }
        }}
        className={`flex items-center gap-2 py-0.5 px-1 rounded transition-opacity ${saving ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-100 cursor-pointer"}`}
        title="Click to toggle"
      >
        <div
          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
            boolVal ? "bg-blue-500 border-blue-500" : "bg-white border-gray-300"
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
          className={`text-sm font-medium ${boolVal ? "text-blue-600" : "text-gray-400"}`}
        >
          {boolVal ? "true" : "false"}
        </span>
        {saving && (
          <svg
            className="w-3.5 h-3.5 animate-spin text-gray-400 shrink-0"
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
        {saveError && (
          <span className="text-[10px] text-red-500 font-medium">
            {saveError}
          </span>
        )}
      </button>
    );
  }

  if (isCellEditing) {
    return (
      <div className="flex flex-col gap-1.5">
        <textarea
          className="w-full min-h-9 text-sm px-2 py-1.5 border border-blue-400 rounded bg-white text-gray-800 resize-none overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-300"
          value={draftValue}
          autoFocus
          ref={(el) => {
            if (el) {
              el.style.height = "auto";
              el.style.height = el.scrollHeight + "px";
            }
          }}
          onChange={(e) => setDraftValue(e.target.value)}
          onInput={(e) => {
            const t = e.currentTarget;
            t.style.height = "auto";
            t.style.height = t.scrollHeight + "px";
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              save();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setEditingCell(null);
            }
          }}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={save}
            disabled={saving}
            className="text-xs px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving\u2026" : "Save"}
          </button>
          <button
            onClick={() => setEditingCell(null)}
            disabled={saving}
            className="text-xs px-2.5 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded font-medium transition-colors"
          >
            Cancel
          </button>
          <span className="text-[10px] text-gray-400">
            \u2318 Enter to save \u00b7 Esc to cancel
          </span>
          {saveError && (
            <span className="text-[10px] text-red-500 font-medium">
              {saveError}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      tabIndex={0}
      role="button"
      onClick={() => {
        if (!editMode) return;
        setEditingCell({ fieldKey, locale });
        setDraftValue(String(effectiveValue ?? ""));
      }}
      onKeyDown={(e) => {
        if (!editMode) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditingCell({ fieldKey, locale });
          setDraftValue(String(effectiveValue ?? ""));
        }
      }}
      className={`group -mx-1 -my-0.5 px-1 py-0.5 rounded transition-colors min-h-6 ${
        editMode
          ? "cursor-text hover:bg-blue-50 hover:ring-1 hover:ring-blue-200"
          : "cursor-default"
      }`}
    >
      {effectiveValue === null ||
      effectiveValue === undefined ||
      effectiveValue === "" ? (
        <span
          className={`italic text-sm ${
            editMode
              ? "text-gray-300 group-hover:text-blue-400"
              : "text-gray-300"
          }`}
        >
          {editMode ? "\u2014 click to edit \u2014" : "\u2014 empty \u2014"}
        </span>
      ) : (
        <span className="text-gray-700">{String(effectiveValue)}</span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function EntryDetail() {
  const { entryId } = useParams<{ entryId: string }>();

  const parentData = useRouteLoaderData("routes/home") as ParentLoaderData;

  const locales = parentData?.locales;
  const firstLocale = locales?.items[0]?.code ?? "en";
  const [activeTab, setActiveTab] = useState("all");
  const [viewTab, setViewTab] = useState<"fields" | "editor" | "preview">(
    "fields",
  );
  const [previewLocale, setPreviewLocale] = useState(firstLocale);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [previewHelpOpen, setPreviewHelpOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [draftValue, setDraftValue] = useState("");
  const [localOverrides, setLocalOverrides] = useState<
    Record<string, Record<string, any>>
  >({});

  const handleSaved = (fieldKey: string, locale: string, value: any) => {
    setLocalOverrides((prev) => ({
      ...prev,
      [fieldKey]: { ...(prev[fieldKey] ?? {}), [locale]: value },
    }));
  };

  // Reset tabs and editing state when navigating to a different entry
  useEffect(() => {
    setActiveTab("all");
    setViewTab("fields");
    setPreviewLocale(locales?.items[0]?.code ?? "en");
    setIframeLoaded(false);
    setEditingCell(null);
    setDraftValue("");
    setLocalOverrides({});
  }, [entryId]);

  const entry = entryId ? findEntry(entryId, parentData, firstLocale) : null;

  const [localizedMap, setLocalizedMap] = useState<Record<string, boolean>>({});
  const [contentTypeLoading, setContentTypeLoading] = useState(false);

  const hasLocalizedFields =
    contentTypeLoading || Object.values(localizedMap).some(Boolean);

  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    setLocalizedMap({});
    setContentTypeLoading(true);
    getContentType(entry.contentTypeId)
      .then((ct) => {
        if (cancelled) return;
        const map: Record<string, boolean> = {};
        ct.fields.forEach((f) => {
          map[f.id] = f.localized;
        });
        setLocalizedMap(map);
        const anyLocalized = Object.values(map).some(Boolean);
        const currentTab = activeTab;
        if (currentTab !== "all") {
          if (!anyLocalized) {
            setActiveTab("all");
          } else {
            const localeCodes = locales?.items.map((l) => l.code) ?? [];
            const validTabs = ["all", "all-locales", ...localeCodes];
            if (!validTabs.includes(currentTab)) setActiveTab("all");
          }
        }
      })
      .catch(() => {
        if (!cancelled) setLocalizedMap({});
      })
      .finally(() => {
        if (!cancelled) setContentTypeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entry?.contentTypeId]);

  // Reset iframe loaded state whenever the locale changes so the
  // loading overlay re-appears while the new URL is fetched.
  useEffect(() => {
    setIframeLoaded(false);
  }, [previewLocale]);

  if (!entry) {
    return (
      <main className="flex-1 overflow-y-auto p-6 sm:p-8 bg-gray-50">
        <div className="pt-16 text-gray-600 text-sm">Entry not found.</div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 sm:p-8 bg-gray-50">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold text-sky-600 uppercase tracking-widest mb-1">
            {entry.type}
          </p>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">
            {entry.label}
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-mono">{entry.id}</p>
        </div>
        <a
          href={`https://app.contentful.com/spaces/${parentData.spaceId}/environments/${parentData.environmentId}/entries/${entry.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors shrink-0"
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

      {/* View tabs */}
      {(entry.contentTypeId === "page" || entry.type === "Partner Email") && (
        <div className="flex gap-1 border-b border-gray-300 mb-4">
          <button
            onClick={() => setViewTab("fields")}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors ${
              viewTab === "fields"
                ? "bg-gray-100 border border-b-gray-100 border-gray-300 text-blue-600 -mb-px"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Fields
          </button>
          {entry.contentTypeId === "page" && (
            <button
              onClick={() => setViewTab("editor")}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors ${
                viewTab === "editor"
                  ? "bg-gray-100 border border-b-gray-100 border-gray-300 text-blue-600 -mb-px"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Visual Editor
            </button>
          )}
          {entry.type === "Partner Email" && (
            <button
              onClick={() => setViewTab("preview")}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-1.5 ${
                viewTab === "preview"
                  ? "bg-gray-100 border border-b-gray-100 border-gray-300 text-blue-600 -mb-px"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
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
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              Email Preview
            </button>
          )}
        </div>
      )}

      {/* Editor / Preview views */}
      {viewTab === "editor" && entry.contentTypeId === "page" ? (
        <div style={{ height: "calc(100vh - 220px)" }}>
          <PageEditorTab entryId={entry.id} locale={firstLocale} />
        </div>
      ) : viewTab === "preview" && entry.type === "Partner Email" ? (
        (() => {
          const opcoKey = parentData.opcoId.toLowerCase();
          const programme = OPCO_PROGRAMME_MAP[opcoKey];
          if (!programme) {
            return (
              <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-4">
                <svg
                  className="w-5 h-5 shrink-0 mt-0.5 text-amber-600"
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
                <div>
                  <p className="text-sm font-bold text-amber-800">
                    Unknown OPCO programme code for &ldquo;{opcoKey}&rdquo;
                  </p>
                  <p className="mt-1 text-xs text-amber-700 leading-relaxed">
                    The email preview API requires a{" "}
                    <code className="bg-amber-100 px-1 rounded">programme</code>{" "}
                    query parameter, but{" "}
                    <code className="bg-amber-100 px-1 rounded">{opcoKey}</code>{" "}
                    is not in the OPCO → programme map. Add it to{" "}
                    <code className="bg-amber-100 px-1 rounded">
                      OPCO_PROGRAMME_MAP
                    </code>{" "}
                    in{" "}
                    <code className="bg-amber-100 px-1 rounded">
                      app/routes/home.entry.tsx
                    </code>
                    .
                  </p>
                  <p className="mt-2 text-[11px] text-amber-600 font-mono">
                    Current map: {JSON.stringify(OPCO_PROGRAMME_MAP)}
                  </p>
                </div>
              </div>
            );
          }
          const templateValue =
            resolveStringField(entry.fields["type"], previewLocale) ??
            entry.contentTypeId;
          const previewUrl = `https://stg.avios.com/spend-avios/vouchers/api/internal/email/template?template=${encodeURIComponent(templateValue)}&programme=${encodeURIComponent(programme)}&partner=${encodeURIComponent(parentData.partnerId.toLowerCase())}&locale=${encodeURIComponent(previewLocale)}&preview=true`;
          return (
            <div className="flex flex-col gap-3">
              {/* Toolbar */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-gray-500 font-medium shrink-0">
                  Locale:
                </span>
                <select
                  value={previewLocale}
                  onChange={(e) => setPreviewLocale(e.target.value)}
                  className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {locales?.items.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.code}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] font-mono text-gray-400 bg-gray-100 border border-gray-200 rounded px-2 py-1 flex-1 truncate hidden sm:block">
                  {previewUrl}
                </span>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto shrink-0 flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
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
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                  Open in new tab
                </a>
              </div>
              {/* Disclaimer */}
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                <svg
                  className="w-4 h-4 shrink-0 mt-0.5 text-amber-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>
                  <strong className="font-semibold">Preview only.</strong> Some
                  values shown — such as member names, point balances, and
                  transaction details — are{" "}
                  <strong className="font-semibold">
                    mocked placeholder data
                  </strong>{" "}
                  generated by the backend. Only the text and content pulled
                  from Contentful (headings, body copy, CTAs) reflects what you
                  are editing here.{" "}
                  <button
                    onClick={() => setPreviewHelpOpen(true)}
                    className="inline font-semibold text-red-600 hover:text-red-800 underline underline-offset-2 transition-colors"
                  >
                    Preview not loading?
                  </button>
                </span>
              </div>

              {/* Preview not loading — help modal */}
              {previewHelpOpen && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) setPreviewHelpOpen(false);
                  }}
                >
                  <div
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    onClick={() => setPreviewHelpOpen(false)}
                  />
                  <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
                    {/* Modal header */}
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
                      <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200/60 flex items-center justify-center shrink-0">
                        <svg
                          className="w-4 h-4 text-red-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-sm font-bold text-gray-900 leading-none">
                          Preview not loading?
                        </h2>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          Likely a CSP{" "}
                          <code className="bg-gray-100 px-1 rounded">
                            frame-ancestors
                          </code>{" "}
                          restriction
                        </p>
                      </div>
                      <button
                        onClick={() => setPreviewHelpOpen(false)}
                        className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
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
                    {/* Modal body */}
                    <div className="overflow-y-auto px-5 py-4 flex flex-col gap-4 text-xs">
                      <p className="text-gray-600 leading-relaxed">
                        The preview is embedded in an{" "}
                        <code className="bg-gray-100 px-1 rounded">iframe</code>
                        . Browsers silently block iframes when the response
                        carries a{" "}
                        <code className="bg-gray-100 px-1 rounded">
                          Content-Security-Policy: frame-ancestors
                        </code>{" "}
                        header that does not include this tool&apos;s origin —
                        the frame loads but renders blank with no JavaScript
                        error.
                      </p>
                      <div>
                        <p className="font-semibold text-gray-800 mb-2">
                          To fix — ask the API team to extend the CSP header on
                          the preview endpoint:
                        </p>
                        <pre className="bg-gray-900 text-emerald-400 rounded-xl px-4 py-3 overflow-x-auto text-[11px] leading-relaxed whitespace-pre-wrap">{`Content-Security-Policy: frame-ancestors 'self'
  https://contentful.tools.avios.com
  http://localhost:5173
  http://localhost:3000`}</pre>
                        <p className="mt-2 text-gray-400">
                          The exact value depends on what is already set. The
                          key addition is{" "}
                          <code className="bg-gray-100 px-1 rounded">
                            https://contentful.tools.avios.com
                          </code>{" "}
                          for production and the localhost origins for local
                          development.
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 mb-1.5">
                          Check the endpoint directly
                        </p>
                        <p className="text-gray-500 mb-2">
                          Open the URL below in a new tab. If it renders
                          correctly, the endpoint works — the issue is only the{" "}
                          <code className="bg-gray-100 px-1 rounded">
                            frame-ancestors
                          </code>{" "}
                          header blocking the iframe embed.
                        </p>
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-blue-600 hover:text-blue-800 break-all leading-relaxed"
                        >
                          {previewUrl}
                        </a>
                      </div>
                      <div className="rounded-lg border border-gray-100 bg-gray-50 px-3.5 py-3">
                        <p className="font-semibold text-gray-700 mb-1">
                          Inspect the response headers in DevTools
                        </p>
                        <ol className="list-decimal list-inside text-gray-500 space-y-0.5">
                          <li>Open DevTools → Network tab</li>
                          <li>
                            Load the URL above directly or reload this page
                          </li>
                          <li>Find the preview request and click it</li>
                          <li>
                            Check the <strong>Response Headers</strong> for{" "}
                            <code className="bg-gray-100 px-1 rounded">
                              content-security-policy
                            </code>
                          </li>
                        </ol>
                      </div>
                    </div>
                    {/* Modal footer */}
                    <div className="px-5 py-3 border-t border-gray-100 flex justify-end shrink-0">
                      <button
                        onClick={() => setPreviewHelpOpen(false)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gray-800 hover:bg-gray-700 transition-colors"
                      >
                        Got it
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {/* iframe */}
              <div
                className="relative bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"
                style={{ height: "calc(100vh - 330px)", minHeight: "480px" }}
              >
                {/* Loading overlay — hidden once iframe fires onLoad */}
                {!iframeLoaded && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-gray-50">
                    <svg
                      className="w-6 h-6 text-blue-400 animate-spin"
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
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                    <span className="text-xs text-gray-400">
                      Loading email preview…
                    </span>
                  </div>
                )}
                <iframe
                  key={previewUrl}
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title="Email Preview"
                  onLoad={() => setIframeLoaded(true)}
                />
              </div>
            </div>
          );
        })()
      ) : (
        <>
          {/* Inner locale tab bar — only shown when at least one field is localizable */}
          {hasLocalizedFields && (
            <div className="flex gap-1 border-b border-gray-300 mb-0">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors ${
                  activeTab === "all"
                    ? "bg-gray-100 border border-b-gray-100 border-gray-300 text-blue-600 -mb-px"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Common Fields
              </button>
              <button
                onClick={() => setActiveTab("all-locales")}
                className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors ${
                  activeTab === "all-locales"
                    ? "bg-gray-100 border border-b-gray-100 border-gray-300 text-blue-600 -mb-px"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                All locales
              </button>
              {locales?.items.map((locale) => (
                <button
                  key={locale.code}
                  onClick={() => setActiveTab(locale.code)}
                  className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors ${
                    activeTab === locale.code
                      ? "bg-gray-100 border border-b-gray-100 border-gray-300 text-blue-600 -mb-px"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {locale.code}
                </button>
              ))}
            </div>
          )}

          {/* Fields table */}
          <div className="bg-gray-100 border border-gray-300 rounded-xl shadow-sm overflow-x-auto relative">
            {contentTypeLoading ? (
              // Skeleton rows while content-type definition is being fetched
              <div
                style={{
                  animation: "skeleton-shimmer 1.4s ease-in-out infinite",
                }}
              >
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-300 bg-gray-200">
                      <th className="text-left px-4 py-2.5 w-55">
                        <div className="h-3 w-16 bg-gray-300 rounded" />
                      </th>
                      <th className="text-left px-4 py-2.5">
                        <div className="h-3 w-20 bg-gray-300 rounded" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <tr
                        key={i}
                        className={
                          i % 2 === 0 ? "bg-gray-100" : "bg-gray-200/50"
                        }
                      >
                        <td className="px-4 py-3">
                          <div className="h-3 w-28 bg-gray-200 rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <div
                            className="h-3 bg-gray-200 rounded"
                            style={{ width: `${38 + ((i * 31) % 48)}%` }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : !hasLocalizedFields ? (
              // No localizable fields — simple flat table
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-300 bg-gray-200">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide w-55">
                      Field
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(entry.fields)
                    .filter(
                      ([fieldKey]) => !STRUCTURAL_FIELD_KEYS.has(fieldKey),
                    )
                    .map(([fieldKey, localeValues], i) => {
                      const value =
                        localeValues?.[firstLocale] ??
                        Object.values(localeValues ?? {})[0];
                      return (
                        <tr
                          key={fieldKey}
                          className={
                            i % 2 === 0 ? "bg-gray-100" : "bg-gray-200/50"
                          }
                        >
                          <td className="px-4 py-2.5 align-top">
                            <span className="font-mono text-xs text-gray-400">
                              {fieldKey}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 align-top wrap-break-word">
                            <EditableCell
                              fieldKey={fieldKey}
                              locale={firstLocale}
                              rawValue={value}
                              entryId={entry.id}
                              editingCell={editingCell}
                              setEditingCell={setEditingCell}
                              draftValue={draftValue}
                              setDraftValue={setDraftValue}
                              localOverrides={localOverrides}
                              onSaved={handleSaved}
                            />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            ) : activeTab === "all" ? (
              // Common Fields: non-localizable fields only
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-300 bg-gray-200">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide w-55">
                      Field
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(entry.fields)
                    .filter(
                      ([fieldKey]) =>
                        !STRUCTURAL_FIELD_KEYS.has(fieldKey) &&
                        localizedMap[fieldKey] === false,
                    )
                    .map(([fieldKey, localeValues], i) => {
                      const value =
                        localeValues?.[firstLocale] ??
                        Object.values(localeValues ?? {})[0];
                      return (
                        <tr
                          key={fieldKey}
                          className={
                            i % 2 === 0 ? "bg-gray-100" : "bg-gray-200/50"
                          }
                        >
                          <td className="px-4 py-2.5 align-top">
                            <span className="font-mono text-xs text-gray-400">
                              {fieldKey}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 align-top wrap-break-word">
                            <EditableCell
                              fieldKey={fieldKey}
                              locale={firstLocale}
                              rawValue={value}
                              entryId={entry.id}
                              editingCell={editingCell}
                              setEditingCell={setEditingCell}
                              draftValue={draftValue}
                              setDraftValue={setDraftValue}
                              localOverrides={localOverrides}
                              onSaved={handleSaved}
                            />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            ) : activeTab === "all-locales" ? (
              // All locales grid: localizable fields × locales
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-300 bg-gray-200">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide w-45 sticky left-0 bg-gray-200">
                      Field
                    </th>
                    {locales?.items.map((locale) => (
                      <th
                        key={locale.code}
                        className="text-left px-4 py-2.5 text-xs font-semibold text-blue-600 uppercase tracking-wide min-w-45"
                      >
                        {locale.code}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(entry.fields)
                    .filter(
                      ([fieldKey]) =>
                        !STRUCTURAL_FIELD_KEYS.has(fieldKey) &&
                        localizedMap[fieldKey] !== false,
                    )
                    .map(([fieldKey, localeValues], i) => {
                      const rowBg =
                        i % 2 === 0 ? "bg-gray-100" : "bg-gray-200/50";
                      return (
                        <tr key={fieldKey} className={rowBg}>
                          <td
                            className={`px-4 py-2.5 align-top sticky left-0 ${rowBg}`}
                          >
                            <span className="font-mono text-xs text-gray-400">
                              {fieldKey}
                            </span>
                          </td>
                          {locales?.items.map((locale) => (
                            <td
                              key={locale.code}
                              className="px-4 py-2.5 align-top border-l border-gray-200 wrap-break-word max-w-75"
                            >
                              <EditableCell
                                fieldKey={fieldKey}
                                locale={locale.code}
                                rawValue={localeValues?.[locale.code]}
                                entryId={entry.id}
                                editingCell={editingCell}
                                setEditingCell={setEditingCell}
                                draftValue={draftValue}
                                setDraftValue={setDraftValue}
                                localOverrides={localOverrides}
                                onSaved={handleSaved}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            ) : (
              // Single-locale view: localizable fields for the selected locale
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-300 bg-gray-200">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide w-55">
                      Field
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-blue-600 uppercase tracking-wide">
                      {activeTab}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(entry.fields)
                    .filter(
                      ([fieldKey]) =>
                        !STRUCTURAL_FIELD_KEYS.has(fieldKey) &&
                        localizedMap[fieldKey] !== false,
                    )
                    .map(([fieldKey, localeValues], i) => (
                      <tr
                        key={fieldKey}
                        className={
                          i % 2 === 0 ? "bg-gray-100" : "bg-gray-200/50"
                        }
                      >
                        <td className="px-4 py-2.5 align-top">
                          <span className="font-mono text-xs text-gray-400">
                            {fieldKey}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 align-top wrap-break-word">
                          <EditableCell
                            fieldKey={fieldKey}
                            locale={activeTab}
                            rawValue={localeValues?.[activeTab]}
                            entryId={entry.id}
                            editingCell={editingCell}
                            setEditingCell={setEditingCell}
                            draftValue={draftValue}
                            setDraftValue={setDraftValue}
                            localOverrides={localOverrides}
                            onSaved={handleSaved}
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </main>
  );
}
