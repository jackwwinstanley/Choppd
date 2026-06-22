import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { C } from "./src/theme";
import type { CookSession } from "./src/engine/telemetry";
import HomeScreen from "./src/screens/HomeScreen";
import CookScreen from "./src/screens/CookScreen";
import FinishScreen from "./src/screens/FinishScreen";
import PremiumScreen from "./src/screens/PremiumScreen";

export type RootStackParamList = {
  Home: undefined;
  Cook: { expId: string };
  Finish: { session: CookSession };
  Premium: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: { ...DefaultTheme.colors, background: C.bg, card: C.bg, text: C.text, border: C.line, primary: C.flame2 },
};

export default function App() {
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: C.bg }, headerTintColor: C.text, contentStyle: { backgroundColor: C.bg } }}>
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "SearTune" }} />
        <Stack.Screen name="Cook" component={CookScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Finish" component={FinishScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Premium" component={PremiumScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
