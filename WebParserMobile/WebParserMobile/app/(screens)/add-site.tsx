import React, { useRef, useState, useEffect } from 'react';
import {
    Alert,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSites } from '@/contexts/SitesContext';
import { apiService, AnalyzedField } from '@/lib/apiService';
import { useTheme } from '@/contexts/ThemeContext';
import { useLocalSearchParams, useRouter } from 'expo-router';

type TagField = {
    id: number;
    name: string;
    fieldNameId: number;
    selector: string;
    previewText: string;
    // для режима редактирования: id существующего поля на сервере
    serverId?: number;
    // помечаем поля, которые нужно удалить
    deleted?: boolean;
};

// JS вставляется в WebView — подсвечивает элементы при наведении, отправляет селектор при клике,
// подсвечивает зелёным уже выбранные элементы
const INJECTED_JS = `
(function() {
    if (window.__selectorInjected) return;
    window.__selectorInjected = true;

    // fieldId -> { selector, color }
    window.__fieldSelectors = {};
    var COLORS = ['#27ae60','#2980b9','#8e44ad','#e67e22','#c0392b','#16a085','#d35400','#2c3e50'];
    var colorIndex = 0;

    function removeOverlays() {
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
    }

    removeOverlays();
    setTimeout(removeOverlays, 1500);
    setTimeout(removeOverlays, 3000);

    var hovered = null;

    function getSelector(el) {
        if (!el || el === document.body) return 'body';
        var current = el;
        while (current && current !== document.body) {
            if (current.id) return '#' + current.id;
            var tag = current.tagName.toLowerCase();
            if (current.classList && current.classList.length > 0) {
                var classes = Array.from(current.classList)
                    .filter(function(c) { return /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(c); });
                for (var i = 0; i < classes.length; i++) {
                    var c1 = '.' + classes[i];
                    if (document.querySelectorAll(c1).length === 1) return c1;
                    var c2 = tag + '.' + classes[i];
                    if (document.querySelectorAll(c2).length === 1) return c2;
                }
                for (var i = 0; i < classes.length - 1; i++) {
                    var combo = tag + '.' + classes[i] + '.' + classes[i+1];
                    if (document.querySelectorAll(combo).length === 1) return combo;
                }
            }
            current = current.parentElement;
        }
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

    
    function redrawHighlights() {
        // Сначала снимаем все data-field-highlight рамки
        var marked = document.querySelectorAll('[data-field-highlight]');
        for (var i = 0; i < marked.length; i++) {
            marked[i].style.outline = '';
            marked[i].removeAttribute('data-field-highlight');
        }
        
        for (var fid in window.__fieldSelectors) {
            var entry = window.__fieldSelectors[fid];
            try {
                var els = document.querySelectorAll(entry.selector);
                for (var j = 0; j < els.length; j++) {
                    els[j].style.outline = '2px solid ' + entry.color;
                    els[j].setAttribute('data-field-highlight', fid);
                }
            } catch(e) {}
        }
    }

    
    document.addEventListener('message', function(e) {
        try {
            var msg = JSON.parse(e.data);
            if (msg.cmd === 'setSelector') {
                if (!window.__fieldSelectors[msg.fieldId]) {
                    window.__fieldSelectors[msg.fieldId] = { selector: msg.selector, color: COLORS[colorIndex % COLORS.length] };
                    colorIndex++;
                } else {
                    window.__fieldSelectors[msg.fieldId].selector = msg.selector;
                }
                redrawHighlights();
            } else if (msg.cmd === 'removeSelector') {
                delete window.__fieldSelectors[msg.fieldId];
                redrawHighlights();
            }
        } catch(e) {}
    });
    // iOS использует window, Android — document
    window.addEventListener('message', function(e) {
        try {
            var msg = JSON.parse(e.data);
            if (msg.cmd === 'setSelector') {
                if (!window.__fieldSelectors[msg.fieldId]) {
                    window.__fieldSelectors[msg.fieldId] = { selector: msg.selector, color: COLORS[colorIndex % COLORS.length] };
                    colorIndex++;
                } else {
                    window.__fieldSelectors[msg.fieldId].selector = msg.selector;
                }
                redrawHighlights();
            } else if (msg.cmd === 'removeSelector') {
                delete window.__fieldSelectors[msg.fieldId];
                redrawHighlights();
            }
        } catch(e) {}
    });

    document.addEventListener('mouseover', function(e) {
        if (hovered && !hovered.getAttribute('data-field-highlight')) {
            hovered.style.outline = '';
            hovered.style.cursor = '';
        }
        hovered = e.target;
        if (!hovered.getAttribute('data-field-highlight')) {
            hovered.style.outline = '2px solid #4a6fa5';
        }
        hovered.style.cursor = 'pointer';
    }, true);

    // Пытаемся найти : <tr><td>Метка</td><td>Значение</td></tr>
    // или dl/dt/dd . Если тапнули на значение — возвращаем text='Метка'
    function tryTablePattern(el) {
        // Ищем ближайший td
        var td = el;
        while (td && td !== document.body && td.tagName !== 'TD') td = td.parentElement;
        if (td && td.tagName === 'TD') {
            var row = td.parentElement;
            if (row && (row.tagName === 'TR')) {
                var cells = row.querySelectorAll('td');
                if (cells.length >= 2) {
                    // Если тапнули на 2-ю+ ячейку — берём текст 1-й как метку
                    var cellIndex = Array.from(cells).indexOf(td);
                    if (cellIndex > 0) {
                        var labelCell = cells[0];
                        var labelText = (labelCell.innerText || labelCell.textContent || '').trim();
                        var valueText = getText(td);
                        if (labelText && labelText.length < 50) {
                            return { selector: "text='" + labelText + "'", text: valueText };
                        }
                    }
                    // Если тапнули на 1-ю ячейку — берём текст 2-й как значение
                    if (cellIndex === 0 && cells.length >= 2) {
                        var labelText = (td.innerText || td.textContent || '').trim();
                        var valueText = getText(cells[1]);
                        if (labelText && labelText.length < 50) {
                            return { selector: "text='" + labelText + "'", text: valueText };
                        }
                    }
                }
            }
        }

        // dl/dt/dd 
        var dtEl = el;
        while (dtEl && dtEl !== document.body && dtEl.tagName !== 'DT' && dtEl.tagName !== 'DD') dtEl = dtEl.parentElement;
        if (dtEl) {
            if (dtEl.tagName === 'DD') {
                var prev = dtEl.previousElementSibling;
                while (prev && prev.tagName !== 'DT') prev = prev.previousElementSibling;
                if (prev) {
                    var labelText = (prev.innerText || prev.textContent || '').trim();
                    var valueText = getText(dtEl);
                    if (labelText && labelText.length < 50) {
                        return { selector: "dt:" + labelText, text: valueText };
                    }
                }
            }
            if (dtEl.tagName === 'DT') {
                var next = dtEl.nextElementSibling;
                while (next && next.tagName !== 'DD') next = next.nextElementSibling;
                var labelText = (dtEl.innerText || dtEl.textContent || '').trim();
                var valueText = next ? getText(next) : '';
                if (labelText && labelText.length < 50) {
                    return { selector: "dt:" + labelText, text: valueText };
                }
            }
        }

        return null;
    }

    document.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        var tableResult = tryTablePattern(e.target);
        if (tableResult) {
            window.ReactNativeWebView.postMessage(JSON.stringify(tableResult));
            return;
        }
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
    const { fieldNames, fetchSites, allParsedData, fetchAllParsedData } = useSites();
    const router = useRouter();
    const params = useLocalSearchParams<{ siteId?: string }>();
    const siteId = params.siteId ? parseInt(params.siteId, 10) : null;
    const isEditMode = siteId !== null;

    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [urlInput, setUrlInput] = useState('');
    const [webViewUrl, setWebViewUrl] = useState('');
    const [fields, setFields] = useState<TagField[]>([]);
    const [activeFieldId, setActiveFieldId] = useState<number | null>(null);
    const [previewVisible, setPreviewVisible] = useState(false);
    const [webViewLoading, setWebViewLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadingData, setLoadingData] = useState(isEditMode);
    const webViewRef = useRef<any>(null);

    const activeField = fields.find(f => f.id === activeFieldId) ?? null;

    // Сбрасываем форму когда открываем таб без siteId (режим добавления)
    useEffect(() => {
        if (!isEditMode) {
            setName('');
            setUrl('');
            setUrlInput('');
            setWebViewUrl('');
            setFields([]);
            setActiveFieldId(null);
            setLoadingData(false);
            webViewRef.current?.injectJavaScript(`window.__fieldSelectors = {}; true;`);
        }
    }, [isEditMode]);

    // Загружаем данные сайта при редактировании
    useEffect(() => {
        if (!isEditMode || !siteId) return;
        (async () => {
            setLoadingData(true);
            try {
                const [allSites, analyzedFields] = await Promise.all([
                    apiService.getAllSites(),
                    apiService.getAnalyzedFields(siteId),
                ]);
                const site = allSites.find(s => s.Id === siteId);
                if (site) {
                    setName(site.Name);
                    setUrl(site.Url);
                    setUrlInput(site.Url);
                    setWebViewUrl(site.Url);
                }
                if (analyzedFields.length > 0) {
                    const loaded: TagField[] = analyzedFields.map(f => {
                        const parsed = allParsedData.find(
                            p => p.SiteId === siteId && p.Field.toLowerCase() === f.Name.toLowerCase()
                        );
                        return {
                            id: f.Id,
                            serverId: f.Id,
                            name: f.Name,
                            fieldNameId: f.FieldNameId ?? 0,
                            selector: f.FieldToGet,
                            previewText: parsed?.Data ?? '',
                        };
                    });
                    setFields(loaded);
                    // Подсвечиваем уже сохранённые селекторы после загрузки WebView
                    const firstEmpty = loaded.find(f => !f.selector);
                    setActiveFieldId(firstEmpty?.id ?? loaded[0]?.id ?? null);
                }
            } catch (e: any) {
                Alert.alert('Ошибка', e?.message || 'Не удалось загрузить данные сайта');
            } finally {
                setLoadingData(false);
            }
        })();
    }, [siteId]);

    const addField = (fieldName: string, fieldNameId: number) => {
        if (fields.some(f => f.name === fieldName)) return;
        const newField = { id: Date.now(), name: fieldName, fieldNameId, selector: '', previewText: '' };
        setFields(prev => [...prev, newField]);
        setActiveFieldId(newField.id);
    };

    const updateSelector = (fieldId: number, selector: string, previewText = '') => {
        setFields(prev => prev.map(f => f.id === fieldId ? { ...f, selector, previewText } : f));
        // Сообщаем WebView чтобы подсветил элемент
        if (selector) {
            webViewRef.current?.injectJavaScript(
                `window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ cmd: 'setSelector', fieldId: ${fieldId}, selector: ${JSON.stringify(selector)} }) })); true;`
            );
        }
    };

    const removeField = (fieldId: number) => {
        setFields(prev => prev.map(f => {
            if (f.id !== fieldId) return f;
            // Если поле уже есть на сервере — помечаем deleted, не удаляем из списка
            if (f.serverId) return { ...f, deleted: true };
            return null as any;
        }).filter(Boolean));
        if (activeFieldId === fieldId) setActiveFieldId(null);
        webViewRef.current?.injectJavaScript(
            `window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ cmd: 'removeSelector', fieldId: ${fieldId} }) })); true;`
        );
    };

    const openPreview = () => {
        const target = urlInput.trim();
        if (!target) { Alert.alert('Введите URL'); return; }
        const fullUrl = target.match(/^https?:\/\//i) ? target : `https://${target}`;
        setUrl(fullUrl);
        setWebViewUrl(fullUrl);
        // Автоматически добавляем все fieldNames которых ещё нет
        setFields(prev => {
            const existing = new Set(prev.map(f => f.name));
            const toAdd: TagField[] = fieldNames
                .filter(fn => {
                    const n = fn.Name ?? (fn as any).name;
                    return n && !existing.has(n);
                })
                .map(fn => ({
                    id: Date.now() + Math.random(),
                    name: fn.Name ?? (fn as any).name,
                    fieldNameId: fn.Id ?? (fn as any).id ?? 0,
                    selector: '',
                    previewText: '',
                }));
            const next = [...prev, ...toAdd];
            // Устанавливаем активным первое незаполненное поле
            const firstEmpty = next.find(f => !f.selector);
            if (firstEmpty) setActiveFieldId(firstEmpty.id);
            return next;
        });
        setPreviewVisible(true);
    };

    const onWebViewLoaded = () => {
        setWebViewLoading(false);
        // Восстанавливаем подсветку для уже заполненных полей
        fields.filter(f => !f.deleted && f.selector).forEach(f => {
            webViewRef.current?.injectJavaScript(
                `window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ cmd: 'setSelector', fieldId: ${f.id}, selector: ${JSON.stringify(f.selector)} }) })); true;`
            );
        });
    };

    const onWebViewMessage = (event: any) => {
        if (!activeFieldId) return;
        try {
            const data = JSON.parse(event.nativeEvent.data);
            updateSelector(activeFieldId, data.selector, data.text ?? '');
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
            if (isEditMode && siteId) {
                // --- Режим редактирования ---
                await apiService.updateAnalyzedSite(siteId, { Name: name.trim(), Url: finalUrl });

                const updatedFields = [...fields];
                for (const field of updatedFields) {
                    if (field.deleted && field.serverId) {
                        await apiService.deleteAnalyzedField(field.serverId);
                    } else if (!field.deleted && field.selector.trim()) {
                        if (field.serverId) {
                            await apiService.updateAnalyzedField(field.serverId, {
                                Name: field.name,
                                FieldToGet: field.selector.trim(),
                                FieldNameId: field.fieldNameId || undefined,
                            });
                        } else {
                            const created = await apiService.createAnalyzedField({
                                Name: field.name,
                                FieldToGet: field.selector.trim(),
                                AnalyzedSiteId: siteId,
                                FieldNameId: field.fieldNameId || undefined,
                            });
                            const newServerId = created?.Id ?? created?.id;
                            if (newServerId) {
                                field.serverId = newServerId;
                            }
                        }
                    }
                }
                setFields(updatedFields);

                await fetchSites();
                try {
                    await apiService.refreshSiteParsedData(siteId);
                    await AsyncStorage.removeItem('parsedData_cache');
                    await fetchAllParsedData();
                } catch (e) {
                    console.warn('Парсинг после сохранения не удался:', e);
                }
                Alert.alert('Готово', 'Сайт обновлён', [
                    { text: 'OK', onPress: () => router.back() }
                ]);
            } else {
                // --- Режим добавления ---
                const created = await apiService.createAnalyzedSite({ Name: name.trim(), Url: finalUrl });
                const newSiteId = created?.Id ?? created?.id;
                if (newSiteId) {
                    for (const field of fields) {
                        if (!field.selector.trim()) continue;
                        await apiService.createAnalyzedField({
                            Name: field.name,
                            FieldToGet: field.selector.trim(),
                            AnalyzedSiteId: newSiteId,
                            FieldNameId: field.fieldNameId,
                        });
                    }
                }
                // Запускаем парсинг для нового сайта
                if (newSiteId) {
                    try {
                        await apiService.refreshSiteParsedData(newSiteId);
                        await AsyncStorage.removeItem('parsedData_cache');
                        await fetchAllParsedData();
                    } catch (e) {
                        console.warn('Парсинг после добавления не удался:', e);
                    }
                }
                setName('');
                setUrlInput('');
                setUrl('');
                setWebViewUrl('');
                setFields([]);
                setActiveFieldId(null);
                webViewRef.current?.injectJavaScript(`window.__fieldSelectors = {}; true;`);
                Alert.alert('Готово', 'Сайт добавлен');
            }
        } catch (error: any) {
            Alert.alert('Ошибка', error?.message || 'Не удалось сохранить сайт');
        } finally {
            setSaving(false);
        }
    };

    if (loadingData) {
        return (
            <SafeAreaView style={s.container}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#4a6fa5" />
                    <Text style={[s.emptyText, { marginTop: 12 }]}>Загрузка данных...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={s.container}>
            <StatusBar style="dark" />

            <View style={s.header}>
                {isEditMode && (
                    <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 10 }}>
                        <Feather name="arrow-left" size={24} color="#4a6fa5" />
                    </TouchableOpacity>
                )}
                <Text style={s.title}>{isEditMode ? 'Редактирование' : 'Добавление сайта'}</Text>
                <Feather name={isEditMode ? 'edit-2' : 'plus-circle'} size={26} color="#4a6fa5" />
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
                        {fields.filter(f => !f.deleted).some(f => f.selector) && (
                            <Text style={s.fieldsCountText}>{fields.filter(f => !f.deleted && f.selector).length} / {fields.filter(f => !f.deleted).length}</Text>
                        )}
                    </View>

                    {fields.filter(f => !f.deleted).length === 0 && (
                        <Text style={s.emptyText}>Откройте предпросмотр чтобы настроить поля</Text>
                    )}

                    {fields.filter(f => !f.deleted).map(field => (
                        <TouchableOpacity
                            key={field.id}
                            style={[s.fieldCard, activeFieldId === field.id && s.fieldCardActive]}
                            onPress={() => setActiveFieldId(field.id)}
                            activeOpacity={0.8}
                        >
                            <View style={s.fieldHeader}>
                                <View style={s.fieldNameRow}>
                                    <Feather
                                        name={field.selector ? 'check-circle' : 'tag'}
                                        size={13}
                                        color={field.selector ? '#27ae60' : activeFieldId === field.id ? '#4a6fa5' : '#7f8c8d'}
                                    />
                                    <Text style={[s.fieldName, activeFieldId === field.id && s.fieldNameActive]}>{field.name}</Text>
                                    {activeFieldId === field.id && !field.selector && (
                                        <View style={s.activeBadge}>
                                            <Text style={s.activeBadgeText}>активно</Text>
                                        </View>
                                    )}
                                </View>
                                <TouchableOpacity onPress={() => removeField(field.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Feather name="trash-2" size={15} color="#e74c3c" />
                                </TouchableOpacity>
                            </View>
                            {field.previewText ? (
                                <Text style={s.fieldPreviewText} numberOfLines={2}>
                                    {field.name}: <Text style={s.fieldPreviewValue}>{field.previewText}</Text>
                                </Text>
                            ) : (
                                <Text style={s.fieldEmptyHint}>
                                    {activeFieldId === field.id ? 'Откройте предпросмотр и тапните на элемент' : 'Не выбрано'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    ))}

                    {fields.filter(f => !f.deleted).length > 0 && !fields.filter(f => !f.deleted).some(f => f.selector) && (
                        <Text style={s.hintText}>Откройте предпросмотр и тапните по элементам страницы</Text>
                    )}
                </View>

                <TouchableOpacity style={s.primaryButton} onPress={saveSite} disabled={saving}>
                    <Text style={s.primaryButtonText}>
                        {saving ? 'Сохранение...' : isEditMode ? 'Сохранить изменения' : 'Добавить сайт'}
                    </Text>
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
                        onLoadEnd={onWebViewLoaded}
                        javaScriptEnabled
                        domStorageEnabled
                        userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
                    />

                    {webViewLoading && (
                        <View style={s.webViewLoader}>
                            <ActivityIndicator size="large" color="#4a6fa5" />
                        </View>
                    )}

                    {/* Панель полей внизу предпросмотра */}
                    {fields.filter(f => !f.deleted).length > 0 && (
                        <View style={s.fieldsPanel}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.fieldsPanelContent}>
                                {fields.filter(f => !f.deleted).map(field => (
                                    <TouchableOpacity
                                        key={field.id}
                                        style={[s.fieldChip, activeFieldId === field.id && s.fieldChipActive, !!field.selector && s.fieldChipDone]}
                                        onPress={() => setActiveFieldId(field.id)}
                                        activeOpacity={0.75}
                                    >
                                        <Feather
                                            name={field.selector ? 'check-circle' : 'circle'}
                                            size={12}
                                            color={field.selector ? '#27ae60' : activeFieldId === field.id ? 'white' : '#7f8c8d'}
                                        />
                                        <View style={{ marginLeft: 5 }}>
                                            <Text style={[s.fieldChipName, activeFieldId === field.id && s.fieldChipNameActive]}>
                                                {field.name}
                                            </Text>
                                            {field.previewText ? (
                                                <Text style={s.fieldChipValue} numberOfLines={1}>{field.previewText}</Text>
                                            ) : null}
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            <TouchableOpacity style={s.doneButton} onPress={() => setPreviewVisible(false)}>
                                <Text style={s.doneButtonText}>Готово</Text>
                            </TouchableOpacity>
                        </View>
                    )}
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
    fieldsCountText: { fontSize: 13, color: '#7f8c8d', fontWeight: '600' },
    fieldPreviewText: { fontSize: 13, color: '#7f8c8d', marginTop: 4 },
    fieldPreviewValue: { color: '#1f2d3d', fontWeight: '600' },
    fieldEmptyHint: { fontSize: 12, color: '#bdc3c7', marginTop: 4, fontStyle: 'italic' },
    fieldsPanel: { borderTopWidth: 1, borderTopColor: '#e8eef5', backgroundColor: 'white', paddingVertical: 10 },
    fieldsPanelContent: { paddingHorizontal: 12, gap: 8 },
    fieldChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f4f8', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderColor: '#e8eef5' },
    fieldChipActive: { backgroundColor: '#4a6fa5', borderColor: '#4a6fa5' },
    fieldChipDone: { borderColor: '#27ae60' },
    fieldChipName: { fontSize: 12, fontWeight: '600', color: '#7f8c8d' },
    fieldChipNameActive: { color: 'white' },
    fieldChipValue: { fontSize: 11, color: '#27ae60', maxWidth: 100 },
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
    fieldsCountText: { fontSize: 13, color: '#9ca3af', fontWeight: '600' },
    fieldPreviewText: { fontSize: 13, color: '#9ca3af', marginTop: 4 },
    fieldPreviewValue: { color: '#e2e8f0', fontWeight: '600' },
    fieldEmptyHint: { fontSize: 12, color: '#4b5563', marginTop: 4, fontStyle: 'italic' },
    fieldsPanel: { borderTopWidth: 1, borderTopColor: '#2d2d2d', backgroundColor: '#1a1a1a', paddingVertical: 10 },
    fieldsPanelContent: { paddingHorizontal: 12, gap: 8 },
    fieldChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2d2d2d', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1.5, borderColor: '#3d3d3d' },
    fieldChipActive: { backgroundColor: '#4a6fa5', borderColor: '#4a6fa5' },
    fieldChipDone: { borderColor: '#27ae60' },
    fieldChipName: { fontSize: 12, fontWeight: '600', color: '#9ca3af' },
    fieldChipNameActive: { color: 'white' },
    fieldChipValue: { fontSize: 11, color: '#4ade80', maxWidth: 100 },
});
