import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "@/types";
import { storage } from "@/lib/storage";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPremium: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  upgradeToPremium: () => Promise<void>;
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

  const signIn = async (email: string, _password: string) => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const newUser: User = {
        id: `user-${Date.now()}`,
        email,
        name: email.split("@")[0],
        isPremium: false,
      };
      await storage.setUser(newUser);
      await storage.setAuthToken(`token-${Date.now()}`);
      setUser(newUser);
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, _password: string, name: string) => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const newUser: User = {
        id: `user-${Date.now()}`,
        email,
        name,
        isPremium: false,
      };
      await storage.setUser(newUser);
      await storage.setAuthToken(`token-${Date.now()}`);
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

  const upgradeToPremium = async () => {
    if (!user) return;
    const updatedUser: User = {
      ...user,
      isPremium: true,
      subscriptionExpiry: new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    };
    await storage.setUser(updatedUser);
    setUser(updatedUser);
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
        upgradeToPremium,
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
