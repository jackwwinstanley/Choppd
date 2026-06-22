import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { C } from "./src/theme";
import type { CookSession } from "./src/engine/telemetry";
import type { Recipe } from "./src/data/recipeMap";
import { getProfile, hasOnboarded } from "./src/engine/user";

import HomeScreen from "./src/screens/HomeScreen";
import CookScreen from "./src/screens/CookScreen";
import FinishScreen from "./src/screens/FinishScreen";
import PremiumScreen from "./src/screens/PremiumScreen";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import ExploreScreen from "./src/screens/ExploreScreen";
import RecipeDetailScreen from "./src/screens/RecipeDetailScreen";
import GuidedCookScreen from "./src/screens/GuidedCookScreen";

export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  Cook: { expId: string };
  Finish: { session: CookSession };
  Premium: undefined;
  Explore: undefined;
  RecipeDetail: { recipe: Recipe };
  GuidedCook: { recipe: Recipe };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: { ...DefaultTheme.colors, background: C.bg, card: C.bg, text: C.text, border: C.line, primary: C.flame2 },
};

export default function App() {
  const [initial, setInitial] = useState<"Home" | "Onboarding" | null>(null);

  useEffect(() => { getProfile().then((p) => setInitial(hasOnboarded(p) ? "Home" : "Onboarding")); }, []);

  if (!initial) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName={initial}
        screenOptions={{ headerStyle: { backgroundColor: C.bg }, headerTintColor: C.text, contentStyle: { backgroundColor: C.bg } }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "SearTune" }} />
        <Stack.Screen name="Cook" component={CookScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Finish" component={FinishScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Premium" component={PremiumScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Explore" component={ExploreScreen} options={{ headerShown: false }} />
        <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="GuidedCook" component={GuidedCookScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
