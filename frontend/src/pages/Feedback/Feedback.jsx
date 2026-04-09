import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Clock, User, Mail, ChevronRight, Inbox } from 'lucide-react'
import { feedbackService } from '@/services/feedbackService'
import Navbar from '@/components/Navbar'
import { fadeInUp, listContainer, listItem } from '@/utils/animations'
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

  const getStatusConfig = (status) => {
    switch (status) {
      case 'pending': return { class: 'status-pending', label: '待处理', color: 'var(--warning-color)' }
      case 'reviewed': return { class: 'status-reviewed', label: '已查看', color: 'var(--info-color)' }
      case 'resolved': return { class: 'status-resolved', label: '已解决', color: 'var(--success-color)' }
      default: return { class: 'status-pending', label: '待处理', color: 'var(--warning-color)' }
    }
  }

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <>
      <Navbar />
      <div className="feedback-container">
        <div className="feedback-background-pattern"></div>
        <motion.div 
          className="feedback-content"
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
        >
          <motion.div className="feedback-header" variants={fadeInUp}>
            <div className="header-icon">
              <MessageSquare size={28} />
            </div>
            <h1>用户反馈</h1>
            <span className="feedback-count">{feedbacks.length} 条</span>
          </motion.div>
          
          {loading ? (
            <motion.div 
              className="feedback-loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="dashboard-loading-dots">
                <div className="dashboard-loading-dot"></div>
                <div className="dashboard-loading-dot"></div>
                <div className="dashboard-loading-dot"></div>
              </div>
              <p className="dashboard-loading-text">正在加载反馈...</p>
            </motion.div>
          ) : error ? (
            <motion.div 
              className="feedback-error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <MessageSquare size={24} />
              <p>{error}</p>
            </motion.div>
          ) : feedbacks.length === 0 ? (
            <motion.div 
              className="feedback-empty"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="empty-icon-wrapper">
                <Inbox size={48} />
              </div>
              <span>暂无反馈</span>
              <p>用户反馈将显示在这里</p>
            </motion.div>
          ) : (
            <motion.div 
              className="feedback-list"
              variants={listContainer}
              initial="hidden"
              animate="visible"
            >
              {feedbacks.map((feedback) => {
                const statusConfig = getStatusConfig(feedback.status)
                const isExpanded = expandedId === feedback.id
                return (
                  <motion.div 
                    key={feedback.id}
                    className={`feedback-item ${isExpanded ? 'expanded' : ''}`}
                    variants={listItem}
                    layout
                  >
                    <div 
                      className="feedback-item-main"
                      onClick={() => toggleExpand(feedback.id)}
                    >
                      <div className="feedback-status-indicator" style={{ background: statusConfig.color }}>
                        {statusConfig.label}
                      </div>
                      
                      <div className="feedback-item-left">
                        <div className="user-avatar">
                          <User size={18} />
                        </div>
                        <div className="feedback-item-info">
                          <span className="feedback-name">{feedback.name || '匿名用户'}</span>
                          <span className="feedback-email">
                            <Mail size={12} /> {feedback.email}
                          </span>
                        </div>
                      </div>
                      
                      <div className="feedback-item-center">
                        <span className="feedback-subject">{feedback.subject}</span>
                      </div>
                      
                      <div className="feedback-item-right">
                        <span className="feedback-date">
                          <Clock size={14} /> {formatDate(feedback.created_at)}
                        </span>
                        <motion.span 
                          className={`expand-icon ${isExpanded ? 'rotated' : ''}`}
                          animate={{ rotate: isExpanded ? 90 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronRight size={20} />
                        </motion.span>
                      </div>
                    </div>
                    
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div 
                          className="feedback-item-content"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="content-divider"></div>
                          <p>{feedback.content}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </motion.div>
      </div>
    </>
  )
}

export default Feedback
