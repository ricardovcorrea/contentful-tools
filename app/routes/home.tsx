import { getOpcoPartnerPages } from "~/lib/contentful/get-opco-partner-pages";
import { getEntryTree, type RefGroup } from "~/lib/contentful/get-entry-tree";
import type { Route } from "./+types/home";
import { useState, useEffect } from "react";
import { AppHeader } from "~/components/layout/AppHeader";
import { AppSidebar } from "~/components/layout/AppSidebar";
import { AppFooter } from "~/components/layout/AppFooter";
import {
  Outlet,
  useNavigate,
  useNavigation,
  useParams,
  useSearchParams,
  useLocation,
  useRouteError,
  redirect,
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
  withCache,
  clearCache,
  getCacheLastUpdated,
  CACHE_TTL_MS,
} from "~/lib/contentful/cache";
import { getLocales } from "~/lib/contentful/get-locales";
import { getCurrentUser } from "~/lib/contentful/get-current-user";
import { getContentType } from "~/lib/contentful/get-content-type";

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

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const token = localStorage.getItem("contentfulManagementToken");
  const spaceId = localStorage.getItem("contentfulSpaceId");
  const environment = localStorage.getItem("contentfulEnvironment");

  if (!token || !spaceId || !environment) {
    return redirect("/login");
  }

  const url = new URL(request.url);

  const client = getContentfulManagementClient();

  let opcos: any, locales: any, currentUser: any, spaceObj: any;
  try {
    [opcos, locales, currentUser, spaceObj] = await Promise.all([
      getOpcos(),
      getLocales(),
      getCurrentUser(),
      withCache(`space:${spaceId}`, () => client.getSpace(spaceId)),
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
  let envObj: any, environmentsList: any;
  try {
    [envObj, environmentsList] = await Promise.all([
      withCache(`env:${spaceId}:${environment}`, () =>
        spaceObj.getEnvironment(environment),
      ),
      withCache(`environments:${spaceId}`, () => spaceObj.getEnvironments()),
    ]);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    throw new Error(`Failed to load environment "${environment}": ${msg}`);
  }
  const environmentName = envObj.name;
  const environments = environmentsList.items.map((e: any) => ({
    id: e.sys.id,
    name: e.name,
  }));

  const firstLocale = locales.items[0]?.code ?? "en";

  const getOpcoFieldId = (opco: any) =>
    opco.fields["id"]?.[firstLocale] ?? opco.fields["id"] ?? "";
  const getOpcoName = (opco: any) =>
    opco.fields["internalName"]?.[firstLocale] ??
    opco.fields["title"]?.[firstLocale] ??
    "";

  const baOpco = opcos.items.find((o: any) =>
    getOpcoName(o).toLowerCase().includes("british airways"),
  );
  const defaultOpcoId = baOpco
    ? getOpcoFieldId(baOpco)
    : (getOpcoFieldId(opcos.items[0]) ?? "");

  const opcoId =
    url.searchParams.get("opco") ??
    localStorage.getItem("selectedOpco") ??
    defaultOpcoId;

  let opcoPartners: any;
  try {
    opcoPartners = await getOpcoPartners(opcoId);
  } catch (e: any) {
    throw new Error(
      `Failed to load partners for OPCO "${opcoId}": ${e?.message ?? e}`,
    );
  }

  const firstPartnerId =
    opcoPartners.items[0]?.fields["id"]?.[firstLocale] ??
    opcoPartners.items[0]?.fields["id"] ??
    "";
  const partnerId =
    url.searchParams.get("partner") ??
    localStorage.getItem("selectedPartner") ??
    firstPartnerId;

  // Persist resolved values
  localStorage.setItem("selectedOpco", opcoId);
  localStorage.setItem("selectedPartner", partnerId);

  let opcoPages: any,
    opcoMessages: any,
    partnerPages: any,
    partnerMessages: any,
    partnerEmails: any;
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

  const [opcoRefGroups, partnerRefGroups] = await Promise.all([
    opcoPageIds.length > 0
      ? getEntryTree(opcoPageIds, opcoRootCTIds, `opco-refs:${opcoId}`)
      : Promise.resolve([] as RefGroup[]),
    partnerPageIds.length > 0
      ? getEntryTree(
          partnerPageIds,
          partnerRootCTIds,
          `partner-refs:${opcoId}:${partnerId}`,
        )
      : Promise.resolve([] as RefGroup[]),
  ]);

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
          hasLocalizable: ct.fields.some((f) => f.localized),
        }))
        .catch(() => ({ id, hasLocalizable: false })),
    ),
  );
  const localizableContentTypes: string[] = ctResults
    .filter((r) => r.hasLocalizable)
    .map((r) => r.id);

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
    locales,
    currentUser,
    spaceId,
    spaceName,
    environmentId: environment,
    environmentName,
    environments,
    localizableContentTypes,
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

  // Clear all auth credentials immediately whenever this boundary renders.
  useEffect(() => {
    localStorage.removeItem("contentfulManagementToken");
    localStorage.removeItem("contentfulSpaceId");
    localStorage.removeItem("contentfulEnvironment");
    localStorage.removeItem("selectedOpco");
    localStorage.removeItem("selectedPartner");
    clearContentfulManagementClient();
  }, []);

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
            <p className="text-sm font-semibold text-red-700">Loading failed</p>
            <p className="text-xs text-red-500 mt-0.5">
              Your credentials have been cleared.
            </p>
          </div>
        </div>

        {/* Error detail */}
        <div className="px-6 py-5 flex flex-col gap-5">
          <p className="text-sm text-gray-700 leading-relaxed wrap-break-word">
            {message}
          </p>

          <button
            onClick={() => navigate("/login", { replace: true })}
            className="w-full rounded-lg bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-sm font-semibold py-3 transition-colors"
          >
            Sign in again
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
    currentUser,
    spaceId,
    spaceName,
    environmentId,
    environments,
    localizableContentTypes,
    cacheLastUpdated,
  } = loaderData;

  const firstLocale = locales.items[0]?.code ?? "en";

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

  const navigate = useNavigate();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const { entryId } = useParams();
  const isLoading = navigation.state === "loading";
  const selectedOpco = searchParams.get("opco") ?? opcoId;
  const selectedPartner = searchParams.get("partner") ?? partnerId;
  const { pathname } = useLocation();

  const opcoEntrySysId = opcos.items.find(
    (o: any) =>
      (o.fields["id"]?.[firstLocale] ?? o.fields["id"]) === selectedOpco,
  )?.sys.id;
  const partnerEntrySysId = opcoPartners.items.find(
    (p: any) =>
      (p.fields["id"]?.[firstLocale] ?? p.fields["id"]) === selectedPartner,
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

  useEffect(() => {
    if (shouldExpandOpco) setOpcoExpanded(true);
  }, [shouldExpandOpco]);
  useEffect(() => {
    if (shouldExpandPartner) setPartnerExpanded(true);
  }, [shouldExpandPartner]);

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

  const rawToken = localStorage.getItem("contentfulManagementToken") ?? "";
  const maskedToken =
    rawToken.length > 12
      ? `${rawToken.slice(0, 6)}${"·".repeat(Math.min(rawToken.length - 12, 24))}${rawToken.slice(-6)}`
      : rawToken;

  const handleOpcoChange = (id: string) => {
    localStorage.setItem("selectedOpco", id);
    localStorage.removeItem("selectedPartner");
    const params = new URLSearchParams(searchParams);
    params.set("opco", id);
    params.delete("partner");
    navigate(`/overview/opco?${params.toString()}`);
  };

  const handlePartnerChange = (id: string) => {
    localStorage.setItem("selectedPartner", id);
    const params = new URLSearchParams(searchParams);
    params.set("partner", id);
    navigate(`/overview/opco?${params.toString()}`);
  };

  const handleEnvChange = (id: string) => {
    localStorage.setItem("contentfulEnvironment", id);
    clearCache();
    navigate(0);
  };

  const goToEntry = (sysId: string) => {
    navigate(`/entry/${sysId}`);
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <AppHeader
        spaceName={spaceName}
        spaceId={spaceId}
        environmentId={environmentId}
        environments={environments}
        currentUser={currentUser}
        isLoading={isLoading}
        onEnvChange={handleEnvChange}
      />

      {/* Top progress bar */}
      {isLoading && (
        <div className="h-0.5 bg-gray-200 overflow-hidden shrink-0">
          <div
            className="h-full w-1/2 bg-blue-500"
            style={{ animation: "progress-slide 1.4s ease-in-out infinite" }}
          />
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar
          isLoading={isLoading}
          firstLocale={firstLocale}
          opcos={opcos}
          selectedOpco={selectedOpco}
          opcoEntrySysId={opcoEntrySysId}
          opcoPages={opcoPages}
          opcoMessages={opcoMessages}
          opcoRefGroups={opcoRefGroups}
          opcoHasLocalizable={opcoHasLocalizable}
          opcoExpanded={opcoExpanded}
          onOpcoToggle={() => setOpcoExpanded((p) => !p)}
          onOpcoChange={handleOpcoChange}
          opcoPartners={opcoPartners}
          selectedPartner={selectedPartner}
          partnerEntrySysId={partnerEntrySysId}
          partnerPages={partnerPages}
          partnerMessages={partnerMessages}
          partnerEmails={partnerEmails}
          partnerRefGroups={partnerRefGroups}
          partnerHasLocalizable={partnerHasLocalizable}
          partnerExpanded={partnerExpanded}
          onPartnerToggle={() => setPartnerExpanded((p) => !p)}
          onPartnerChange={handlePartnerChange}
          entryId={entryId}
          pathname={pathname}
          onNavigate={navigate}
          onGoToEntry={goToEntry}
          isLocalizable={isLocalizable}
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
        isLoading={isLoading}
        onRefreshCache={() => {
          clearCache();
          navigate(0);
        }}
        cacheTtlMs={CACHE_TTL_MS}
      />
    </div>
  );
}
