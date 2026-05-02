import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";

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
import { useSubscription, REVENUECAT_ENTITLEMENT_IDENTIFIER, fetchCustomerInfo } from "@/lib/revenuecat";
import { requestNotificationPermissions, sendWelcomeNotification } from "@/lib/notifications";

type PlanType = "monthly" | "annual";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, themeMode } = useTheme();
  const { user, isPremium, signOut, activatePremium, armPurchaseWindow } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const { language, t } = useLanguage();

  const {
    monthlyPackage,
    annualPackage,
    purchase,
    restore,
    isPurchasing,
    isRestoring,
    isSubscribed,
    refetchCustomerInfo,
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
    if (isPurchasing) return;
    if (!selectedPackage) {
      const isExpoGo = Constants.executionEnvironment === "storeClient";
      if (isExpoGo) {
        Alert.alert(t.expoGoLimitation, t.expoGoLimitationDesc, [{ text: t.ok }]);
      } else {
        Alert.alert(t.pricesUnavailable, t.couldNotConnectStore, [{ text: t.ok }]);
      }
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    armPurchaseWindow();
    try {
      await purchase(selectedPackage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Immediately mark premium in the app — the store confirmed the payment
      await activatePremium();
      refetchCustomerInfo().catch(() => {});

      // Fire-and-forget server sync
      if (user?.id) {
        apiRequest("POST", "/api/revenuecat/sync", {
          isSubscribed: true,
          productIdentifier: selectedPackage.product.identifier,
          userId: user.id,
        }).catch(() => {});
      }

      // Defer Alert by 400ms — gives iOS time to fully dismiss the StoreKit
      // sheet, otherwise the alert can be silently dropped on real devices.
      setTimeout(() => {
        Alert.alert(t.youreNowPremium, t.youreNowPremiumDesc, [{ text: t.ok }]);
      }, 400);
    } catch (error: any) {
      if (error?.userCancelled) return;

      // The store's "You're already subscribed" dialog (Apple or Google Play)
      // causes purchasePackage to throw even though the entitlement IS active.
      // Check customer info first before showing an error.
      try {
        const info = await fetchCustomerInfo();
        const activeEntitlement = info.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER];
        if (activeEntitlement) {
          await activatePremium();
          refetchCustomerInfo().catch(() => {});
          if (user?.id) {
            apiRequest("POST", "/api/revenuecat/sync", {
              isSubscribed: true,
              productIdentifier: activeEntitlement.productIdentifier,
              userId: user.id,
            }).catch(() => {});
          }
          setTimeout(() => {
            Alert.alert(t.youreNowPremium, t.yourSubscriptionActiveDesc, [{ text: t.ok }]);
          }, 400);
          return;
        }
      } catch {}

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Purchase error:", error);
      const message =
        error?.message?.includes("browser") || error?.message?.includes("mock")
          ? t.purchasesRequireBuildHint
          : error?.message || t.somethingWentWrong;
      Alert.alert(t.purchaseFailed, message, [{ text: t.ok }]);
    }
  };

  const handleRestorePurchases = async () => {
    if (isRestoring || isPurchasing) return;
    try {
      const restoredInfo = await restore();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const entitlement = restoredInfo.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER];
      const hasActiveSubscription = entitlement !== undefined;

      if (hasActiveSubscription) {
        await activatePremium();
        if (user?.id) {
          apiRequest("POST", "/api/revenuecat/sync", {
            isSubscribed: true,
            productIdentifier: entitlement?.productIdentifier,
            userId: user.id,
          }).catch(() => {});
        }
        Alert.alert(t.purchasesRestoredTitle, t.purchasesRestoredDesc, [{ text: t.ok }]);
      } else {
        Alert.alert(
          t.noPurchasesFoundTitle,
          Platform.OS === "android" ? t.noPurchasesFoundAndroid : t.noPurchasesFoundIos,
          [{ text: t.ok }]
        );
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Restore error:", error);
      Alert.alert(t.restoreFailed, error?.message || t.couldNotRestorePurchases, [{ text: t.ok }]);
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
      t.deleteAccount,
      t.deleteAccountConfirm,
      [
        { text: t.cancel, style: "cancel" },
        {
          text: t.deleteAccount,
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
              Alert.alert(t.errorTitle, t.couldNotDeleteAccount);
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
            {user?.name || t.userFallback}
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
                  {t.premiumActive}
                </ThemedText>
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                {Platform.OS === "ios" ? t.managedByApple : Platform.OS === "android" ? t.managedByGoogle : t.managedByYourAccount}
              </ThemedText>
            </View>
          ) : Platform.OS === "web" ? (
            <>
              <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                {t.upgradeToPremiumSection}
              </ThemedText>
              <Button
                onPress={() => navigation.navigate("Subscription")}
                style={styles.subscribeButton}
                testID="button-upgrade-web"
              >
                {t.viewPremiumPlans}
              </Button>
            </>
          ) : (
            <>
              <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                {t.chooseYourPlan}
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
                    <ThemedText type="body" style={{ fontWeight: "700" }}>{t.monthly}</ThemedText>
                    <View style={[styles.savingsBadge, { backgroundColor: `${theme.success}15` }]}>
                      <ThemedText style={[styles.savingsText, { color: theme.success }]}>{t.save50}</ThemedText>
                    </View>
                  </View>
                  <View style={styles.planPriceRow}>
                    <ThemedText style={[styles.originalPrice, { color: theme.textSecondary }]}>$99</ThemedText>
                    {/* Always render the price — fallback shows immediately,
                        real RC priceString swaps in live when offerings load.
                        Same fix as SubscriptionScreen — no skeleton gating. */}
                    <ThemedText type="h3" style={{ color: theme.text }}>{monthlyPrice}</ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>{t.perMonth}</ThemedText>
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
                    <ThemedText style={styles.bestValueText}>{t.bestValue}</ThemedText>
                  </View>
                  <View style={styles.planHeader}>
                    <ThemedText type="body" style={{ fontWeight: "700" }}>{t.annual}</ThemedText>
                    <View style={[styles.savingsBadge, { backgroundColor: `${theme.success}15` }]}>
                      <ThemedText style={[styles.savingsText, { color: theme.success }]}>{t.save63}</ThemedText>
                    </View>
                  </View>
                  <View style={styles.planPriceRow}>
                    <ThemedText style={[styles.originalPrice, { color: theme.textSecondary }]}>$399</ThemedText>
                    {/* See monthly comment — always render, RC updates live. */}
                    <ThemedText type="h3" style={{ color: theme.text }}>{annualPrice}</ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>{t.perYear}</ThemedText>
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
                    <ThemedText style={{ color: "#FFF", fontWeight: "700" }}>{t.processing}</ThemedText>
                  </View>
                ) : (
                  selectedPlan === "annual" ? t.startAnnualSub : t.startMonthlySub
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

        {Platform.OS !== "web" ? (
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
        ) : null}

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
              title={t.deleteAccount}
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
