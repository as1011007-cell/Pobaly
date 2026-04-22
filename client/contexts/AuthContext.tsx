import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { Platform, AppState, AppStateStatus } from "react-native";
import { User } from "@/types";
import { storage } from "@/lib/storage";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { loginRevenueCat, logoutRevenueCat } from "@/lib/revenuecat";
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
  activatePremium: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userRef = useRef<User | null>(null);
  const lastRefreshRef = useRef<number>(0);

  useEffect(() => {
    loadUser();
  }, []);

  // Refresh subscription state whenever the app comes to foreground.
  // This catches the case where the payment sheet closes and the user
  // returns to the app — the webhook will have already fired and set
  // isPremium=true on the server, so this refresh picks it up instantly.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        const now = Date.now();
        const secondsSinceLastRefresh = (now - lastRefreshRef.current) / 1000;
        // Avoid hammering the server — only refresh if 10+ seconds have passed
        if (userRef.current && secondsSinceLastRefresh > 10) {
          lastRefreshRef.current = now;
          refreshUserById(userRef.current.id).catch(() => {});
        }
      }
    };
    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, []);

  // Keep ref in sync so AppState handler always has latest user
  const setUserAndRef = (u: User | null) => {
    userRef.current = u;
    setUser(u);
  };

  // Core subscription refresh — works with any user id
  const refreshUserById = async (userId: string) => {
    try {
      const response = await apiRequest("GET", `/api/subscription/${userId}`);
      const data = await response.json();
      const current = userRef.current;
      if (!current) return;
      const updatedUser: User = {
        ...current,
        isPremium: data.isPremium ?? current.isPremium,
        subscriptionExpiry: data.expiryDate ?? current.subscriptionExpiry,
      };
      await storage.setUser(updatedUser);
      setUserAndRef(updatedUser);
      if (updatedUser.isPremium && !current.isPremium) {
        cancelPremiumPromoNotifications().catch(() => {});
      }
    } catch {}
  };

  const loadUser = async () => {
    try {
      const savedUser = await storage.getUser();
      if (savedUser) {
        setUserAndRef(savedUser);
        loginRevenueCat(String(savedUser.id));
        const token = await storage.getAuthToken();
        if (token) {
          registerPushTokenWithServer(token).catch(() => {});
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
              setUserAndRef(updatedUser);
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
      setUserAndRef(newUser);
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
      setUserAndRef(newUser);
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
      setUserAndRef(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    if (!userRef.current) return;
    await refreshUserById(userRef.current.id);
  };

  // Optimistically activate premium immediately after a confirmed purchase.
  // Called right after purchasePackage() resolves — Apple has confirmed the
  // payment so we trust the client. The webhook + sync will confirm server-side.
  const activatePremium = async () => {
    const current = userRef.current;
    if (!current) return;
    const updatedUser: User = {
      ...current,
      isPremium: true,
      subscriptionExpiry: (() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        return d;
      })(),
    };
    await storage.setUser(updatedUser);
    setUserAndRef(updatedUser);
    cancelPremiumPromoNotifications().catch(() => {});
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
        activatePremium,
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
