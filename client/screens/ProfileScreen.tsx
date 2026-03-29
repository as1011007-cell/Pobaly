import React, { useEffect, useState, useRef } from "react";
import {
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
  Platform,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { SettingsRow } from "@/components/SettingsRow";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { BorderRadius, Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { getLanguageName } from "@/lib/translations";
import { useSubscription, REVENUECAT_ENTITLEMENT_IDENTIFIER } from "@/lib/revenuecat";
import { requestNotificationPermissions, sendWelcomeNotification } from "@/lib/notifications";
import Purchases from "react-native-purchases";

type PlanType = "monthly" | "annual";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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
        height: 24,
        borderRadius: 6,
        backgroundColor: theme.border,
        opacity,
      }}
    />
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, themeMode } = useTheme();
  const { user, isPremium, signOut, refreshUser } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const { language, t } = useLanguage();

  const {
    monthlyPackage,
    annualPackage,
    isLoading: rcLoading,
    purchase,
    restore,
    isPurchasing,
    isRestoring,
    isSubscribed,
  } = useSubscription();

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("annual");

  const selectedPackage = selectedPlan === "monthly" ? monthlyPackage : annualPackage;
  const monthlyPrice = monthlyPackage?.product.priceString ?? "$49.99";
  const annualPrice = annualPackage?.product.priceString ?? "$149.00";

  const handleSelectPlan = (plan: PlanType) => {
    setSelectedPlan(plan);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSubscribe = async () => {
    if (isPurchasing || !selectedPackage) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await purchase(selectedPackage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Sync premium status to server immediately after purchase
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
          console.warn("RevenueCat sync failed:", syncError);
        }
      }

      await refreshUser();
    } catch (error: any) {
      if (error?.userCancelled) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Purchase error:", error);
      const message =
        error?.message?.includes("browser") || error?.message?.includes("mock")
          ? "Payments require a native build (TestFlight or App Store). Expo Go simulates purchases only."
          : error?.message || "Something went wrong. Please try again.";
      Alert.alert("Purchase failed", message, [{ text: "OK" }]);
    }
  };

  const handleRestorePurchases = async () => {
    try {
      const restoredInfo = await restore();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Sync restored premium status to server
      if (user?.id) {
        try {
          const entitlement = restoredInfo.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER];
          const isSubscribed = entitlement !== undefined;
          await apiRequest("POST", "/api/revenuecat/sync", {
            userId: String(user.id),
            isSubscribed,
            productIdentifier: entitlement?.productIdentifier,
          });
        } catch (syncError) {
          console.warn("Restore sync failed:", syncError);
        }
      }

      await refreshUser();
      Alert.alert("Purchases Restored", "Your subscription has been restored successfully.", [{ text: "OK" }]);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Restore error:", error);
      Alert.alert("Restore Failed", error?.message || "Could not restore purchases. Please try again.", [{ text: "OK" }]);
    }
  };

  const handleSignOut = async () => {
    if (Platform.OS === "web") {
      if (window.confirm(t.signOutConfirm)) {
        await signOut();
      }
    } else {
      Alert.alert(t.signOut, t.signOutConfirm, [
        { text: t.cancel, style: "cancel" },
        {
          text: t.signOut,
          style: "destructive",
          onPress: async () => {
            await signOut();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all associated data. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: async () => {
            if (!user?.id) return;
            try {
              await apiRequest("DELETE", new URL("/api/auth/account", getApiUrl()).toString(), {
                userId: user.id,
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await signOut();
            } catch (error) {
              console.error("Delete account error:", error);
              Alert.alert("Error", "Could not delete account. Please try again or contact support@probaly.app.");
            }
          },
        },
      ]
    );
  };

  const handleNotificationToggle = async (value: boolean) => {
    if (value) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      await sendWelcomeNotification();
    }

    setNotificationsEnabled(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (user?.id) {
      try {
        await apiRequest("POST", new URL("/api/user/preferences", getApiUrl()).toString(), {
          userId: user.id,
          notificationsEnabled: value,
        });
      } catch (error) {
        console.error("Error saving notification preference:", error);
      }
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetch(new URL(`/api/user/preferences/${user.id}`, getApiUrl()).toString())
        .then((res) => res.json())
        .then((data) => {
          if (data.notificationsEnabled !== undefined) {
            setNotificationsEnabled(data.notificationsEnabled);
          }
        })
        .catch(console.error);
    }
  }, [user?.id]);

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const isActivePremium = isPremium || isSubscribed;

  return (
    <>
      <KeyboardAwareScrollViewCompat
        style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <View style={styles.profileSection}>
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <ThemedText style={styles.avatarText}>{initials}</ThemedText>
          </View>
          <ThemedText type="h4" style={styles.name}>
            {user?.name || "User"}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {user?.email}
          </ThemedText>
        </View>

        <View style={styles.section}>
          {isActivePremium ? (
            <View style={[styles.premiumCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.success }]}>
              <View style={styles.premiumHeader}>
                <Feather name="check-circle" size={24} color={theme.success} />
                <ThemedText type="body" style={{ fontWeight: "700", marginLeft: Spacing.sm }}>
                  Premium Active
                </ThemedText>
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                Managed by {Platform.OS === "ios" ? "App Store" : Platform.OS === "android" ? "Google Play" : "Apple / Google"}
              </ThemedText>
            </View>
          ) : (
            <>
              <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                CHOOSE YOUR PLAN
              </ThemedText>

              <View style={styles.plansContainer}>
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
                    <ThemedText style={[styles.originalPrice, { color: theme.textSecondary }]}>$99</ThemedText>
                    {rcLoading ? (
                      <PriceSkeleton width={72} />
                    ) : (
                      <ThemedText type="h3" style={{ color: theme.text }}>{monthlyPrice}</ThemedText>
                    )}
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>/month</ThemedText>
                  </View>
                  {selectedPlan === "monthly" && (
                    <View style={[styles.selectedIndicator, { backgroundColor: theme.primary }]}>
                      <Feather name="check" size={14} color="#FFFFFF" />
                    </View>
                  )}
                </Pressable>

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
                  <View style={[styles.bestValueBadge, { backgroundColor: theme.accent }]}>
                    <ThemedText style={styles.bestValueText}>BEST VALUE</ThemedText>
                  </View>
                  <View style={styles.planHeader}>
                    <ThemedText type="body" style={{ fontWeight: "700" }}>Annual</ThemedText>
                    <View style={[styles.savingsBadge, { backgroundColor: `${theme.success}15` }]}>
                      <ThemedText style={[styles.savingsText, { color: theme.success }]}>Save 63%</ThemedText>
                    </View>
                  </View>
                  <View style={styles.planPriceRow}>
                    <ThemedText style={[styles.originalPrice, { color: theme.textSecondary }]}>$399</ThemedText>
                    {rcLoading ? (
                      <PriceSkeleton width={80} />
                    ) : (
                      <ThemedText type="h3" style={{ color: theme.text }}>{annualPrice}</ThemedText>
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

              <Button
                onPress={handleSubscribe}
                disabled={isPurchasing}
                style={styles.subscribeButton}
                testID="button-subscribe"
              >
                {isPurchasing ? (
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: Spacing.sm }} />
                    <ThemedText style={{ color: "#FFF", fontWeight: "700" }}>Processing...</ThemedText>
                  </View>
                ) : rcLoading ? (
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: Spacing.sm }} />
                    <ThemedText style={{ color: "#FFF", fontWeight: "700" }}>Loading prices...</ThemedText>
                  </View>
                ) : (
                  `Start ${selectedPlan === "annual" ? "Annual" : "Monthly"} Subscription`
                )}
              </Button>
            </>
          )}
        </View>

        <View style={styles.section}>
          <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            {t.settings.toUpperCase()}
          </ThemedText>
          <View style={[styles.settingsCard, { backgroundColor: theme.backgroundDefault }]}>
            <SettingsRow
              icon="bell"
              title={t.notifications}
              hasSwitch
              switchValue={notificationsEnabled}
              onSwitchChange={handleNotificationToggle}
            />
            <SettingsRow
              icon="globe"
              title={t.language}
              value={getLanguageName(language)}
              hasChevron
              onPress={() => navigation.navigate("LanguageSelect")}
            />
            <SettingsRow
              icon="moon"
              title={t.appearance}
              value={themeMode === "system" ? t.system : themeMode === "dark" ? t.dark : t.light}
              hasChevron
              onPress={() => navigation.navigate("Appearance")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            {t.subscription.toUpperCase()}
          </ThemedText>
          <View style={[styles.settingsCard, { backgroundColor: theme.backgroundDefault }]}>
            <SettingsRow
              icon="refresh-cw"
              title={t.restorePurchases}
              hasChevron
              onPress={handleRestorePurchases}
              rightElement={isRestoring ? <ActivityIndicator size="small" color={theme.primary} /> : undefined}
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            EARN MONEY
          </ThemedText>
          <View style={[styles.settingsCard, { backgroundColor: theme.backgroundDefault }]}>
            <SettingsRow
              icon="users"
              title="Affiliate Program"
              subtitle="Earn 40% commission"
              hasChevron
              onPress={() => navigation.navigate("Affiliate")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            {t.legal.toUpperCase()}
          </ThemedText>
          <View style={[styles.settingsCard, { backgroundColor: theme.backgroundDefault }]}>
            <SettingsRow
              icon="file-text"
              title={t.termsOfService}
              hasChevron
              onPress={() => navigation.navigate("TermsOfService")}
            />
            <SettingsRow
              icon="shield"
              title={t.privacyPolicy}
              hasChevron
              onPress={() => navigation.navigate("PrivacyPolicy")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={[styles.settingsCard, { backgroundColor: theme.backgroundDefault }]}>
            <SettingsRow
              icon="log-out"
              title={t.signOut}
              destructive
              onPress={handleSignOut}
            />
            <SettingsRow
              icon="trash-2"
              title="Delete Account"
              destructive
              onPress={handleDeleteAccount}
            />
          </View>
        </View>

        <ThemedText type="small" style={[styles.version, { color: theme.textSecondary }]}>
          {t.version} 1.0.0
        </ThemedText>
      </KeyboardAwareScrollViewCompat>

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
  profileSection: { alignItems: "center", marginBottom: Spacing["2xl"] },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: Spacing.md },
  avatarText: { color: "#FFFFFF", fontSize: 28, fontWeight: "700" },
  name: { marginBottom: Spacing.xs },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontWeight: "600", marginBottom: Spacing.sm, marginLeft: Spacing.xs, letterSpacing: 0.5 },
  settingsCard: { borderRadius: BorderRadius.md, paddingHorizontal: Spacing.lg },
  version: { textAlign: "center", marginTop: Spacing.lg },
  premiumCard: { borderRadius: BorderRadius.md, padding: Spacing.lg, borderWidth: 2 },
  premiumHeader: { flexDirection: "row", alignItems: "center" },
  plansContainer: { gap: Spacing.md, marginBottom: Spacing.lg },
  planCard: { borderRadius: BorderRadius.md, padding: Spacing.lg, position: "relative", overflow: "hidden" },
  planHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm },
  planPriceRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, minHeight: 32 },
  originalPrice: { fontSize: 14, textDecorationLine: "line-through" },
  savingsBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  savingsText: { fontSize: 11, fontWeight: "700" },
  bestValueBadge: { position: "absolute", top: 0, right: 0, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderBottomLeftRadius: BorderRadius.sm },
  bestValueText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  selectedIndicator: { position: "absolute", bottom: Spacing.md, right: Spacing.md, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  subscribeButton: { marginTop: Spacing.sm },
  purchasingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", zIndex: 999 },
  purchasingCard: { width: 80, height: 80, borderRadius: 20, backgroundColor: "rgba(40,40,40,0.92)", alignItems: "center", justifyContent: "center" },
});
