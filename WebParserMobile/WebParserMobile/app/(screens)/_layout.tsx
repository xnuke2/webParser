// app/(screens)/_layout.tsx
import { Tabs, useRouter, useSegments } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { Colors } from "@/constants/theme";
import { HapticTab } from "@/app-example/components/haptic-tab";
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useAuthInterceptor } from '@/hooks/useAuthInterceptor';
import { useTheme } from '@/contexts/ThemeContext';

function AuthAwareTabs() {
    const { isDark } = useTheme();
    const colorScheme = isDark ? 'dark' : 'light';
    const { token, userData } = useAuth();
    const router = useRouter();
    const segments = useSegments();

    useAuthInterceptor();

    const canAddSite = useMemo(() => {
        if (!token) return false;
        const role = userData?.role;
        return role === 'Администратор' || role === 'Редактор';
    }, [token, userData?.role]);

    useEffect(() => {
        if (!token && (segments as string[]).includes('favorites')) {
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
                sceneStyle: {
                    backgroundColor: colorScheme === 'dark' ? '#000000' : '#f8f9fa',
                },
                animation: 'fade',
            }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Объявления',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="list" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="add-site"
                listeners={{
                    tabPress: (e) => {
                        e.preventDefault();
                        router.replace('/(screens)/add-site');
                    },
                }}
                options={canAddSite ? {
                    title: 'Добавить',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="add-circle-outline" size={size} color={color} />
                    ),
                } : { href: null }}
            />
            <Tabs.Screen
                name="sites"
                options={{ href: null }}
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
            <Tabs.Screen
                name="admin-users"
                options={{ href: null }}
            />
            <Tabs.Screen
                name="edit-site"
                options={{ href: null }}
            />
        </Tabs>
    );
}

export default function ScreenLayout() {
    return <AuthAwareTabs />;
}
