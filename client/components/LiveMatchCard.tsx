import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import type { LiveMatch, Sport } from "@/types";

const SPORT_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  basketball: "target",
  baseball: "circle",
  hockey: "hexagon",
  football: "globe",
  tennis: "activity",
  cricket: "disc",
  mma: "shield",
  golf: "flag",
};

const SPORT_LABELS: Record<string, string> = {
  basketball: "Basketball",
  baseball: "Baseball",
  hockey: "Hockey",
  football: "Football",
  tennis: "Tennis",
  cricket: "Cricket",
  mma: "MMA",
  golf: "Golf",
};

interface LiveMatchCardProps {
  match: LiveMatch;
  onPress?: () => void;
}

export function LiveMatchCard({ match, onPress }: LiveMatchCardProps) {
  const { theme } = useTheme();

  const sportIcon = SPORT_ICONS[match.sport] || "activity";
  const sportLabel = SPORT_LABELS[match.sport] || match.sport;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.backgroundDefault }]}
      testID={`live-match-${match.homeTeam}-${match.awayTeam}`}
    >
      <View style={styles.header}>
        <View style={styles.sportBadge}>
          <Feather name={sportIcon} size={12} color={theme.accent} />
          <ThemedText type="small" style={{ color: theme.accent, marginLeft: 4 }}>
            {match.league}
          </ThemedText>
        </View>
        <View style={[styles.liveBadge, { backgroundColor: theme.accent }]}>
          <View style={styles.liveDot} />
          <ThemedText type="small" style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 10 }}>
            LIVE
          </ThemedText>
        </View>
      </View>

      <View style={styles.scoreContainer}>
        <View style={styles.teamSection}>
          <ThemedText
            type="body"
            numberOfLines={2}
            style={[styles.teamName, { color: theme.text }]}
          >
            {match.homeTeam}
          </ThemedText>
        </View>

        <View style={styles.scoreSection}>
          <View style={styles.scoreBox}>
            <ThemedText type="h3" style={[styles.score, { color: theme.text }]}>
              {match.homeScore}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              -
            </ThemedText>
            <ThemedText type="h3" style={[styles.score, { color: theme.text }]}>
              {match.awayScore}
            </ThemedText>
          </View>
        </View>

        <View style={styles.teamSection}>
          <ThemedText
            type="body"
            numberOfLines={2}
            style={[styles.teamName, { color: theme.text, textAlign: "right" }]}
          >
            {match.awayTeam}
          </ThemedText>
        </View>
      </View>

      <View style={styles.footer}>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {match.status}
        </ThemedText>
        {match.clock ? (
          <ThemedText type="small" style={{ color: theme.accent, fontWeight: "600" }}>
            {match.clock}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: "100%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sportBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  scoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  teamSection: {
    flex: 1,
  },
  teamName: {
    fontSize: 14,
    fontWeight: "600",
  },
  scoreSection: {
    paddingHorizontal: Spacing.lg,
  },
  scoreBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  score: {
    fontSize: 28,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
