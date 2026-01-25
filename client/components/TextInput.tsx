import React, { useState } from "react";
import {
  View,
  TextInput as RNTextInput,
  StyleSheet,
  TextInputProps as RNTextInputProps,
  Pressable,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";

interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Feather.glyphMap;
  isPassword?: boolean;
}

export function TextInput({
  label,
  error,
  leftIcon,
  isPassword = false,
  style,
  ...props
}: TextInputProps) {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const borderColor = error
    ? theme.error
    : isFocused
      ? theme.primary
      : theme.border;

  return (
    <View style={styles.container}>
      {label ? (
        <ThemedText type="small" style={styles.label}>
          {label}
        </ThemedText>
      ) : null}
      <View
        style={[
          styles.inputContainer,
          { backgroundColor: theme.backgroundDefault, borderColor },
        ]}
      >
        {leftIcon ? (
          <Feather
            name={leftIcon}
            size={20}
            color={theme.textSecondary}
            style={styles.leftIcon}
          />
        ) : null}
        <RNTextInput
          style={[
            styles.input,
            { color: theme.text },
            leftIcon && styles.inputWithLeftIcon,
            isPassword && styles.inputWithRightIcon,
            style,
          ]}
          placeholderTextColor={theme.textSecondary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPassword && !showPassword}
          {...props}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setShowPassword(!showPassword)}
            style={styles.rightIcon}
          >
            <Feather
              name={showPassword ? "eye-off" : "eye"}
              size={20}
              color={theme.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <ThemedText type="small" style={[styles.error, { color: theme.error }]}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontWeight: "500",
    marginBottom: Spacing.sm,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    height: Spacing.inputHeight,
  },
  input: {
    flex: 1,
    height: "100%",
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  inputWithRightIcon: {
    paddingRight: 0,
  },
  leftIcon: {
    marginLeft: Spacing.lg,
    marginRight: Spacing.sm,
  },
  rightIcon: {
    padding: Spacing.md,
  },
  error: {
    marginTop: Spacing.xs,
  },
});
