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
      <div className="flex items-center gap-2 px-3 py-2">
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
      {isImage && url && (
        <div className="border-t border-gray-300 p-2 bg-gray-200/30 flex items-center justify-center relative group">
          <img
            src={url}
            alt={typeof title === "string" ? title : assetId}
            className="max-h-40 max-w-full rounded object-contain"
          />
          {_spaceId && _envId && (
            <a
              href={`https://app.contentful.com/spaces/${_spaceId}/environments/${_envId}/assets/${assetId}`}
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
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-200/60 transition-colors text-left"
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
      {expanded && (
        <div className="border-t border-gray-300 divide-y divide-gray-200 bg-gray-200/30">
          {Object.entries(fields).map(([key, localeVals]) => {
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
  const [viewTab, setViewTab] = useState<"fields" | "editor">("fields");
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

      {/* View tabs — only shown for page content type */}
      {entry.contentTypeId === "page" && (
        <div className="flex gap-1 border-b border-gray-300 mb-4">
          {(["fields", "editor"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setViewTab(tab)}
              className={`px-4 py-2 text-xs font-semibold capitalize rounded-t-lg transition-colors ${
                viewTab === tab
                  ? "bg-gray-100 border border-b-gray-100 border-gray-300 text-blue-600 -mb-px"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "editor" ? "Visual Editor" : "Fields"}
            </button>
          ))}
        </div>
      )}

      {/* Editor view */}
      {viewTab === "editor" && entry.contentTypeId === "page" ? (
        <div style={{ height: "calc(100vh - 220px)" }}>
          <PageEditorTab entryId={entry.id} locale={firstLocale} />
        </div>
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
                  {Object.entries(entry.fields).map(
                    ([fieldKey, localeValues], i) => {
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
                    },
                  )}
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
                    .filter(([fieldKey]) => localizedMap[fieldKey] === false)
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
                    .filter(([fieldKey]) => localizedMap[fieldKey] !== false)
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
                    .filter(([fieldKey]) => localizedMap[fieldKey] !== false)
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
