// app/_layout.tsx
import { Stack } from "expo-router";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { AuthProvider } from "@/contexts/AuthContext";
import { SitesProvider } from "@/contexts/SitesContext";

export default function RootLayout() {
    const colorScheme = useColorScheme();

    return (
        <AuthProvider>
            <SitesProvider>
                <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                    <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="(screens)" />
                        <Stack.Screen name="(auth)" />
                    </Stack>
                    <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
                </ThemeProvider>
            </SitesProvider>
        </AuthProvider>
    );
}