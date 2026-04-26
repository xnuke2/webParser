// contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { Alert } from "react-native";
import { apiService, UserData, LoginResponse, AuthResult, TokenData } from '../lib/apiService';
import * as SecureStore from 'expo-secure-store';

interface AuthContextType {
    token: string | null;
    userData: UserData | null;
    isLoading: boolean;
    isUserInfoLoading: boolean;
    signIn: (login: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signUp: (login: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signOut: () => Promise<void>;
    refreshToken: () => Promise<boolean>;
    checkAuth: () => Promise<boolean>;
    fetchUserInfo: () => Promise<void>;
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
    const [isUserInfoLoading, setIsUserInfoLoading] = useState(false);
    const [userInfoRequested, setUserInfoRequested] = useState(false); // Добавляем флаг

    // Функция для получения информации о пользователе без создания цикла
    // Убираем useCallback для fetchUserInfo или добавляем правильную зависимость
    const fetchUserInfo = useCallback(async () => {
        if (!token) {
            console.log('[Auth] Нет токена, пропускаем запрос информации о пользователе');
            return;
        }

        if (userInfoRequested) {
            console.log('[Auth] Запрос информации о пользователе уже выполняется');
            return;
        }

        // Проверяем, когда последний раз обновлялась информация
        const lastUpdateTime = userData?._lastUpdate || 0;
        const now = Date.now();

        // Обновляем не чаще чем раз в 30 секунд
        if (now - lastUpdateTime < 30 * 1000) {
            console.log('[Auth] Информация недавно обновлялась, пропускаем');
            return;
        }

        console.log('[Auth] Запрашиваем информацию о пользователе');
        setUserInfoRequested(true);
        setIsUserInfoLoading(true);

        try {
            const userInfo = await apiService.getUserInfo();
            console.log('[Auth] Получена информация о пользователе:', userInfo);

            // Добавляем время обновления
            const updatedUserInfo = {
                ...userInfo,
                _lastUpdate: now
            };

            // Сравниваем данные, чтобы избежать ненужных обновлений
            if (JSON.stringify(userData) !== JSON.stringify(updatedUserInfo)) {
                setUserData(updatedUserInfo);
                await SecureStore.setItemAsync('userData', JSON.stringify(updatedUserInfo));
                console.log('[Auth] Данные пользователя обновлены');
            } else {
                console.log('[Auth] Данные пользователя не изменились');
            }
        } catch (error) {
            console.error('[Auth] Ошибка получения информации о пользователе:', error);
        } finally {
            setIsUserInfoLoading(false);
            // Сбрасываем флаг с задержкой, чтобы избежать слишком частых запросов
            setTimeout(() => setUserInfoRequested(false), 1000);
        }
    }, [token, userData]); // Добавляем userData в зависимости

    // Загрузка данных аутентификации при монтировании
    const loadAuthData = useCallback(async () => {
        try {
            const { token: storedToken, userData: storedUserData } = await apiService.getStoredAuthData();
            console.log('[Auth] Загружены данные из хранилища:', {
                hasToken: !!storedToken,
                hasUserData: !!storedUserData
            });

            setToken(storedToken);
            setUserData(storedUserData);

            // Если есть токен, загружаем актуальную информацию о пользователе
            if (storedToken) {
                // Даем время на рендеринг перед запросом
                setTimeout(() => {
                    fetchUserInfo();
                }, 500);
            }
        } catch (error) {
            console.error('[Auth] Ошибка загрузки данных аутентификации:', error);
        } finally {
            setIsLoading(false);
        }
    }, [fetchUserInfo]);

    useEffect(() => {
        loadAuthData();
    }, []);

    const signIn = async (login: string, password: string) => {
        try {
            setIsLoading(true);
            console.log('[Auth] Попытка входа:', login);

            const data: LoginResponse = await apiService.login(login, password);

            if (data.AccessToken) {
                console.log('[Auth] Успешный вход, токен получен');
                setToken(data.AccessToken);

                // Создаем начальные данные пользователя
                const initialUserData: UserData = {
                    login: data.Username || login,
                    role: data.user?.role
                };

                setUserData(initialUserData);
                await SecureStore.setItemAsync('userData', JSON.stringify(initialUserData));

                // Загружаем полную информацию о пользователе
                await fetchUserInfo();

                console.log('[Auth] Перенаправление на профиль');
                router.replace('/(screens)/profile');
                return { success: true };
            } else {
                console.log('[Auth] Ошибка входа:', data.message);
                return {
                    success: false,
                    error: data.message || 'Ошибка авторизации'
                };
            }
        } catch (error: any) {
            console.error('[Auth] Ошибка при входе:', error);
            return {
                success: false,
                error: error.message || 'Сетевая ошибка. Проверьте подключение.'
            };
        } finally {
            setIsLoading(false);
        }
    };

    const signUp = async (login: string, password: string) => {
        try {
            setIsLoading(true);
            console.log('[Auth] Регистрация пользователя:', login);

            const result: AuthResult = await apiService.register(login, password);

            if (result.success) {
                console.log('[Auth] Успешная регистрация, выполняем вход');
                return await signIn(login, password);
            } else {
                console.log('[Auth] Ошибка регистрации:', result.error);
                return {
                    success: false,
                    error: result.error || 'Ошибка регистрации'
                };
            }
        } catch (error: any) {
            console.error('[Auth] Ошибка при регистрации:', error);
            return {
                success: false,
                error: error.message || 'Сетевая ошибка'
            };
        } finally {
            setIsLoading(false);
        }
    };

    const signOut = async () => {
        try {
            setIsLoading(true);
            console.log('[Auth] Выход из системы');

            // Отзываем токены на сервере
            await apiService.revokeTokens();

            // Очищаем локальные данные
            setToken(null);
            setUserData(null);
            setUserInfoRequested(false);

            console.log('[Auth] Перенаправление на профиль после выхода');
            router.replace('/(screens)/profile');
        } catch (error) {
            console.error('[Auth] Ошибка при выходе:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const refreshToken = useCallback(async (): Promise<boolean> => {
        try {
            console.log('[Auth] Обновление токена');
            const tokens = await apiService.refreshTokens();
            setToken(tokens.AccessToken);

            // Если есть имя пользователя в ответе, обновляем данные
            if (tokens.Username) {
                const updatedUserData = {
                    ...userData,
                    login: tokens.Username
                };
                setUserData(updatedUserData);
                await SecureStore.setItemAsync('userData', JSON.stringify(updatedUserData));
            }

            // Получаем актуальную информацию о пользователе
            await fetchUserInfo();

            console.log('[Auth] Токен успешно обновлен');
            return true;
        } catch (error) {
            console.error('[Auth] Ошибка обновления токена:', error);
            await signOut();
            return false;
        }
    }, [userData, fetchUserInfo, signOut]);

    const checkAuth = useCallback(async (): Promise<boolean> => {
        try {
            console.log('[Auth] Проверка аутентификации');
            const isAuthenticated = await apiService.checkAuthStatus();

            if (!isAuthenticated) {
                console.log('[Auth] Аутентификация не прошла, очищаем данные');
                setToken(null);
                setUserData(null);
            } else {
                console.log('[Auth] Аутентификация успешна');
            }

            return isAuthenticated;
        } catch (error) {
            console.error('[Auth] Ошибка проверки аутентификации:', error);
            return false;
        }
    }, []);

    return (
        <AuthContext.Provider value={{
            token,
            userData,
            isLoading,
            isUserInfoLoading,
            signIn,
            signUp,
            signOut,
            refreshToken,
            checkAuth,
            fetchUserInfo
        }}>
            {children}
        </AuthContext.Provider>
    );

};