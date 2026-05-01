import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { useSites } from '@/contexts/SitesContext';
import { useAuth } from '@/contexts/AuthContext';
import { apiService, AnalyzedField, SiteField } from '@/lib/apiService';

type SortOption = 'name-asc' | 'name-desc' | 'id-asc' | 'id-desc';

interface FilterCondition {
    id: string;
    fieldNameId: number | null;
    value: string;
    valueFrom: string;
    valueTo: string;
}

const NUMERIC_FIELD_NAMES = ['Цена', 'Год выпуска', 'Пробег', 'Мощность двигателя', 'Объём двигателя'];

export default function Index() {
    const { token, userData } = useAuth();
    const { sites, loading, fetchSites, fieldNames, allParsedData, fetchFieldNames, fetchAllParsedData } = useSites();
    const [expandedId, setExpandedId] = useState<number | null>(null);
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

    const filteredAndSortedSites = useMemo(() => {
        let filtered = [...sites];

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(site =>
                site.Name.toLowerCase().includes(query) ||
                site.Url.toLowerCase().includes(query)
            );
        }

        if (filterConditions.length > 0) {
            filtered = filtered.filter(site => {
                const siteFieldData = fields[site.Id];
                if (!siteFieldData) return false;
                return filterConditions.every(condition => {
                    if (!condition.fieldNameId) return true;
                    const fieldName = fieldNames.find(f => f.Id === condition.fieldNameId);
                    if (!fieldName) return true;
                    const field = siteFieldData.find(f => f.Field.toLowerCase() === fieldName.Name.toLowerCase());
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
            case 'id-asc': filtered.sort((a, b) => a.Id - b.Id); break;
            case 'id-desc': filtered.sort((a, b) => b.Id - a.Id); break;
        }

        return filtered;
    }, [sites, searchQuery, sortBy, filterConditions, fields, fieldNames]);

    const activeFiltersCount = filterConditions.filter(c => c.fieldNameId !== null).length;

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchSites().finally(() => setRefreshing(false));
    }, [fetchSites]);

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
        const options: SortOption[] = ['name-asc', 'name-desc', 'id-asc', 'id-desc'];
        setSortBy(prev => options[(options.indexOf(prev) + 1) % options.length]);
    };

    const getSortLabel = () => {
        switch (sortBy) {
            case 'name-asc': return 'По названию (А-Я)';
            case 'name-desc': return 'По названию (Я-А)';
            case 'id-asc': return 'По ID (↑)';
            case 'id-desc': return 'По ID (↓)';
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
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Объявления</Text>
                    <Text style={styles.subtitle}>
                        {token ? `Пользователь: ${userData?.login || 'без имени'}` : 'Войдите для полного доступа'}
                    </Text>
                </View>
            </View>

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

            {loading ? (
                <View style={styles.emptyState}>
                    <ActivityIndicator size="large" color="#4a6fa5" />
                    <Text style={styles.emptyText}>Загрузка объявлений...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredAndSortedSites}
                    keyExtractor={item => String(item.Id)}
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4a6fa5" />}
                    renderItem={({ item }) => {
                        const isExpanded = expandedId === item.Id;
                        const itemFields = fields[item.Id];
                        const isLoadingFields = loadingFields[item.Id];

                        return (
                            <TouchableOpacity
                                style={[styles.card, isExpanded && styles.cardExpanded]}
                                onPress={() => handleCardPress(item.Id)}
                                activeOpacity={0.8}
                            >
                                <View style={styles.cardHeader}>
                                    <View style={styles.cardTitleRow}>
                                        <Text style={styles.cardTitle}>{item.Name}</Text>
                                        <Text style={styles.cardId}>#{item.Id}</Text>
                                    </View>
                                    <View style={styles.cardUrlRow}>
                                        <Feather name="link" size={12} color="#4a6fa5" />
                                        <Text style={styles.cardUrl} numberOfLines={1}>{item.Url}</Text>
                                        <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#8aa0b8" />
                                    </View>
                                </View>

                                {isExpanded && (
                                    <View style={styles.expandedContent}>
                                        {isLoadingFields ? (
                                            <ActivityIndicator size="small" color="#4a6fa5" />
                                        ) : itemFields && itemFields.length > 0 ? (
                                            itemFields.map((f, index) => (
                                                <View key={index} style={styles.fieldRow}>
                                                    <Text style={styles.fieldName}>{f.Field}</Text>
                                                    <Text style={styles.fieldValue}>{f.Data}</Text>
                                                </View>
                                            ))
                                        ) : (
                                            <Text style={styles.noFields}>Нет параметров</Text>
                                        )}
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    }}
                    ListEmptyComponent={(
                        <View style={styles.emptyState}>
                            <Feather name="file-text" size={36} color="#8aa0b8" />
                            <Text style={styles.emptyTitle}>Объявлений пока нет</Text>
                            <Text style={styles.emptyText}>Создайте первое объявление через вкладку добавления</Text>
                        </View>
                    )}
                />
            )}

            <Modal animationType="slide" transparent visible={showFilterModal} onRequestClose={() => setShowFilterModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.filterModalContent}>
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
                                                scrollEnabled={false}
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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    title: { fontSize: 24, fontWeight: '700', color: '#1f2d3d' },
    subtitle: { color: '#6c7a89', marginTop: 4 },
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
