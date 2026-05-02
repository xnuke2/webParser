import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    RefreshControl,
    Switch,
} from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';

export default function ProfileScreen() {
    const { token, signOut, userData, fetchUserInfo, isUserInfoLoading, isLoading } = useAuth();
    const { isDark, toggleTheme } = useTheme();
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string>('');
    const [infoLoaded, setInfoLoaded] = useState(false);

    const s = isDark ? darkStyles : lightStyles;

    useEffect(() => {
        if (token && !infoLoaded) {
            const timer = setTimeout(() => {
                loadUserInfo();
                setInfoLoaded(true);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [token, infoLoaded]);

    const loadUserInfo = async () => {
        try {
            await fetchUserInfo();
            setLastUpdated(new Date().toLocaleTimeString());
        } catch (error) {
            console.error('Error loading user info:', error);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadUserInfo();
        setRefreshing(false);
    };

    const handleLogin = () => router.push('/(auth)/login');
    const handleRegister = () => router.push('/(auth)/register');

    const handleLogout = () => {
        Alert.alert(
            'Выход',
            'Вы уверены, что хотите выйти?',
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Выйти',
                    style: 'destructive',
                    onPress: () => {
                        signOut();
                        setLastUpdated('');
                        setInfoLoaded(false);
                    }
                }
            ]
        );
    };

    const isAdmin = userData?.role === 'Администратор';

    const getRoleIcon = () => {
        if (!userData?.role) return 'user';
        return isAdmin ? 'shield' : 'user-check';
    };

    const getRoleColor = () => {
        if (!userData?.role) return '#4a6fa5';
        return isAdmin ? '#e74c3c' : '#27ae60';
    };

    const getRoleDescription = () => {
        if (!userData?.role) return 'Пользователь';
        return isAdmin ? 'Администратор' : 'Обычный пользователь';
    };

    if (isLoading) {
        return (
            <SafeAreaView style={s.container}>
                <StatusBar style={isDark ? 'light' : 'dark'} />
                <View style={s.loadingContainer}>
                    <ActivityIndicator size="large" color="#4a6fa5" />
                    <Text style={s.loadingText}>Загрузка профиля...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={s.container}>
            <StatusBar style={isDark ? 'light' : 'dark'} />

            <ScrollView
                contentContainerStyle={s.content}
                refreshControl={
                    token ? (
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={['#4a6fa5']}
                            tintColor="#4a6fa5"
                        />
                    ) : undefined
                }
            >
                {/* Шапка */}
                <View style={s.header}>
                    <View style={s.headerPlaceholder} />
                    <Text style={s.title}>Профиль</Text>
                    <View style={s.headerPlaceholder} />
                </View>

                {/* Основная карточка */}
                <View style={s.profileCard}>
                    {token ? (
                        <>
                            <View style={s.avatarSection}>
                                <View style={[s.avatar, { backgroundColor: getRoleColor() }]}>
                                    <Text style={s.avatarText}>
                                        {userData?.login?.charAt(0)?.toUpperCase() || 'U'}
                                    </Text>
                                    {isAdmin && (
                                        <View style={s.adminBadge}>
                                            <Feather name="shield" size={12} color="white" />
                                        </View>
                                    )}
                                </View>

                                <View style={s.userInfoHeader}>
                                    <Text style={s.userName}>
                                        {userData?.login || 'Пользователь'}
                                    </Text>
                                    <View style={s.roleContainer}>
                                        <Feather name={getRoleIcon()} size={14} color={getRoleColor()} />
                                        <Text style={[s.userRole, { color: getRoleColor() }]}>
                                            {getRoleDescription()}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Информация */}
                            <View style={s.infoSection}>
                                <View style={s.sectionHeader}>
                                    <Feather name="info" size={20} color="#4a6fa5" />
                                    <Text style={s.sectionTitle}>Информация</Text>
                                </View>

                                <View style={s.infoGrid}>
                                    <View style={s.infoItem}>
                                        <View style={s.infoIcon}>
                                            <Feather name="user" size={16} color="#4a6fa5" />
                                        </View>
                                        <View style={s.infoContent}>
                                            <Text style={s.infoLabel}>Логин</Text>
                                            <Text style={s.infoValue} numberOfLines={1}>
                                                {userData?.login || 'Не указан'}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={s.infoItem}>
                                        <View style={s.infoIcon}>
                                            <Feather name={getRoleIcon()} size={16} color={getRoleColor()} />
                                        </View>
                                        <View style={s.infoContent}>
                                            <Text style={s.infoLabel}>Роль</Text>
                                            <View style={[s.roleBadge, { backgroundColor: `${getRoleColor()}15` }]}>
                                                <Text style={[s.roleBadgeText, { color: getRoleColor() }]}>
                                                    {userData?.role || 'Пользователь'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* Кнопки */}
                            <View style={s.actionButtons}>
                                <TouchableOpacity
                                    style={[s.button, s.logoutButton]}
                                    onPress={handleLogout}
                                >
                                    <Feather name="log-out" size={18} color="white" />
                                    <Text style={s.logoutButtonText}>Выйти</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <>
                            <View style={s.guestAvatar}>
                                <Feather name="user" size={60} color="#bdc3c7" />
                            </View>

                            <Text style={s.guestTitle}>Гость</Text>
                            <Text style={s.guestSubtitle}>Вы не авторизованы</Text>

                            <View style={s.guestInfo}>
                                <View style={s.featureSection}>
                                    <View style={s.sectionHeader}>
                                        <Feather name="star" size={20} color="#f39c12" />
                                        <Text style={s.sectionTitle}>Преимущества</Text>
                                    </View>

                                    <View style={s.featureList}>
                                        {[
                                            'Добавление сайтов в избранное',
                                            'Персональные настройки',
                                            'История действий',
                                            'Синхронизация между устройствами',
                                        ].map((text) => (
                                            <View key={text} style={s.featureItem}>
                                                <Feather name="check-circle" size={16} color="#27ae60" />
                                                <Text style={s.featureText}>{text}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>

                                <View style={s.authButtons}>
                                    <TouchableOpacity style={[s.button, s.loginButton]} onPress={handleLogin}>
                                        <Feather name="log-in" size={18} color="white" />
                                        <Text style={s.loginButtonText}>Войти</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={[s.button, s.registerButton]} onPress={handleRegister}>
                                        <Feather name="user-plus" size={18} color="#4a6fa5" />
                                        <Text style={s.registerButtonText}>Зарегистрироваться</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </>
                    )}
                </View>

                {/* Настройки */}
                <View style={s.settingsCard}>
                    <View style={s.sectionHeader}>
                        <Feather name="settings" size={20} color="#4a6fa5" />
                        <Text style={s.sectionTitle}>Настройки</Text>
                    </View>

                    <View style={s.settingRow}>
                        <View style={s.settingLeft}>
                            <View style={s.settingIconWrap}>
                                <Feather name={isDark ? 'moon' : 'sun'} size={18} color={isDark ? '#a78bfa' : '#f59e0b'} />
                            </View>
                            <Text style={s.settingLabel}>Тёмная тема</Text>
                        </View>
                        <Switch
                            value={isDark}
                            onValueChange={toggleTheme}
                            trackColor={{ false: '#d1d5db', true: '#6d28d9' }}
                            thumbColor={isDark ? '#a78bfa' : '#f3f4f6'}
                        />
                    </View>
                </View>

                {/* Панель администратора */}
                {token && isAdmin && (
                    <View style={s.adminSection}>
                        <View style={s.sectionHeader}>
                            <Feather name="shield" size={20} color="#e74c3c" />
                            <Text style={s.sectionTitle}>Панель администратора</Text>
                        </View>

                        <Text style={s.adminText}>
                            У вас есть права администратора. Вы можете управлять пользователями и настройками системы.
                        </Text>

                        <View style={s.adminFeatures}>
                            {[
                                { icon: 'users', text: 'Управление пользователями' },
                                { icon: 'settings', text: 'Настройки системы' },
                                { icon: 'bar-chart', text: 'Аналитика и отчеты' },
                            ].map(({ icon, text }) => (
                                <View key={text} style={s.adminFeature}>
                                    <Feather name={icon as any} size={16} color="#e74c3c" />
                                    <Text style={s.adminFeatureText}>{text}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* О приложении */}
                <View style={s.appInfo}>
                    <Text style={s.appInfoTitle}>О приложении</Text>
                    <Text style={s.appInfoText}>
                        Приложение для мониторинга и анализа веб-сайтов.
                        {token ? ' Используйте все возможности системы.' : ' Авторизуйтесь для полного доступа.'}
                    </Text>
                    <Text style={s.appVersion}>Версия 1.0.0</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const base = {
    content: { paddingBottom: 40 },
    header: {
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    headerPlaceholder: { width: 32 },
    title: { fontSize: 22, fontWeight: 'bold' as const },
    profileCard: {
        borderRadius: 20,
        margin: 20,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 6,
    },
    settingsCard: {
        borderRadius: 20,
        marginHorizontal: 20,
        marginBottom: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    settingRow: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        paddingVertical: 4,
    },
    settingLeft: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 12,
    },
    settingIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
    },
    settingLabel: { fontSize: 15, fontWeight: '500' as const },
    avatarSection: { alignItems: 'center' as const, marginBottom: 24 },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        marginBottom: 16,
        position: 'relative' as const,
    },
    adminBadge: {
        position: 'absolute' as const,
        bottom: 0,
        right: 0,
        backgroundColor: '#e74c3c',
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        borderWidth: 2,
        borderColor: 'white',
    },
    avatarText: { fontSize: 42, color: 'white', fontWeight: 'bold' as const },
    userInfoHeader: { alignItems: 'center' as const },
    userName: { fontSize: 24, fontWeight: 'bold' as const, marginBottom: 4 },
    roleContainer: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    userRole: { fontSize: 14, fontWeight: '500' as const, marginLeft: 6 },
    infoSection: { marginBottom: 24 },
    sectionHeader: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        marginBottom: 16,
    },
    sectionTitle: { fontSize: 18, fontWeight: '600' as const, marginLeft: 8 },
    infoGrid: { flexDirection: 'column' as const, gap: 10 },
    infoItem: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        padding: 14,
        borderRadius: 12,
    },
    infoIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        marginRight: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    infoContent: { flex: 1 },
    infoLabel: { fontSize: 12, marginBottom: 2 },
    infoValue: { fontSize: 15, fontWeight: '500' as const },
    roleBadge: {
        alignSelf: 'flex-start' as const,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    roleBadgeText: { fontSize: 13, fontWeight: '600' as const },
    actionButtons: { gap: 12 },
    button: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        borderRadius: 12,
        padding: 16,
        gap: 12,
    },
    logoutButton: { backgroundColor: '#e74c3c' },
    logoutButtonText: { color: 'white', fontSize: 16, fontWeight: '600' as const },
    guestAvatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        alignSelf: 'center' as const,
        marginBottom: 20,
        borderWidth: 2,
    },
    guestTitle: { fontSize: 24, fontWeight: 'bold' as const, textAlign: 'center' as const, marginBottom: 4 },
    guestSubtitle: { fontSize: 16, textAlign: 'center' as const, marginBottom: 24 },
    guestInfo: { gap: 24 },
    featureSection: { marginBottom: 8 },
    featureList: { gap: 12 },
    featureItem: { flexDirection: 'row' as const, alignItems: 'center' as const },
    featureText: { fontSize: 14, marginLeft: 12, flex: 1 },
    authButtons: { gap: 12 },
    loginButton: { backgroundColor: '#4a6fa5' },
    loginButtonText: { color: 'white', fontSize: 16, fontWeight: '600' as const },
    registerButton: { borderWidth: 2, borderColor: '#4a6fa5' },
    registerButtonText: { color: '#4a6fa5', fontSize: 16, fontWeight: '600' as const },
    adminSection: {
        borderRadius: 20,
        marginHorizontal: 20,
        marginBottom: 20,
        padding: 20,
        borderWidth: 1,
    },
    adminText: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
    adminFeatures: { gap: 12 },
    adminFeature: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        backgroundColor: 'rgba(231, 76, 60, 0.1)',
        padding: 12,
        borderRadius: 8,
    },
    adminFeatureText: { fontSize: 14, color: '#e74c3c', fontWeight: '500' as const, marginLeft: 12 },
    appInfo: {
        borderRadius: 20,
        marginHorizontal: 20,
        padding: 20,
        alignItems: 'center' as const,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    appInfoTitle: { fontSize: 16, fontWeight: '600' as const, marginBottom: 8 },
    appInfoText: { fontSize: 14, textAlign: 'center' as const, lineHeight: 20, marginBottom: 8 },
    appVersion: { fontSize: 12, fontStyle: 'italic' as const },
    loadingContainer: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const },
    loadingText: { marginTop: 12, fontSize: 16 },
};

const lightStyles = StyleSheet.create({
    ...base,
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    loadingContainer: { ...base.loadingContainer, backgroundColor: '#f8f9fa' },
    loadingText: { ...base.loadingText, color: '#7f8c8d' },
    header: { ...base.header, backgroundColor: 'white', borderBottomColor: '#e0e0e0' },
    title: { ...base.title, color: '#2c3e50' },
    profileCard: { ...base.profileCard, backgroundColor: 'white' },
    settingsCard: { ...base.settingsCard, backgroundColor: 'white' },
    settingIconWrap: { ...base.settingIconWrap, backgroundColor: '#f3f4f6' },
    settingLabel: { ...base.settingLabel, color: '#2c3e50' },
    userName: { ...base.userName, color: '#2c3e50' },
    roleContainer: { ...base.roleContainer, backgroundColor: '#f8f9fa' },
    sectionTitle: { ...base.sectionTitle, color: '#2c3e50' },
    infoItem: { ...base.infoItem, backgroundColor: '#f8f9fa' },
    infoIcon: { ...base.infoIcon, backgroundColor: 'white' },
    infoLabel: { ...base.infoLabel, color: '#7f8c8d' },
    infoValue: { ...base.infoValue, color: '#2c3e50' },
    guestAvatar: { ...base.guestAvatar, backgroundColor: '#f8f9fa', borderColor: '#e0e0e0' },
    guestTitle: { ...base.guestTitle, color: '#2c3e50' },
    guestSubtitle: { ...base.guestSubtitle, color: '#7f8c8d' },
    featureText: { ...base.featureText, color: '#2c3e50' },
    registerButton: { ...base.registerButton, backgroundColor: 'white' },
    adminSection: { ...base.adminSection, backgroundColor: '#fff5f5', borderColor: '#ffebee' },
    adminText: { ...base.adminText, color: '#666' },
    appInfo: { ...base.appInfo, backgroundColor: 'white' },
    appInfoTitle: { ...base.appInfoTitle, color: '#2c3e50' },
    appInfoText: { ...base.appInfoText, color: '#7f8c8d' },
    appVersion: { ...base.appVersion, color: '#bdc3c7' },
});

const darkStyles = StyleSheet.create({
    ...base,
    container: { flex: 1, backgroundColor: '#0f0f0f' },
    loadingContainer: { ...base.loadingContainer, backgroundColor: '#0f0f0f' },
    loadingText: { ...base.loadingText, color: '#9ca3af' },
    header: { ...base.header, backgroundColor: '#1a1a1a', borderBottomColor: '#2d2d2d' },
    title: { ...base.title, color: '#f1f5f9' },
    profileCard: { ...base.profileCard, backgroundColor: '#1a1a1a' },
    settingsCard: { ...base.settingsCard, backgroundColor: '#1a1a1a' },
    settingIconWrap: { ...base.settingIconWrap, backgroundColor: '#2d2d2d' },
    settingLabel: { ...base.settingLabel, color: '#e2e8f0' },
    userName: { ...base.userName, color: '#f1f5f9' },
    roleContainer: { ...base.roleContainer, backgroundColor: '#2d2d2d' },
    sectionTitle: { ...base.sectionTitle, color: '#f1f5f9' },
    infoItem: { ...base.infoItem, backgroundColor: '#2d2d2d' },
    infoIcon: { ...base.infoIcon, backgroundColor: '#1a1a1a' },
    infoLabel: { ...base.infoLabel, color: '#9ca3af' },
    infoValue: { ...base.infoValue, color: '#e2e8f0' },
    guestAvatar: { ...base.guestAvatar, backgroundColor: '#2d2d2d', borderColor: '#3d3d3d' },
    guestTitle: { ...base.guestTitle, color: '#f1f5f9' },
    guestSubtitle: { ...base.guestSubtitle, color: '#9ca3af' },
    featureText: { ...base.featureText, color: '#e2e8f0' },
    registerButton: { ...base.registerButton, backgroundColor: 'transparent' },
    adminSection: { ...base.adminSection, backgroundColor: '#2a1515', borderColor: '#3d1f1f' },
    adminText: { ...base.adminText, color: '#9ca3af' },
    appInfo: { ...base.appInfo, backgroundColor: '#1a1a1a' },
    appInfoTitle: { ...base.appInfoTitle, color: '#f1f5f9' },
    appInfoText: { ...base.appInfoText, color: '#9ca3af' },
    appVersion: { ...base.appVersion, color: '#4b5563' },
});
