// app/_layout.tsx
import { Stack } from "expo-router";
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/contexts/AuthContext";
import { SitesProvider } from "@/contexts/SitesContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";

function AppShell() {
    const { isDark } = useTheme();

    return (
        <NavThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(screens)" />
                <Stack.Screen
                    name="(auth)"
                    options={{
                        animation: 'slide_from_right',
                    }}
                />
            </Stack>
            <StatusBar style={isDark ? 'light' : 'dark'} />
        </NavThemeProvider>
    );
}

export default function RootLayout() {
    return (
        <SafeAreaProvider>
            <ThemeProvider>
                <AuthProvider>
                    <SitesProvider>
                        <AppShell />
                    </SitesProvider>
                </AuthProvider>
            </ThemeProvider>
        </SafeAreaProvider>
    );
}
