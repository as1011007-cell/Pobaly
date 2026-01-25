import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/contexts/LanguageContext";
import { Spacing, BorderRadius } from "@/constants/theme";

type ThemeMode = "light" | "dark" | "system";

interface ThemeOption {
  mode: ThemeMode;
  icon: keyof typeof Feather.glyphMap;
}

const themeOptions: ThemeOption[] = [
  { mode: "light", icon: "sun" },
  { mode: "dark", icon: "moon" },
  { mode: "system", icon: "smartphone" },
];

export default function AppearanceScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, themeMode, setThemeMode } = useTheme();
  const { t } = useLanguage();

  const getModeName = (mode: ThemeMode): string => {
    switch (mode) {
      case "light": return t.light;
      case "dark": return t.dark;
      case "system": return t.system;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight + Spacing.lg }]}>
      <View style={[styles.optionsCard, { backgroundColor: theme.backgroundDefault }]}>
        {themeOptions.map((option, index) => (
          <Pressable
            key={option.mode}
            style={[
              styles.optionRow,
              index < themeOptions.length - 1 && [styles.optionBorder, { borderBottomColor: theme.border }],
            ]}
            onPress={() => setThemeMode(option.mode)}
          >
            <View style={styles.optionLeft}>
              <View style={[styles.iconContainer, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name={option.icon} size={20} color={theme.text} />
              </View>
              <ThemedText type="body" style={styles.optionText}>
                {getModeName(option.mode)}
              </ThemedText>
            </View>
            {themeMode === option.mode && (
              <Feather name="check" size={20} color={theme.primary} />
            )}
          </Pressable>
        ))}
      </View>
      
      <ThemedText type="small" style={[styles.description, { color: theme.textSecondary }]}>
        {t.appearanceDescription}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  optionsCard: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  optionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  optionText: {
    fontWeight: "500",
  },
  description: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
});
