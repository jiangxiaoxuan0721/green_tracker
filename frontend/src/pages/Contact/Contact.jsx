import { useState } from 'react'
import './Contact.css'
import Navbar from '../../components/Navbar'
const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // 这里可以添加表单提交逻辑
    console.log('表单数据:', formData)
    setIsSubmitted(true)
    
    // 模拟提交后重置表单
    setTimeout(() => {
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      })
      setIsSubmitted(false)
    }, 3000)
  }

  return (
    <><Navbar />
    <div className="contact-container">
      <div className="contact-content">
        <h1>联系我们</h1>
        <p>
          如果您对我们的物联网监控平台有任何问题或建议，请通过下面的表单联系我们。
          我们会尽快回复您的消息。
        </p>
        
        <div className="contact-info">
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
        </div>

        {isSubmitted ? (
          <div className="form-success">
            <h3>感谢您的留言！</h3>
            <p>我们已收到您的信息，将尽快回复。</p>
          </div>
        ) : (
          <form className="contact-form" onSubmit={handleSubmit}>
            <div className="form-group">
            <label htmlFor="name">姓名</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="请输入您的姓名"
              required
            />
            </div>
            
            <div className="form-group">
            <label htmlFor="email">电子邮件</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your@email.com"
              required
            />
            </div>
            
            <div className="form-group">
            <label htmlFor="subject">主题</label>
            <input
              type="text"
              id="subject"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              placeholder="请输入消息主题"
              required
            />
            </div>
            
            <div className="form-group">
            <label htmlFor="message">留言</label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              rows="5"
              placeholder="请输入您的留言内容..."
              required
            ></textarea>
            </div>
            
            <button type="submit" className="submit-btn">发送消息</button>
          </form>
        )}
      </div>
    </div></>
  )
}

export default Contact