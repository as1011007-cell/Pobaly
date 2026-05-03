import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { PredictionCard } from "@/components/PredictionCard";
import { SectionHeader } from "@/components/SectionHeader";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Spacing } from "@/constants/theme";
import { fetchFreeTip, fetchPremiumPredictions } from "@/lib/predictionsApi";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { Prediction } from "@/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user, isPremium } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [freeTip, setFreeTip] = useState<Prediction | null>(null);
  const [premiumPredictions, setPremiumPredictions] = useState<Prediction[]>([]);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 4;
  const RETRY_INTERVAL_MS = 5000;

  const { language, t } = useLanguage();

  // Schedule a retry fetch for the free tip after RETRY_INTERVAL_MS.
  // Clears itself once a tip arrives or max retries are exhausted.
  const scheduleFreeTipRetry = useCallback(() => {
    if (retryCountRef.current >= MAX_RETRIES) return;
    retryCountRef.current += 1;
    retryTimeoutRef.current = setTimeout(async () => {
      try {
        const tip = await fetchFreeTip(language);
        if (tip) {
          setFreeTip(tip);
          retryCountRef.current = 0;
        } else {
          scheduleFreeTipRetry();
        }
      } catch {
        scheduleFreeTipRetry();
      }
    }, RETRY_INTERVAL_MS);
  }, [language]);

  const loadPredictions = useCallback(async () => {
    // Reset retry state on every explicit load.
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    retryCountRef.current = 0;

    try {
      const [tip, premium] = await Promise.all([
        fetchFreeTip(language),
        fetchPremiumPredictions(user?.id, isPremium, language),
      ]);
      setFreeTip(tip);
      setPremiumPredictions(premium);
      // If tip is null the server may still be generating — retry automatically.
      if (!tip) scheduleFreeTipRetry();
    } catch (error) {
      console.error("Error loading predictions:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isPremium, language, scheduleFreeTipRetry]);

  useEffect(() => {
    loadPredictions();
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [loadPredictions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPredictions();
    setRefreshing(false);
  }, [loadPredictions]);

  const handlePredictionPress = (predictionId: string) => {
    navigation.navigate("PredictionDetail", { predictionId });
  };

  const handleUpgradePress = () => {
    navigation.navigate("Subscription");
  };

  const renderFreeTipSection = () => {
    if (freeTip) {
      return (
        <>
          <SectionHeader title={t.freeTipOfDay} />
          <PredictionCard
            prediction={freeTip}
            variant="hero"
            onPress={() => handlePredictionPress(freeTip.id)}
          />
        </>
      );
    }
    // Always render the section — show a placeholder while the tip is being
    // generated or retried so the home screen is never blank in this area.
    return (
      <>
        <SectionHeader title={t.freeTipOfDay} />
        <View style={[styles.tipPlaceholder, { backgroundColor: theme.primary }]}>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
          <ThemedText
            type="small"
            style={styles.tipPlaceholderText}
          >
            {t.tipBeingPrepared}
          </ThemedText>
        </View>
      </>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      {renderFreeTipSection()}

      <View style={styles.sectionSpacer} />

      <SectionHeader
        title={isPremium ? t.yourPredictions : t.unlockPremium}
        actionLabel={isPremium && premiumPredictions.length > 4 ? t.seeMore : undefined}
        onAction={isPremium ? () => navigation.getParent()?.navigate("SportsTab") : undefined}
      />

      {!isPremium ? (
        <View style={[styles.upgradeCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.xs }}>
            {t.getAccessAllPredictions}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
            {t.unlockPremiumDesc}
          </ThemedText>
          <ThemedText
            type="small"
            style={{ color: theme.accent, fontWeight: "600" }}
            onPress={handleUpgradePress}
          >
            {t.upgradeNow} →
          </ThemedText>
        </View>
      ) : null}
    </View>
  );

  const displayPredictions = isPremium ? premiumPredictions.slice(0, 4) : premiumPredictions;

  const renderPrediction = ({ item, index }: { item: typeof premiumPredictions[0]; index: number }) => (
    <View style={[styles.predictionItem, index % 2 === 0 ? styles.leftItem : styles.rightItem]}>
      <PredictionCard
        prediction={item}
        variant="compact"
        isLocked={!isPremium}
        onPress={() => {
          if (isPremium) {
            handlePredictionPress(item.id);
          } else {
            handleUpgradePress();
          }
        }}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.accent} />
        <ThemedText type="body" style={{ marginTop: Spacing.lg, color: theme.textSecondary }}>
          {t.loadingPredictions}
        </ThemedText>
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      ListHeaderComponent={renderHeader}
      data={displayPredictions}
      renderItem={renderPrediction}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.row}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: Spacing.lg,
  },
  tipPlaceholder: {
    borderRadius: 16,
    padding: Spacing["2xl"],
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    minHeight: 120,
  },
  tipPlaceholderText: {
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
    flex: 1,
  },
  sectionSpacer: {
    height: Spacing["2xl"],
  },
  upgradeCard: {
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  row: {
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  predictionItem: {
    width: "48%",
  },
  leftItem: {
    marginRight: "2%",
  },
  rightItem: {
    marginLeft: "2%",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
