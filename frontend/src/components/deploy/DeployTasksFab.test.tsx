import { render, screen, fireEvent } from '@testing-library/react'
import { useDeployTasksStore } from '@/store/useDeployTasksStore'
import { DeployTasksFab } from './DeployTasksFab'

beforeEach(() => {
  useDeployTasksStore.setState({ tasks: {}, collapsed: false })
})

describe('<DeployTasksFab />', () => {
  it('renders nothing when no tasks', () => {
    const { container } = render(<DeployTasksFab />)
    expect(container.firstChild).toBeNull()
  })

  it('shows task name when present', () => {
    useDeployTasksStore.setState({
      tasks: {
        t1: {
          taskId: 't1',
          algorithmId: 1,
          algorithmName: '我的算法',
          status: 'running',
          logLines: [],
          startedAt: Date.now(),
        } as any,
      },
      collapsed: false,
    })
    render(<DeployTasksFab />)
    expect(screen.getByText('我的算法')).toBeInTheDocument()
  })

  it('toggles collapsed on header click', () => {
    useDeployTasksStore.setState({
      tasks: {
        t1: {
          taskId: 't1',
          algorithmId: 1,
          algorithmName: 'A',
          status: 'queued',
          logLines: [],
          startedAt: Date.now(),
        } as any,
      },
    })
    render(<DeployTasksFab />)
    expect(screen.getByText('A')).toBeInTheDocument()

    // 展开态 → header 是「收起」，点击后列表收起
    fireEvent.click(screen.getByRole('button', { name: '收起构建任务' }))
    expect(useDeployTasksStore.getState().collapsed).toBe(true)
    expect(screen.queryByText('A')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '展开构建任务' }))
    expect(useDeployTasksStore.getState().collapsed).toBe(false)
    expect(screen.getByText('A')).toBeInTheDocument()
  })
})
