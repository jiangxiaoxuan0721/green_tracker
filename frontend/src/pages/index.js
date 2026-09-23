// 顶层页面
export { default as Home } from './Home/Home'
export { default as About } from './About/About'
export { default as Contact } from './Contact/Contact'
export { default as Login } from './Login/Login'
export { default as Register } from './Register/Register'
export { default as ForgotPassword } from './ForgotPassword/ForgotPassword'
export { default as Dashboard } from './Dashboard/Dashboard'
export { default as Feedback } from './Feedback/Feedback'
export { default as NotFound } from './NotFound/NotFound'
export { default as RemoteControl } from './RemoteControl'

// Dashboard 子页面（透传自 Dashboard 桶，App.jsx 具名导入用）
export {
  Overview,
  Fields,
  Devices,
  Sessions,
  DataView,
  DataAnalyze,
  System,
  Logs,
  AlgorithmSquare,
  AlgorithmUse,
  KeyManagement,
} from './Dashboard'
