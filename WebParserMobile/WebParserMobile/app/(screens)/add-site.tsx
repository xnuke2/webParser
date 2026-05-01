import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    Platform,
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
import { WebView } from 'react-native-webview';
import { useAuth } from '@/contexts/AuthContext';
import { useSites } from '@/contexts/SitesContext';
import { apiService, SiteField } from '@/lib/apiService';

type TagField = {
    id: number;
    name: string;
    values: string[];
    valueText: string;
};

export default function AddSiteScreen() {
    const { userData } = useAuth();
    const { fieldNames, allParsedData } = useSites();
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [previewUrl, setPreviewUrl] = useState('');
    const [fields, setFields] = useState<TagField[]>([]);
    const [activeFieldId, setActiveFieldId] = useState<number | null>(null);
    const [fieldPickerVisible, setFieldPickerVisible] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedFieldName, setSelectedFieldName] = useState('');

    useEffect(() => {
        if (!selectedFieldName && fieldNames.length > 0) {
            setSelectedFieldName(fieldNames[0].Name);
        }
    }, [fieldNames, selectedFieldName]);

    useEffect(() => {
        if (!fields.length && selectedFieldName) {
            createField(selectedFieldName);
        }
    }, [fields.length, selectedFieldName]);

    const selectedField = useMemo(
        () => fields.find(field => field.id === activeFieldId) ?? null,
        [fields, activeFieldId]
    );

    const selectedFieldValues = useMemo(() => {
        if (!selectedField?.name) return [];
        const matches = allParsedData
            .filter(item => item.Field.toLowerCase() === selectedField.name.toLowerCase())
            .map(item => item.Data.trim())
            .filter(Boolean);
        return [...new Set(matches)];
    }, [allParsedData, selectedField]);

    const createField = (fieldName: string) => {
        setFields(prev => {
            if (prev.some(field => field.name === fieldName)) return prev;
            const nextId = Date.now() + Math.floor(Math.random() * 1000);
            return [...prev, { id: nextId, name: fieldName, values: [], valueText: '' }];
        });
    };

    const updateFieldValueText = (fieldId: number, valueText: string) => {
        setFields(prev => prev.map(field => field.id === fieldId ? { ...field, valueText } : field));
    };

    const addValueToField = (fieldId: number, value: string) => {
        setFields(prev => prev.map(field => {
            if (field.id !== fieldId) return field;
            if (field.values.includes(value)) return field;
            return { ...field, values: [...field.values, value], valueText: '' };
        }));
    };

    const removeValue = (fieldId: number, value: string) => {
        setFields(prev => prev.map(field => field.id === fieldId ? { ...field, values: field.values.filter(v => v !== value) } : field));
    };

    const saveSite = async () => {
        if (!name.trim() || !url.trim()) {
            Alert.alert('Заполните поля', 'Имя и URL обязательны');
            return;
        }

        setSaving(true);
        try {
            const created = await apiService.createAnalyzedSite({ Name: name.trim(), Url: url.trim() });
            const siteId = created?.Id ?? created?.id;

            if (siteId) {
                for (const field of fields) {
                    const valueToGet = field.values.join(', ');
                    if (!valueToGet.trim()) continue;
                    await apiService.createAnalyzedField({
                        Name: field.name,
                        FieldToGet: valueToGet,
                        AnalyzedSiteId: siteId,
                    });
                }
            }

            setName('');
            setUrl('');
            setPreviewUrl('');
            setFields([]);
            Alert.alert('Готово', 'Сайт и связанные поля добавлены');
        } catch (error: any) {
            Alert.alert('Ошибка', error?.message || 'Не удалось сохранить сайт');
        } finally {
            setSaving(false);
        }
    };

    const addFieldFromPicker = (fieldName: string) => {
        createField(fieldName);
        setSelectedFieldName(fieldName);
        setFieldPickerVisible(false);
    };

    const normalizedPreviewUrl = previewUrl.trim();
    const previewSource = normalizedPreviewUrl
        ? { uri: normalizedPreviewUrl.match(/^https?:\/\//i) ? normalizedPreviewUrl : `https://${normalizedPreviewUrl}` }
        : null;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Добавление сайта</Text>
                    <Text style={styles.subtitle}>{userData?.role ? `Роль: ${userData.role}` : 'Заполните форму'}</Text>
                </View>
                <Feather name="plus-circle" size={28} color="#4a6fa5" />
            </View>

            <View style={styles.content}>
                <View style={styles.formPane}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <Text style={styles.sectionLabel}>Основные данные</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Название"
                            value={name}
                            onChangeText={setName}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="URL"
                            value={url}
                            onChangeText={(text) => {
                                setUrl(text);
                                setPreviewUrl(text);
                            }}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                            textContentType="URL"
                            autoComplete="url"
                        />

                        <View style={styles.sectionRow}>
                            <Text style={styles.sectionLabel}>Параметры</Text>
                            <TouchableOpacity style={styles.smallButton} onPress={() => setFieldPickerVisible(true)}>
                                <Feather name="plus" size={14} color="white" />
                                <Text style={styles.smallButtonText}>Поле</Text>
                            </TouchableOpacity>
                        </View>

                        {fields.map(field => (
                            <View key={field.id} style={styles.fieldCard}>
                                <View style={styles.fieldHeader}>
                                    <TouchableOpacity style={styles.fieldNameButton} onPress={() => setActiveFieldId(field.id)}>
                                        <Text style={styles.fieldName}>{field.name}</Text>
                                        <Feather name="chevron-down" size={16} color="#4a6fa5" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => setFields(prev => prev.filter(item => item.id !== field.id))}>
                                        <Feather name="trash-2" size={16} color="#e74c3c" />
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.tagRow}>
                                    {field.values.map(value => (
                                        <TouchableOpacity key={value} style={styles.tag} onPress={() => removeValue(field.id, value)}>
                                            <Text style={styles.tagText}>{value}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <TextInput
                                    style={styles.input}
                                    placeholder="Добавить значение"
                                    value={field.valueText}
                                    onChangeText={text => updateFieldValueText(field.id, text)}
                                    onSubmitEditing={() => {
                                        if (field.valueText.trim()) addValueToField(field.id, field.valueText.trim());
                                    }}
                                />
                                <TouchableOpacity
                                    style={styles.valueButton}
                                    onPress={() => field.valueText.trim() && addValueToField(field.id, field.valueText.trim())}
                                >
                                    <Text style={styles.valueButtonText}>Добавить значение</Text>
                                </TouchableOpacity>
                            </View>
                        ))}

                        <TouchableOpacity style={styles.primaryButton} onPress={saveSite} disabled={saving}>
                            <Text style={styles.primaryButtonText}>{saving ? 'Сохранение...' : 'Добавить сайт'}</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>

                <View style={styles.previewPane}>
                    <Text style={styles.sectionLabel}>Предпросмотр сайта</Text>
                    <View style={styles.previewCard}>
                        {previewSource ? (
                            <WebView
                                key={previewUrl}
                                source={previewSource}
                                style={styles.webView}
                                startInLoadingState
                                onError={() => {}}
                            />
                        ) : (
                            <View style={styles.previewEmptyBox}>
                                <Feather name="globe" size={36} color="#8aa0b8" />
                                <Text style={styles.previewEmpty}>Введите URL для предпросмотра</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.suggestionsCard}>
                        <Text style={styles.sectionLabel}>Доступные значения</Text>
                        <Text style={styles.helperText}>Выберите поле и нажимайте на значение, чтобы добавить тег</Text>
                        {!selectedField ? (
                            <Text style={styles.previewEmpty}>Сначала добавьте поле через кнопку «Поле»</Text>
                        ) : selectedFieldValues.length === 0 ? (
                            <Text style={styles.previewEmpty}>Нет сохранённых значений</Text>
                        ) : (
                            selectedFieldValues.map(item => (
                                <TouchableOpacity key={item} style={styles.suggestionItem} onPress={() => addValueToField(selectedField.id, item)}>
                                    <Text style={styles.suggestionText}>{item}</Text>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                </View>
            </View>

            <Modal visible={fieldPickerVisible} transparent animationType="fade" onRequestClose={() => setFieldPickerVisible(false)}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Выберите параметр</Text>
                        <FlatList
                            data={fieldNames}
                            keyExtractor={item => String(item.Id)}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.modalItem}
                                    onPress={() => addFieldFromPicker(item.Name)}
                                >
                                    <Text style={styles.modalItemText}>{item.Name}</Text>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={<Text style={styles.previewEmpty}>Параметры не загружены</Text>}
                        />
                        <TouchableOpacity style={styles.modalClose} onPress={() => setFieldPickerVisible(false)}>
                            <Text style={styles.modalCloseText}>Закрыть</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={!!activeFieldId} transparent animationType="fade" onRequestClose={() => setActiveFieldId(null)}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Выберите поле для редактирования</Text>
                        <FlatList
                            data={fieldNames}
                            keyExtractor={item => String(item.Id)}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.modalItem}
                                    onPress={() => {
                                        if (activeFieldId) {
                                            setFields(prev => prev.map(field => field.id === activeFieldId ? { ...field, name: item.Name } : field));
                                        }
                                        setActiveFieldId(null);
                                    }}
                                >
                                    <Text style={styles.modalItemText}>{item.Name}</Text>
                                </TouchableOpacity>
                            )}
                        />
                        <TouchableOpacity style={styles.modalClose} onPress={() => setActiveFieldId(null)}>
                            <Text style={styles.modalCloseText}>Закрыть</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    header: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 24, fontWeight: '700', color: '#1f2d3d' },
    subtitle: { color: '#6c7a89', marginTop: 4 },
    content: { flex: 1, flexDirection: Platform.OS === 'web' ? 'row' : 'column' },
    formPane: { flex: 1, padding: 16 },
    previewPane: { flex: 1, padding: 16 },
    sectionLabel: { fontSize: 16, fontWeight: '700', color: '#1f2d3d', marginBottom: 12 },
    helperText: { color: '#6c7a89', marginBottom: 12 },
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    input: { backgroundColor: 'white', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#dfe6ee', marginBottom: 12 },
    smallButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#4a6fa5', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
    smallButtonText: { color: 'white', fontWeight: '600' },
    fieldCard: { backgroundColor: 'white', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e8eef5' },
    fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    fieldNameButton: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    fieldName: { fontWeight: '700', color: '#1f2d3d' },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
    tag: { backgroundColor: '#e8f0fe', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
    tagText: { color: '#355c9a' },
    valueButton: { backgroundColor: '#eef3f8', padding: 12, borderRadius: 12, alignItems: 'center' },
    valueButtonText: { color: '#355c9a', fontWeight: '600' },
    primaryButton: { backgroundColor: '#4a6fa5', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
    primaryButtonText: { color: 'white', fontWeight: '700' },
    previewCard: { backgroundColor: 'white', borderRadius: 18, padding: 8, borderWidth: 1, borderColor: '#e8eef5', minHeight: 260, overflow: 'hidden' },
    webView: { flex: 1, minHeight: 260 },
    previewEmptyBox: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 8 },
    previewEmpty: { color: '#7f8c8d', textAlign: 'center' },
    suggestionsCard: { marginTop: 16, backgroundColor: 'white', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#e8eef5', flex: 1 },
    suggestionItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eef3f8' },
    suggestionText: { color: '#1f2d3d' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 16 },
    modalCard: { backgroundColor: 'white', borderRadius: 18, padding: 16, maxHeight: '80%' },
    modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
    modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eef3f8' },
    modalItemText: { color: '#1f2d3d' },
    modalClose: { alignItems: 'center', paddingVertical: 14 },
    modalCloseText: { color: '#4a6fa5', fontWeight: '700' },
});
