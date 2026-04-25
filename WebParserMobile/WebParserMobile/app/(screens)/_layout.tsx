// app/(screens)/_layout.tsx
import { Tabs, useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";
import { HapticTab } from "@/app-example/components/haptic-tab";
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useAuthInterceptor } from '@/hooks/useAuthInterceptor';

// Компонент для управления вкладкой избранного
function AuthAwareTabs() {
    const colorScheme = useColorScheme();
    const { token } = useAuth();
    const router = useRouter();
    const segments = useSegments();

    // Используем интерцептор для автоматического обновления токенов
    useAuthInterceptor();

    // При изменении токена проверяем текущий экран
    useEffect(() => {
        if (!token && segments.includes('favorites')) {
            // Если пользователь вышел и находится на экране избранного,
            // перенаправляем на главную
            router.replace('/(screens)');
        }
    }, [token, segments]);

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
                tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
                headerShown: false,
                tabBarButton: HapticTab,
                tabBarStyle: {
                    backgroundColor: colorScheme === 'dark' ? '#000000' : '#ffffff',
                    borderTopColor: colorScheme === 'dark' ? '#333333' : '#e0e0e0',
                },
            }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Главная',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="home" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="sites"
                options={{
                    title: 'Сайты',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="globe-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Профиль',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="person-outline" size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}

export default function ScreenLayout() {
    return <AuthAwareTabs />;
}