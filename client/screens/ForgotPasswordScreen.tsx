import React, { useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { TextInput } from "@/components/TextInput";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { AuthStackParamList } from "@/navigation/AuthStackNavigator";

interface ForgotPasswordScreenProps {
  navigation: NativeStackNavigationProp<AuthStackParamList, "ForgotPassword">;
}

export default function ForgotPasswordScreen({
  navigation,
}: ForgotPasswordScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = () => {
    if (!email) {
      setError("Email is required");
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Invalid email address");
      return false;
    }
    setError("");
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setIsSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError("Failed to send reset email. Please try again.");
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
          Check your email
        </ThemedText>
        <ThemedText
          type="body"
          style={[styles.successText, { color: theme.textSecondary }]}
        >
          We've sent password reset instructions to {email}
        </ThemedText>
        <Button
          onPress={() => navigation.navigate("SignIn")}
          style={styles.backButton}
        >
          Back to Sign In
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
          Reset password
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          Enter your email and we'll send you instructions to reset your
          password
        </ThemedText>
      </View>

      <View style={styles.form}>
        <TextInput
          label="Email"
          leftIcon="mail"
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
          error={error}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          testID="input-email"
        />

        <Button
          onPress={handleSubmit}
          disabled={isLoading}
          style={styles.button}
          testID="button-reset"
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            "Send Reset Link"
          )}
        </Button>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  header: {
    marginBottom: Spacing["3xl"],
  },
  title: {
    marginBottom: Spacing.sm,
  },
  form: {
    flex: 1,
  },
  button: {
    marginTop: Spacing.md,
  },
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
  successTitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  successText: {
    textAlign: "center",
    marginBottom: Spacing["3xl"],
  },
  backButton: {
    width: "100%",
  },
});
