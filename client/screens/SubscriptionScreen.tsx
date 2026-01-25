import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Image, ActivityIndicator, Linking, Platform, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { BorderRadius, Spacing, ProbalyColors } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

const features = [
  { icon: "unlock", title: "All Daily Predictions", description: "Access every AI prediction" },
  { icon: "activity", title: "Live Match Updates", description: "Real-time probability changes" },
  { icon: "filter", title: "Advanced Filters", description: "High confidence only filter" },
  { icon: "clock", title: "Full History", description: "Track all past predictions" },
  { icon: "bar-chart-2", title: "Analytics Dashboard", description: "Performance insights" },
];

interface StripePrice {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string } | null;
}

interface StripeProduct {
  id: string;
  name: string;
  description: string;
  prices: StripePrice[];
}

type PlanType = "monthly" | "yearly";

export default function SubscriptionScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { user, isPremium, refreshUser } = useAuth();
  const [isRestoring, setIsRestoring] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>("yearly");

  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<StripeProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/products-with-prices", baseUrl);
      const response = await fetch(url.toString());
      const data = await response.json();
      setProducts(data.data || []);
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleSubscribe = async () => {
    if (!user) return;

    const premiumProduct = products.find((p) => p.name.toLowerCase().includes("premium"));
    const interval = selectedPlan === "yearly" ? "year" : "month";
    const selectedPrice = premiumProduct?.prices.find(
      (p) => p.recurring?.interval === interval
    );

    if (!selectedPrice) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/checkout", {
        userId: user.id,
        priceId: selectedPrice.id,
      });
      const data = await response.json();

      if (data.url) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        if (Platform.OS === "web") {
          window.location.href = data.url;
        } else {
          await WebBrowser.openBrowserAsync(data.url);
          await refreshUser();
        }
      }
    } catch (error) {
      console.error("Checkout error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPlan = (plan: PlanType) => {
    setSelectedPlan(plan);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRestorePurchases = async () => {
    if (!user) return;
    
    setIsRestoring(true);
    try {
      await refreshUser();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (isPremium) {
        Alert.alert("Success", "Your subscription has been restored!");
      } else {
        Alert.alert("No Subscription Found", "We couldn't find an active subscription for your account.");
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to restore purchases. Please try again.");
    } finally {
      setIsRestoring(false);
    }
  };

  if (isPremium) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.backgroundRoot,
            paddingTop: headerHeight + Spacing["3xl"],
          },
        ]}
      >
        <View style={styles.successContent}>
          <View style={[styles.successIcon, { backgroundColor: `${theme.success}15` }]}>
            <Feather name="check-circle" size={48} color={theme.success} />
          </View>
          <ThemedText type="h3" style={styles.successTitle}>
            You're already Premium!
          </ThemedText>
          <ThemedText
            type="body"
            style={{ color: theme.textSecondary, textAlign: "center" }}
          >
            You have full access to all predictions and features.
          </ThemedText>
        </View>
      </View>
    );
  }

  const premiumProduct = products.find((p) => p.name.toLowerCase().includes("premium"));
  const monthlyPrice = premiumProduct?.prices.find(
    (p) => p.recurring?.interval === "month"
  );
  const yearlyPrice = premiumProduct?.prices.find(
    (p) => p.recurring?.interval === "year"
  );

  const monthlyAmount = monthlyPrice ? monthlyPrice.unit_amount / 100 : 49;
  const yearlyAmount = yearlyPrice ? yearlyPrice.unit_amount / 100 : 149;
  const monthlyOriginal = 99;
  const yearlyOriginal = 399;
  const monthlySavings = Math.round(((monthlyOriginal - monthlyAmount) / monthlyOriginal) * 100);
  const yearlySavings = Math.round(((yearlyOriginal - yearlyAmount) / yearlyOriginal) * 100);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: insets.bottom + Spacing["2xl"],
        paddingHorizontal: Spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Image
          source={require("../../assets/images/premium-unlock.png")}
          style={styles.headerImage}
          resizeMode="contain"
        />
        <ThemedText type="h2" style={styles.title}>
          Unlock All Predictions
        </ThemedText>
        <ThemedText
          type="body"
          style={{ color: theme.textSecondary, textAlign: "center" }}
        >
          Get unlimited access to AI-powered sports predictions
        </ThemedText>
      </View>

      <View style={styles.featuresSection}>
        {features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <View style={[styles.featureIcon, { backgroundColor: `${theme.primary}15` }]}>
              <Feather
                name={feature.icon as keyof typeof Feather.glyphMap}
                size={20}
                color={theme.primary}
              />
            </View>
            <View style={styles.featureContent}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {feature.title}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {feature.description}
              </ThemedText>
            </View>
            <Feather name="check" size={20} color={theme.success} />
          </View>
        ))}
      </View>

      <View style={styles.plansContainer}>
        <Pressable
          onPress={() => handleSelectPlan("monthly")}
          style={[
            styles.planCard,
            { 
              backgroundColor: theme.backgroundDefault,
              borderColor: selectedPlan === "monthly" ? theme.primary : theme.border,
              borderWidth: selectedPlan === "monthly" ? 2 : 1,
            },
          ]}
        >
          <View style={styles.planHeader}>
            <ThemedText type="body" style={{ fontWeight: "700" }}>Monthly</ThemedText>
            <View style={[styles.savingsBadge, { backgroundColor: `${theme.success}15` }]}>
              <ThemedText style={[styles.savingsText, { color: theme.success }]}>
                Save {monthlySavings}%
              </ThemedText>
            </View>
          </View>
          <View style={styles.planPriceRow}>
            <ThemedText style={[styles.originalPrice, { color: theme.textSecondary }]}>
              ${monthlyOriginal}
            </ThemedText>
            <ThemedText type="h2" style={{ color: theme.text }}>
              ${monthlyAmount}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>/month</ThemedText>
          </View>
          {selectedPlan === "monthly" && (
            <View style={[styles.selectedIndicator, { backgroundColor: theme.primary }]}>
              <Feather name="check" size={14} color="#FFFFFF" />
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={() => handleSelectPlan("yearly")}
          style={[
            styles.planCard,
            { 
              backgroundColor: theme.backgroundDefault,
              borderColor: selectedPlan === "yearly" ? theme.primary : theme.border,
              borderWidth: selectedPlan === "yearly" ? 2 : 1,
            },
          ]}
        >
          <View style={styles.bestValueBadge}>
            <ThemedText style={styles.bestValueText}>BEST VALUE</ThemedText>
          </View>
          <View style={styles.planHeader}>
            <ThemedText type="body" style={{ fontWeight: "700" }}>Yearly</ThemedText>
            <View style={[styles.savingsBadge, { backgroundColor: `${theme.success}15` }]}>
              <ThemedText style={[styles.savingsText, { color: theme.success }]}>
                Save {yearlySavings}%
              </ThemedText>
            </View>
          </View>
          <View style={styles.planPriceRow}>
            <ThemedText style={[styles.originalPrice, { color: theme.textSecondary }]}>
              ${yearlyOriginal}
            </ThemedText>
            <ThemedText type="h2" style={{ color: theme.text }}>
              ${yearlyAmount}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>/year</ThemedText>
          </View>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
            Only ${Math.round(yearlyAmount / 12)}/month
          </ThemedText>
          {selectedPlan === "yearly" && (
            <View style={[styles.selectedIndicator, { backgroundColor: theme.primary }]}>
              <Feather name="check" size={14} color="#FFFFFF" />
            </View>
          )}
        </Pressable>
      </View>

      <Button
        onPress={handleSubscribe}
        disabled={isLoading || loadingProducts}
        style={styles.subscribeButton}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          `Start ${selectedPlan === "yearly" ? "Annual" : "Monthly"} Subscription`
        )}
      </Button>

      <View style={styles.footer}>
        <ThemedText
          type="small"
          style={{ color: theme.textSecondary, textAlign: "center", lineHeight: 20 }}
        >
          Cancel anytime. By subscribing, you agree to our Terms of Service and
          Privacy Policy.
        </ThemedText>
        <View style={styles.footerLinks}>
          <Pressable onPress={handleRestorePurchases} disabled={isRestoring} testID="button-restore">
            <ThemedText type="small" style={{ color: theme.accent }}>
              {isRestoring ? "Restoring..." : "Restore Purchase"}
            </ThemedText>
          </Pressable>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {" "}•{" "}
          </ThemedText>
          <Pressable onPress={() => navigation.navigate("TermsOfService")} testID="link-terms">
            <ThemedText type="small" style={{ color: theme.accent }}>
              Terms
            </ThemedText>
          </Pressable>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {" "}•{" "}
          </ThemedText>
          <Pressable onPress={() => navigation.navigate("PrivacyPolicy")} testID="link-privacy">
            <ThemedText type="small" style={{ color: theme.accent }}>
              Privacy
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  headerImage: {
    width: 120,
    height: 120,
    marginBottom: Spacing.xl,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  featuresSection: {
    marginBottom: Spacing["2xl"],
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  featureContent: {
    flex: 1,
  },
  plansContainer: {
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  planCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    position: "relative",
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  planPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.sm,
  },
  originalPrice: {
    fontSize: 16,
    textDecorationLine: "line-through",
  },
  savingsBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  savingsText: {
    fontSize: 11,
    fontWeight: "700",
  },
  bestValueBadge: {
    position: "absolute",
    top: -10,
    right: Spacing.lg,
    backgroundColor: "#E53935",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  bestValueText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  selectedIndicator: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  subscribeButton: {
    marginBottom: Spacing.xl,
  },
  footer: {
    alignItems: "center",
  },
  footerLinks: {
    flexDirection: "row",
    marginTop: Spacing.md,
  },
  successContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  successTitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
});
