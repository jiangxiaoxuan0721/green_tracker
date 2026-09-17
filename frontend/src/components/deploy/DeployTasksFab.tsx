/**
 * 构建任务栏 —— 嵌入 Dashboard 内容流（.dashboard-content 顶部），非悬浮层。
 *
 * 特性：
 * - 挂在 Dashboard 布局上：算法相关页面都能看到当前构建进度
 * - 折叠展开：点击 header 切换
 * - 单行展开日志：点击 task row 展开 logLines（最大 500 行）
 * - 实时更新：zustand store 的 logLines 由 NDJSON 流持续推入
 * - 上传阶段：行内显示进度条 + "上传中 N%"；可点 X 取消（= removeTask，触发 controller.abort）
 * - 全部出终态后倒计时自动清空并隐藏（不必手动关，也不会常驻占位）
 */
import { useEffect, useState } from 'react'
import { Cpu, ChevronDown, ChevronUp, X, Circle } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useDeployTasksStore, type DeployStatus, type DeployTask } from '@/store/useDeployTasksStore'
import styles from './DeployTasksFab.module.css'

const STATUS_COLOR: Record<string, string> = {
  uploading: 'blue',
  queued: 'gray',
  building: 'blue',
  starting: 'blue',
  running: 'green',
  failed: 'red',
  cancelled: 'gray',
  lost: 'red',
}

const STATUS_LABEL: Record<DeployStatus, string> = {
  uploading: '上传中…',
  queued: '排队中',
  building: '构建中',
  starting: '启动中',
  running: '已运行',
  failed: '失败',
  cancelled: '已取消',
  lost: '已丢失',
}

/** 全部任务都出终态后，自动收起前留给用户看结果的时间 */
const AUTO_DISMISS_MS = 8000
/** 有失败任务时留更久——错误日志是要读的，别急着收 */
const AUTO_DISMISS_ON_ERROR_MS = 20000

/** 行内可见关闭按钮的判定：已完成 OR 上传中（取消上传） */
function canClose(t: DeployTask): boolean {
  return Boolean(t.finishedAt) || t.status === 'uploading'
}

export const DeployTasksFab = () => {
  // 用 useShallow 包一下：Object.values(s.tasks) 每次返回新数组引用，
  // 不包的话 zustand 默认 Object.is 判定为变化 → 触发无限循环（getSnapshot uncached）。
  // useShallow 做浅比较：内部 task 引用不变就视为相等，不重渲染；
  // store 替换某 task 引用时（如 _appendLog）仍会重渲染——符合预期。
  const tasks = useDeployTasksStore(useShallow((s) => Object.values(s.tasks)))
  const collapsed = useDeployTasksStore((s) => s.collapsed)
  const toggleCollapsed = useDeployTasksStore((s) => s.toggleCollapsed)
  const removeTask = useDeployTasksStore((s) => s.removeTask)
  const clearFinished = useDeployTasksStore((s) => s.clearFinished)

  if (tasks.length === 0) return null
  const runningCount = tasks.filter((t) => !t.finishedAt).length
  const hasFailure = tasks.some((t) => t.status === 'failed' || t.status === 'lost')

  return (
    <div className={styles.fab} data-collapsed={collapsed}>
      <button
        type="button"
        className={styles.header}
        onClick={toggleCollapsed}
        aria-label={collapsed ? '展开构建任务' : '收起构建任务'}
      >
        <Cpu size={16} />
        <span>
          {runningCount > 0
            ? `构建任务 (${runningCount} 进行中)`
            : '构建任务 (全部已完成)'}
        </span>
        {runningCount > 0
          ? <span className={styles.spinner} aria-hidden />
          : <AutoDismissCountdown
              delayMs={hasFailure ? AUTO_DISMISS_ON_ERROR_MS : AUTO_DISMISS_MS}
              onExpire={clearFinished}
            />}
        {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>
      {!collapsed && (
        <ul className={styles.list}>
          {tasks.map((t) => (
            <DeployTaskRow key={t.taskId} task={t} onClose={() => removeTask(t.taskId)} />
          ))}
        </ul>
      )}
    </div>
  )
}

/** 没有进行中任务时：N 秒倒计时后自动清空（顺带整条栏隐藏） */
const AutoDismissCountdown = ({
  delayMs,
  onExpire,
}: {
  delayMs: number
  onExpire: () => void
}) => {
  const [seconds, setSeconds] = useState<number | null>(null)

  useEffect(() => {
    setSeconds(Math.ceil(delayMs / 1000))
    const tick = setInterval(() => setSeconds((s) => (s === null ? null : s - 1)), 1000)
    const timer = setTimeout(onExpire, delayMs)
    return () => {
      clearInterval(tick)
      clearTimeout(timer)
    }
  }, [delayMs, onExpire])

  if (seconds === null || seconds <= 0) return null
  return <span className={styles.headerHint}>{seconds}s 后自动关闭</span>
}

const DeployTaskRow = ({ task, onClose }: { task: DeployTask; onClose: () => void }) => {
  const [expanded, setExpanded] = useState(false)
  const color = STATUS_COLOR[task.status] || 'gray'
  const statusLabel =
    task.status === 'uploading'
      ? task.progress && task.progress > 0
        ? `上传中 ${task.progress}%`
        : '上传中…'
      : STATUS_LABEL[task.status] || task.status
  return (
    <li className={`${styles.row} ${styles[`row--${color}`] || ''}`}>
      <div className={styles.rowHead} onClick={() => setExpanded((e) => !e)}>
        <Circle size={8} fill={color} stroke="none" />
        <span className={styles.rowName}>{task.algorithmName}</span>
        <span className={styles.rowStatus}>{statusLabel}</span>
        {task.result && <span className={styles.rowPort}>:{task.result.port}</span>}
        {canClose(task) && (
          <button
            type="button"
            className={styles.rowClose}
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            aria-label={task.status === 'uploading' ? '取消上传' : '关闭'}
            title={task.status === 'uploading' ? '取消上传' : '关闭'}
          >
            <X size={14} />
          </button>
        )}
      </div>
      {task.status === 'uploading' && (
        <div
          className={styles.rowProgress}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={task.progress ?? 0}
        >
          <div
            className={styles.rowProgressFill}
            style={{ width: `${task.progress ?? 0}%` }}
          />
        </div>
      )}
      {expanded && (
        <pre className={styles.rowLog}>
          {task.logLines.length ? task.logLines.join('\n') : '(暂无日志)'}
        </pre>
      )}
    </li>
  )
}