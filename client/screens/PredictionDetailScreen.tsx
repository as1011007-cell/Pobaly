import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { RouteProp, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { format } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { ProbabilityBar } from "@/components/ProbabilityBar";
import { SportIcon } from "@/components/SportIcon";
import { LiveBadge } from "@/components/LiveBadge";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, BetRightColors } from "@/constants/theme";
import { fetchPredictionById } from "@/lib/predictionsApi";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { Prediction } from "@/types";

type PredictionDetailRouteProp = RouteProp<RootStackParamList, "PredictionDetail">;

export default function PredictionDetailScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<PredictionDetailRouteProp>();

  const [loading, setLoading] = useState(true);
  const [prediction, setPrediction] = useState<Prediction | null>(null);

  useEffect(() => {
    async function loadPrediction() {
      try {
        const data = await fetchPredictionById(route.params.predictionId);
        setPrediction(data);
      } catch (error) {
        console.error("Error loading prediction:", error);
      } finally {
        setLoading(false);
      }
    }
    loadPrediction();
  }, [route.params.predictionId]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={theme.accent} />
        <ThemedText type="body" style={{ marginTop: Spacing.lg, color: theme.textSecondary }}>
          Loading prediction...
        </ThemedText>
      </View>
    );
  }

  if (!prediction) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, justifyContent: "center", alignItems: "center" }]}>
        <ThemedText>Prediction not found</ThemedText>
      </View>
    );
  }

  const formattedTime = format(new Date(prediction.matchTime), "EEEE, MMM d 'at' h:mm a");

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing["2xl"],
        paddingHorizontal: Spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.sportRow}>
          <SportIcon sport={prediction.sport} size={18} color={theme.primary} />
          <ThemedText type="small" style={[styles.sportText, { color: theme.textSecondary }]}>
            {prediction.sport.charAt(0).toUpperCase() + prediction.sport.slice(1)}
          </ThemedText>
          {prediction.isLive ? <LiveBadge /> : null}
        </View>
        <ThemedText type="h2" style={styles.matchTitle}>
          {prediction.matchTitle}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {formattedTime}
        </ThemedText>
      </View>

      <LinearGradient
        colors={[BetRightColors.primary, BetRightColors.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.probabilityCard}
      >
        <ThemedText style={styles.predictionLabel}>Predicted Outcome</ThemedText>
        <ThemedText style={styles.outcome}>{prediction.predictedOutcome}</ThemedText>
        <View style={styles.probabilityRow}>
          <ThemedText style={styles.probabilityValue}>{prediction.probability}%</ThemedText>
          <ThemedText style={styles.probabilityLabel}>Probability</ThemedText>
        </View>
        <ProbabilityBar
          probability={prediction.probability}
          confidence={prediction.confidence}
          isLive={prediction.isLive}
          height={12}
        />
        <View style={styles.confidenceRow}>
          <ConfidenceBadge level={prediction.confidence} size="large" />
        </View>
      </LinearGradient>

      <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.sectionHeader}>
          <Feather name="info" size={18} color={theme.primary} />
          <ThemedText type="h4" style={styles.sectionTitle}>
            AI Analysis
          </ThemedText>
        </View>
        <ThemedText type="body" style={{ color: theme.textSecondary, lineHeight: 24 }}>
          {prediction.explanation}
        </ThemedText>
      </View>

      {prediction.factors && prediction.factors.length > 0 ? (
        <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.sectionHeader}>
            <Feather name="list" size={18} color={theme.primary} />
            <ThemedText type="h4" style={styles.sectionTitle}>
              Key Factors
            </ThemedText>
          </View>
          {prediction.factors.map((factor, index) => (
            <View key={index} style={styles.factorItem}>
              <View
                style={[
                  styles.factorIndicator,
                  {
                    backgroundColor:
                      factor.impact === "positive"
                        ? theme.success
                        : factor.impact === "negative"
                          ? theme.error
                          : theme.textSecondary,
                  },
                ]}
              />
              <View style={styles.factorContent}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {factor.title}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {factor.description}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {prediction.riskIndex !== undefined ? (
        <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.sectionHeader}>
            <Feather name="alert-triangle" size={18} color={theme.warning} />
            <ThemedText type="h4" style={styles.sectionTitle}>
              Risk Index
            </ThemedText>
          </View>
          <View style={styles.riskRow}>
            <ThemedText type="h2" style={{ color: theme.warning }}>
              {prediction.riskIndex}%
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.md }}>
              {prediction.riskIndex < 25
                ? "Low Risk"
                : prediction.riskIndex < 50
                  ? "Medium Risk"
                  : "High Risk"}
            </ThemedText>
          </View>
          <View style={styles.riskBarContainer}>
            <View
              style={[
                styles.riskBar,
                {
                  width: `${prediction.riskIndex}%`,
                  backgroundColor: theme.warning,
                },
              ]}
            />
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  sportRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  sportText: {
    fontWeight: "500",
    textTransform: "capitalize",
  },
  matchTitle: {
    marginBottom: Spacing.xs,
  },
  probabilityCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  predictionLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "500",
    marginBottom: Spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  outcome: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: Spacing.xl,
  },
  probabilityRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: Spacing.md,
  },
  probabilityValue: {
    color: "#FFFFFF",
    fontSize: 48,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  probabilityLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    marginLeft: Spacing.sm,
  },
  confidenceRow: {
    marginTop: Spacing.lg,
  },
  section: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    marginLeft: Spacing.sm,
  },
  factorItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  factorIndicator: {
    width: 4,
    height: "100%",
    minHeight: 40,
    borderRadius: 2,
    marginRight: Spacing.md,
  },
  factorContent: {
    flex: 1,
  },
  riskRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: Spacing.md,
  },
  riskBarContainer: {
    height: 8,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 4,
    overflow: "hidden",
  },
  riskBar: {
    height: "100%",
    borderRadius: 4,
  },
});
