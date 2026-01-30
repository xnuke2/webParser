import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert
} from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from '@/contexts/AuthContext';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';

export default function ProfileScreen() {
    const { token, signOut, userData } = useAuth();

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
                    onPress: signOut
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title}>Профиль</Text>
                </View>

                <View style={styles.profileCard}>
                    {token ? (
                        // Авторизованный пользователь
                        <>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>
                                    {userData?.login?.charAt(0)?.toUpperCase() || 'U'}
                                </Text>
                            </View>

                            <Text style={styles.userName}>
                                {userData?.login || 'Пользователь'}
                            </Text>

                            <Text style={styles.userEmail}>
                                {userData?.email || 'Нет email'}
                            </Text>

                            <View style={styles.infoSection}>
                                <Text style={styles.sectionTitle}>Информация</Text>
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Статус:</Text>
                                    <Text style={styles.infoValue}>Авторизован</Text>
                                </View>
                                {userData?.role && (
                                    <View style={styles.infoRow}>
                                        <Text style={styles.infoLabel}>Роль:</Text>
                                        <Text style={styles.infoValue}>{userData.role}</Text>
                                    </View>
                                )}
                            </View>

                            <TouchableOpacity
                                style={[styles.button, styles.logoutButton]}
                                onPress={handleLogout}
                            >
                                <Text style={styles.logoutButtonText}>Выйти</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        // Неавторизованный пользователь
                        <>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>👤</Text>
                            </View>

                            <Text style={styles.userName}>Гость</Text>
                            <Text style={styles.userEmail}>Вы не авторизованы</Text>

                            <View style={styles.infoSection}>
                                <Text style={styles.guestText}>
                                    Авторизуйтесь, чтобы получить доступ ко всем функциям:
                                </Text>
                                <View style={styles.featureList}>
                                    <Text style={styles.featureItem}>• Добавление сайтов в избранное</Text>
                                    {/*<Text style={styles.featureItem}>• Сохранение настроек</Text>*/}
                                    {/*<Text style={styles.featureItem}>• История действий</Text>*/}
                                </View>
                            </View>

                            <View style={styles.authButtons}>
                                <TouchableOpacity
                                    style={[styles.button, styles.loginButton]}
                                    onPress={handleLogin}
                                >
                                    <Text style={styles.loginButtonText}>Войти</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.button, styles.registerButton]}
                                    onPress={handleRegister}
                                >
                                    <Text style={styles.registerButtonText}>Зарегистрироваться</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>

                {token && (
                    <View style={styles.settingsSection}>
                        <Text style={styles.sectionTitle}>Настройки</Text>

                        <TouchableOpacity style={styles.settingItem}>
                            <Text style={styles.settingText}>Уведомления</Text>
                            <Text style={styles.chevron}>›</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.settingItem}>
                            <Text style={styles.settingText}>Безопасность</Text>
                            <Text style={styles.chevron}>›</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.settingItem}>
                            <Text style={styles.settingText}>Приватность</Text>
                            <Text style={styles.chevron}>›</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    content: {
        padding: 16,
    },
    header: {
        marginBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#2c3e50',
    },
    profileCard: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        marginBottom: 24,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#4a6fa5',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    avatarText: {
        fontSize: 40,
        color: 'white',
        fontWeight: 'bold',
    },
    userName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 4,
    },
    userEmail: {
        fontSize: 16,
        color: '#7f8c8d',
        marginBottom: 24,
    },
    infoSection: {
        width: '100%',
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 16,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    infoLabel: {
        fontSize: 16,
        color: '#7f8c8d',
    },
    infoValue: {
        fontSize: 16,
        color: '#2c3e50',
        fontWeight: '500',
    },
    guestText: {
        fontSize: 16,
        color: '#7f8c8d',
        marginBottom: 16,
        textAlign: 'center',
    },
    featureList: {
        marginLeft: 16,
    },
    featureItem: {
        fontSize: 14,
        color: '#7f8c8d',
        marginBottom: 8,
    },
    authButtons: {
        width: '100%',
        gap: 12,
    },
    button: {
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    loginButton: {
        backgroundColor: '#4a6fa5',
    },
    registerButton: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: '#4a6fa5',
    },
    logoutButton: {
        backgroundColor: '#e74c3c',
        width: '100%',
    },
    loginButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    registerButtonText: {
        color: '#4a6fa5',
        fontSize: 16,
        fontWeight: '600',
    },
    logoutButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    settingsSection: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    settingText: {
        fontSize: 16,
        color: '#2c3e50',
    },
    chevron: {
        fontSize: 20,
        color: '#bdc3c7',
    },
});