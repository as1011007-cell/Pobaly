import React from "react";
import { View, StyleSheet, Image, ImageSourcePropType } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

interface EmptyStateProps {
  image?: ImageSourcePropType;
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  description?: string;
}

export function EmptyState({ image, icon, title, description }: EmptyStateProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {image ? (
        <Image source={image} style={styles.image} resizeMode="contain" />
      ) : icon ? (
        <View style={[styles.iconContainer, { backgroundColor: theme.backgroundElevated }]}>
          <Feather name={icon} size={48} color={theme.textSecondary} />
        </View>
      ) : null}
      <ThemedText type="h4" style={styles.title}>
        {title}
      </ThemedText>
      {description ? (
        <ThemedText
          type="small"
          style={[styles.description, { color: theme.textSecondary }]}
        >
          {description}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["3xl"],
    paddingVertical: Spacing["4xl"],
  },
  image: {
    width: 160,
    height: 160,
    marginBottom: Spacing.xl,
    opacity: 0.8,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
    opacity: 0.8,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  description: {
    textAlign: "center",
    lineHeight: 22,
  },
});
