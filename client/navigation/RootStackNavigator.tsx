import React from "react";
import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import MainTabNavigator from "@/navigation/MainTabNavigator";
import AuthStackNavigator from "@/navigation/AuthStackNavigator";
import PredictionDetailScreen from "@/screens/PredictionDetailScreen";
import SportDetailScreen from "@/screens/SportDetailScreen";
import SubscriptionScreen from "@/screens/SubscriptionScreen";
import TermsOfServiceScreen from "@/screens/TermsOfServiceScreen";
import PrivacyPolicyScreen from "@/screens/PrivacyPolicyScreen";
import LanguageSelectScreen from "@/screens/LanguageSelectScreen";
import AppearanceScreen from "@/screens/AppearanceScreen";
import AffiliateScreen from "@/screens/AffiliateScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/contexts/LanguageContext";
import { Sport } from "@/types";

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  PredictionDetail: { predictionId: string };
  SportDetail: { sport: Sport };
  Subscription: undefined;
  TermsOfService: undefined;
  PrivacyPolicy: undefined;
  LanguageSelect: undefined;
  Appearance: undefined;
  Affiliate: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { isAuthenticated, isLoading } = useAuth();
  const { theme } = useTheme();
  const { t, isLoading: languageLoading } = useLanguage();

  if (isLoading || languageLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.backgroundRoot,
        }}
      >
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {isAuthenticated ? (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="PredictionDetail"
            component={PredictionDetailScreen}
            options={{ title: "Prediction" }}
          />
          <Stack.Screen
            name="SportDetail"
            component={SportDetailScreen}
            options={({ route }) => ({
              title: route.params.sport.charAt(0).toUpperCase() + route.params.sport.slice(1),
            })}
          />
          <Stack.Screen
            name="Subscription"
            component={SubscriptionScreen}
            options={{
              presentation: "modal",
              title: "Premium",
            }}
          />
          <Stack.Screen
            name="TermsOfService"
            component={TermsOfServiceScreen}
            options={{ title: "Terms of Service" }}
          />
          <Stack.Screen
            name="PrivacyPolicy"
            component={PrivacyPolicyScreen}
            options={{ title: t.privacyPolicy }}
          />
          <Stack.Screen
            name="LanguageSelect"
            component={LanguageSelectScreen}
            options={{ title: t.language }}
          />
          <Stack.Screen
            name="Appearance"
            component={AppearanceScreen}
            options={{ title: t.appearance }}
          />
          <Stack.Screen
            name="Affiliate"
            component={AffiliateScreen}
            options={{ title: "Affiliate Program" }}
          />
        </>
      ) : (
        <Stack.Screen
          name="Auth"
          component={AuthStackNavigator}
          options={{ headerShown: false }}
        />
      )}
    </Stack.Navigator>
  );
}
