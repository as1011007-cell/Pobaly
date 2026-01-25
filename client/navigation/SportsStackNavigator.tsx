import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import SportsScreen from "@/screens/SportsScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type SportsStackParamList = {
  Sports: undefined;
};

const Stack = createNativeStackNavigator<SportsStackParamList>();

export default function SportsStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Sports"
        component={SportsScreen}
        options={{ title: "Sports" }}
      />
    </Stack.Navigator>
  );
}
