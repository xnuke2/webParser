import { SafeAreaView } from "react-native-safe-area-context";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    RefreshControl,
    Modal
} from "react-native";
import { useSites } from '@/contexts/SitesContext';
import { useAuth } from '@/contexts/AuthContext';
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { Feather, MaterialIcons, AntDesign } from '@expo/vector-icons';


interface Site {
    Id: number;
    Url: string;
    Name: string;
}

interface SiteField {
    Field: string;
    Data: string;
}

type SortOption = 'name-asc' | 'name-desc' | 'id-asc' | 'id-desc';

export default function Sites() {
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('name-asc');
    const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
    const [siteFields, setSiteFields] = useState<Record<number, SiteField[]>>({});
    const [loadingFields, setLoadingFields] = useState<Record<number, boolean>>({});
    const [showUrlModal, setShowUrlModal] = useState(false);
    const [selectedUrl, setSelectedUrl] = useState('');
    const [isManagingFavorite, setIsManagingFavorite] = useState<number | null>(null);

    const { token } = useAuth();
    const {
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
    } = useSites();

    // Фильтрация и сортировка сайтов
    const filteredAndSortedSites = useMemo(() => {
        let filtered = [...sites];

        // Поиск
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(site =>
                site.Name.toLowerCase().includes(query) ||
                site.Url.toLowerCase().includes(query)
            );
        }

        // Сортировка
        switch (sortBy) {
            case 'name-asc':
                filtered.sort((a, b) => a.Name.localeCompare(b.Name));
                break;
            case 'name-desc':
                filtered.sort((a, b) => b.Name.localeCompare(a.Name));
                break;
            case 'id-asc':
                filtered.sort((a, b) => a.Id - b.Id);
                break;
            case 'id-desc':
                filtered.sort((a, b) => b.Id - a.Id);
                break;
        }

        return filtered;
    }, [sites, searchQuery, sortBy]);

    useEffect(() => {
        fetchSites();
    }, []);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        Promise.all([fetchSites(), fetchFavoriteSites()])
            .finally(() => setRefreshing(false));
    }, [fetchSites, fetchFavoriteSites]);

    // Загрузка полей сайта
    const loadSiteFields = async (siteId: number) => {
        if (siteFields[siteId]) return; // Уже загружены

        setLoadingFields(prev => ({ ...prev, [siteId]: true }));
        try {
            const fields = await fetchSiteFields(siteId);
            setSiteFields(prev => ({ ...prev, [siteId]: fields }));
        } catch (error) {
            console.error('Error loading site fields:', error);
        } finally {
            setLoadingFields(prev => ({ ...prev, [siteId]: false }));
        }
    };

    // Обработка раскрытия/скрытия карточки
    const handleCardPress = (site: Site) => {
        if (expandedCardId === site.Id) {
            setExpandedCardId(null);
        } else {
            setExpandedCardId(site.Id);
            loadSiteFields(site.Id);
        }
    };

    // Добавление в избранное
    const handleAddToFavorites = async (siteId: number) => {
        if (!token) {
            Alert.alert(
                'Требуется авторизация',
                'Для добавления в избранное необходимо войти в систему',
                [
                    { text: 'Отмена', style: 'cancel' },
                    {
                        text: 'Войти',
                        onPress: () => router.push('/(auth)/login')
                    }
                ]
            );
            return;
        }

        setIsManagingFavorite(siteId);
        try {
            await addToFavorites(siteId);
            Alert.alert('Успех', 'Сайт добавлен в избранное');
        } catch (error: any) {
            Alert.alert('Ошибка', error.message || 'Не удалось добавить в избранное');
        } finally {
            setIsManagingFavorite(null);
        }
    };

    // Удаление из избранного
    const handleRemoveFromFavorites = async (siteId: number) => {
        setIsManagingFavorite(siteId);
        try {
            await removeFromFavorites(siteId);
            //Alert.alert('Успех', 'Сайт удален из избранного');
            setRefreshing(true);
            Promise.all([fetchSites(), fetchFavoriteSites()])
                .finally(() => setRefreshing(false));
        } catch (error: any) {
            Alert.alert('Ошибка', error.message || 'Не удалось удалить из избранного');
        } finally {
            setIsManagingFavorite(null);
        }
    };

    // Обработка нажатия на кнопку избранного
    const handleFavoritePress = (siteId: number) => {
        if (isFavorite(siteId)) {
            Alert.alert(
                'Удалить из избранного',
                'Вы уверены, что хотите удалить этот сайт из избранного?',
                [
                    { text: 'Отмена', style: 'cancel' },
                    {
                        text: 'Удалить',
                        style: 'destructive',
                        onPress: () => handleRemoveFromFavorites(siteId)
                    }
                ]
            );
        } else {
            handleAddToFavorites(siteId);
        }
    };

    // Показать URL в модальном окне
    const handleShowUrl = (url: string) => {
        setSelectedUrl(url);
        setShowUrlModal(true);
    };

    // Сортировка
    const handleSortChange = () => {
        const sortOptions: SortOption[] = ['name-asc', 'name-desc', 'id-asc', 'id-desc'];
        const currentIndex = sortOptions.indexOf(sortBy);
        const nextIndex = (currentIndex + 1) % sortOptions.length;
        setSortBy(sortOptions[nextIndex]);
    };

    const getSortLabel = () => {
        switch (sortBy) {
            case 'name-asc': return 'По названию (А-Я)';
            case 'name-desc': return 'По названию (Я-А)';
            case 'id-asc': return 'По ID (↑)';
            case 'id-desc': return 'По ID (↓)';
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4a6fa5" />
                    <Text style={styles.loadingText}>Загрузка сайтов...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <MaterialIcons name="error-outline" size={64} color="#e74c3c" />
                    <Text style={styles.errorText}>Ошибка загрузки</Text>
                    <Text style={styles.errorSubtext}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={fetchSites}>
                        <Text style={styles.retryButtonText}>Повторить попытку</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Заголовок */}
            <View style={styles.header}>
                <Text style={styles.title}>Сайты</Text>
                <View style={styles.headerStats}>
                    <Text style={styles.subtitle}>
                        {filteredAndSortedSites.length} из {sites.length} сайтов
                    </Text>
                    {token && (
                        <Text style={styles.favoritesCount}>
                            <AntDesign name="star" size={14} color="#f39c12" /> {favoriteSiteIds.length}
                        </Text>
                    )}
                </View>
            </View>

            {/* Панель поиска и сортировки */}
            <View style={styles.controls}>
                <View style={styles.searchContainer}>
                    <Feather name="search" size={20} color="#95a5a6" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Поиск по названию или URL..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        clearButtonMode="while-editing"
                    />
                    {searchQuery ? (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Feather name="x-circle" size={20} color="#95a5a6" />
                        </TouchableOpacity>
                    ) : null}
                </View>

                <TouchableOpacity style={styles.sortButton} onPress={handleSortChange}>
                    <Feather name="filter" size={18} color="#4a6fa5" />
                    <Text style={styles.sortButtonText}>{getSortLabel()}</Text>
                    <Feather name="chevron-down" size={16} color="#4a6fa5" />
                </TouchableOpacity>
            </View>

            {/* Список сайтов */}
            <ScrollView
                style={styles.scrollView}
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
                {filteredAndSortedSites.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Feather name="inbox" size={64} color="#bdc3c7" />
                        <Text style={styles.emptyTitle}>Сайты не найдены</Text>
                        <Text style={styles.emptyText}>
                            {searchQuery
                                ? 'Попробуйте изменить поисковый запрос'
                                : 'Нет доступных сайтов для отображения'
                            }
                        </Text>
                    </View>
                ) : (
                    filteredAndSortedSites.map((site) => {
                        const favorite = isFavorite(site.Id);
                        const isLoading = isManagingFavorite === site.Id;

                        return (
                            <TouchableOpacity
                                key={site.Id}
                                style={[
                                    styles.card,
                                    expandedCardId === site.Id && styles.cardExpanded,
                                    favorite && styles.cardFavorite
                                ]}
                                onPress={() => handleCardPress(site)}
                                activeOpacity={0.7}
                            >
                                {/* Заголовок карточки */}
                                <View style={styles.cardHeader}>
                                    <View style={styles.siteIcon}>
                                        <Feather name="globe" size={20} color="#4a6fa5" />
                                    </View>
                                    <View style={styles.cardHeaderContent}>
                                        <Text style={styles.siteName} numberOfLines={1}>
                                            {site.Name}
                                        </Text>
                                        <View style={styles.siteInfoRow}>
                                            <Text style={styles.siteId}>ID: {site.Id}</Text>
                                            {favorite && (
                                                <View style={styles.favoriteBadge}>
                                                    <AntDesign name="star" size={10} color="#fff" />
                                                    <Text style={styles.favoriteBadgeText}>В избранном</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    {/* Кнопка избранного */}
                                    {token && (
                                        <TouchableOpacity
                                            style={styles.favoriteButton}
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                handleFavoritePress(site.Id);
                                            }}
                                            disabled={isLoading}
                                        >
                                            {isLoading ? (
                                                <ActivityIndicator size="small" color={favorite ? "#f39c12" : "#bdc3c7"} />
                                            ) : (
                                                favorite ?
                                                <AntDesign
                                                    name={"star"}
                                                    size={20}
                                                    color={favorite ? "#f39c12" : "#bdc3c7"}
                                                />:
                                                    <Feather
                                                        name={"star"}
                                                        size={20}
                                                        color={favorite ? "#f39c12" : "#bdc3c7"}
                                                    />
                                            )}
                                        </TouchableOpacity>
                                    )}

                                    {/* Кнопка ссылки */}
                                    <TouchableOpacity
                                        style={styles.urlButton}
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            handleShowUrl(site.Url);
                                        }}
                                    >
                                        <Feather name="link" size={16} color="#3498db" />
                                    </TouchableOpacity>

                                    {/* Стрелка раскрытия */}
                                    <Feather
                                        name={expandedCardId === site.Id ? "chevron-up" : "chevron-down"}
                                        size={20}
                                        color="#95a5a6"
                                    />
                                </View>

                                {/* Расширенная информация */}
                                {expandedCardId === site.Id && (
                                    <View style={styles.expandedContent}>
                                        {/* URL сайта */}
                                        <View style={styles.urlSection}>
                                            <Text style={styles.sectionLabel}>URL:</Text>
                                            <TouchableOpacity onPress={() => handleShowUrl(site.Url)}>
                                                <Text style={styles.urlText} numberOfLines={1}>
                                                    {site.Url}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Данные с парсера */}
                                        <View style={styles.fieldsSection}>
                                            <Text style={styles.sectionLabel}>Данные:</Text>
                                            {loadingFields[site.Id] ? (
                                                <View style={styles.loadingFields}>
                                                    <ActivityIndicator size="small" color="#4a6fa5" />
                                                    <Text style={styles.loadingFieldsText}>Загрузка данных...</Text>
                                                </View>
                                            ) : siteFields[site.Id] && siteFields[site.Id].length > 0 ? (
                                                siteFields[site.Id].map((field, index) => (
                                                    <View key={index} style={styles.fieldItem}>
                                                        <View style={styles.fieldHeader}>
                                                            <Text style={styles.fieldName}>{field.Field}</Text>
                                                            <View style={styles.fieldValueContainer}>
                                                                <Text style={styles.fieldValue} numberOfLines={2}>
                                                                    {field.Data}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                ))
                                            ) : (
                                                <Text style={styles.noDataText}>Нет данных с парсера</Text>
                                            )}
                                        </View>

                                        {/* Кнопки действий для авторизованных пользователей */}
                                        {token && (
                                            <View style={styles.actionsSection}>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.actionButton,
                                                        favorite ? styles.removeFavoriteButton : styles.addFavoriteButton
                                                    ]}
                                                    onPress={() => handleFavoritePress(site.Id)}
                                                    disabled={isLoading}
                                                >
                                                    {isLoading ? (
                                                        <ActivityIndicator size="small" color="white" />
                                                    ) : (
                                                        <>
                                                            <AntDesign
                                                                name={favorite ? "star" : "staro"}
                                                                size={16}
                                                                color="white"
                                                            />
                                                            <Text style={styles.actionButtonText}>
                                                                {favorite ? 'Удалить из избранного' : 'Добавить в избранное'}
                                                            </Text>
                                                        </>
                                                    )}
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>

            {/* Модальное окно для отображения полного URL */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={showUrlModal}
                onRequestClose={() => setShowUrlModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Полный URL сайта</Text>
                        <ScrollView style={styles.urlModalScroll}>
                            <Text style={styles.fullUrlText} selectable={true}>
                                {selectedUrl}
                            </Text>
                        </ScrollView>
                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setShowUrlModal(false)}
                        >
                            <Text style={styles.modalCloseButtonText}>Закрыть</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f7fa',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#7f8c8d',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
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
    },
    retryButton: {
        backgroundColor: '#4a6fa5',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 8,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#2c3e50',
    },
    headerStats: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#7f8c8d',
    },
    favoritesCount: {
        fontSize: 14,
        color: '#f39c12',
        fontWeight: '600',
    },
    controls: {
        paddingHorizontal: 20,
        paddingBottom: 16,
        gap: 12,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    searchInput: {
        flex: 1,
        marginLeft: 12,
        fontSize: 16,
        color: '#2c3e50',
        padding: 0,
    },
    sortButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    sortButtonText: {
        flex: 1,
        marginLeft: 8,
        fontSize: 14,
        color: '#4a6fa5',
        fontWeight: '500',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 16,
        marginBottom: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    cardExpanded: {
        borderColor: '#4a6fa5',
        shadowColor: '#4a6fa5',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    cardFavorite: {
        borderLeftWidth: 4,
        borderLeftColor: '#f39c12',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    siteIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#e8f4fc',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    cardHeaderContent: {
        flex: 1,
    },
    siteName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 4,
    },
    siteInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    siteId: {
        fontSize: 12,
        color: '#95a5a6',
    },
    favoriteBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f39c12',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    favoriteBadgeText: {
        fontSize: 10,
        color: '#fff',
        fontWeight: '600',
        marginLeft: 4,
    },
    favoriteButton: {
        padding: 8,
        marginRight: 8,
    },
    urlButton: {
        padding: 8,
        marginRight: 12,
    },
    expandedContent: {
        padding: 16,
        paddingTop: 0,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    urlSection: {
        marginBottom: 16,
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#7f8c8d',
        marginBottom: 8,
    },
    urlText: {
        fontSize: 14,
        color: '#3498db',
        backgroundColor: '#f0f7ff',
        padding: 12,
        borderRadius: 8,
        fontFamily: 'monospace',
    },
    fieldsSection: {
        marginBottom: 16,
    },
    loadingFields: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
    },
    loadingFieldsText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#7f8c8d',
    },
    fieldItem: {
        marginBottom: 12,
    },
    fieldHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    fieldName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#2c3e50',
        flex: 1,
    },
    fieldValueContainer: {
        flex: 2,
        backgroundColor: '#f8f9fa',
        padding: 12,
        borderRadius: 8,
        marginLeft: 12,
    },
    fieldValue: {
        fontSize: 14,
        color: '#34495e',
    },
    noDataText: {
        fontSize: 14,
        color: '#95a5a6',
        fontStyle: 'italic',
        padding: 12,
        textAlign: 'center',
    },
    actionsSection: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        gap: 8,
    },
    addFavoriteButton: {
        backgroundColor: '#4a6fa5',
    },
    removeFavoriteButton: {
        backgroundColor: '#e74c3c',
    },
    actionButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    emptyState: {
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 20,
        width: '100%',
        maxWidth: 400,
        maxHeight: '80%',
        padding: 24,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 16,
        textAlign: 'center',
    },
    urlModalScroll: {
        maxHeight: 200,
        marginBottom: 20,
    },
    fullUrlText: {
        fontSize: 14,
        color: '#2c3e50',
        fontFamily: 'monospace',
        backgroundColor: '#f8f9fa',
        padding: 16,
        borderRadius: 8,
    },
    modalCloseButton: {
        backgroundColor: '#4a6fa5',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
    },
    modalCloseButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});