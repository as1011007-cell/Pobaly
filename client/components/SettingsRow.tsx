import React from "react";
import { View, StyleSheet, Pressable, Switch } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

interface SettingsRowProps {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  value?: string;
  hasChevron?: boolean;
  hasSwitch?: boolean;
  switchValue?: boolean;
  onPress?: () => void;
  onSwitchChange?: (value: boolean) => void;
  destructive?: boolean;
  rightElement?: React.ReactNode;
}

export function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  hasChevron = false,
  hasSwitch = false,
  switchValue = false,
  onPress,
  onSwitchChange,
  destructive = false,
  rightElement,
}: SettingsRowProps) {
  const { theme } = useTheme();

  const textColor = destructive ? theme.error : theme.text;

  return (
    <Pressable
      style={[styles.container, { borderBottomColor: theme.border }]}
      onPress={hasSwitch ? undefined : onPress}
    >
      {icon ? (
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: destructive ? `${theme.error}15` : `${theme.primary}15` },
          ]}
        >
          <Feather
            name={icon}
            size={18}
            color={destructive ? theme.error : theme.primary}
          />
        </View>
      ) : null}

      <View style={styles.content}>
        <ThemedText type="body" style={[styles.title, { color: textColor }]}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>

      {value ? (
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {value}
        </ThemedText>
      ) : null}

      {rightElement ? rightElement : null}

      {hasSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor="#FFFFFF"
        />
      ) : null}

      {hasChevron && !rightElement ? (
        <Feather
          name="chevron-right"
          size={20}
          color={theme.textSecondary}
          style={styles.chevron}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    fontWeight: "500",
  },
  chevron: {
    marginLeft: Spacing.sm,
  },
});
