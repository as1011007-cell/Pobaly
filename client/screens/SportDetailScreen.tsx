import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { PredictionCard } from "@/components/PredictionCard";
import { EmptyState } from "@/components/EmptyState";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing } from "@/constants/theme";
import { fetchPredictionsBySport } from "@/lib/predictionsApi";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Prediction } from "@/types";

type SportDetailRouteProp = RouteProp<RootStackParamList, "SportDetail">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SportDetailScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<SportDetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { user, isPremium } = useAuth();

  const [loading, setLoading] = useState(true);
  const [predictions, setPredictions] = useState<Prediction[]>([]);

  const loadPredictions = useCallback(async () => {
    try {
      const data = await fetchPredictionsBySport(route.params.sport, user?.id, isPremium);
      setPredictions(data);
    } catch (error) {
      console.error("Error loading sport predictions:", error);
    } finally {
      setLoading(false);
    }
  }, [route.params.sport, user?.id, isPremium]);

  useEffect(() => {
    loadPredictions();
  }, [loadPredictions]);

  const handlePredictionPress = (prediction: Prediction) => {
    if (prediction.isPremium && !isPremium) {
      navigation.navigate("Subscription");
    } else {
      navigation.navigate("PredictionDetail", { predictionId: prediction.id });
    }
  };

  const renderPrediction = ({ item }: { item: Prediction }) => (
    <View style={styles.predictionItem}>
      <PredictionCard
        prediction={item}
        isLocked={item.isPremium && !isPremium}
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
          },
        ]}
      >
        <ActivityIndicator size="large" color={theme.accent} />
        <ThemedText type="body" style={{ marginTop: Spacing.lg, color: theme.textSecondary }}>
          Loading predictions...
        </ThemedText>
      </View>
    );
  }

  if (predictions.length === 0) {
    return (
      <View
        style={[
          styles.emptyContainer,
          {
            backgroundColor: theme.backgroundRoot,
            paddingTop: headerHeight,
          },
        ]}
      >
        <EmptyState
          image={require("../../assets/images/empty-home.png")}
          title="No predictions available"
          description="Check back later for predictions in this sport"
        />
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing["2xl"],
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      data={predictions}
      renderItem={renderPrediction}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
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
