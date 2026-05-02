import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Pressable,
  Platform,
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
import { useSubscription, REVENUECAT_ENTITLEMENT_IDENTIFIER, fetchCustomerInfo } from "@/lib/revenuecat";
import { apiRequest } from "@/lib/query-client";
import { useLanguage } from "@/contexts/LanguageContext";

type PlanType = "monthly" | "annual";

export default function SubscriptionScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { user, isPremium, activatePremium, armPurchaseWindow } = useAuth();
  const { t } = useLanguage();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("annual");

  const features = [
    { icon: "unlock", title: t.featureAllPredictionsTitle, description: t.featureAllPredictionsDesc },
    { icon: "activity", title: t.featureLiveTitle, description: t.featureLiveDesc },
    { icon: "filter", title: t.featureFiltersTitle, description: t.featureFiltersDesc },
    { icon: "clock", title: t.featureHistoryTitle, description: t.featureHistoryDesc },
    { icon: "bar-chart-2", title: t.featureAnalyticsTitle, description: t.featureAnalyticsDesc },
  ];

  const {
    monthlyPackage,
    annualPackage,
    offeringsError,
    refetchOfferings,
    purchase,
    restore,
    isPurchasing,
    isRestoring,
    isSubscribed,
    refetchCustomerInfo,
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

  // Platform-aware copy so Android users don't see "App Store / TestFlight" text
  const isAndroid = Platform.OS === "android";
  const STORE_NAME = isAndroid ? "Play Store" : "App Store";
  const STORE_BUILD_HINT = isAndroid
    ? "an internal testing or Play Store build"
    : "a TestFlight or App Store build";
  const STORE_CONFIRMED_BY = isAndroid ? "Google Play" : "Apple";

  const handleSubscribe = async () => {
    if (isPurchasing) return;
    if (!selectedPackage) {
      if (isExpoGo) {
        Alert.alert(t.expoGoLimitation, t.expoGoLimitationDesc, [{ text: t.ok }]);
      } else {
        Alert.alert(t.pricesUnavailable, t.couldNotConnectStore, [
          { text: t.retry, onPress: () => refetchOfferings() },
          { text: t.cancel, style: "cancel" },
        ]);
      }
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    armPurchaseWindow();
    try {
      await purchase(selectedPackage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Immediately mark premium in the app — the store confirmed the payment,
      // so we trust the client. The server webhook will also confirm it.
      await activatePremium();
      // Force RC customerInfo refetch so isSubscribed flips true on this tick
      refetchCustomerInfo().catch(() => {});

      // Fire-and-forget — RevenueCatSyncHandler in App.tsx provides the
      // reliable retry path (it syncs on every launch/customerInfo refresh).
      if (user?.id) {
        apiRequest("POST", "/api/revenuecat/sync", {
          isSubscribed: true,
          productIdentifier: selectedPackage.product.identifier,
          userId: user.id,
        }).catch(() => {});
      }

      setTimeout(() => {
        Alert.alert(t.youreNowPremium, t.youreNowPremiumDesc, [
          {
            text: t.ok,
            onPress: () => {
              if (navigation.canGoBack()) navigation.goBack();
            },
          },
        ]);
      }, 400);
    } catch (error: any) {
      if (error?.userCancelled) return;

      // The store's "You're already subscribed" dialog (Apple or Google Play)
      // causes purchasePackage to throw even though the entitlement IS active.
      // Check RC customer info and activate premium rather than showing an error.
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
            Alert.alert(t.youreNowPremium, t.yourSubscriptionActiveDesc, [
              {
                text: t.ok,
                onPress: () => {
                  if (navigation.canGoBack()) navigation.goBack();
                },
              },
            ]);
          }, 400);
          return;
        }
      } catch {}

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Purchase error:", error);
      const isMockError =
        error?.message?.includes("browser") || error?.message?.includes("mock");
      const message = isMockError ? t.somethingWentWrong : error?.message || t.somethingWentWrong;
      Alert.alert(t.purchaseFailed, message, [{ text: t.ok }]);
    }
  };

  const handleRestorePurchases = async () => {
    if (isRestoring) return;
    try {
      const restoredInfo = await restore();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const entitlement = restoredInfo.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER];
      const hasActiveSubscription = entitlement !== undefined;

      // Immediately activate premium in-app if RC confirms an active entitlement
      if (hasActiveSubscription) {
        await activatePremium();
      }

      // Fire-and-forget server sync
      if (user?.id && hasActiveSubscription) {
        apiRequest("POST", "/api/revenuecat/sync", {
          isSubscribed: true,
          productIdentifier: entitlement?.productIdentifier,
          userId: user.id,
        }).catch(() => {});
      }

      if (hasActiveSubscription) {
        navigation.navigate("Main", { screen: "ProfileTab" });
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
          <ThemedText type="h3" style={styles.successTitle}>{t.youreAlreadyPremium}</ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
            {t.youreAlreadyPremiumDesc}
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
        {!isExpoGo && offeringsError ? (
          <View style={[styles.testModeBanner, { backgroundColor: `${theme.accent}15`, borderColor: theme.accent }]}>
            <Feather name="wifi-off" size={16} color={theme.accent} />
            <ThemedText type="small" style={{ color: theme.accent, marginLeft: Spacing.xs, flex: 1 }}>
              {t.couldNotConnectStore}
            </ThemedText>
            <Pressable onPress={() => refetchOfferings()} style={{ marginLeft: Spacing.sm }}>
              <ThemedText type="small" style={{ color: theme.accent, fontWeight: "700" }}>{t.retry}</ThemedText>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.header}>
          <Image
            source={require("../../assets/images/premium-unlock.png")}
            style={styles.headerImage}
            resizeMode="contain"
          />
          <ThemedText type="h2" style={styles.title}>{t.unlockAllPredictions}</ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
            {t.unlockAllPredictionsDesc}
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
              <ThemedText type="body" style={{ fontWeight: "700" }}>{t.monthly}</ThemedText>
              <View style={[styles.savingsBadge, { backgroundColor: `${theme.success}15` }]}>
                <ThemedText style={[styles.savingsText, { color: theme.success }]}>{t.save50}</ThemedText>
              </View>
            </View>
            <View style={styles.planPriceRow}>
              <ThemedText style={[styles.originalPrice, { color: theme.textSecondary }]}>$99.00</ThemedText>
              {/* Always render the price string. The fallback ($49.99) shows
                  immediately; when RevenueCat resolves the real package, the
                  store-localized price swaps in live. No skeleton — gating on
                  isLoading meant web/Browser-Mode users (and anyone on a slow
                  network) saw a spinner for the full RC timeout. */}
              <ThemedText type="h2" style={{ color: theme.text }}>{monthlyPriceLabel}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>{t.perMonth}</ThemedText>
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
              <ThemedText style={styles.bestValueText}>{t.bestValue}</ThemedText>
            </View>
            <View style={styles.planHeader}>
              <ThemedText type="body" style={{ fontWeight: "700" }}>{t.annual}</ThemedText>
              <View style={[styles.savingsBadge, { backgroundColor: `${theme.success}15` }]}>
                <ThemedText style={[styles.savingsText, { color: theme.success }]}>{t.save63}</ThemedText>
              </View>
            </View>
            <View style={styles.planPriceRow}>
              <ThemedText style={[styles.originalPrice, { color: theme.textSecondary }]}>$399.00</ThemedText>
              {/* Same as monthly — always show the price; let RC swap the
                  localized priceString in when it resolves. */}
              <ThemedText type="h2" style={{ color: theme.text }}>{annualPriceLabel}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>{t.perYear}</ThemedText>
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
          disabled={isPurchasing}
          style={styles.subscribeButton}
          testID="button-subscribe"
        >
          {isPurchasing ? (
            <View style={styles.buttonContent}>
              <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: Spacing.sm }} />
              <ThemedText style={{ color: "#FFF", fontWeight: "700" }}>{t.processing}</ThemedText>
            </View>
          ) : (
            selectedPlan === "annual" ? t.startAnnualSub : t.startMonthlySub
          )}
        </Button>

        <View style={styles.footer}>
          <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", lineHeight: 20 }}>
            {t.mustBe18Agree}{" "}
            <ThemedText
              type="small"
              style={{ color: theme.accent, textDecorationLine: "underline" }}
              onPress={() => navigation.navigate("TermsOfService")}
            >
              {t.termsOfUseEula}
            </ThemedText>
            {" "}{t.andText}{" "}
            <ThemedText
              type="small"
              style={{ color: theme.accent, textDecorationLine: "underline" }}
              onPress={() => navigation.navigate("PrivacyPolicy")}
            >
              {t.privacyPolicy}
            </ThemedText>.
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
                  <ThemedText type="small" style={{ color: theme.accent }}>{t.restoring}</ThemedText>
                </View>
              ) : (
                <ThemedText type="small" style={{ color: theme.accent }}>{t.restorePurchase}</ThemedText>
              )}
            </Pressable>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>{" "}|{" "}</ThemedText>
            <Pressable onPress={() => navigation.navigate("TermsOfService")} testID="link-terms">
              <ThemedText type="small" style={{ color: theme.accent }}>{t.termsOfUseEula}</ThemedText>
            </Pressable>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>{" "}|{" "}</ThemedText>
            <Pressable onPress={() => navigation.navigate("PrivacyPolicy")} testID="link-privacy">
              <ThemedText type="small" style={{ color: theme.accent }}>{t.privacyPolicy}</ThemedText>
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
