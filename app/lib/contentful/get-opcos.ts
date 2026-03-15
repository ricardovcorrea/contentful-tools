import { getContentfulManagementEntries } from ".";
import { queryClient, QUERY_STALE_TIME } from "~/lib/query-client";
import { queryKeys } from "~/lib/query-keys";

export const getOpcos = () =>
  queryClient.fetchQuery({
    queryKey: queryKeys.opcos(),
    queryFn: () => getContentfulManagementEntries({ content_type: "opco" }),
    staleTime: QUERY_STALE_TIME,
  });
