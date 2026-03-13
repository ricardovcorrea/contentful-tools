export const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

const LS_PREFIX = "cf_cache:";
const LS_UPDATED_KEY = "cf_cache_updated_at";

// These keys hold live Contentful SDK objects with methods — keep in-memory only.
const IN_MEMORY_ONLY: readonly string[] = [
  "space:",
  "env:",
  "environments:",
  "management-environment",
];
const isMemoryOnly = (key: string) =>
  IN_MEMORY_ONLY.some((p) => key.startsWith(p));

type CacheEntry<T> = { value: T; expiresAt: number };

// In-memory store — primary fast-path, holds all values including SDK objects.
const store = new Map<string, CacheEntry<unknown>>();
// In-flight promises — prevents thundering herd.
const inFlight = new Map<string, Promise<unknown>>();

// ── localStorage helpers ──────────────────────────────────────────────────

function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(LS_PREFIX + key);
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

function lsSet<T>(key: string, value: T, expiresAt: number): void {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify({ value, expiresAt }));
    localStorage.setItem(LS_UPDATED_KEY, String(Date.now()));
  } catch {
    // Quota exceeded or serialisation failure — silently skip persistence.
  }
}

function lsClear(): void {
  try {
    const toDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LS_PREFIX)) toDelete.push(k);
    }
    toDelete.forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem(LS_UPDATED_KEY);
  } catch {
    // ignore
  }
}

// ── In-memory helpers ─────────────────────────────────────────────────────

function memGet<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function memSet<T>(key: string, value: T, expiresAt: number): void {
  store.set(key, { value, expiresAt });
}

// ── Public API ────────────────────────────────────────────────────────────

export function withCache<T>(key: string, fn: () => Promise<T>): Promise<T> {
  // 1. In-memory hit
  const mem = memGet<T>(key);
  if (mem !== null) return Promise.resolve(mem);

  // 2. localStorage hit (restored into memory for this session)
  if (!isMemoryOnly(key)) {
    const persisted = lsGet<T>(key);
    if (persisted !== null) {
      const expiresAt = Date.now() + CACHE_TTL_MS; // re-anchor TTL to now
      memSet(key, persisted, expiresAt);
      return Promise.resolve(persisted);
    }
  }

  // 3. In-flight dedup
  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  // 4. Fetch, persist, settle
  const promise = fn().then(
    (result) => {
      const expiresAt = Date.now() + CACHE_TTL_MS;
      memSet(key, result, expiresAt);
      if (!isMemoryOnly(key)) lsSet(key, result, expiresAt);
      inFlight.delete(key);
      return result;
    },
    (err) => {
      inFlight.delete(key);
      throw err;
    },
  );

  inFlight.set(key, promise);
  return promise;
}

export function clearCache(): void {
  store.clear();
  lsClear();
  // Leave in-flight requests running — they'll repopulate the fresh store.
}

/** Remove a single cache entry by key from both memory and localStorage. */
export function invalidateCacheKey(key: string): void {
  store.delete(key);
  inFlight.delete(key);
  try {
    localStorage.removeItem(LS_PREFIX + key);
  } catch {
    // ignore
  }
}

/** Returns the Unix timestamp (ms) of the last cache write, or null. */
export function getCacheLastUpdated(): number | null {
  try {
    const raw = localStorage.getItem(LS_UPDATED_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}
