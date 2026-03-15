import { getContentfulManagementEntries } from ".";
import { queryClient, QUERY_STALE_TIME } from "~/lib/query-client";
import { queryKeys } from "~/lib/query-keys";

export const getOpcoPartners = (opcoId: string) =>
  queryClient.ensureQueryData({
    queryKey: queryKeys.opcoPartners(opcoId),
    queryFn: () =>
      getContentfulManagementEntries({
        content_type: "partner",
        "fields.opco.fields.id": opcoId.toLowerCase(),
        "fields.opco.sys.contentType.sys.id": "opco",
      }),
    staleTime: QUERY_STALE_TIME,
  });
