import React, { useState } from 'react';
import {
    View,
    TextInput,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RegisterScreen() {
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const { signUp } = useAuth();

    const handleRegister = async () => {
        if (!login.trim() || !password.trim() || !confirmPassword.trim()) {
            Alert.alert('Ошибка', 'Пожалуйста, заполните все поля');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Ошибка', 'Пароли не совпадают');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Ошибка', 'Пароль должен содержать минимум 6 символов');
            return;
        }

        setLoading(true);
        const result = await signUp(login, password);
        setLoading(false);

        if (!result.success) {
            Alert.alert('Ошибка', result.error || 'Ошибка регистрации');
        }
    };

    const navigateToLogin = () => {
        router.replace('/(auth)/login');
    };

    const navigateBack = () => {
        router.canGoBack() ? router.back() : router.replace('/(screens)/profile');
    };

    return (
        <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <TouchableOpacity style={styles.backButton} onPress={navigateBack}>
                <Feather name="arrow-left" size={22} color="#4a6fa5" />
                <Text style={styles.backText}>Назад</Text>
            </TouchableOpacity>
            <View style={styles.formContainer}>
                <Text style={styles.title}>Регистрация</Text>

                <TextInput
                    style={styles.input}
                    placeholder="Логин"
                    value={login}
                    onChangeText={setLogin}
                    autoCapitalize="none"
                    editable={!loading}
                />

                <TextInput
                    style={styles.input}
                    placeholder="Пароль"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    editable={!loading}
                />

                <TextInput
                    style={styles.input}
                    placeholder="Подтвердите пароль"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    editable={!loading}
                />

                {loading ? (
                    <ActivityIndicator size="large" color="#4a6fa5" style={styles.loader} />
                ) : (
                    <>
                        <TouchableOpacity
                            style={[styles.button, (!login || !password || !confirmPassword) && styles.buttonDisabled]}
                            onPress={handleRegister}
                            disabled={!login || !password || !confirmPassword || loading}
                        >
                            <Text style={styles.buttonText}>Зарегистрироваться</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={navigateToLogin} style={styles.linkButton}>
                            <Text style={styles.linkText}>
                                Уже есть аккаунт? <Text style={styles.linkTextBold}>Войти</Text>
                            </Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    flex: {
        flex: 1,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 8,
        gap: 6,
    },
    backText: {
        color: '#4a6fa5',
        fontSize: 16,
        fontWeight: '600',
    },
    formContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 40,
        textAlign: 'center',
    },
    input: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    button: {
        backgroundColor: '#4a6fa5',
        borderRadius: 12,
        padding: 18,
        alignItems: 'center',
        marginTop: 20,
    },
    buttonDisabled: {
        backgroundColor: '#cccccc',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    linkButton: {
        marginTop: 24,
        alignItems: 'center',
    },
    linkText: {
        color: '#7f8c8d',
        fontSize: 15,
    },
    linkTextBold: {
        fontWeight: '600',
        color: '#4a6fa5',
    },
    loader: {
        marginTop: 20,
    },
});