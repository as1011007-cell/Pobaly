import React, { useState, useCallback, useRef } from "react";
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";

import { LiveMatchCard } from "@/components/LiveMatchCard";
import { EmptyState } from "@/components/EmptyState";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { fetchLiveMatches } from "@/lib/predictionsApi";
import { useLanguage } from "@/contexts/LanguageContext";
import { LiveMatch } from "@/types";

export default function LiveScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { isPremium } = useAuth();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);

  // Live matches: auto-refreshes every 60s while the screen is focused.
  // When the user switches away (isFocused=false) polling stops — no wasted
  // background requests. Re-enabled instantly when the user comes back.
  const { data: liveMatches = [], isLoading, refetch } = useQuery<LiveMatch[]>({
    queryKey: ["/api/live-matches"],
    queryFn: fetchLiveMatches,
    enabled: isPremium,
    staleTime: 30_000,
    refetchInterval: isPremium && isFocused ? 60_000 : false,
    retry: 2,
  });

  const onRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
    refreshingRef.current = false;
  }, [refetch]);

  const handleUpgradePress = () => {
    navigation.navigate("Subscription");
  };

  if (!isPremium) {
    return (
      <View
        style={[
          styles.emptyContainer,
          {
            backgroundColor: theme.backgroundRoot,
            paddingTop: headerHeight,
            paddingBottom: tabBarHeight,
          },
        ]}
      >
        <View style={[styles.premiumCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.lockIconContainer}>
            <Feather name="lock" size={32} color={theme.accent} />
          </View>
          <ThemedText type="h3" style={styles.premiumTitle}>
            {t.liveEvents}
          </ThemedText>
          <ThemedText
            type="body"
            style={[styles.premiumDescription, { color: theme.textSecondary }]}
          >
            {t.liveEventsLockDesc}
          </ThemedText>
          <Pressable onPress={handleUpgradePress} testID="button-upgrade-live">
            <LinearGradient
              colors={["#E53935", "#C62828"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.upgradeButton}
            >
              <Feather name="zap" size={18} color="#FFFFFF" />
              <ThemedText style={styles.upgradeButtonText}>
                {t.upgradeToPremium}
              </ThemedText>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View
        style={[
          styles.emptyContainer,
          {
            backgroundColor: theme.backgroundRoot,
            paddingTop: headerHeight,
            paddingBottom: tabBarHeight,
          },
        ]}
      >
        <ActivityIndicator size="large" color={theme.accent} />
        <ThemedText type="body" style={{ marginTop: Spacing.lg, color: theme.textSecondary }}>
          {t.loadingLiveEvents}
        </ThemedText>
      </View>
    );
  }

  if (liveMatches.length === 0) {
    return (
      <View
        style={[
          styles.emptyContainer,
          {
            backgroundColor: theme.backgroundRoot,
            paddingTop: headerHeight,
            paddingBottom: tabBarHeight,
          },
        ]}
      >
        <EmptyState
          icon="radio"
          title={t.noLiveEventsTitle}
          description={t.noLiveEventsDesc}
        />
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
      data={liveMatches}
      renderItem={({ item }: { item: LiveMatch }) => (
        <View style={styles.matchItem}>
          <LiveMatchCard match={item} />
        </View>
      )}
      keyExtractor={(item, index) => `${item.homeTeam}-${item.awayTeam}-${index}`}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  matchItem: {
    width: "100%",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  premiumCard: {
    width: "100%",
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing.lg,
  },
  lockIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(229, 57, 53, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  premiumTitle: {
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  premiumDescription: {
    textAlign: "center",
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  upgradeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: BorderRadius.lg,
    gap: 8,
  },
  upgradeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
