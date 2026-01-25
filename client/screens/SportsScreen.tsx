import React from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { SportCategoryCard } from "@/components/SportCategoryCard";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { sportCategories } from "@/lib/mockData";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { SportCategory } from "@/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SportsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

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
