import { getContentfulManagementClient } from ".";
import { queryClient, QUERY_STALE_TIME } from "~/lib/query-client";
import { queryKeys } from "~/lib/query-keys";

export const getLocales = () =>
  queryClient.ensureQueryData({
    queryKey: queryKeys.locales(),
    queryFn: async () => {
      const client = getContentfulManagementClient();
      const space = await client.getSpace(
        import.meta.env.VITE_CONTENTFUL_SPACE_ID,
      );
      const environment = await space.getEnvironment(
        import.meta.env.VITE_CONTENTFUL_ENVIRONMENT,
      );
      return environment.getLocales();
    },
    staleTime: QUERY_STALE_TIME,
  });
