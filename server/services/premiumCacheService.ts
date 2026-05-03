// In-memory "recently activated premium" cache. Eliminates the 3–6s of
// post-purchase backend stalling for users who just bought a subscription.
//
// Why this exists:
// When a user completes an Apple/Google in-app purchase, three things race:
//   1. The mobile app POSTs /api/revenuecat/sync to mark the user premium.
//   2. RevenueCat fires a webhook to /api/revenuecat/webhook (independent).
//   3. The mobile app polls /api/subscription/:userId waiting for premium=true.
//
// Both (1) and (3) used to make blocking calls to RevenueCat's REST API
// (~500ms–2s each, plus a 4s timeout fallback). For a freshly-paying user
// that's 3–6s of pure backend stall before the UI flips, even though Apple
// has already confirmed the payment.
//
// This cache fixes that: webhook AND sync write the activation here the
// moment they confirm it, and /api/subscription reads from here first.
// If we activated this user in the last 60 seconds, we serve instantly
// without touching RevenueCat at all. The DB write still happens on the
// hot path (so durability is preserved), but the read path is short-circuited
// for the brief window where the client is polling right after purchase.
//
// Memory cost: ~100 bytes per active subscriber, evicted after 60s of
// inactivity. At 10k concurrent purchasers this is ~1MB. Negligible.

interface CachedActivation {
  isPremium: boolean;
  expiry: Date | null;
  activatedAt: number; // ms epoch — when WE wrote the cache (used for TTL eviction)
  eventAt: number;     // ms epoch — the source event's timestamp (used for ordering)
}

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map<string, CachedActivation>();

// Periodic eviction so the map doesn't grow unbounded for one-off lookups.
// 5-minute sweep is fine — entries are stale-but-harmless until evicted.
setInterval(() => {
  const cutoff = Date.now() - CACHE_TTL_MS;
  for (const [userId, entry] of cache.entries()) {
    if (entry.activatedAt < cutoff) cache.delete(userId);
  }
}, 5 * 60 * 1000).unref?.();

// Internal write helper: refuses to overwrite a newer entry. Protects against
// out-of-order events — e.g. a delayed INITIAL_PURCHASE webhook arriving
// AFTER a CANCELLATION must not flip the user back to premium.
function writeIfNewer(userId: string, next: CachedActivation): void {
  const existing = cache.get(userId);
  if (existing && existing.eventAt >= next.eventAt) return;
  cache.set(userId, next);
}

// `eventAt` is the source-of-truth timestamp:
//   - Webhooks pass `event.event_timestamp_ms` from the RC payload
//   - Client /sync uses Date.now() (no upstream event timestamp available)
// If omitted, defaults to Date.now().
export function setPremiumActivated(userId: string, expiry: Date | null, eventAt?: number): void {
  writeIfNewer(userId, {
    isPremium: true,
    expiry,
    activatedAt: Date.now(),
    eventAt: eventAt ?? Date.now(),
  });
}

export function setPremiumDeactivated(userId: string, eventAt?: number): void {
  writeIfNewer(userId, {
    isPremium: false,
    expiry: null,
    activatedAt: Date.now(),
    eventAt: eventAt ?? Date.now(),
  });
}

// Returns the cached entry if it was written within CACHE_TTL_MS, else null.
// Callers should treat null as "no fast-path available, fall back to DB/RC".
// Note: returns BOTH premium=true and premium=false entries — callers decide
// what to do. /api/subscription only short-circuits on premium=true; a recent
// deactivation should still go through the normal DB read path.
export function getCachedPremium(userId: string): CachedActivation | null {
  const entry = cache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.activatedAt > CACHE_TTL_MS) {
    cache.delete(userId);
    return null;
  }
  return entry;
}

// Drop a user's cache entry, e.g. on logout or explicit refresh request.
export function invalidateCachedPremium(userId: string): void {
  cache.delete(userId);
}
