import './Form.css'

const Form = ({ children, className = '', onSubmit, ...props }) => {
  const handleSubmit = (e) => {
    e.preventDefault()
    if (onSubmit) {
      onSubmit(e)
    }
  }

  return (
    <form 
      className={`form ${className}`}
      onSubmit={handleSubmit}
      {...props}
    >
      {children}
    </form>
  )
}

export default Form