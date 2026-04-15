import React, { useState, useRef, useCallback } from "react";
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

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 60 * 1000;

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
    general?: string;
  }>({});
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [cooldownText, setCooldownText] = useState("");
  const lastSubmitRef = useRef(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldownTimer = useCallback((unlockTime: number) => {
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    const updateText = () => {
      const remaining = Math.max(0, Math.ceil((unlockTime - Date.now()) / 1000));
      if (remaining <= 0) {
        setCooldownText("");
        setLockedUntil(null);
        setAttempts(0);
        setErrors({});
        if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
        return;
      }
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      setCooldownText(mins > 0 ? `Try again in ${mins}m ${secs}s` : `Try again in ${secs}s`);
    };
    updateText();
    cooldownTimerRef.current = setInterval(updateText, 1000);
  }, []);

  const validate = () => {
    const newErrors: { name?: string; email?: string; password?: string } = {};
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      newErrors.name = "Name is required";
    } else if (trimmedName.length > 100) {
      newErrors.name = "Name is too long";
    }
    if (!trimmedEmail) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = "Invalid email address";
    } else if (trimmedEmail.length > 254) {
      newErrors.email = "Email is too long";
    }
    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    } else if (password.length > 128) {
      newErrors.password = "Password is too long";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (lockedUntil && Date.now() < lockedUntil) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const now = Date.now();
    if (now - lastSubmitRef.current < 1500) return;
    lastSubmitRef.current = now;

    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    try {
      await signUp(email.trim(), password, name.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAttempts(0);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errorMsg = error?.message || "";

      if (errorMsg.includes("429") || errorMsg.toLowerCase().includes("too many")) {
        const unlockTime = Date.now() + LOCKOUT_DURATION_MS;
        setLockedUntil(unlockTime);
        startCooldownTimer(unlockTime);
        setErrors({ general: "Too many attempts. Please wait before trying again." });
        return;
      }

      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= MAX_ATTEMPTS) {
        const unlockTime = Date.now() + LOCKOUT_DURATION_MS;
        setLockedUntil(unlockTime);
        startCooldownTimer(unlockTime);
        setErrors({ general: "Too many failed attempts. Please wait before trying again." });
      } else {
        let msg = "Registration failed. Please try again.";
        if (errorMsg.includes("Unable to create account")) {
          msg = "Unable to create account. Please try a different email or sign in.";
        }
        setErrors({ general: msg });
      }
    }
  };

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;
  const isDisabled = isLoading || isLocked;
  const clearErrors = () => setErrors({});

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
        {errors.general ? (
          <View style={[styles.errorBanner, { backgroundColor: theme.accent + "18" }]}>
            <ThemedText type="small" style={{ color: theme.accent }}>
              {errors.general}
            </ThemedText>
            {cooldownText ? (
              <ThemedText type="small" style={[styles.cooldownText, { color: theme.accent }]}>
                {cooldownText}
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        <TextInput
          label="Full Name"
          leftIcon="user"
          placeholder="Enter your name"
          value={name}
          onChangeText={(t) => { setName(t); clearErrors(); }}
          error={errors.name}
          autoCapitalize="words"
          autoComplete="name"
          editable={!isLocked}
          testID="input-name"
        />
        <TextInput
          label="Email"
          leftIcon="mail"
          placeholder="Enter your email"
          value={email}
          onChangeText={(t) => { setEmail(t); clearErrors(); }}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!isLocked}
          testID="input-email"
        />
        <TextInput
          label="Password"
          leftIcon="lock"
          placeholder="Create a password (min 6 characters)"
          value={password}
          onChangeText={(t) => { setPassword(t); clearErrors(); }}
          error={errors.password}
          isPassword
          autoCapitalize="none"
          autoComplete="password-new"
          editable={!isLocked}
          testID="input-password"
        />

        <Button
          onPress={handleSignUp}
          disabled={isDisabled}
          style={[styles.button, isLocked ? { opacity: 0.5 } : undefined]}
          testID="button-signup"
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : isLocked ? (
            cooldownText || "Locked"
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
  errorBanner: {
    padding: Spacing.md,
    borderRadius: 8,
    marginBottom: Spacing.lg,
  },
  cooldownText: {
    marginTop: Spacing.xs,
    fontWeight: "600",
  },
});
