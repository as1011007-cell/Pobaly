import React, { createContext, useContext, useState, useEffect } from "react";
import { Platform } from "react-native";
import { User } from "@/types";
import { storage } from "@/lib/storage";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { loginRevenueCat, logoutRevenueCat, REVENUECAT_ENTITLEMENT_IDENTIFIER } from "@/lib/revenuecat";
import Purchases from "react-native-purchases";
import {
  registerPushTokenWithServer,
  schedulePremiumPromoNotifications,
  cancelPremiumPromoNotifications,
  resetPromoScheduleFlag,
} from "@/lib/notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPremium: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const savedUser = await storage.getUser();
      if (savedUser) {
        setUser(savedUser);
        await loginRevenueCat(String(savedUser.id));
        const token = await storage.getAuthToken();
        if (token) {
          registerPushTokenWithServer(token).catch(() => {});

          // Heal premium status on every launch (native only). If the user
          // paid but server didn't get the update (e.g. webhook was broken),
          // this re-checks RevenueCat directly and syncs to the server.
          if (Platform.OS !== "web") {
            (async () => {
              try {
                const customerInfo = await Purchases.getCustomerInfo();
                const entitlement = customerInfo.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER];
                if (entitlement) {
                  await apiRequest("POST", "/api/revenuecat/sync", {
                    userId: String(savedUser.id),
                    isSubscribed: true,
                    productIdentifier: entitlement.productIdentifier,
                  });
                  // Pull fresh user state so isPremium flips immediately
                  const subResp = await apiRequest("GET", `/api/subscription/${savedUser.id}`);
                  const subData = await subResp.json();
                  if (subData.isPremium && !savedUser.isPremium) {
                    const updated: User = { ...savedUser, isPremium: true, subscriptionExpiry: subData.expiryDate };
                    await storage.setUser(updated);
                    setUser(updated);
                  }
                }
              } catch (err) {
                console.warn("Launch RevenueCat sync failed:", err);
              }
            })();
          }
        }

        let needsRefresh = false;
        if (Platform.OS === "web") {
          try {
            const activatedFlag = await AsyncStorage.getItem("@probaly/premium_activated");
            if (activatedFlag && !savedUser.isPremium) {
              needsRefresh = true;
              await AsyncStorage.removeItem("@probaly/premium_activated");
            }
          } catch {}
        }

        if (needsRefresh && token) {
          try {
            const response = await apiRequest("GET", `/api/subscription/${savedUser.id}`);
            const data = await response.json();
            if (data.isPremium) {
              const updatedUser: User = {
                ...savedUser,
                isPremium: true,
                subscriptionExpiry: data.expiryDate,
              };
              await storage.setUser(updatedUser);
              setUser(updatedUser);
            }
          } catch {}
        }

        const currentUser = needsRefresh ? (await storage.getUser()) || savedUser : savedUser;
        if (currentUser.isPremium) {
          cancelPremiumPromoNotifications().catch(() => {});
        } else {
          schedulePremiumPromoNotifications().catch(() => {});
        }
      }
    } catch (error) {
      console.error("Failed to load user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/login", { email, password });
      const data = await response.json();

      const newUser: User = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        isPremium: data.user.isPremium || false,
        subscriptionExpiry: data.user.subscriptionExpiry,
      };

      await storage.setUser(newUser);
      await storage.setAuthToken(data.token);
      setUser(newUser);
      loginRevenueCat(String(data.user.id));
      registerPushTokenWithServer(data.token).catch(() => {});
      if (newUser.isPremium) {
        cancelPremiumPromoNotifications().catch(() => {});
      } else {
        resetPromoScheduleFlag().catch(() => {});
        schedulePremiumPromoNotifications().catch(() => {});
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/register", { email, password, name });
      const data = await response.json();

      const newUser: User = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        isPremium: data.user.isPremium || false,
        subscriptionExpiry: data.user.subscriptionExpiry,
      };

      await storage.setUser(newUser);
      await storage.setAuthToken(data.token);
      await storage.setOnboardingComplete();
      setUser(newUser);
      loginRevenueCat(String(data.user.id));
      registerPushTokenWithServer(data.token).catch(() => {});
      schedulePremiumPromoNotifications().catch(() => {});
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      logoutRevenueCat();
      cancelPremiumPromoNotifications().catch(() => {});
      await storage.clearAll();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    if (!user) return;
    try {
      const response = await apiRequest("GET", `/api/subscription/${user.id}`);
      const data = await response.json();

      const updatedUser: User = {
        ...user,
        isPremium: data.isPremium ?? user.isPremium,
        subscriptionExpiry: data.expiryDate ?? user.subscriptionExpiry,
      };
      await storage.setUser(updatedUser);
      setUser(updatedUser);

      if (updatedUser.isPremium && !user.isPremium) {
        cancelPremiumPromoNotifications().catch(() => {});
      }
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isPremium: user?.isPremium ?? false,
        signIn,
        signUp,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
