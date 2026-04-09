import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Upload, Download, Play, Star, User, PlayCircle, PauseCircle, RotateCw, Trash2 } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '@/hooks/auth/useAuth'
import './AlgorithmSquare.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:6130'

const AlgorithmSquare = () => {
  const navigate = useNavigate()
  const { getAuthHeaders, user } = useAuth()
  const [algorithms, setAlgorithms] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState([])
  const [showUpload, setShowUpload] = useState(false)
  const [buildingAlgorithm, setBuildingAlgorithm] = useState(null) // 当前正在构建的算法
  const [buildStatus, setBuildStatus] = useState('') // 构建状态消息

  // 加载算法列表
  const fetchAlgorithms = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (category) params.append('category', category)
      params.append('page', '1')
      params.append('page_size', '20')

      const response = await axios.get(
        `${API_BASE_URL}/api/algorithms?${params}`,
        { headers: getAuthHeaders() }
      )
      setAlgorithms(response.data.items || [])
    } catch (error) {
      console.error('获取算法列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 加载分类
  const fetchCategories = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/algorithms/categories`,
        { headers: getAuthHeaders() }
      )
      setCategories(response.data.categories || [])
    } catch (error) {
      console.error('获取分类失败:', error)
    }
  }

  useEffect(() => {
    fetchAlgorithms()
    fetchCategories()
  }, [search, category])

  // 下载算法 - 使用 axios 与 API 服务保持一致
  const handleDownload = async (algorithmId) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/algorithms/${algorithmId}/download`,
        {
          headers: getAuthHeaders(),
          responseType: 'blob',
          // 自定义验证状态码：只有 2xx 算成功
          validateStatus: (status) => status >= 200 && status < 300
        }
      )
      
      // 解析文件名
      const contentDisposition = response.headers['content-disposition']
      let fileName = 'algorithm.zip'
      if (contentDisposition) {
        // 优先尝试 RFC 5987 格式
        const rfcMatch = contentDisposition.match(/filename\*=(?:utf-8''|UTF-8'')([^;]+)/i)
        if (rfcMatch) {
          fileName = decodeURIComponent(rfcMatch[1])
        } else {
          // 回退到传统格式
          const traditionalMatch = contentDisposition.match(/filename="?([^";]+)"?/i)
          if (traditionalMatch) {
            fileName = traditionalMatch[1]
          }
        }
      }
      
      // 创建下载链接
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('下载失败:', error)
      alert('下载失败: ' + (error.response?.data?.detail || error.message))
    }
  }

  // 在线使用 - 跳转到使用页面
  const handleUseOnline = (algorithm) => {
    if (algorithm.status !== 'running') {
      alert('算法尚未部署，请等待部署完成后再使用')
      return
    }
    navigate(`/dashboard/algorithm-use/${algorithm.id}`)
  }

  // 构建部署算法
  const handleBuild = async (algorithmId, algorithmName) => {
    // 防止重复点击
    if (buildingAlgorithm) {
      alert('已有算法正在构建中，请等待完成')
      return
    }
    
    // 确认构建
    if (!window.confirm(`确定要构建并部署算法「${algorithmName}」吗？\n\n构建过程可能需要几分钟时间。`)) {
      return
    }
    
    setBuildingAlgorithm(algorithmId)
    setBuildStatus('正在构建镜像，请稍候...')
    
    try {
      await axios.post(
        `${API_BASE_URL}/api/algorithms/${algorithmId}/build`,
        {},
        { 
          headers: getAuthHeaders(),
          timeout: 600000  // 10分钟超时（构建可能需要较长时间）
        }
      )
      
      setBuildStatus('构建成功！正在启动服务...')
      
      // 刷新算法状态
      await fetchAlgorithms()
      
      // 找到更新后的算法
      const updatedAlgo = algorithms.find(a => a.id === algorithmId)
      if (updatedAlgo?.status === 'running') {
        setBuildStatus('部署成功！算法已上线运行。')
        setTimeout(() => {
          setBuildingAlgorithm(null)
          setBuildStatus('')
        }, 2000)
      } else if (updatedAlgo?.status === 'error') {
        setBuildStatus('构建失败，请查看日志')
        setTimeout(() => {
          setBuildingAlgorithm(null)
          setBuildStatus('')
        }, 3000)
      } else {
        setBuildStatus('构建完成，状态更新中...')
        setTimeout(() => {
          setBuildingAlgorithm(null)
          setBuildStatus('')
        }, 3000)
      }
    } catch (error) {
      console.error('构建失败:', error)
      // 提取详细错误信息
      let errorMessage = '构建失败'
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error.message) {
        errorMessage = error.message
      } else if (error.response?.status === 500) {
        errorMessage = '服务器内部错误，请查看后端日志'
      }
      setBuildStatus(`构建失败: ${errorMessage}`)
      setTimeout(() => {
        setBuildingAlgorithm(null)
        setBuildStatus('')
      }, 5000)
    }
  }

  // 停止算法
  const handleStop = async (algorithmId) => {
    try {
      await axios.post(
        `${API_BASE_URL}/api/algorithms/${algorithmId}/stop`,
        {},
        { headers: getAuthHeaders() }
      )
      alert('算法已停止')
      fetchAlgorithms()
    } catch (error) {
      console.error('停止失败:', error)
      alert('停止失败: ' + (error.response?.data?.detail || error.message))
    }
  }

  // 重启算法
  const handleRestart = async (algorithmId) => {
    try {
      await axios.post(
        `${API_BASE_URL}/api/algorithms/${algorithmId}/restart`,
        {},
        { headers: getAuthHeaders() }
      )
      alert('算法已重启')
      fetchAlgorithms()
    } catch (error) {
      console.error('重启失败:', error)
      alert('重启失败: ' + (error.response?.data?.detail || error.message))
    }
  }

  // 删除算法
  const handleDelete = async (algorithmId, algorithmName) => {
    // 确认删除
    if (!window.confirm(`确定要删除算法「${algorithmName}」吗？此操作不可恢复。`)) {
      return
    }
    try {
      await axios.delete(
        `${API_BASE_URL}/api/algorithms/${algorithmId}`,
        { headers: getAuthHeaders() }
      )
      alert('算法已删除')
      fetchAlgorithms()
    } catch (error) {
      console.error('删除失败:', error)
      alert('删除失败: ' + (error.response?.data?.detail || error.message))
    }
  }

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="algorithm-square">
      <div className="algorithm-square-header">
        <h1>算法广场</h1>
        <button className="upload-btn" onClick={() => setShowUpload(true)}>
          <Upload size={18} />
          分享算法
        </button>
      </div>

      <div className="search-section">
        <div className="search-input-wrapper">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            placeholder="搜索算法名称、描述..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="category-filter"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">全部分类</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading-state">
          <span>加载中...</span>
        </div>
      ) : algorithms.length === 0 ? (
        <div className="empty-state">
          <Search size={48} />
          <p>暂无算法，快来分享第一个算法吧！</p>
        </div>
      ) : (
        <div className="algorithm-grid">
          {algorithms.map(algo => (
            <div key={algo.id} className="algorithm-card">
              <div className="algorithm-card-header">
                <span className="algorithm-name">{algo.name}</span>
                <span className="algorithm-version">v{algo.version}</span>
              </div>

              <div className="algorithm-status">
                <span className={`algorithm-status-tag ${algo.status}`}>
                  {algo.status === 'running' ? '运行中' : 
                   algo.status === 'pending' ? '待部署' : 
                   algo.status === 'building' ? '构建中' :
                   algo.status === 'error' ? '错误' :
                   algo.status === 'stopped' ? '已停止' : algo.status}
                </span>
              </div>
              
              <p className="algorithm-description">
                {algo.description || '暂无描述'}
              </p>

              <div className="algorithm-meta">
                {algo.category && (
                  <span className="algorithm-category">{algo.category}</span>
                )}
                {algo.framework && (
                  <span className="algorithm-tag">{algo.framework}</span>
                )}
                {algo.tags?.slice(0, 2).map((tag, idx) => (
                  <span key={idx} className="algorithm-tag">{tag}</span>
                ))}
              </div>

              <div className="algorithm-footer">
                <span className="algorithm-author">
                  <User size={14} />
                  {algo.author_name || '未知'}
                </span>
                <div className="algorithm-stats">
                  <span className="stat-item">
                    <Download size={14} />
                    {algo.downloads || 0}
                  </span>
                  {algo.rating && (
                    <span className="stat-item">
                      <Star size={14} />
                      {algo.rating}
                    </span>
                  )}
                </div>
              </div>

              <div className="algorithm-actions">
                {/* 在线使用按钮 - 所有用户可见 */}
                <button
                  className="action-btn primary"
                  onClick={() => handleUseOnline(algo)}
                  disabled={algo.status !== 'running'}
                >
                  <Play size={14} />
                  在线使用
                </button>
                <button
                  className="action-btn secondary"
                  onClick={() => handleDownload(algo.id)}
                >
                  <Download size={14} />
                  本地部署
                </button>
                
                {/* 以下按钮仅算法所有者可见 */}
                {user?.id === algo.author_id && (
                  <>
                    {algo.status === 'running' ? (
                      <button
                        className="action-btn warning"
                        onClick={() => handleStop(algo.id)}
                      >
                        <PauseCircle size={14} />
                        停止
                      </button>
                    ) : algo.status === 'pending' || algo.status === 'error' ? (
                      <button
                        className="action-btn primary"
                        onClick={() => handleBuild(algo.id, algo.name)}
                        disabled={buildingAlgorithm !== null}
                      >
                        <PlayCircle size={14} />
                        {buildingAlgorithm === algo.id ? '构建中...' : '构建部署'}
                      </button>
                    ) : algo.status === 'building' ? (
                      <button className="action-btn" disabled>
                        <RotateCw size={14} className="spin" />
                        构建中...
                      </button>
                    ) : algo.status === 'stopped' ? (
                      <button
                        className="action-btn primary"
                        onClick={() => handleRestart(algo.id)}
                      >
                        <RotateCw size={14} />
                        启动
                      </button>
                    ) : null}
                    
                    {/* 删除按钮 - 仅所有者可见 */}
                    <button
                      className="action-btn danger"
                      onClick={() => handleDelete(algo.id, algo.name)}
                      title="删除算法"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 上传弹窗 */}
      {showUpload && (
        <AlgorithmUploadModal 
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false)
            fetchAlgorithms()
          }}
        />
      )}

      {/* 构建状态提示 */}
      {buildingAlgorithm && (
        <div className="modal-overlay">
          <div className="modal-content build-status-modal">
            <div className="build-status-icon">
              <RotateCw size={48} className="spin" />
            </div>
            <h3>正在构建算法</h3>
            <p className="build-status-message">{buildStatus}</p>
            <p className="build-status-hint">构建过程可能需要几分钟，请勿关闭页面</p>
          </div>
        </div>
      )}
    </div>
  )
}

// 上传弹窗组件
const AlgorithmUploadModal = ({ onClose, onSuccess }) => {
  const { getAuthHeaders } = useAuth()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    tags: '',
    version: '1.0.0',
    framework: 'pytorch',
    input_type: 'image',
    output_type: 'json'
  })
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) {
      alert('请选择算法文件')
      return
    }

    try {
      setUploading(true)
      const data = new FormData()
      data.append('file', file)
      data.append('name', formData.name)
      data.append('description', formData.description)
      data.append('category', formData.category)
      data.append('tags', JSON.stringify(formData.tags.split(',').map(t => t.trim()).filter(Boolean)))
      data.append('version', formData.version)
      data.append('framework', formData.framework)
      data.append('input_type', formData.input_type)
      data.append('output_type', formData.output_type)

      await axios.post(
        `${API_BASE_URL}/api/algorithms/upload`,
        data,
        {
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'multipart/form-data'
          }
        }
      )
      alert('上传成功！算法正在构建中...')
      onSuccess()
    } catch (error) {
      console.error('上传失败:', error)
      alert('上传失败: ' + (error.response?.data?.detail || error.message))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>分享算法</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>算法名称 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <label>描述</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              rows={3}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>分类</label>
              <select
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
              >
                <option value="">选择分类</option>
                <option value="目标检测">目标检测</option>
                <option value="图像分类">图像分类</option>
                <option value="语义分割">语义分割</option>
                <option value="目标追踪">目标追踪</option>
                <option value="其他">其他</option>
              </select>
            </div>
            <div className="form-group">
              <label>版本</label>
              <input
                type="text"
                value={formData.version}
                onChange={e => setFormData({...formData, version: e.target.value})}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>框架</label>
              <select
                value={formData.framework}
                onChange={e => setFormData({...formData, framework: e.target.value})}
              >
                <option value="pytorch">PyTorch</option>
                <option value="tensorflow">TensorFlow</option>
                <option value="onnx">ONNX</option>
                <option value="opencv">OpenCV</option>
              </select>
            </div>
            <div className="form-group">
              <label>标签（逗号分隔）</label>
              <input
                type="text"
                value={formData.tags}
                onChange={e => setFormData({...formData, tags: e.target.value})}
                placeholder="水稻,病害,YOLO"
              />
            </div>
          </div>
          <div className="form-group">
            <label>算法文件 * (.zip)</label>
            <input
              type="file"
              accept=".zip"
              onChange={e => setFile(e.target.files[0])}
              required
            />
            <small>请上传包含 algorithm.yaml 的 ZIP 包</small>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="btn-submit" disabled={uploading}>
              {uploading ? '上传中...' : '上传'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AlgorithmSquare