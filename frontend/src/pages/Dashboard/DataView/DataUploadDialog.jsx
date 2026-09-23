import { useState, useEffect } from 'react'
import { FileImage, Thermometer, Droplets, ChevronRight, Check, ArrowLeft } from 'lucide-react'
import { Modal, Button, Input, ImageUpload } from '@/components/ui'
import { collectionSessionService } from '@/services/collectionSessionService'
import { rawDataService } from '@/services/rawDataService'
import useToast from '@/hooks/useToast'
import { useAuth } from '@/hooks/auth/useAuth'
import './DataUploadDialog.css'

// 数据类型配置
// 参考后端 data_type 定义：image/video/environmental/soil/spectral/multispectral/thermal
// 整合为三大类：文件、环境、土壤
const dataTypeConfig = {
  file: {
    icon: FileImage,
    label: '文件',
    dataTypes: ['image', 'video', 'spectral', 'multispectral'],
    subtypes: [
      { value: 'rgb', label: 'RGB图像', unit: '', dataType: 'image' },
      { value: 'nir', label: '近红外图像', unit: '', dataType: 'image' },
      { value: 'red_edge', label: '红边图像', unit: '', dataType: 'image' },
      { value: 'thermal', label: '热成像图像', unit: '', dataType: 'image' },
      { value: 'multispectral', label: '多光谱图像', unit: '', dataType: 'multispectral' },
      { value: 'video', label: '视频', unit: '', dataType: 'video' }
    ]
  },
  environmental: {
    icon: Thermometer,
    label: '环境',
    dataTypes: ['environmental'],
    subtypes: [
      { value: 'temperature', label: '温度', unit: '°C', dataType: 'environmental' },
      { value: 'humidity', label: '湿度', unit: '%', dataType: 'environmental' },
      { value: 'co2', label: 'CO₂浓度', unit: 'ppm', dataType: 'environmental' },
      { value: 'light', label: '光照强度', unit: 'lux', dataType: 'environmental' },
      { value: 'pressure', label: '气压', unit: 'hPa', dataType: 'environmental' }
    ]
  },
  soil: {
    icon: Droplets,
    label: '土壤',
    dataTypes: ['soil'],
    subtypes: [
      { value: 'moisture', label: '土壤湿度', unit: '%', dataType: 'soil' },
      { value: 'ph', label: '酸碱度', unit: 'pH', dataType: 'soil' },
      { value: 'ec', label: '电导率', unit: 'μS/cm', dataType: 'soil' },
      { value: 'temperature_soil', label: '土壤温度', unit: '°C', dataType: 'soil' }
    ]
  }
}

const STEPS = ['选择会话', '选择数据类型', '上传数据']

const DataUploadDialog = ({ isOpen, onClose, onUploaded }) => {
  const { user } = useAuth()
  const { success: showSuccess, error: showError } = useToast()

  const [currentStep, setCurrentStep] = useState(1)
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [selectedDataType, setSelectedDataType] = useState(null)
  const [selectedSubtype, setSelectedSubtype] = useState(null)
  const [formData, setFormData] = useState({})
  const [isUploading, setIsUploading] = useState(false)

  // 每次打开都回到第一步，避免残留上一次的会话/类型选择
  useEffect(() => {
    if (!isOpen) return
    setCurrentStep(1)
    setSelectedSession(null)
    setSelectedDataType(null)
    setSelectedSubtype(null)
    setFormData({})
    setIsUploading(false)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !user?.id) return

    const loadSessions = async () => {
      try {
        const sessionData = await collectionSessionService.getSessions({ limit: 100 })
        const runningSessions = (sessionData || []).filter(
          session => session.status === 'running' || session.status === 'in_progress'
        )
        setSessions(runningSessions)
      } catch (err) {
        console.error('获取会话列表失败:', err)
      }
    }

    loadSessions()
  }, [isOpen, user?.id])

  const resetToFirstStep = () => {
    setSelectedSession(null)
    setSelectedDataType(null)
    setSelectedSubtype(null)
    setFormData({})
    setCurrentStep(1)
  }

  const handleSessionSelect = (session) => {
    setSelectedSession(session)
    setSelectedDataType(null)
    setSelectedSubtype(null)
    setFormData({})
    if (session) setCurrentStep(2)
  }

  const handleDataTypeSelect = (type) => {
    setSelectedDataType(type)
    setSelectedSubtype(null)
    setFormData({})
    if (type) setCurrentStep(3)
  }

  const handleSubtypeSelect = (subtype) => {
    setSelectedSubtype(subtype)
    setFormData({})
  }

  const handleBack = () => {
    if (currentStep === 2) {
      setSelectedDataType(null)
      setSelectedSubtype(null)
      setCurrentStep(1)
    } else if (currentStep === 3) {
      setSelectedSubtype(null)
      setFormData({})
      setSelectedDataType(null)
      setCurrentStep(2)
    }
  }

  const getSubtypeConfig = () => {
    if (!selectedDataType || !selectedSubtype) return null
    const typeConfig = dataTypeConfig[selectedDataType]
    return typeConfig?.subtypes?.find(s => s.value === selectedSubtype) || null
  }

  const getFileSizeLimit = () => {
    if (selectedSubtype === 'video') return 200
    if (selectedSubtype === 'multispectral') return 100
    return 50
  }

  // 上传完成后回到第一步并通知父级刷新列表，便于连续上传
  const handleUploaded = () => {
    showSuccess('上传成功！数据已保存到系统中')
    resetToFirstStep()
    onUploaded?.()
  }

  const handleFileUploadSuccess = () => {
    handleUploaded()
  }

  const handleSubmit = async () => {
    if (!selectedSession || !selectedDataType || !selectedSubtype) return
    if (formData.value === '' || formData.value === undefined || formData.value === null) return

    setIsUploading(true)
    try {
      const subtypeConfigItem = dataTypeConfig[selectedDataType]?.subtypes?.find(
        s => s.value === selectedSubtype
      )
      const dataType = subtypeConfigItem?.dataType || selectedSubtype

      await rawDataService.createRawData({
        session_id: selectedSession.id,
        data_type: dataType,
        data_subtype: selectedSubtype,
        data_value: formData.value
      })
      handleUploaded()
    } catch (error) {
      console.error('上传失败:', error)
      showError(`上传失败：${error?.message || '请稍后再试'}`)
    } finally {
      setIsUploading(false)
    }
  }

  const subtypeConfig = getSubtypeConfig()
  const isFileType = selectedDataType === 'file' || (selectedDataType && subtypeConfig && !subtypeConfig.unit)
  const canSubmit = Boolean(formData.value) && !isUploading

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="数据上传"
      size="large"
      footer={
        <>
          {currentStep > 1 && (
            <Button variant="ghost" icon={ArrowLeft} onClick={handleBack}>
              上一步
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
        </>
      }
    >
      <div className="du-stepper">
        {STEPS.map((step, index) => (
          <div
            key={step}
            className={`du-step ${currentStep > index + 1 ? 'is-completed' : ''} ${currentStep === index + 1 ? 'is-active' : ''}`}
          >
            <div className="du-step-indicator">
              {currentStep > index + 1 ? <Check size={14} /> : index + 1}
            </div>
            <span className="du-step-label">{step}</span>
            {index < STEPS.length - 1 && <ChevronRight size={16} className="du-step-arrow" />}
          </div>
        ))}
      </div>

      <div className="du-content">
        {currentStep === 1 && (
          <>
            <h4 className="du-title">选择采集会话</h4>
            <p className="du-desc">选择一个进行中的采集会话来上传数据</p>

            {sessions.length === 0 ? (
              <div className="du-empty">
                <p>暂无进行中的采集会话</p>
                <span>请先创建并启动采集会话后再上传数据</span>
              </div>
            ) : (
              <div className="du-session-grid">
                {sessions.map(session => (
                  <div
                    key={session.id}
                    className={`du-session-card ${selectedSession?.id === session.id ? 'is-selected' : ''}`}
                    onClick={() => handleSessionSelect(session)}
                  >
                    <div className="du-session-head">
                      <span className="du-session-name">{session.mission_name}</span>
                      <span className="du-session-badge">进行中</span>
                    </div>
                    <div className="du-session-meta">
                      开始时间：{session.start_time?.split('T')[0] || '未知'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {currentStep === 2 && (
          <>
            <h4 className="du-title">选择数据类型</h4>
            <p className="du-desc">已选择会话：{selectedSession?.mission_name}</p>

            <div className="du-type-grid">
              {Object.entries(dataTypeConfig).map(([key, config]) => {
                const IconComponent = config.icon
                return (
                  <div
                    key={key}
                    className={`du-type-card ${selectedDataType === key ? 'is-selected' : ''}`}
                    onClick={() => handleDataTypeSelect(key)}
                  >
                    <div className="du-type-icon">
                      <IconComponent size={24} />
                    </div>
                    <span className="du-type-label">{config.label}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {currentStep === 3 && (
          <>
            <h4 className="du-title">
              {dataTypeConfig[selectedDataType]?.label} · {subtypeConfig?.label || '选择子类型'}
            </h4>
            <p className="du-desc">已选择会话：{selectedSession?.mission_name}</p>

            <div className="du-chips">
              {dataTypeConfig[selectedDataType]?.subtypes.map(sub => (
                <button
                  key={sub.value}
                  type="button"
                  className={`du-chip ${selectedSubtype === sub.value ? 'is-active' : ''}`}
                  onClick={() => handleSubtypeSelect(sub.value)}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {selectedSubtype && (
              <div className="du-upload-box">
                {isFileType ? (
                  <ImageUpload
                    onUploadSuccess={handleFileUploadSuccess}
                    onUploadError={(error) => showError(`上传失败：${error}`)}
                    maxSizeMB={getFileSizeLimit()}
                    maxFiles={1}
                    uploadOptions={{
                      session_id: selectedSession.id,
                      data_subtype: selectedSubtype,
                      data_type: dataTypeConfig[selectedDataType]?.subtypes?.find(
                        s => s.value === selectedSubtype
                      )?.dataType || 'image'
                    }}
                  />
                ) : (
                  <div className="du-value-row">
                    <div className="du-value-input">
                      <Input
                        type="number"
                        label="输入数值"
                        value={formData.value || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                        placeholder="请输入数值"
                      />
                    </div>
                    {subtypeConfig?.unit && <span className="du-unit">{subtypeConfig.unit}</span>}
                    <Button
                      variant="primary"
                      onClick={handleSubmit}
                      disabled={!canSubmit}
                      loading={isUploading}
                    >
                      确认上传
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

export default DataUploadDialog
