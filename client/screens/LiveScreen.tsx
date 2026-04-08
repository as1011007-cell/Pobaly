import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { LiveMatchCard } from "@/components/LiveMatchCard";
import { EmptyState } from "@/components/EmptyState";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { fetchLiveMatches } from "@/lib/predictionsApi";
import { LiveMatch } from "@/types";

export default function LiveScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { isPremium } = useAuth();
  const navigation = useNavigation<any>();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadLive = useCallback(async () => {
    try {
      const matches = await fetchLiveMatches();
      setLiveMatches(matches);
    } catch (error) {
      console.error("Error loading live matches:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isPremium) {
        loadLive();
        intervalRef.current = setInterval(loadLive, 60000);
      } else {
        setLoading(false);
      }
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }, [loadLive, isPremium])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLive();
    setRefreshing(false);
  }, [loadLive]);

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
            Live Events
          </ThemedText>
          <ThemedText
            type="body"
            style={[styles.premiumDescription, { color: theme.textSecondary }]}
          >
            Get real-time score updates and live match tracking across all sports with Premium.
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
                Upgrade to Premium
              </ThemedText>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  }

  if (loading) {
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
          Loading live events...
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
          title="No live events right now"
          description="Check back during live matches for real-time score updates"
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
