import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Image, ActivityIndicator, Linking, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";

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

export default function SubscriptionScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { user, isPremium, refreshUser } = useAuth();

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
    const annualPrice = premiumProduct?.prices.find(
      (p) => p.recurring?.interval === "year"
    );

    if (!annualPrice) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/checkout", {
        userId: user.id,
        priceId: annualPrice.id,
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
  const annualPrice = premiumProduct?.prices.find(
    (p) => p.recurring?.interval === "year"
  );
  const displayPrice = annualPrice ? annualPrice.unit_amount / 100 : 49;

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

      <LinearGradient
        colors={[BetRightColors.primary, BetRightColors.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.priceCard}
      >
        <View style={styles.priceBadge}>
          <ThemedText style={styles.priceBadgeText}>BEST VALUE</ThemedText>
        </View>
        <View style={styles.priceRow}>
          <ThemedText style={styles.currency}>$</ThemedText>
          <ThemedText style={styles.price}>{Math.floor(displayPrice)}</ThemedText>
          <ThemedText style={styles.period}>/year</ThemedText>
        </View>
        <ThemedText style={styles.priceSubtitle}>
          Less than $1 per week
        </ThemedText>
      </LinearGradient>

      <Button
        onPress={handleSubscribe}
        disabled={isLoading || loadingProducts}
        style={styles.subscribeButton}
        testID="button-subscribe"
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          "Start Annual Subscription"
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
          <ThemedText type="small" style={{ color: theme.accent }}>
            Restore Purchase
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {" "}
            •{" "}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.accent }}>
            Terms
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {" "}
            •{" "}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.accent }}>
            Privacy
          </ThemedText>
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
  priceCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  priceBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  priceBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.xs,
  },
  currency: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "600",
    marginTop: Spacing.sm,
  },
  price: {
    color: "#FFFFFF",
    fontSize: 56,
    fontWeight: "700",
    lineHeight: 56,
  },
  period: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 18,
    marginTop: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  priceSubtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
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
