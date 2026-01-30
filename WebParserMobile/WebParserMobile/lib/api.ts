import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const API_URL = Platform.select({
    ios: 'http://localhost:8088',
    android: 'http://192.168.31.177:8088',
    web: 'http://localhost:8088',
});

export const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
    try {
        const token = await SecureStore.getItemAsync('userToken');

        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_URL}/api/${endpoint}`, {
            ...options,
            headers,
        });

        if (response.status === 401) {
            // Токен недействителен
            await SecureStore.deleteItemAsync('userToken');
            throw new Error('Unauthorized');
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Request failed');
        }

        return data;
    } catch (error) {
        console.error('API Request Error:', error);
        throw error;
    }
};