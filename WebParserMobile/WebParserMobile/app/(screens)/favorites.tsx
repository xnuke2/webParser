import { SafeAreaView } from "react-native-safe-area-context";
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { useAuth } from '@/contexts/AuthContext';
import { useSites } from '@/contexts/SitesContext';
import React, { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Feather, AntDesign } from '@expo/vector-icons';

export default function FavoritesScreen() {
    const [refreshing, setRefreshing] = useState(false);
    const { token } = useAuth();
    const {
        sites,
        favoriteSiteIds,
        loading,
        error,
        fetchSites,
        fetchSiteFields,
        fetchFavoriteSites,
        removeFromFavorites
    } = useSites();

    // Получаем только избранные сайты
    const favoriteSites = sites.filter(site => favoriteSiteIds.includes(site.Id));

    useEffect(() => {
        fetchSites();
        if (token) {
            fetchFavoriteSites();
        }
    }, [token]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        Promise.all([fetchSites(), token ? fetchFavoriteSites() : Promise.resolve()])
            .finally(() => setRefreshing(false));
    }, [fetchSites, fetchFavoriteSites, token]);

    const handleRemoveFavorite = async (siteId: number, siteName: string) => {
        Alert.alert(
            'Удалить из избранного',
            `Вы уверены, что хотите удалить "${siteName}" из избранного?`,
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Удалить',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await removeFromFavorites(siteId);
                            Alert.alert('Успех', 'Сайт удален из избранного');
                        } catch (error: any) {
                            Alert.alert('Ошибка', error.message || 'Не удалось удалить из избранного');
                        }
                    }
                }
            ]
        );
    };

    const handleSitePress = async (site: any) => {
        try {
            const fields = await fetchSiteFields(site.Id);

            const fieldsText = fields && fields.length > 0
                ? `\nДанные с парсера:\n${fields.map(field => `• ${field.Field}: ${field.Data}`).join('\n')}`
                : '\n\nНет данных с парсера';

            Alert.alert(
                site.Name,
                `URL: ${site.Url}${fieldsText}`,
                [
                    { text: 'OK', style: 'default' },
                    {
                        text: 'Удалить из избранного',
                        style: 'destructive',
                        onPress: () => handleRemoveFavorite(site.Id, site.Name)
                    }
                ]
            );
        } catch (error) {
            Alert.alert('Ошибка', 'Не удалось загрузить данные сайта');
        }
    };

    if (!token) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.authRequired}>
                    <Feather name="lock" size={64} color="#95a5a6" />
                    <Text style={styles.authRequiredTitle}>Требуется авторизация</Text>
                    <Text style={styles.authRequiredText}>
                        Для доступа к избранному необходимо войти в систему
                    </Text>
                    <TouchableOpacity
                        style={styles.authButton}
                        onPress={() => router.push('/(auth)/login')}
                    >
                        <Text style={styles.authButtonText}>Войти</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, styles.centerContent]}>
                <ActivityIndicator size="large" color="#4a6fa5" />
                <Text style={styles.loadingText}>Загрузка избранного...</Text>
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={[styles.container, styles.centerContent]}>
                <Feather name="alert-circle" size={64} color="#e74c3c" />
                <Text style={styles.errorText}>Ошибка загрузки</Text>
                <Text style={styles.errorSubtext}>{error}</Text>
                <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
                    <Text style={styles.retryButtonText}>Повторить</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    if (favoriteSites.length === 0) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.mainContent}>
                    <View style={styles.header}>
                        <Text style={styles.sectionTitle}>Избранное</Text>
                    </View>

                    <View style={styles.emptyState}>
                        <AntDesign name="staro" size={64} color="#bdc3c7" />
                        <Text style={styles.emptyTitle}>Нет избранных сайтов</Text>
                        <Text style={styles.emptyText}>
                            Добавляйте сайты в избранное для быстрого доступа
                        </Text>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.mainContent}>
                <View style={styles.header}>
                    <Text style={styles.sectionTitle}>Избранное</Text>
                    <Text style={styles.siteCount}>
                        <AntDesign name="star" size={14} color="#f39c12" /> {favoriteSites.length} сайтов
                    </Text>
                </View>

                <ScrollView
                    style={styles.scrollView}
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={['#4a6fa5']}
                            tintColor="#4a6fa5"
                        />
                    }
                >
                    {favoriteSites.map((site) => (
                        <TouchableOpacity
                            key={site.Id}
                            style={styles.favoriteCard}
                            onPress={() => handleSitePress(site)}
                            onLongPress={() => handleRemoveFavorite(site.Id, site.Name)}
                        >
                            <View style={styles.favoriteIconContainer}>
                                <AntDesign name="star" size={24} color="#f39c12" />
                            </View>
                            <View style={styles.favoriteCardContent}>
                                <Text style={styles.favoriteCardTitle}>{site.Name}</Text>
                                <Text style={styles.favoriteCardUrl}>{site.Url}</Text>
                                <View style={styles.favoriteCardInfo}>
                                    <Text style={styles.favoriteCardId}>ID: {site.Id}</Text>
                                    <Text style={styles.favoriteCardHint}>
                                        Нажмите для просмотра данных
                                    </Text>
                                </View>
                            </View>
                            <Feather name="chevron-right" size={20} color="#95a5a6" />
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f7fa',
    },
    centerContent: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#7f8c8d',
    },
    authRequired: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    authRequiredTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginTop: 16,
        marginBottom: 8,
    },
    authRequiredText: {
        fontSize: 16,
        color: '#7f8c8d',
        textAlign: 'center',
        marginBottom: 24,
        maxWidth: 300,
    },
    authButton: {
        backgroundColor: '#4a6fa5',
        borderRadius: 12,
        paddingHorizontal: 24,
        paddingVertical: 12,
    },
    authButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    mainContent: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2c3e50',
    },
    siteCount: {
        fontSize: 14,
        color: '#f39c12',
        backgroundColor: '#fff8e1',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        fontWeight: '600',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    favoriteCard: {
        backgroundColor: '#fff8e1',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ffecb3',
    },
    favoriteIconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#fff3cd',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    favoriteCardContent: {
        flex: 1,
    },
    favoriteCardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 4,
    },
    favoriteCardUrl: {
        fontSize: 14,
        color: '#3498db',
        marginBottom: 6,
    },
    favoriteCardInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    favoriteCardId: {
        fontSize: 12,
        color: '#95a5a6',
    },
    favoriteCardHint: {
        fontSize: 12,
        color: '#f39c12',
        fontStyle: 'italic',
    },
    errorText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginTop: 16,
    },
    errorSubtext: {
        fontSize: 14,
        color: '#e74c3c',
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 20,
        maxWidth: 300,
    },
    retryButton: {
        backgroundColor: '#4a6fa5',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        marginTop: 10,
    },
    retryButtonText: {
        color: 'white',
        fontWeight: '600',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#95a5a6',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#bdc3c7',
        textAlign: 'center',
        maxWidth: 300,
    },
});