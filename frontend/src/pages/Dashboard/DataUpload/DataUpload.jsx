import { useState, useEffect } from 'react'
import { Upload, Key, FileImage, Thermometer, Droplets, ChevronRight, Check } from 'lucide-react'
import { Button, Select, Input, ImageUpload, PageHeader } from '@/components/ui'
import { collectionSessionService } from '@/services/collectionSessionService'
import { rawDataService } from '@/services/rawDataService'
import apiKeyService from '@/services/apiKeyService'
import { useAuth } from '@/hooks/auth/useAuth'
import useToast from '@/hooks/useToast'
import KeyManagement from '../KeyManagement'
import '../AdditionalStyles.css'
import './DataUpload.css'

// 数据类型配置
const dataTypeConfig = {
  file: {
    icon: FileImage,
    label: '图像/视频',
    color: '#3b82f6',
    subtypes: [
      { value: 'rgb', label: 'RGB图像', unit: '' },
      { value: 'nir', label: '近红外图像', unit: '' },
      { value: 'red_edge', label: '红边图像', unit: '' },
      { value: 'thermal', label: '热成像', unit: '' },
      { value: 'multispectral', label: '多光谱', unit: '' },
      { value: 'video', label: '视频', unit: '' }
    ]
  },
  environmental: {
    icon: Thermometer,
    label: '环境数据',
    color: '#f59e0b',
    subtypes: [
      { value: 'temperature', label: '温度', unit: '°C' },
      { value: 'humidity', label: '湿度', unit: '%' },
      { value: 'co2', label: 'CO₂浓度', unit: 'ppm' },
      { value: 'light', label: '光照强度', unit: 'lux' },
      { value: 'pressure', label: '气压', unit: 'hPa' }
    ]
  },
  soil: {
    icon: Droplets,
    label: '土壤数据',
    color: '#8b5cf6',
    subtypes: [
      { value: 'moisture', label: '土壤湿度', unit: '%' },
      { value: 'ph', label: '酸碱度', unit: 'pH' },
      { value: 'ec', label: '电导率', unit: 'μS/cm' },
      { value: 'temperature_soil', label: '土壤温度', unit: '°C' }
    ]
  }
}

const DataUpload = () => {
  const { user } = useAuth()
  const { success: showSuccessToast } = useToast()

  // 步骤状态
  const [currentStep, setCurrentStep] = useState(1)
  const steps = ['选择会话', '选择数据类型', '上传数据']

  // 数据上传状态
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [selectedDataType, setSelectedDataType] = useState(null)
  const [selectedSubtype, setSelectedSubtype] = useState(null)
  const [formData, setFormData] = useState({})
  const [isUploading, setIsUploading] = useState(false)

  // 视图切换
  const [activeView, setActiveView] = useState('data-upload')

  // 加载会话列表
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const sessionData = await collectionSessionService.getSessions({ limit: 100 })
        const runningSessions = (sessionData || []).filter(session =>
          session.status === 'running' || session.status === 'in_progress'
        )
        setSessions(runningSessions)
      } catch (err) {
        console.error('获取会话列表失败:', err)
      }
    }
    if (user?.id) {
      loadSessions()
    }
  }, [user?.id])

  // 处理会话选择
  const handleSessionSelect = (session) => {
    setSelectedSession(session)
    setSelectedDataType(null)
    setSelectedSubtype(null)
    setFormData({})
    if (session) {
      setCurrentStep(2)
    }
  }

  // 处理数据类型选择
  const handleDataTypeSelect = (type) => {
    setSelectedDataType(type)
    setSelectedSubtype(null)
    setFormData({})
    if (type) {
      setCurrentStep(3)
    }
  }

  // 处理子类型选择
  const handleSubtypeSelect = (subtype) => {
    setSelectedSubtype(subtype)
    setFormData({})
  }

  // 获取当前子类型配置
  const getSubtypeConfig = () => {
    if (!selectedDataType || !selectedSubtype) return null
    const typeConfig = dataTypeConfig[selectedDataType]
    const subtypeConfig = typeConfig?.subtypes?.find(s => s.value === selectedSubtype)
    return subtypeConfig
  }

  // 获取文件大小限制
  const getFileSizeLimit = () => {
    if (selectedSubtype === 'video') return 200
    if (selectedSubtype === 'multispectral') return 100
    return 50
  }

  // 处理文件上传成功
  const handleImageUploadSuccess = () => {
    showSuccessToast('上传成功！数据已成功保存到系统中')
    handleReset()
  }

  // 处理数值提交
  const handleSubmit = async () => {
    if (!selectedSession || !selectedDataType || !selectedSubtype) return
    if (formData.value === '' || formData.value === undefined || formData.value === null) return

    setIsUploading(true)
    try {
      const data = {
        session_id: selectedSession.id,
        data_type: selectedDataType,
        data_subtype: selectedSubtype,
        data_value: formData.value
      }
      await rawDataService.createRawData(data)
      showSuccessToast('上传成功！数据已成功保存到系统中')
      handleReset()
    } catch (error) {
      console.error('上传失败:', error)
      alert('上传失败，请重试')
    } finally {
      setIsUploading(false)
    }
  }

  // 重置表单
  const handleReset = () => {
    setSelectedSession(null)
    setSelectedDataType(null)
    setSelectedSubtype(null)
    setFormData({})
    setCurrentStep(1)
  }

  // 返回上一步
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      if (currentStep === 2) {
        setSelectedDataType(null)
        setSelectedSubtype(null)
      } else if (currentStep === 3) {
        setSelectedSubtype(null)
        setFormData({})
      }
    }
  }

  const subtypeConfig = getSubtypeConfig()
  const isFileType = selectedDataType === 'file' || (selectedDataType && subtypeConfig && !subtypeConfig.unit)

  return (
    <div className="data-upload-page dashboard-data-upload">
      <PageHeader
        icon={Upload}
        title="数据上传"
        description="快速上传采集数据"
      />

      {activeView === 'data-upload' && (
        <div className="upload-container">
          {/* 步骤条 - 放在最上方 */}
          <div className="stepper">
            {steps.map((step, index) => (
              <div
                key={step}
                className={`step ${currentStep > index + 1 ? 'completed' : ''} ${currentStep === index + 1 ? 'active' : ''}`}
              >
                <div className="step-indicator">
                  {currentStep > index + 1 ? <Check size={14} /> : index + 1}
                </div>
                <span className="step-label">{step}</span>
                {index < steps.length - 1 && <ChevronRight size={16} className="step-arrow" />}
              </div>
            ))}
          </div>

          {/* 视图切换标签 */}
          <div className="view-tabs">
            <button
              className={`view-tab ${activeView === 'data-upload' ? 'active' : ''}`}
              onClick={() => setActiveView('data-upload')}
            >
              <Upload size={16} />
              数据上传
            </button>
            <button
              className={`view-tab ${activeView === 'key-management' ? 'active' : ''}`}
              onClick={() => setActiveView('key-management')}
            >
              <Key size={16} />
              密钥管理
            </button>
          </div>

          {/* 步骤1：选择会话 */}
          {currentStep === 1 && (
            <div className="step-content">
              <h3 className="step-title">选择采集会话</h3>
              <p className="step-desc">选择一个进行中的采集会话来上传数据</p>

              {sessions.length === 0 ? (
                <div className="empty-tips">
                  <p>暂无进行中的采集会话</p>
                  <span>请先创建立采会话后再上传数据</span>
                </div>
              ) : (
                <div className="session-grid">
                  {sessions.map(session => (
                    <div
                      key={session.id}
                      className={`session-card ${selectedSession?.id === session.id ? 'selected' : ''}`}
                      onClick={() => handleSessionSelect(session)}
                    >
                      <div className="session-card-header">
                        <span className="session-name">{session.mission_name}</span>
                        <span className="session-badge">进行中</span>
                      </div>
                      <div className="session-card-meta">
                        <span>开始时间: {session.start_time?.split('T')[0] || '未知'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 步骤2：选择数据类型 */}
          {currentStep === 2 && (
            <div className="step-content">
              <button className="back-btn" onClick={handleBack}>
                ← 返回选择会话
              </button>
              <h3 className="step-title">选择数据类型</h3>
              <p className="step-desc">选择您要上传的数据类型</p>

              <div className="data-type-grid">
                {Object.entries(dataTypeConfig).map(([key, config]) => {
                  const IconComponent = config.icon
                  return (
                    <div
                      key={key}
                      className={`data-type-card ${selectedDataType === key ? 'selected' : ''}`}
                      style={{ '--accent-color': config.color }}
                      onClick={() => handleDataTypeSelect(key)}
                    >
                      <div className="data-type-icon">
                        <IconComponent size={28} />
                      </div>
                      <span className="data-type-label">{config.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 步骤3：上传数据 */}
          {currentStep === 3 && (
            <div className="step-content">
              <button className="back-btn" onClick={handleBack}>
                ← 返回数据类型
              </button>
              <h3 className="step-title">
                {dataTypeConfig[selectedDataType]?.label} - {subtypeConfig?.label}
              </h3>

              {/* 子类型选择 */}
              <div className="subtype-chips">
                {dataTypeConfig[selectedDataType]?.subtypes.map(sub => (
                  <button
                    key={sub.value}
                    className={`subtype-chip ${selectedSubtype === sub.value ? 'active' : ''}`}
                    onClick={() => handleSubtypeSelect(sub.value)}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>

              {/* 上传区域 */}
              {selectedSubtype && (
                <div className="upload-area">
                  {isFileType ? (
                    <div className="file-upload-section">
                      <ImageUpload
                        onUploadSuccess={handleImageUploadSuccess}
                        onUploadError={(error) => alert(`上传失败: ${error}`)}
                        maxSizeMB={getFileSizeLimit()}
                        maxFiles={1}
                        uploadOptions={{
                          session_id: selectedSession.id,
                          data_subtype: selectedSubtype
                        }}
                      />
                    </div>
                  ) : (
                    <div className="value-upload-section">
                      <div className="input-group">
                        <label>输入数值</label>
                        <div className="input-with-unit">
                          <Input
                            type="number"
                            value={formData.value || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                            placeholder="请输入数值"
                          />
                          {subtypeConfig?.unit && (
                            <span className="unit-label">{subtypeConfig.unit}</span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={!formData.value || isUploading}
                      >
                        {isUploading ? '上传中...' : '确认上传'}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* 已选信息 */}
              <div className="selected-info">
                <div className="info-item">
                  <span className="info-label">会话</span>
                  <span className="info-value">{selectedSession?.mission_name}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">类型</span>
                  <span className="info-value">{dataTypeConfig[selectedDataType]?.label}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeView === 'key-management' && (
        <KeyManagement />
      )}
    </div>
  )
}

export default DataUpload
