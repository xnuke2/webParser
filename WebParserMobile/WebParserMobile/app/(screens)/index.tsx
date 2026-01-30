import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

export default function Index() {
    const { token, signOut, userData } = useAuth();

    const handleProfilePress = () => {
        router.push('/(screens)/profile');
    };

    return (
        <SafeAreaView style={[{ flex: 1 }]}>
            <StatusBar barStyle="light-content" />

            {/* Шапка */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Главная</Text>
                <TouchableOpacity onPress={handleProfilePress} style={styles.profileButton}>
                    <Text style={styles.profileButtonText}>
                        {token ? (userData?.login || 'Профиль') : 'Войти'}
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView>
                <View style={[styles.test]}>
                    <Text style={{ color: 'red', marginHorizontal: 'auto', fontSize: 60 }}>Это кошка</Text>
                </View>
                <View style={styles.test}>
                    <Image
                        style={{ width: 224, height: 224 }}
                        source={require('@/assets/images/android-icon-monochrome.png')}
                    />
                </View>

                {/* Информация о статусе */}
                <View style={styles.statusCard}>
                    <Text style={styles.statusTitle}>
                        {token ? 'Добро пожаловать!' : 'Вы в режиме гостя'}
                    </Text>
                    <Text style={styles.statusText}>
                        {token
                            ? 'Вы авторизованы и можете использовать все функции приложения'
                            : 'Авторизуйтесь для доступа ко всем функциям'}
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f8f9fa',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2c3e50',
    },
    profileButton: {
        backgroundColor: '#4a6fa5',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    profileButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    test: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        marginVertical: 20,
    },
    statusCard: {
        backgroundColor: '#e8f4fc',
        margin: 16,
        padding: 20,
        borderRadius: 12,
        alignItems: 'center',
    },
    statusTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 8,
    },
    statusText: {
        fontSize: 14,
        color: '#7f8c8d',
        textAlign: 'center',
    },
});