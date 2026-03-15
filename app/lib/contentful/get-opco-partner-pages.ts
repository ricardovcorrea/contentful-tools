import { getContentfulManagementEntries } from ".";
import { queryClient, QUERY_STALE_TIME } from "~/lib/query-client";
import { queryKeys } from "~/lib/query-keys";

export const getOpcoPartnerPages = (opcoId: string, partnerId: string) =>
  queryClient.ensureQueryData({
    queryKey: queryKeys.partnerPages(opcoId, partnerId),
    queryFn: () =>
      getContentfulManagementEntries({
        content_type: "page",
        "fields.opco.fields.id": opcoId.toLowerCase(),
        "fields.opco.sys.contentType.sys.id": "opco",
        "fields.partner.fields.id": partnerId.toLowerCase(),
        "fields.partner.sys.contentType.sys.id": "partner",
      }),
    staleTime: QUERY_STALE_TIME,
  });
