import { useCallback } from 'react'
import { useDataList, useModal } from '@/hooks/common'
import { useAuth } from '@/hooks/auth/useAuth'
import { fieldService } from '@/services/fieldService'
import { Button, Card } from '@/components/ui'
import { ItemCard } from '@/components/business'
import FieldForm from './components/FieldForm'
import FieldDetail from './components/FieldDetail'
import './Fields.css'

const Fields = () => {
  const { user } = useAuth()

  const fetchFields = useCallback(async () => {
    if (!user?.id) return []
    return await fieldService.getFields({ owner_id: user?.id })
  }, [user?.id])

  const {
    data: fields,
    loading,
    initialLoading,
    error,
    refresh
  } = useDataList(
    fetchFields,
    {
      autoFetch: true,
      pageSize: 100
    }
  )

  const { isOpen: isFormOpen, modalData: formField, openModal: openForm, closeModal: closeForm } = useModal()
  const { isOpen: isDetailOpen, modalData: detailField, openModal: openDetail, closeModal: closeDetail } = useModal()

  const handleCreate = () => {
    openForm(null)
  }

  const handleEdit = (field) => {
    openForm(field)
  }

  const handleView = (field) => {
    openDetail(field)
  }

  const handleDelete = async (field) => {
    if (!window.confirm('确定要删除这个地块吗？')) {
      return
    }
    try {
      await fieldService.deleteField(field.id)
      refresh()
    } catch (err) {
      console.error('删除地块失败:', err)
    }
  }

  const handleFormSuccess = () => {
    closeForm()
    refresh()
  }

  const handleDetailEdit = (field) => {
    closeDetail()
    openForm(field)
  }

  return (
    <div className="dashboard-fields">
      <div className="dashboard-header">
        <h1>地块管理</h1>
        <Button variant="primary" onClick={handleCreate}>
          添加地块
        </Button>
      </div>

      {initialLoading && (
        <Card className="loading-container">
          <p>正在加载地块数据...</p>
        </Card>
      )}

      {error && (
        <Card className="error-card">
          <p>{error}</p>
          <Button variant="outline" onClick={refresh}>重试</Button>
        </Card>
      )}

      {!initialLoading && !error && fields.length === 0 && (
        <Card className="empty-state">
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
        </Card>
      )}

      {!initialLoading && !error && fields.length > 0 && (
        <div className="fields-grid">
          {fields.map(field => (
            <ItemCard
              key={field.id}
              item={field}
              type="field"
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              customInfo={(item) => (
                <>
                  <div className="item-info-row">
                    <span>面积</span>
                    <span>{item.area_m2 ? `${item.area_m2.toFixed(2)} 平方米` : '未知'}</span>
                  </div>
                  <div className="item-info-row">
                    <span>作物</span>
                    <span>{item.crop_type || '未设置'}</span>
                  </div>
                  <div className="item-info-row">
                    <span>土壤类型</span>
                    <span>{item.soil_type || '未设置'}</span>
                  </div>
                </>
              )}
            />
          ))}
        </div>
      )}

      {isFormOpen && (
        <FieldForm
          isOpen={isFormOpen}
          mode={formField ? 'edit' : 'create'}
          field={formField}
          onClose={closeForm}
          onSuccess={handleFormSuccess}
        />
      )}

      {isDetailOpen && detailField && (
        <FieldDetail
          field={detailField}
          onClose={closeDetail}
          onEdit={() => handleDetailEdit(detailField)}
        />
      )}
    </div>
  )
}

export default Fields