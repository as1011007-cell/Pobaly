import React, { useEffect, useState, useRef } from "react";
import {
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
  Platform,
  Modal,
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
import { useSubscription } from "@/lib/revenuecat";
import { requestNotificationPermissions, sendTestNotification } from "@/lib/notifications";

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
  const [confirmVisible, setConfirmVisible] = useState(false);

  const selectedPackage = selectedPlan === "monthly" ? monthlyPackage : annualPackage;
  const monthlyPrice = monthlyPackage?.product.priceString ?? "$49.99";
  const annualPrice = annualPackage?.product.priceString ?? "$149.00";

  const handleSelectPlan = (plan: PlanType) => {
    setSelectedPlan(plan);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSubscribe = () => {
    if (!selectedPackage) return;
    setConfirmVisible(true);
  };

  const handleConfirmPurchase = async () => {
    setConfirmVisible(false);
    if (!selectedPackage) return;
    try {
      await purchase(selectedPackage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Refresh user to sync premium status after purchase
      await refreshUser();
    } catch (error: any) {
      if (error?.userCancelled) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Purchase error:", error);
    }
  };

  const handleRestorePurchases = async () => {
    try {
      await restore();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error("Restore error:", error);
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

  const handleNotificationToggle = async (value: boolean) => {
    if (value) {
      // Request permission when enabling notifications
      const granted = await requestNotificationPermissions();
      if (!granted) {
        // Permission denied, keep toggle off
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      // Send test notification to confirm
      await sendTestNotification();
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
                  disabled={rcLoading || isPurchasing}
                  style={[
                    styles.planCard,
                    {
                      backgroundColor: theme.backgroundDefault,
                      borderColor: selectedPlan === "monthly" ? theme.primary : theme.border,
                      borderWidth: selectedPlan === "monthly" ? 2 : 1,
                      opacity: rcLoading ? 0.7 : 1,
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
                  {selectedPlan === "monthly" && !rcLoading && (
                    <View style={[styles.selectedIndicator, { backgroundColor: theme.primary }]}>
                      <Feather name="check" size={14} color="#FFFFFF" />
                    </View>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => handleSelectPlan("annual")}
                  disabled={rcLoading || isPurchasing}
                  style={[
                    styles.planCard,
                    {
                      backgroundColor: theme.backgroundDefault,
                      borderColor: selectedPlan === "annual" ? theme.primary : theme.border,
                      borderWidth: selectedPlan === "annual" ? 2 : 1,
                      opacity: rcLoading ? 0.7 : 1,
                    },
                  ]}
                >
                  <View style={[styles.bestValueBadge, { backgroundColor: theme.accent }]}>
                    <ThemedText style={styles.bestValueText}>BEST VALUE</ThemedText>
                  </View>
                  <View style={styles.planHeader}>
                    <ThemedText type="body" style={{ fontWeight: "700" }}>Yearly</ThemedText>
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
                  {selectedPlan === "annual" && !rcLoading && (
                    <View style={[styles.selectedIndicator, { backgroundColor: theme.primary }]}>
                      <Feather name="check" size={14} color="#FFFFFF" />
                    </View>
                  )}
                </Pressable>
              </View>

              <Button
                onPress={handleSubscribe}
                disabled={isPurchasing || rcLoading || !selectedPackage}
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
          </View>
        </View>

        <ThemedText type="small" style={[styles.version, { color: theme.textSecondary }]}>
          {t.version} 1.0.0
        </ThemedText>
      </KeyboardAwareScrollViewCompat>

      {/* Purchase Confirmation Modal */}
      <Modal visible={confirmVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4" style={{ textAlign: "center", marginBottom: Spacing.sm }}>
              Confirm Purchase
            </ThemedText>
            <ThemedText
              type="body"
              style={{ color: theme.textSecondary, textAlign: "center", marginBottom: Spacing.xl }}
            >
              {selectedPlan === "annual"
                ? `Subscribe for ${annualPrice}/year`
                : `Subscribe for ${monthlyPrice}/month`}
              {"\n"}
              Billed by {Platform.OS === "ios" ? "Apple" : Platform.OS === "android" ? "Google" : "Apple / Google"}.
            </ThemedText>
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setConfirmVisible(false)}
                style={[styles.modalBtn, { backgroundColor: `${theme.border}40` }]}
              >
                <ThemedText type="body">Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleConfirmPurchase}
                style={[styles.modalBtn, { backgroundColor: theme.primary }]}
              >
                <ThemedText type="body" style={{ color: "#FFF", fontWeight: "700" }}>
                  Subscribe
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full-screen purchasing overlay */}
      {isPurchasing && (
        <View style={styles.purchasingOverlay}>
          <View style={[styles.purchasingCard, { backgroundColor: theme.backgroundDefault }]}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText type="body" style={{ marginTop: Spacing.md, fontWeight: "600" }}>
              Processing payment...
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs, textAlign: "center" }}>
              Please wait while {Platform.OS === "ios" ? "Apple" : "Google"} processes your purchase.
            </ThemedText>
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
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  modalCard: { width: "85%", borderRadius: BorderRadius.xl, padding: Spacing.xl },
  modalButtons: { flexDirection: "row", gap: Spacing.md },
  modalBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, alignItems: "center" },
  purchasingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", zIndex: 999 },
  purchasingCard: { borderRadius: BorderRadius.xl, padding: Spacing["2xl"], alignItems: "center", width: "75%" },
});
