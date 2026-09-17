import { useState, useCallback, useEffect } from 'react'

export interface DataListItem {
  id: string | number
  [key: string]: unknown
}

export interface FetchParams {
  page: number
  pageSize: number
  [key: string]: unknown
}

export type FetchResult =
  | DataListItem[]
  | {
      data?: DataListItem[]
      items?: DataListItem[]
      total?: number
      count?: number
    }
  | null

export type FetchFunction = ((params: FetchParams) => Promise<FetchResult>) | null

export interface UseDataListOptions {
  pageSize?: number
  defaultFilters?: Record<string, unknown>
  autoFetch?: boolean
  onSuccess?: (result: FetchResult | undefined) => void
  onError?: (error: unknown) => void
}

// 防抖函数
const debounce = <T extends unknown[]>(func: (...args: T) => void, wait: number) => {
  let timeout: ReturnType<typeof setTimeout> | undefined
  return (...args: T): void => {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

const useDataList = (fetchFunction: FetchFunction, options: UseDataListOptions = {}) => {
  const {
    pageSize = 10,
    defaultFilters = {},
    autoFetch = true,
    onSuccess,
    onError
  } = options

  const [data, setData] = useState<DataListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState<Record<string, unknown>>(defaultFilters)

  const fetchData = useCallback(async (page = currentPage, filterParams = filters): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      let result: FetchResult | undefined
      if (typeof fetchFunction === 'function') {
        result = await fetchFunction({
          page,
          pageSize,
          ...filterParams
        })
      }

      // 处理返回值:可能是数组、对象或包含data/items字段的对象
      let dataArray: DataListItem[] = []
      let totalCount = 0

      if (Array.isArray(result)) {
        dataArray = result
        totalCount = result.length
      } else if (result) {
        dataArray = result.data || result.items || []
        totalCount = result.total || result.count || dataArray.length
      }

      setData(dataArray)
      setTotal(totalCount)
      setCurrentPage(page)

      if (onSuccess) {
        onSuccess(result)
      }
    } catch (err) {
      console.error('Fetch data error:', err)
      setError((err as Error).message || '加载数据失败')

      if (onError) {
        onError(err)
      }
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }, [currentPage, filters, fetchFunction, pageSize, onSuccess, onError])

  // 创建防抖版本的fetchData
  const debouncedFetch = useCallback(
    debounce(fetchData, 300),
    [fetchData]
  )

  const refresh = useCallback((): Promise<void> => {
    return fetchData(currentPage, filters)
  }, [fetchData, currentPage, filters])

  const handlePageChange = useCallback((page: number) => {
    if (page >= 1) {
      debouncedFetch(page, filters)
    }
  }, [debouncedFetch, filters])

  const handleFilterChange = useCallback((newFilters: Record<string, unknown>) => {
    const updatedFilters = { ...filters, ...newFilters }
    setFilters(updatedFilters)
    setCurrentPage(1)
    return debouncedFetch(1, updatedFilters)
  }, [filters, debouncedFetch])

  const handleResetFilters = useCallback((): Promise<void> => {
    setFilters(defaultFilters)
    setCurrentPage(1)
    return fetchData(1, defaultFilters)
  }, [defaultFilters, fetchData])

  const updateItem = useCallback((id: string | number, updates: Partial<DataListItem>) => {
    setData(prevData =>
      prevData.map(item =>
        item.id === id ? { ...item, ...updates } : item
      )
    )
  }, [])

  const deleteItem = useCallback((id: string | number) => {
    setData(prevData => prevData.filter(item => item.id !== id))
    setTotal(prevTotal => Math.max(0, prevTotal - 1))
  }, [])

  const addItem = useCallback((newItem: DataListItem) => {
    setData(prevData => [newItem, ...prevData])
    setTotal(prevTotal => prevTotal + 1)
  }, [])

  useEffect(() => {
    if (autoFetch) {
      fetchData()
    }
    // 只在组件首次挂载时执行一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    data,
    loading,
    initialLoading,
    error,
    currentPage,
    total,
    pageSize,
    filters,
    fetchData,
    refresh,
    handlePageChange,
    handleFilterChange,
    handleResetFilters,
    updateItem,
    deleteItem,
    addItem
  }
}

export default useDataList
