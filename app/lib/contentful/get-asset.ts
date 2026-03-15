import { useQuery } from "@tanstack/react-query";
import { getContentfulManagementEnvironment } from ".";
import { queryKeys } from "~/lib/query-keys";

/** Raw async fetcher. */
export const getAsset = (assetId: string): Promise<any> =>
  getContentfulManagementEnvironment().then((env) => env.getAsset(assetId));

/** React hook — reads from the TanStack Query cache (or fetches on miss). */
export function useAsset(assetId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.asset(assetId ?? ""),
    queryFn: () => getAsset(assetId!),
    enabled: !!assetId,
  });
}
