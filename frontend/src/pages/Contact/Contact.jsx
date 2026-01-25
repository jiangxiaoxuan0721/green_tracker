import { useState } from 'react'
import './Contact.css'
import Navbar from '@/components/Navbar'
import { feedbackService } from '@/services/feedbackService'
import { Button, Input, Textarea, Card } from '@/components/ui'
import { useForm } from '@/hooks/common'

const Contact = () => {
  const { values, errors, handleChange, handleBlur, isValid, resetForm } = useForm(
    {
      name: '',
      email: '',
      subject: '',
      message: ''
    },
    {
      email: {
        required: true,
        requiredMessage: '请输入电子邮件',
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        patternMessage: '请输入有效的电子邮件地址'
      },
      subject: {
        required: true,
        requiredMessage: '请输入消息主题',
        minLength: 2,
        maxLength: 100
      },
      message: {
        required: true,
        requiredMessage: '请输入留言内容',
        minLength: 10,
        maxLength: 500
      }
    }
  )

  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValid) {
      setError('请检查表单填写是否正确')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const feedbackData = {
        name: values.name,
        email: values.email,
        subject: values.subject,
        content: values.message
      }

      console.log('[前端Contact] 提交反馈:', feedbackData)
      await feedbackService.submitFeedback(feedbackData)

      setIsSubmitted(true)
      resetForm()

      setTimeout(() => {
        setIsSubmitted(false)
      }, 3000)
    } catch (err) {
      console.error('[前端Contact] 提交反馈失败:', err)
      setError(err.response?.data?.detail || '提交失败，请稍后再试')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Navbar />
      <div className="contact-container">
        <div className="contact-content">
          <h1>联系我们</h1>
          <p>
            如果您对我们的物联网监控平台有任何问题或建议，请通过下面的表单联系我们。
            我们会尽快回复您的消息。
          </p>

          <Card className="contact-info-card">
            <table className="info-table">
              <tbody>
                <tr>
                  <th>电子邮件</th>
                  <td>3335447591@qq.com</td>
                </tr>
                <tr>
                  <th>电话</th>
                  <td>+86 131-4173-6871</td>
                </tr>
                <tr>
                  <th>地址</th>
                  <td>中国 江苏省 无锡市 滨湖区 蠡湖大道 1800号</td>
                </tr>
              </tbody>
            </table>
          </Card>

          {isSubmitted ? (
            <Card className="form-success">
              <h3>感谢您的留言!</h3>
              <p>我们已收到您的信息，将尽快回复。</p>
            </Card>
          ) : (
            <form className="contact-form" onSubmit={handleSubmit}>
              {error && <div className="form-error">{error}</div>}

              <Input
                label="姓名"
                id="name"
                name="name"
                value={values.name}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="请输入您的姓名"
                error={errors.name}
              />

              <Input
                type="email"
                label="电子邮件"
                id="email"
                name="email"
                value={values.email}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="your@email.com"
                error={errors.email}
                required
              />

              <Input
                type="text"
                label="主题"
                id="subject"
                name="subject"
                value={values.subject}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="请输入消息主题"
                error={errors.subject}
                required
              />

              <Textarea
                label="留言"
                id="message"
                name="message"
                value={values.message}
                onChange={handleChange}
                onBlur={handleBlur}
                rows="5"
                placeholder="请输入您的留言内容..."
                error={errors.message}
                required
              />

              <Button
                type="submit"
                variant="primary"
                size="large"
                loading={isSubmitting}
                disabled={!isValid}
                className="submit-btn"
              >
                {isSubmitting ? '提交中...' : '发送消息'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </>
  )
}

export default Contact