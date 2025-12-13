import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from './hooks/auth/useAuth'
import { Home, About, Contact, Login, Register, Dashboard } from './pages'
import './App.css'

function AppContent() {
  const location = useLocation()
  
  useEffect(() => {
    // 只在Dashboard页面应用主题
    if (location.pathname === '/dashboard') {
      const savedTheme = localStorage.getItem('theme') || 'default'
      if (savedTheme === 'default') {
        document.documentElement.removeAttribute('data-theme')
      } else {
        document.documentElement.setAttribute('data-theme', savedTheme)
      }
    } else {
      // 非Dashboard页面移除主题属性
      document.documentElement.removeAttribute('data-theme')
    }
  }, [location.pathname]) // 路径变化时重新检查登录状态和主题
  
  console.log('App组件已加载')
  
  return (
    <div className="App">
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/index" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App