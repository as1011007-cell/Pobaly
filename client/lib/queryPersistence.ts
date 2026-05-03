import AsyncStorage from "@react-native-async-storage/async-storage";
import { dehydrate, hydrate } from "@tanstack/react-query";
import { queryClient } from "./query-client";

// Versioned key — bump suffix to invalidate old persisted caches on schema changes.
const CACHE_KEY = "@probaly/rq_v1";

// Discard persisted cache after 12 hours. Predictions refresh daily at midnight,
// so 12h is conservative enough to never show badly stale content.
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

/**
 * Restores the React Query cache from AsyncStorage.
 * Call this ONCE at app startup, before any screens render. This makes cold
 * opens show previously-fetched data instantly (stale-while-revalidate), rather
 * than showing spinners while the network is fetched fresh.
 *
 * Fast: a single AsyncStorage read takes < 20 ms, which is always shorter than
 * the font-loading step (~100–300 ms) that also runs at startup. No extra
 * perceived latency is added.
 */
export async function restoreQueryCache(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const { d: dehydratedState, t: savedAt } = JSON.parse(raw);
    if (Date.now() - savedAt > MAX_AGE_MS) {
      AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
      return;
    }
    hydrate(queryClient, dehydratedState);
  } catch {
    // Corrupt / incompatible cache — delete and start fresh.
    AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
  }
}

let _saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Schedules a debounced cache save. Call this from a QueryCache subscriber so
 * the cache is written to AsyncStorage shortly after each successful fetch.
 * Debouncing (1.5 s) prevents hammering AsyncStorage when multiple queries
 * resolve in a burst (e.g. on the Home screen where free-tip + premium both
 * complete within milliseconds of each other).
 */
export function debouncedCacheSave(): void {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    try {
      const state = dehydrate(queryClient, {
        // Only persist queries that successfully resolved — never cache errors
        // or loading states.
        shouldDehydrateQuery: (query) => query.state.status === "success",
      });
      AsyncStorage.setItem(
        CACHE_KEY,
        // Short keys 'd' and 't' reduce the serialized payload size.
        JSON.stringify({ d: state, t: Date.now() }),
      ).catch(() => {});
    } catch {
      // Non-fatal — next successful query will retry the save.
    }
  }, 1500);
}
