import { useCallback, useEffect, useRef, useState } from 'react'
import { fieldService, type Field, type FieldLight } from '@/services/fieldService'

export interface CatalogEntry extends FieldLight {
  /** 完整字段（含 description / crop_type 等），按需懒加载后填充 */
  detail?: Field
}

export interface FieldCatalog {
  light: FieldLight[]
  byId: Map<string, CatalogEntry>
  loading: boolean
  error: string | null
  reload: () => void
  remove: (id: string) => void
  upsertDetail: (field: Field) => void
}

/** 进页面拉一次轻量列表，维护 id -> 条目 索引 */
export const useFieldCatalog = (): FieldCatalog => {
  const [light, setLight] = useState<FieldLight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const byIdRef = useRef<Map<string, CatalogEntry>>(new Map())

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fieldService
      .getFieldsLight()
      .then((rows) => {
        if (cancelled) return
        const next = new Map<string, CatalogEntry>()
        rows.forEach((r) => next.set(r.id, { ...r }))
        byIdRef.current = next
        setLight(rows)
        setError(null)
      })
      .catch((e: Error) => {
        if (cancelled) return
        setError(e?.message ?? '加载地块列表失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const reload = useCallback(() => setReloadToken((t) => t + 1), [])

  const remove = useCallback((id: string) => {
    byIdRef.current.delete(id)
    setLight((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const upsertDetail = useCallback((field: Field) => {
    const existing = byIdRef.current.get(field.id)
    byIdRef.current.set(field.id, {
      id: field.id,
      name: field.name,
      area_m2: field.area_m2,
      centroid: existing?.centroid,
      detail: field,
    })
    setLight((prev) => {
      const idx = prev.findIndex((f) => f.id === field.id)
      if (idx === -1) {
        return [
          ...prev,
          {
            id: field.id,
            name: field.name,
            area_m2: field.area_m2,
            centroid: existing?.centroid ?? null,
          } as FieldLight,
        ]
      }
      const next = [...prev]
      next[idx] = { ...next[idx], name: field.name, area_m2: field.area_m2 }
      return next
    })
  }, [])

  return { light, byId: byIdRef.current, loading, error, reload, remove, upsertDetail }
}
