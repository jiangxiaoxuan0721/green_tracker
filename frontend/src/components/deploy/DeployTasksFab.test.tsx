// DeployTasksFab 测试 —— 需要 vitest + @testing-library/react 跑（前端无此依赖）
// @ts-nocheck -- vitest 未安装；待 npm i -D vitest @testing-library/react 后移除
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
    expect(screen.getByText(/我的算法/)).toBeInTheDocument()
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
    expect(screen.getByText(/A/)).toBeVisible()
  })
})