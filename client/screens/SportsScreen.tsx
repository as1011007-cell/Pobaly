import React, { useMemo } from "react";
import { View, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";

import { SportCategoryCard } from "@/components/SportCategoryCard";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing } from "@/constants/theme";
import { sportCategories as baseSportCategories } from "@/lib/mockData";
import { fetchSportPredictionCounts } from "@/lib/predictionsApi";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { SportCategory } from "@/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SportsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user, isPremium } = useAuth();

  // Prediction counts per sport — cached for 5 min so every tab switch
  // renders instantly from the React Query cache instead of hitting the network.
  const { data: counts = {}, isLoading } = useQuery<Record<string, number>>({
    queryKey: ["/api/predictions/counts", user?.id, isPremium],
    queryFn: () => fetchSportPredictionCounts(user?.id, isPremium),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const sportCategories = useMemo<SportCategory[]>(
    () => baseSportCategories.map(cat => ({ ...cat, predictionCount: counts[cat.id] || 0 })),
    [counts],
  );

  const handleCategoryPress = (category: SportCategory) => {
    navigation.navigate("SportDetail", { sport: category.id });
  };

  const renderCategory = ({ item, index }: { item: SportCategory; index: number }) => (
    <View style={[styles.categoryItem, index % 2 === 0 ? styles.leftItem : styles.rightItem]}>
      <SportCategoryCard
        category={item}
        onPress={() => handleCategoryPress(item)}
      />
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <ActivityIndicator size="large" color={theme.primary} />
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
      data={sportCategories}
      renderItem={renderCategory}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.row}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  row: {
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  categoryItem: {
    width: "48%",
  },
  leftItem: {
    marginRight: "2%",
  },
  rightItem: {
    marginLeft: "2%",
  },
});
