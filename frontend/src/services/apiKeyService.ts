/**
 * API 密钥服务
 * 提供密钥的增删改查
 */

import api from './api';

export interface ApiKey {
    id: number | string;
    [key: string]: unknown;
}

export interface ApiKeyListParams {
    page?: number;
    page_size?: number;
    [key: string]: unknown;
}

type ApiErrorShape = { response?: { data?: { detail?: string } } };

const toMessage = (error: unknown, fallback: string): string => {
    const detail = (error as ApiErrorShape)?.response?.data?.detail;
    return detail || fallback;
};

const apiKeyService = {
    async getApiKeys(params: ApiKeyListParams = {}): Promise<ApiKey[]> {
        try {
            const response = await api.get('/api/api-keys', { params });
            return response.data.data;
        } catch (error) {
            console.error('获取API密钥列表失败:', error);
            throw new Error(toMessage(error, '获取API密钥列表失败'));
        }
    },

    async createApiKey(keyData: Record<string, unknown>): Promise<ApiKey> {
        try {
            const response = await api.post('/api/api-keys', keyData);
            return response.data.data;
        } catch (error) {
            console.error('创建API密钥失败:', error);
            throw new Error(toMessage(error, '创建API密钥失败'));
        }
    },

    async getApiKeyDetail(keyId: number | string): Promise<ApiKey> {
        try {
            const response = await api.get(`/api/api-keys/${keyId}`);
            return response.data.data;
        } catch (error) {
            console.error('获取API密钥详情失败:', error);
            throw new Error(toMessage(error, '获取API密钥详情失败'));
        }
    },

    async updateApiKey(keyId: number | string, updateData: Record<string, unknown>): Promise<ApiKey> {
        try {
            const response = await api.put(`/api/api-keys/${keyId}`, updateData);
            return response.data.data;
        } catch (error) {
            console.error('更新API密钥失败:', error);
            throw new Error(toMessage(error, '更新API密钥失败'));
        }
    },

    async deleteApiKey(keyId: number | string): Promise<boolean> {
        try {
            await api.delete(`/api/api-keys/${keyId}`);
            return true;
        } catch (error) {
            console.error('删除API密钥失败:', error);
            throw new Error(toMessage(error, '删除API密钥失败'));
        }
    },

};

export default apiKeyService;
