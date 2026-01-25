import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

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
  const { user } = useAuth();
  
  const [sportCategories, setSportCategories] = useState<SportCategory[]>(baseSportCategories);
  const [loading, setLoading] = useState(true);

  const loadCounts = useCallback(async () => {
    try {
      const counts = await fetchSportPredictionCounts(user?.id);
      const updatedCategories = baseSportCategories.map(cat => ({
        ...cat,
        predictionCount: counts[cat.id] || 0,
      }));
      setSportCategories(updatedCategories);
    } catch (error) {
      console.error("Error loading sport counts:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadCounts();
    }, [loadCounts])
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

  if (loading) {
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
