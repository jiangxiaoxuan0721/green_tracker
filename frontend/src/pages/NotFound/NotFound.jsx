import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import './NotFound.css'

const NotFound = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  // 计算宇航员应该轻微跟随鼠标的偏移量
  const calculateFollowOffset = () => {
    // 获取宇航员容器的中心位置
    const astronautContainer = document.querySelector('.astronaut-container')
    if (!astronautContainer) return { x: 0, y: 0 }

    const rect = astronautContainer.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    // 计算鼠标相对于容器中心的位置
    const deltaX = mousePosition.x - centerX
    const deltaY = mousePosition.y - centerY
    
    // 计算距离，用于限制跟随范围
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    const maxDistance = 150 // 最大影响范围
    const maxOffset = 15 // 最大偏移像素
    
    // 根据距离计算偏移量，距离越近偏移越大
    let influence = 1 - Math.min(distance / maxDistance, 1)
    
    // 应用缓动效果，使跟随更加平滑
    influence = Math.pow(influence, 0.5) // 使用平方根使变化更加平缓
    
    // 计算最终偏移量，并限制最大偏移
    const offsetX = Math.max(-maxOffset, Math.min(maxOffset, deltaX * influence * 0.15))
    const offsetY = Math.max(-maxOffset, Math.min(maxOffset, deltaY * influence * 0.15))
    
    return { x: offsetX, y: offsetY }
  }

  return (
    <div className="not-found-container">
      <div className="not-found-content">
        <div className="not-found-main">
          <div className="astronaut-container">
            <div 
              className="astronaut-wrapper" 
              style={{ 
                transform: `translate(${calculateFollowOffset().x}px, ${calculateFollowOffset().y}px)`,
              }}
            >
              <div className="astronaut rotating">
              <div className="helmet">
                <div className="glass"></div>
              </div>
              <div className="body"></div>
              <div className="arm-left"></div>
              <div className="arm-right"></div>
              <div className="leg-left"></div>
              <div className="leg-right"></div>
              </div>
            </div>
            <div className="stars">
              <div className="star"></div>
              <div className="star"></div>
              <div className="star"></div>
              <div className="star"></div>
              <div className="star"></div>
            </div>
          </div>
          
          <div className="error-section">
            <div className="error-code">404</div>
            <h1 className="error-message">页面丢失了</h1>
            <p className="error-description">
              抱歉，您访问的页面不存在或已被移动。
            </p>
            <Link to="/" className="btn btn-primary">
              返回主页
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NotFound