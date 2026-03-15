import { getContentfulManagementEnvironment } from ".";
import { queryClient, QUERY_STALE_TIME } from "~/lib/query-client";
import { queryKeys } from "~/lib/query-keys";

export const getContentType = (contentTypeId: string) =>
  queryClient.ensureQueryData({
    queryKey: queryKeys.contentType(contentTypeId),
    queryFn: async () => {
      const environment = await getContentfulManagementEnvironment();
      return environment.getContentType(contentTypeId);
    },
    staleTime: QUERY_STALE_TIME,
  });
