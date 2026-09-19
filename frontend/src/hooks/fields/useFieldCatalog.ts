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
        rows.forEach((r) => {
          const prev = byIdRef.current.get(r.id)
          // 继承已按需加载的详情。列表只有轻量字段，不含 description / crop_type 等，
          // 如果整体替换 Map 就会把它们抹掉 —— 而「单个详情」必然快于「全量列表」，
          // 这在恢复选中地块时是必定发生的时序（详情先回 -> 列表才到 -> 详情被抹），
          // 抹掉后 selectedPlotId 没变、补详情的 effect 不会再跑，
          // 侧栏于是退化成「只剩面积」，直到用户再点一次。
          // 权威更新另有出处：写操作走 upsertDetail（先于 reload）、删除走 remove。
          next.set(r.id, prev?.detail ? { ...r, detail: prev.detail } : { ...r })
        })
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
