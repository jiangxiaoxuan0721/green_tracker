import { useState, useEffect } from 'react'
import { collectionSessionService } from '@/services/collectionSessionService'
import { fieldService } from '@/services/fieldService'
import useToast from '@/hooks/useToast'
import { FormContainer } from '@/components/business'
import { Input, Select, Textarea, ToastContainer } from '@/components/ui'
import './SessionForm.css'

const SessionForm = ({ mode, session, onClose, onSuccess, isOpen }) => {
  const { toasts, removeToast, error: showError, success: showSuccess } = useToast()
  const [formData, setFormData] = useState({
    mission_name: '',
    field_id: '',
    mission_type: '',
    start_time: '',
    end_time: '',
    description: ''
  })
  const [loading, setLoading] = useState(false)
  const [fields, setFields] = useState([])

  useEffect(() => {
    const fetchFields = async () => {
      try {
        const data = await fieldService.getFields()
        setFields(data)
      } catch (err) {
        console.error('获取农田列表失败:', err)
      }
    }
    fetchFields()

    if (mode === 'edit' && session) {
      const formatDateTimeForInput = (dateTimeStr) => {
        if (!dateTimeStr) return ''
        const date = new Date(dateTimeStr)
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
        return date.toISOString().slice(0, 16)
      }

      setFormData({
        mission_name: session.mission_name || '',
        field_id: session.field_id || '',
        mission_type: session.mission_type || '',
        start_time: formatDateTimeForInput(session.start_time),
        end_time: formatDateTimeForInput(session.end_time),
        description: session.description || ''
      })
    }
  }, [mode, session])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    if (!formData.mission_name.trim()) {
      showError('任务名称不能为空')
      return
    }

    if (!formData.field_id) {
      showError('请选择农田')
      return
    }

    if (!formData.mission_type) {
      showError('请选择任务类型')
      return
    }

    try {
      setLoading(true)

      if (mode === 'create') {
        const submitData = {
          mission_name: formData.mission_name,
          field_id: formData.field_id,
          mission_type: formData.mission_type,
          description: formData.description || undefined
        }

        if (formData.start_time) {
          submitData.start_time = new Date(formData.start_time).toISOString()
        }

        if (formData.end_time) {
          submitData.end_time = new Date(formData.end_time).toISOString()
        }

        await collectionSessionService.createSession(submitData)
        showSuccess('任务创建成功')
      } else {
        const submitData = {
          mission_name: formData.mission_name,
          description: formData.description || undefined
        }

        if (formData.end_time) {
          submitData.end_time = new Date(formData.end_time).toISOString()
        }

        await collectionSessionService.updateSession(session.id, submitData)
        showSuccess('任务更新成功')
      }

      onSuccess()
    } catch (err) {
      showError(err.message || `${mode === 'create' ? '创建' : '更新'}任务失败`)
    } finally {
      setLoading(false)
    }
  }

  const fieldOptions = [
    { value: '', label: '请选择农田' },
    ...fields.map(f => ({ value: f.id, label: f.name }))
  ]

  const missionTypeOptions = [
    { value: '', label: '请选择类型' },
    { value: '巡检', label: '巡检' },
    { value: '定点', label: '定点' },
    { value: '路径', label: '路径' },
    { value: '应急', label: '应急' }
  ]

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <FormContainer
        isOpen={isOpen}
        onClose={onClose}
        title={mode === 'create' ? '创建任务' : '编辑任务'}
        onSubmit={handleSubmit}
        loading={loading}
        size="medium"
        cancelText="取消"
        submitText={mode === 'create' ? '创建' : '更新'}
      >
        <Input
          label="任务名称"
          id="mission_name"
          name="mission_name"
          value={formData.mission_name}
          onChange={handleChange}
          required
        />

      <Select
        label="农田"
        id="field_id"
        name="field_id"
        value={formData.field_id}
        onChange={handleChange}
        options={fieldOptions}
        required
        disabled={mode === 'edit'}
      />

      <Select
        label="任务类型"
        id="mission_type"
        name="mission_type"
        value={formData.mission_type}
        onChange={handleChange}
        options={missionTypeOptions}
        required
        disabled={mode === 'edit'}
      />

      <Input
        label="开始时间"
        id="start_time"
        name="start_time"
        type="datetime-local"
        value={formData.start_time}
        onChange={handleChange}
        disabled={mode === 'edit'}
      />

      <Input
        label="结束时间"
        id="end_time"
        name="end_time"
        type="datetime-local"
        value={formData.end_time}
        onChange={handleChange}
      />

      <Textarea
        label="描述"
        id="description"
        name="description"
        value={formData.description}
        onChange={handleChange}
        rows={3}
        placeholder="任务的详细描述或说明"
      />
    </FormContainer>
    </>
  )
}

export default SessionForm
