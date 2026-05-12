import { useToastContext } from '@/contexts/ToastContext'

const useToast = () => {
  return useToastContext()
}

export default useToast
