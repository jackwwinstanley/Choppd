import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useFonts } from "expo-font";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { InstrumentSans_600SemiBold, InstrumentSans_700Bold } from "@expo-google-fonts/instrument-sans";

import { applyGlobalFont } from "./src/fonts";
import { C, F } from "./src/theme";
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
import SettingsScreen from "./src/screens/SettingsScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import SessionLogScreen from "./src/screens/SessionLogScreen";

export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  Cook: { expId: string };
  Finish: { session: CookSession };
  Premium: undefined;
  Explore: undefined;
  RecipeDetail: { recipe: Recipe };
  GuidedCook: { recipe: Recipe };
  Settings: undefined;
  Profile: undefined;
  SessionLog: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: { ...DefaultTheme.colors, background: C.bg, card: C.bg, text: C.text, border: C.line, primary: C.flame2 },
};

export default function App() {
  const [initial, setInitial] = useState<"Home" | "Onboarding" | null>(null);
  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    InstrumentSans_600SemiBold, InstrumentSans_700Bold,
  });
  if (fontsLoaded) applyGlobalFont();

  useEffect(() => { getProfile().then((p) => setInitial(hasOnboarded(p) ? "Home" : "Onboarding")); }, []);

  if (!initial || !fontsLoaded) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName={initial}
        screenOptions={{ headerStyle: { backgroundColor: C.bg }, headerTintColor: C.text, headerTitleStyle: { fontFamily: F.display }, contentStyle: { backgroundColor: C.bg } }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "SearTune" }} />
        <Stack.Screen name="Cook" component={CookScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Finish" component={FinishScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Premium" component={PremiumScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Explore" component={ExploreScreen} options={{ headerShown: false }} />
        <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="GuidedCook" component={GuidedCookScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
        <Stack.Screen name="SessionLog" component={SessionLogScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
