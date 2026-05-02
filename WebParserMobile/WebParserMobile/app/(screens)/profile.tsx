import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    RefreshControl
} from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from '@/contexts/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';

export default function ProfileScreen() {
    const { token, signOut, userData, fetchUserInfo, isUserInfoLoading, isLoading } = useAuth();
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string>('');
    const [infoLoaded, setInfoLoaded] = useState(false);

    // Загружаем информацию о пользователе при монтировании компонента
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

    const handleLogin = () => {
        router.push('/(auth)/login');
    };

    const handleRegister = () => {
        router.push('/(auth)/register');
    };

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

    const handleGoToSites = () => {
        router.push('/(screens)/sites');
    };

    const handleGoToHome = () => {
        router.push('/(screens)');
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
            <SafeAreaView style={styles.container}>
                <StatusBar style="dark" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4a6fa5" />
                    <Text style={styles.loadingText}>Загрузка профиля...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />

            <ScrollView
                contentContainerStyle={styles.content}
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
                {/* Шапка профиля */}
                <View style={styles.header}>
                    <View style={styles.headerPlaceholder} />
                    <Text style={styles.title}>Профиль</Text>
                    <View style={styles.headerPlaceholder} />
                </View>

                {/* Основная карточка профиля */}
                <View style={styles.profileCard}>
                    {token ? (
                        // Авторизованный пользователь
                        <>
                            <View style={styles.avatarSection}>
                                <View style={[styles.avatar, { backgroundColor: getRoleColor() }]}>
                                    <Text style={styles.avatarText}>
                                        {userData?.login?.charAt(0)?.toUpperCase() || 'U'}
                                    </Text>
                                    {isAdmin && (
                                        <View style={styles.adminBadge}>
                                            <Feather name="shield" size={12} color="white" />
                                        </View>
                                    )}
                                </View>

                                <View style={styles.userInfoHeader}>
                                    <Text style={styles.userName}>
                                        {userData?.login || 'Пользователь'}
                                    </Text>
                                    <View style={styles.roleContainer}>
                                        <Feather
                                            name={getRoleIcon()}
                                            size={14}
                                            color={getRoleColor()}
                                        />
                                        <Text style={[styles.userRole, { color: getRoleColor() }]}>
                                            {getRoleDescription()}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* Информационная секция */}
                            <View style={styles.infoSection}>
                                <View style={styles.sectionHeader}>
                                    <Feather name="info" size={20} color="#4a6fa5" />
                                    <Text style={styles.sectionTitle}>Информация</Text>
                                </View>

                                <View style={styles.infoGrid}>
                                    <View style={styles.infoItem}>
                                        <View style={styles.infoIcon}>
                                            <Feather name="user" size={16} color="#4a6fa5" />
                                        </View>
                                        <View style={styles.infoContent}>
                                            <Text style={styles.infoLabel}>Логин</Text>
                                            <Text style={styles.infoValue} numberOfLines={1}>
                                                {userData?.login || 'Не указан'}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.infoItem}>
                                        <View style={styles.infoIcon}>
                                            <Feather name={getRoleIcon()} size={16} color={getRoleColor()} />
                                        </View>
                                        <View style={styles.infoContent}>
                                            <Text style={styles.infoLabel}>Роль</Text>
                                            <View style={[
                                                styles.roleBadge,
                                                { backgroundColor: `${getRoleColor()}15` }
                                            ]}>
                                                <Text style={[styles.roleBadgeText, { color: getRoleColor() }]}>
                                                    {userData?.role || 'Пользователь'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* Кнопки действий */}
                            <View style={styles.actionButtons}>
                                <TouchableOpacity
                                    style={[styles.button, styles.logoutButton]}
                                    onPress={handleLogout}
                                >
                                    <Feather name="log-out" size={18} color="white" />
                                    <Text style={styles.logoutButtonText}>Выйти</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        // Неавторизованный пользователь
                        <>
                            <View style={styles.guestAvatar}>
                                <Feather name="user" size={60} color="#bdc3c7" />
                            </View>

                            <Text style={styles.guestTitle}>Гость</Text>
                            <Text style={styles.guestSubtitle}>Вы не авторизованы</Text>

                            <View style={styles.guestInfo}>
                                <View style={styles.featureSection}>
                                    <View style={styles.sectionHeader}>
                                        <Feather name="star" size={20} color="#f39c12" />
                                        <Text style={styles.sectionTitle}>Преимущества</Text>
                                    </View>

                                    <View style={styles.featureList}>
                                        <View style={styles.featureItem}>
                                            <Feather name="check-circle" size={16} color="#27ae60" />
                                            <Text style={styles.featureText}>Добавление сайтов в избранное</Text>
                                        </View>
                                        <View style={styles.featureItem}>
                                            <Feather name="check-circle" size={16} color="#27ae60" />
                                            <Text style={styles.featureText}>Персональные настройки</Text>
                                        </View>
                                        <View style={styles.featureItem}>
                                            <Feather name="check-circle" size={16} color="#27ae60" />
                                            <Text style={styles.featureText}>История действий</Text>
                                        </View>
                                        <View style={styles.featureItem}>
                                            <Feather name="check-circle" size={16} color="#27ae60" />
                                            <Text style={styles.featureText}>Синхронизация между устройствами</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.authButtons}>
                                    <TouchableOpacity
                                        style={[styles.button, styles.loginButton]}
                                        onPress={handleLogin}
                                    >
                                        <Feather name="log-in" size={18} color="white" />
                                        <Text style={styles.loginButtonText}>Войти</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.button, styles.registerButton]}
                                        onPress={handleRegister}
                                    >
                                        <Feather name="user-plus" size={18} color="#4a6fa5" />
                                        <Text style={styles.registerButtonText}>Зарегистрироваться</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </>
                    )}
                </View>

                {/* Дополнительная информация для авторизованных пользователей */}
                {token && isAdmin && (
                    <View style={styles.adminSection}>
                        <View style={styles.sectionHeader}>
                            <Feather name="shield" size={20} color="#e74c3c" />
                            <Text style={styles.sectionTitle}>Панель администратора</Text>
                        </View>

                        <Text style={styles.adminText}>
                            У вас есть права администратора. Вы можете управлять пользователями и настройками системы.
                        </Text>

                        <View style={styles.adminFeatures}>
                            <View style={styles.adminFeature}>
                                <Feather name="users" size={16} color="#e74c3c" />
                                <Text style={styles.adminFeatureText}>Управление пользователями</Text>
                            </View>
                            <View style={styles.adminFeature}>
                                <Feather name="settings" size={16} color="#e74c3c" />
                                <Text style={styles.adminFeatureText}>Настройки системы</Text>
                            </View>
                            <View style={styles.adminFeature}>
                                <Feather name="bar-chart" size={16} color="#e74c3c" />
                                <Text style={styles.adminFeatureText}>Аналитика и отчеты</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Информация о приложении */}
                <View style={styles.appInfo}>
                    <Text style={styles.appInfoTitle}>О приложении</Text>
                    <Text style={styles.appInfoText}>
                        Приложение для мониторинга и анализа веб-сайтов.
                        {token ? ' Используйте все возможности системы.' : ' Авторизуйтесь для полного доступа.'}
                    </Text>
                    <Text style={styles.appVersion}>Версия 1.0.0</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#7f8c8d',
    },
    content: {
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    backButton: {
        padding: 4,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#2c3e50',
    },
    headerPlaceholder: {
        width: 32,
    },
    profileCard: {
        backgroundColor: 'white',
        borderRadius: 20,
        margin: 20,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 6,
    },
    avatarSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        position: 'relative',
    },
    adminBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#e74c3c',
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    avatarText: {
        fontSize: 42,
        color: 'white',
        fontWeight: 'bold',
    },
    userInfoHeader: {
        alignItems: 'center',
    },
    userName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 4,
    },
    roleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    userRole: {
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 6,
    },
    infoSection: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    refreshInfoButton: {
        marginLeft: 'auto',
        padding: 4,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#2c3e50',
        marginLeft: 8,
    },
    infoGrid: {
        flexDirection: 'column',
        gap: 10,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        padding: 14,
        borderRadius: 12,
    },
    infoIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 12,
        color: '#7f8c8d',
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 15,
        color: '#2c3e50',
        fontWeight: '500',
    },
    roleBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    roleBadgeText: {
        fontSize: 13,
        fontWeight: '600',
    },
    loadingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        marginTop: 12,
    },
    loadingInfoText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#7f8c8d',
    },
    actionButtons: {
        gap: 12,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        padding: 16,
        gap: 12,
    },
    sitesButton: {
        backgroundColor: '#4a6fa5',
    },
    sitesButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    logoutButton: {
        backgroundColor: '#e74c3c',
    },
    logoutButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    guestAvatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#f8f9fa',
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginBottom: 20,
        borderWidth: 2,
        borderColor: '#e0e0e0',
    },
    guestTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2c3e50',
        textAlign: 'center',
        marginBottom: 4,
    },
    guestSubtitle: {
        fontSize: 16,
        color: '#7f8c8d',
        textAlign: 'center',
        marginBottom: 24,
    },
    guestInfo: {
        gap: 24,
    },
    featureSection: {
        marginBottom: 8,
    },
    featureList: {
        gap: 12,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    featureText: {
        fontSize: 14,
        color: '#2c3e50',
        marginLeft: 12,
        flex: 1,
    },
    authButtons: {
        gap: 12,
    },
    loginButton: {
        backgroundColor: '#4a6fa5',
    },
    loginButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    registerButton: {
        backgroundColor: 'white',
        borderWidth: 2,
        borderColor: '#4a6fa5',
    },
    registerButtonText: {
        color: '#4a6fa5',
        fontSize: 16,
        fontWeight: '600',
    },
    adminSection: {
        backgroundColor: '#fff5f5',
        borderRadius: 20,
        marginHorizontal: 20,
        marginBottom: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#ffebee',
    },
    adminText: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
        marginBottom: 16,
    },
    adminFeatures: {
        gap: 12,
    },
    adminFeature: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(231, 76, 60, 0.1)',
        padding: 12,
        borderRadius: 8,
    },
    adminFeatureText: {
        fontSize: 14,
        color: '#e74c3c',
        fontWeight: '500',
        marginLeft: 12,
    },
    appInfo: {
        backgroundColor: 'white',
        borderRadius: 20,
        marginHorizontal: 20,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    appInfoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 8,
    },
    appInfoText: {
        fontSize: 14,
        color: '#7f8c8d',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 8,
    },
    appVersion: {
        fontSize: 12,
        color: '#bdc3c7',
        fontStyle: 'italic',
    },
});