import { Modal, Button } from '@/components/ui'
import './FormContainer.css'

const FormContainer = ({
  isOpen,
  onClose,
  title,
  onSubmit,
  submitText = '提交',
  cancelText = '取消',
  children,
  loading = false,
  size = 'medium',
  submitVariant = 'primary',
  cancelVariant = 'ghost',
  footer
}) => {
  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(e)
  }

  const defaultFooter = (
    <>
      <Button variant={cancelVariant} onClick={onClose} disabled={loading}>
        {cancelText}
      </Button>
      <Button type="submit" variant={submitVariant} loading={loading}>
        {submitText}
      </Button>
    </>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size={size}
      footer={footer !== undefined ? footer : defaultFooter}
    >
      <form onSubmit={handleSubmit}>{children}</form>
    </Modal>
  )
}

export default FormContainer
