
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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
    Modal,
    FlatList,
} from "react-native";
import { useSites } from '@/contexts/SitesContext';
import { useAuth } from '@/contexts/AuthContext';
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { Feather, MaterialIcons, AntDesign } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

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

interface FilterCondition {
    id: string;
    fieldNameId: number | null;
    value: string;
    valueFrom: string;
    valueTo: string;
}

const NUMERIC_FIELD_NAMES = ['Цена', 'Год выпуска', 'Пробег', 'Мощность двигателя', 'Объём двигателя'];

export default function Sites() {
    const insets = useSafeAreaInsets();
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('name-asc');
    const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
    const [siteFields, setSiteFields] = useState<Record<number, SiteField[]>>({});
    const [loadingFields, setLoadingFields] = useState<Record<number, boolean>>({});
    const [showUrlModal, setShowUrlModal] = useState(false);
    const [selectedUrl, setSelectedUrl] = useState('');
    const [isManagingFavorite, setIsManagingFavorite] = useState<number | null>(null);
    const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);
    const [pendingConditions, setPendingConditions] = useState<FilterCondition[]>([]);
    const [showFieldPicker, setShowFieldPicker] = useState<string | null>(null);

    const { token } = useAuth();
    const router = useRouter();

    const {
        sites,
        favoriteSiteIds,
        fieldNames,
        allParsedData,
        loading,
        error,
        fetchSites,
        fetchSiteFields,
        fetchFavoriteSites,
        addToFavorites,
        removeFromFavorites,
        isFavorite
    } = useSites();

    useEffect(() => {
        fetchSites();
        const loadFavorites = async () => {
            if (token) {
                try {
                    await fetchFavoriteSites();
                } catch (error) {
                    console.error('Error loading favorites on mount:', error);
                }
            }
        };
        loadFavorites();
    }, []);

    useEffect(() => {
        if (token) {
            const timer = setTimeout(() => {
                fetchFavoriteSites();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [token]);

    // Фильтрация сайтов (поиск + только избранные + условия фильтрации)
    const filteredAndSortedSites = useMemo(() => {
        let filtered = [...sites];

        if (showOnlyFavorites && token) {
            filtered = filtered.filter(site => isFavorite(site.Id));
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(site =>
                site.Name.toLowerCase().includes(query) ||
                site.Url.toLowerCase().includes(query)
            );
        }

        // Фильтрация по условиям FieldName
        if (filterConditions.length > 0) {
            filtered = filtered.filter(site => {
                const fields = siteFields[site.Id];
                if (!fields) return false;
                return filterConditions.every(condition => {
                    if (!condition.fieldNameId) return true;
                    const fieldName = fieldNames.find(f => f.Id === condition.fieldNameId);
                    if (!fieldName) return true;
                    const field = fields.find(f => f.Field.toLowerCase() === fieldName.Name.toLowerCase());
                    if (!field) return false;

                    const isNumeric = NUMERIC_FIELD_NAMES.includes(fieldName.Name);
                    if (isNumeric) {
                        const numValue = parseFloat(field.Data.replace(/[^\d.,]/g, '').replace(',', '.'));
                        if (isNaN(numValue)) return false;
                        if (condition.valueFrom.trim()) {
                            const from = parseFloat(condition.valueFrom.replace(',', '.'));
                            if (!isNaN(from) && numValue < from) return false;
                        }
                        if (condition.valueTo.trim()) {
                            const to = parseFloat(condition.valueTo.replace(',', '.'));
                            if (!isNaN(to) && numValue > to) return false;
                        }
                        return true;
                    }

                    if (!condition.value.trim()) return true;
                    return field.Data.toLowerCase().includes(condition.value.toLowerCase());
                });
            });
        }

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
    }, [sites, searchQuery, sortBy, showOnlyFavorites, token, isFavorite, filterConditions, siteFields, fieldNames]);

    const activeFiltersCount = filterConditions.filter(c => c.fieldNameId !== null).length;

    const openFilterModal = () => {
        setPendingConditions(filterConditions.length > 0 ? [...filterConditions] : []);
        setShowFilterModal(true);
    };

    const addCondition = () => {
        setPendingConditions(prev => [...prev, {
            id: Date.now().toString(),
            fieldNameId: null,
            value: '',
            valueFrom: '',
            valueTo: '',
        }]);
    };

    const removeCondition = (id: string) => {
        setPendingConditions(prev => prev.filter(c => c.id !== id));
    };

    const updateConditionField = (id: string, fieldNameId: number | null) => {
        setPendingConditions(prev => prev.map(c => c.id === id ? { ...c, fieldNameId } : c));
        setShowFieldPicker(null);
    };

    const updateConditionValue = (id: string, value: string) => {
        setPendingConditions(prev => prev.map(c => c.id === id ? { ...c, value } : c));
    };

    const updateConditionValueFrom = (id: string, valueFrom: string) => {
        setPendingConditions(prev => prev.map(c => c.id === id ? { ...c, valueFrom } : c));
    };

    const updateConditionValueTo = (id: string, valueTo: string) => {
        setPendingConditions(prev => prev.map(c => c.id === id ? { ...c, valueTo } : c));
    };

    const applyFilters = () => {
        setFilterConditions(pendingConditions.filter(c => c.fieldNameId !== null));
        setShowFilterModal(false);
    };

    const resetFilters = () => {
        setPendingConditions([]);
        setFilterConditions([]);
        setShowFilterModal(false);
    };

    const getUniqueValuesForField = (fieldNameId: number): string[] => {
        const fieldName = fieldNames.find(f => f.Id === fieldNameId);
        if (!fieldName) return [];
        const values = allParsedData
            .filter(p => p.Field.toLowerCase() === fieldName.Name.toLowerCase())
            .map(p => p.Data.trim())
            .filter(Boolean);
        return [...new Set(values)].sort();
    };

    const extractDomainFromUrl = (url: string): string => {
        try {
            let domain = url.replace(/^(https?:\/\/)?(www\.)?/, '');
            const slashIndex = domain.indexOf('/');
            if (slashIndex !== -1) {
                domain = domain.substring(0, slashIndex);
            }
            const portIndex = domain.indexOf(':');
            if (portIndex !== -1) {
                domain = domain.substring(0, portIndex);
            }
            return domain || url;
        } catch (error) {
            console.error('Error extracting domain:', error);
            return url;
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        const promises = [fetchSites()];

        // Загружаем избранные только если пользователь авторизован
        if (token) {
            promises.push(fetchFavoriteSites());
        }

        Promise.all(promises)
            .finally(() => setRefreshing(false));
    }, [fetchSites, fetchFavoriteSites, token]);

    const loadSiteFields = async (siteId: number) => {
        if (siteFields[siteId]) return;

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

    const handleCardPress = (site: Site) => {
        if (expandedCardId === site.Id) {
            setExpandedCardId(null);
        } else {
            setExpandedCardId(site.Id);
            loadSiteFields(site.Id);
        }
    };

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
        } catch (error: any) {
            Alert.alert('Ошибка', error.message || 'Не удалось добавить в избранное');
        } finally {
            setIsManagingFavorite(null);
        }
    };

    const handleRemoveFromFavorites = async (siteId: number) => {
        setIsManagingFavorite(siteId);

        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            await removeFromFavorites(siteId);
        } catch (error: any) {
            Alert.alert('Ошибка', error.message || 'Не удалось удалить из избранного');
            if (token) {
                fetchFavoriteSites();
            }
        } finally {
            setIsManagingFavorite(null);
        }
    };

    const handleFavoritePress = (siteId: number) => {
        if (isFavorite(siteId)) {
            handleRemoveFromFavorites(siteId);
        } else {
            handleAddToFavorites(siteId);
        }
    };

    const handleShowUrl = (url: string) => {
        setSelectedUrl(url);
        setShowUrlModal(true);
    };

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

    // НОВЫЙ: переключение режима "только избранные"
    const toggleShowOnlyFavorites = () => {
        setShowOnlyFavorites(prev => !prev);
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
                        {showOnlyFavorites && token
                            ? `${filteredAndSortedSites.length} избранных сайтов`
                            : `${filteredAndSortedSites.length} из ${sites.length} сайтов`
                        }
                    </Text>
                    {token && (
                        <TouchableOpacity
                            style={[
                                styles.favoritesToggle,
                                showOnlyFavorites && styles.favoritesToggleActive
                            ]}
                            onPress={toggleShowOnlyFavorites}
                        >


                            <Text style={[
                                styles.favoritesToggleText,
                                showOnlyFavorites && styles.favoritesToggleTextActive
                            ]}>
                                {showOnlyFavorites ? 'Все сайты' : 'Только избранные'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Панель поиска и сортировки */}
            <View style={styles.controls}>
                <View style={styles.searchContainer}>
                    <Feather name="search" size={20} color="#95a5a6" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={
                            showOnlyFavorites && token
                                ? "Поиск в избранном..."
                                : "Поиск по названию или URL..."
                        }
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

                <View style={styles.controlsRow}>
                    <TouchableOpacity style={styles.sortButton} onPress={handleSortChange}>
                        <Feather name="arrow-down" size={18} color="#4a6fa5" />
                        <Text style={styles.sortButtonText}>{getSortLabel()}</Text>
                        <Feather name="chevron-down" size={16} color="#4a6fa5" />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.filterButton, activeFiltersCount > 0 && styles.filterButtonActive]} onPress={openFilterModal}>
                        <Feather name="filter" size={18} color={activeFiltersCount > 0 ? '#fff' : '#4a6fa5'} />
                        <Text style={[styles.filterButtonText, activeFiltersCount > 0 && styles.filterButtonTextActive]}>Фильтры</Text>
                        {activeFiltersCount > 0 && (
                            <View style={styles.filterBadge}>
                                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
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
                        <Text style={styles.emptyTitle}>
                            {showOnlyFavorites && token
                                ? 'Нет избранных сайтов'
                                : 'Сайты не найдены'
                            }
                        </Text>
                        <Text style={styles.emptyText}>
                            {showOnlyFavorites && token
                                ? 'Добавляйте сайты в избранное, чтобы они появились здесь'
                                : searchQuery
                                    ? 'Попробуйте изменить поисковый запрос'
                                    : 'Нет доступных сайтов для отображения'
                            }
                        </Text>
                        {showOnlyFavorites && token && (
                            <TouchableOpacity
                                style={styles.browseButton}
                                onPress={toggleShowOnlyFavorites}
                            >
                                <Text style={styles.browseButtonText}>Показать все сайты</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    filteredAndSortedSites.map((site) => {
                        const favorite = token ? isFavorite(site.Id) : false;
                        const isLoading = isManagingFavorite === site.Id;
                        const domain = extractDomainFromUrl(site.Url);

                        return (
                            <TouchableOpacity
                                key={`site-${site.Id}-${favorite}-${expandedCardId === site.Id}`}
                                style={[
                                    styles.card,
                                    expandedCardId === site.Id && styles.cardExpanded,
                                    token && favorite && styles.cardFavorite
                                ]}
                                onPress={() => handleCardPress(site)}
                                activeOpacity={0.7}
                            >
                                {/* Заголовок карточки */}
                                <View style={styles.cardHeader}>
                                    <View style={styles.siteIcon}>
                                        {token && favorite ? (
                                            <AntDesign name="star" size={18} color="#f39c12" />
                                        ) : (
                                            <Feather name="globe" size={18} color="#4a6fa5" />
                                        )}
                                    </View>
                                    <View style={styles.cardHeaderContent}>
                                        <Text style={styles.siteName} numberOfLines={1}>
                                            {site.Name}
                                        </Text>
                                        <View style={styles.siteInfoRow}>
                                            <Text style={styles.siteId}>ID: {site.Id}</Text>
                                            <View style={styles.domainContainer}>
                                                <Feather name="link" size={10} color="#3498db" />
                                                <Text style={styles.domainText} numberOfLines={1}>
                                                    {domain}
                                                </Text>
                                            </View>
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
                                                favorite ? (
                                                    <AntDesign
                                                        name="star"
                                                        size={20}
                                                        color="#f39c12"
                                                    />
                                                ) : (
                                                    <Feather
                                                        name="star"
                                                        size={20}
                                                        color="#bdc3c7"
                                                    />
                                                )
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
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>

            {/* Модальное окно фильтров */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={showFilterModal}
                onRequestClose={() => setShowFilterModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.filterModalContent, { paddingBottom: Math.max(insets.bottom, 24) }]}>
                        <Text style={styles.modalTitle}>Фильтры</Text>

                        <ScrollView style={styles.filterScroll} showsVerticalScrollIndicator={false}>
                            {pendingConditions.map((condition) => (
                                <View key={condition.id} style={styles.conditionRow}>
                                    <TouchableOpacity
                                        style={styles.fieldPickerButton}
                                        onPress={() => setShowFieldPicker(showFieldPicker === condition.id ? null : condition.id)}
                                    >
                                        <Text style={[styles.fieldPickerText, !condition.fieldNameId && styles.fieldPickerPlaceholder]}>
                                            {condition.fieldNameId
                                                ? fieldNames.find(f => f.Id === condition.fieldNameId)?.Name ?? 'Параметр'
                                                : 'Выберите параметр'}
                                        </Text>
                                        <Feather name="chevron-down" size={14} color="#95a5a6" />
                                    </TouchableOpacity>

                                    {(() => {
                                        const fieldName = fieldNames.find(f => f.Id === condition.fieldNameId);
                                        const isNumeric = fieldName && NUMERIC_FIELD_NAMES.includes(fieldName.Name);
                                        const uniqueValues = condition.fieldNameId ? getUniqueValuesForField(condition.fieldNameId) : [];
                                        const hasComboValues = !isNumeric && uniqueValues.length > 0;

                                        return isNumeric ? (
                                            <View style={styles.rangeRow}>
                                                <TextInput
                                                    style={[styles.conditionValueInput, styles.rangeInput]}
                                                    placeholder="От"
                                                    value={condition.valueFrom}
                                                    onChangeText={(v) => updateConditionValueFrom(condition.id, v)}
                                                    keyboardType="numeric"
                                                />
                                                <Text style={styles.rangeSeparator}>—</Text>
                                                <TextInput
                                                    style={[styles.conditionValueInput, styles.rangeInput]}
                                                    placeholder="До"
                                                    value={condition.valueTo}
                                                    onChangeText={(v) => updateConditionValueTo(condition.id, v)}
                                                    keyboardType="numeric"
                                                />
                                            </View>
                                        ) : hasComboValues ? (
                                            <View style={styles.comboContainer}>
                                                <TextInput
                                                    style={styles.conditionValueInput}
                                                    placeholder="Значение"
                                                    value={condition.value}
                                                    onChangeText={(v) => updateConditionValue(condition.id, v)}
                                                />
                                                <View style={styles.comboChips}>
                                                    {uniqueValues.map(val => (
                                                        <TouchableOpacity
                                                            key={val}
                                                            style={[styles.comboChip, condition.value === val && styles.comboChipActive]}
                                                            onPress={() => updateConditionValue(condition.id, condition.value === val ? '' : val)}
                                                        >
                                                            <Text style={[styles.comboChipText, condition.value === val && styles.comboChipTextActive]}>
                                                                {val}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>
                                        ) : (
                                            <TextInput
                                                style={styles.conditionValueInput}
                                                placeholder="Значение"
                                                value={condition.value}
                                                onChangeText={(v) => updateConditionValue(condition.id, v)}
                                            />
                                        );
                                    })()}
                                    <TouchableOpacity style={styles.removeConditionButton} onPress={() => removeCondition(condition.id)}>
                                        <Feather name="x" size={18} color="#e74c3c" />
                                    </TouchableOpacity>

                                    {showFieldPicker === condition.id && (
                                        <View style={styles.fieldDropdown}>
                                            <FlatList
                                                data={fieldNames.filter(f =>
                                                    f.Id === condition.fieldNameId ||
                                                    !pendingConditions.some(c => c.id !== condition.id && c.fieldNameId === f.Id)
                                                )}
                                                keyExtractor={(item) => item.Id.toString()}
                                                renderItem={({ item }) => (
                                                    <TouchableOpacity
                                                        style={[styles.fieldDropdownItem, condition.fieldNameId === item.Id && styles.fieldDropdownItemActive]}
                                                        onPress={() => updateConditionField(condition.id, item.Id)}
                                                    >
                                                        <Text style={[styles.fieldDropdownText, condition.fieldNameId === item.Id && styles.fieldDropdownTextActive]}>
                                                            {item.Name}
                                                        </Text>
                                                    </TouchableOpacity>
                                                )}
                                                style={{ maxHeight: 180 }}
                                            />
                                        </View>
                                    )}
                                </View>
                            ))}

                            <TouchableOpacity style={styles.addConditionButton} onPress={addCondition}>
                                <Feather name="plus" size={18} color="#4a6fa5" />
                                <Text style={styles.addConditionText}>Добавить условие</Text>
                            </TouchableOpacity>
                        </ScrollView>

                        <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
                            <Text style={styles.applyButtonText}>Применить фильтры</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
                            <Text style={styles.resetButtonText}>Сбросить все фильтры</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Модальное окно для отображения полного URL */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={showUrlModal}
                onRequestClose={() => setShowUrlModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 24) }]}>
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
    favoritesToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    favoritesToggleActive: {
        backgroundColor: '#fff8e1',
        borderColor: '#f39c12',
    },
    favoritesToggleText: {
        fontSize: 12,
        color: '#95a5a6',
        fontWeight: '500',
        marginLeft: 4,
    },
    favoritesToggleTextActive: {
        color: '#f39c12',
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
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        marginRight: 8,
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
    browseButton: {
        backgroundColor: '#4a6fa5',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        marginTop: 16,
    },
    browseButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
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
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    filterButtonActive: {
        backgroundColor: '#4a6fa5',
        borderColor: '#4a6fa5',
    },
    filterButtonText: {
        marginLeft: 6,
        fontSize: 14,
        color: '#4a6fa5',
        fontWeight: '500',
    },
    filterButtonTextActive: {
        color: '#fff',
    },
    filterBadge: {
        marginLeft: 6,
        backgroundColor: '#fff',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterBadgeText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#4a6fa5',
    },
    filterModalContent: {
        backgroundColor: 'white',
        borderRadius: 20,
        width: '100%',
        maxWidth: 400,
        maxHeight: '85%',
        padding: 24,
    },
    filterScroll: {
        marginBottom: 16,
    },
    conditionRow: {
        marginBottom: 12,
        position: 'relative',
    },
    fieldPickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f8f9fa',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        marginBottom: 8,
    },
    fieldPickerText: {
        fontSize: 14,
        color: '#2c3e50',
    },
    fieldPickerPlaceholder: {
        color: '#95a5a6',
    },
    conditionValueInput: {
        backgroundColor: '#f8f9fa',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        fontSize: 14,
        color: '#2c3e50',
        marginBottom: 8,
    },
    rangeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    rangeInput: {
        flex: 1,
        marginBottom: 0,
    },
    rangeSeparator: {
        marginHorizontal: 8,
        fontSize: 16,
        color: '#95a5a6',
    },
    removeConditionButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        padding: 4,
    },
    fieldDropdown: {
        backgroundColor: 'white',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
    },
    fieldDropdownItem: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    fieldDropdownItemActive: {
        backgroundColor: '#e8f4fc',
    },
    fieldDropdownText: {
        fontSize: 14,
        color: '#2c3e50',
    },
    fieldDropdownTextActive: {
        color: '#4a6fa5',
        fontWeight: '600',
    },
    addConditionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0f7ff',
        borderRadius: 10,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#4a6fa5',
        borderStyle: 'dashed',
        marginTop: 4,
    },
    addConditionText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#4a6fa5',
        fontWeight: '500',
    },
    applyButton: {
        backgroundColor: '#4a6fa5',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 10,
    },
    applyButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    resetButton: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    resetButtonText: {
        color: '#e74c3c',
        fontSize: 16,
        fontWeight: '500',
    },
    comboContainer: {
        marginBottom: 8,
    },
    comboChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 4,
    },
    comboChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#f0f0f0',
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    comboChipActive: {
        backgroundColor: '#4a6fa5',
        borderColor: '#4a6fa5',
    },
    comboChipText: {
        fontSize: 13,
        color: '#2c3e50',
    },
    comboChipTextActive: {
        color: '#fff',
    },
    domainContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e8f4fc',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginLeft: 8,
        maxWidth: '50%',
    },
    domainText: {
        fontSize: 10,
        color: '#3498db',
        fontWeight: '500',
        marginLeft: 4,
        fontFamily: 'monospace',
    },
});
