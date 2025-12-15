import { useState, useEffect } from 'react'
import { useAuth } from '../../../hooks/auth/useAuth'
import { fieldService } from '../../../services/fieldService'
import '../Dashboard.css'
import '../AdditionalStyles.css'
import './Fields.css'
import FieldForm from './components/FieldForm'
import FieldDetail from './components/FieldDetail'
import ItemCard from '../../../components/common/ItemCard'

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
          <div className="empty-icon">🌱</div>
          <h3>还没有地块</h3>
          <p>点击右上角的"添加地块"按钮开始管理您的农田</p>
          <div className="empty-state-tips">
            <p>您可以：</p>
            <ul>
              <li>创建多个地块进行精细化管理</li>
              <li>设置作物类型和土壤信息</li>
              <li>跟踪每个地块的面积和位置</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="fields-grid">
          {fields.map(field => (
            <ItemCard
              key={field.id}
              item={field}
              itemType="field"
              isActive={field.is_active}
              onViewDetail={handleViewDetail}
              onEdit={handleEditField}
              onDelete={handleDeleteField}
              getSubtitle={(item) => item.area_m2 ? `${item.area_m2.toFixed(2)} 平方米` : '未知面积'}
              getPrimaryInfo={(item) => [
                { label: '作物', value: item.crop_type || '未设置' },
                { label: '土壤类型', value: item.soil_type || '未设置' }
              ]}
              getSecondaryInfo={(item) => [
                { label: '创建时间', value: new Date(item.created_at).toLocaleString() }
              ]}
            />
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