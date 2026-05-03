import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { apiService, User, Role } from '@/lib/apiService';

export default function AdminUsersScreen() {
    const { isDark } = useTheme();
    const s = isDark ? darkStyles : lightStyles;

    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [roleModalVisible, setRoleModalVisible] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [usersData, rolesData] = await Promise.all([
                apiService.getUsers(),
                apiService.getRoles(),
            ]);
            setUsers(usersData);
            setRoles(rolesData);
        } catch (e: any) {
            Alert.alert('Ошибка', e.message || 'Не удалось загрузить данные');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredUsers = users.filter(u =>
        u.Login.toLowerCase().includes(search.toLowerCase())
    );

    const getRoleName = (roleId: number) =>
        roles.find(r => r.Id === roleId)?.Name ?? `Роль ${roleId}`;

    const getRoleColor = (roleId: number) => {
        const name = getRoleName(roleId);
        if (name === 'Администратор') return '#e74c3c';
        if (name === 'Редактор') return '#f39c12';
        return '#27ae60';
    };

    const handleOpenRoleModal = (user: User) => {
        setSelectedUser(user);
        setRoleModalVisible(true);
    };

    const handleAssignRole = async (roleId: number) => {
        if (!selectedUser) return;
        setRoleModalVisible(false);
        try {
            await apiService.updateUserRole(selectedUser.Id, roleId);
            setUsers(prev =>
                prev.map(u => u.Id === selectedUser.Id ? { ...u, RoleId: roleId } : u)
            );
        } catch (e: any) {
            Alert.alert('Ошибка', e.message || 'Не удалось обновить роль');
        }
    };

    const handleDeleteUser = (user: User) => {
        Alert.alert(
            'Удалить пользователя',
            `Вы уверены, что хотите удалить «${user.Login}»?`,
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Удалить',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await apiService.deleteUser(user.Id);
                            setUsers(prev => prev.filter(u => u.Id !== user.Id));
                        } catch (e: any) {
                            Alert.alert('Ошибка', e.message || 'Не удалось удалить пользователя');
                        }
                    },
                },
            ]
        );
    };

    const renderUser = ({ item }: { item: User }) => (
        <View style={s.row}>
            <View style={[s.avatar, { backgroundColor: getRoleColor(item.RoleId) }]}>
                <Text style={s.avatarText}>{item.Login.charAt(0).toUpperCase()}</Text>
            </View>

            <View style={s.userInfo}>
                <Text style={s.login} numberOfLines={1}>{item.Login}</Text>
                <View style={[s.roleBadge, { backgroundColor: `${getRoleColor(item.RoleId)}20` }]}>
                    <Text style={[s.roleText, { color: getRoleColor(item.RoleId) }]}>
                        {getRoleName(item.RoleId)}
                    </Text>
                </View>
            </View>

            <View style={s.actions}>
                <TouchableOpacity
                    style={[s.actionBtn, s.roleBtn]}
                    onPress={() => handleOpenRoleModal(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Feather name="shield" size={16} color="#4a6fa5" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[s.actionBtn, s.deleteBtn]}
                    onPress={() => handleDeleteUser(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Feather name="trash-2" size={16} color="#e74c3c" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={s.container}>
            <StatusBar style={isDark ? 'light' : 'dark'} />

            {/* Шапка */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="arrow-left" size={22} color={isDark ? '#f1f5f9' : '#2c3e50'} />
                </TouchableOpacity>
                <Text style={s.title}>Пользователи</Text>
                <TouchableOpacity onPress={loadData} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="refresh-cw" size={20} color="#4a6fa5" />
                </TouchableOpacity>
            </View>

            {/* Поиск */}
            <View style={s.searchWrap}>
                <Feather name="search" size={16} color="#9ca3af" style={s.searchIcon} />
                <TextInput
                    style={s.searchInput}
                    placeholder="Поиск по логину..."
                    placeholderTextColor="#9ca3af"
                    value={search}
                    onChangeText={setSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <Feather name="x" size={16} color="#9ca3af" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Счётчик */}
            {!loading && (
                <Text style={s.counter}>
                    {filteredUsers.length} из {users.length} пользователей
                </Text>
            )}

            {/* Список */}
            {loading ? (
                <View style={s.loadingWrap}>
                    <ActivityIndicator size="large" color="#4a6fa5" />
                    <Text style={s.loadingText}>Загрузка...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredUsers}
                    keyExtractor={item => String(item.Id)}
                    renderItem={renderUser}
                    contentContainerStyle={s.list}
                    ItemSeparatorComponent={() => <View style={s.separator} />}
                    ListEmptyComponent={
                        <View style={s.emptyWrap}>
                            <Feather name="users" size={48} color="#9ca3af" />
                            <Text style={s.emptyText}>Пользователи не найдены</Text>
                        </View>
                    }
                />
            )}

            {/* Модалка выбора роли */}
            <Modal
                visible={roleModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setRoleModalVisible(false)}
            >
                <TouchableOpacity
                    style={s.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setRoleModalVisible(false)}
                >
                    <View style={s.modalCard}>
                        <Text style={s.modalTitle}>
                            Роль для «{selectedUser?.Login}»
                        </Text>
                        {roles.map(role => (
                            <TouchableOpacity
                                key={role.Id}
                                style={[
                                    s.roleOption,
                                    selectedUser?.RoleId === role.Id && s.roleOptionActive,
                                ]}
                                onPress={() => handleAssignRole(role.Id)}
                            >
                                <Text style={[
                                    s.roleOptionText,
                                    selectedUser?.RoleId === role.Id && s.roleOptionTextActive,
                                ]}>
                                    {role.Name}
                                </Text>
                                {selectedUser?.RoleId === role.Id && (
                                    <Feather name="check" size={16} color="#4a6fa5" />
                                )}
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            style={s.modalCancel}
                            onPress={() => setRoleModalVisible(false)}
                        >
                            <Text style={s.modalCancelText}>Отмена</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

const base = {
    container: { flex: 1 },
    header: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    title: { fontSize: 20, fontWeight: 'bold' as const },
    searchWrap: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 4,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 15 },
    counter: { fontSize: 12, marginHorizontal: 20, marginBottom: 8 },
    list: { paddingHorizontal: 16, paddingBottom: 24 },
    separator: { height: 1, marginHorizontal: 4 },
    row: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingVertical: 12,
        paddingHorizontal: 4,
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        marginRight: 12,
    },
    avatarText: { color: 'white', fontSize: 18, fontWeight: 'bold' as const },
    userInfo: { flex: 1, marginRight: 8 },
    login: { fontSize: 15, fontWeight: '600' as const, marginBottom: 4 },
    roleBadge: {
        alignSelf: 'flex-start' as const,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    roleText: { fontSize: 12, fontWeight: '500' as const },
    actions: { flexDirection: 'row' as const, gap: 8 },
    actionBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
    },
    roleBtn: { backgroundColor: 'rgba(74,111,165,0.12)' },
    deleteBtn: { backgroundColor: 'rgba(231,76,60,0.12)' },
    loadingWrap: { flex: 1, justifyContent: 'center' as const, alignItems: 'center' as const },
    loadingText: { marginTop: 12, fontSize: 15 },
    emptyWrap: { flex: 1, alignItems: 'center' as const, paddingTop: 60 },
    emptyText: { marginTop: 12, fontSize: 15 },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        padding: 24,
    },
    modalCard: {
        width: '100%' as const,
        borderRadius: 20,
        padding: 24,
    },
    modalTitle: { fontSize: 17, fontWeight: '600' as const, marginBottom: 16 },
    roleOption: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 8,
    },
    roleOptionActive: { backgroundColor: 'rgba(74,111,165,0.12)' },
    roleOptionText: { fontSize: 15 },
    roleOptionTextActive: { color: '#4a6fa5', fontWeight: '600' as const },
    modalCancel: {
        marginTop: 4,
        paddingVertical: 14,
        alignItems: 'center' as const,
        borderRadius: 12,
    },
    modalCancelText: { fontSize: 15, fontWeight: '500' as const },
};

const lightStyles = StyleSheet.create({
    ...base,
    container: { ...base.container, backgroundColor: '#f8f9fa' },
    header: { ...base.header, backgroundColor: 'white', borderBottomColor: '#e0e0e0' },
    title: { ...base.title, color: '#2c3e50' },
    searchWrap: { ...base.searchWrap, backgroundColor: 'white' },
    searchInput: { ...base.searchInput, color: '#2c3e50' },
    counter: { ...base.counter, color: '#9ca3af' },
    separator: { ...base.separator, backgroundColor: '#f0f0f0' },
    login: { ...base.login, color: '#2c3e50' },
    loadingText: { ...base.loadingText, color: '#7f8c8d' },
    emptyText: { ...base.emptyText, color: '#9ca3af' },
    modalCard: { ...base.modalCard, backgroundColor: 'white' },
    modalTitle: { ...base.modalTitle, color: '#2c3e50' },
    roleOption: { ...base.roleOption, backgroundColor: '#f8f9fa' },
    roleOptionText: { ...base.roleOptionText, color: '#2c3e50' },
    modalCancelText: { ...base.modalCancelText, color: '#7f8c8d' },
});

const darkStyles = StyleSheet.create({
    ...base,
    container: { ...base.container, backgroundColor: '#0f0f0f' },
    header: { ...base.header, backgroundColor: '#1a1a1a', borderBottomColor: '#2d2d2d' },
    title: { ...base.title, color: '#f1f5f9' },
    searchWrap: { ...base.searchWrap, backgroundColor: '#1a1a1a' },
    searchInput: { ...base.searchInput, color: '#f1f5f9' },
    counter: { ...base.counter, color: '#6b7280' },
    separator: { ...base.separator, backgroundColor: '#2d2d2d' },
    login: { ...base.login, color: '#f1f5f9' },
    loadingText: { ...base.loadingText, color: '#9ca3af' },
    emptyText: { ...base.emptyText, color: '#6b7280' },
    modalCard: { ...base.modalCard, backgroundColor: '#1a1a1a' },
    modalTitle: { ...base.modalTitle, color: '#f1f5f9' },
    roleOption: { ...base.roleOption, backgroundColor: '#2d2d2d' },
    roleOptionText: { ...base.roleOptionText, color: '#e2e8f0' },
    modalCancelText: { ...base.modalCancelText, color: '#9ca3af' },
});
