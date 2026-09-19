/**
 * 会话级视图记忆的回归用例。
 *
 * 背景：曾出现「切到别的页面再回来，地图回到默认全国视角」的缺陷。根因不在还原侧，
 * 而在记账侧 —— 原实现把「记下当前视角」写在 Fields 的卸载 cleanup 里，读的是
 * FieldMapCanvas 的 imperative handle；而 React 在卸载时会先跑子组件的
 * useImperativeHandle destroy（把 ref 置 null），父组件的 useEffect cleanup 才执行，
 * 于是 canvasRef.current 恒为 null，sessionView 一次都没被写过。
 *
 * 因此本用例只验证一件事：视野变化后卸载、再挂载，新实例拿到的 initialView
 * 必须是上一次的 center / zoom。
 */
import { act, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
// Fields.jsx 不在 tsconfig 的编译程序内（未开 allowJs），无类型声明可用
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error - .jsx 模块缺少类型声明
import Fields from './Fields'

interface CanvasProps {
  initialView?: { center?: [number, number]; zoom?: number } | null
  onViewportChange?: (
    zoom: number,
    bounds: [[number, number], [number, number]],
    center: [number, number]
  ) => void
}

const sink = vi.hoisted<{ props: CanvasProps | null }>(() => ({ props: null }))

vi.mock('@/components/fields/FieldMapCanvas', async () => {
  const React = await import('react')
  const Stub = React.forwardRef<unknown, CanvasProps>((props, ref) => {
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
    getFieldsLight: vi.fn(async () => []),
    getFieldsGeometry: vi.fn(async () => []),
    getFieldById: vi.fn(async () => ({})),
    createField: vi.fn(),
    updateField: vi.fn(),
    deleteField: vi.fn(),
  },
}))

vi.mock('@/hooks/fields/useAMap', () => ({
  useAMap: () => ({ ready: true, error: null }),
  default: () => ({ ready: true, error: null }),
}))

vi.mock('@/components/fields/FieldToolbar', () => ({ default: () => null }))
vi.mock('@/components/fields/FieldSidePanel', () => ({ default: () => null }))
vi.mock('@/components/ui', () => ({ PanelResizer: () => null }))

const renderFields = () =>
  render(
    <MemoryRouter>
      <Fields />
    </MemoryRouter>
  )

describe('Fields 会话级视图记忆', () => {
  it('切走再回来时，用上次的 center / zoom 还原视角', async () => {
    // 首次进入：默认视角，sessionView 尚未记账
    const first = renderFields()
    await waitFor(() => expect(sink.props).not.toBeNull())
    expect(sink.props?.initialView).toBeFalsy()

    // 用户平移/缩放到某处，地图回调上报视野（WGS84）
    const onViewportChange = sink.props?.onViewportChange as NonNullable<
      CanvasProps['onViewportChange']
    >
    await act(async () => {
      onViewportChange(14, [[100, 30], [110, 40]], [105, 35])
    })

    // 切走：组件卸载，视图记忆必须在卸载前就已落账
    first.unmount()
    // 显式标注类型：否则 TS 会把 sink.props 按上一条赋值收窄成 null
    sink.props = null as CanvasProps | null

    // 再回来：新实例应拿到上次视角
    renderFields()
    await waitFor(() => expect(sink.props).not.toBeNull())
    expect(sink.props?.initialView).toMatchObject({ center: [105, 35], zoom: 14 })
  })
})
