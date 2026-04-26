// hooks/useAuthInterceptor.ts
import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {apiService} from "@/lib/apiService";

export const useAuthInterceptor = () => {
    const { refreshToken, checkAuth, token } = useAuth();
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const isRunningRef = useRef(false);
    const lastRefreshTimeRef = useRef<number>(0);
    const checkAndRefreshToken = async () => {
        if (isRunningRef.current) return;

        isRunningRef.current = true;
        try {
            console.log('[AuthInterceptor] Проверяем статус аутентификации...');

            // Используем простую проверку без обновления
            const isAuthenticated = await apiService.checkAuthWithoutRefresh();

            if (isAuthenticated) {
                console.log('[AuthInterceptor] Токен валиден');

                // Проверяем, когда последний раз обновлялся токен
                const now = Date.now();
                const timeSinceLastRefresh = now - lastRefreshTimeRef.current;

                // Обновляем токен только если прошло больше 8 минут с последнего обновления
                // (access token обычно живет 15 минут)
                if (timeSinceLastRefresh > 8 * 60 * 1000) {
                    console.log('[AuthInterceptor] Прошло более 8 минут, обновляем токен');
                    await refreshToken();
                    lastRefreshTimeRef.current = now;
                } else {
                    console.log('[AuthInterceptor] Токен еще свежий, пропускаем обновление');
                }
            } else {
                console.log('[AuthInterceptor] Токен не валиден, пытаемся обновить');
                // Если токен невалиден, пытаемся обновить
                await refreshToken();
                lastRefreshTimeRef.current = Date.now();
            }
        } catch (error) {
            console.error('[AuthInterceptor] Ошибка:', error);
        } finally {
            isRunningRef.current = false;
        }
    };
    useEffect(() => {
        if (!token) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        const checkAndRefreshToken = async () => {
            if (isRunningRef.current) return;

            isRunningRef.current = true;
            try {
                console.log('[AuthInterceptor] Проверяем статус аутентификации...');
                const isAuthenticated = await checkAuth();

                if (isAuthenticated) {
                    console.log('[AuthInterceptor] Токен валиден');

                    // Проверяем, когда последний раз обновлялся токен
                    const now = Date.now();
                    const timeSinceLastRefresh = now - lastRefreshTimeRef.current;

                    // Обновляем токен только если прошло больше 5 минут с последнего обновления
                    if (timeSinceLastRefresh > 5 * 60 * 1000) {
                        console.log('[AuthInterceptor] Прошло более 5 минут, обновляем токен');
                        await refreshToken();
                        lastRefreshTimeRef.current = now;
                    } else {
                        console.log('[AuthInterceptor] Токен недавно обновлялся, пропускаем');
                    }
                } else {
                    console.log('[AuthInterceptor] Токен не валиден');
                    // Если токен невалиден, пытаемся обновить
                    await refreshToken();
                    lastRefreshTimeRef.current = Date.now();
                }
            } catch (error) {
                console.error('[AuthInterceptor] Ошибка:', error);
            } finally {
                isRunningRef.current = false;
            }
        };

        // Сбрасываем время последнего обновления
        lastRefreshTimeRef.current = Date.now();

        // Запускаем сразу
        checkAndRefreshToken();

        // Затем каждые 2 минуты (вместо 10)
        intervalRef.current = setInterval(checkAndRefreshToken, 2 * 60 * 1000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [token, refreshToken, checkAuth]);
};