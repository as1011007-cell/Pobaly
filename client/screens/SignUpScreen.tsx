import React, { useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { TextInput } from "@/components/TextInput";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing } from "@/constants/theme";
import { AuthStackParamList } from "@/navigation/AuthStackNavigator";

interface SignUpScreenProps {
  navigation: NativeStackNavigationProp<AuthStackParamList, "SignUp">;
}

export default function SignUpScreen({ navigation }: SignUpScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { signUp, isLoading } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});

  const validate = () => {
    const newErrors: { name?: string; email?: string; password?: string } = {};
    if (!name) {
      newErrors.name = "Name is required";
    }
    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Invalid email address";
    }
    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    try {
      await signUp(email, password, name);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrors({ email: "Registration failed. Please try again." });
    }
  };

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
          Create account
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary }}>
          Start your journey with AI-powered predictions
        </ThemedText>
      </View>

      <View style={styles.form}>
        <TextInput
          label="Full Name"
          leftIcon="user"
          placeholder="Enter your name"
          value={name}
          onChangeText={setName}
          error={errors.name}
          autoCapitalize="words"
          autoComplete="name"
          testID="input-name"
        />
        <TextInput
          label="Email"
          leftIcon="mail"
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          testID="input-email"
        />
        <TextInput
          label="Password"
          leftIcon="lock"
          placeholder="Create a password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          isPassword
          autoCapitalize="none"
          autoComplete="password-new"
          testID="input-password"
        />

        <Button
          onPress={handleSignUp}
          disabled={isLoading}
          style={styles.button}
          testID="button-signup"
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            "Create Account"
          )}
        </Button>

        <ThemedText
          type="small"
          style={[styles.terms, { color: theme.textSecondary }]}
        >
          By signing up, you agree to our Terms of Service and Privacy Policy
        </ThemedText>
      </View>

      <View style={styles.footer}>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          Already have an account?{" "}
        </ThemedText>
        <Pressable onPress={() => navigation.navigate("SignIn")}>
          <ThemedText type="small" style={{ color: theme.accent, fontWeight: "600" }}>
            Sign In
          </ThemedText>
        </Pressable>
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
  terms: {
    textAlign: "center",
    marginTop: Spacing.lg,
    lineHeight: 20,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
  },
});
