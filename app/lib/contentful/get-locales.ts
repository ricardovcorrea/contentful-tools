import { getContentfulManagementClient } from ".";
import { queryClient, QUERY_STALE_TIME } from "~/lib/query-client";
import { queryKeys } from "~/lib/query-keys";

export const getLocales = () =>
  queryClient.ensureQueryData({
    queryKey: queryKeys.locales(),
    queryFn: async () => {
      const spaceId = localStorage.getItem("contentfulSpaceId");
      const environmentId = localStorage.getItem("contentfulEnvironment");
      if (!spaceId) throw new Error("No space selected");
      if (!environmentId) throw new Error("No environment selected");

      const client = getContentfulManagementClient();
      const space = await client.getSpace(spaceId);
      const environment = await space.getEnvironment(environmentId);
      return environment.getLocales();
    },
    staleTime: QUERY_STALE_TIME,
  });
