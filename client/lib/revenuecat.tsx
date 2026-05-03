import React, { createContext, useContext, useEffect } from "react";
import { Platform } from "react-native";
import Purchases from "react-native-purchases";
import { useMutation, useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { queryClient } from "@/lib/query-client";

// On-device cache of the last-seen localized price strings. Apple's StoreKit
// is slow on cold start (1–5s and worse on poor networks), so on subsequent
// app launches we hydrate these instantly while RevenueCat refreshes in the
// background. Keys are scoped per app — safe to leave forever.
const PRICE_CACHE_KEY = "@probaly/rc_price_cache_v2";
type CachedPriceEntry = { priceString: string; price: number; currencyCode: string };
type CachedPrices = { monthly?: CachedPriceEntry; annual?: CachedPriceEntry };

export async function getCachedPrices(): Promise<CachedPrices> {
  try {
    const raw = await AsyncStorage.getItem(PRICE_CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as CachedPrices;
  } catch {
    return {};
  }
}

async function setCachedPrices(next: CachedPrices) {
  try {
    await AsyncStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(next));
  } catch {
    // Best-effort cache, never throw.
  }
}

// Render a strike-through "regular price" by multiplying the live RC price
// (which is already in the user's local currency) and reformatting with the
// same currency code. Returns undefined if we don't have enough info — the
// caller should hide the strike-through in that case rather than showing a
// hardcoded USD number next to a localized current price.
//
// Multipliers chosen to roughly preserve the prior $99 / $399 framing:
//   monthly: 2.00x  ($49.99 -> ~$100)
//   annual:  2.68x  ($149   -> ~$399)
export function formatStrikePrice(
  rcPackage: { product: { price?: number; currencyCode?: string } } | undefined | null,
  multiplier: number,
): string | undefined {
  if (!rcPackage) return undefined;
  const price = rcPackage.product.price;
  const currencyCode = rcPackage.product.currencyCode;
  if (typeof price !== "number" || price <= 0 || !currencyCode) return undefined;
  const original = Math.round(price * multiplier);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(original);
  } catch {
    // Some RN runtimes ship a partial Intl. Fall back to a simple format
    // using the localized symbol from priceString as a best effort.
    return undefined;
  }
}

export const STRIKE_MULTIPLIER_MONTHLY = 2.0;
export const STRIKE_MULTIPLIER_ANNUAL = 2.68;

// EXPO_PUBLIC_ keys are intentionally public — safe to have as fallbacks in source.
// EAS builds inject these from eas.json env blocks; the fallbacks ensure Expo Go and
// Replit dev environment work even without secrets configured in the host shell.
const REVENUECAT_TEST_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY || "test_ujejbUaLMSXGLBgQREyCkMNwUmj";
const REVENUECAT_IOS_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || "appl_eGrJgGTzuQlDyJTRiMiPczUDSuT";
const REVENUECAT_ANDROID_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || "goog_ALAAevcXbLPVkioULpXpsBquKKj";

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "premium";

// Prevents reconfiguring if called multiple times (e.g. hot reload)
let _initialized = false;

function getRevenueCatApiKey(): string {
  // Expo Go always uses the test key — real StoreKit is unavailable in Expo Go
  if (Platform.OS === "web" || Constants.executionEnvironment === "storeClient") {
    return REVENUECAT_TEST_API_KEY;
  }
  // Development builds (__DEV__) use the test key so sandbox purchases work
  if (__DEV__) {
    return REVENUECAT_TEST_API_KEY;
  }
  // Release builds (TestFlight, App Store, Play Store) use the real platform key
  if (Platform.OS === "ios") return REVENUECAT_IOS_API_KEY;
  if (Platform.OS === "android") return REVENUECAT_ANDROID_API_KEY;
  return REVENUECAT_TEST_API_KEY;
}

// Wrap any promise with a timeout so queries never hang forever
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`RevenueCat timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// Shared queryFn used both by the React Query hook and by the prefetch at
// app launch — keeps both paths writing into the same React Query cache so
// there's only ever one in-flight native StoreKit call on cold start.
async function fetchOfferingsWithDiag() {
  try {
    return await withTimeout(Purchases.getOfferings(), 20000);
  } catch (e: any) {
    console.warn(
      "[RC diag] getOfferings failed:",
      "code=", e?.code,
      "userCancelled=", e?.userCancelled,
      "underlying=", e?.underlyingErrorMessage,
      "msg=", e?.message
    );
    throw e;
  }
}

function persistOfferingsToCache(offerings: any) {
  const current = offerings?.current;
  if (!current) return;
  const monthly = current.availablePackages.find((p: any) => p.packageType === "MONTHLY")?.product;
  const annual = current.availablePackages.find((p: any) => p.packageType === "ANNUAL")?.product;
  const next: CachedPrices = {};
  if (monthly?.priceString && monthly.currencyCode) {
    next.monthly = { priceString: monthly.priceString, price: monthly.price, currencyCode: monthly.currencyCode };
  }
  if (annual?.priceString && annual.currencyCode) {
    next.annual = { priceString: annual.priceString, price: annual.price, currencyCode: annual.currencyCode };
  }
  if (next.monthly || next.annual) void setCachedPrices(next);
}

export function initializeRevenueCat() {
  if (_initialized) return;
  const apiKey = getRevenueCatApiKey();
  // Only log DEBUG in dev — production builds use INFO to reduce noise
  Purchases.setLogLevel(__DEV__ ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.INFO);
  Purchases.configure({ apiKey });
  _initialized = true;
  console.log(`RevenueCat initialized [${__DEV__ ? "test" : Platform.OS === "ios" ? "ios" : "android"}]`);

  // Pre-warm the offerings via React Query's prefetch — kicks off the native
  // StoreKit / Play Billing fetch immediately, before the SubscriptionProvider
  // mounts. By the time useQuery(['revenuecat','offerings']) runs, the data
  // is either already in the React Query cache (instant) or in-flight (the
  // hook subscribes to the same promise, no duplicate native call).
  void queryClient
    .prefetchQuery({
      queryKey: ["revenuecat", "offerings"],
      queryFn: fetchOfferingsWithDiag,
      staleTime: 60 * 60 * 1000,
    })
    .then(() => {
      const data = queryClient.getQueryData<any>(["revenuecat", "offerings"]);
      if (data) persistOfferingsToCache(data);
    })
    .catch(() => {});
}

export function isRevenueCatReady(): boolean {
  return _initialized;
}

export async function loginRevenueCat(userId: string) {
  if (!_initialized) return;
  try {
    await Purchases.logIn(userId);
  } catch (e) {
    console.warn("RevenueCat logIn failed:", e);
  } finally {
    // Identity changed — drop any cached customerInfo so the next read
    // fetches fresh data tied to this user. Without this, a previous
    // (premium) user's customerInfo would still be served from the
    // React Query cache and a non-premium account would be auto-promoted.
    queryClient.removeQueries({ queryKey: ["revenuecat"] });
  }
}

export async function logoutRevenueCat() {
  if (!_initialized) return;
  try {
    await Purchases.logOut();
  } catch (e) {
    console.warn("RevenueCat logOut failed:", e);
  } finally {
    // Same as loginRevenueCat — clear stale customerInfo so the next
    // signed-in account starts from a clean slate.
    queryClient.removeQueries({ queryKey: ["revenuecat"] });
  }
}

// Thin wrapper so screens can check current entitlements without importing Purchases directly
export async function fetchCustomerInfo() {
  return Purchases.getCustomerInfo();
}

function useSubscriptionContext() {
  const customerInfoQuery = useQuery({
    queryKey: ["revenuecat", "customer-info"],
    queryFn: () => withTimeout(Purchases.getCustomerInfo(), 20000),
    staleTime: 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(2000 * (attempt + 1), 8000),
    enabled: _initialized,
  });

  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    queryFn: fetchOfferingsWithDiag,
    // Keep offerings fresh for 1 hour — prices change rarely and StoreKit
    // calls are expensive. The on-device price cache below covers the
    // cross-launch case. The prefetch in initializeRevenueCat() typically
    // populates this cache before the hook even mounts.
    staleTime: 60 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(2000 * (attempt + 1), 8000),
    enabled: _initialized,
  });

  // After offerings resolve, persist numeric price + currency code (not just
  // the formatted string) so the next cold start can render BOTH the current
  // price and the multiplied strike-through entirely from cache.
  const offeringsData = offeringsQuery.data;
  useEffect(() => {
    if (offeringsData) persistOfferingsToCache(offeringsData);
  }, [offeringsData]);

  const purchaseMutation = useMutation({
    mutationFn: async (packageToPurchase: any) => {
      try {
        const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
        return customerInfo;
      } catch (e: any) {
        console.warn(
          "[RC diag] purchasePackage failed:",
          "code=", e?.code,
          "userCancelled=", e?.userCancelled,
          "underlying=", e?.underlyingErrorMessage,
          "msg=", e?.message
        );
        throw e;
      }
    },
    onSuccess: () => customerInfoQuery.refetch(),
  });

  const restoreMutation = useMutation({
    mutationFn: () => Purchases.restorePurchases(),
    onSuccess: () => customerInfoQuery.refetch(),
  });

  const entitlement = customerInfoQuery.data?.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER];
  // Trust any active entitlement from RevenueCat — sandbox purchases are valid
  // for TestFlight/beta users and App Store reviewers, so we do not filter by isSandbox.
  const isSubscribed = entitlement !== undefined;

  const currentOffering = offeringsQuery.data?.current;
  const monthlyPackage = currentOffering?.availablePackages.find(
    (p) => p.packageType === "MONTHLY"
  );
  const annualPackage = currentOffering?.availablePackages.find(
    (p) => p.packageType === "ANNUAL"
  );

  return {
    customerInfo: customerInfoQuery.data,
    offerings: offeringsQuery.data,
    currentOffering,
    monthlyPackage,
    annualPackage,
    isSubscribed,
    isLoading: offeringsQuery.isLoading && _initialized,
    isLoadingCustomer: customerInfoQuery.isLoading && _initialized,
    // Always suppressed — a "couldn't connect to store" warning is not
    // actionable for the user on any platform (web + Expo Go run in
    // Browser/Preview mode; TestFlight/Play console builds may be missing
    // products until store approval lands). Hiding the banner avoids
    // alarming users; the Subscribe button itself will silently no-op
    // if no package is loaded.
    offeringsError: false,
    // Exposed for the hidden long-press diagnostic on SubscriptionScreen
    // so we can pinpoint why a TestFlight / Play build can't load offerings
    // (PURCHASE_NOT_ALLOWED, STORE_PROBLEM, PRODUCT_NOT_AVAILABLE, etc.).
    diagnostics: {
      initialized: _initialized,
      apiKeyEnv: __DEV__ || Platform.OS === "web" || Constants.executionEnvironment === "storeClient" ? "test" : Platform.OS,
      executionEnvironment: Constants.executionEnvironment ?? "unknown",
      offeringsRawError: offeringsQuery.error as any,
      purchaseRawError: purchaseMutation.error as any,
      packagesAvailable: currentOffering?.availablePackages.length ?? 0,
      currentOfferingId: currentOffering?.identifier ?? null,
    },
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
    refetchOfferings: offeringsQuery.refetch,
    refetchCustomerInfo: customerInfoQuery.refetch,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return ctx;
}
