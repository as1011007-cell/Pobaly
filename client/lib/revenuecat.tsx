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
  // Use test store in development, Expo Go, or web
  if (__DEV__ || Platform.OS === "web" || Constants.executionEnvironment === "storeClient") {
    return REVENUECAT_TEST_API_KEY || null;
  }

  if (Platform.OS === "ios" && REVENUECAT_IOS_API_KEY) {
    return REVENUECAT_IOS_API_KEY;
  }

  if (Platform.OS === "android" && REVENUECAT_ANDROID_API_KEY) {
    return REVENUECAT_ANDROID_API_KEY;
  }

  // Fallback to test key if production keys aren't configured
  return REVENUECAT_TEST_API_KEY || null;
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
    queryFn: async () => {
      return await Purchases.getCustomerInfo();
    },
    staleTime: 60 * 1000,
  });

  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    queryFn: async () => {
      return await Purchases.getOfferings();
    },
    staleTime: 300 * 1000,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (packageToPurchase: any) => {
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      return customerInfo;
    },
    onSuccess: () => customerInfoQuery.refetch(),
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      return Purchases.restorePurchases();
    },
    onSuccess: () => customerInfoQuery.refetch(),
  });

  const isSubscribed =
    customerInfoQuery.data?.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;

  // Monthly and yearly packages from current offering
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
    isLoading: customerInfoQuery.isLoading || offeringsQuery.isLoading,
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
    purchaseError: purchaseMutation.error,
    restoreError: restoreMutation.error,
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
