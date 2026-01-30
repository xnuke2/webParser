import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import {Alert} from "react-native";

interface UserData {
    login: string;
    email?: string;
    role?: string;
    [key: string]: any;
}

interface AuthContextType {
    token: string | null;
    userData: UserData | null;
    isLoading: boolean;
    signIn: (login: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signUp: (login: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [token, setToken] = useState<string | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadAuthData();
    }, []);

    const loadAuthData = async () => {
        try {
            const storedToken = await SecureStore.getItemAsync('userToken');
            const storedUserData = await SecureStore.getItemAsync('userData');

            setToken(storedToken);

            if (storedUserData) {
                try {
                    setUserData(JSON.parse(storedUserData));
                } catch (e) {
                    console.error('Error parsing user data:', e);
                }
            }
        } catch (error) {
            console.error('Error loading auth data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const signIn = async (login: string, password: string) => {
        try {
            const API_URL = 'http://192.168.31.177:8088';

            const response = await fetch(`${API_URL}/api/Authentication/Login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    Login: login,
                    Password: password
                })
            });

            const data = await response.json();
            Alert.alert('s',response.status.toString());

            if (response.ok && data.access_token) {
                // Сохраняем токен
                await SecureStore.setItemAsync('userToken', data.access_token);

                // Сохраняем данные пользователя (если они есть в ответе)
                const userInfo = {
                    login: login,
                    ...data.user // если сервер возвращает доп. информацию
                };

                await SecureStore.setItemAsync('userData', JSON.stringify(userInfo));

                setToken(data.access_token);
                setUserData(userInfo);

                // Перенаправляем на профиль
                router.replace('/(screens)/profile');
                return { success: true };
            } else {
                return {
                    success: false,
                    error: data.message || 'Ошибка авторизации'
                };
            }
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                error: 'Сетевая ошибка. Проверьте подключение.'
            };
        }
    };

    const signUp = async (login: string, password: string) => {
        try {
            const API_URL = 'http://192.168.31.177:8088';

            const response = await fetch(`${API_URL}/api/Authentication/Register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    Login: login,
                    Password: password
                })
            });

            const data = await response.json();

            if (response.ok) {
                // После успешной регистрации автоматически входим
                return await signIn(login, password);
            } else {
                return {
                    success: false,
                    error: data.message || 'Ошибка регистрации'
                };
            }
        } catch (error) {
            console.error('Registration error:', error);
            return {
                success: false,
                error: 'Сетевая ошибка'
            };
        }
    };

    const signOut = async () => {
        try {
            await SecureStore.deleteItemAsync('userToken');
            await SecureStore.deleteItemAsync('userData');
            setToken(null);
            setUserData(null);
            router.replace('/(screens)/profile'); // Возвращаем на профиль
        } catch (error) {
            console.error('Sign out error:', error);
        }
    };

    return (
        <AuthContext.Provider value={{
            token,
            userData,
            isLoading,
            signIn,
            signUp,
            signOut
        }}>
            {children}
        </AuthContext.Provider>
    );
};