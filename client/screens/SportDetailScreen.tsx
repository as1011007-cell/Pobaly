import React from "react";
import { View, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";

import { PredictionCard } from "@/components/PredictionCard";
import { EmptyState } from "@/components/EmptyState";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
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

  const { language, t } = useLanguage();

  // Predictions for this sport — cached for 5 min (predictions refresh once a day).
  const { data: predictions = [], isLoading } = useQuery<Prediction[]>({
    queryKey: ["/api/predictions/sport", route.params.sport, user?.id, isPremium, language],
    queryFn: () => fetchPredictionsBySport(route.params.sport, user?.id, isPremium, language),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

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

  if (isLoading) {
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
          {t.loadingPredictions}
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
          icon="bar-chart-2"
          title={t.noPredictions}
          description={t.noPredictionsForSport}
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
