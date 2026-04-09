import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Upload, ArrowLeft, Image as ImageIcon, Loader } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '@/hooks/auth/useAuth'
import './AlgorithmUse.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:6130'

const AlgorithmUse = () => {
  const { algorithmId } = useParams()
  const navigate = useNavigate()
  const { getAuthHeaders } = useAuth()
  
  const [algorithm, setAlgorithm] = useState(null)
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)

  // 加载算法详情
  useEffect(() => {
    const fetchAlgorithm = async () => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/algorithms/${algorithmId}`,
          { headers: getAuthHeaders() }
        )
        setAlgorithm(response.data)
      } catch (err) {
        setError('获取算法信息失败')
      }
    }
    fetchAlgorithm()
  }, [algorithmId])

  // 处理文件选择
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  // 处理拖拽
  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      processFile(file)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = () => {
    setDragging(false)
  }

  // 处理文件
  const processFile = (file) => {
    setImage(file)
    setResult(null)
    setError(null)
    
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target.result)
    }
    reader.readAsDataURL(file)
  }

  // 提交预测
  const handlePredict = async () => {
    if (!image) return
    
    try {
      setLoading(true)
      setError(null)
      setResult(null)
      
      const formData = new FormData()
      formData.append('file', image)
      
      const response = await axios.post(
        `${API_BASE_URL}/api/algorithms/${algorithmId}/predict`,
        formData,
        {
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'multipart/form-data'
          },
          timeout: 60000
        }
      )
      
      setResult(response.data)
    } catch (err) {
      const message = err.response?.data?.detail || err.message || '预测失败'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  // 格式化JSON
  const formatResult = () => {
    if (!result?.result) return ''
    try {
      if (typeof result.result === 'string') {
        return result.result
      }
      return JSON.stringify(result.result, null, 2)
    } catch {
      return String(result.result)
    }
  }

  if (!algorithm) {
    return (
      <div className="algorithm-use">
        <div className="loading-state">加载中...</div>
      </div>
    )
  }

  return (
    <div className="algorithm-use">
      <button className="back-btn" onClick={() => navigate('/dashboard/algorithm-square')}>
        <ArrowLeft size={16} />
        返回算法广场
      </button>

      <div className="algorithm-use-header">
        <h1>{algorithm.name}</h1>
        <div className="algorithm-info">
          <span>版本: {algorithm.version}</span>
          <span className={`status ${algorithm.status}`}>
            {algorithm.status === 'running' ? '运行中' : algorithm.status}
          </span>
          {algorithm.category && <span>{algorithm.category}</span>}
        </div>
      </div>

      {/* 上传区域 */}
      <div 
        className={`upload-area ${dragging ? 'dragging' : ''} ${imagePreview ? 'has-image' : ''}`}
        onClick={() => document.getElementById('file-input').click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {imagePreview ? (
          <img src={imagePreview} alt="Preview" className="preview-image" />
        ) : (
          <>
            <Upload className="upload-icon" size={40} />
            <p>点击或拖拽上传图片</p>
            <p style={{ fontSize: '12px', color: '#9ca3af' }}>
              支持 JPG、PNG 格式，最大 10MB
            </p>
          </>
        )}
        <input
          id="file-input"
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {/* 预测按钮 */}
      <button 
        className="predict-btn"
        onClick={handlePredict}
        disabled={!image || loading || algorithm.status !== 'running'}
      >
        {loading ? (
          <>
            <Loader size={18} className="spin" />
            推理中...
          </>
        ) : (
          '开始推理'
        )}
      </button>

      {algorithm.status !== 'running' && (
        <div className="error-message">
          当前算法未部署，无法使用在线推理功能
        </div>
      )}

      {error && (
        <div className="error-message">{error}</div>
      )}

      {result && (
        <div className="result-area">
          <div className="result-header">
            <h3>推理结果</h3>
            <span className="result-time">
              {new Date().toLocaleString()}
            </span>
          </div>
          <div className="result-content">
            {formatResult()}
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="dashboard-loading">
            <div className="dashboard-loading-dots">
              <div className="dashboard-loading-dot"></div>
              <div className="dashboard-loading-dot"></div>
              <div className="dashboard-loading-dot"></div>
            </div>
            <div className="dashboard-loading-text">正在处理...</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AlgorithmUse