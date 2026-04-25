import { ScrollView, StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Feather } from '@expo/vector-icons';

export default function Index() {
    const { token, signOut, userData, fetchUserInfo, isUserInfoLoading } = useAuth();
    const [initialLoadDone, setInitialLoadDone] = useState(false);

    // Загружаем информацию о пользователе при монтировании
    useEffect(() => {
        if (token && !initialLoadDone) {
            const timer = setTimeout(() => {
                fetchUserInfo();
                setInitialLoadDone(true);
            }, 1000); // Задержка для избежания конфликтов с AuthContext
            return () => clearTimeout(timer);
        }
    }, [token, initialLoadDone]);

    const handleProfilePress = () => {
        router.push('/(screens)/profile');
    };

    const handleSitesPress = () => {
        router.push('/(screens)/sites');
    };

    const handleLoginPress = () => {
        router.push('/(auth)/login');
    };

    const handleRefreshUserInfo = () => {
        if (token) {
            fetchUserInfo();
        }
    };

    const getWelcomeMessage = () => {
        if (!token) return 'Вы в режиме гостя';

        if (userData?.role === 'admin') {
            return `Добро пожаловать, администратор ${userData.login || ''}`;
        } else if (userData?.login) {
            return `Добро пожаловать, ${userData.login}`;
        } else {
            return 'Добро пожаловать!';
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Шапка */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Главная</Text>
                <TouchableOpacity onPress={handleProfilePress} style={styles.profileButton}>
                    {token ? (
                        <View style={styles.profileButtonContent}>
                            {userData?.login ? (
                                <View style={styles.userBadge}>
                                    <Text style={styles.userInitial}>
                                        {userData.login.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            ) : (
                                <Feather name="user" size={18} color="white" />
                            )}
                            <Text style={styles.profileButtonText}>
                                {userData?.login || 'Профиль'}
                            </Text>
                        </View>
                    ) : (
                        <Text style={styles.profileButtonText}>Войти</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Информация о статусе */}
                <View style={styles.statusCard}>
                    <View style={styles.statusHeader}>
                        <Feather
                            name={token ? "check-circle" : "user"}
                            size={24}
                            color={token ? "#27ae60" : "#7f8c8d"}
                        />
                        <Text style={styles.statusTitle}>
                            {getWelcomeMessage()}
                        </Text>
                        {token && (
                            <TouchableOpacity
                                onPress={handleRefreshUserInfo}
                                disabled={isUserInfoLoading}
                                style={styles.refreshButton}
                            >
                                <Feather
                                    name="refresh-cw"
                                    size={16}
                                    color={isUserInfoLoading ? "#bdc3c7" : "#4a6fa5"}
                                />
                            </TouchableOpacity>
                        )}
                    </View>

                    <Text style={styles.statusText}>
                        {token
                            ? 'Вы авторизованы и можете использовать все функции приложения'
                            : 'Авторизуйтесь для доступа ко всем функциям'}
                    </Text>

                    {token && isUserInfoLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color="#4a6fa5" />
                            <Text style={styles.loadingText}>Загрузка информации...</Text>
                        </View>
                    ) : (
                        token && userData && (
                            <View style={styles.userInfo}>
                                {userData.login && (
                                    <View style={styles.infoRow}>
                                        <Feather name="user" size={16} color="#4a6fa5" />
                                        <Text style={styles.infoLabel}>Логин:</Text>
                                        <Text style={styles.infoValue}>{userData.login}</Text>
                                    </View>
                                )}

                                {userData.role && (
                                    <View style={styles.infoRow}>
                                        <Feather name={userData.role === 'admin' ? "shield" : "user-check"} size={16} color="#4a6fa5" />
                                        <Text style={styles.infoLabel}>Роль:</Text>
                                        <View style={[
                                            styles.roleBadge,
                                            userData.role === 'admin' && styles.roleBadgeAdmin
                                        ]}>
                                            <Text style={[
                                                styles.roleText,
                                                userData.role === 'admin' && styles.roleTextAdmin
                                            ]}>
                                                {userData.role}
                                            </Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                        )
                    )}
                </View>

                {/* Быстрые действия */}
                <View style={styles.actionsSection}>
                    <Text style={styles.sectionTitle}>Быстрые действия</Text>

                    <View style={styles.actionsGrid}>
                        <TouchableOpacity
                            style={[styles.actionCard, !token && styles.actionCardDisabled]}
                            onPress={handleSitesPress}
                            disabled={!token}
                        >
                            <View style={[styles.actionIcon, styles.sitesIcon]}>
                                <Feather name="globe" size={24} color="white" />
                            </View>
                            <Text style={styles.actionTitle}>Сайты</Text>
                            <Text style={styles.actionDescription}>
                                {token ? 'Просмотр и управление сайтами' : 'Требуется авторизация'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionCard}
                            onPress={handleProfilePress}
                        >
                            <View style={[styles.actionIcon, styles.profileIcon]}>
                                <Feather name="user" size={24} color="white" />
                            </View>
                            <Text style={styles.actionTitle}>Профиль</Text>
                            <Text style={styles.actionDescription}>
                                {token ? 'Управление профилем' : 'Войти или зарегистрироваться'}
                            </Text>
                        </TouchableOpacity>

                        {!token && (
                            <TouchableOpacity
                                style={[styles.actionCard, styles.loginCard]}
                                onPress={handleLoginPress}
                            >
                                <View style={[styles.actionIcon, styles.loginIcon]}>
                                    <Feather name="log-in" size={24} color="white" />
                                </View>
                                <Text style={styles.actionTitle}>Вход</Text>
                                <Text style={styles.actionDescription}>
                                    Войдите для доступа ко всем функциям
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Информационный блок */}
                <View style={styles.infoCard}>
                    <View style={styles.infoHeader}>
                        <Feather name="info" size={20} color="#4a6fa5" />
                        <Text style={styles.infoCardTitle}>О приложении</Text>
                    </View>
                    <Text style={styles.infoCardText}>
                        Это приложение для мониторинга и анализа веб-сайтов.
                        {token ? ' Используйте вкладки ниже для навигации.' : ' Авторизуйтесь для начала работы.'}
                    </Text>

                    {token && userData?.role === 'admin' && (
                        <View style={styles.adminNote}>
                            <Feather name="shield" size={16} color="#e74c3c" />
                            <Text style={styles.adminNoteText}>
                                У вас есть права администратора
                            </Text>
                        </View>
                    )}
                </View>

                {/* Декоративный блок с кошкой */}
                <View style={styles.decorativeSection}>
                    <Text style={styles.decorativeTitle}>Наш талисман</Text>
                    <View style={styles.imageContainer}>
                        <Image
                            style={{ width: 200, height: 200 }}
                            source={require('@/assets/images/android-icon-monochrome.png')}
                            contentFit="contain"
                        />
                    </View>
                    <Text style={styles.decorativeText}>Это кошка - символ нашего приложения</Text>
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#2c3e50',
    },
    profileButton: {
        backgroundColor: '#4a6fa5',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        minWidth: 100,
    },
    profileButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    userBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    userInitial: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    profileButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    statusCard: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    statusTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginLeft: 12,
        flex: 1,
    },
    refreshButton: {
        padding: 4,
        marginLeft: 8,
    },
    statusText: {
        fontSize: 14,
        color: '#7f8c8d',
        lineHeight: 20,
        marginBottom: 16,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
        justifyContent: 'center',
    },
    loadingText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#7f8c8d',
    },
    userInfo: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 16,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    infoLabel: {
        fontSize: 14,
        color: '#7f8c8d',
        marginLeft: 8,
        marginRight: 8,
        width: 50,
    },
    infoValue: {
        fontSize: 14,
        color: '#2c3e50',
        fontWeight: '500',
        flex: 1,
    },
    roleBadge: {
        backgroundColor: '#e8f4fc',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#4a6fa5',
    },
    roleBadgeAdmin: {
        backgroundColor: '#ffebee',
        borderColor: '#e74c3c',
    },
    roleText: {
        fontSize: 12,
        color: '#4a6fa5',
        fontWeight: '600',
    },
    roleTextAdmin: {
        color: '#e74c3c',
    },
    actionsSection: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 16,
    },
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    actionCard: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 20,
        flex: 1,
        minWidth: '48%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    actionCardDisabled: {
        opacity: 0.6,
    },
    actionIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    sitesIcon: {
        backgroundColor: '#4a6fa5',
    },
    profileIcon: {
        backgroundColor: '#27ae60',
    },
    loginIcon: {
        backgroundColor: '#e74c3c',
    },
    loginCard: {
        backgroundColor: '#fff5f5',
    },
    actionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 4,
    },
    actionDescription: {
        fontSize: 12,
        color: '#7f8c8d',
        lineHeight: 16,
    },
    infoCard: {
        backgroundColor: '#e8f4fc',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#d0e3f4',
    },
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    infoCardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c3e50',
        marginLeft: 8,
    },
    infoCardText: {
        fontSize: 14,
        color: '#34495e',
        lineHeight: 20,
        marginBottom: 12,
    },
    adminNote: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(231, 76, 60, 0.1)',
        padding: 8,
        borderRadius: 8,
        marginTop: 8,
    },
    adminNoteText: {
        fontSize: 12,
        color: '#e74c3c',
        fontWeight: '500',
        marginLeft: 8,
    },
    decorativeSection: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    decorativeTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 12,
    },
    imageContainer: {
        width: 200,
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    decorativeText: {
        fontSize: 14,
        color: '#7f8c8d',
        fontStyle: 'italic',
    },
});