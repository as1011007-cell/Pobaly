import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "@/types";
import { storage } from "@/lib/storage";
import { apiRequest, getApiUrl } from "@/lib/query-client";

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
      setUser(savedUser);
    } catch (error) {
      console.error("Failed to load user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/login", {
        email,
        password,
      });
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
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/register", {
        email,
        password,
        name,
      });
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
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await storage.clearAll();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    if (!user) return;
    try {
      const baseUrl = getApiUrl();
      const url = new URL(`/api/subscription/${user.id}`, baseUrl);
      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.isPremium !== user.isPremium) {
        const updatedUser: User = {
          ...user,
          isPremium: data.isPremium,
          subscriptionExpiry: data.expiryDate,
        };
        await storage.setUser(updatedUser);
        setUser(updatedUser);
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
