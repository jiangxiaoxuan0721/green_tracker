import { useState, useEffect } from 'react'
import { useAuth } from '../../../hooks/auth/useAuth'
import { fieldService } from '../../../services/fieldService'
import '../Dashboard.css'
import '../AdditionalStyles.css'
import './Fields.css'
import FieldForm from './components/FieldForm'
import FieldDetail from './components/FieldDetail'

const Fields = () => {
  const { user } = useAuth()
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [selectedField, setSelectedField] = useState(null)
  const [formMode, setFormMode] = useState('create')
  const [refreshKey, setRefreshKey] = useState(0)

  // 加载地块数据
  useEffect(() => {
    const fetchFields = async () => {
      try {
        setLoading(true)
        // 获取当前用户的地块
        const fieldsData = await fieldService.getFields({ owner_id: user?.id })
        setFields(fieldsData)
        setError(null)
      } catch (err) {
        setError(err.message || '获取地块数据失败')
        console.error('获取地块数据失败:', err)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchFields()
    }
  }, [user, refreshKey])

  // 处理创建地块
  const handleCreateField = () => {
    setSelectedField(null)
    setFormMode('create')
    setShowForm(true)
  }

  // 处理编辑地块
  const handleEditField = (field) => {
    setSelectedField(field)
    setFormMode('edit')
    setShowForm(true)
  }

  // 处理查看详情
  const handleViewDetail = (field) => {
    setSelectedField(field)
    setShowDetail(true)
  }

  // 处理删除地块
  const handleDeleteField = async (fieldId) => {
    if (!window.confirm('确定要删除这个地块吗？')) {
      return
    }

    try {
      await fieldService.deleteField(fieldId)
      // 刷新列表
      setRefreshKey(prev => prev + 1)
      alert('地块已删除')
    } catch (err) {
      setError(err.message || '删除地块失败')
      console.error('删除地块失败:', err)
    }
  }

  // 处理表单关闭
  const handleFormClose = () => {
    setShowForm(false)
    setSelectedField(null)
  }

  // 处理表单提交成功
  const handleFormSuccess = () => {
    setShowForm(false)
    setSelectedField(null)
    // 刷新列表
    setRefreshKey(prev => prev + 1)
  }

  // 处理详情关闭
  const handleDetailClose = () => {
    setShowDetail(false)
    setSelectedField(null)
  }

  // 渲染加载状态
  if (loading) {
    return (
      <div className="dashboard-fields">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>正在加载地块数据...</p>
        </div>
      </div>
    )
  }

  // 渲染错误状态
  if (error) {
    return (
      <div className="dashboard-fields">
        <div className="error-container">
          <h3>加载失败</h3>
          <p>{error}</p>
          <button className="primary-btn" onClick={() => setRefreshKey(prev => prev + 1)}>
            重试
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-fields">
      <div className="dashboard-header">
        <h1>地块管理</h1>
        <button className="primary-btn" onClick={handleCreateField}>
          添加地块
        </button>
      </div>
      
      {fields.length === 0 ? (
        <div className="empty-state">
          <h3>暂无地块数据</h3>
          <p>点击"添加地块"按钮创建您的第一个地块</p>
          <button className="primary-btn" onClick={handleCreateField}>
            添加地块
          </button>
        </div>
      ) : (
        <div className="fields-grid">
          {fields.map(field => (
            <div key={field.id} className="field-card">
              <div className="field-header">
                <h3>{field.name}</h3>
                <div className={`health-badge ${field.is_active ? 'good' : 'inactive'}`}>
                  {field.is_active ? '活跃' : '非活跃'}
                </div>
              </div>
              
              <div className="field-info">
                <div className="info-item">
                  <span className="info-label">面积</span>
                  <span className="info-value">{field.area_m2 ? `${field.area_m2.toFixed(2)} 平方米` : '未知'}</span>
                </div>
                
                <div className="info-item">
                  <span className="info-label">作物</span>
                  <span className="info-value">{field.crop_type || '未设置'}</span>
                </div>
                
                <div className="info-item">
                  <span className="info-label">土壤类型</span>
                  <span className="info-value">{field.soil_type || '未设置'}</span>
                </div>
                
                <div className="info-item">
                  <span className="info-label">创建时间</span>
                  <span className="info-value">{new Date(field.created_at).toLocaleString()}</span>
                </div>
              </div>
              
              <div className="field-actions">
                <button className="secondary-btn" onClick={() => handleViewDetail(field)}>
                  详情
                </button>
                <button className="secondary-btn" onClick={() => handleEditField(field)}>
                  编辑
                </button>
                <button className="danger-btn" onClick={() => handleDeleteField(field.id)}>
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 地块表单弹窗 */}
      {showForm && (
        <FieldForm
          mode={formMode}
          field={selectedField}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* 地块详情弹窗 */}
      {showDetail && selectedField && (
        <FieldDetail
          field={selectedField}
          onClose={handleDetailClose}
          onEdit={() => {
            setShowDetail(false)
            handleEditField(selectedField)
          }}
        />
      )}
    </div>
  )
}

export default Fields