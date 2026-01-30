import { Tabs } from 'expo-router';
import React from 'react';
import { IconSymbol } from "@/components/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import { HapticTab } from "@/app-example/components/haptic-tab";
import { useAuth } from '@/contexts/AuthContext';

export default function ScreenLayout() {
    const colorScheme = useColorScheme();
    const { token } = useAuth();

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
                headerShown: false,
                tabBarButton: HapticTab,
            }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Главная',
                    tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
                }}
            />
            <Tabs.Screen
                name="sites"
                options={{
                    title: 'Сайты',
                    tabBarIcon: ({ color }) => <IconSymbol size={28} name="globe" color={color} />,
                }}
            />
            {token && (
                <Tabs.Screen
                    name="favorites"
                    options={{
                        title: 'Избранное',
                        tabBarIcon: ({ color }) => <IconSymbol size={28} name="star.fill" color={color} />,
                    }}
                />
            )}
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Профиль',
                    tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
                }}
            />
        </Tabs>
    );
}