import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "@/types";
import { storage } from "@/lib/storage";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { loginRevenueCat, logoutRevenueCat } from "@/lib/revenuecat";
import { setFirebaseUserId } from "@/lib/firebase";
import {
  registerPushTokenWithServer,
  schedulePremiumPromoNotifications,
  cancelPremiumPromoNotifications,
  resetPromoScheduleFlag,
} from "@/lib/notifications";

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
        loginRevenueCat(String(savedUser.id));
        setFirebaseUserId(String(savedUser.id)).catch(() => {});
        const token = await storage.getAuthToken();
        if (token) {
          registerPushTokenWithServer(token).catch(() => {});
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
      setUser(newUser);
      loginRevenueCat(String(data.user.id));
      setFirebaseUserId(String(data.user.id)).catch(() => {});
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
      setFirebaseUserId(String(data.user.id)).catch(() => {});
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
      setFirebaseUserId(null).catch(() => {});
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
