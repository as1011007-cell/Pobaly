import AsyncStorage from "@react-native-async-storage/async-storage";
import { User } from "@/types";

const KEYS = {
  USER: "@probaly/user",
  AUTH_TOKEN: "@probaly/auth_token",
  ONBOARDING_COMPLETE: "@probaly/onboarding_complete",
  FAVORITES: "@probaly/favorites",
};

export const storage = {
  async getUser(): Promise<User | null> {
    try {
      const data = await AsyncStorage.getItem(KEYS.USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async setUser(user: User): Promise<void> {
    await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
  },

  async removeUser(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.USER);
  },

  async getAuthToken(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.AUTH_TOKEN);
  },

  async setAuthToken(token: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.AUTH_TOKEN, token);
  },

  async removeAuthToken(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.AUTH_TOKEN);
  },

  async isOnboardingComplete(): Promise<boolean> {
    const value = await AsyncStorage.getItem(KEYS.ONBOARDING_COMPLETE);
    return value === "true";
  },

  async setOnboardingComplete(): Promise<void> {
    await AsyncStorage.setItem(KEYS.ONBOARDING_COMPLETE, "true");
  },

  async getFavorites(): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.FAVORITES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async addFavorite(predictionId: string): Promise<void> {
    const favorites = await this.getFavorites();
    if (!favorites.includes(predictionId)) {
      favorites.push(predictionId);
      await AsyncStorage.setItem(KEYS.FAVORITES, JSON.stringify(favorites));
    }
  },

  async removeFavorite(predictionId: string): Promise<void> {
    const favorites = await this.getFavorites();
    const updated = favorites.filter((id) => id !== predictionId);
    await AsyncStorage.setItem(KEYS.FAVORITES, JSON.stringify(updated));
  },

  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([
      KEYS.USER,
      KEYS.AUTH_TOKEN,
      KEYS.FAVORITES,
    ]);
  },
};
