import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
    const { isLoading } = useAuth();

    // if (isLoading) {
    //     return (
    //         <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    //             <ActivityIndicator size="large" color="#4a6fa5" />
    //         </View>
    //     );
    // }

    // Всегда перенаправляем на главную вкладку
    return <Redirect href="/(screens)" />;
}