import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { persistQueryClient } from "@tanstack/react-query-persist-client";

export const QUERY_STALE_TIME = 5 * 60 * 1000; // 5 min
const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Query keys whose values are live Contentful SDK objects (contain methods)
 * and therefore cannot be JSON-serialised into localStorage.
 */
const SDK_QUERY_KEYS = new Set([
  "management-environment",
  "space",
  "spaces",
  "env-obj",
]);

/**
 * Shared QueryClient instance.
 *
 * gcTime is set to match PERSIST_MAX_AGE so in-memory GC never kicks out data
 * before the persisted copy would expire.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_STALE_TIME,
      gcTime: PERSIST_MAX_AGE,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Persister only runs in the browser (localStorage is unavailable during SSR).
if (typeof window !== "undefined") {
  const persister = createSyncStoragePersister({
    storage: window.localStorage,
    key: "rq-cache",
  });

  persistQueryClient({
    queryClient,
    persister,
    maxAge: PERSIST_MAX_AGE,
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => {
        const rootKey = query.queryKey[0] as string;
        return !SDK_QUERY_KEYS.has(rootKey);
      },
    },
  });
}
