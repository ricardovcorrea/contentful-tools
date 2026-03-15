import { getContentfulManagementEntries } from ".";
import { queryClient, QUERY_STALE_TIME } from "~/lib/query-client";
import { queryKeys } from "~/lib/query-keys";

/** Returns every partner entry across all OPCOs. */
export const getAllPartners = () =>
  queryClient.ensureQueryData({
    queryKey: queryKeys.allPartners(),
    queryFn: () => getContentfulManagementEntries({ content_type: "partner" }),
    staleTime: QUERY_STALE_TIME,
  });
