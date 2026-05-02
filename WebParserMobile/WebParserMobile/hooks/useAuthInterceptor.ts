import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// Проактивно обновляем токен за 2 минуты до истечения (access token живёт 15 минут)
const REFRESH_BEFORE_EXPIRY_MS = 2 * 60 * 1000;
const ACCESS_TOKEN_LIFETIME_MS = 15 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000; // проверяем раз в минуту

export const useAuthInterceptor = () => {
    const { refreshToken, token } = useAuth();
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastRefreshTimeRef = useRef<number>(Date.now());

    useEffect(() => {
        if (!token) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        lastRefreshTimeRef.current = Date.now();

        const check = async () => {
            const elapsed = Date.now() - lastRefreshTimeRef.current;
            const shouldRefresh = elapsed >= ACCESS_TOKEN_LIFETIME_MS - REFRESH_BEFORE_EXPIRY_MS;

            if (!shouldRefresh) return;

            try {
                await refreshToken();
                lastRefreshTimeRef.current = Date.now();
            } catch {
                // 401 обрабатывается в refreshToken → signOut
            }
        };

        intervalRef.current = setInterval(check, CHECK_INTERVAL_MS);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [token]);
};
