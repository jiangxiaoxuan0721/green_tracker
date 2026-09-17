import { useState, useCallback } from 'react'

const useModal = <T = unknown,>() => {
  const [isOpen, setIsOpen] = useState(false)
  const [modalData, setModalData] = useState<T | null>(null)

  const openModal = useCallback((data: T | null = null) => {
    setModalData(data)
    setIsOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setModalData(null)
    setIsOpen(false)
  }, [])

  const toggleModal = useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  return {
    isOpen,
    modalData,
    openModal,
    closeModal,
    toggleModal,
    setModalData
  }
}

export default useModal
