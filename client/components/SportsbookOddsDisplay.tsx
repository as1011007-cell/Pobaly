import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { SportsbookOdds } from "@/types";

interface SportsbookOddsDisplayProps {
  odds: SportsbookOdds;
  compact?: boolean;
}

export function SportsbookOddsDisplay({ odds, compact = false }: SportsbookOddsDisplayProps) {
  const { theme } = useTheme();

  const formatOdds = (americanOdds: number) => {
    return americanOdds > 0 ? `+${americanOdds}` : `${americanOdds}`;
  };

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: theme.backgroundSecondary }]}>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          Sportsbook Consensus
        </ThemedText>
        <ThemedText type="body" style={[styles.consensusText, { color: theme.success }]}>
          {odds.consensus}% agree
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundSecondary }]}>
      <View style={styles.header}>
        <ThemedText type="small" style={[styles.headerText, { color: theme.primary }]}>
          Sportsbook Consensus
        </ThemedText>
        <View style={[styles.consensusBadge, { backgroundColor: theme.success }]}>
          <ThemedText type="small" style={styles.consensusBadgeText}>
            {odds.consensus}%+ agree
          </ThemedText>
        </View>
      </View>
      
      <View style={styles.booksContainer}>
        {odds.books.slice(0, 5).map((book, index) => (
          <View key={index} style={styles.bookRow}>
            <ThemedText type="small" style={{ color: theme.text, flex: 1 }}>
              {book.name}
            </ThemedText>
            <ThemedText type="small" style={[styles.oddsText, { color: theme.success }]}>
              {formatOdds(book.odds)}
            </ThemedText>
            <ThemedText type="small" style={[styles.probText, { color: theme.textSecondary }]}>
              {book.impliedProb}%
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  compactContainer: {
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  headerText: {
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  consensusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  consensusBadgeText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  consensusText: {
    fontWeight: "700",
  },
  booksContainer: {
    gap: Spacing.xs,
  },
  bookRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  oddsText: {
    fontWeight: "600",
    width: 60,
    textAlign: "right",
  },
  probText: {
    width: 40,
    textAlign: "right",
  },
});
