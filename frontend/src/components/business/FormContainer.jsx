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
    console.log('[FormContainer] handleSubmit 被调用')
    e.preventDefault()
    console.log('[FormContainer] 调用 onSubmit...')
    onSubmit()
    console.log('[FormContainer] onSubmit 调用完成')
  }

  const defaultFooter = (
    <>
      <Button variant={cancelVariant} onClick={onClose} disabled={loading} type="button">
        {cancelText}
      </Button>
      <Button variant={submitVariant} loading={loading} type="submit">
        {submitText}
      </Button>
    </>
  )

  const modalContent = (
    <form onSubmit={handleSubmit}>
      <div className="form-body">{children}</div>
      <div className="form-footer">
        {footer !== undefined ? footer : defaultFooter}
      </div>
    </form>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size={size}
      footer={null}
    >
      {modalContent}
    </Modal>
  )
}

export default FormContainer
