import { useState, useCallback } from 'react'

const useForm = (initialValues, validationSchema = {}) => {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})

  const validateField = useCallback((name, value) => {
    const schema = validationSchema[name]
    if (!schema) return null

    if (schema.required && (!value || value.trim() === '')) {
      return schema.requiredMessage || `${name} is required`
    }

    if (schema.minLength && value.length < schema.minLength) {
      return `Must be at least ${schema.minLength} characters`
    }

    if (schema.maxLength && value.length > schema.maxLength) {
      return `Must be no more than ${schema.maxLength} characters`
    }

    if (schema.pattern && !schema.pattern.test(value)) {
      return schema.patternMessage || 'Invalid format'
    }

    if (schema.custom && !schema.custom(value, values)) {
      return schema.customMessage || 'Invalid value'
    }

    if (schema.confirm) {
      const confirmValue = values[schema.confirm]
      if (value !== confirmValue) {
        return schema.confirmMessage || 'Values do not match'
      }
    }

    return null
  }, [validationSchema, values])

  const validateAll = useCallback(() => {
    const newErrors = {}
    let isValid = true

    Object.keys(validationSchema).forEach(name => {
      const error = validateField(name, values[name])
      if (error) {
        newErrors[name] = error
        isValid = false
      }
    })

    setErrors(newErrors)
    return isValid
  }, [validationSchema, values, validateField])

  const handleChange = useCallback((e) => {
    const { name, value } = e.target
    setValues(prev => ({ ...prev, [name]: value }))

    // 实时验证：只要有值就验证，不论是否 touched
    const error = validateField(name, value)
    setErrors(prev => ({
      ...prev,
      [name]: error
    }))
  }, [validateField])

  const handleBlur = useCallback((e) => {
    const { name, value } = e.target
    setTouched(prev => ({ ...prev, [name]: true }))

    const error = validateField(name, value)
    setErrors(prev => ({
      ...prev,
      [name]: error
    }))
  }, [validateField])

  const setFieldValue = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }))
  }, [])

  const setFieldError = useCallback((name, error) => {
    setErrors(prev => ({ ...prev, [name]: error }))
  }, [])

  const resetForm = useCallback(() => {
    setValues(initialValues)
    setErrors({})
    setTouched({})
  }, [initialValues])

  // 简化：始终检查 errors 是否为空
  const isValid = Object.keys(errors).every(key => !errors[key])

  return {
    values,
    errors,
    touched,
    isValid,
    handleChange,
    handleBlur,
    setFieldValue,
    setFieldError,
    resetForm,
    validateAll
  }
}

export default useForm
