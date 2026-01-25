import { useState, useEffect } from 'react'
import { feedbackService } from '@/services/feedbackService'
import Navbar from '@/components/Navbar'
import { Card, Badge } from '@/components/ui'
import './Feedback.css'

const Feedback = () => {
  const [feedbacks, setFeedbacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <>
      <Navbar />
      <div className="feedback-container">
        <div className="feedback-content">
          <h1>用户反馈</h1>
          
          {loading ? (
            <Card className="feedback-loading">加载中...</Card>
          ) : error ? (
            <Card className="feedback-error">{error}</Card>
          ) : (
            <>
              {feedbacks.length === 0 ? (
                <Card className="feedback-empty">暂无反馈</Card>
              ) : (
                <div className="feedback-list">
                  {feedbacks.map((feedback) => (
                    <Card key={feedback.id} className="feedback-item-card">
                      <div className="feedback-header">
                        <div className="feedback-subject">{feedback.subject}</div>
                        <Badge variant="info" className="feedback-date-badge">
                          {formatDate(feedback.created_at)}
                        </Badge>
                      </div>
                      <div className="feedback-info">
                        {feedback.name && <div className="feedback-name">姓名: {feedback.name}</div>}
                        {feedback.email && <div className="feedback-email">邮箱: {feedback.email}</div>}
                      </div>
                      <div className="feedback-content">{feedback.content}</div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default Feedback