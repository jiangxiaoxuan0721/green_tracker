// 导出所有页面组件
export { default as Home } from './Home/Home'
export { default as About } from './About/About'
export { default as Contact } from './Contact/Contact'
export { default as Login } from './Login/Login'
export { default as Register } from './Register/Register'
export { default as Dashboard } from './Dashboard/Dashboard'
export { default as Feedback } from './Feedback/Feedback'
export { default as NotFound } from './NotFound/NotFound'

// Dashboard 子页面统一导出
export * as DashboardPages from './Dashboard'