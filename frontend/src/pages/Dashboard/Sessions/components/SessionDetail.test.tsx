/**
 * 任务详情：状态流转按钮必须真的改状态。
 *
 * 原先「开始任务 / 完成任务」调的是 onEdit(id, newStatus)，而 onEdit 只负责开编辑表单 ——
 * 点下去状态纹丝不动，只弹了个编辑框。这里把「走 onUpdateStatus、不走 onEdit」钉住；
 * 同时锁住「没给 onUpdateStatus 就不渲染按钮」，避免出现点了没反应、也不报错的按钮。
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
// SessionDetail.jsx 不在 tsconfig 的编译程序内（未开 allowJs），无类型声明可用
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error - .jsx 模块缺少类型声明
import SessionDetail from './SessionDetail'

const session = {
  id: 's1',
  mission_name: '春巡一号',
  mission_type: '巡检',
  field_name: '一号地块',
  device_name: '无人机A',
  status: 'planned',
  start_time: '2026-03-01T08:00:00Z',
  created_at: '2026-02-28T10:00:00Z',
}

/** 取「结束时间」这一格的值，绕开与状态徽标重名的文本 */
const endTimeValue = (container: HTMLElement) => {
  const field = [...container.querySelectorAll('.sd-field')].find(
    (el) => el.querySelector('.sd-field-label')?.textContent === '结束时间'
  )
  return field?.querySelector('.sd-field-value')?.textContent
}

const renderDetail = (overrides = {}, onUpdateStatus?: () => Promise<void>) =>
  render(
    <SessionDetail
      session={{ ...session, ...overrides }}
      onClose={vi.fn()}
      onEdit={vi.fn()}
      onUpdateStatus={onUpdateStatus}
    />
  )

describe('SessionDetail', () => {
  it('「开始任务」走 onUpdateStatus，而不是把 id 丢给 onEdit', async () => {
    const onUpdateStatus = vi.fn().mockResolvedValue(undefined)
    const onEdit = vi.fn()
    const onClose = vi.fn()
    render(
      <SessionDetail
        session={session}
        onClose={onClose}
        onEdit={onEdit}
        onUpdateStatus={onUpdateStatus}
      />
    )

    fireEvent.click(screen.getByText('开始任务'))

    expect(onUpdateStatus).toHaveBeenCalledWith('s1', 'running')
    expect(onEdit).not.toHaveBeenCalled()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('running 状态下给出「完成任务」', async () => {
    const onUpdateStatus = vi.fn().mockResolvedValue(undefined)
    render(
      <SessionDetail
        session={{ ...session, status: 'running' }}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onUpdateStatus={onUpdateStatus}
      />
    )

    fireEvent.click(screen.getByText('完成任务'))

    expect(onUpdateStatus).toHaveBeenCalledWith('s1', 'completed')
    expect(screen.queryByText('开始任务')).toBeNull()
  })

  it('没传 onUpdateStatus 时不渲染状态按钮', () => {
    renderDetail()

    expect(screen.queryByText('开始任务')).toBeNull()
    expect(screen.queryByText('完成任务')).toBeNull()
  })

  it('头部展示任务名、类型胶囊与状态', () => {
    renderDetail()

    expect(screen.getByText('春巡一号')).toBeTruthy()
    // 类型同时出现在胶囊和字段区，故按"至少一个"断言
    expect(screen.getAllByText('巡检').length).toBeGreaterThan(0)
    expect(screen.getByText('计划中')).toBeTruthy()
  })

  it('结束时间缺席时区分「进行中」与「未记录」', () => {
    // 按字段取值而非按文本查：running 时状态徽标也写着「进行中」，会被查重
    const { unmount, container } = renderDetail({ status: 'running' })
    expect(endTimeValue(container)).toBe('进行中')
    unmount()

    const second = renderDetail({ status: 'planned', end_time: null })
    expect(endTimeValue(second.container)).toBe('未记录')
  })
})
