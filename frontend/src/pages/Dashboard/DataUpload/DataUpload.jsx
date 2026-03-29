import { useState, useEffect } from 'react'
import { Button, Select, Input, ImageUpload } from '@/components/ui'
import { collectionSessionService } from '@/services/collectionSessionService'
import { rawDataService } from '@/services/rawDataService'
import apiKeyService from '@/services/apiKeyService'
import { useAuth } from '@/hooks/auth/useAuth'
import useToast from '@/hooks/useToast'
import KeyManagement from '../KeyManagement'
import './DataUpload.css'

const DataUpload = () => {
  const [activeView, setActiveView] = useState('data-upload')
  const { user } = useAuth()
  const { success: showSuccessToast } = useToast()

  // 数据上传状态
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState('')
  const [selectedDataType, setSelectedDataType] = useState('')
  const [selectedSubtype, setSelectedSubtype] = useState('')
  const [subtypes, setSubtypes] = useState([])
  const [formData, setFormData] = useState({})
  const [isUploading, setIsUploading] = useState(false)
  
  // 输入模式状态
  const [inputModes, setInputModes] = useState({})
  
  // API密钥相关状态
  const [apiKeys, setApiKeys] = useState([])
  const [loadingApiKeys, setLoadingApiKeys] = useState(false)
  const [showApiKeyCopied, setShowApiKeyCopied] = useState(false)

  // 数据类型配置（与后端 DataType 枚举一致）
  const dataTypes = [
    { value: 'file', label: '文件数据' },
    { value: 'environmental', label: '环境数据' },
    { value: 'soil', label: '土壤数据' }
  ]

  const getSubtypeConfig = (dataType, subtype) => {
    const configs = {
      file: {
        rgb: { hasFile: true, hasValue: false, unit: '', label: 'RGB图像' },
        nir: { hasFile: true, hasValue: false, unit: '', label: '近红外图像' },
        red_edge: { hasFile: true, hasValue: false, unit: '', label: '红边图像' },
        thermal: { hasFile: true, hasValue: false, unit: '', label: '热成像' },
        multispectral: { hasFile: true, hasValue: false, unit: '', label: '多光谱' },
        video: { hasFile: true, hasValue: false, unit: '', label: '视频' }
      },
      environmental: {
        temperature: { hasFile: false, hasValue: true, unit: '°C', label: '温度' },
        humidity: { hasFile: false, hasValue: true, unit: '%', label: '湿度' },
        co2: { hasFile: false, hasValue: true, unit: 'ppm', label: '二氧化碳浓度' },
        light: { hasFile: false, hasValue: true, unit: 'lux', label: '光照强度' },
        pressure: { hasFile: false, hasValue: true, unit: 'hPa', label: '气压' }
      },
      soil: {
        moisture: { hasFile: false, hasValue: true, unit: '%', label: '土壤湿度' },
        ph: { hasFile: false, hasValue: true, unit: '', label: '土壤酸碱度' },
        ec: { hasFile: false, hasValue: true, unit: 'μS/cm', label: '电导率' },
        temperature_soil: { hasFile: false, hasValue: true, unit: '°C', label: '土壤温度' }
      }
    }
    return configs[dataType]?.[subtype] || { hasFile: false, hasValue: true, unit: '', label: '' }
  }

  // 加载会话列表
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const sessionData = await collectionSessionService.getSessions({ limit: 100 })
        // 只显示进行中的会话
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

  // 加载API密钥
  const loadApiKeys = async () => {
    try {
      setLoadingApiKeys(true)
      const response = await apiKeyService.getApiKeys({
        page: 1,
        page_size: 10,
        include_inactive: false // 只获取激活的密钥
      })
      setApiKeys(response.items || [])
    } catch (err) {
      console.error('获取API密钥失败:', err)
    } finally {
      setLoadingApiKeys(false)
    }
  }

  // 根据选择的会话获取关联的地块和设备信息
  useEffect(() => {
    const getSessionDetails = async () => {
      if (!selectedSession) {
        setFormData({})
        setApiKeys([]) // 清空密钥
        return
      }

      try {
        const sessionDetails = await collectionSessionService.getSessionDetails(selectedSession)
        if (sessionDetails) {
          setFormData({
            ...formData,
            sessionInfo: {
              id: sessionDetails.id,
              mission_name: sessionDetails.mission_name,
              field: {
                id: sessionDetails.field_id,
                name: sessionDetails.field_name
              },
              device: sessionDetails.device_id ? {
                id: sessionDetails.device_id,
                name: sessionDetails.device_name,
                device_type: sessionDetails.device_type
              } : null,
              start_time: sessionDetails.start_time
            }
          })
          
          // 加载API密钥
          loadApiKeys()
        }
      } catch (err) {
        console.error('获取会话详情失败:', err)
      }
    }
    
    getSessionDetails()
  }, [selectedSession])

  // 根据数据类型加载子类型
  useEffect(() => {
    if (selectedDataType) {
      const subtypesMap = {
        file: [
          { value: 'rgb', label: 'RGB图像' },
          { value: 'nir', label: '近红外图像' },
          { value: 'red_edge', label: '红边图像' },
          { value: 'thermal', label: '热成像' },
          { value: 'multispectral', label: '多光谱' },
          { value: 'video', label: '视频' }
        ],
        environmental: [
          { value: 'temperature', label: '温度' },
          { value: 'humidity', label: '湿度' },
          { value: 'co2', label: '二氧化碳浓度' },
          { value: 'light', label: '光照强度' },
          { value: 'pressure', label: '气压' }
        ],
        soil: [
          { value: 'moisture', label: '土壤湿度' },
          { value: 'ph', label: '土壤酸碱度' },
          { value: 'ec', label: '电导率' },
          { value: 'temperature_soil', label: '土壤温度' }
        ]
      }
      setSubtypes(subtypesMap[selectedDataType] || [])
      setSelectedSubtype('')
    }
  }, [selectedDataType])

  // 处理数据类型选择
  const handleDataTypeChange = (value) => {
    setSelectedDataType(value)
    setSelectedSubtype('')
    // 不跳转步骤，让用户在当前步骤选择子类型
  }

  // 处理子类型选择
  const handleSubtypeChange = (value) => {
    setSelectedSubtype(value)
    if (!value) {
      setFormData({})
    }
  }

  // 处理会话选择
  const handleSessionChange = (value) => {
    setSelectedSession(value)
    if (!value) {
      // 如果清空选择，重置所有后续状态
      setSelectedDataType('')
      setSelectedSubtype('')
      setFormData({})
    }
  }

  // 处理图片上传成功
  const handleImageUploadSuccess = () => {
    // 文件上传已经由后端创建记录，不再需要重复提交
    showSuccessToast('上传成功！数据已成功保存到系统中')
    // 重置表单
    setSelectedSession('')
    setSelectedDataType('')
    setSelectedSubtype('')
    setFormData({})
  }

  // 提交数据（仅用于数值输入）
  const handleSubmit = async () => {
    if (!selectedSession || !selectedDataType || !selectedSubtype) return
    if (formData.value === '' || formData.value === undefined || formData.value === null) return

    setIsUploading(true)
    try {
      const data = {
        session_id: selectedSession,
        data_type: selectedDataType,
        data_subtype: selectedSubtype,
        data_value: formData.value
        // 单位由后端根据 data_subtype 自动添加，无需前端传递
      }

      await rawDataService.createRawData(data)
      showSuccessToast('上传成功！数据已成功保存到系统中')
      // 重置表单
      setSelectedSession('')
      setSelectedDataType('')
      setSelectedSubtype('')
      setFormData({})
    } catch (error) {
      console.error('上传失败:', error)
      alert('上传失败，请重试')
    } finally {
      setIsUploading(false)
    }
  }

  // 处理数据上传按钮点击
  const handleDataUploadClick = () => {
    setActiveView('data-upload')
  }

  // 处理密钥管理按钮点击
  const handleKeyManagementClick = () => {
    setActiveView('key-management')
  }

  // 复制API密钥到剪贴板
  const handleCopyApiKey = async (apiKey) => {
    try {
      await navigator.clipboard.writeText(apiKey)
      setShowApiKeyCopied(true)
      setTimeout(() => setShowApiKeyCopied(false), 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  return (
    <div className="data-upload-page dashboard-data-upload">
      <div className="dashboard-header">
        <h1>数据上传</h1>
        <div>
          <Button 
            variant="primary" 
            onClick={handleDataUploadClick}
            className={activeView === 'data-upload' ? 'active' : ''}
          >
            数据上传
          </Button>
          <Button 
            variant="primary" 
            onClick={handleKeyManagementClick}
            className={activeView === 'key-management' ? 'active' : ''}
            style={{ marginLeft: 'var(--spacing-sm)' }}
          >
            密钥管理
          </Button>
        </div>
      </div>
      
      <div className="main-content">
        {activeView === 'empty' && (
          <div className="empty-state">
            <h2>欢迎使用数据上传模块</h2>
            <p>请选择上方的数据上传或密钥管理功能</p>
          </div>
        )}
        
        {activeView === 'data-upload' && (
          <div className="data-upload-section">
            <div className="upload-tree">
              {/* 会话选择层 */}
              <div className={`tree-node expanded`}>
                <div className="node-header" onClick={() => {
                  if (selectedSession) {
                    // 如果已选择，则重置后续选择
                    setSelectedDataType('')
                    setSelectedSubtype('')
                    setFormData({})
                  }
                  // 如果没有选择，点击这个节点应该总是展开显示选择器
                }}>
                  <div className="node-content">
                    <span className="node-icon">{selectedSession ? '📂' : '📁'}</span>
                    <span className="node-title">选择会话</span>
                    {selectedSession && (
                      <span className="node-value">
                        {sessions.find(s => s.id === selectedSession)?.mission_name || '未知会话'}
                      </span>
                    )}
                  </div>
                  <span className="expand-icon">{selectedSession ? '▼' : '▶'}</span>
                </div>
                
                {true && (
                  <div className="node-children">
                    <div className="child-item">
                      <Select
                        value={selectedSession}
                        onChange={(e) => handleSessionChange(e.target.value)}
                        placeholder="请选择会话"
                        options={sessions.map(s => ({
                          value: s.id,
                          label: s.mission_name || s.mission_type || '未知会话'
                        }))}
                      />
                    </div>
                    
                    {/* 数据类型选择层 */}
                    {selectedSession && (
                      <div className={`tree-node expanded`}>
                        <div className="node-header" onClick={() => {
                          if (selectedDataType) {
                            setSelectedSubtype('')
                            setFormData({})
                          }
                        }}>
                          <div className="node-content">
                            <span className="node-icon">{selectedDataType ? '📂' : '📁'}</span>
                            <span className="node-title">选择数据类型</span>
                            {selectedDataType && (
                              <span className="node-value">
                                {dataTypes.find(t => t.value === selectedDataType)?.label}
                              </span>
                            )}
                          </div>
                          <span className="expand-icon">{selectedDataType ? '▼' : '▶'}</span>
                        </div>
                        
                        {true && (
                          <div className="node-children">
                            <div className="child-item">
                              <Select
                                value={selectedDataType}
                                onChange={(e) => handleDataTypeChange(e.target.value)}
                                placeholder="请选择数据类型"
                                options={dataTypes}
                              />
                            </div>
                            
                            {/* 子类型选择层 */}
                            {selectedDataType && subtypes.length > 0 && (
                              <div className={`tree-node expanded`}>
                                <div className="node-header" onClick={() => {
                                  if (selectedSubtype) {
                                    setFormData({})
                                  }
                                }}>
                                  <div className="node-content">
                                    <span className="node-icon">{selectedSubtype ? '📂' : '📁'}</span>
                                    <span className="node-title">选择子类型</span>
                                    {selectedSubtype && (
                                      <span className="node-value">
                                        {subtypes.find(s => s.value === selectedSubtype)?.label}
                                      </span>
                                    )}
                                  </div>
                                  <span className="expand-icon">{selectedSubtype ? '▼' : '▶'}</span>
                                </div>
                                
                                {true && (
                                  <div className="node-children">
                                    <div className="child-item">
                                      <Select
                                        value={selectedSubtype}
                                        onChange={(e) => handleSubtypeChange(e.target.value)}
                                        placeholder="请选择子类型"
                                        options={subtypes}
                                      />
                                    </div>
                                    
                                    {/* 数据输入层 */}
                                    {selectedSubtype && (
                                      <div className="tree-node expanded">
                                        <div className="node-header">
                                          <div className="node-content">
                                            <span className="node-icon">📝</span>
                                            <span className="node-title">填写数据</span>
                                          </div>
                                        </div>
                                        
                                        <div className="node-children">
                                          <div className="child-item">
                                            {(() => {
                                              const config = getSubtypeConfig(selectedDataType, selectedSubtype)
                                              const subtypeLabel = subtypes.find(s => s.value === selectedSubtype)?.label
                                              
                                              // 如果同时支持文件和数值输入，显示选项卡
                                              if (config.hasFile && config.hasValue) {
                                                const modeKey = `${selectedDataType}-${selectedSubtype}`
                                                const currentMode = inputModes[modeKey] || (formData.fileData ? 'file' : 'value')
                                                
                                                return (
                                                  <div className="data-input-section">
                                                    <div className="input-mode-tabs">
                                                      <button
                                                        className={`tab-button ${currentMode === 'file' ? 'active' : ''}`}
                                                        onClick={() => setInputModes(prev => ({ ...prev, [modeKey]: 'file' }))}
                                                      >
                                                        文件上传
                                                      </button>
                                                      <button
                                                        className={`tab-button ${currentMode === 'value' ? 'active' : ''}`}
                                                        onClick={() => setInputModes(prev => ({ ...prev, [modeKey]: 'value' }))}
                                                      >
                                                        数值输入
                                                      </button>
                                                    </div>
                                                    
                                                    {currentMode === 'file' && (
                                                      <div>
                                                        <p>上传{subtypeLabel}</p>
                                                        <ImageUpload
                                                          onUploadSuccess={handleImageUploadSuccess}
                                                          onUploadError={(error) => alert(`上传失败: ${error}`)}
                                                          maxSizeMB={50}
                                                          maxFiles={1}
                                                          uploadOptions={{
                                                            session_id: selectedSession,
                                                            data_subtype: selectedSubtype
                                                          }}
                                                        />
                                                      </div>
                                                    )}
                                                    
                                                    {currentMode === 'value' && (
                                                      <div className="value-input-section">
                                                        <div className="input-group">
                                                          <label>{subtypeLabel}</label>
                                                          <div className="input-with-unit">
                                                            <Input
                                                              type="number"
                                                              value={formData.value || ''}
                                                              onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                                                              placeholder="请输入数值"
                                                            />
                                                            {config.unit && (
                                                              <span className="unit-label">{config.unit}</span>
                                                            )}
                                                          </div>
                                                        </div>
                                                        <Button
                                                          variant="primary"
                                                          onClick={handleSubmit}
                                                          disabled={formData.value === '' || formData.value === undefined || formData.value === null || isUploading}
                                                          style={{ marginTop: 'var(--spacing-sm)' }}
                                                        >
                                                          {isUploading ? '上传中...' : '提交数据'}
                                                        </Button>
                                                      </div>
                                                    )}
                                                  </div>
                                                )
                                              }
                                              
                                              // 仅支持文件上传
                                              if (config.hasFile) {
                                                const getFileSizeLimit = () => {
                                                  if (selectedDataType === 'video') return 200
                                                  if (selectedDataType === 'multispectral') return 100
                                                  return 50
                                                }
                                                
                                                return (
                                                  <div>
                                                    <p>上传{subtypeLabel}</p>
                                                    <ImageUpload
                                                      onUploadSuccess={handleImageUploadSuccess}
                                                      onUploadError={(error) => alert(`上传失败: ${error}`)}
                                                      maxSizeMB={getFileSizeLimit()}
                                                      maxFiles={1}
                                                      uploadOptions={{
                                                        session_id: selectedSession,
                                                        data_subtype: selectedSubtype
                                                      }}
                                                    />
                                                  </div>
                                                )
                                              }
                                              
                                              // 仅支持数值输入
                                              if (config.hasValue) {
                                                return (
                                                  <div className="data-input-section">
                                                    <div className="input-group">
                                                      <label>{subtypeLabel}</label>
                                                      <div className="input-with-unit">
                                                        <Input
                                                          type="number"
                                                          value={formData.value || ''}
                                                          onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                                                          placeholder="请输入数值"
                                                        />
                                                        {config.unit && (
                                                          <span className="unit-label">{config.unit}</span>
                                                        )}
                                                      </div>
                                                    </div>
                                                    <Button
                                                      variant="primary"
                                                      onClick={handleSubmit}
                                                      disabled={formData.value === '' || formData.value === undefined || formData.value === null || isUploading}
                                                      style={{ marginTop: 'var(--spacing-sm)' }}
                                                    >
                                                      {isUploading ? '上传中...' : '提交数据'}
                                                    </Button>
                                                  </div>
                                                )
                                              }
                                            })()}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            

          </div>
        )}
        
        {activeView === 'key-management' && (
          <div className="key-management-section">
            <KeyManagement />
          </div>
        )}
      </div>
    </div>
  )
}

export default DataUpload