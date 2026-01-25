import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <ThemedText type="h3" style={styles.title}>
        Privacy Policy
      </ThemedText>
      <ThemedText type="small" style={[styles.lastUpdated, { color: theme.textSecondary }]}>
        Last updated: January 2026
      </ThemedText>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          1. Information We Collect
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          We collect information you provide directly, including: email address, name, and payment information for premium subscriptions. We also collect usage data such as app interactions and prediction history.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          2. How We Use Your Information
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          We use your information to: provide and maintain our service, process transactions, send notifications about predictions, improve our AI algorithms, and communicate with you about updates and promotions.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          3. Data Storage and Security
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          Your data is stored securely in cloud databases with encryption at rest and in transit. We implement industry-standard security measures to protect your personal information from unauthorized access.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          4. Third-Party Services
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          We use trusted third-party services including: Stripe for payment processing, OpenAI for AI predictions, and analytics services for app improvement. These providers have their own privacy policies.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          5. Data Retention
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          We retain your personal data for as long as your account is active or as needed to provide services. You can request deletion of your account and associated data at any time.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          6. Your Rights
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          You have the right to: access your personal data, correct inaccurate information, request deletion of your data, object to processing, and export your data in a portable format.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          7. Cookies and Tracking
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          We use cookies and similar technologies to improve your experience, analyze usage patterns, and personalize content. You can control cookie preferences through your device settings.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          8. Children's Privacy
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          BetRight is not intended for users under 18 years of age. We do not knowingly collect personal information from children. If we become aware of such collection, we will delete the information immediately.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          9. Changes to Privacy Policy
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notification.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="h4" style={styles.sectionTitle}>
          10. Contact Us
        </ThemedText>
        <ThemedText type="body" style={[styles.paragraph, { color: theme.textSecondary }]}>
          For privacy-related inquiries, please contact us at privacy@betright.app
        </ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: Spacing.xs,
  },
  lastUpdated: {
    marginBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
  },
  paragraph: {
    lineHeight: 24,
  },
});
