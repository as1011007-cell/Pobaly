import React, { createContext, useContext } from "react";
import { Platform } from "react-native";
import Purchases from "react-native-purchases";
import { useMutation, useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "premium";

function getRevenueCatApiKey(): string | null {
  if (__DEV__ || Platform.OS === "web" || Constants.executionEnvironment === "storeClient") {
    return REVENUECAT_TEST_API_KEY || null;
  }
  if (Platform.OS === "ios" && REVENUECAT_IOS_API_KEY) return REVENUECAT_IOS_API_KEY;
  if (Platform.OS === "android" && REVENUECAT_ANDROID_API_KEY) return REVENUECAT_ANDROID_API_KEY;
  return REVENUECAT_TEST_API_KEY || null;
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

export function initializeRevenueCat(userId?: string) {
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    console.warn("RevenueCat: No API key configured — subscriptions will not work");
    return;
  }
  Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey });
  if (userId) {
    Purchases.logIn(userId).catch(console.error);
  }
  console.log("RevenueCat initialized");
}

function useSubscriptionContext() {
  const customerInfoQuery = useQuery({
    queryKey: ["revenuecat", "customer-info"],
    queryFn: () => withTimeout(Purchases.getCustomerInfo(), 8000),
    staleTime: 60 * 1000,
    retry: 1,
    retryDelay: 2000,
  });

  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    queryFn: () => withTimeout(Purchases.getOfferings(), 20000),
    staleTime: 300 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(2000 * (attempt + 1), 8000),
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

  // Only block the UI on offerings loading — customer info loads in the background
  const isLoadingOfferings = offeringsQuery.isLoading;
  const isLoadingCustomer = customerInfoQuery.isLoading;
  const offeringsError = offeringsQuery.isError;

  return {
    customerInfo: customerInfoQuery.data,
    offerings: offeringsQuery.data,
    currentOffering,
    monthlyPackage,
    annualPackage,
    isSubscribed,
    isLoading: isLoadingOfferings,
    isLoadingCustomer,
    offeringsError,
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
    purchaseError: purchaseMutation.error,
    restoreError: restoreMutation.error,
    refetchOfferings: offeringsQuery.refetch,
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
