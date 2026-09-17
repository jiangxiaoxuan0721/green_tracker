// zustand store 测试 —— 需要 vitest 跑（frontend/package.json 暂无 test script）
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck -- vitest 未安装；待 npm i -D vitest 后移除
import axios from 'axios'
import { useDeployTasksStore } from './useDeployTasksStore'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  // 分号必需：下一行以 `(` 开头，缺分号会被解析成对 setState() 返回值的调用，
  // 报 "setState(...) is not a function"（曾因此整文件 6 个用例全红）。
  useDeployTasksStore.setState({ tasks: {}, collapsed: false })
  // 重置 axios.post mock
  ;(axios as any).post = vi.fn()
  // 默认 fetch 桩：永远 pending。用例只断言"提交/上传后立刻可见的状态"，
  // 若这里给一个已 resolve 的响应，subscribeStream 会顺势把任务推到终态（succeeded/lost），
  // 断言的 'queued' / 'building' 就被冲掉了。需要流行为的用例自己在用例内覆盖。
  global.fetch = vi.fn(() => new Promise(() => {})) as any
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
    global.fetch = vi.fn()
      // ok: true 必需 —— store 判的是 r.ok，不是 status 区间；
      // 只给 status: 202 会让 r.ok 为 undefined，走进 "提交失败 HTTP 202" 分支。
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ task_id: 't1', stream_url: '/api/algorithms/1/build/stream?task_id=t1' }),
      })
      // parseNDJSON 走的是 body.getReader()，不是异步迭代器
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: async () => ({ done: true, value: undefined }),
            cancel: async () => {},
          }),
        },
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

  it('upload creates uploading task and transitions to building on success', async () => {
    (axios as any).post.mockResolvedValueOnce({
      data: { task_id: 't1', algorithm: { id: 7, name: '我的算法' } },
    })
    const taskId = useDeployTasksStore.getState().upload(new FormData(), '我的算法', {})
    // 立刻可见 uploading 任务
    const t0 = useDeployTasksStore.getState().tasks[taskId]
    expect(t0.status).toBe('uploading')
    expect(t0.progress).toBe(0)
    // 等 microtask 让 .then 跑完
    await new Promise((r) => setTimeout(r, 0))
    const t1 = useDeployTasksStore.getState().tasks[taskId]
    expect(t1.status).toBe('building')
    expect(t1.backendTaskId).toBe('t1')
    expect(t1.algorithmId).toBe(7)
    expect(t1.algorithmName).toBe('我的算法')
    expect(t1.progress).toBeUndefined()
  })

  it('upload cancellation marks task cancelled', async () => {
    (axios as any).post.mockImplementationOnce(() => {
      const err: any = new Error('canceled')
      err.name = 'CanceledError'
      err.code = 'ERR_CANCELED'
      return Promise.reject(err)
    })
    const taskId = useDeployTasksStore.getState().upload(new FormData(), 'algo', {})
    await new Promise((r) => setTimeout(r, 0))
    const t = useDeployTasksStore.getState().tasks[taskId]
    expect(t.status).toBe('cancelled')
    expect(t.error).toBe('上传已取消')
  })

  it('upload missing task_id from backend marks task failed', async () => {
    (axios as any).post.mockResolvedValueOnce({ data: {} })
    const taskId = useDeployTasksStore.getState().upload(new FormData(), 'algo', {})
    await new Promise((r) => setTimeout(r, 0))
    const t = useDeployTasksStore.getState().tasks[taskId]
    expect(t.status).toBe('failed')
    expect(t.error).toBe('后端未返回 task_id')
  })
})