import React, { useEffect } from "react";
import { View, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { SettingsRow } from "@/components/SettingsRow";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { BorderRadius, Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { getLanguageName } from "@/lib/translations";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user, isPremium, signOut, refreshUser } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const { language, t } = useLanguage();

  const [notificationsEnabled, setNotificationsEnabled] = React.useState(false);
  const [isRestoring, setIsRestoring] = React.useState(false);

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

  const handleUpgrade = () => {
    navigation.navigate("Subscription");
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
        <SubscriptionCard
          isPremium={isPremium}
          expiryDate={user?.subscriptionExpiry}
          onUpgrade={handleUpgrade}
        />
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
            value={t.system}
            hasChevron
            onPress={() => {}}
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
});
