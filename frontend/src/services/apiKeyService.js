import api from './api'

const apiKeyService = {
  // 获取API密钥列表
  async getApiKeys(params = {}) {
    try {
      const response = await api.get('/api/api-keys', { params })
      return response.data.data
    } catch (error) {
      console.error('获取API密钥列表失败:', error)
      throw new Error(error.response?.data?.detail || '获取API密钥列表失败')
    }
  },

  // 创建API密钥
  async createApiKey(keyData) {
    try {
      const response = await api.post('/api/api-keys', keyData)
      return response.data.data
    } catch (error) {
      console.error('创建API密钥失败:', error)
      throw new Error(error.response?.data?.detail || '创建API密钥失败')
    }
  },

  // 获取API密钥详情
  async getApiKeyDetail(keyId) {
    try {
      const response = await api.get(`/api/api-keys/${keyId}`)
      return response.data.data
    } catch (error) {
      console.error('获取API密钥详情失败:', error)
      throw new Error(error.response?.data?.detail || '获取API密钥详情失败')
    }
  },

  // 更新API密钥
  async updateApiKey(keyId, updateData) {
    try {
      const response = await api.put(`/api/api-keys/${keyId}`, updateData)
      return response.data.data
    } catch (error) {
      console.error('更新API密钥失败:', error)
      throw new Error(error.response?.data?.detail || '更新API密钥失败')
    }
  },

  // 删除API密钥
  async deleteApiKey(keyId) {
    try {
      await api.delete(`/api/api-keys/${keyId}`)
      return true
    } catch (error) {
      console.error('删除API密钥失败:', error)
      throw new Error(error.response?.data?.detail || '删除API密钥失败')
    }
  },

  // 验证API密钥权限
  async validateApiKeyPermissions(apiKey) {
    try {
      const response = await api.get('/api/api-keys/validate/permissions', {
        headers: {
          'X-API-Key': apiKey
        }
      })
      return response.data.data
    } catch (error) {
      console.error('验证API密钥权限失败:', error)
      throw new Error(error.response?.data?.detail || '验证API密钥权限失败')
    }
  }
}

export default apiKeyService