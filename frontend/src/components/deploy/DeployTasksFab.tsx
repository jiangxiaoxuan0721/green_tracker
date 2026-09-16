/**
 * 顶部构建任务栏 —— z-index: 9999 高于所有 modal。
 *
 * 特性：
 * - 路由无关：挂在根 App 上，所有页面都能看到当前构建进度
 * - 折叠展开：点击 header 切换
 * - 单行展开日志：点击 task row 展开 logLines（最大 500 行）
 * - 实时更新：zustand store 的 logLines 由 NDJSON 流持续推入
 */
import { useState } from 'react'
import { Cpu, ChevronDown, ChevronUp, X, Circle } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useDeployTasksStore, type DeployTask } from '@/store/useDeployTasksStore'
import styles from './DeployTasksFab.module.css'

const STATUS_COLOR: Record<string, string> = {
  queued: 'gray',
  building: 'blue',
  starting: 'blue',
  running: 'green',
  failed: 'red',
  cancelled: 'gray',
  lost: 'red',
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

  if (tasks.length === 0) return null
  const runningCount = tasks.filter((t) => !t.finishedAt).length

  return (
    <div className={styles.fab} data-collapsed={collapsed}>
      <button
        type="button"
        className={styles.header}
        onClick={toggleCollapsed}
        aria-label={collapsed ? '展开构建任务' : '收起构建任务'}
      >
        <Cpu size={16} />
        <span>构建任务 ({runningCount} 进行中)</span>
        {runningCount > 0 && <span className={styles.spinner} aria-hidden />}
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

const DeployTaskRow = ({ task, onClose }: { task: DeployTask; onClose: () => void }) => {
  const [expanded, setExpanded] = useState(false)
  const color = STATUS_COLOR[task.status] || 'gray'
  return (
    <li className={`${styles.row} ${styles[`row--${color}`]}`}>
      <div className={styles.rowHead} onClick={() => setExpanded((e) => !e)}>
        <Circle size={8} fill={color} stroke="none" />
        <span className={styles.rowName}>{task.algorithmName}</span>
        <span className={styles.rowStatus}>{task.status}</span>
        {task.result && <span className={styles.rowPort}>:{task.result.port}</span>}
        {task.finishedAt && (
          <button
            type="button"
            className={styles.rowClose}
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            aria-label="关闭"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {expanded && (
        <pre className={styles.rowLog}>
          {task.logLines.length ? task.logLines.join('\n') : '(暂无日志)'}
        </pre>
      )}
    </li>
  )
}