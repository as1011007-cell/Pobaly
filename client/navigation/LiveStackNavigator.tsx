import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LiveScreen from "@/screens/LiveScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type LiveStackParamList = {
  Live: undefined;
};

const Stack = createNativeStackNavigator<LiveStackParamList>();

export default function LiveStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Live"
        component={LiveScreen}
        options={{ title: "Live Events" }}
      />
    </Stack.Navigator>
  );
}
