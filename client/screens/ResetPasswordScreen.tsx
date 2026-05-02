import React, { useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { TextInput } from "@/components/TextInput";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { AuthStackParamList } from "@/navigation/AuthStackNavigator";
import { apiRequest } from "@/lib/query-client";

interface ResetPasswordScreenProps {
  navigation: NativeStackNavigationProp<AuthStackParamList, "ResetPassword">;
  route: RouteProp<AuthStackParamList, "ResetPassword">;
}

export default function ResetPasswordScreen({
  navigation,
  route,
}: ResetPasswordScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const token = route.params?.token ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!token) {
      setError("This reset link is missing its token. Open the link from your email again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/auth/reset-password", { token, password });
      setIsSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      const message =
        typeof err?.message === "string" && err.message.length < 200
          ? err.message
          : "Could not reset password. Please request a new link.";
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <View
        style={[
          styles.successContainer,
          {
            backgroundColor: theme.backgroundRoot,
            paddingTop: headerHeight + Spacing["3xl"],
            paddingBottom: insets.bottom + Spacing["2xl"],
          },
        ]}
      >
        <View style={[styles.successIcon, { backgroundColor: `${theme.success}15` }]}>
          <ThemedText style={{ fontSize: 48 }}>✓</ThemedText>
        </View>
        <ThemedText type="h3" style={styles.successTitle}>
          Password reset
        </ThemedText>
        <ThemedText
          type="body"
          style={[styles.successText, { color: theme.textSecondary }]}
        >
          Your password has been updated. Sign in with your new password.
        </ThemedText>
        <Button
          onPress={() => navigation.navigate("SignIn")}
          style={styles.backButton}
          testID="button-go-signin"
        >
          Go to Sign In
        </Button>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.contentContainer,
        {
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing["2xl"],
        },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <ThemedText type="h2" style={styles.title}>
          Choose a new password
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          Enter a new password for your Probaly account. Must be at least 6
          characters.
        </ThemedText>
      </View>

      <View style={styles.form}>
        <TextInput
          label="New password"
          leftIcon="lock"
          placeholder="Enter new password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          testID="input-new-password"
        />
        <TextInput
          label="Confirm new password"
          leftIcon="lock"
          placeholder="Re-enter new password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          error={error}
          testID="input-confirm-password"
        />

        <Button
          onPress={handleSubmit}
          disabled={isLoading}
          style={styles.button}
          testID="button-reset-confirm"
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            "Reset Password"
          )}
        </Button>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { flexGrow: 1, paddingHorizontal: Spacing.xl },
  header: { marginBottom: Spacing["3xl"] },
  title: { marginBottom: Spacing.sm },
  form: { flex: 1 },
  button: { marginTop: Spacing.md },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  successTitle: { textAlign: "center", marginBottom: Spacing.md },
  successText: { textAlign: "center", marginBottom: Spacing["3xl"] },
  backButton: { width: "100%" },
});
