
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiService, Site, SiteField, FieldName } from '../lib/apiService';

interface SitesContextType {
    sites: Site[];
    favoriteSiteIds: number[];
    fieldNames: FieldName[];
    loading: boolean;
    error: string | null;
    fetchSites: () => Promise<void>;
    fetchSiteFields: (id: number) => Promise<SiteField[]>;
    fetchFavoriteSites: () => Promise<void>;
    fetchFieldNames: () => Promise<void>;
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

export const SitesProvider = ({ children }: { children: React.ReactNode }) => {
    const [sites, setSites] = useState<Site[]>([]);
    const [favoriteSiteIds, setFavoriteSiteIds] = useState<number[]>([]);
    const [fieldNames, setFieldNames] = useState<FieldName[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSites = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const data = await apiService.getAllSites();
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

    const fetchFavoriteSites = async () => {
        try {
            // Проверяем, есть ли токен перед запросом
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
        // Оптимистичное обновление UI
        setFavoriteSiteIds(prev => {
            const newIds = prev.filter(id => id !== siteId);
            return newIds;
        });

        try {
            await apiService.removeFavoriteSite(siteId);
        } catch (error: any) {
            // Откатываем оптимистичное обновление при ошибке
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

    useEffect(() => {
        fetchSites();
        fetchFieldNames();

        const checkAndLoadFavorites = async () => {
            const { token } = await apiService.getStoredAuthData();
            if (token) {
                fetchFavoriteSites();
            }
        };

        checkAndLoadFavorites();
    }, []);

    return (
        <SitesContext.Provider value={{
            sites,
            favoriteSiteIds,
            fieldNames,
            loading,
            error,
            fetchSites,
            fetchSiteFields,
            fetchFavoriteSites,
            fetchFieldNames,
            addToFavorites,
            removeFromFavorites,
            isFavorite
        }}>
            {children}
        </SitesContext.Provider>
    );
};
