import { useState, useCallback } from 'react'

const useToast = () => {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'error', duration = 3000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type, duration }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const error = useCallback((message, duration) => {
    addToast(message, 'error', duration)
  }, [addToast])

  const success = useCallback((message, duration) => {
    addToast(message, 'success', duration)
  }, [addToast])

  const warning = useCallback((message, duration) => {
    addToast(message, 'warning', duration)
  }, [addToast])

  const info = useCallback((message, duration) => {
    addToast(message, 'info', duration)
  }, [addToast])

  return {
    toasts,
    addToast,
    removeToast,
    error,
    success,
    warning,
    info
  }
}

export default useToast
