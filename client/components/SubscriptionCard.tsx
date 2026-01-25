import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { format } from "date-fns";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, BetRightColors } from "@/constants/theme";

interface SubscriptionCardProps {
  isPremium: boolean;
  expiryDate?: string;
  onUpgrade?: () => void;
}

export function SubscriptionCard({
  isPremium,
  expiryDate,
  onUpgrade,
}: SubscriptionCardProps) {
  const { theme } = useTheme();

  if (isPremium) {
    return (
      <LinearGradient
        colors={[BetRightColors.primary, BetRightColors.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <View style={styles.header}>
          <View style={styles.premiumBadge}>
            <Feather name="star" size={16} color="#FFFFFF" />
            <ThemedText style={styles.badgeText}>PREMIUM</ThemedText>
          </View>
        </View>
        <ThemedText type="h4" style={styles.premiumTitle}>
          You have full access
        </ThemedText>
        <ThemedText style={styles.premiumSubtitle}>
          All predictions unlocked
        </ThemedText>
        {expiryDate ? (
          <ThemedText style={styles.expiryText}>
            Renews {format(new Date(expiryDate), "MMM d, yyyy")}
          </ThemedText>
        ) : null}
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={styles.freeHeader}>
        <View style={[styles.freeBadge, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "600" }}>
            FREE PLAN
          </ThemedText>
        </View>
      </View>
      <ThemedText type="h4" style={styles.freeTitle}>
        Unlock All Predictions
      </ThemedText>
      <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
        Get access to premium predictions, live updates, and prediction history
      </ThemedText>
      <View style={styles.priceRow}>
        <ThemedText type="h2" style={{ color: theme.primary }}>
          $49
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          /year
        </ThemedText>
      </View>
      <Button onPress={onUpgrade} style={{ marginTop: Spacing.lg }}>
        Upgrade to Premium
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    overflow: "hidden",
  },
  header: {
    marginBottom: Spacing.md,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
    marginLeft: Spacing.xs,
    letterSpacing: 0.5,
  },
  premiumTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  premiumSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
  },
  expiryText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginTop: Spacing.md,
  },
  freeHeader: {
    marginBottom: Spacing.md,
  },
  freeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  freeTitle: {
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.xs,
  },
});
