import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { PredictionCard } from "@/components/PredictionCard";
import { SectionHeader } from "@/components/SectionHeader";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
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
  const { isPremium } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [freeTip, setFreeTip] = useState<Prediction | null>(null);
  const [premiumPredictions, setPremiumPredictions] = useState<Prediction[]>([]);

  const loadPredictions = useCallback(async () => {
    try {
      const [tip, premium] = await Promise.all([
        fetchFreeTip(),
        fetchPremiumPredictions(),
      ]);
      setFreeTip(tip);
      setPremiumPredictions(premium);
    } catch (error) {
      console.error("Error loading predictions:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPredictions();
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

  const renderHeader = () => (
    <View style={styles.header}>
      {freeTip ? (
        <>
          <SectionHeader title="Free Tip of the Day" />
          <PredictionCard
            prediction={freeTip}
            variant="hero"
            onPress={() => handlePredictionPress(freeTip.id)}
          />
        </>
      ) : null}

      <View style={styles.sectionSpacer} />

      <SectionHeader
        title={isPremium ? "Premium Predictions" : "Unlock Premium"}
        actionLabel={isPremium ? "See All" : undefined}
        onAction={isPremium ? () => {} : undefined}
      />

      {!isPremium ? (
        <View style={[styles.upgradeCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="body" style={{ fontWeight: "600", marginBottom: Spacing.xs }}>
            Get access to all predictions
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
            Unlock premium predictions, live updates, and full history for $49/year
          </ThemedText>
          <ThemedText
            type="small"
            style={{ color: theme.accent, fontWeight: "600" }}
            onPress={handleUpgradePress}
          >
            Upgrade Now →
          </ThemedText>
        </View>
      ) : null}
    </View>
  );

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
          Loading predictions...
        </ThemedText>
      </View>
    );
  }

  if (!freeTip && premiumPredictions.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.backgroundRoot }]}>
        <EmptyState
          image={require("../../assets/images/empty-home.png")}
          title="No predictions available"
          description="Check back later for AI-powered sports predictions"
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
      ListHeaderComponent={renderHeader}
      data={premiumPredictions}
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
