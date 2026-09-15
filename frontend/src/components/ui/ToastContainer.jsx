/**
 * 全局 Toast 容器（契约见 docs/plans/2026-09-15-structure-normalization-design.md）
 * 无 props：toasts 与移除回调均从 ToastContext 自取。
 * 位置与展示时长由 addToast(message, type, duration) 控制，不在容器层覆写。
 */
import useToast from '@/hooks/useToast'
import Toast from './Toast'

const ToastContainer = () => {
  const { toasts, removeToast } = useToast()

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  )
}

export default ToastContainer
