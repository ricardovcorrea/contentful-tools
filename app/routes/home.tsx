import { getOpcoPartnerPages } from "~/lib/contentful/get-opco-partner-pages";
import { getEntryTree, type RefGroup } from "~/lib/contentful/get-entry-tree";
import type { Route } from "./+types/home";
import { useState, useEffect, useRef } from "react";
import { AppHeader } from "~/components/layout/AppHeader";
import { AppSidebar } from "~/components/layout/AppSidebar";
import { AppFooter } from "~/components/layout/AppFooter";
import { OnboardingTour, isTourSeen } from "~/components/layout/OnboardingTour";
import { ToastProvider } from "~/lib/toast";
import { useEditMode } from "~/lib/edit-mode";
import {
  dispatchLoadStep,
  dispatchLoadComplete,
  resetLoadStep,
  dispatchNavLoadingStart,
  NAV_LOADING_EVENT,
  LoadingScreen,
} from "~/components/loading-screen";
import {
  Outlet,
  useNavigate,
  useNavigation,
  useParams,
  useSearchParams,
  useLocation,
  useRouteError,
  redirect,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import { getOpcos } from "~/lib/contentful/get-opcos";
import { getOpcoPartners } from "~/lib/contentful/get-opco-partners";
import { getOpcoMessages } from "~/lib/contentful/get-opco-messages";
import { getOpcoPartnerMessages } from "~/lib/contentful/get-opco-partner-messages";
import { getOpcoPages } from "~/lib/contentful/get-opco-pages";
import { getOpcoPartnerEmails } from "~/lib/contentful/get-opco-partner-emails";
import {
  getContentfulManagementClient,
  clearContentfulManagementClient,
} from "~/lib/contentful";
import {
  clearCache,
  getCacheLastUpdated,
  CACHE_TTL_MS,
} from "~/lib/contentful/cache";
import { getLocales } from "~/lib/contentful/get-locales";
import { getCurrentUser } from "~/lib/contentful/get-current-user";
import { getContentType } from "~/lib/contentful/get-content-type";
import { getScheduledActions } from "~/lib/contentful/get-scheduled-actions";
import { resolveStringField } from "~/lib/resolve-string-field";
import { queryClient, QUERY_STALE_TIME } from "~/lib/query-client";
import { queryKeys } from "~/lib/query-keys";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Contentful tools" },
    {
      name: "description",
      content:
        "Browse and manage Contentful entries, translations, and partner content across locales.",
    },
  ];
}

/**
 * Re-run the loader when the opco or partner selection changes (URL params),
 * so child routes always receive correctly scoped loader data.
 * For all other navigations (e.g. moving between sub-pages) skip the reload
 * since TanStack Query manages data freshness there.
 */
/** True after the very first clientLoader run completes successfully. Used to
 *  skip the 3-second "Ready" pause on subsequent opco/partner revalidations. */
let _hasLoadedOnce = false;

export function shouldRevalidate({
  currentUrl,
  nextUrl,
}: ShouldRevalidateFunctionArgs) {
  if (
    currentUrl.searchParams.get("opco") !== nextUrl.searchParams.get("opco") ||
    currentUrl.searchParams.get("partner") !==
      nextUrl.searchParams.get("partner")
  ) {
    return true;
  }
  return false;
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const token = localStorage.getItem("contentfulManagementToken");
  const spaceId = localStorage.getItem("contentfulSpaceId");
  const environment = localStorage.getItem("contentfulEnvironment");

  if (!token || !spaceId || !environment) {
    return redirect("/login");
  }

  // Signal the layout to show the loading overlay, then reset step progress.
  // This fires before any async work so the overlay appears immediately.
  dispatchNavLoadingStart();
  resetLoadStep();

  // Remove any corrupted selection values that might have been stored as
  // "[object Object]" from a previous bad run.
  for (const key of ["selectedOpco", "selectedPartner"]) {
    const v = localStorage.getItem(key);
    if (v && (v.includes("[object") || v.includes("{"))) {
      localStorage.removeItem(key);
    }
  }

  const url = new URL(request.url);

  const client = getContentfulManagementClient();

  let opcos: any,
    locales: any,
    currentUser: any,
    spaceObj: any,
    spacesCollection: any;
  dispatchLoadStep(0);
  try {
    [opcos, locales, currentUser, spaceObj, spacesCollection] =
      await Promise.all([
        getOpcos(),
        getLocales(),
        getCurrentUser(),
        queryClient.ensureQueryData({
          queryKey: queryKeys.space(spaceId),
          queryFn: () => client.getSpace(spaceId),
          staleTime: Infinity,
        }),
        queryClient
          .ensureQueryData({
            queryKey: queryKeys.spaces(),
            queryFn: () => client.getSpaces(),
            staleTime: Infinity,
          })
          .catch(() => ({
            items: [],
          })),
      ]);
  } catch (e: any) {
    const status = e?.sys?.status ?? e?.status ?? e?.response?.status;
    const msg = e?.message ?? e?.sys?.id ?? "Unknown error";
    if (status === 401 || status === 403) {
      throw new Error(
        `Authentication failed (${status}): ${msg}. Your token may be invalid or expired.`,
      );
    }
    throw new Error(`Failed to connect to Contentful: ${msg}`);
  }

  const spaceName = spaceObj.name;

  // Compute opcoId early (needs opcos + locales from step 0) so step 1 can
  // call getOpcoPartners(opcoId) in parallel with envObj fetch.

  // Sort locales so en-GB is always first; preserve API order for the rest.
  locales.items.sort((a: any, b: any) => {
    if (a.code === "en-GB") return -1;
    if (b.code === "en-GB") return 1;
    return 0;
  });

  const firstLocale = locales.items[0]?.code ?? "en";

  const getOpcoFieldId = (opco: any) =>
    resolveStringField(opco.fields["id"], firstLocale);
  const getOpcoName = (opco: any) =>
    resolveStringField(
      opco.fields["internalName"] ?? opco.fields["title"],
      firstLocale,
    );

  const baOpco = opcos.items.find((o: any) =>
    getOpcoName(o).toLowerCase().includes("british airways"),
  );
  const defaultOpcoId = baOpco
    ? getOpcoFieldId(baOpco)
    : (getOpcoFieldId(opcos.items[0]) ?? "");

  /** Return null for any value that is clearly not a plain string ID. */
  const safeStoredId = (raw: string | null): string | null => {
    if (!raw || raw.includes("[object") || raw.includes("{")) return null;
    return raw;
  };

  let opcoId =
    safeStoredId(url.searchParams.get("opco")) ??
    safeStoredId(localStorage.getItem("selectedOpco")) ??
    defaultOpcoId;

  // If the stored/URL opco ID is no longer in the list (e.g. was deleted),
  // fall back to the first available OPCO.
  const availableOpcoIds = opcos.items.map((o: any) => getOpcoFieldId(o));
  if (opcoId && !availableOpcoIds.includes(opcoId)) {
    opcoId = availableOpcoIds[0] ?? opcoId;
  }

  // Narrow locales to those configured on the selected OPCO entry.
  // The "locales" field on the opco content type is expected to be an array
  // of locale-code strings (e.g. ["en-GB", "ar-AE"]).  If the field is
  // absent or returns an empty array we fall back to all environment locales.
  const selectedOpcoEntry = opcos.items.find(
    (o: any) => getOpcoFieldId(o) === opcoId,
  );
  const rawOpcoLocales: unknown =
    selectedOpcoEntry?.fields?.["locales"]?.[firstLocale];
  // Keep a snapshot of all environment locales before narrowing to the OPCO set.
  const allLocalesItems: any[] = locales.items;

  // Build the OPCO-filtered locale list.
  // Strategy: if rawOpcoLocales is a non-empty string array, build a list by:
  //   1. Always including the environment default locale (en-GB) first.
  //   2. Including any environment locale whose code is in rawOpcoLocales.
  //   3. IF a rawOpcoLocales code has no matching environment locale (e.g. the
  //      environment doesn't explicitly register it), synthesise a minimal locale
  //      object so the column still appears in the overview table.
  let filteredLocaleItems: any[];
  if (Array.isArray(rawOpcoLocales) && rawOpcoLocales.length > 0) {
    const opcoLocaleCodes = rawOpcoLocales as string[];
    // Start with all env locales that are default OR in the OPCO list.
    const matched = allLocalesItems.filter(
      (l: any) => l.default || opcoLocaleCodes.includes(l.code),
    );
    const matchedCodesSet = new Set(matched.map((l: any) => l.code));
    // Synthesise entries for OPCO locales that have no env locale record.
    const synthetic = opcoLocaleCodes
      .filter((code) => !matchedCodesSet.has(code))
      .map((code) => ({ code, name: code, default: false }));
    filteredLocaleItems = [...matched, ...synthetic];
  } else {
    filteredLocaleItems = allLocalesItems;
  }
  // Build plain objects so child routes always get plain serialisable data.
  const allLocales = { items: allLocalesItems };
  const filteredLocales = { items: filteredLocaleItems };
  // Expose the raw OPCO locale codes (without the forced en-GB injection) so
  // child routes can distinguish "display columns" from "translation targets".
  const opcoConfiguredLocaleCodes: string[] =
    Array.isArray(rawOpcoLocales) && rawOpcoLocales.length > 0
      ? (rawOpcoLocales as string[])
      : allLocalesItems.map((l: any) => l.code);

  // Step 1: load envObj + environments + opcoPartners ALL in parallel —
  // none depend on each other; opcoId is already known from step 0.
  let envObj: any, environmentsList: any, opcoPartners: any;
  dispatchLoadStep(1);
  try {
    [envObj, environmentsList, opcoPartners] = await Promise.all([
      queryClient.ensureQueryData({
        queryKey: queryKeys.envObj(spaceId, environment),
        queryFn: () => spaceObj.getEnvironment(environment),
        staleTime: Infinity,
      }),
      queryClient.ensureQueryData({
        queryKey: queryKeys.environments(spaceId),
        queryFn: () => spaceObj.getEnvironments(),
        staleTime: Infinity,
      }),
      getOpcoPartners(opcoId),
    ]);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    throw new Error(`Failed to load environment or partners: ${msg}`);
  }
  const environmentName = envObj.name;
  const environments = environmentsList.items.map((e: any) => ({
    id: e.sys.id,
    name: e.name,
  }));

  // Fire env-level stats + scheduled actions in the background immediately —
  // they'll almost certainly finish before the tree-building steps do.
  const scheduledActionsPromise = queryClient
    .ensureQueryData({
      queryKey: queryKeys.scheduledActions(spaceId, environment),
      queryFn: () => getScheduledActions(spaceId!, environment!),
      staleTime: QUERY_STALE_TIME,
    })
    .catch(() => []);

  const envStatsPromise = Promise.all([
    queryClient
      .ensureQueryData({
        queryKey: queryKeys.envEntriesTotal(spaceId, environment),
        queryFn: () => envObj.getEntries({ limit: 0 }),
        staleTime: QUERY_STALE_TIME,
      })
      .catch(() => ({ total: null })),
    queryClient
      .ensureQueryData({
        queryKey: queryKeys.envContentTypesTotal(spaceId, environment),
        queryFn: () => envObj.getContentTypes({ limit: 0 }),
        staleTime: QUERY_STALE_TIME,
      })
      .catch(() => ({ total: null })),
    queryClient
      .ensureQueryData({
        queryKey: queryKeys.envAssetsTotal(spaceId, environment),
        queryFn: () => envObj.getAssets({ limit: 0 }),
        staleTime: QUERY_STALE_TIME,
      })
      .catch(() => ({ total: null })),
  ]);

  const firstPartnerId = resolveStringField(
    opcoPartners.items[0]?.fields["id"],
    firstLocale,
  );
  let partnerId =
    safeStoredId(url.searchParams.get("partner")) ??
    safeStoredId(localStorage.getItem("selectedPartner")) ??
    firstPartnerId;

  // If the stored/URL partner ID is no longer in the list (e.g. was deleted),
  // fall back to the first available partner for this OPCO.
  const availablePartnerIds = opcoPartners.items.map((p: any) =>
    resolveStringField(p.fields["id"], firstLocale),
  );
  if (
    partnerId &&
    availablePartnerIds.length > 0 &&
    !availablePartnerIds.includes(partnerId)
  ) {
    partnerId = availablePartnerIds[0] ?? partnerId;
  }

  // Persist resolved values
  localStorage.setItem("selectedOpco", opcoId);
  localStorage.setItem("selectedPartner", partnerId);

  // Step 2: load all content entries in parallel
  let opcoPages: any,
    opcoMessages: any,
    partnerPages: any,
    partnerMessages: any,
    partnerEmails: any;
  dispatchLoadStep(2);
  try {
    [opcoPages, opcoMessages, partnerPages, partnerMessages, partnerEmails] =
      await Promise.all([
        getOpcoPages(opcoId),
        getOpcoMessages(opcoId),
        getOpcoPartnerPages(opcoId, partnerId),
        getOpcoPartnerMessages(opcoId, partnerId),
        getOpcoPartnerEmails(opcoId, partnerId),
      ]);
  } catch (e: any) {
    throw new Error(`Failed to load content entries: ${e?.message ?? e}`);
  }

  const STRUCTURAL_CTS = ["opco", "partner"];
  const opcoRootCTIds = [
    ...new Set([
      ...opcoPages.items.map((i: any) => i.sys.contentType.sys.id as string),
      ...opcoMessages.items.map((i: any) => i.sys.contentType.sys.id as string),
      ...STRUCTURAL_CTS,
    ]),
  ];
  const partnerRootCTIds = [
    ...new Set([
      ...partnerPages.items.map((i: any) => i.sys.contentType.sys.id as string),
      ...partnerMessages.items.map(
        (i: any) => i.sys.contentType.sys.id as string,
      ),
      ...partnerEmails.items.map(
        (i: any) => i.sys.contentType.sys.id as string,
      ),
      ...STRUCTURAL_CTS,
    ]),
  ];

  const opcoPageIds = opcoPages.items.map((i: any) => i.sys.id as string);
  const partnerPageIds = partnerPages.items.map((i: any) => i.sys.id as string);

  // Step 3: build OPCO + partner content trees in parallel (was sequential)
  dispatchLoadStep(3);
  const [opcoRefGroups, partnerRefGroups]: [RefGroup[], RefGroup[]] =
    await Promise.all([
      opcoPageIds.length > 0
        ? getEntryTree(opcoPageIds, opcoRootCTIds, `opco-refs:${opcoId}`)
        : Promise.resolve([]),
      partnerPageIds.length > 0
        ? getEntryTree(
            partnerPageIds,
            partnerRootCTIds,
            `partner-refs:${opcoId}:${partnerId}`,
          )
        : Promise.resolve([]),
    ]);

  // Step 4: resolve localizable content types
  dispatchLoadStep(4);
  const uniqueCtIds = [
    ...new Set([
      ...[
        opcoPages.items[0],
        opcoMessages.items[0],
        partnerPages.items[0],
        partnerMessages.items[0],
        partnerEmails.items[0],
      ]
        .filter(Boolean)
        .map((item: any) => item.sys.contentType.sys.id as string),
      ...opcoRefGroups.map((g) => g.contentTypeId),
      ...partnerRefGroups.map((g) => g.contentTypeId),
    ]),
  ];
  const ctResults = await Promise.all(
    uniqueCtIds.map((id) =>
      getContentType(id)
        .then((ct) => ({
          id,
          localizableFields: ct.fields
            .filter((f: any) => f.localized)
            .map((f: any) => f.id as string),
        }))
        .catch(() => ({ id, localizableFields: [] as string[] })),
    ),
  );
  const localizableContentTypes: string[] = ctResults
    .filter((r) => r.localizableFields.length > 0)
    .map((r) => r.id);
  const localizableFieldsMap: Record<string, string[]> = Object.fromEntries(
    ctResults.map((r) => [r.id, r.localizableFields]),
  );

  // Await env stats — fired in background during steps 2-4, almost certainly done
  const [envEntriesResult, envContentTypesResult, envAssetsResult] =
    await envStatsPromise;

  const envStats = {
    totalEntries: (envEntriesResult as { total: number | null }).total,
    totalContentTypes: (envContentTypesResult as { total: number | null })
      .total,
    totalAssets: (envAssetsResult as { total: number | null }).total,
  };

  const scheduledActions = await scheduledActionsPromise;

  dispatchLoadStep(5);

  // Mark all steps done.
  // On the initial load we keep a 3-second pause so the user can read the
  // step-by-step feedback. On opco/partner revalidations use a shorter pause
  // so the steps are still visible before the overlay dismisses.
  dispatchLoadComplete();
  await new Promise((r) => setTimeout(r, _hasLoadedOnce ? 1500 : 3000));
  _hasLoadedOnce = true;

  // Seed TanStack Query cache so useEntry/useAsset hooks across all pages get
  // instant results without extra API calls for data we just loaded.
  // All entry keys include [opcoId, partnerId] so hooks always resolve via the
  // same scoped key regardless of whether the entry is opco- or partner-specific.
  for (const collection of [
    opcoPages,
    opcoMessages,
    partnerPages,
    partnerMessages,
    partnerEmails,
  ]) {
    for (const item of collection.items ?? []) {
      queryClient.setQueryData(
        queryKeys.entry(item.sys.id, opcoId, partnerId),
        item,
      );
    }
  }
  for (const group of [...opcoRefGroups, ...partnerRefGroups]) {
    for (const item of group.items ?? []) {
      queryClient.setQueryData(
        queryKeys.entry(item.sys.id, opcoId, partnerId),
        item,
      );
    }
  }
  // Stamp load time so getCacheLastUpdated() continues to work for the UI.
  localStorage.setItem("cf_cache_updated_at", String(Date.now()));

  return {
    opcos,
    opcoId,
    opcoPartners,
    partnerId,
    opcoPages,
    opcoMessages,
    partnerPages,
    partnerMessages,
    partnerEmails,
    opcoRefGroups,
    partnerRefGroups,
    locales: filteredLocales,
    allLocales,
    opcoConfiguredLocaleCodes,
    currentUser,
    spaceId,
    spaceName,
    spaces: (spacesCollection?.items ?? []).map((s: any) => ({
      id: s.sys.id,
      name: s.name,
    })) as { id: string; name: string }[],
    environmentId: environment,
    environmentName,
    environments,
    envStats,
    scheduledActions,
    localizableContentTypes,
    localizableFieldsMap,
    cacheLastUpdated: getCacheLastUpdated(),
  };
}

// ── Error boundary ────────────────────────────────────────────────────────────

export function ErrorBoundary() {
  const error = useRouteError() as any;
  const navigate = useNavigate();

  const message =
    error?.message ??
    error?.data ??
    (typeof error === "string" ? error : "An unexpected error occurred.");

  // Only clear credentials for actual auth/API failures, not JS runtime errors
  // (e.g. ReferenceError, TypeError thrown during rendering).
  const status = error?.status ?? error?.statusCode ?? 0;
  const isAuthError =
    status === 401 ||
    status === 403 ||
    /unauthorized|forbidden|invalid.*token|access.*token|api.*key/i.test(
      message,
    );

  useEffect(() => {
    if (!isAuthError) return;
    localStorage.removeItem("contentfulManagementToken");
    localStorage.removeItem("contentfulSpaceId");
    localStorage.removeItem("contentfulEnvironment");
    localStorage.removeItem("selectedOpco");
    localStorage.removeItem("selectedPartner");
    clearCache();
    clearContentfulManagementClient();
    queryClient.clear();
  }, [isAuthError]);

  return (
    <div className="h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
        {/* Red header strip */}
        <div className="bg-red-50 border-b border-red-100 px-6 py-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <svg
              className="w-5 h-5 text-red-500"
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
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-red-700">
              {isAuthError ? "Loading failed" : "Something went wrong"}
            </p>
            <p className="text-xs text-red-500 mt-0.5">
              {isAuthError
                ? "Your credentials have been cleared."
                : "A page error occurred. Your session is intact."}
            </p>
          </div>
        </div>

        {/* Error detail */}
        <div className="px-6 py-5 flex flex-col gap-5">
          <p className="text-sm text-gray-700 leading-relaxed wrap-break-word">
            {message}
          </p>

          <button
            onClick={() =>
              isAuthError ? navigate("/login", { replace: true }) : navigate(-1)
            }
            className="w-full rounded-lg bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-sm font-semibold py-3 transition-colors"
          >
            {isAuthError ? "Sign in again" : "Go back"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HomeLayout({ loaderData }: Route.ComponentProps) {
  const {
    opcos,
    opcoId,
    opcoPartners,
    partnerId,
    opcoPages,
    opcoMessages,
    partnerPages,
    partnerMessages,
    partnerEmails,
    opcoRefGroups,
    partnerRefGroups,
    locales,
    allLocales,
    currentUser,
    spaceId,
    spaceName,
    spaces,
    environmentId,
    environments,
    localizableContentTypes,
    localizableFieldsMap,
    opcoConfiguredLocaleCodes,
    cacheLastUpdated,
    scheduledActions,
  } = loaderData;

  const firstLocale = locales.items[0]?.code ?? "en";

  /** Returns true if any entry in any group has a source-locale value but
   *  a missing value in at least one target locale. */
  function hasAnyMissingTranslations(groups: { items: any[] }[]): boolean {
    const targetCodes = locales.items
      .map((l) => l.code)
      .filter((c) => c !== firstLocale);
    if (targetCodes.length === 0) return false;
    for (const group of groups) {
      for (const item of group.items) {
        const ctId: string | undefined = item.sys?.contentType?.sys?.id;
        const fields: string[] = (ctId && localizableFieldsMap[ctId]) || [];
        for (const fieldId of fields) {
          const map = item.fields[fieldId];
          const srcVal = map?.[firstLocale];
          if (
            srcVal === undefined ||
            srcVal === null ||
            srcVal === "" ||
            (Array.isArray(srcVal) && srcVal.length === 0)
          )
            continue;
          for (const lc of targetCodes) {
            const v = map?.[lc];
            if (
              v === undefined ||
              v === null ||
              v === "" ||
              (Array.isArray(v) && v.length === 0)
            )
              return true;
          }
        }
      }
    }
    return false;
  }

  const ctOf = (items: any[]) =>
    items[0]?.sys?.contentType?.sys?.id as string | undefined;
  const isLocalizable = (items: any[]) => {
    const id = ctOf(items);
    return !!id && localizableContentTypes.includes(id);
  };
  const opcoHasLocalizable =
    isLocalizable(opcoPages.items) ||
    isLocalizable(opcoMessages.items) ||
    opcoRefGroups.some((g) => isLocalizable(g.items));
  const partnerHasLocalizable =
    isLocalizable(partnerPages.items) ||
    isLocalizable(partnerMessages.items) ||
    isLocalizable(partnerEmails.items) ||
    partnerRefGroups.some((g) => isLocalizable(g.items));

  // Count unpublished items (same logic as home.unpublished.tsx: updatedAt > publishedAt).
  // OPCO items exclude any entry that also has a partner field.
  const unpublishedCount = [
    ...opcoPages.items.filter((i: any) => !i.fields?.partner),
    ...opcoMessages.items.filter((i: any) => !i.fields?.partner),
    ...partnerPages.items,
    ...partnerMessages.items,
    ...partnerEmails.items,
  ].filter((i: any) => {
    const { publishedAt, updatedAt } = i.sys ?? {};
    if (!publishedAt) return true;
    return new Date(updatedAt) > new Date(publishedAt);
  }).length;

  const scheduledCount = (scheduledActions as any[])?.length ?? 0;

  const opcoHasMissingTranslations = opcoHasLocalizable
    ? hasAnyMissingTranslations([opcoPages, opcoMessages, ...opcoRefGroups])
    : false;
  const partnerHasMissingTranslations = partnerHasLocalizable
    ? hasAnyMissingTranslations([
        partnerPages,
        partnerMessages,
        partnerEmails,
        ...partnerRefGroups,
      ])
    : false;

  // Per-group missing flag — keyed by "opco-{slug}" / "partner-{slug}"
  const groupMissingMap: Record<string, boolean> = {
    "opco-pages": isLocalizable(opcoPages.items)
      ? hasAnyMissingTranslations([opcoPages])
      : false,
    "opco-messages": isLocalizable(opcoMessages.items)
      ? hasAnyMissingTranslations([opcoMessages])
      : false,
    ...Object.fromEntries(
      opcoRefGroups.map((g) => [
        `opco-${g.slug}`,
        isLocalizable(g.items) ? hasAnyMissingTranslations([g]) : false,
      ]),
    ),
    "partner-pages": isLocalizable(partnerPages.items)
      ? hasAnyMissingTranslations([partnerPages])
      : false,
    "partner-messages": isLocalizable(partnerMessages.items)
      ? hasAnyMissingTranslations([partnerMessages])
      : false,
    "partner-emails": isLocalizable(partnerEmails.items)
      ? hasAnyMissingTranslations([partnerEmails])
      : false,
    ...Object.fromEntries(
      partnerRefGroups.map((g) => [
        `partner-${g.slug}`,
        isLocalizable(g.items) ? hasAnyMissingTranslations([g]) : false,
      ]),
    ),
  };

  const navigate = useNavigate();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const { entryId } = useParams();
  const isLoading = navigation.state === "loading";
  // Use localStorage as the authoritative fallback — it is always written
  // by handleOpcoChange/handlePartnerChange, whereas opcoId/partnerId are
  // frozen loader snapshots that don't update when shouldRevalidate=false.
  const selectedOpco =
    searchParams.get("opco") ?? localStorage.getItem("selectedOpco") ?? opcoId;
  const selectedPartner =
    searchParams.get("partner") ??
    localStorage.getItem("selectedPartner") ??
    partnerId;
  const { pathname } = useLocation();

  const opcoEntrySysId = opcos.items.find(
    (o: any) =>
      resolveStringField(o.fields["id"], firstLocale) === selectedOpco,
  )?.sys.id;
  // Partners for the currently selected OPCO.
  // Initialised from loader data and eagerly updated by handleOpcoChange;
  // also synced whenever the loader re-runs (e.g. after an opco/partner switch).
  const [activePartners, setActivePartners] = useState(opcoPartners);
  useEffect(() => {
    setActivePartners(opcoPartners);
  }, [opcoPartners]);
  const partnerEntrySysId = activePartners.items.find(
    (p: any) =>
      resolveStringField(p.fields["id"], firstLocale) === selectedPartner,
  )?.sys.id;

  const allOpcoEntryIds = new Set([
    opcoEntrySysId,
    ...opcoPages.items.map((i: any) => i.sys.id),
    ...opcoMessages.items.map((i: any) => i.sys.id),
    ...opcoRefGroups.flatMap((g) => g.items.map((i: any) => i.sys.id)),
  ]);
  const allPartnerEntryIds = new Set([
    partnerEntrySysId,
    ...partnerPages.items.map((i: any) => i.sys.id),
    ...partnerMessages.items.map((i: any) => i.sys.id),
    ...partnerEmails.items.map((i: any) => i.sys.id),
    ...partnerRefGroups.flatMap((g) => g.items.map((i: any) => i.sys.id)),
  ]);

  const shouldExpandOpco =
    pathname.startsWith("/overview/opco") ||
    (!!entryId && allOpcoEntryIds.has(entryId));
  const shouldExpandPartner =
    pathname.startsWith("/overview/partner") ||
    (!!entryId && allPartnerEntryIds.has(entryId));

  const [opcoExpanded, setOpcoExpanded] = useState(shouldExpandOpco);
  const [partnerExpanded, setPartnerExpanded] = useState(shouldExpandPartner);
  const [sidebarResetKey, setSidebarResetKey] = useState(0);
  const [showFullLoading, setShowFullLoading] = useState(false);
  const [isInactive, setIsInactive] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const { disableEditMode } = useEditMode();

  useEffect(() => {
    if (shouldExpandOpco) setOpcoExpanded(true);
  }, [shouldExpandOpco]);
  useEffect(() => {
    if (shouldExpandPartner) setPartnerExpanded(true);
  }, [shouldExpandPartner]);

  // Auto-show tour on first-ever visit (after initial load settles)
  useEffect(() => {
    if (!isLoading && !isTourSeen()) {
      const t = setTimeout(() => setTourOpen(true), 800);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // Show the full loading overlay whenever the clientLoader signals it is
  // about to start a (re)load. This fires synchronously before any step
  // events so the LoadingScreen is mounted and ready to receive them.
  useEffect(() => {
    const handler = () => {
      setShowFullLoading(true);
    };
    window.addEventListener(NAV_LOADING_EVENT, handler);
    return () => window.removeEventListener(NAV_LOADING_EVENT, handler);
  }, []);

  // Hide full loading screen once navigation finishes.
  useEffect(() => {
    if (!isLoading && showFullLoading) {
      setShowFullLoading(false);
    }
  }, [isLoading, showFullLoading]);

  // Refresh data when the tab regains visibility and the cache has gone stale.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const lastUpdated = getCacheLastUpdated();
      const isStale =
        lastUpdated === null || Date.now() - lastUpdated > CACHE_TTL_MS;
      if (isStale) {
        clearCache();
        navigate(0);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [navigate]);

  // Two-stage auto-logout:
  //   Stage 1 — after INACTIVE_AFTER_MS of no input → show "Inactive" badge in footer
  //   Stage 2 — after a further (LOGOUT_AFTER_MS − INACTIVE_AFTER_MS) → force logout
  const INACTIVE_AFTER_MS = 15_000; // 15 seconds → show footer badge
  const LOGOUT_AFTER_MS = 5 * 60 * 1000; // 5 minutes total → logout

  // Keep a stable ref to navigate so the effect never needs to re-run on
  // route changes (which would reset the idle timer on every navigation).
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  // Refs for both timer stages.
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const logout = () => {
      setIsInactive(false);
      localStorage.setItem("loggedOutReason", "inactivity");
      localStorage.removeItem("contentfulManagementToken");
      localStorage.removeItem("contentfulSpaceId");
      localStorage.removeItem("contentfulEnvironment");
      localStorage.removeItem("selectedOpco");
      localStorage.removeItem("selectedPartner");
      clearCache();
      clearContentfulManagementClient();
      queryClient.clear();
      navigateRef.current("/login", { replace: true });
    };

    const markInactive = () => {
      setIsInactive(true);
      // Schedule actual logout for the remaining window.
      inactivityTimer.current = setTimeout(
        logout,
        LOGOUT_AFTER_MS - INACTIVE_AFTER_MS,
      );
    };

    const resetTimer = () => {
      setIsInactive(false);
      if (statusTimer.current) clearTimeout(statusTimer.current);
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      statusTimer.current = setTimeout(markInactive, INACTIVE_AFTER_MS);
    };

    // Use capture:true so the listeners fire even if a child calls
    // stopPropagation(), and listen on document (not window) so React's
    // synthetic event system doesn't swallow anything.
    const opts = { capture: true, passive: true } as const;
    const events = [
      "mousemove",
      "mousedown",
      "click",
      "keydown",
      "keypress",
      "touchstart",
      "touchmove",
      "scroll",
      "wheel",
      "focus",
    ] as const;

    events.forEach((e) => document.addEventListener(e, resetTimer, opts));
    resetTimer(); // start the idle clock on mount

    return () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      events.forEach((e) =>
        document.removeEventListener(e, resetTimer, { capture: true }),
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — navigateRef and setIsInactive are stable refs

  const rawToken = localStorage.getItem("contentfulManagementToken") ?? "";
  const maskedToken =
    rawToken.length > 12
      ? `${rawToken.slice(0, 6)}${"·".repeat(Math.min(rawToken.length - 12, 24))}${rawToken.slice(-6)}`
      : rawToken;

  const handleOpcoChange = async (id: string) => {
    const prevOpcoId = localStorage.getItem("selectedOpco") ?? opcoId;
    const prevPartnerId = localStorage.getItem("selectedPartner") ?? partnerId;
    localStorage.setItem("selectedOpco", id);
    localStorage.removeItem("selectedPartner");
    setOpcoExpanded(false);
    setPartnerExpanded(false);
    setSidebarResetKey((k) => k + 1);
    // showFullLoading is set via the NAV_LOADING_EVENT dispatched by clientLoader.
    disableEditMode();
    // Invalidate all queries scoped to the previous OPCO/partner so stale
    // data from the old context cannot bleed into the new one.
    queryClient.invalidateQueries({ queryKey: ["opco-pages", prevOpcoId] });
    queryClient.invalidateQueries({ queryKey: ["opco-messages", prevOpcoId] });
    queryClient.invalidateQueries({ queryKey: ["opco-refs", prevOpcoId] });
    queryClient.invalidateQueries({
      queryKey: ["partner-pages", prevOpcoId, prevPartnerId],
    });
    queryClient.invalidateQueries({
      queryKey: ["partner-messages", prevOpcoId, prevPartnerId],
    });
    queryClient.invalidateQueries({
      queryKey: ["partner-emails", prevOpcoId, prevPartnerId],
    });
    queryClient.invalidateQueries({
      queryKey: ["partner-refs", prevOpcoId, prevPartnerId],
    });
    queryClient.invalidateQueries({ queryKey: ["opco-partners", prevOpcoId] });
    // Invalidate individual entries that were seeded from old-OPCO collections.
    queryClient.invalidateQueries({ queryKey: queryKeys.entries() });
    // Eagerly load partners for the new OPCO from cache (or fetch if missing).
    let newPartners = opcoPartners;
    try {
      newPartners = await getOpcoPartners(id);
    } catch {
      /* fall back to existing list */
    }
    setActivePartners(newPartners);
    // Auto-select the first available partner for the new OPCO.
    const firstPartnerId =
      resolveStringField(newPartners.items[0]?.fields["id"], firstLocale) ??
      newPartners.items[0]?.sys.id;
    if (firstPartnerId) {
      localStorage.setItem("selectedPartner", firstPartnerId);
    }
    const params = new URLSearchParams(searchParams);
    params.set("opco", id);
    if (firstPartnerId) params.set("partner", firstPartnerId);
    else params.delete("partner");
    navigate(`/environment?${params.toString()}`);
  };

  const handlePartnerChange = (id: string) => {
    localStorage.setItem("selectedPartner", id);
    setPartnerExpanded(false);
    setSidebarResetKey((k) => k + 1);
    // showFullLoading is set via the NAV_LOADING_EVENT dispatched by clientLoader.
    disableEditMode();
    const params = new URLSearchParams(searchParams);
    params.set("partner", id);
    navigate(`/environment?${params.toString()}`);
  };

  const handleEnvChange = (id: string) => {
    localStorage.setItem("contentfulEnvironment", id);
    clearCache();
    navigate(0);
  };

  const handleSpaceChange = (id: string) => {
    if (id === spaceId) return;
    localStorage.setItem("contentfulSpaceId", id);
    localStorage.removeItem("contentfulEnvironment");
    localStorage.removeItem("selectedOpco");
    localStorage.removeItem("selectedPartner");
    clearCache();
    clearContentfulManagementClient();
    queryClient.clear();
    navigate("/login");
  };

  const goToEntry = (sysId: string) => {
    if (pathname === `/entry/${sysId}`) return;
    navigate(`/entry/${sysId}`);
  };

  const handleNavigate = (path: string) => {
    if (pathname === path) return;
    navigate(path);
  };

  return (
    <ToastProvider>
      {showFullLoading && (
        <div className="fixed inset-0 z-9999">
          <LoadingScreen />
        </div>
      )}
      <div className="min-h-screen bg-gray-200 p-4">
        <div className="h-[calc(100vh-2rem)] max-w-480 mx-auto bg-gray-50 flex flex-col overflow-hidden rounded-2xl border border-gray-300/60 shadow-sm">
          <AppHeader
            spaceName={spaceName}
            spaceId={spaceId}
            spaceOptions={spaces.map((s) => ({ value: s.id, label: s.name }))}
            onSpaceChange={handleSpaceChange}
            environmentId={environmentId}
            environments={environments}
            currentUser={currentUser}
            isLoading={isLoading}
            onEnvChange={handleEnvChange}
            opcoOptions={opcos.items.map((opco: any) => ({
              value:
                resolveStringField(opco.fields["id"], firstLocale) ||
                opco.sys.id,
              label: (resolveStringField(
                opco.fields["internalName"],
                firstLocale,
              ) ||
                resolveStringField(opco.fields["title"], firstLocale) ||
                resolveStringField(opco.fields["id"], firstLocale) ||
                opco.sys.id) as string,
              imageAssetId: (
                opco.fields["logo"]?.[firstLocale] ??
                (Object.values(opco.fields["logo"] ?? {}) as any[])[0]
              )?.sys?.id as string | undefined,
            }))}
            selectedOpco={selectedOpco}
            onOpcoChange={handleOpcoChange}
            partnerOptions={activePartners.items.map((partner: any) => ({
              value:
                resolveStringField(partner.fields["id"], firstLocale) ||
                partner.sys.id,
              label: (resolveStringField(
                partner.fields["internalName"],
                firstLocale,
              ) ||
                resolveStringField(partner.fields["title"], firstLocale) ||
                resolveStringField(partner.fields["id"], firstLocale) ||
                partner.sys.id) as string,
              imageAssetId: (
                partner.fields["logo"]?.[firstLocale] ??
                (Object.values(partner.fields["logo"] ?? {}) as any[])[0]
              )?.sys?.id as string | undefined,
            }))}
            selectedPartner={selectedPartner}
            onPartnerChange={handlePartnerChange}
            firstLocale={firstLocale}
            opcos={opcos}
            allPartners={activePartners}
          />

          {/* Top progress bar */}
          {isLoading && (
            <div className="h-0.5 bg-gray-200 overflow-hidden shrink-0">
              <div
                className="h-full w-1/2 bg-blue-500"
                style={{
                  animation: "progress-slide 1.4s ease-in-out infinite",
                }}
              />
            </div>
          )}

          <div className="flex flex-1 overflow-hidden">
            <AppSidebar
              isLoading={isLoading}
              firstLocale={firstLocale}
              locales={allLocales}
              opcos={opcos}
              selectedOpco={selectedOpco}
              opcoEntrySysId={opcoEntrySysId}
              opcoPages={opcoPages}
              opcoMessages={opcoMessages}
              opcoRefGroups={opcoRefGroups}
              opcoHasLocalizable={opcoHasLocalizable}
              opcoHasMissingTranslations={opcoHasMissingTranslations}
              opcoExpanded={opcoExpanded}
              onOpcoToggle={() => setOpcoExpanded((p) => !p)}
              opcoPartners={activePartners}
              selectedPartner={selectedPartner}
              partnerEntrySysId={partnerEntrySysId}
              partnerPages={partnerPages}
              partnerMessages={partnerMessages}
              partnerEmails={partnerEmails}
              partnerRefGroups={partnerRefGroups}
              partnerHasLocalizable={partnerHasLocalizable}
              partnerHasMissingTranslations={partnerHasMissingTranslations}
              partnerExpanded={partnerExpanded}
              onPartnerToggle={() => setPartnerExpanded((p) => !p)}
              entryId={entryId}
              pathname={pathname}
              onNavigate={handleNavigate}
              onGoToEntry={goToEntry}
              isLocalizable={isLocalizable}
              resetKey={sidebarResetKey}
              groupMissingMap={groupMissingMap}
              unpublishedCount={unpublishedCount}
              scheduledCount={scheduledCount}
              onTakeTour={() => setTourOpen(true)}
            />

            {/* Main content */}
            {isLoading ? (
              <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-gray-50">
                <div
                  style={{
                    animation: "skeleton-shimmer 1.4s ease-in-out infinite",
                  }}
                >
                  <div className="mb-6">
                    <div className="h-5 w-20 bg-gray-200 rounded-full mb-3" />
                    <div className="h-6 w-64 bg-gray-200 rounded mb-2" />
                    <div className="h-3 w-40 bg-gray-200 rounded" />
                  </div>
                  <div className="flex gap-2 border-b border-gray-200 pb-2 mb-0">
                    {[82, 76, 48, 52].map((w, i) => (
                      <div
                        key={i}
                        className="h-4 bg-gray-200 rounded"
                        style={{ width: w }}
                      />
                    ))}
                  </div>
                  <div className="bg-gray-100 border border-gray-300 rounded-xl overflow-hidden">
                    <div className="flex gap-8 px-4 py-2.5 bg-gray-200 border-b border-gray-300">
                      <div className="h-3 w-24 bg-gray-300 rounded" />
                      <div className="h-3 w-32 bg-gray-300 rounded" />
                    </div>
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div
                        key={i}
                        className={`flex gap-8 px-4 py-3 ${i % 2 === 0 ? "bg-gray-100" : "bg-gray-200/50"}`}
                      >
                        <div className="h-3 w-28 bg-gray-200 rounded shrink-0" />
                        <div
                          className="h-3 bg-gray-200 rounded"
                          style={{ width: `${40 + ((i * 23) % 45)}%` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </main>
            ) : (
              <Outlet />
            )}
          </div>

          <AppFooter
            maskedToken={maskedToken}
            cacheLastUpdated={cacheLastUpdated}
            isInactive={isInactive}
          />
        </div>
      </div>
      <OnboardingTour open={tourOpen} onClose={() => setTourOpen(false)} />
    </ToastProvider>
  );
}
