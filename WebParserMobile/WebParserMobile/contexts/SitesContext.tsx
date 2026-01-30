import React, { createContext, useContext, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

interface Site {
    Id: number;
    Url: string;
    Name: string;
}

interface SiteField {
    Field: string;
    Data: string;
}

interface FavoriteSite {
    AnalyzedSiteId: number;
    UserId: number;
}

interface SitesContextType {
    sites: Site[];
    favoriteSiteIds: number[]; // Массив ID избранных сайтов
    loading: boolean;
    error: string | null;
    fetchSites: () => Promise<void>;
    fetchSiteFields: (id: number) => Promise<SiteField[]>;
    fetchFavoriteSites: () => Promise<void>;
    addToFavorites: (siteId: number) => Promise<void>;
    removeFromFavorites: (siteId: number) => Promise<void>;
    isFavorite: (siteId: number) => boolean;
}

const SitesContext = createContext<SitesContextType | undefined>(undefined);

export const useSites = () => {
    const context = useContext(SitesContext);
    if (!context) {
        throw new Error('useSites must be used within a SitesProvider');
    }
    return context;
};

const API_URL = Platform.select({
    ios: 'http://localhost:8088',
    android: 'http://192.168.31.177:8088',
    web: 'http://localhost:8088',
});

export const SitesProvider = ({ children }: { children: React.ReactNode }) => {
    const [sites, setSites] = useState<Site[]>([]);
    const [favoriteSiteIds, setFavoriteSiteIds] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const getToken = async (): Promise<string | null> => {
        try {
            return await SecureStore.getItemAsync('userToken');
        } catch (error) {
            console.error('Error getting token:', error);
            return null;
        }
    };

    const fetchSites = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_URL}/api/AnalyzedSite/all`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setSites(data);
        } catch (err: any) {
            setError(err.message || 'Ошибка при загрузке данных');
            console.error('Ошибка при загрузке данных:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchSiteFields = async (id: number): Promise<SiteField[]> => {
        try {
            const response = await fetch(`${API_URL}/api/Parser/${id}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching site fields:', error);
            return [];
        }
    };

    const fetchFavoriteSites = async () => {
        const token = await getToken();
        if (!token) {
            setFavoriteSiteIds([]);
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/FaforiteSite/my`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data: FavoriteSite[] = await response.json();
                const favoriteIds = data.map(fav => fav.AnalyzedSiteId);
                setFavoriteSiteIds(favoriteIds);
            } else {
                console.error('Error fetching favorites:', response.status);
                setFavoriteSiteIds([]);
            }
        } catch (error) {
            console.error('Error fetching favorites:', error);
            setFavoriteSiteIds([]);
        }
    };

    const addToFavorites = async (siteId: number): Promise<void> => {
        const token = await getToken();
        if (!token) {
            throw new Error('Требуется авторизация');
        }

        const response = await fetch(`${API_URL}/api/FaforiteSite`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ AnalyzedSiteId: siteId })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Ошибка при добавлении в избранное: ${response.status}`);
        }

        // Обновляем список избранных
        setFavoriteSiteIds(prev => [...prev, siteId]);
    };

    const removeFromFavorites = async (siteId: number): Promise<void> => {
        const token = await getToken();
        if (!token) {
            throw new Error('Требуется авторизация');
        }

        try {
            const response = await fetch(`${API_URL}/api/FaforiteSite/${siteId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json', // Явно указываем, что ожидаем JSON
                }
            });

            // Проверяем статус ответа
            if (response.status === 204 || response.status === 200) {
                // Для статусов 204 (No Content) или 200 с пустым телом
                // Обновляем список избранных
                setFavoriteSiteIds(prev => prev.filter(id => id !== siteId));
                return;
            }

            // Если сервер вернул ошибку, пробуем получить текст ошибки
            let errorMessage = `Ошибка при удалении из избранного: ${response.status}`;

            try {
                // Пробуем получить текст ответа
                const responseText = await response.text();

                // Если есть текст и он не пустой, пытаемся разобрать как JSON
                if (responseText && responseText.trim()) {
                    try {
                        const errorData = JSON.parse(responseText);
                        errorMessage = errorData.message || errorMessage;
                    } catch {
                        // Если не JSON, используем текст как есть
                        errorMessage = responseText;
                    }
                }
            } catch (textError) {
                console.error('Error reading response text:', textError);
            }

            throw new Error(errorMessage);

        } catch (error: any) {
            if (error instanceof SyntaxError) {
                // Это ошибка парсинга JSON - сервер вернул не JSON
                throw new Error('Сервер вернул некорректный ответ. Возможно, пустое тело запроса.');
            }
            throw error;
        }
    };

    const isFavorite = (siteId: number): boolean => {
        return favoriteSiteIds.includes(siteId);
    };

    React.useEffect(() => {
        fetchSites();
        fetchFavoriteSites();
    }, []);

    return (
        <SitesContext.Provider value={{
            sites,
            favoriteSiteIds,
            loading,
            error,
            fetchSites,
            fetchSiteFields,
            fetchFavoriteSites,
            addToFavorites,
            removeFromFavorites,
            isFavorite
        }}>
            {children}
        </SitesContext.Provider>
    );
};