import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Language, getTranslation, LANGUAGES, isSupportedLanguage } from "@/lib/translations";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useAuth } from "./AuthContext";

type TranslationKeys = ReturnType<typeof getTranslation>;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: TranslationKeys;
  languages: typeof LANGUAGES;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = "@betright_language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  // Load language preference on mount
  useEffect(() => {
    loadLanguage();
  }, []);

  // Sync with cloud when user logs in
  useEffect(() => {
    if (user?.id) {
      loadLanguageFromCloud(user.id);
    }
  }, [user?.id]);

  const loadLanguage = async () => {
    try {
      const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (isSupportedLanguage(stored)) {
        setLanguageState(stored);
      }
    } catch (error) {
      console.error("Error loading language:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLanguageFromCloud = async (userId: string) => {
    try {
      const response = await fetch(
        new URL(`/api/user/preferences/${userId}`, getApiUrl()).toString()
      );
      const data = await response.json();
      if (isSupportedLanguage(data?.language)) {
        setLanguageState(data.language);
        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, data.language);
      }
    } catch (error) {
      console.error("Error loading language from cloud:", error);
    }
  };

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    
    // Save locally
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    
    // Save to cloud if user is logged in
    if (user?.id) {
      try {
        await apiRequest("POST", new URL("/api/user/preferences", getApiUrl()).toString(), {
          userId: user.id,
          language: lang,
        });
      } catch (error) {
        console.error("Error saving language to cloud:", error);
      }
    }
  }, [user?.id]);

  const t = getTranslation(language);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        languages: LANGUAGES,
        isLoading,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
