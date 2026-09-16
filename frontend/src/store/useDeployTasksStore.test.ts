// zustand store 测试 —— 需要 vitest 跑（frontend/package.json 暂无 test script）
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck -- vitest 未安装；待 npm i -D vitest 后移除
import { useDeployTasksStore } from './useDeployTasksStore'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  useDeployTasksStore.setState({ tasks: {}, collapsed: false })
})

describe('useDeployTasksStore', () => {
  it('submit throws on 409', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      status: 409,
      json: async () => ({ detail: '正在构建中' }),
    }) as any
    await expect(useDeployTasksStore.getState().submit(1, 'a', {}))
      .rejects.toThrow(/正在构建中/)
  })

  it('submit registers task on 202 and kicks off stream', async () => {
    const mockReader = (async function* () { /* empty */ })()
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        status: 202,
        json: async () => ({ task_id: 't1', stream_url: '/api/algorithms/1/build/stream?task_id=t1' }),
      })
      .mockResolvedValueOnce({
        status: 200,
        body: mockReader,
      }) as any
    const task = await useDeployTasksStore.getState().submit(1, 'algo', {})
    expect(task.taskId).toBe('t1')
    expect(task.algorithmName).toBe('algo')
    expect(task.status).toBe('queued')
    expect(useDeployTasksStore.getState().tasks.t1).toBeDefined()
  })

  it('removeTask clears from store', () => {
    useDeployTasksStore.setState({ tasks: { t1: { taskId: 't1', algorithmId: 1, algorithmName: 'a', status: 'running', logLines: [], startedAt: 1 } as any } })
    useDeployTasksStore.getState().removeTask('t1')
    expect(useDeployTasksStore.getState().tasks.t1).toBeUndefined()
  })
})