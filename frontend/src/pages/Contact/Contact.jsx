import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Phone, MapPin, Send, CheckCircle, MessageSquare } from 'lucide-react'
import './Contact.css'
import Navbar from '@/components/Navbar'
import { feedbackService } from '@/services/feedbackService'
import { Button, Input, Textarea } from '@/components/ui'
import { useForm } from '@/hooks/common'
import { fadeInUp, listItem, listContainer } from '@/utils/animations'

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
      resetForm()
    } finally {
      setIsSubmitting(false)
    }
  }

  const contactInfo = [
    { icon: Mail, label: '电子邮件', value: '3335447591@qq.com' },
    { icon: Phone, label: '电话', value: '+86 131-4173-6871' },
    { icon: MapPin, label: '地址', value: '中国 江苏省 无锡市 滨湖区 蠡湖大道 1800号' }
  ]

  return (
    <>
      <Navbar />
      <div className="contact-container">
        <div className="contact-background-pattern"></div>
        <motion.div 
          className="contact-content"
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
        >
          <motion.div className="contact-header" variants={fadeInUp}>
            <div className="contact-icon">
              <MessageSquare size={40} />
            </div>
            <h1>联系我们</h1>
            <p>
              如果您对我们的物联网监控平台有任何问题或建议，请通过下面的表单联系我们。
              我们会尽快回复您的消息。
            </p>
          </motion.div>

          <motion.div 
            className="contact-info-card"
            variants={listContainer}
            initial="hidden"
            animate="visible"
          >
            {contactInfo.map((info, index) => {
              const Icon = info.icon
              return (
                <motion.div 
                  key={index}
                  className="info-item"
                  variants={listItem}
                  whileHover={{ x: 5 }}
                >
                  <div className="info-icon-wrapper">
                    <Icon size={20} />
                  </div>
                  <div className="info-text">
                    <span className="info-label">{info.label}</span>
                    <span className="info-value">{info.value}</span>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>

          <AnimatePresence mode="wait">
            {isSubmitted ? (
              <motion.div 
                key="success"
                className="form-success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <div className="success-icon">
                  <CheckCircle size={48} />
                </div>
                <h3>感谢您的留言!</h3>
                <p>我们已收到您的信息，将尽快回复。</p>
              </motion.div>
            ) : (
              <motion.form 
                key="form"
                className="contact-form"
                onSubmit={handleSubmit}
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.2 }}
              >
                <AnimatePresence>
                  {error && (
                    <motion.div 
                      className="form-error"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div variants={fadeInUp} transition={{ delay: 0.1 }}>
                  <Input
                    label="姓名"
                    id="name"
                    name="name"
                    value={values.name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="请输入您的姓名"
                    error={errors.name}
                    icon="👤"
                  />
                </motion.div>

                <motion.div variants={fadeInUp} transition={{ delay: 0.15 }}>
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
                    icon="📧"
                  />
                </motion.div>

                <motion.div variants={fadeInUp} transition={{ delay: 0.2 }}>
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
                    icon="📝"
                  />
                </motion.div>

                <motion.div variants={fadeInUp} transition={{ delay: 0.25 }}>
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
                </motion.div>

                <motion.div 
                  variants={fadeInUp} 
                  transition={{ delay: 0.3 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    type="submit"
                    variant="primary"
                    size="large"
                    loading={isSubmitting}
                    disabled={!isValid}
                    className="submit-btn"
                    icon={isSubmitting ? null : <Send size={18} />}
                  >
                    {isSubmitting ? '提交中...' : '发送消息'}
                  </Button>
                </motion.div>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </>
  )
}

export default Contact