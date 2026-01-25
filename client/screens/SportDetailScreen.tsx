import React from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { PredictionCard } from "@/components/PredictionCard";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing } from "@/constants/theme";
import { getPredictionsBySport } from "@/lib/mockData";
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
  const { isPremium } = useAuth();

  const predictions = getPredictionsBySport(route.params.sport);

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
