import { getContentfulManagementClient } from ".";
import { queryClient, QUERY_STALE_TIME } from "~/lib/query-client";
import { queryKeys } from "~/lib/query-keys";

export const getCurrentUser = () =>
  queryClient.ensureQueryData({
    queryKey: queryKeys.currentUser(),
    queryFn: () => getContentfulManagementClient().getCurrentUser(),
    staleTime: QUERY_STALE_TIME,
  });
