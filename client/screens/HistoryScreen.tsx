import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { HistoryCard } from "@/components/HistoryCard";
import { EmptyState } from "@/components/EmptyState";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing } from "@/constants/theme";
import { fetchHistoryPredictions } from "@/lib/predictionsApi";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Prediction } from "@/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { isPremium } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [historyPredictions, setHistoryPredictions] = useState<Prediction[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const predictions = await fetchHistoryPredictions();
      setHistoryPredictions(predictions);
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  }, [loadHistory]);

  const handlePredictionPress = (prediction: Prediction) => {
    if (prediction.isPremium && !isPremium) {
      navigation.navigate("Subscription");
    } else {
      navigation.navigate("PredictionDetail", { predictionId: prediction.id });
    }
  };

  const renderPrediction = ({ item }: { item: Prediction }) => (
    <View style={styles.predictionItem}>
      <HistoryCard
        prediction={item}
        onPress={() => handlePredictionPress(item)}
      />
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
          image={require("../../assets/images/empty-history.png")}
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
