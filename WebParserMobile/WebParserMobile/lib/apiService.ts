// lib/apiService.ts
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_URL = Platform.select({
    ios: 'http://localhost:8088',
    android: 'http://172.20.10.3:8088',
    web: 'http://localhost:8088',
});

export interface UserData {
    login: string;
    email?: string;
    role?: string;
    [key: string]: any;
}

export interface TokenData {
    AccessToken: string;
    RefreshToken: string;
    Username: string;
}

export interface Site {
    Id: number;
    Url: string;
    Name: string;
}

export interface SiteField {
    Field: string;
    Data: string;
}

export interface FavoriteSite {
    AnalyzedSiteId: number;
    UserId: number;
}

export interface FieldName {
    Id: number;
    Name: string;
}

export interface AnalyzedField {
    Id: number;
    Name: string;
    FieldToGet: string;
    AnalyzedSiteId: number;
    FieldNameId: number | null;
}

export interface ParsedDataItem {
    SiteId: number;
    Field: string;
    Data: string;
    UpdatedAt: string;
}

export interface LoginResponse {
    AccessToken: string;
    RefreshToken: string;
    Username: string;
    user?: UserData;
    message?: string;
}

export interface AuthResult {
    success: boolean;
    error?: string;
}

class ApiService {
    private isRefreshing = false;
    private failedQueue: Array<{ resolve: (value: string) => void; reject: (reason?: any) => void }> = [];

    private enableLogging = true;

    private log(message: string, data?: any) {
        if (this.enableLogging) {
            console.log(`[Auth] ${message}`, data || '');
        }
    }
// Добавим новый метод в класс ApiService в файле apiService.ts
    async getUserInfo(): Promise<UserData> {
        const response = await this.fetchWithTokenRefresh('/api/Authentication/my');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Преобразуем ответ сервера в формат UserData
        return {
            login: data.Login,
            role: data.Role,
            // Можно добавить дополнительные поля, если они есть в ответе
        };
    }
    private async getTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
        try {
            const accessToken = await SecureStore.getItemAsync('accessToken');
            const refreshToken = await SecureStore.getItemAsync('refreshToken');
            return { accessToken, refreshToken };
        } catch (error) {
            console.error('Error getting tokens:', error);
            return { accessToken: null, refreshToken: null };
        }
    }

    private async saveTokens(tokens: TokenData): Promise<void> {
        await SecureStore.setItemAsync('accessToken', tokens.AccessToken);
        await SecureStore.setItemAsync('refreshToken', tokens.RefreshToken);
    }

    private async clearTokens(): Promise<void> {
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        await SecureStore.deleteItemAsync('userData');
    }

    private processQueue(error: any, token: string | null = null) {
        this.failedQueue.forEach(prom => {
            if (error) {
                prom.reject(error);
            } else {
                prom.resolve(token!);
            }
        });
        this.failedQueue = [];
    }

    private async refreshAccessToken(): Promise<string> {
        const { accessToken, refreshToken } = await this.getTokens();

        this.log('Попытка обновления токена', {
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshToken
        });

        if (!accessToken || !refreshToken) {
            throw new Error('Токены отсутствуют');
        }

        try {
            const response = await fetch(`${API_URL}/api/Authentication/Refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    accessToken,
                    refreshToken,

                }),
            });

            this.log('Ответ на обновление токена', response.status);

            if (!response.ok) {
                if (response.status === 401) {
                    this.log('Refresh токен истек, очищаем токены');
                    await this.clearTokens();
                    throw new Error('Сессия истекла. Пожалуйста, войдите снова.');
                }

                const errorText = await response.text();
                this.log('Ошибка обновления токена', errorText);
                throw new Error(`Ошибка обновления токена: ${response.status}`);
            }

            const tokens: TokenData = await response.json();
            await this.saveTokens(tokens);

            this.log('Токены успешно обновлены', {
                newAccessToken: tokens.AccessToken.substring(0, 20) + '...',
                newRefreshToken: tokens.RefreshToken.substring(0, 20) + '...'
            });

            return tokens.AccessToken;
        } catch (error) {
            this.log('Ошибка обновления токена', error);
            throw error;
        }
    }

    private async fetchWithTokenRefresh(endpoint: string, options: RequestInit = {}): Promise<Response> {
        let { accessToken } = await this.getTokens();

        this.log('Выполнение запроса', { endpoint, hasToken: !!accessToken });

        // Если нет токена, просто делаем запрос без авторизации
        if (!accessToken) {
            const response = await fetch(`${API_URL}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
            });
            return response;
        }

        // Первый запрос с токеном
        let response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                ...options.headers,
            },
        });

        this.log('Ответ', { endpoint, status: response.status });

        // Если токен истек (401), пробуем обновить
        if (response.status === 401 && !this.isRefreshing) {
            this.log('Токен истек, пытаемся обновить');
            this.isRefreshing = true;

            try {
                const newAccessToken = await this.refreshAccessToken();
                this.isRefreshing = false;
                this.processQueue(null, newAccessToken);

                this.log('Повторяем запрос с новым токеном');

                // Повторяем запрос с новым токеном
                response = await fetch(`${API_URL}${endpoint}`, {
                    ...options,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${newAccessToken}`,
                        ...options.headers,
                    },
                });

                this.log('Повторный ответ', { endpoint, status: response.status });
            } catch (refreshError) {
                this.isRefreshing = false;
                this.processQueue(refreshError, null);
                this.log('Обновление не удалось', refreshError);
                throw refreshError;
            }
        }

        // Если токен истек и мы уже обновляем
        if (response.status === 401 && this.isRefreshing) {
            this.log('Ожидание обновления токена...');
            return new Promise<Response>((resolve, reject) => {
                this.failedQueue.push({
                    resolve: async (newToken: string) => {
                        try {
                            const retryResponse = await fetch(`${API_URL}${endpoint}`, {
                                ...options,
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${newToken}`,
                                    ...options.headers,
                                },
                            });
                            resolve(retryResponse);
                        } catch (error) {
                            reject(error);
                        }
                    },
                    reject: (error) => reject(error)
                });
            });
        }

        return response;
    }

    // Authentication methods
    async login(login: string, password: string): Promise<LoginResponse> {
        this.log('Вход в систему', { login });

        const response = await fetch(`${API_URL}/api/Authentication/Login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                Login: login,
                Password: password,
            }),
        });

        const data = await response.json();

        if (response.ok && data.AccessToken) {
            // Сохраняем токены
            await this.saveTokens({
                AccessToken: data.AccessToken,
                RefreshToken: data.RefreshToken,
                Username: data.Username
            });

            this.log('Успешный вход, токены сохранены', {
                username: data.Username
            });
        }

        return data;
    }

    async refreshTokens(): Promise<TokenData> {
        return await this.refreshAccessToken().then(accessToken => {
            // Получаем обновленные токены из хранилища
            return this.getTokens().then(({ accessToken, refreshToken }) => {
                if (!accessToken || !refreshToken) {
                    throw new Error('Токены не найдены');
                }
                return {
                    AccessToken: accessToken,
                    RefreshToken: refreshToken,
                    Username: '' // Мы не знаем имя пользователя здесь
                };
            });
        });
    }

    async revokeTokens(): Promise<void> {
        try {
            const { accessToken } = await this.getTokens();
            if (accessToken) {
                await fetch(`${API_URL}/api/Authentication/Revoke`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                });
            }
        } catch (error) {
            console.error('Error revoking tokens:', error);
        } finally {
            await this.clearTokens();
            this.log('Токены отозваны и очищены');
        }
    }

    async register(login: string, password: string): Promise<AuthResult> {
        this.log('Регистрация', { login });

        const response = await fetch(`${API_URL}/api/Authentication/Register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                Login: login,
                Password: password,
            }),
        });

        return response.json();
    }

    // Sites methods
    async getAllSites(): Promise<Site[]> {
        const response = await fetch(`${API_URL}/api/AnalyzedSite/all`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }

    async getSiteFields(id: number): Promise<SiteField[]> {
        const response = await fetch(`${API_URL}/api/Parser/${id}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }

    async getFieldNames(): Promise<FieldName[]> {
        const response = await fetch(`${API_URL}/api/FieldName/all`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }

    async getAnalyzedFields(siteId: number): Promise<AnalyzedField[]> {
        const response = await fetch(`${API_URL}/api/AnalyzedField/site/${siteId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }

    async createAnalyzedSite(data: { Name: string; Url: string }): Promise<any> {
        const response = await this.fetchWithTokenRefresh('/api/AnalyzedSite', {
            method: 'POST',
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `Ошибка при создании сайта: ${response.status}`);
        }

        return response.json();
    }

    async createAnalyzedField(data: { Name: string; FieldToGet: string; AnalyzedSiteId: number }): Promise<any> {
        const response = await this.fetchWithTokenRefresh('/api/AnalyzedField', {
            method: 'POST',
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `Ошибка при создании поля: ${response.status}`);
        }

        return response.json();
    }

    async getAllParsedData(): Promise<ParsedDataItem[]> {
        const response = await fetch(`${API_URL}/api/ParsedData/all`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }

    async getFavoriteSites(): Promise<FavoriteSite[]> {
        const response = await this.fetchWithTokenRefresh('/api/FaforiteSite/my');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }

    async addFavoriteSite(siteId: number): Promise<void> {
        const response = await this.fetchWithTokenRefresh('/api/FaforiteSite', {
            method: 'POST',
            body: JSON.stringify({ AnalyzedSiteId: siteId }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Ошибка при добавлении в избранное: ${response.status}`);
        }
    }

    async removeFavoriteSite(siteId: number): Promise<void> {
        const response = await this.fetchWithTokenRefresh(`/api/FaforiteSite/${siteId}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            let errorMessage = `Ошибка при удалении из избранного: ${response.status}`;
            try {
                const responseText = await response.text();
                if (responseText && responseText.trim()) {
                    try {
                        const errorData = JSON.parse(responseText);
                        errorMessage = errorData.message || errorMessage;
                    } catch {
                        errorMessage = responseText;
                    }
                }
            } catch (textError) {
                console.error('Error reading response text:', textError);
            }
            throw new Error(errorMessage);
        }
    }

    // Storage methods
    async saveAuthData(token: string, userData: UserData): Promise<void> {
        // Устаревший метод, оставлен для совместимости
        await SecureStore.setItemAsync('accessToken', token);
        await SecureStore.setItemAsync('userData', JSON.stringify(userData));
    }

    async clearAuthData(): Promise<void> {
        await this.clearTokens();
    }
    async checkAuthWithoutRefresh(): Promise<boolean> {
        const { accessToken } = await this.getTokens();

        if (!accessToken) {
            this.log('Проверка аутентификации: нет токена');
            return false;
        }

        try {
            // Простая проверка токена без механизма обновления
            const response = await fetch(`${API_URL}/api/Authentication/check`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            const isValid = response.ok;
            this.log('Проверка аутентификации без обновления:', { isValid });
            return isValid;
        } catch (error) {
            this.log('Проверка аутентификации не удалась', error);
            return false;
        }
    }
    async getStoredAuthData(): Promise<{ token: string | null; userData: UserData | null }> {
        try {
            const { accessToken } = await this.getTokens();
            const storedUserData = await SecureStore.getItemAsync('userData');
            const userData = storedUserData ? JSON.parse(storedUserData) : null;
            return { token: accessToken, userData };
        } catch (error) {
            console.error('Error loading auth data:', error);
            return { token: null, userData: null };
        }
    }

    // Проверка токенов
    async checkAuthStatus(): Promise<boolean> {
        const { accessToken, refreshToken } = await this.getTokens();

        if (!accessToken || !refreshToken) {
            this.log('Проверка аутентификации: нет токенов');
            return false;
        }

        try {
            // Пробуем выполнить запрос, который требует аутентификации
            const response = await this.fetchWithTokenRefresh('/api/Authentication/check');
            const isValid = response.ok;
            this.log('Проверка аутентификации:', { isValid });
            return isValid;
        } catch (error) {
            this.log('Проверка аутентификации не удалась', error);
            return false;
        }
    }
}

export const apiService = new ApiService();