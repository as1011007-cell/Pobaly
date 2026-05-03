import React, { useState, useCallback, useRef } from "react";
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { HistoryCard } from "@/components/HistoryCard";
import { EmptyState } from "@/components/EmptyState";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Spacing } from "@/constants/theme";
import { fetchHistoryPredictions } from "@/lib/predictionsApi";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Prediction } from "@/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const HISTORY_STALE_MS = 2 * 60 * 1000;

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);

  const { language } = useLanguage();

  const queryKey = ["/api/predictions/history", user?.id, language] as const;

  const { data: historyPredictions = [], isLoading, refetch } = useQuery<Prediction[]>({
    queryKey,
    queryFn: () => fetchHistoryPredictions(user?.id, language),
    staleTime: HISTORY_STALE_MS,
    retry: 2,
  });

  // Refetch on focus only when the cached data is stale (> 2 min old).
  // Return visits within 2 min render instantly from the React Query cache.
  useFocusEffect(
    useCallback(() => {
      const state = queryClient.getQueryState(queryKey);
      if (!state?.dataUpdatedAt || Date.now() - state.dataUpdatedAt >= HISTORY_STALE_MS) {
        refetch();
      }
    }, [queryClient, refetch]),
  );

  const onRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey });
    await refetch();
    setRefreshing(false);
    refreshingRef.current = false;
  }, [queryClient, refetch]);

  const handlePredictionPress = (prediction: Prediction) => {
    navigation.navigate("PredictionDetail", { predictionId: prediction.id });
  };

  const renderPrediction = ({ item }: { item: Prediction }) => (
    <View style={styles.predictionItem}>
      <HistoryCard
        prediction={item}
        onPress={() => handlePredictionPress(item)}
      />
    </View>
  );

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
          Loading history...
        </ThemedText>
      </View>
    );
  }

  if (historyPredictions.length === 0) {
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
          icon="clock"
          title="No prediction history yet"
          description="Your past predictions and their outcomes will appear here"
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
      data={historyPredictions}
      renderItem={renderPrediction}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  predictionItem: {
    width: "100%",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
