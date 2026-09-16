import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Upload, Download, Play, Star, User, PlayCircle, PauseCircle, RotateCw, Trash2, MoreVertical, Cpu } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '@/hooks/auth/useAuth'
import { env } from '@/config/env'
import { PageHeader } from '@/components/ui'
import { useDeployTasksStore } from '@/store/useDeployTasksStore'
import './AlgorithmSquare.css'
import '../AdditionalStyles.css'

// API 基址：来自唯一出口 config/env.ts（已归一化，不含 /api）
const API_BASE_URL = env.API_BASE_URL

const AlgorithmSquare = () => {
  const navigate = useNavigate()
  const { getAuthHeaders, user } = useAuth()
  const [algorithms, setAlgorithms] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState([])
  const [showUpload, setShowUpload] = useState(false)
  const [showActionsForAlgorithm, setShowActionsForAlgorithm] = useState(null) // 控制哪个算法显示操作菜单

  const submitDeployTask = useDeployTasksStore((s) => s.submit)

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

  // 监听全局点击，用于关闭操作菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showActionsForAlgorithm) {
        // 如果点击的不是菜单按钮或菜单内容，关闭菜单
        if (!event.target.closest('.action-menu-wrapper')) {
          setShowActionsForAlgorithm(null)
        }
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [showActionsForAlgorithm])

  // 下载算法 - 使用 fetch API 直接下载，避免 axios blob 处理问题
  const handleDownload = async (algorithmId) => {
    try {
      // 简单直接的下载方法
      const downloadUrl = `${API_BASE_URL}/api/algorithms/${algorithmId}/download`
      console.log('下载链接:', downloadUrl)
      
      // 方法1：创建一个不可见的a标签进行下载
      const link = document.createElement('a')
      link.href = downloadUrl
      link.setAttribute('download', '') // 告诉浏览器应该下载而不是打开
      link.style.display = 'none'
      document.body.appendChild(link)
      
      // 触发点击
      link.click()
      
      // 清理
      setTimeout(() => {
        if (link.parentNode) {
          document.body.removeChild(link)
        }
      }, 1000)
      
      // 显示提示告诉用户查看哪里
      setTimeout(() => {
        alert('下载已开始！请查看：\n1. 浏览器底部下载栏\n2. 浏览器下载管理器\n3. 如果没反应，请检查浏览器是否阻止了下载')
      }, 500)
      
    } catch (error) {
      console.error('下载失败:', error)
      
      // 提供备用方案
      alert(`下载失败：${error.message || '未知错误'}\n\n您可以手动下载：\n右键复制链接 -> 在新标签页打开\n${API_BASE_URL}/api/algorithms/${algorithmId}/download`)
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

  // 构建部署算法 —— 改为 store.submit；store 在后台订阅 NDJSON 流并实时更新顶部条
  const handleBuild = async (algorithmId, algorithmName) => {
    try {
      await submitDeployTask(algorithmId, algorithmName, getAuthHeaders())
    } catch (e) {
      const msg = e?.message || '提交失败'
      if (msg.includes('正在构建')) {
        console.warn('已有构建任务，请到顶部条查看')
      } else {
        console.error('构建提交失败:', msg)
      }
    }
  }

  // 重新构建 = 同样调 submit（后端幂等：先 stop+remove 再 build）
  const handleRebuild = async (algorithmId, algorithmName) => {
    await handleBuild(algorithmId, algorithmName)
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
      <PageHeader
        icon={Cpu}
        title="算法广场"
        description="浏览和分享智能农业算法，一键部署到您的设备"
        actions={
          <button className="upload-btn" onClick={() => setShowUpload(true)}>
            <Upload size={18} />
            分享算法
          </button>
        }
      />

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
        <div className="dashboard-loading">
          <div className="dashboard-loading-dots">
            <div className="dashboard-loading-dot"></div>
            <div className="dashboard-loading-dot"></div>
            <div className="dashboard-loading-dot"></div>
          </div>
          <div className="dashboard-loading-text">正在加载算法...</div>
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
                {/* 主操作按钮 - 根据状态显示 */}
                <div className="primary-actions">
                  {algo.status === 'running' ? (
                    <button
                      className="action-btn primary"
                      onClick={() => handleUseOnline(algo)}
                    >
                      <Play size={14} />
                      在线使用
                    </button>
                  ) : (algo.status === 'pending' || algo.status === 'error' || algo.status === 'stopped') && user?.id === algo.author_id ? (
                    <button
                      className="action-btn primary"
                      onClick={() => handleBuild(algo.id, algo.name)}
                    >
                      <PlayCircle size={14} />
                      {algo.status === 'stopped' ? '启动' : '提交构建'}
                    </button>
                  ) : algo.status === 'building' && user?.id === algo.author_id ? (
                    <button className="action-btn primary" disabled>
                      <RotateCw size={14} className="spin" />
                      构建中...
                    </button>
                  ) : (
                    <button
                      className="action-btn primary"
                      onClick={() => handleUseOnline(algo)}
                      disabled={algo.status !== 'running'}
                    >
                      <Play size={14} />
                      在线使用
                    </button>
                  )}
                  
                  <button
                    className="action-btn secondary"
                    onClick={() => handleDownload(algo.id)}
                  >
                    <Download size={14} />
                    本地部署
                  </button>
                </div>
                
                {/* 操作菜单按钮 - 仅算法归属用户可见 */}
                {user?.id === algo.author_id && (
                  <div className="action-menu-wrapper">
                    <button
                      className="action-menu-btn"
                      onClick={() => setShowActionsForAlgorithm(showActionsForAlgorithm === algo.id ? null : algo.id)}
                    >
                      <MoreVertical size={16} />
                    </button>
                    
                    {/* 操作菜单下拉 */}
                    {showActionsForAlgorithm === algo.id && (
                      <div className="action-menu-dropdown">
                        {/* 通用操作 */}
                        <button
                          className="menu-item"
                          onClick={() => {
                            handleDownload(algo.id)
                            setShowActionsForAlgorithm(null)
                          }}
                        >
                          <Download size={14} />
                          本地部署
                        </button>
                        
                        {/* 所有者专属操作 */}
                        {user?.id === algo.author_id && (
                          <>
                            {algo.status === 'running' && (
                              <>
                                <button
                                  className="menu-item"
                                  onClick={() => {
                                    handleStop(algo.id)
                                    setShowActionsForAlgorithm(null)
                                  }}
                                >
                                  <PauseCircle size={14} />
                                  停止
                                </button>
                                <button
                                  className="menu-item"
                                  onClick={() => {
                                    handleRebuild(algo.id, algo.name)
                                    setShowActionsForAlgorithm(null)
                                  }}
                                >
                                  <RotateCw size={14} />
                                  重新部署
                                </button>
                              </>
                            )}
                            
                            {algo.status === 'stopped' && (
                              <button
                                className="menu-item"
                                onClick={() => {
                                  handleRestart(algo.id)
                                  setShowActionsForAlgorithm(null)
                                }}
                              >
                                <RotateCw size={14} />
                                启动
                              </button>
                            )}
                            
                            {(algo.status === 'pending' || algo.status === 'error') && (
                              <button
                                className="menu-item"
                                onClick={() => {
                                  handleBuild(algo.id, algo.name)
                                  setShowActionsForAlgorithm(null)
                                }}
                              >
                                <PlayCircle size={14} />
                                提交构建
                              </button>
                            )}
                            
                            <div className="menu-divider" />
                            
                            <button
                              className="menu-item danger"
                              onClick={() => {
                                handleDelete(algo.id, algo.name)
                                setShowActionsForAlgorithm(null)
                              }}
                            >
                              <Trash2 size={14} />
                              删除算法
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
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