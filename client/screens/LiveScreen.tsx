import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";

import { LiveMatchCard } from "@/components/LiveMatchCard";
import { EmptyState } from "@/components/EmptyState";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { fetchLiveMatches } from "@/lib/predictionsApi";
import { LiveMatch } from "@/types";

export default function LiveScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();

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
      loadLive();
      intervalRef.current = setInterval(loadLive, 60000);
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }, [loadLive])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLive();
    setRefreshing(false);
  }, [loadLive]);

  const renderMatch = ({ item }: { item: LiveMatch }) => (
    <View style={styles.matchItem}>
      <LiveMatchCard match={item} />
    </View>
  );

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
      renderItem={renderMatch}
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
});
