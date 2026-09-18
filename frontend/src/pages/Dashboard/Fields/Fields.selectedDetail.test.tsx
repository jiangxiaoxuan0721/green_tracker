/**
 * 回归用例：切到其他页面再回来，选中地块的信息必须还在。
 *
 * 现象是「侧栏只剩面积，作物类型 / 土壤类型 / 描述全都退回'未设置'，再点一次才恢复」。
 *
 * 根因不在还原侧 —— selectedPlotId 和 panelMode 都还原了 —— 而在 useFieldCatalog：
 * 地块详情是按需懒加载的（写进 byId[id].detail），而列表返回时会**整个替换** byId Map。
 * 恢复选中后，单个地块详情必然快于全量列表回来，于是时序是：
 *   详情先回来 → 写进 Map → 列表后到 → Map 被全新重建 → detail 被抹掉
 * 此后 selectedPlotId 一直没变，补详情的 effect 不会再跑，侧栏就空到用户再点一次为止。
 *
 * 因此本用例刻意让列表延迟、详情即时，并且在断言详情之前先等列表真的回来。
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
// Fields.jsx 不在 tsconfig 的编译程序内（未开 allowJs），无类型声明可用
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error - .jsx 模块缺少类型声明
import Fields from './Fields'
import { useFieldGeometryStore } from '@/store/useFieldGeometryStore'
import { useFieldViewStore } from '@/store/useFieldViewStore'

const FIXTURE = vi.hoisted(() => ({
  light: [{ id: 'f1', name: '一号地块', area_m2: 1200, centroid: [105, 35] as [number, number] }],
  wkt: 'POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))',
  detail: {
    id: 'f1',
    name: '一号地块',
    area_m2: 1200,
    crop_type: '水稻',
    soil_type: '壤土',
    irrigation_type: '滴灌',
    description: '测试描述',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  },
}))

const sink = vi.hoisted<{ props: Record<string, unknown> | null }>(() => ({ props: null }))

vi.mock('@/components/fields/FieldMapCanvas', async () => {
  const React = await import('react')
  const Stub = React.forwardRef<unknown, Record<string, unknown>>((props, ref) => {
    sink.props = props
    React.useImperativeHandle(ref, () => ({
      fitBounds: () => {},
      setPolygons: () => {},
      setClusters: () => {},
      setHighlight: () => {},
      setDraftPolygon: () => {},
      startDraw: () => Promise.resolve(null),
      cancelDraw: () => {},
      resetView: () => {},
      resize: () => {},
    }))
    return React.createElement('div', { 'data-testid': 'canvas' })
  })
  Stub.displayName = 'FieldMapCanvasStub'
  return { default: Stub }
})

vi.mock('@/services/fieldService', () => ({
  fieldService: {
    // 列表刻意延迟：复现「详情先回、列表后到」的时序
    getFieldsLight: vi.fn(
      () => new Promise((resolve) => setTimeout(() => resolve(FIXTURE.light), 30))
    ),
    getFieldsGeometry: vi.fn(async () => [{ id: 'f1', location_wkt: FIXTURE.wkt }]),
    getFieldById: vi.fn(async () => FIXTURE.detail),
    createField: vi.fn(),
    updateField: vi.fn(),
    deleteField: vi.fn(),
  },
}))

vi.mock('@/hooks/fields/useAMap', () => ({
  useAMap: () => ({ ready: true, error: null }),
  default: () => ({ ready: true, error: null }),
}))

// 工具栏与侧栏用真实组件：本用例正是要靠侧栏里的详情字段判断是否丢失
vi.mock('@/components/ui', async () => {
  const React = await import('react')
  const Passthrough = ({ children, ...rest }: { children?: unknown }) =>
    React.createElement('button', rest, children as never)
  return { Button: Passthrough, PanelResizer: () => null }
})

const renderFields = () =>
  render(
    <MemoryRouter>
      <Fields />
    </MemoryRouter>
  )

/** 等列表真正加载完（低速请求回来后才断言，避免恰好在覆盖前读到详情而假通过） */
const waitLightLoaded = async () => {
  await waitFor(() => expect(screen.getByRole('option', { name: '一号地块' })).toBeTruthy())
  // 再放一个 tick，让列表到达后引发的副作用全部跑完
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50))
  })
}

const selectField = async () => {
  const select = await screen.findByLabelText('选择地块')
  await act(async () => {
    fireEvent.change(select, { target: { value: 'f1' } })
  })
  await waitFor(() => expect(screen.getByText('水稻')).toBeTruthy())
}

describe('Fields 选中地块详情', () => {
  beforeEach(() => {
    useFieldGeometryStore.getState().reset()
    useFieldViewStore.setState({ owner: null, view: null, fetched: [] })
    sink.props = null
  })

  it('切走再回来时，侧栏仍显示上次选中地块的详情', async () => {
    const first = renderFields()
    await waitLightLoaded()
    await selectField()

    // 切走
    first.unmount()

    // 再回来：selectedPlotId / panelMode 应还原，详情必须随之补出
    renderFields()
    await waitLightLoaded()
    await waitFor(() => expect(screen.getByText('水稻')).toBeTruthy(), { timeout: 2000 })
    expect(screen.getByText('壤土')).toBeTruthy()
  })
})
