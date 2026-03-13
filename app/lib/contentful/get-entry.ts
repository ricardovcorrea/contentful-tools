import { getContentfulManagementEnvironment } from ".";
import { withCache, invalidateCacheKey } from "./cache";

export const ENTRY_CACHE_KEY = (entryId: string) => `entry:${entryId}`;

export const getEntry = (entryId: string) =>
  withCache(ENTRY_CACHE_KEY(entryId), async () => {
    const environment = await getContentfulManagementEnvironment();
    return environment.getEntry(entryId);
  });

/** Drop a single entry from cache so the next getEntry call fetches fresh data. */
export function invalidateEntry(entryId: string): void {
  invalidateCacheKey(ENTRY_CACHE_KEY(entryId));
}
