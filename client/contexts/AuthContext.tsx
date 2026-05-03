import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { Platform, AppState, AppStateStatus } from "react-native";
import { User } from "@/types";
import { storage } from "@/lib/storage";
import { apiRequest, setOnSessionRevoked } from "@/lib/query-client";
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
  armPurchaseWindow: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userRef = useRef<User | null>(null);
  const lastRefreshRef = useRef<number>(0);
  // Timestamp of the last local premium activation — used to block server
  // refreshes from downgrading premium status before the sync completes.
  const premiumActivatedAt = useRef<number>(0);
  const PREMIUM_TRUST_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours

  useEffect(() => {
    loadUser();
  }, []);

  // Single-active-session: if any API call returns SESSION_REVOKED (because
  // the account just signed in on another device) silently sign this device
  // out so the user lands back on the login screen.
  useEffect(() => {
    setOnSessionRevoked(() => {
      if (!userRef.current) return;
      signOut().catch(() => {});
    });
    return () => setOnSessionRevoked(null);
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
      if (current.isPremium && data.isPremium === false) return;

      // Guard: if the user activated premium recently, never let a server
      // response downgrade them — the background RC check will catch up.
      const recentlyActivated = Date.now() - premiumActivatedAt.current < PREMIUM_TRUST_WINDOW_MS;
      if (recentlyActivated && current.isPremium && data.isPremium === false) {
        return;
      }

      // Clear the persisted activation timestamp once server confirms premium
      if (data.isPremium && premiumActivatedAt.current > 0) {
        premiumActivatedAt.current = 0;
        AsyncStorage.removeItem("@probaly/premium_activated_at").catch(() => {});
      }

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
      // Read all startup values in parallel — one I/O "round" instead of
      // 3+ sequential AsyncStorage calls, shaving ~30–60 ms off cold start.
      const [savedUser, token, storedTs] = await Promise.all([
        storage.getUser(),
        storage.getAuthToken(),
        AsyncStorage.getItem("@probaly/premium_activated_at").catch(() => null),
      ]);

      if (storedTs) {
        premiumActivatedAt.current = Number(storedTs);
      }

      if (savedUser) {
        setUserAndRef(savedUser);
        loginRevenueCat(String(savedUser.id));
        if (token) {
          registerPushTokenWithServer(token, String(savedUser.id)).catch(() => {});
        }
        if (savedUser.isPremium) {
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
      registerPushTokenWithServer(data.token, String(data.user.id)).catch(() => {});
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
      registerPushTokenWithServer(data.token, String(data.user.id)).catch(() => {});
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

  // Call this BEFORE purchase() starts so the trust window is already armed
  // when iOS fires the AppState "active" event as the payment sheet closes.
  // This prevents the AppState refresh from seeing isPremium=false before
  // purchase() resolves and activatePremium() runs.
  const armPurchaseWindow = () => {
    premiumActivatedAt.current = Date.now();
    AsyncStorage.setItem("@probaly/premium_activated_at", String(premiumActivatedAt.current)).catch(() => {});
  };

  // confirm server-side. The premiumActivatedAt timestamp blocks any server
  // refresh from downgrading the status before the sync completes.
  // CRITICAL: state update happens FIRST (synchronously in this tick) so the
  // UI re-renders with isPremium=true immediately. AsyncStorage writes are
  // fire-and-forget so disk I/O never delays the user-visible update.
  const activatePremium = async () => {
    const now = Date.now();
    premiumActivatedAt.current = now;
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
    // Update React state and ref FIRST — UI re-renders this tick
    setUserAndRef(updatedUser);
    // Persist to disk in background — never blocks the UI
    storage.setUser(updatedUser).catch(() => {});
    AsyncStorage.setItem("@probaly/premium_activated_at", String(now)).catch(() => {});
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
        armPurchaseWindow,
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
