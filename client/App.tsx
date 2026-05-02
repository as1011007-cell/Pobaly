import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet } from "react-native";
import { NavigationContainer, LinkingOptions } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { Feather } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

// Keep splash visible until Feather font is loaded so the tab-bar / header
// icons never render as empty squares on first frame (Expo Go especially).
SplashScreen.preventAutoHideAsync().catch(() => {});

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import {
  SubscriptionProvider,
  initializeRevenueCat,
  useSubscription,
  REVENUECAT_ENTITLEMENT_IDENTIFIER,
} from "@/lib/revenuecat";
import { setupNotificationHandlers } from "@/lib/notifications";

// Deep link configuration — handles probaly:// URLs.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["probaly://", "https://probaly.net"],
  config: {
    screens: {
      Main: "",
      Subscription: "upgrade",
      Auth: "auth",
    },
  },
};

// Initialize RevenueCat at startup
initializeRevenueCat();

// Watches RevenueCat's confirmed subscription state and keeps the server DB
// in sync. Runs on every app launch and every time customerInfo refreshes
// (e.g. right after a purchase). This is the definitive source of truth for
// native iOS/Android payments — if RevenueCat says subscribed, we trust it
// and immediately activate premium both client-side and server-side.
function RevenueCatSyncHandler() {
  const { isSubscribed, customerInfo } = useSubscription();
  const { user, activatePremium, isPremium } = useAuth();
  // Throttle server syncs — only one per user+product per session
  const lastSyncedKey = useRef<string | null>(null);
  const syncInFlight = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  // When the signed-in account changes, clear any sync state so a previous
  // user's throttle key can never block — or worse, mistakenly authorise —
  // a sync for the new account.
  useEffect(() => {
    const currentId = user?.id ? String(user.id) : null;
    if (lastUserIdRef.current !== currentId) {
      lastUserIdRef.current = currentId;
      lastSyncedKey.current = null;
      syncInFlight.current = false;
    }
  }, [user?.id]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!isSubscribed || !user?.id || !customerInfo) return;

    // CRITICAL: only act on customerInfo that actually belongs to this user.
    // Right after a sign-out / sign-in on the same device, the React Query
    // cache may still hold the previous user's customerInfo for a moment.
    // Without this guard the new account would be promoted to premium based
    // on the previous account's entitlement.
    const rcUserId = (customerInfo as any).originalAppUserId as string | undefined;
    if (rcUserId && rcUserId !== String(user.id)) return;

    // RevenueCat confirms an active subscription — ensure the client state
    // reflects this immediately, even if a background refresh just downgraded it.
    if (!isPremium) {
      activatePremium();
    }

    const entitlement =
      customerInfo?.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER];
    const productId = entitlement?.productIdentifier ?? "unknown";

    // Throttle server sync to once per user+product per session.
    // On failure the key resets so the next render retries automatically.
    const syncKey = `${user.id}:${productId}`;
    if (lastSyncedKey.current === syncKey || syncInFlight.current) return;
    lastSyncedKey.current = syncKey;
    syncInFlight.current = true;

    apiRequest("POST", "/api/revenuecat/sync", {
      isSubscribed: true,
      productIdentifier: productId,
      userId: user.id,
    })
      .then(() => {
        syncInFlight.current = false;
      })
      .catch(() => {
        // Reset both flags so the next re-render retries
        lastSyncedKey.current = null;
        syncInFlight.current = false;
      });
  }, [isSubscribed, user?.id, customerInfo, isPremium]);

  return null;
}

export default function App() {
  // Preload the Feather icon font before rendering anything. The expo-font
  // config plugin in app.json embeds the TTF in native EAS builds, but we
  // still need to register it with the JS Font module so @expo/vector-icons
  // can use it from the very first frame. Without this, tab-bar / header
  // icons render as empty squares for a moment (or permanently in some
  // EAS / Expo Go scenarios).
  // Feather.font is { [familyName]: ttfModule } — pass it straight to useFonts
  // so the registered font key matches what @expo/vector-icons expects.
  const [fontsLoaded, fontError] = useFonts(Feather.font);

  useEffect(() => {
    // Set up notification listeners after native bridge is ready
    const cleanup = setupNotificationHandlers();
    return cleanup;
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      console.log("[fonts] Feather font loaded successfully");
    }
    if (fontError) {
      console.error("[fonts] Feather font failed to load:", fontError);
    }
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LanguageProvider>
            <ThemeProvider>
              <SafeAreaProvider>
                <GestureHandlerRootView style={styles.root}>
                  <KeyboardProvider>
                    <SubscriptionProvider>
                      {/* Syncs RevenueCat subscription state to server on every launch/purchase */}
                      <RevenueCatSyncHandler />
                      <NavigationContainer linking={linking}>
                        <RootStackNavigator />
                      </NavigationContainer>
                    </SubscriptionProvider>
                    <StatusBar style="auto" />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </SafeAreaProvider>
            </ThemeProvider>
          </LanguageProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
