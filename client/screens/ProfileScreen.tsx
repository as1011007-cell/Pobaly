import React, { useEffect, useState } from "react";
import { View, StyleSheet, Alert, ActivityIndicator, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
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

interface StripePrice {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string } | null;
}

interface StripeProduct {
  id: string;
  name: string;
  description: string;
  prices: StripePrice[];
}

type PlanType = "monthly" | "yearly";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, themeMode } = useTheme();
  const { user, isPremium, signOut, refreshUser } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const { language, t } = useLanguage();

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("yearly");
  const [products, setProducts] = useState<StripeProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/products-with-prices", baseUrl);
      const response = await fetch(url.toString());
      const data = await response.json();
      setProducts(data.data || []);
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const premiumProduct = products.find((p) => p.name.toLowerCase().includes("premium"));
  const monthlyPrice = premiumProduct?.prices.find((p) => p.recurring?.interval === "month");
  const yearlyPrice = premiumProduct?.prices.find((p) => p.recurring?.interval === "year");
  const monthlyAmount = monthlyPrice ? monthlyPrice.unit_amount / 100 : 49;
  const yearlyAmount = yearlyPrice ? yearlyPrice.unit_amount / 100 : 149;
  const monthlyOriginal = 99;
  const yearlyOriginal = 399;
  const monthlySavings = Math.round(((monthlyOriginal - monthlyAmount) / monthlyOriginal) * 100);
  const yearlySavings = Math.round(((yearlyOriginal - yearlyAmount) / yearlyOriginal) * 100);

  const handleSelectPlan = (plan: PlanType) => {
    setSelectedPlan(plan);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSubscribe = async () => {
    if (!user) return;

    const interval = selectedPlan === "yearly" ? "year" : "month";
    const selectedPrice = premiumProduct?.prices.find(
      (p) => p.recurring?.interval === interval
    );

    if (!selectedPrice) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsSubscribing(true);
    try {
      const response = await apiRequest("POST", "/api/checkout", {
        userId: user.id,
        priceId: selectedPrice.id,
      });
      const data = await response.json();

      if (data.url) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        if (Platform.OS === "web") {
          window.location.href = data.url;
        } else {
          await WebBrowser.openBrowserAsync(data.url);
          await refreshUser();
        }
      }
    } catch (error) {
      console.error("Checkout error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleSignOut = () => {
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
  };

  const handleNotificationToggle = async (value: boolean) => {
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

  const handleRestorePurchases = async () => {
    if (!user?.id) return;
    
    setIsRestoring(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const response = await apiRequest("POST", new URL("/api/restore-purchases", getApiUrl()).toString(), {
        userId: user.id,
      });
      const data = await response.json();
      
      if (data.restored) {
        await refreshUser();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Success", "Your purchases have been restored successfully!");
      } else {
        Alert.alert("No Purchases Found", "We couldn't find any active subscriptions for your account.");
      }
    } catch (error) {
      console.error("Error restoring purchases:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to restore purchases. Please try again.");
    } finally {
      setIsRestoring(false);
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
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
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
        {isPremium ? (
          <View style={[styles.premiumCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.success }]}>
            <View style={styles.premiumHeader}>
              <Feather name="check-circle" size={24} color={theme.success} />
              <ThemedText type="body" style={{ fontWeight: "700", marginLeft: Spacing.sm }}>
                Premium Active
              </ThemedText>
            </View>
            {user?.subscriptionExpiry && (
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                Renews {new Date(user.subscriptionExpiry).toLocaleDateString()}
              </ThemedText>
            )}
          </View>
        ) : (
          <>
            <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              CHOOSE YOUR PLAN
            </ThemedText>
            
            {loadingProducts ? (
              <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: Spacing.xl }} />
            ) : (
              <>
                <View style={styles.plansContainer}>
                  <Pressable
                    onPress={() => handleSelectPlan("monthly")}
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
                        <ThemedText style={[styles.savingsText, { color: theme.success }]}>
                          Save {monthlySavings}%
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.planPriceRow}>
                      <ThemedText style={[styles.originalPrice, { color: theme.textSecondary }]}>
                        ${monthlyOriginal}
                      </ThemedText>
                      <ThemedText type="h3" style={{ color: theme.text }}>
                        ${monthlyAmount}
                      </ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>/month</ThemedText>
                    </View>
                    {selectedPlan === "monthly" && (
                      <View style={[styles.selectedIndicator, { backgroundColor: theme.primary }]}>
                        <Feather name="check" size={14} color="#FFFFFF" />
                      </View>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => handleSelectPlan("yearly")}
                    style={[
                      styles.planCard,
                      { 
                        backgroundColor: theme.backgroundDefault,
                        borderColor: selectedPlan === "yearly" ? theme.primary : theme.border,
                        borderWidth: selectedPlan === "yearly" ? 2 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.bestValueBadge, { backgroundColor: theme.accent }]}>
                      <ThemedText style={styles.bestValueText}>BEST VALUE</ThemedText>
                    </View>
                    <View style={styles.planHeader}>
                      <ThemedText type="body" style={{ fontWeight: "700" }}>Yearly</ThemedText>
                      <View style={[styles.savingsBadge, { backgroundColor: `${theme.success}15` }]}>
                        <ThemedText style={[styles.savingsText, { color: theme.success }]}>
                          Save {yearlySavings}%
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.planPriceRow}>
                      <ThemedText style={[styles.originalPrice, { color: theme.textSecondary }]}>
                        ${yearlyOriginal}
                      </ThemedText>
                      <ThemedText type="h3" style={{ color: theme.text }}>
                        ${yearlyAmount}
                      </ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>/year</ThemedText>
                    </View>
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                      Only ${Math.round(yearlyAmount / 12)}/month
                    </ThemedText>
                    {selectedPlan === "yearly" && (
                      <View style={[styles.selectedIndicator, { backgroundColor: theme.primary }]}>
                        <Feather name="check" size={14} color="#FFFFFF" />
                      </View>
                    )}
                  </Pressable>
                </View>

                <Button
                  onPress={handleSubscribe}
                  disabled={isSubscribing || loadingProducts}
                  style={styles.subscribeButton}
                >
                  {isSubscribing ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    `Start ${selectedPlan === "yearly" ? "Annual" : "Monthly"} Subscription`
                  )}
                </Button>
              </>
            )}
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
        </View>
      </View>

      <ThemedText type="small" style={[styles.version, { color: theme.textSecondary }]}>
        {t.version} 1.0.0
      </ThemedText>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  profileSection: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "700",
  },
  name: {
    marginBottom: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
    letterSpacing: 0.5,
  },
  settingsCard: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
  },
  version: {
    textAlign: "center",
    marginTop: Spacing.lg,
  },
  premiumCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 2,
  },
  premiumHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  plansContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  planCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    position: "relative",
    overflow: "hidden",
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  planPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.xs,
  },
  originalPrice: {
    fontSize: 14,
    textDecorationLine: "line-through",
  },
  savingsBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  savingsText: {
    fontSize: 11,
    fontWeight: "700",
  },
  bestValueBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderBottomLeftRadius: BorderRadius.sm,
  },
  bestValueText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  selectedIndicator: {
    position: "absolute",
    bottom: Spacing.md,
    right: Spacing.md,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  subscribeButton: {
    marginTop: Spacing.sm,
  },
});
