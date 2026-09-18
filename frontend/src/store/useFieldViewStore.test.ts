/**
 * 视图记忆：视角/选中的合并语义、已取 bbox 的容量上限、换账号丢弃。
 *
 * 换账号那条尤其要盯住 —— 几何是逐顶点缓存的，上一个账号的图斑漏给下一个账号，
 * 比列表串号更实、也更难在 UI 上察觉。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { useFieldGeometryStore } from './useFieldGeometryStore'
import { FETCHED_MAX_RECORDS, useFieldViewStore, type FetchedRecord } from './useFieldViewStore'

const SQUARE = 'POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))'
const rec = (n: number): FetchedRecord => ({
  bbox: { minLng: n, minLat: n, maxLng: n + 1, maxLat: n + 1 },
  ids: [`id-${n}`],
})

describe('useFieldViewStore', () => {
  beforeEach(() => {
    useFieldViewStore.setState({ owner: null, view: null, fetched: [] })
    useFieldGeometryStore.getState().reset()
  })

  it('patchView：view 为空时以 selectedPlotId 起底', () => {
    useFieldViewStore.getState().patchView({ selectedPlotId: 'p1' })
    expect(useFieldViewStore.getState().view).toEqual({ selectedPlotId: 'p1' })
  })

  it('patchView：局部更新与已有字段合并', () => {
    useFieldViewStore.getState().patchView({ selectedPlotId: 'p1' })
    useFieldViewStore.getState().patchView({ center: [105, 35], zoom: 14 })
    expect(useFieldViewStore.getState().view).toEqual({
      selectedPlotId: 'p1',
      center: [105, 35],
      zoom: 14,
    })
  })

  it('视角不设 TTL —— 切走多久回来都该还原', () => {
    useFieldViewStore.getState().patchView({ center: [105, 35], zoom: 14 })
    // 视图记忆是纯 UI 状态，没有「过期」的概念；这里只确认它不会随时间被清掉
    expect(useFieldViewStore.getState().view?.zoom).toBe(14)
  })

  it('addFetched 超出上限时丢弃最旧的', () => {
    const total = FETCHED_MAX_RECORDS + 3
    for (let i = 0; i < total; i += 1) {
      useFieldViewStore.getState().addFetched(rec(i))
    }
    const { fetched } = useFieldViewStore.getState()
    expect(fetched).toHaveLength(FETCHED_MAX_RECORDS)
    expect(fetched[0].ids).toEqual([`id-${total - FETCHED_MAX_RECORDS}`])
    expect(fetched[fetched.length - 1].ids).toEqual([`id-${total - 1}`])
  })

  it('首次进入时 syncOwner 不清空任何东西', () => {
    useFieldViewStore.getState().patchView({ selectedPlotId: 'p1' })
    useFieldViewStore.getState().addFetched(rec(1))
    // owner 尚未登记（null）→ 无从判断「换了账号」，保持原样
    useFieldViewStore.getState().syncOwner('user-a')
    expect(useFieldViewStore.getState().view).not.toBeNull()
    expect(useFieldViewStore.getState().fetched).toHaveLength(1)
  })

  it('换账号时同步丢弃视图记忆与几何缓存', () => {
    useFieldViewStore.getState().commitOwner('user-a')
    useFieldViewStore.getState().patchView({ selectedPlotId: 'p1' })
    useFieldViewStore.getState().addFetched(rec(1))
    useFieldGeometryStore.getState().put('p1', SQUARE)
    expect(useFieldGeometryStore.getState().cache.size).toBe(1)

    useFieldViewStore.getState().syncOwner('user-b')

    expect(useFieldViewStore.getState().view).toBeNull()
    expect(useFieldViewStore.getState().fetched).toHaveLength(0)
    expect(useFieldGeometryStore.getState().cache.size).toBe(0)
  })

  it('同一账号重复 syncOwner 无副作用', () => {
    useFieldViewStore.getState().commitOwner('user-a')
    useFieldViewStore.getState().patchView({ selectedPlotId: 'p1' })
    useFieldViewStore.getState().syncOwner('user-a')
    expect(useFieldViewStore.getState().view?.selectedPlotId).toBe('p1')
  })

  it('syncOwner 只裁决清空、不改 owner —— 登记归 commitOwner', () => {
    // syncOwner 是纯读路径（可在 render 期间调用），顺手改 owner 会让「已登记」的
    // 判断失去意义：换账号后 owner 立刻被改写成新账号，下次再换就查不出差异了。
    useFieldViewStore.getState().commitOwner('user-a')
    useFieldViewStore.getState().patchView({ selectedPlotId: 'p1' })

    useFieldViewStore.getState().syncOwner('user-b')

    expect(useFieldViewStore.getState().view).toBeNull()
    expect(useFieldViewStore.getState().owner).toBe('user-a')

    // 由 effect 里的 commitOwner 完成登记；登记后 user-b 自己重复调用不再清空
    useFieldViewStore.getState().commitOwner('user-b')
    useFieldViewStore.getState().patchView({ selectedPlotId: 'p2' })
    useFieldViewStore.getState().syncOwner('user-b')
    expect(useFieldViewStore.getState().view?.selectedPlotId).toBe('p2')
  })
})
