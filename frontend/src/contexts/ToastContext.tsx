import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: number
  message: string
  type: ToastType
  duration: number
}

export interface ToastContextValue {
  toasts: ToastItem[]
  addToast: (message: string, type?: ToastType, duration?: number) => void
  removeToast: (id: number) => void
  success: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION = 3000

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback(
    (message: string, type: ToastType = 'error', duration: number = DEFAULT_DURATION) => {
      const id = Date.now() + Math.random()
      setToasts(prev => [...prev, { id, message, type, duration }])
    },
    []
  )

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const success = useCallback((message: string, duration?: number) => addToast(message, 'success', duration ?? DEFAULT_DURATION), [addToast])
  const error = useCallback((message: string, duration?: number) => addToast(message, 'error', duration ?? DEFAULT_DURATION), [addToast])
  const warning = useCallback((message: string, duration?: number) => addToast(message, 'warning', duration ?? DEFAULT_DURATION), [addToast])
  const info = useCallback((message: string, duration?: number) => addToast(message, 'info', duration ?? DEFAULT_DURATION), [addToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
    </ToastContext.Provider>
  )
}

export const useToastContext = (): ToastContextValue => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToastContext must be used within ToastProvider')
  }
  return context
}

export default ToastContext
