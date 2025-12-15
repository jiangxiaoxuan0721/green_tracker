import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from './hooks/auth/useAuth'
import { Home, About, Contact, Login, Register, Dashboard, Feedback, NotFound, DashboardPages } from './pages'
import './App.css'

// 解构Dashboard子页面
const { Overview, Fields, Devices, Sessions, DataView, DataAnalyze, System, Logs } = DashboardPages

function AppContent() {
  const location = useLocation()
  
  useEffect(() => {
    // 在Dashboard及其子页面应用主题
    if (location.pathname.startsWith('/dashboard')) {
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
          <Route path="/feedback" element={<Feedback />} />
          
          {/* Dashboard 路由及其子路由 */}
          <Route path="/dashboard" element={<Dashboard />}>
            <Route index element={<Overview />} />
            <Route path="fields" element={<Fields />} />
            <Route path="devices" element={<Devices />} />
            <Route path="sessions" element={<Sessions />} />
            <Route path="data-view" element={<DataView />} />
            <Route path="data-analyze" element={<DataAnalyze />} />
            <Route path="system" element={<System />} />
            <Route path="logs" element={<Logs />} />
          </Route>
          
          <Route path="*" element={<NotFound />} />
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