import React, { createContext, useContext } from "react";
import { Platform } from "react-native";
import Purchases from "react-native-purchases";
import { useMutation, useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";

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

export function initializeRevenueCat() {
  if (_initialized) return;
  const apiKey = getRevenueCatApiKey();
  // Only log DEBUG in dev — production builds use INFO to reduce noise
  Purchases.setLogLevel(__DEV__ ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.INFO);
  Purchases.configure({ apiKey });
  _initialized = true;
  console.log(`RevenueCat initialized [${__DEV__ ? "test" : Platform.OS === "ios" ? "ios" : "android"}]`);
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
  }
}

export async function logoutRevenueCat() {
  if (!_initialized) return;
  try {
    await Purchases.logOut();
  } catch (e) {
    console.warn("RevenueCat logOut failed:", e);
  }
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
    queryFn: () => withTimeout(Purchases.getOfferings(), 20000),
    staleTime: 300 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(2000 * (attempt + 1), 8000),
    enabled: _initialized,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (packageToPurchase: any) => {
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      return customerInfo;
    },
    onSuccess: () => customerInfoQuery.refetch(),
  });

  const restoreMutation = useMutation({
    mutationFn: () => Purchases.restorePurchases(),
    onSuccess: () => customerInfoQuery.refetch(),
  });

  const isSubscribed =
    customerInfoQuery.data?.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;

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
    offeringsError: offeringsQuery.isError,
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
