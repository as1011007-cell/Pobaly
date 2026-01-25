import React from "react";
import { View, StyleSheet, Alert, Image } from "react-native";
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
import { BorderRadius, Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user, isPremium, signOut, upgradeToPremium } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const [notificationsEnabled, setNotificationsEnabled] = React.useState(false);

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
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

  const handleNotificationToggle = (value: boolean) => {
    setNotificationsEnabled(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

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
          SETTINGS
        </ThemedText>
        <View style={[styles.settingsCard, { backgroundColor: theme.backgroundDefault }]}>
          <SettingsRow
            icon="bell"
            title="Notifications"
            hasSwitch
            switchValue={notificationsEnabled}
            onSwitchChange={handleNotificationToggle}
          />
          <SettingsRow
            icon="globe"
            title="Language"
            value="English"
            hasChevron
            onPress={() => {}}
          />
          <SettingsRow
            icon="moon"
            title="Appearance"
            value="System"
            hasChevron
            onPress={() => {}}
          />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="small" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          LEGAL
        </ThemedText>
        <View style={[styles.settingsCard, { backgroundColor: theme.backgroundDefault }]}>
          <SettingsRow
            icon="file-text"
            title="Terms of Service"
            hasChevron
            onPress={() => {}}
          />
          <SettingsRow
            icon="shield"
            title="Privacy Policy"
            hasChevron
            onPress={() => {}}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={[styles.settingsCard, { backgroundColor: theme.backgroundDefault }]}>
          <SettingsRow
            icon="log-out"
            title="Sign Out"
            destructive
            onPress={handleSignOut}
          />
        </View>
      </View>

      <ThemedText type="small" style={[styles.version, { color: theme.textSecondary }]}>
        Version 1.0.0
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
