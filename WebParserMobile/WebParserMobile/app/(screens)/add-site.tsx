import React, { useRef, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useSites } from '@/contexts/SitesContext';
import { apiService } from '@/lib/apiService';
import { useTheme } from '@/contexts/ThemeContext';

type TagField = {
    id: number;
    name: string;
    fieldNameId: number;
    selector: string;
};

// JS инжектируется в WebView — подсвечивает элементы при наведении и отправляет селектор при клике
const INJECTED_JS = `
(function() {
    if (window.__selectorInjected) return;
    window.__selectorInjected = true;

    // Убираем попапы и оверлеи
    function removeOverlays() {
        var all = document.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            var el = all[i];
            var style = window.getComputedStyle(el);
            var zIndex = parseInt(style.zIndex) || 0;
            var pos = style.position;
            if ((pos === 'fixed' || pos === 'absolute') && zIndex > 10) {
                var rect = el.getBoundingClientRect();
                var area = rect.width * rect.height;
                // Убираем только большие оверлеи (больше 30% экрана)
                if (area > window.innerWidth * window.innerHeight * 0.3) {
                    el.style.display = 'none';
                }
            }
        }
        // Восстанавливаем скролл body
        document.body.style.overflow = 'auto';
        document.documentElement.style.overflow = 'auto';
    }

    // Запускаем сразу и через паузу (после загрузки попапов)
    removeOverlays();
    setTimeout(removeOverlays, 1500);
    setTimeout(removeOverlays, 3000);

    var highlighted = null;

    function getSelector(el) {
        if (!el || el === document.body) return 'body';

        // Ищем ближайший элемент (сам или родитель) с уникальным селектором
        var current = el;
        while (current && current !== document.body) {
            // 1. id
            if (current.id) return '#' + current.id;

            var tag = current.tagName.toLowerCase();
            if (current.classList && current.classList.length > 0) {
                var classes = Array.from(current.classList)
                    .filter(function(c) { return /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(c); });

                // 2. Уникальный одиночный класс
                for (var i = 0; i < classes.length; i++) {
                    var c1 = '.' + classes[i];
                    if (document.querySelectorAll(c1).length === 1) return c1;
                    var c2 = tag + '.' + classes[i];
                    if (document.querySelectorAll(c2).length === 1) return c2;
                }

                // 3. Уникальная комбинация двух классов
                for (var i = 0; i < classes.length - 1; i++) {
                    var combo = tag + '.' + classes[i] + '.' + classes[i+1];
                    if (document.querySelectorAll(combo).length === 1) return combo;
                }
            }
            current = current.parentElement;
        }

        // Fallback — берём первый класс самого элемента или путь из 2 уровней
        var tag = el.tagName.toLowerCase();
        if (el.classList && el.classList.length > 0) {
            var classes = Array.from(el.classList)
                .filter(function(c) { return /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(c); });
            if (classes.length > 0) return tag + '.' + classes[0];
        }
        var parent = el.parentElement;
        if (parent && parent !== document.body && parent.classList && parent.classList.length > 0) {
            var pclasses = Array.from(parent.classList)
                .filter(function(c) { return /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(c); });
            if (pclasses.length > 0) return parent.tagName.toLowerCase() + '.' + pclasses[0] + ' > ' + tag;
        }
        return tag;
    }

    function getText(el) {
        return (el.innerText || el.textContent || '').trim().substring(0, 80);
    }

    document.addEventListener('mouseover', function(e) {
        if (highlighted) {
            highlighted.style.outline = '';
            highlighted.style.cursor = '';
        }
        highlighted = e.target;
        highlighted.style.outline = '2px solid #4a6fa5';
        highlighted.style.cursor = 'pointer';
    }, true);

    document.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var selector = getSelector(e.target);
        var text = getText(e.target);
        window.ReactNativeWebView.postMessage(JSON.stringify({ selector: selector, text: text }));
    }, true);
})();
true;
`;

export default function AddSiteScreen() {
    const insets = useSafeAreaInsets();
    const { isDark } = useTheme();
    const s = isDark ? darkStyles : lightStyles;
    const { fieldNames } = useSites();
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [urlInput, setUrlInput] = useState('');
    const [webViewUrl, setWebViewUrl] = useState('');
    const [fields, setFields] = useState<TagField[]>([]);
    const [activeFieldId, setActiveFieldId] = useState<number | null>(null);
    const [fieldPickerVisible, setFieldPickerVisible] = useState(false);
    const [previewVisible, setPreviewVisible] = useState(false);
    const [webViewLoading, setWebViewLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const webViewRef = useRef<any>(null);

    const activeField = fields.find(f => f.id === activeFieldId) ?? null;

    const addField = (fieldName: string, fieldNameId: number) => {
        if (fields.some(f => f.name === fieldName)) return;
        const newField = { id: Date.now(), name: fieldName, fieldNameId, selector: '' };
        setFields(prev => [...prev, newField]);
        setActiveFieldId(newField.id);
    };

    const updateSelector = (fieldId: number, selector: string) => {
        setFields(prev => prev.map(f => f.id === fieldId ? { ...f, selector } : f));
    };

    const removeField = (fieldId: number) => {
        setFields(prev => prev.filter(f => f.id !== fieldId));
        if (activeFieldId === fieldId) setActiveFieldId(null);
    };

    const openPreview = () => {
        const target = urlInput.trim();
        if (!target) { Alert.alert('Введите URL'); return; }
        const fullUrl = target.match(/^https?:\/\//i) ? target : `https://${target}`;
        setUrl(fullUrl);
        setWebViewUrl(fullUrl);
        setPreviewVisible(true);
    };

    const onWebViewMessage = (event: any) => {
        if (!activeFieldId) return;
        try {
            const data = JSON.parse(event.nativeEvent.data);
            updateSelector(activeFieldId, data.selector);
        } catch {}
    };

    const saveSite = async () => {
        if (!name.trim() || !urlInput.trim()) {
            Alert.alert('Заполните поля', 'Имя и URL обязательны');
            return;
        }
        const finalUrl = urlInput.trim().match(/^https?:\/\//i) ? urlInput.trim() : `https://${urlInput.trim()}`;
        setSaving(true);
        try {
            const created = await apiService.createAnalyzedSite({ Name: name.trim(), Url: finalUrl });
            const siteId = created?.Id ?? created?.id;
            if (siteId) {
                for (const field of fields) {
                    if (!field.selector.trim()) continue;
                    const payload = {
                        Name: field.name,
                        FieldToGet: field.selector.trim(),
                        AnalyzedSiteId: siteId,
                        FieldNameId: field.fieldNameId,
                    };
                    console.log('[AddSite] createAnalyzedField payload:', JSON.stringify(payload));
                    await apiService.createAnalyzedField(payload);
                }
            }
            setName('');
            setUrlInput('');
            setUrl('');
            setWebViewUrl('');
            setFields([]);
            setActiveFieldId(null);
            Alert.alert('Готово', 'Сайт добавлен');
        } catch (error: any) {
            Alert.alert('Ошибка', error?.message || 'Не удалось сохранить сайт');
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={s.container}>
            <StatusBar style="dark" />

            <View style={s.header}>
                <Text style={s.title}>Добавление сайта</Text>
                <Feather name="plus-circle" size={26} color="#4a6fa5" />
            </View>

            <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Основные данные */}
                <View style={s.card}>
                    <Text style={s.sectionLabel}>Основные данные</Text>
                    <TextInput
                        style={s.input}
                        placeholder="Название сайта"
                        placeholderTextColor="#95a5a6"
                        value={name}
                        onChangeText={setName}
                    />
                    <View style={s.urlRow}>
                        <TextInput
                            style={[s.input, s.urlInput]}
                            placeholder="URL объявления"
                            placeholderTextColor="#95a5a6"
                            value={urlInput}
                            onChangeText={setUrlInput}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                            textContentType="URL"
                            autoComplete="url"
                        />
                        <TouchableOpacity style={s.previewButton} onPress={openPreview}>
                            <Feather name="eye" size={18} color="white" />
                        </TouchableOpacity>
                    </View>
                    {url ? (
                        <Text style={s.urlConfirmed} numberOfLines={1}>
                            <Feather name="check-circle" size={12} color="#27ae60" /> {url}
                        </Text>
                    ) : null}
                </View>

                {/* Параметры */}
                <View style={s.card}>
                    <View style={s.sectionRow}>
                        <Text style={s.sectionLabel}>Параметры</Text>
                        <TouchableOpacity style={s.addFieldButton} onPress={() => setFieldPickerVisible(true)}>
                            <Feather name="plus" size={14} color="white" />
                            <Text style={s.addFieldButtonText}>Добавить поле</Text>
                        </TouchableOpacity>
                    </View>

                    {fields.length === 0 && (
                        <Text style={s.emptyText}>Добавьте поля для парсинга</Text>
                    )}

                    {fields.map(field => (
                        <TouchableOpacity
                            key={field.id}
                            style={[s.fieldCard, activeFieldId === field.id && s.fieldCardActive]}
                            onPress={() => setActiveFieldId(field.id)}
                            activeOpacity={0.8}
                        >
                            <View style={s.fieldHeader}>
                                <View style={s.fieldNameRow}>
                                    <Feather name="tag" size={13} color={activeFieldId === field.id ? '#4a6fa5' : '#7f8c8d'} />
                                    <Text style={[s.fieldName, activeFieldId === field.id && s.fieldNameActive]}>{field.name}</Text>
                                    {activeFieldId === field.id && (
                                        <View style={s.activeBadge}>
                                            <Text style={s.activeBadgeText}>активно</Text>
                                        </View>
                                    )}
                                </View>
                                <TouchableOpacity onPress={() => removeField(field.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Feather name="trash-2" size={15} color="#e74c3c" />
                                </TouchableOpacity>
                            </View>
                            <TextInput
                                style={s.selectorInput}
                                placeholder="Селектор (XPath, CSS, text='...')"
                                placeholderTextColor="#95a5a6"
                                value={field.selector}
                                onChangeText={text => updateSelector(field.id, text)}
                                onFocus={() => setActiveFieldId(field.id)}
                                autoCapitalize="none"
                                autoCorrect={false}
                                multiline
                            />
                        </TouchableOpacity>
                    ))}

                    {fields.length > 0 && !activeFieldId && (
                        <Text style={s.hintText}>Нажмите на поле, затем тапните по элементу в предпросмотре</Text>
                    )}
                    {activeField && (
                        <Text style={s.hintText}>
                            Активно: <Text style={{ fontWeight: '700', color: '#4a6fa5' }}>{activeField.name}</Text> — тапните по элементу в предпросмотре
                        </Text>
                    )}
                </View>

                <TouchableOpacity style={s.primaryButton} onPress={saveSite} disabled={saving}>
                    <Text style={s.primaryButtonText}>{saving ? 'Сохранение...' : 'Добавить сайт'}</Text>
                </TouchableOpacity>

            </ScrollView>

            {/* Предпросмотр */}
            <Modal visible={previewVisible} animationType="slide" onRequestClose={() => setPreviewVisible(false)}>
                <View style={[s.previewContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
                    <View style={s.previewHeader}>
                        <TouchableOpacity onPress={() => setPreviewVisible(false)} style={s.previewClose}>
                            <Feather name="x" size={22} color="#1f2d3d" />
                        </TouchableOpacity>
                        <View style={{ flex: 1, alignItems: 'center' }}>
                            <Text style={s.previewTitle} numberOfLines={1}>
                                {activeField ? `Выбор: ${activeField.name}` : 'Предпросмотр'}
                            </Text>
                            <Text style={s.previewSubtitle} numberOfLines={1}>
                                {activeField ? 'Тапните на нужный элемент' : 'Сначала выберите поле в форме'}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={s.clearPopupsButton}
                            onPress={() => webViewRef.current?.injectJavaScript(`
                                (function() {
                                    var all = document.querySelectorAll('*');
                                    for (var i = 0; i < all.length; i++) {
                                        var el = all[i];
                                        var style = window.getComputedStyle(el);
                                        var zIndex = parseInt(style.zIndex) || 0;
                                        var pos = style.position;
                                        if ((pos === 'fixed' || pos === 'absolute') && zIndex > 10) {
                                            var rect = el.getBoundingClientRect();
                                            if (rect.width * rect.height > window.innerWidth * window.innerHeight * 0.3) {
                                                el.style.display = 'none';
                                            }
                                        }
                                    }
                                    document.body.style.overflow = 'auto';
                                    document.documentElement.style.overflow = 'auto';
                                })(); true;
                            `)}
                        >
                            <Feather name="slash" size={18} color="#e67e22" />
                        </TouchableOpacity>
                    </View>

                    <WebView
                        ref={webViewRef}
                        source={{ uri: webViewUrl }}
                        style={s.webView}
                        injectedJavaScript={INJECTED_JS}
                        onMessage={onWebViewMessage}
                        onLoadStart={() => setWebViewLoading(true)}
                        onLoadEnd={() => setWebViewLoading(false)}
                        javaScriptEnabled
                        domStorageEnabled
                        userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
                    />

                    {webViewLoading && (
                        <View style={s.webViewLoader}>
                            <ActivityIndicator size="large" color="#4a6fa5" />
                        </View>
                    )}

                    {activeField?.selector ? (
                        <View style={s.selectorPreview}>
                            <Text style={s.selectorPreviewLabel}>Выбранный селектор:</Text>
                            <Text style={s.selectorPreviewValue} numberOfLines={2}>{activeField.selector}</Text>
                            <TouchableOpacity style={s.doneButton} onPress={() => setPreviewVisible(false)}>
                                <Text style={s.doneButtonText}>Готово</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}
                </View>
            </Modal>

            {/* Модал выбора поля */}
            <Modal visible={fieldPickerVisible} transparent animationType="slide" onRequestClose={() => setFieldPickerVisible(false)}>
                <View style={s.modalBackdrop}>
                    <View style={[s.modalCard, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                        <Text style={s.modalTitle}>Выберите параметр</Text>
                        <FlatList
                            data={fieldNames}
                            keyExtractor={item => String(item.Id ?? (item as any).id)}
                            renderItem={({ item }) => {
                                const itemName = item.Name ?? (item as any).name;
                                const added = fields.some(f => f.name === itemName);
                                return (
                                    <TouchableOpacity
                                        style={[s.modalItem, added && s.modalItemDisabled]}
                                        onPress={() => {
                                            const id = item.Id ?? (item as any).id ?? 0;
                                            addField(itemName, id);
                                            setFieldPickerVisible(false);
                                        }}
                                        disabled={added}
                                    >
                                        <Text style={[s.modalItemText, added && s.modalItemTextDisabled]}>{itemName}</Text>
                                        {added && <Feather name="check" size={16} color="#bdc3c7" />}
                                    </TouchableOpacity>
                                );
                            }}
                            ListEmptyComponent={<Text style={s.emptyText}>Параметры не загружены</Text>}
                        />
                        <TouchableOpacity style={s.modalClose} onPress={() => setFieldPickerVisible(false)}>
                            <Text style={s.modalCloseText}>Закрыть</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const lightStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f4f8' },
    header: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 22, fontWeight: '700', color: '#1f2d3d' },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },
    card: { backgroundColor: 'white', borderRadius: 18, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
    sectionLabel: { fontSize: 15, fontWeight: '700', color: '#1f2d3d', marginBottom: 12 },
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    input: { backgroundColor: '#f8f9fa', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e8eef5', fontSize: 15, marginBottom: 10, color: '#2c3e50' },
    urlRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    urlInput: { flex: 1, marginBottom: 0 },
    previewButton: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#4a6fa5', justifyContent: 'center', alignItems: 'center' },
    urlConfirmed: { fontSize: 12, color: '#27ae60', marginTop: 6 },
    addFieldButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#4a6fa5', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
    addFieldButtonText: { color: 'white', fontWeight: '600', fontSize: 13 },
    emptyText: { color: '#9aa5b4', textAlign: 'center', paddingVertical: 8 },
    hintText: { fontSize: 12, color: '#7f8c8d', marginTop: 8, textAlign: 'center' },
    fieldCard: { backgroundColor: '#f8f9fa', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1.5, borderColor: '#e8eef5' },
    fieldCardActive: { borderColor: '#4a6fa5', backgroundColor: '#f0f5ff' },
    fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    fieldNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    fieldName: { fontWeight: '600', color: '#7f8c8d', fontSize: 14 },
    fieldNameActive: { color: '#4a6fa5' },
    activeBadge: { backgroundColor: '#4a6fa5', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    activeBadgeText: { color: 'white', fontSize: 10, fontWeight: '700' },
    selectorInput: { backgroundColor: 'white', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#dfe6ee', fontSize: 13, color: '#2c3e50', minHeight: 40 },
    primaryButton: { backgroundColor: '#4a6fa5', padding: 16, borderRadius: 14, alignItems: 'center' },
    primaryButtonText: { color: 'white', fontWeight: '700', fontSize: 16 },
    previewContainer: { flex: 1, backgroundColor: 'white' },
    previewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e8eef5' },
    previewClose: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    clearPopupsButton: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    previewTitle: { textAlign: 'center', fontWeight: '700', fontSize: 15, color: '#1f2d3d' },
    previewSubtitle: { textAlign: 'center', fontSize: 11, color: '#7f8c8d', marginTop: 2 },
    webView: { flex: 1 },
    webViewLoader: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.8)' },
    selectorPreview: { padding: 16, borderTopWidth: 1, borderTopColor: '#e8eef5', backgroundColor: 'white' },
    selectorPreviewLabel: { fontSize: 12, color: '#7f8c8d', marginBottom: 4 },
    selectorPreviewValue: { fontSize: 13, color: '#1f2d3d', fontWeight: '500', marginBottom: 12 },
    doneButton: { backgroundColor: '#4a6fa5', padding: 14, borderRadius: 12, alignItems: 'center' },
    doneButtonText: { color: 'white', fontWeight: '700' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '70%' },
    modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: '#1f2d3d' },
    modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f4f8' },
    modalItemDisabled: { opacity: 0.5 },
    modalItemText: { color: '#1f2d3d', fontSize: 15 },
    modalItemTextDisabled: { color: '#9aa5b4' },
    modalClose: { alignItems: 'center', paddingVertical: 16 },
    modalCloseText: { color: '#4a6fa5', fontWeight: '700', fontSize: 15 },
});

const darkStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f0f0f' },
    header: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 22, fontWeight: '700', color: '#f1f5f9' },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },
    card: { backgroundColor: '#1a1a1a', borderRadius: 18, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 2 },
    sectionLabel: { fontSize: 15, fontWeight: '700', color: '#f1f5f9', marginBottom: 12 },
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    input: { backgroundColor: '#2d2d2d', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#3d3d3d', fontSize: 15, marginBottom: 10, color: '#e2e8f0' },
    urlRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    urlInput: { flex: 1, marginBottom: 0 },
    previewButton: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#4a6fa5', justifyContent: 'center', alignItems: 'center' },
    urlConfirmed: { fontSize: 12, color: '#4ade80', marginTop: 6 },
    addFieldButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#4a6fa5', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
    addFieldButtonText: { color: 'white', fontWeight: '600', fontSize: 13 },
    emptyText: { color: '#6b7280', textAlign: 'center', paddingVertical: 8 },
    hintText: { fontSize: 12, color: '#9ca3af', marginTop: 8, textAlign: 'center' },
    fieldCard: { backgroundColor: '#2d2d2d', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1.5, borderColor: '#3d3d3d' },
    fieldCardActive: { borderColor: '#4a6fa5', backgroundColor: '#1e3a5f' },
    fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    fieldNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    fieldName: { fontWeight: '600', color: '#9ca3af', fontSize: 14 },
    fieldNameActive: { color: '#60a5fa' },
    activeBadge: { backgroundColor: '#4a6fa5', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    activeBadgeText: { color: 'white', fontSize: 10, fontWeight: '700' },
    selectorInput: { backgroundColor: '#1a1a1a', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#3d3d3d', fontSize: 13, color: '#e2e8f0', minHeight: 40 },
    primaryButton: { backgroundColor: '#4a6fa5', padding: 16, borderRadius: 14, alignItems: 'center' },
    primaryButtonText: { color: 'white', fontWeight: '700', fontSize: 16 },
    previewContainer: { flex: 1, backgroundColor: '#0f0f0f' },
    previewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2d2d2d' },
    previewClose: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    clearPopupsButton: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    previewTitle: { textAlign: 'center', fontWeight: '700', fontSize: 15, color: '#f1f5f9' },
    previewSubtitle: { textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 2 },
    webView: { flex: 1 },
    webViewLoader: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
    selectorPreview: { padding: 16, borderTopWidth: 1, borderTopColor: '#2d2d2d', backgroundColor: '#1a1a1a' },
    selectorPreviewLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 4 },
    selectorPreviewValue: { fontSize: 13, color: '#e2e8f0', fontWeight: '500', marginBottom: 12 },
    doneButton: { backgroundColor: '#4a6fa5', padding: 14, borderRadius: 12, alignItems: 'center' },
    doneButtonText: { color: 'white', fontWeight: '700' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: '#1a1a1a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '70%' },
    modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: '#f1f5f9' },
    modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2d2d2d' },
    modalItemDisabled: { opacity: 0.5 },
    modalItemText: { color: '#e2e8f0', fontSize: 15 },
    modalItemTextDisabled: { color: '#6b7280' },
    modalClose: { alignItems: 'center', paddingVertical: 16 },
    modalCloseText: { color: '#60a5fa', fontWeight: '700', fontSize: 15 },
});
