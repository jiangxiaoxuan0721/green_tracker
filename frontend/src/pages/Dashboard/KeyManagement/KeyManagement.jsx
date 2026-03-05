import { useState, useEffect } from 'react'
import './KeyManagement.css'
import apiKeyService from '@/services/apiKeyService'
import useToast from '@/hooks/useToast'

const KeyManagement = () => {
  const [apiKeys, setApiKeys] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { success: showSuccess } = useToast()
  
  // 分页状态
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    totalCount: 0,
    totalPages: 0
  })
  
  // 对话框状态
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [currentKey, setCurrentKey] = useState(null)
  
  // 表单状态
  const [formData, setFormData] = useState({
    key_name: '',
    description: '',
    permissions: ['data_upload'],
    expires_at: ''
  })
  
  // 显示的完整密钥（仅在创建时显示）
  const [newApiKey, setNewApiKey] = useState('')
  const [showNewKey, setShowNewKey] = useState(false)

  // 加载API密钥列表
  const loadApiKeys = async (page = 1, pageSize = 10) => {
    try {
      setLoading(true)
      setError('')
      const response = await apiKeyService.getApiKeys({
        page,
        page_size: pageSize
      })
      setApiKeys(response.items)
      setPagination({
        page: response.pagination.page,
        pageSize: response.pagination.page_size,
        totalCount: response.pagination.total_count,
        totalPages: response.pagination.total_pages
      })
    } catch (err) {
      setError('加载API密钥失败：' + (err.response?.data?.detail || err.message))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadApiKeys()
  }, [])

  // 创建API密钥
  const handleCreateKey = async () => {
    try {
      setLoading(true)
      setError('')
      
      const createRequest = {
        key_name: formData.key_name,
        description: formData.description || undefined,
        permissions: formData.permissions,
        expires_at: formData.expires_at || undefined
      }
      
      const response = await apiKeyService.createApiKey(createRequest)
      setNewApiKey(response.api_key)
      setShowNewKey(true)
      showSuccess('API密钥创建成功！请妥善保存密钥，关闭窗口后将无法再次查看完整密钥。')
      
      // 重置表单
      setFormData({
        key_name: '',
        description: '',
        permissions: ['data_upload'],
        expires_at: ''
      })
      setShowCreateModal(false)
      
      // 重新加载列表
      loadApiKeys(pagination.page)
    } catch (err) {
      setError('创建API密钥失败：' + (err.response?.data?.detail || err.message))
    } finally {
      setLoading(false)
    }
  }

  // 更新API密钥
  const handleUpdateKey = async () => {
    try {
      setLoading(true)
      setError('')
      
      const updateRequest = {
        key_name: formData.key_name,
        description: formData.description || undefined,
        permissions: formData.permissions,
        is_active: currentKey.is_active,
        expires_at: formData.expires_at || undefined
      }
      
      await apiKeyService.updateApiKey(currentKey.id, updateRequest)
      showSuccess('API密钥更新成功！')
      
      // 重置表单和状态
      setFormData({
        key_name: '',
        description: '',
        permissions: ['data_upload'],
        expires_at: ''
      })
      setCurrentKey(null)
      setShowEditModal(false)
      
      // 重新加载列表
      loadApiKeys(pagination.page)
    } catch (err) {
      setError('更新API密钥失败：' + (err.response?.data?.detail || err.message))
    } finally {
      setLoading(false)
    }
  }

  // 删除API密钥
  const handleDeleteKey = async () => {
    try {
      setLoading(true)
      setError('')
      
      await apiKeyService.deleteApiKey(currentKey.id)
      showSuccess('API密钥删除成功！')
      
      setCurrentKey(null)
      setShowDeleteModal(false)
      
      // 重新加载列表
      loadApiKeys(pagination.page)
    } catch (err) {
      setError('删除API密钥失败：' + (err.response?.data?.detail || err.message))
    } finally {
      setLoading(false)
    }
  }

  // 切换API密钥状态
  const handleToggleStatus = async (key) => {
    try {
      setLoading(true)
      setError('')
      
      await apiKeyService.updateApiKey(key.id, { is_active: !key.is_active })
      showSuccess(`API密钥已${key.is_active ? '禁用' : '启用'}`)
      
      // 重新加载列表
      loadApiKeys(pagination.page)
    } catch (err) {
      setError('操作失败：' + (err.response?.data?.detail || err.message))
    } finally {
      setLoading(false)
    }
  }

  // 打开编辑对话框
  const openEditModal = (key) => {
    setCurrentKey(key)
    setFormData({
      key_name: key.key_name,
      description: key.description || '',
      permissions: key.permissions,
      expires_at: key.expires_at ? new Date(key.expires_at).toISOString().slice(0, 16) : ''
    })
    setShowEditModal(true)
  }

  // 打开删除对话框
  const openDeleteModal = (key) => {
    setCurrentKey(key)
    setShowDeleteModal(true)
  }

  // 格式化时间
  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('zh-CN')
  }

  // 复制到剪贴板
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      showSuccess('已复制到剪贴板')
    })
  }

  return (
    <div className="key-management">
      {error && <div className="error-message">{error}</div>}

      {loading && <div className="loading">加载中...</div>}

      <div className="key-list">
        {apiKeys.length === 0 ? (
          <div className="empty-state">
            <p>暂无API密钥</p>
            <button onClick={() => setShowCreateModal(true)}>
              创建第一个API密钥
            </button>
          </div>
        ) : (
          <table className="key-table">
            <thead>
              <tr>
                <th>密钥名称</th>
                <th>密钥</th>
                <th>权限</th>
                <th>状态</th>
                <th>使用次数</th>
                <th>最后使用</th>
                <th>过期时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((key) => (
                <tr key={key.id} className={key.is_expired ? 'expired' : ''}>
                  <td>{key.key_name}</td>
                  <td>
                    <code>{key.api_key}</code>
                    <button 
                      className="copy-btn"
                      onClick={() => copyToClipboard(key.api_key)}
                      title="复制密钥"
                    >
                      📋
                    </button>
                  </td>
                  <td>
                    {key.permissions.map(p => (
                      <span key={p} className="permission-tag">{p}</span>
                    ))}
                  </td>
                  <td>
                    <span className={`status-badge ${key.is_active ? 'active' : 'inactive'}`}>
                      {key.is_expired ? '已过期' : (key.is_active ? '激活' : '禁用')}
                    </span>
                  </td>
                  <td>{key.usage_count}</td>
                  <td>{formatDate(key.last_used_at)}</td>
                  <td>{formatDate(key.expires_at)}</td>
                  <td className="actions">
                    <button onClick={() => openEditModal(key)}>编辑</button>
                    <button 
                      onClick={() => handleToggleStatus(key)}
                      className={key.is_active ? 'disable' : 'enable'}
                    >
                      {key.is_active ? '禁用' : '启用'}
                    </button>
                    <button 
                      onClick={() => openDeleteModal(key)}
                      className="delete"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 分页 */}
      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button 
            disabled={pagination.page <= 1}
            onClick={() => loadApiKeys(pagination.page - 1)}
          >
            上一页
          </button>
          <span>
            第 {pagination.page} 页，共 {pagination.totalPages} 页
          </span>
          <button 
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => loadApiKeys(pagination.page + 1)}
          >
            下一页
          </button>
        </div>
      )}

      {/* 创建密钥对话框 */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>创建API密钥</h3>
            <div className="form-group">
              <label>密钥名称 *</label>
              <input
                type="text"
                value={formData.key_name}
                onChange={(e) => setFormData({...formData, key_name: e.target.value})}
                placeholder="例如：农田数据采集设备"
                required
              />
            </div>
            <div className="form-group">
              <label>描述</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="描述此密钥的用途"
                rows={3}
              />
            </div>
            <div className="form-group">
              <label>过期时间</label>
              <input
                type="datetime-local"
                value={formData.expires_at}
                onChange={(e) => setFormData({...formData, expires_at: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>权限</label>
              <div className="permissions">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.permissions.includes('data_upload')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({...formData, permissions: [...formData.permissions, 'data_upload']})
                      } else {
                        setFormData({...formData, permissions: formData.permissions.filter(p => p !== 'data_upload')})
                      }
                    }}
                  />
                  数据上传权限
                </label>
              </div>
            </div>
            <div className="modal-actions">
              <button 
                onClick={handleCreateKey}
                disabled={loading || !formData.key_name}
              >
                创建
              </button>
              <button onClick={() => setShowCreateModal(false)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑密钥对话框 */}
      {showEditModal && currentKey && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>编辑API密钥</h3>
            <div className="form-group">
              <label>密钥名称 *</label>
              <input
                type="text"
                value={formData.key_name}
                onChange={(e) => setFormData({...formData, key_name: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>描述</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows={3}
              />
            </div>
            <div className="form-group">
              <label>过期时间</label>
              <input
                type="datetime-local"
                value={formData.expires_at}
                onChange={(e) => setFormData({...formData, expires_at: e.target.value})}
              />
            </div>
            <div className="modal-actions">
              <button onClick={handleUpdateKey} disabled={loading}>
                更新
              </button>
              <button onClick={() => setShowEditModal(false)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认对话框 */}
      {showDeleteModal && currentKey && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>删除API密钥</h3>
            <p>确定要删除密钥 "<strong>{currentKey.key_name}</strong>" 吗？</p>
            <p className="warning">此操作不可恢复，删除后将无法使用此密钥进行数据上传。</p>
            <div className="modal-actions">
              <button onClick={handleDeleteKey} className="delete" disabled={loading}>
                删除
              </button>
              <button onClick={() => setShowDeleteModal(false)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* 新密钥显示对话框 */}
      {showNewKey && (
        <div className="modal-overlay">
          <div className="modal new-key-modal">
            <h3>API密钥创建成功！</h3>
            <div className="new-key-display">
              <label>请保存您的API密钥：</label>
              <div className="key-value">
                <code>{newApiKey}</code>
                <button 
                  onClick={() => copyToClipboard(newApiKey)}
                  className="copy-btn"
                >
                  📋 复制
                </button>
              </div>
              <p className="warning">⚠️ 请立即复制并妥善保存此密钥，关闭窗口后将无法再次查看完整密钥。</p>
            </div>
            <div className="modal-actions">
              <button onClick={() => {
                setShowNewKey(false)
                setNewApiKey('')
              }}>
                我已保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default KeyManagement