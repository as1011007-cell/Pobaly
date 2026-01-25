import React from "react";
import { View, StyleSheet, FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { HistoryCard } from "@/components/HistoryCard";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing } from "@/constants/theme";
import { getHistoryPredictions } from "@/lib/mockData";
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

  const [refreshing, setRefreshing] = React.useState(false);

  const historyPredictions = getHistoryPredictions();

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

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
