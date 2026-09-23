import { useState, useEffect, useMemo } from 'react'
import {
  KeyRound, Plus, RefreshCw, Copy, Check, Pencil, Trash2, Power, PowerOff, ShieldAlert
} from 'lucide-react'
import { Button, PageHeader, Modal, Input, Textarea } from '@/components/ui'
import { DataTable, StatsBar, FilterPanel, FilterInput } from '@/components/business'
import apiKeyService from '@/services/apiKeyService'
import useToast from '@/hooks/useToast'
import './KeyManagement.css'

const PAGE_SIZE = 20

const PERMISSION_OPTIONS = [
  { value: 'data_upload', label: '数据上传' },
  { value: 'data_read', label: '数据读取' },
  { value: 'device_control', label: '设备控制' }
]

const PERMISSION_LABELS = PERMISSION_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label
  return acc
}, {})

const EMPTY_FORM = {
  key_name: '',
  description: '',
  permissions: ['data_upload'],
  expires_at: ''
}

const KeyManagement = () => {
  const { success: showSuccess, error: showError } = useToast()

  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    totalCount: 0,
    totalPages: 1
  })

  const [keyword, setKeyword] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  // 同一个弹窗槽位：'create' | 'edit' | 'delete' | 'created'
  const [dialog, setDialog] = useState(null)
  const [currentKey, setCurrentKey] = useState(null)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [newApiKey, setNewApiKey] = useState('')

  const loadKeys = async (page = 1) => {
    try {
      setLoading(true)
      const response = await apiKeyService.getApiKeys({
        page,
        page_size: PAGE_SIZE,
        include_inactive: true
      })
      setKeys(response?.items || [])
      const pageInfo = response?.pagination
      setPagination({
        page: pageInfo?.page || page,
        pageSize: pageInfo?.page_size || PAGE_SIZE,
        totalCount: pageInfo?.total_count || 0,
        totalPages: pageInfo?.total_pages || 1
      })
    } catch (err) {
      showError(err?.message || '加载API密钥失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadKeys(1)
  }, [])

  // 后端暂无名称检索参数，这里在当前页数据上做筛选
  const filteredKeys = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return keys
    return keys.filter((key) => (key.key_name || '').toLowerCase().includes(kw))
  }, [keys, keyword])

  // 启用/禁用/过期为当前页口径（密钥数量通常远小于页大小）
  const stats = useMemo(() => {
    const active = keys.filter(k => k.is_active && !k.is_expired).length
    const disabled = keys.filter(k => !k.is_active).length
    const expired = keys.filter(k => k.is_expired).length
    return [
      { key: 'total', label: '密钥总数', value: pagination.totalCount, icon: KeyRound },
      { key: 'active', label: '启用中', value: active, icon: Power, tone: 'success' },
      { key: 'disabled', label: '已禁用', value: disabled, icon: PowerOff, tone: 'warning' },
      { key: 'expired', label: '已过期', value: expired, icon: ShieldAlert, tone: 'danger' }
    ]
  }, [keys, pagination.totalCount])

  const closeDialog = () => {
    setDialog(null)
    setCurrentKey(null)
    setFormData(EMPTY_FORM)
  }

  const openCreateDialog = () => {
    setFormData(EMPTY_FORM)
    setDialog('create')
  }

  const openEditDialog = (key) => {
    setCurrentKey(key)
    setFormData({
      key_name: key.key_name || '',
      description: key.description || '',
      permissions: key.permissions || ['data_upload'],
      expires_at: key.expires_at ? new Date(key.expires_at).toISOString().slice(0, 16) : ''
    })
    setDialog('edit')
  }

  const openDeleteDialog = (key) => {
    setCurrentKey(key)
    setDialog('delete')
  }

  const togglePermission = (value) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(value)
        ? prev.permissions.filter(p => p !== value)
        : [...prev.permissions, value]
    }))
  }

  const handleCreateKey = async () => {
    if (!formData.key_name.trim() || formData.permissions.length === 0) return

    setSubmitting(true)
    try {
      const response = await apiKeyService.createApiKey({
        key_name: formData.key_name.trim(),
        description: formData.description || undefined,
        permissions: formData.permissions,
        expires_at: formData.expires_at || undefined
      })
      setNewApiKey(response?.api_key || '')
      setDialog('created')
      setFormData(EMPTY_FORM)
      showSuccess('API密钥创建成功，请立即保存密钥')
      loadKeys(1)
    } catch (err) {
      showError(err?.message || '创建API密钥失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateKey = async () => {
    if (!currentKey || !formData.key_name.trim()) return

    setSubmitting(true)
    try {
      await apiKeyService.updateApiKey(currentKey.id, {
        key_name: formData.key_name.trim(),
        description: formData.description || undefined,
        permissions: formData.permissions,
        is_active: currentKey.is_active,
        expires_at: formData.expires_at || undefined
      })
      showSuccess('API密钥更新成功')
      closeDialog()
      loadKeys(pagination.page)
    } catch (err) {
      showError(err?.message || '更新API密钥失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteKey = async () => {
    if (!currentKey) return

    setSubmitting(true)
    try {
      await apiKeyService.deleteApiKey(currentKey.id)
      showSuccess('API密钥已删除')
      closeDialog()
      // 删掉当前页最后一条时回退一页，避免停在一个空页上
      const isLastItemOnPage = filteredKeys.length === 1 && pagination.page > 1
      loadKeys(isLastItemOnPage ? pagination.page - 1 : pagination.page)
    } catch (err) {
      showError(err?.message || '删除API密钥失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleStatus = async (key) => {
    setSubmitting(true)
    try {
      await apiKeyService.updateApiKey(key.id, { is_active: !key.is_active })
      showSuccess(`API密钥已${key.is_active ? '禁用' : '启用'}`)
      loadKeys(pagination.page)
    } catch (err) {
      showError(err?.message || '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const copyToClipboard = async (text, keyId) => {
    if (!text) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopiedId(keyId)
      showSuccess('已复制完整密钥到剪贴板')
      setTimeout(() => {
        setCopiedId(prev => (prev === keyId ? null : prev))
      }, 1500)
    } catch (err) {
      console.error('复制失败:', err)
      showError('复制失败，请手动选择文本复制')
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('zh-CN')
  }

  const maskKey = (value) => {
    if (!value) return '-'
    if (value.length <= 20) return value
    return `${value.substring(0, 8)}****${value.substring(value.length - 4)}`
  }

  const columns = [
    {
      title: '密钥名称',
      dataIndex: 'key_name',
      render: (value, row) => (
        <div className="km-name">
          <span className="km-name-text">{value}</span>
          {row.description && <span className="km-name-desc">{row.description}</span>}
        </div>
      )
    },
    {
      title: '密钥',
      dataIndex: 'api_key',
      render: (value, row) => (
        <div className="km-key">
          <code>{maskKey(value)}</code>
          <button
            type="button"
            className="km-icon-btn"
            title="复制完整密钥"
            aria-label="复制完整密钥"
            onClick={() => copyToClipboard(value, row.id)}
          >
            {copiedId === row.id ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      )
    },
    {
      title: '权限',
      dataIndex: 'permissions',
      render: (permissions) => {
        const list = permissions || []
        if (list.length === 0) return <span className="km-muted">-</span>
        return (
          <div className="km-tags">
            {list.map(p => (
              <span className="km-tag" key={p}>{PERMISSION_LABELS[p] || p}</span>
            ))}
          </div>
        )
      }
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      render: (_, row) => {
        if (row.is_expired) return <span className="km-badge is-expired">已过期</span>
        return row.is_active
          ? <span className="km-badge is-active">启用中</span>
          : <span className="km-badge is-disabled">已禁用</span>
      }
    },
    {
      title: '使用次数',
      dataIndex: 'usage_count',
      render: (value) => value ?? 0
    },
    {
      title: '最后使用',
      dataIndex: 'last_used_at',
      render: (value) => formatDate(value)
    },
    {
      title: '过期时间',
      dataIndex: 'expires_at',
      render: (value) => formatDate(value)
    },
    {
      title: '操作',
      dataIndex: 'id',
      render: (_, row) => (
        <div className="km-actions">
          <button
            type="button"
            className="km-icon-btn"
            title="编辑"
            aria-label="编辑"
            disabled={submitting}
            onClick={() => openEditDialog(row)}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            className="km-icon-btn"
            title={row.is_active ? '禁用' : '启用'}
            aria-label={row.is_active ? '禁用' : '启用'}
            disabled={submitting}
            onClick={() => handleToggleStatus(row)}
          >
            {row.is_active ? <PowerOff size={14} /> : <Power size={14} />}
          </button>
          <button
            type="button"
            className="km-icon-btn is-danger"
            title="删除"
            aria-label="删除"
            disabled={submitting}
            onClick={() => openDeleteDialog(row)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ]

  return (
    <div className="km-page">
      <PageHeader
        icon={KeyRound}
        title="密钥管理"
        description="创建与管理 API 密钥，用于设备直传数据的身份鉴权"
        actions={
          <div className="km-header-actions">
            <Button
              variant="outline"
              icon={RefreshCw}
              loading={loading}
              onClick={() => loadKeys(pagination.page)}
            >
              刷新
            </Button>
            <Button variant="primary" icon={Plus} onClick={openCreateDialog}>
              新建密钥
            </Button>
          </div>
        }
      />

      <StatsBar
        items={stats}
        loading={loading}
        extra={<span className="km-stats-hint">启用/过期为当前页口径</span>}
      />

      <FilterPanel onReset={() => setKeyword('')}>
        <FilterInput
          label="搜索"
          name="keyword"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="按密钥名称筛选（当前页）"
        />
      </FilterPanel>

      <DataTable
        columns={columns}
        data={filteredKeys}
        loading={loading}
        emptyMessage={keyword ? '没有匹配的密钥' : '暂无API密钥，点击「新建密钥」创建'}
        pagination={{
          total: pagination.totalCount,
          currentPage: pagination.page,
          pageSize: pagination.pageSize,
          onPageChange: (page) => loadKeys(page)
        }}
        rowKey="id"
      />

      {/* 新建 / 编辑密钥 */}
      <Modal
        isOpen={dialog === 'create' || dialog === 'edit'}
        onClose={closeDialog}
        title={dialog === 'edit' ? '编辑 API 密钥' : '新建 API 密钥'}
        footer={
          <>
            <Button variant="ghost" onClick={closeDialog}>取消</Button>
            <Button
              variant="primary"
              loading={submitting}
              disabled={!formData.key_name.trim() || formData.permissions.length === 0}
              onClick={dialog === 'edit' ? handleUpdateKey : handleCreateKey}
            >
              {dialog === 'edit' ? '保存' : '创建'}
            </Button>
          </>
        }
      >
        <div className="km-form">
          <Input
            label="密钥名称"
            name="key_name"
            required
            value={formData.key_name}
            onChange={(e) => setFormData(prev => ({ ...prev, key_name: e.target.value }))}
            placeholder="例如：农田数据采集设备"
          />
          <Textarea
            label="描述"
            name="description"
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="描述此密钥的用途"
          />
          <Input
            type="datetime-local"
            label="过期时间"
            name="expires_at"
            value={formData.expires_at}
            onChange={(e) => setFormData(prev => ({ ...prev, expires_at: e.target.value }))}
          />
          <div className="km-field">
            <span className="km-field-label">权限</span>
            <div className="km-check-list">
              {PERMISSION_OPTIONS.map(option => (
                <label className="km-check" key={option.value}>
                  <input
                    type="checkbox"
                    checked={formData.permissions.includes(option.value)}
                    onChange={() => togglePermission(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            {formData.permissions.length === 0 && (
              <span className="km-field-error">至少选择一项权限</span>
            )}
          </div>
        </div>
      </Modal>

      {/* 删除确认 */}
      <Modal
        isOpen={dialog === 'delete'}
        onClose={closeDialog}
        title="删除 API 密钥"
        size="small"
        footer={
          <>
            <Button variant="ghost" onClick={closeDialog}>取消</Button>
            <Button variant="danger" loading={submitting} onClick={handleDeleteKey}>
              删除
            </Button>
          </>
        }
      >
        <p className="km-dialog-text">
          确定要删除密钥 <strong>{currentKey?.key_name}</strong> 吗？
        </p>
        <p className="km-warning">此操作不可恢复，删除后使用该密钥的设备将无法继续上传数据。</p>
      </Modal>

      {/* 创建成功展示完整密钥 —— 关闭后不再可查看 */}
      <Modal
        isOpen={dialog === 'created'}
        onClose={() => { setDialog(null); setNewApiKey('') }}
        closeOnOverlayClick={false}
        closeOnEscape={false}
        title="API 密钥创建成功"
        footer={
          <Button variant="primary" onClick={() => { setDialog(null); setNewApiKey('') }}>
            我已保存
          </Button>
        }
      >
        <div className="km-newkey">
          <span className="km-field-label">请立即保存您的 API 密钥</span>
          <div className="km-newkey-value">
            <code>{newApiKey}</code>
            <Button
              size="small"
              variant="outline"
              icon={copiedId === 'new' ? Check : Copy}
              onClick={() => copyToClipboard(newApiKey, 'new')}
            >
              {copiedId === 'new' ? '已复制' : '复制'}
            </Button>
          </div>
          <p className="km-warning">关闭本窗口后将无法再次查看完整密钥。</p>
        </div>
      </Modal>
    </div>
  )
}

export default KeyManagement
