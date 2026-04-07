import { useState, useEffect } from 'react'
import { feedbackService } from '@/services/feedbackService'
import Navbar from '@/components/Navbar'
import './Feedback.css'

const Feedback = () => {
  const [feedbacks, setFeedbacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    const fetchFeedbacks = async () => {
      try {
        const data = await feedbackService.getAllFeedback()
        setFeedbacks(data)
      } catch (err) {
        setError(err.response?.data?.detail || '获取反馈失败，请稍后再试')
      } finally {
        setLoading(false)
      }
    }

    fetchFeedbacks()
  }, [])

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return '昨天'
    } else if (diffDays < 7) {
      return `${diffDays}天前`
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
    }
  }

  const getStatusClass = (status) => {
    switch (status) {
      case 'pending': return 'status-pending'
      case 'reviewed': return 'status-reviewed'
      case 'resolved': return 'status-resolved'
      default: return 'status-pending'
    }
  }

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <>
      <Navbar />
      <div className="feedback-container">
        <div className="feedback-content">
          <div className="feedback-header">
            <h1>用户反馈</h1>
            <span className="feedback-count">{feedbacks.length} 条</span>
          </div>
          
          {loading ? (
            <div className="feedback-loading">加载中...</div>
          ) : error ? (
            <div className="feedback-error">{error}</div>
          ) : feedbacks.length === 0 ? (
            <div className="feedback-empty">
              <span className="empty-icon">📭</span>
              <span>暂无反馈</span>
            </div>
          ) : (
            <div className="feedback-list">
              {feedbacks.map((feedback) => (
                <div 
                  key={feedback.id} 
                  className={`feedback-item ${expandedId === feedback.id ? 'expanded' : ''}`}
                  onClick={() => toggleExpand(feedback.id)}
                >
                  <div className="feedback-item-main">
                    <div className="feedback-item-left">
                      <span className={`status-dot ${getStatusClass(feedback.status)}`}></span>
                      <div className="feedback-item-info">
                        <span className="feedback-name">{feedback.name || '匿名用户'}</span>
                        <span className="feedback-email">{feedback.email}</span>
                      </div>
                    </div>
                    <div className="feedback-item-right">
                      <span className="feedback-subject">{feedback.subject}</span>
                      <span className="feedback-date">{formatDate(feedback.created_at)}</span>
                    </div>
                    <span className={`expand-icon ${expandedId === feedback.id ? 'rotated' : ''}`}>›</span>
                  </div>
                  
                  {expandedId === feedback.id && (
                    <div className="feedback-item-content">
                      {feedback.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default Feedback
