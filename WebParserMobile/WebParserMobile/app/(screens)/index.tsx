import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSites } from '@/contexts/SitesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { apiService, AnalyzedField, SiteField } from '@/lib/apiService';
import { useFocusEffect, useRouter } from 'expo-router';

type SortOption = 'name-asc' | 'name-desc';

interface FilterCondition {
    id: string;
    fieldNameId: number | null;
    value: string;
    valueFrom: string;
    valueTo: string;
}

const NUMERIC_FIELD_NAMES = ['Цена', 'Год выпуска', 'Пробег', 'Мощность двигателя', 'Объём двигателя'];

export default function Index() {
    const insets = useSafeAreaInsets();
    const { token, userData } = useAuth();
    const { isDark } = useTheme();
    const s = isDark ? darkStyles : lightStyles;
    const router = useRouter();
    const { sites, loading, fetchSites, fieldNames, allParsedData, fetchFieldNames, fetchAllParsedData, isFavorite, addToFavorites, removeFromFavorites, favoriteSiteIds, deleteSite } = useSites();

    const canEdit = token && (userData?.role === 'Администратор' || userData?.role === 'Редактор');
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [fields, setFields] = useState<Record<number, SiteField[]>>({});
    const [loadingFields, setLoadingFields] = useState<Record<number, boolean>>({});
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('name-asc');
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);
    const [pendingConditions, setPendingConditions] = useState<FilterCondition[]>([]);
    const [showFieldPicker, setShowFieldPicker] = useState<string | null>(null);

    useEffect(() => {
        fetchSites();
        fetchFieldNames();
        fetchAllParsedData();
    }, [fetchSites, fetchFieldNames, fetchAllParsedData]);

    // При возврате на экран сбрасываем локальный кэш полей чтобы подтянуть свежие данные
    const isFirstFocus = useRef(true);
    useFocusEffect(useCallback(() => {
        if (isFirstFocus.current) {
            isFirstFocus.current = false;
            return;
        }
        setFields({});
        setExpandedId(null);
    }, []));

    const handleDeleteSite = (siteId: number, siteName: string) => {
        Alert.alert(
            'Удалить сайт',
            `Удалить "${siteName}"? Это действие нельзя отменить.`,
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Удалить',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteSite(siteId);
                        } catch (e: any) {
                            Alert.alert('Ошибка', e?.message || 'Не удалось удалить сайт');
                        }
                    },
                },
            ]
        );
    };

    const handleFavoritePress = async (siteId: number) => {
        if (!token) return;
        try {
            if (isFavorite(siteId)) {
                await removeFromFavorites(siteId);
            } else {
                await addToFavorites(siteId);
            }
        } catch (e) {
            console.error('Ошибка при изменении избранного:', e);
        }
    };

    const filteredAndSortedSites = useMemo(() => {
        let filtered = [...sites];

        if (showFavoritesOnly) {
            filtered = filtered.filter(site => favoriteSiteIds.includes(site.Id));
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(site =>
                site.Name.toLowerCase().includes(query) ||
                site.Url.toLowerCase().includes(query)
            );
        }

        if (filterConditions.length > 0) {
            filtered = filtered.filter(site => {
                return filterConditions.every(condition => {
                    if (!condition.fieldNameId) return true;
                    const fieldName = fieldNames.find(f => f.Id === condition.fieldNameId);
                    if (!fieldName) return true;
                    const field = allParsedData.find(
                        p => p.SiteId === site.Id && p.Field.toLowerCase() === fieldName.Name.toLowerCase()
                    );
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
            case 'name-asc': filtered.sort((a, b) => a.Name.localeCompare(b.Name)); break;
            case 'name-desc': filtered.sort((a, b) => b.Name.localeCompare(a.Name)); break;
        }

        return filtered;
    }, [sites, searchQuery, sortBy, filterConditions, allParsedData, fieldNames, showFavoritesOnly, favoriteSiteIds]);

    const activeFiltersCount = filterConditions.filter(c => c.fieldNameId !== null).length;

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        setFields({});
        try {
            await AsyncStorage.removeItem('parsedData_cache');
            await Promise.all([fetchSites(), fetchAllParsedData()]);
        } finally {
            setRefreshing(false);
        }
    }, [fetchSites, fetchAllParsedData]);

    const handleCardPress = async (siteId: number) => {
        if (expandedId === siteId) {
            setExpandedId(null);
            return;
        }
        setExpandedId(siteId);
        if (fields[siteId]) return;
        setLoadingFields(prev => ({ ...prev, [siteId]: true }));
        try {
            const data = await apiService.getSiteFields(siteId);
            setFields(prev => ({ ...prev, [siteId]: data }));
        } catch {
            setFields(prev => ({ ...prev, [siteId]: [] }));
        } finally {
            setLoadingFields(prev => ({ ...prev, [siteId]: false }));
        }
    };

    const handleSortChange = () => {
        const options: SortOption[] = ['name-asc', 'name-desc'];
        setSortBy(prev => options[(options.indexOf(prev) + 1) % options.length]);
    };

    const getSortLabel = () => {
        switch (sortBy) {
            case 'name-asc': return 'По названию (А-Я)';
            case 'name-desc': return 'По названию (Я-А)';
        }
    };

    const openFilterModal = () => {
        setPendingConditions(filterConditions.length > 0 ? [...filterConditions] : []);
        setShowFilterModal(true);
    };

    const addCondition = () => {
        setPendingConditions(prev => [...prev, { id: Date.now().toString(), fieldNameId: null, value: '', valueFrom: '', valueTo: '' }]);
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

    return (
        <SafeAreaView style={s.container}>
            <StatusBar style={isDark ? 'light' : 'dark'} />

            <View style={s.header}>
                <View>
                    <Text style={s.title}>Объявления</Text>
                    <Text style={s.subtitle}>
                        {token ? `Пользователь: ${userData?.login || 'без имени'}` : 'Войдите для полного доступа'}
                    </Text>
                </View>
                {token && (
                    <TouchableOpacity
                        style={[s.favoritesToggle, showFavoritesOnly && s.favoritesToggleActive]}
                        onPress={() => setShowFavoritesOnly(prev => !prev)}
                    >
                        <Feather name="star" size={18} color={showFavoritesOnly ? '#fff' : '#f59e0b'} />
                        <Text style={[s.favoritesToggleText, showFavoritesOnly && s.favoritesToggleTextActive]}>
                            Избранное
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            <View style={s.controls}>
                <View style={s.searchContainer}>
                    <Feather name="search" size={20} color="#95a5a6" />
                    <TextInput
                        style={s.searchInput}
                        placeholder="Поиск по названию или URL..."
                        placeholderTextColor="#95a5a6"
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

                <View style={s.controlsRow}>
                    <TouchableOpacity style={s.sortButton} onPress={handleSortChange}>
                        <Feather name="arrow-down" size={18} color="#4a6fa5" />
                        <Text style={s.sortButtonText}>{getSortLabel()}</Text>
                        <Feather name="chevron-down" size={16} color="#4a6fa5" />
                    </TouchableOpacity>

                    <TouchableOpacity style={[s.filterButton, activeFiltersCount > 0 && s.filterButtonActive]} onPress={openFilterModal}>
                        <Feather name="filter" size={18} color={activeFiltersCount > 0 ? '#fff' : '#4a6fa5'} />
                        <Text style={[s.filterButtonText, activeFiltersCount > 0 && s.filterButtonTextActive]}>Фильтры</Text>
                        {activeFiltersCount > 0 && (
                            <View style={s.filterBadge}>
                                <Text style={s.filterBadgeText}>{activeFiltersCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {loading ? (
                <View style={s.emptyState}>
                    <ActivityIndicator size="large" color="#4a6fa5" />
                    <Text style={s.emptyText}>Загрузка объявлений...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredAndSortedSites}
                    keyExtractor={item => String(item.Id)}
                    contentContainerStyle={s.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4a6fa5" />}
                    renderItem={({ item }) => {
                        const isExpanded = expandedId === item.Id;
                        const itemFields = fields[item.Id];
                        const isLoadingFields = loadingFields[item.Id];

                        return (
                            <TouchableOpacity
                                style={[s.card, isExpanded && s.cardExpanded]}
                                onPress={() => handleCardPress(item.Id)}
                                activeOpacity={0.8}
                            >
                                <View style={s.cardHeader}>
                                    <View style={s.cardTitleRow}>
                                        <Text style={s.cardTitle}>{item.Name}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            {canEdit && (
                                                <TouchableOpacity
                                                    onPress={() => router.push(`/(screens)/add-site?siteId=${item.Id}`)}
                                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                >
                                                    <Feather name="edit-2" size={16} color="#4a6fa5" />
                                                </TouchableOpacity>
                                            )}
                                            {canEdit && (
                                                <TouchableOpacity
                                                    onPress={() => handleDeleteSite(item.Id, item.Name)}
                                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                >
                                                    <Feather name="trash-2" size={16} color="#e74c3c" />
                                                </TouchableOpacity>
                                            )}
                                            {token && (
                                                <TouchableOpacity
                                                    onPress={() => handleFavoritePress(item.Id)}
                                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                >
                                                    <Feather
                                                        name="star"
                                                        size={18}
                                                        color={isFavorite(item.Id) ? '#f59e0b' : '#8aa0b8'}
                                                    />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                    <View style={s.cardUrlRow}>
                                        <Feather name="link" size={12} color="#4a6fa5" />
                                        <Text style={s.cardUrl} numberOfLines={1}>{item.Url}</Text>
                                        <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#8aa0b8" />
                                    </View>
                                </View>

                                {isExpanded && (
                                    <View style={s.expandedContent}>
                                        {isLoadingFields ? (
                                            <ActivityIndicator size="small" color="#4a6fa5" />
                                        ) : itemFields && itemFields.length > 0 ? (
                                            itemFields.map((f, index) => (
                                                <View key={index} style={s.fieldRow}>
                                                    <Text style={s.fieldName}>{f.Field}</Text>
                                                    <Text style={s.fieldValue}>{f.Data}</Text>
                                                </View>
                                            ))
                                        ) : (
                                            <Text style={s.noFields}>Нет параметров</Text>
                                        )}
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    }}
                    ListEmptyComponent={(
                        <View style={s.emptyState}>
                            <Feather name="file-text" size={36} color="#8aa0b8" />
                            <Text style={s.emptyTitle}>Объявлений пока нет</Text>
                            <Text style={s.emptyText}>Создайте первое объявление через вкладку добавления</Text>
                        </View>
                    )}
                />
            )}

            <Modal animationType="slide" transparent visible={showFilterModal} onRequestClose={() => setShowFilterModal(false)}>
                <View style={s.modalOverlay}>
                    <View style={[s.filterModalContent, { paddingBottom: Math.max(insets.bottom, 24) }]}>
                        <Text style={s.modalTitle}>Фильтры</Text>

                        <ScrollView style={s.filterScroll} showsVerticalScrollIndicator={false}>
                            {pendingConditions.map((condition) => (
                                <View key={condition.id} style={s.conditionRow}>
                                    <TouchableOpacity
                                        style={s.fieldPickerButton}
                                        onPress={() => setShowFieldPicker(showFieldPicker === condition.id ? null : condition.id)}
                                    >
                                        <Text style={[s.fieldPickerText, !condition.fieldNameId && s.fieldPickerPlaceholder]}>
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
                                            <View style={s.rangeRow}>
                                                <TextInput
                                                    style={[s.conditionValueInput, s.rangeInput]}
                                                    placeholder="От"
                                                    placeholderTextColor={isDark ? '#6b7280' : '#95a5a6'}
                                                    value={condition.valueFrom}
                                                    onChangeText={(v) => updateConditionValueFrom(condition.id, v)}
                                                    keyboardType="numeric"
                                                />
                                                <Text style={s.rangeSeparator}>—</Text>
                                                <TextInput
                                                    style={[s.conditionValueInput, s.rangeInput]}
                                                    placeholder="До"
                                                    placeholderTextColor={isDark ? '#6b7280' : '#95a5a6'}
                                                    value={condition.valueTo}
                                                    onChangeText={(v) => updateConditionValueTo(condition.id, v)}
                                                    keyboardType="numeric"
                                                />
                                            </View>
                                        ) : hasComboValues ? (
                                            <View style={s.comboContainer}>
                                                <TextInput
                                                    style={s.conditionValueInput}
                                                    placeholder="Значение"
                                                    placeholderTextColor={isDark ? '#6b7280' : '#95a5a6'}
                                                    value={condition.value}
                                                    onChangeText={(v) => updateConditionValue(condition.id, v)}
                                                />
                                                <View style={s.comboChips}>
                                                    {uniqueValues.map(val => (
                                                        <TouchableOpacity
                                                            key={val}
                                                            style={[s.comboChip, condition.value === val && s.comboChipActive]}
                                                            onPress={() => updateConditionValue(condition.id, condition.value === val ? '' : val)}
                                                        >
                                                            <Text style={[s.comboChipText, condition.value === val && s.comboChipTextActive]}>
                                                                {val}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>
                                        ) : (
                                            <TextInput
                                                style={s.conditionValueInput}
                                                placeholder="Значение"
                                                placeholderTextColor={isDark ? '#6b7280' : '#95a5a6'}
                                                value={condition.value}
                                                onChangeText={(v) => updateConditionValue(condition.id, v)}
                                            />
                                        );
                                    })()}

                                    <TouchableOpacity style={s.removeConditionButton} onPress={() => removeCondition(condition.id)}>
                                        <Feather name="x" size={18} color="#e74c3c" />
                                    </TouchableOpacity>

                                    {showFieldPicker === condition.id && (
                                        <View style={s.fieldDropdown}>
                                            <FlatList
                                                data={fieldNames.filter(f =>
                                                    f.Id === condition.fieldNameId ||
                                                    !pendingConditions.some(c => c.id !== condition.id && c.fieldNameId === f.Id)
                                                )}
                                                keyExtractor={(item) => item.Id.toString()}
                                                renderItem={({ item }) => (
                                                    <TouchableOpacity
                                                        style={[s.fieldDropdownItem, condition.fieldNameId === item.Id && s.fieldDropdownItemActive]}
                                                        onPress={() => updateConditionField(condition.id, item.Id)}
                                                    >
                                                        <Text style={[s.fieldDropdownText, condition.fieldNameId === item.Id && s.fieldDropdownTextActive]}>
                                                            {item.Name}
                                                        </Text>
                                                    </TouchableOpacity>
                                                )}
                                                scrollEnabled={false}
                                            />
                                        </View>
                                    )}
                                </View>
                            ))}

                            <TouchableOpacity style={s.addConditionButton} onPress={addCondition}>
                                <Feather name="plus" size={18} color="#4a6fa5" />
                                <Text style={s.addConditionText}>Добавить условие</Text>
                            </TouchableOpacity>
                        </ScrollView>

                        <TouchableOpacity style={s.applyButton} onPress={applyFilters}>
                            <Text style={s.applyButtonText}>Применить фильтры</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={s.resetButton} onPress={resetFilters}>
                            <Text style={s.resetButtonText}>Сбросить все фильтры</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const lightStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    title: { fontSize: 24, fontWeight: '700', color: '#1f2d3d' },
    subtitle: { color: '#6c7a89', marginTop: 4 },
    favoritesToggle: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
        borderWidth: 1, borderColor: '#f59e0b',
    },
    favoritesToggleActive: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
    favoritesToggleText: { marginLeft: 6, fontSize: 13, color: '#f59e0b', fontWeight: '600' },
    favoritesToggleTextActive: { color: '#fff' },
    controls: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
    searchContainer: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
        borderWidth: 1, borderColor: '#e0e0e0',
    },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: '#2c3e50', padding: 0 },
    controlsRow: { flexDirection: 'row', alignItems: 'center' },
    sortButton: {
        flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
        borderWidth: 1, borderColor: '#e0e0e0', marginRight: 8,
    },
    sortButtonText: { flex: 1, marginLeft: 8, fontSize: 13, color: '#4a6fa5', fontWeight: '500' },
    filterButton: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
        borderWidth: 1, borderColor: '#e0e0e0',
    },
    filterButtonActive: { backgroundColor: '#4a6fa5', borderColor: '#4a6fa5' },
    filterButtonText: { marginLeft: 6, fontSize: 13, color: '#4a6fa5', fontWeight: '500' },
    filterButtonTextActive: { color: '#fff' },
    filterBadge: { marginLeft: 6, backgroundColor: '#fff', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
    filterBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#4a6fa5' },
    list: { padding: 16, gap: 12 },
    card: { backgroundColor: 'white', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#e8eef5' },
    cardExpanded: { borderColor: '#4a6fa5' },
    cardHeader: { gap: 6 },
    cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardTitle: { fontSize: 16, fontWeight: '700', color: '#1f2d3d', flex: 1, marginRight: 8 },
    cardId: { color: '#8aa0b8', fontSize: 12 },
    cardUrlRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    cardUrl: { flex: 1, color: '#4a6fa5', fontSize: 12 },
    expandedContent: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#eef3f8', paddingTop: 12, gap: 8 },
    fieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    fieldName: { color: '#6c7a89', fontSize: 13, flex: 1 },
    fieldValue: { color: '#1f2d3d', fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
    noFields: { color: '#8aa0b8', textAlign: 'center', fontSize: 13 },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1f2d3d' },
    emptyText: { color: '#6c7a89', textAlign: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    filterModalContent: { backgroundColor: 'white', borderRadius: 20, width: '100%', maxWidth: 400, maxHeight: '85%', padding: 24 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50', marginBottom: 16, textAlign: 'center' },
    filterScroll: { marginBottom: 16 },
    conditionRow: { marginBottom: 12, position: 'relative' },
    fieldPickerButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#f8f9fa', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
        borderWidth: 1, borderColor: '#e0e0e0', marginBottom: 8,
    },
    fieldPickerText: { fontSize: 14, color: '#2c3e50' },
    fieldPickerPlaceholder: { color: '#95a5a6' },
    conditionValueInput: {
        backgroundColor: '#f8f9fa', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
        borderWidth: 1, borderColor: '#e0e0e0', fontSize: 14, color: '#2c3e50', marginBottom: 8,
    },
    rangeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    rangeInput: { flex: 1, marginBottom: 0 },
    rangeSeparator: { marginHorizontal: 8, fontSize: 16, color: '#95a5a6' },
    removeConditionButton: { position: 'absolute', top: 8, right: 8, padding: 4 },
    fieldDropdown: {
        backgroundColor: 'white', borderRadius: 10, borderWidth: 1, borderColor: '#e0e0e0',
        marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
    },
    fieldDropdownItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    fieldDropdownItemActive: { backgroundColor: '#e8f4fc' },
    fieldDropdownText: { fontSize: 14, color: '#2c3e50' },
    fieldDropdownTextActive: { color: '#4a6fa5', fontWeight: '600' },
    addConditionButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#f0f7ff', borderRadius: 10, paddingVertical: 12,
        borderWidth: 1, borderColor: '#4a6fa5', borderStyle: 'dashed', marginTop: 4,
    },
    addConditionText: { marginLeft: 8, fontSize: 14, color: '#4a6fa5', fontWeight: '500' },
    applyButton: { backgroundColor: '#4a6fa5', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 },
    applyButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
    resetButton: { backgroundColor: '#f8f9fa', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e0e0e0' },
    resetButtonText: { color: '#e74c3c', fontSize: 16, fontWeight: '500' },
    comboContainer: { marginBottom: 8 },
    comboChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
    comboChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#e0e0e0' },
    comboChipActive: { backgroundColor: '#4a6fa5', borderColor: '#4a6fa5' },
    comboChipText: { fontSize: 13, color: '#2c3e50' },
    comboChipTextActive: { color: '#fff' },
});

const darkStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f0f0f' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    title: { fontSize: 24, fontWeight: '700', color: '#f1f5f9' },
    subtitle: { color: '#9ca3af', marginTop: 4 },
    favoritesToggle: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a',
        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
        borderWidth: 1, borderColor: '#f59e0b',
    },
    favoritesToggleActive: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
    favoritesToggleText: { marginLeft: 6, fontSize: 13, color: '#f59e0b', fontWeight: '600' },
    favoritesToggleTextActive: { color: '#fff' },
    controls: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
    searchContainer: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a',
        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
        borderWidth: 1, borderColor: '#2d2d2d',
    },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: '#e2e8f0', padding: 0 },
    controlsRow: { flexDirection: 'row', alignItems: 'center' },
    sortButton: {
        flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a',
        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
        borderWidth: 1, borderColor: '#2d2d2d', marginRight: 8,
    },
    sortButtonText: { flex: 1, marginLeft: 8, fontSize: 13, color: '#60a5fa', fontWeight: '500' },
    filterButton: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a',
        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
        borderWidth: 1, borderColor: '#2d2d2d',
    },
    filterButtonActive: { backgroundColor: '#4a6fa5', borderColor: '#4a6fa5' },
    filterButtonText: { marginLeft: 6, fontSize: 13, color: '#60a5fa', fontWeight: '500' },
    filterButtonTextActive: { color: '#fff' },
    filterBadge: { marginLeft: 6, backgroundColor: '#fff', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
    filterBadgeText: { fontSize: 11, fontWeight: 'bold', color: '#4a6fa5' },
    list: { padding: 16, gap: 12 },
    card: { backgroundColor: '#1a1a1a', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#2d2d2d' },
    cardExpanded: { borderColor: '#4a6fa5' },
    cardHeader: { gap: 6 },
    cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardTitle: { fontSize: 16, fontWeight: '700', color: '#f1f5f9', flex: 1, marginRight: 8 },
    cardId: { color: '#6b7280', fontSize: 12 },
    cardUrlRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    cardUrl: { flex: 1, color: '#60a5fa', fontSize: 12 },
    expandedContent: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#2d2d2d', paddingTop: 12, gap: 8 },
    fieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    fieldName: { color: '#9ca3af', fontSize: 13, flex: 1 },
    fieldValue: { color: '#e2e8f0', fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
    noFields: { color: '#6b7280', textAlign: 'center', fontSize: 13 },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#f1f5f9' },
    emptyText: { color: '#9ca3af', textAlign: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    filterModalContent: { backgroundColor: '#1a1a1a', borderRadius: 20, width: '100%', maxWidth: 400, maxHeight: '85%', padding: 24 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#f1f5f9', marginBottom: 16, textAlign: 'center' },
    filterScroll: { marginBottom: 16 },
    conditionRow: { marginBottom: 12, position: 'relative' },
    fieldPickerButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#2d2d2d', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
        borderWidth: 1, borderColor: '#3d3d3d', marginBottom: 8,
    },
    fieldPickerText: { fontSize: 14, color: '#e2e8f0' },
    fieldPickerPlaceholder: { color: '#6b7280' },
    conditionValueInput: {
        backgroundColor: '#2d2d2d', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
        borderWidth: 1, borderColor: '#3d3d3d', fontSize: 14, color: '#e2e8f0', marginBottom: 8,
    },
    rangeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    rangeInput: { flex: 1, marginBottom: 0 },
    rangeSeparator: { marginHorizontal: 8, fontSize: 16, color: '#6b7280' },
    removeConditionButton: { position: 'absolute', top: 8, right: 8, padding: 4 },
    fieldDropdown: {
        backgroundColor: '#1a1a1a', borderRadius: 10, borderWidth: 1, borderColor: '#2d2d2d',
        marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
    },
    fieldDropdownItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2d2d2d' },
    fieldDropdownItemActive: { backgroundColor: '#1e3a5f' },
    fieldDropdownText: { fontSize: 14, color: '#e2e8f0' },
    fieldDropdownTextActive: { color: '#60a5fa', fontWeight: '600' },
    addConditionButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#1e3a5f', borderRadius: 10, paddingVertical: 12,
        borderWidth: 1, borderColor: '#4a6fa5', borderStyle: 'dashed', marginTop: 4,
    },
    addConditionText: { marginLeft: 8, fontSize: 14, color: '#60a5fa', fontWeight: '500' },
    applyButton: { backgroundColor: '#4a6fa5', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 },
    applyButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
    resetButton: { backgroundColor: '#2d2d2d', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#3d3d3d' },
    resetButtonText: { color: '#f87171', fontSize: 16, fontWeight: '500' },
    comboContainer: { marginBottom: 8 },
    comboChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
    comboChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#2d2d2d', borderWidth: 1, borderColor: '#3d3d3d' },
    comboChipActive: { backgroundColor: '#4a6fa5', borderColor: '#4a6fa5' },
    comboChipText: { fontSize: 13, color: '#e2e8f0' },
    comboChipTextActive: { color: '#fff' },
});
