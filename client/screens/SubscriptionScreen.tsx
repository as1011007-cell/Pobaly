import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Pressable,
  Platform,
  Animated,
  Alert,
} from "react-native";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { BorderRadius, Spacing } from "@/constants/theme";
import { useSubscription, REVENUECAT_ENTITLEMENT_IDENTIFIER } from "@/lib/revenuecat";
import { useFocusEffect } from "@react-navigation/native";
import Purchases from "react-native-purchases";
import { apiRequest } from "@/lib/query-client";

const features = [
  { icon: "unlock", title: "All Daily Predictions", description: "Access every AI prediction" },
  { icon: "activity", title: "Live Match Updates", description: "Real-time probability changes" },
  { icon: "filter", title: "Advanced Filters", description: "High confidence only filter" },
  { icon: "clock", title: "Full History", description: "Track all past predictions" },
  { icon: "bar-chart-2", title: "Analytics Dashboard", description: "Performance insights" },
];

type PlanType = "monthly" | "annual";

function PriceSkeleton({ width = 80 }: { width?: number }) {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={{
        width,
        height: 28,
        borderRadius: 6,
        backgroundColor: theme.border,
        opacity,
      }}
    />
  );
}

export default function SubscriptionScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { user, isPremium, refreshUser } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("annual");

  const {
    monthlyPackage,
    annualPackage,
    isLoading,
    offeringsError,
    refetchOfferings,
    purchase,
    restore,
    isPurchasing,
    isRestoring,
    isSubscribed,
  } = useSubscription();

  const selectedPackage = selectedPlan === "monthly" ? monthlyPackage : annualPackage;
  // Show real prices from RevenueCat, or fallback to known prices while loading/failed
  const monthlyPrice = monthlyPackage?.product.priceString ?? "$49.99";
  const annualPrice = annualPackage?.product.priceString ?? "$149.00";
  // Always show the known prices — RevenueCat will update them live once loaded
  const monthlyPriceLabel = monthlyPrice;
  const annualPriceLabel = annualPrice;

  const handleSelectPlan = (plan: PlanType) => {
    setSelectedPlan(plan);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Detect Expo Go so we can show appropriate messaging
  const isExpoGo = Constants.executionEnvironment === "storeClient";

  const handleSubscribe = async () => {
    if (isPurchasing) return;
    if (!selectedPackage) {
      if (isExpoGo) {
        Alert.alert(
          "Expo Go limitation",
          "In-app purchases require a TestFlight or App Store build. Build with 'eas build --profile preview' to test real purchases.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "Prices unavailable",
          "Could not connect to the App Store. Please check your connection and try again.",
          [
            { text: "Retry", onPress: () => refetchOfferings() },
            { text: "Cancel", style: "cancel" },
          ]
        );
      }
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await purchase(selectedPackage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // After purchase, sync premium status to server so backend reflects it immediately
      if (user?.id) {
        try {
          const customerInfo = await Purchases.getCustomerInfo();
          const entitlement = customerInfo.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER];
          const isSubscribed = entitlement !== undefined;
          const productIdentifier = entitlement?.productIdentifier ?? selectedPackage.product.identifier;
          await apiRequest("POST", "/api/revenuecat/sync", {
            userId: String(user.id),
            isSubscribed,
            productIdentifier,
          });
        } catch (syncError) {
          // Non-fatal: webhook will eventually sync if this fails
          console.warn("RevenueCat sync failed:", syncError);
        }
      }

      // Refresh local user state so premium UI unlocks
      await refreshUser();
    } catch (error: any) {
      if (error?.userCancelled) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Purchase error:", error);
      const message =
        error?.message?.includes("browser") || error?.message?.includes("mock")
          ? "Payments are simulated in Expo Go. Install via TestFlight or the App Store to make a real purchase."
          : error?.message || "Something went wrong. Please try again.";
      Alert.alert("Purchase failed", message, [{ text: "OK" }]);
    }
  };

  const handleRestorePurchases = async () => {
    if (isRestoring) return;
    try {
      const restoredInfo = await restore();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Sync restored premium status to server
      if (user?.id) {
        try {
          const entitlement = restoredInfo.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER];
          const isSubscribed = entitlement !== undefined;
          const productIdentifier = entitlement?.productIdentifier;
          await apiRequest("POST", "/api/revenuecat/sync", {
            userId: String(user.id),
            isSubscribed,
            productIdentifier,
          });
        } catch (syncError) {
          console.warn("RevenueCat restore sync failed:", syncError);
        }
      }

      await refreshUser();
      Alert.alert("Purchases restored", "Your subscription has been restored successfully.", [{ text: "OK" }]);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Restore error:", error);
      Alert.alert("Restore failed", error?.message || "Could not restore purchases. Please try again.", [{ text: "OK" }]);
    }
  };

  if (isPremium || isSubscribed) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight + Spacing["3xl"] },
        ]}
      >
        <View style={styles.successContent}>
          <View style={[styles.successIcon, { backgroundColor: `${theme.success}15` }]}>
            <Feather name="check-circle" size={48} color={theme.success} />
          </View>
          <ThemedText type="h3" style={styles.successTitle}>You're already Premium!</ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
            You have full access to all predictions and features.
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing["2xl"],
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {isExpoGo ? (
          <View style={[styles.testModeBanner, { backgroundColor: `${theme.warning}20`, borderColor: theme.warning }]}>
            <Feather name="info" size={16} color={theme.warning} />
            <ThemedText type="small" style={{ color: theme.warning, marginLeft: Spacing.xs, flex: 1, lineHeight: 18 }}>
              Purchases require a TestFlight or App Store build. Prices shown are the configured amounts — real billing activates in the native build.
            </ThemedText>
          </View>
        ) : offeringsError ? (
          <View style={[styles.testModeBanner, { backgroundColor: `${theme.accent}15`, borderColor: theme.accent }]}>
            <Feather name="wifi-off" size={16} color={theme.accent} />
            <ThemedText type="small" style={{ color: theme.accent, marginLeft: Spacing.xs, flex: 1 }}>
              Could not connect to the App Store.
            </ThemedText>
            <Pressable onPress={() => refetchOfferings()} style={{ marginLeft: Spacing.sm }}>
              <ThemedText type="small" style={{ color: theme.accent, fontWeight: "700" }}>Retry</ThemedText>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.header}>
          <Image
            source={require("../../assets/images/premium-unlock.png")}
            style={styles.headerImage}
            resizeMode="contain"
          />
          <ThemedText type="h2" style={styles.title}>Unlock All Predictions</ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
            Get unlimited access to AI-powered sports predictions
          </ThemedText>
        </View>

        <View style={styles.featuresSection}>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={[styles.featureIcon, { backgroundColor: `${theme.primary}15` }]}>
                <Feather name={feature.icon as keyof typeof Feather.glyphMap} size={20} color={theme.primary} />
              </View>
              <View style={styles.featureContent}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>{feature.title}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>{feature.description}</ThemedText>
              </View>
              <Feather name="check" size={20} color={theme.success} />
            </View>
          ))}
        </View>

        <View style={styles.plansContainer}>
          {/* Monthly Plan */}
          <Pressable
            onPress={() => handleSelectPlan("monthly")}
            disabled={isPurchasing}
            style={[
              styles.planCard,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: selectedPlan === "monthly" ? theme.primary : theme.border,
                borderWidth: selectedPlan === "monthly" ? 2 : 1,
              },
            ]}
          >
            <View style={styles.planHeader}>
              <ThemedText type="body" style={{ fontWeight: "700" }}>Monthly</ThemedText>
              <View style={[styles.savingsBadge, { backgroundColor: `${theme.success}15` }]}>
                <ThemedText style={[styles.savingsText, { color: theme.success }]}>Save 50%</ThemedText>
              </View>
            </View>
            <View style={styles.planPriceRow}>
              <ThemedText style={[styles.originalPrice, { color: theme.textSecondary }]}>$99.00</ThemedText>
              {isLoading ? (
                <PriceSkeleton width={90} />
              ) : (
                <ThemedText type="h2" style={{ color: theme.text }}>{monthlyPriceLabel}</ThemedText>
              )}
              <ThemedText type="small" style={{ color: theme.textSecondary }}>/month</ThemedText>
            </View>
            {selectedPlan === "monthly" && (
              <View style={[styles.selectedIndicator, { backgroundColor: theme.primary }]}>
                <Feather name="check" size={14} color="#FFFFFF" />
              </View>
            )}
          </Pressable>

          {/* Annual Plan */}
          <Pressable
            onPress={() => handleSelectPlan("annual")}
            disabled={isPurchasing}
            style={[
              styles.planCard,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: selectedPlan === "annual" ? theme.primary : theme.border,
                borderWidth: selectedPlan === "annual" ? 2 : 1,
              },
            ]}
          >
            <View style={styles.bestValueBadge}>
              <ThemedText style={styles.bestValueText}>BEST VALUE</ThemedText>
            </View>
            <View style={styles.planHeader}>
              <ThemedText type="body" style={{ fontWeight: "700" }}>Annual</ThemedText>
              <View style={[styles.savingsBadge, { backgroundColor: `${theme.success}15` }]}>
                <ThemedText style={[styles.savingsText, { color: theme.success }]}>Save 63%</ThemedText>
              </View>
            </View>
            <View style={styles.planPriceRow}>
              <ThemedText style={[styles.originalPrice, { color: theme.textSecondary }]}>$399.00</ThemedText>
              {isLoading ? (
                <PriceSkeleton width={100} />
              ) : (
                <ThemedText type="h2" style={{ color: theme.text }}>{annualPriceLabel}</ThemedText>
              )}
              <ThemedText type="small" style={{ color: theme.textSecondary }}>/year</ThemedText>
            </View>
            {selectedPlan === "annual" && (
              <View style={[styles.selectedIndicator, { backgroundColor: theme.primary }]}>
                <Feather name="check" size={14} color="#FFFFFF" />
              </View>
            )}
          </Pressable>
        </View>

        {/* Subscribe Button */}
        <Button
          onPress={handleSubscribe}
          disabled={isPurchasing || isLoading}
          style={styles.subscribeButton}
          testID="button-subscribe"
        >
          {isPurchasing ? (
            <View style={styles.buttonContent}>
              <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: Spacing.sm }} />
              <ThemedText style={{ color: "#FFF", fontWeight: "700" }}>Processing...</ThemedText>
            </View>
          ) : isLoading ? (
            <View style={styles.buttonContent}>
              <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: Spacing.sm }} />
              <ThemedText style={{ color: "#FFF", fontWeight: "700" }}>Loading prices...</ThemedText>
            </View>
          ) : (
            `Start ${selectedPlan === "annual" ? "Annual" : "Monthly"} Subscription`
          )}
        </Button>

        <View style={styles.footer}>
          <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", lineHeight: 20 }}>
            {Platform.OS === "ios"
              ? "Payment will be charged to your Apple ID account at confirmation of purchase. Subscription automatically renews unless canceled at least 24 hours before the end of the current period. Manage or cancel in your Apple ID Account Settings."
              : Platform.OS === "android"
              ? "Payment will be charged to your Google Play account at confirmation of purchase. Subscription automatically renews unless canceled at least 24 hours before the end of the current period. Manage or cancel in Google Play."
              : "Subscription automatically renews unless canceled at least 24 hours before the end of the current period."
            }{"\n\n"}For entertainment purposes only. Must be 18+. By subscribing, you agree to our Terms and Privacy Policy.
          </ThemedText>
          <View style={styles.footerLinks}>
            <Pressable
              onPress={handleRestorePurchases}
              disabled={isRestoring || isPurchasing}
              testID="button-restore"
              style={styles.footerLinkBtn}
            >
              {isRestoring ? (
                <View style={styles.restoreRow}>
                  <ActivityIndicator size="small" color={theme.accent} style={{ marginRight: 4 }} />
                  <ThemedText type="small" style={{ color: theme.accent }}>Restoring...</ThemedText>
                </View>
              ) : (
                <ThemedText type="small" style={{ color: theme.accent }}>Restore Purchase</ThemedText>
              )}
            </Pressable>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>{" "}•{" "}</ThemedText>
            <Pressable onPress={() => navigation.navigate("TermsOfService")} testID="link-terms">
              <ThemedText type="small" style={{ color: theme.accent }}>Terms</ThemedText>
            </Pressable>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>{" "}•{" "}</ThemedText>
            <Pressable onPress={() => navigation.navigate("PrivacyPolicy")} testID="link-privacy">
              <ThemedText type="small" style={{ color: theme.accent }}>Privacy</ThemedText>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Apple Pay-style spinner overlay — shows while purchase sheet is processing */}
      {isPurchasing && (
        <View style={styles.purchasingOverlay}>
          <View style={styles.purchasingCard}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  testModeBanner: { flexDirection: "row", alignItems: "center", padding: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.lg },
  header: { alignItems: "center", marginBottom: Spacing["2xl"] },
  headerImage: { width: 120, height: 120, marginBottom: Spacing.xl },
  title: { textAlign: "center", marginBottom: Spacing.sm },
  featuresSection: { marginBottom: Spacing["2xl"] },
  featureRow: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.lg },
  featureIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: Spacing.md },
  featureContent: { flex: 1 },
  plansContainer: { marginBottom: Spacing.xl, gap: Spacing.md },
  planCard: { borderRadius: BorderRadius.lg, padding: Spacing.lg, position: "relative" },
  planHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm },
  planPriceRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, minHeight: 36 },
  originalPrice: { fontSize: 16, textDecorationLine: "line-through" },
  savingsBadge: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  savingsText: { fontSize: 11, fontWeight: "700" },
  bestValueBadge: { position: "absolute", top: -10, right: Spacing.lg, backgroundColor: "#E53935", paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  bestValueText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  selectedIndicator: { position: "absolute", top: Spacing.md, right: Spacing.md, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  subscribeButton: { marginBottom: Spacing.xl },
  buttonContent: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  footer: { alignItems: "center" },
  footerLinks: { flexDirection: "row", marginTop: Spacing.md, alignItems: "center", flexWrap: "wrap", justifyContent: "center" },
  footerLinkBtn: { paddingVertical: 2 },
  restoreRow: { flexDirection: "row", alignItems: "center" },
  successContent: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.xl },
  successIcon: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center", marginBottom: Spacing.xl },
  successTitle: { textAlign: "center", marginBottom: Spacing.md },
  purchasingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", zIndex: 999 },
  purchasingCard: { width: 80, height: 80, borderRadius: 20, backgroundColor: "rgba(40,40,40,0.92)", alignItems: "center", justifyContent: "center" },
});
