import React, { useEffect } from "react";
import { Platform, StyleSheet } from "react-native";
import { NavigationContainer, LinkingOptions } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SubscriptionProvider, initializeRevenueCat } from "@/lib/revenuecat";
import { setupNotificationHandlers } from "@/lib/notifications";

// Deep link configuration — handles probaly:// URLs (e.g., affiliate referrals)
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["probaly://", "https://probaly.net"],
  config: {
    screens: {
      Main: "",
      Affiliate: "affiliate",
      Subscription: "upgrade",
      Auth: "auth",
    },
  },
};

// Initialize RevenueCat at startup
initializeRevenueCat();

// Detects successful Stripe checkout on web and activates premium immediately
// without a server round-trip. The checkout-success.html page sets a
// localStorage flag and links to /app?premium_activated=1 — this component
// reads both signals and calls activatePremium() the moment the user returns.
function WebPaymentSuccessHandler() {
  const { activatePremium, isAuthenticated } = useAuth();

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!isAuthenticated) return;

    // Signal 1: URL param set by the "Open Probaly" button in checkout-success.html
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("premium_activated") === "1";

    // Signal 2: localStorage set by checkout-success.html immediately on page load
    let fromStorage = false;
    try {
      const stored = localStorage.getItem("@probaly/premium_activated");
      if (stored) {
        const elapsed = Date.now() - parseInt(stored, 10);
        fromStorage = elapsed < 5 * 60 * 1000; // within last 5 minutes
      }
    } catch {}

    if (fromUrl || fromStorage) {
      activatePremium();

      // Clean up localStorage so it doesn't fire again on refresh
      try {
        localStorage.removeItem("@probaly/premium_activated");
      } catch {}

      // Clean up URL param so it doesn't stay in browser history
      if (fromUrl) {
        params.delete("premium_activated");
        const newSearch = params.toString();
        const newUrl =
          window.location.pathname + (newSearch ? "?" + newSearch : "");
        window.history.replaceState({}, "", newUrl);
      }
    }
  }, [isAuthenticated]);

  return null;
}

export default function App() {
  useEffect(() => {
    // Set up notification listeners after native bridge is ready
    const cleanup = setupNotificationHandlers();
    return cleanup;
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <WebPaymentSuccessHandler />
          <LanguageProvider>
            <ThemeProvider>
              <SafeAreaProvider>
                <GestureHandlerRootView style={styles.root}>
                  <KeyboardProvider>
                    <SubscriptionProvider>
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
