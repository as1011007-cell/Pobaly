import React, { useState, useCallback, useRef } from "react";
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);

  const { language, t } = useLanguage();

  // Free-tip query: 5-minute stale time so tab switches hit the cache.
  // refetchInterval re-polls every 5s when the tip is null (server still
  // generating) and stops automatically once a tip arrives.
  const {
    data: freeTip = null,
    isLoading: freeTipLoading,
    refetch: refetchFreeTip,
  } = useQuery<Prediction | null>({
    queryKey: ["/api/predictions/free-tip", language],
    queryFn: () => fetchFreeTip(language),
    staleTime: 5 * 60 * 1000,
    retry: 3,
    refetchInterval: (query) =>
      query.state.data === null ? 5000 : false,
  });

  // Premium predictions query: keyed on user+premium status+language so it
  // refetches automatically when the user logs in or upgrades.
  const {
    data: premiumPredictions = [],
    isLoading: premiumLoading,
    refetch: refetchPremium,
  } = useQuery<Prediction[]>({
    queryKey: ["/api/predictions/premium", user?.id, isPremium, language],
    queryFn: () => fetchPremiumPredictions(user?.id, isPremium, language),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const loading = freeTipLoading || premiumLoading;

  const onRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    // Invalidate both queries so the next read bypasses the stale-time cache.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/predictions/free-tip", language] }),
      queryClient.invalidateQueries({ queryKey: ["/api/predictions/premium", user?.id, isPremium, language] }),
    ]);
    await Promise.all([refetchFreeTip(), refetchPremium()]);
    setRefreshing(false);
    refreshingRef.current = false;
  }, [queryClient, refetchFreeTip, refetchPremium, language, user?.id, isPremium]);

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
