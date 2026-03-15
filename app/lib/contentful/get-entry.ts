import { useQuery } from "@tanstack/react-query";
import { useRouteLoaderData } from "react-router";
import { getContentfulManagementEnvironment } from ".";
import { queryKeys } from "~/lib/query-keys";

/** Raw async fetcher — still used by the loader and mutations. */
export const getEntry = (entryId: string): Promise<any> =>
  getContentfulManagementEnvironment().then((env) => env.getEntry(entryId));

/**
 * React hook — reads from the TanStack Query cache (or fetches on miss).
 * The query key is automatically scoped to the current OPCO + partner so
 * data from different contexts never cross-contaminates.
 */
export function useEntry(entryId: string | null | undefined) {
  const routeData = useRouteLoaderData("routes/home") as
    | { opcoId?: string; partnerId?: string }
    | undefined;
  const opcoId = routeData?.opcoId ?? "";
  const partnerId = routeData?.partnerId ?? "";

  return useQuery({
    queryKey: queryKeys.entry(entryId ?? "", opcoId, partnerId),
    queryFn: () => getEntry(entryId!),
    enabled: !!entryId,
  });
}

/**
 * Invalidates a cached entry for the given opco/partner scope.
 * Pass the same opcoId/partnerId that was used when the entry was cached.
 */
export function invalidateEntry(
  entryId: string,
  opcoId = "",
  partnerId = "",
): void {
  // Dynamic import avoids a circular dependency at module-init time.
  import("~/lib/query-client").then(({ queryClient }) => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.entry(entryId, opcoId, partnerId),
    });
  });
}
