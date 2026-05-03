
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiService, Site, SiteField, FieldName, ParsedDataItem } from '../lib/apiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

interface SitesContextType {
    sites: Site[];
    favoriteSiteIds: number[];
    fieldNames: FieldName[];
    allParsedData: ParsedDataItem[];
    loading: boolean;
    error: string | null;
    fetchSites: () => Promise<void>;
    fetchSiteFields: (id: number) => Promise<SiteField[]>;
    fetchFavoriteSites: () => Promise<void>;
    fetchFieldNames: () => Promise<void>;
    fetchAllParsedData: () => Promise<void>;
    addToFavorites: (siteId: number) => Promise<void>;
    removeFromFavorites: (siteId: number) => Promise<void>;
    isFavorite: (siteId: number) => boolean;
    deleteSite: (siteId: number) => Promise<void>;
}

const SitesContext = createContext<SitesContextType | undefined>(undefined);

export const useSites = () => {
    const context = useContext(SitesContext);
    if (!context) {
        throw new Error('useSites must be used within a SitesProvider');
    }
    return context;
};

export const SitesProvider = ({ children }: { children: React.ReactNode }) => {
    const { token } = useAuth();
    const [sites, setSites] = useState<Site[]>([]);
    const [favoriteSiteIds, setFavoriteSiteIds] = useState<number[]>([]);
    const [fieldNames, setFieldNames] = useState<FieldName[]>([]);
    const [allParsedData, setAllParsedData] = useState<ParsedDataItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const PARSED_DATA_CACHE_KEY = 'parsedData_cache';
    const PARSED_DATA_TTL = 30 * 60 * 1000; // Кэш спарсенных данных на 30 минут

    const fetchSites = useCallback(async () => {
        setLoading(true);
        setError(null);

        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Превышено время ожидания')), 10000)
        );

        try {
            const data = await Promise.race([
                apiService.getAllSites(),
                timeoutPromise,
            ]);
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
            return await apiService.getSiteFields(id);
        } catch (error) {
            console.error('Error fetching site fields:', error);
            return [];
        }
    };

    const fetchFieldNames = useCallback(async () => {
        try {
            const data = await apiService.getFieldNames();
            setFieldNames(data);
        } catch (error) {
            console.error('Error fetching field names:', error);
        }
    }, []);

    const fetchAllParsedData = useCallback(async () => {
        try {
            // Стратегия cache-first: сначала проверяем кэш в AsyncStorage.
            // Если данные свежие (< 30 мин) — возвращаем без запроса к серверу.
            const cached = await AsyncStorage.getItem(PARSED_DATA_CACHE_KEY);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < PARSED_DATA_TTL) {
                    setAllParsedData(data);
                    return;
                }
            }
            // Кэш просрочен или пуст — загружаем с сервера и обновляем кэш
            const data = await apiService.getAllParsedData();
            setAllParsedData(data);
            await AsyncStorage.setItem(PARSED_DATA_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
        } catch (error) {
            console.error('Error fetching parsed data:', error);
        }
    }, []);

    const fetchFavoriteSites = async () => {
        try {
            // Проверяем токен до запроса — без него сервер вернёт 401,
            // а для анонимных пользователей избранное просто не существует.
            const { token } = await apiService.getStoredAuthData();
            if (!token) {
                setFavoriteSiteIds([]);
                return;
            }

            const data = await apiService.getFavoriteSites();
            const favoriteIds = data.map(fav => fav.AnalyzedSiteId);
            setFavoriteSiteIds(favoriteIds);
        } catch (error) {
            console.error('Error fetching favorites:', error);
            setFavoriteSiteIds([]);
        }
    };

    const addToFavorites = async (siteId: number): Promise<void> => {
        await apiService.addFavoriteSite(siteId);
        setFavoriteSiteIds(prev => [...prev, siteId]);
    };

    const removeFromFavorites = async (siteId: number): Promise<void> => {
        // Оптимистичное обновление: убираем из UI сразу, не дожидаясь ответа сервера.
        // Если сервер вернёт ошибку — возвращаем сайт обратно в избранное.
        setFavoriteSiteIds(prev => {
            const newIds = prev.filter(id => id !== siteId);
            return newIds;
        });

        try {
            await apiService.removeFavoriteSite(siteId);
        } catch (error: any) {
            // Откат при ошибке: возвращаем siteId в список избранного
            setFavoriteSiteIds(prev => {
                if (!prev.includes(siteId)) {
                    return [...prev, siteId];
                }
                return prev;
            });
            throw error;
        }
    };

    const isFavorite = (siteId: number): boolean => {
        return favoriteSiteIds.includes(siteId);
    };

    const deleteSite = async (siteId: number): Promise<void> => {
        await apiService.deleteAnalyzedSite(siteId);
        setSites(prev => prev.filter(s => s.Id !== siteId));
        setFavoriteSiteIds(prev => prev.filter(id => id !== siteId));
    };

    useEffect(() => {
        fetchSites();
        fetchFieldNames();
        fetchAllParsedData();
    }, []);

    useEffect(() => {
        if (token) {
            fetchFavoriteSites();
        } else {
            setFavoriteSiteIds([]);
        }
    }, [token]);

    return (
        <SitesContext.Provider value={{
            sites,
            favoriteSiteIds,
            fieldNames,
            allParsedData,
            loading,
            error,
            fetchSites,
            fetchSiteFields,
            fetchFavoriteSites,
            fetchFieldNames,
            fetchAllParsedData,
            addToFavorites,
            removeFromFavorites,
            isFavorite,
            deleteSite
        }}>
            {children}
        </SitesContext.Provider>
    );
};
