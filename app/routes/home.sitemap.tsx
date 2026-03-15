import { useState } from "react";
import { useRouteLoaderData } from "react-router";
import { resolveStringField } from "~/lib/resolve-string-field";
import { SitemapSection } from "~/components/overview/SitemapSection";

export default function SitemapPage() {
  const loaderData = useRouteLoaderData("routes/home") as any;
  if (!loaderData) return null;

  const {
    opcos,
    opcoId,
    partnerId,
    opcoPartners,
    opcoPages,
    locales,
    spaceId,
    environmentId,
  } = loaderData;

  const firstLocale = locales.items[0]?.code ?? "en";

  const opcoEntry = opcos.items.find(
    (o: any) => resolveStringField(o.fields["id"], firstLocale) === opcoId,
  );
  const opcoName: string =
    resolveStringField(opcoEntry?.fields?.["internalName"], firstLocale) ||
    resolveStringField(opcoEntry?.fields?.["title"], firstLocale) ||
    opcoId;

  const partnerCount = opcoPartners.items.length;
  const [search, setSearch] = useState("");

  return (
    <main className="flex-1 overflow-y-auto p-6 sm:p-8 bg-gray-50">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <p className="text-xs font-bold text-sky-600 uppercase tracking-widest mb-1">
            Sitemap
          </p>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">
            Sitemap
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Pages eligible for the sitemap across{" "}
            <span className="font-semibold">{opcoName}</span> and {partnerCount}{" "}
            partner{partnerCount !== 1 ? "s" : ""}.
          </p>
        </div>
        <input
          type="text"
          placeholder="Search by name or slug…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
        />
      </div>

      <SitemapSection
        opcoName={opcoName}
        opcoPages={opcoPages}
        opcoPartners={opcoPartners}
        firstLocale={firstLocale}
        spaceId={spaceId}
        environmentId={environmentId}
        opcoId={opcoId}
        partnerId={partnerId}
        search={search}
      />
    </main>
  );
}
