import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui'
import useToast from '@/hooks/useToast'
import { mqttService } from '@/services/mqttService'
import { useRemoteControlStore, MAX_ENTRIES, DEFAULT_PRESET_WIDTH } from '@/store/useRemoteControlStore'
import './CommandConsole.css'
import {
  Terminal, Send, Zap, Sliders, RotateCw, Info,
  CheckCircle2, XCircle, Clock, ChevronDown, AlertTriangle, Loader2, Trash2,
} from 'lucide-react'

const POLL_INTERVAL = 2000
const POLL_MAX_RETRIES = 10

// 命令行输入通道：把整行输入当作字符串参数，交给设备端的 execute_shell 执行
const SHELL_COMMAND = 'execute_shell'
const SHELL_PARAM_KEY = 'command'

// 拖拽调整右栏宽度时的边界：右栏自身不能小于 PRESET_WIDTH_MIN，
// 同时给左侧记录面板留出 JOURNAL_WIDTH_MIN
const PRESET_WIDTH_MIN = 220
const PRESET_WIDTH_MAX = 720
const JOURNAL_WIDTH_MIN = 320

// 空容器常量：避免 store 中尚无该设备会话时每次渲染都产生新引用
const EMPTY_ENTRIES = []
const EMPTY_IDS = []
const EMPTY_PARAMS = {}
const EMPTY_HISTORY = []

// 图标映射
const ICON_MAP = {
  info: Info,
  zap: Zap,
  sliders: Sliders,
  'rotate-cw': RotateCw,
  terminal: Terminal,
  settings: Sliders,
  list: Info,
}

// 后备默认指令（后端不可用时使用）
const FALLBACK_COMMANDS = [
  { id: 'ping', label: '心跳检测', description: '立即检测设备是否响应', icon: 'zap', require_confirm: false },
  { id: 'get_info', label: '获取设备信息', description: '获取设备基本信息、平台、主机名等', icon: 'info', require_confirm: false },
  { id: 'get_metrics', label: '运行指标', description: '获取 CPU/内存/温度等运行指标', icon: 'sliders', require_confirm: false },
  { id: 'reboot', label: '重启设备', description: '向设备发送重启指令', icon: 'rotate-cw', require_confirm: true, params_schema: { delay: 'number' } },
  { id: 'set_config', label: '写配置项', description: '写入设备配置项（key/value）', icon: 'settings', require_confirm: false, params_schema: { key: 'string', value: 'string' } },
]

const formatTime = (iso) => {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch { return iso }
}

const formatResponse = (data) => {
  if (!data) return '(空)'
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

// shell 回显：设备多半返回 { stdout, stderr, exit_code }，直接铺文本比 JSON 可读
const formatShellOutput = (data) => {
  if (!data) return '(空)'
  if (typeof data === 'string') return data
  if (typeof data !== 'object') return String(data)
  const { stdout, stderr, output, exit_code: exitCode } = data
  if (stdout === undefined && stderr === undefined && output === undefined) {
    return formatResponse(data)
  }
  const parts = []
  if (stdout !== undefined) parts.push(stdout)
  if (output !== undefined && output !== stdout) parts.push(output)
  if (stderr) parts.push(`[stderr]\n${stderr}`)
  if (exitCode !== undefined && String(exitCode) !== '0') parts.push(`exit_code: ${exitCode}`)
  return parts.join('\n').trim() || '(空输出)'
}

// 命令行风格的参数串：key=value
const formatParams = (params) => {
  if (!params) return ''
  return Object.entries(params)
    .map(([k, v]) => `${k}=${typeof v === 'object' && v !== null ? JSON.stringify(v) : v}`)
    .join(' ')
}

// 根据 schema 类型推断默认值
const defaultParamValue = (type) => {
  switch (type) {
    case 'number': return ''
    case 'string': return ''
    default: return ''
  }
}

// 将表单值转换为正确的类型
const castParamValue = (type, raw) => {
  if (raw === '' || raw === null || raw === undefined) return undefined
  switch (type) {
    case 'number': return parseFloat(raw)
    default: return raw
  }
}

const CommandConsole = ({ deviceId, onCommandSent, fill = false }) => {
  const { success: showSuccess, error: showError } = useToast()
  const [sending, setSending] = useState(null)
  const [input, setInput] = useState('')
  const [resizing, setResizing] = useState(false)
  const pollTimersRef = useRef({})
  const journalBodyRef = useRef(null)
  const containerRef = useRef(null)
  const cliInputRef = useRef(null)
  // 命令行输入历史游标：-1 表示正在编辑新行
  const historyCursorRef = useRef(-1)
  // 已被轮询接管的条目，避免重复挂载时重复起定时器
  const resumedIdsRef = useRef(new Set())

  // 控制台会话落在 store：执行记录 / 展开项 / 参数 / 命令行历史跨路由、
  // 跨刷新都保留，用户中途离开再回来时是同一段会话
  const session = useRemoteControlStore((s) => s.sessions[deviceId])
  const appendEntry = useRemoteControlStore((s) => s.appendEntry)
  const updateEntry = useRemoteControlStore((s) => s.updateEntry)
  const resolveEntry = useRemoteControlStore((s) => s.resolveEntry)
  const clearEntriesStore = useRemoteControlStore((s) => s.clearEntries)
  const toggleExpanded = useRemoteControlStore((s) => s.toggleExpanded)
  const setParamValue = useRemoteControlStore((s) => s.setParamValue)
  const pushInput = useRemoteControlStore((s) => s.pushInput)
  const presetWidth = useRemoteControlStore((s) => s.presetWidth)
  const setPresetWidth = useRemoteControlStore((s) => s.setPresetWidth)

  const logs = session?.entries ?? EMPTY_ENTRIES
  const expandedIds = session?.expandedIds ?? EMPTY_IDS
  const paramValues = session?.paramValues ?? EMPTY_PARAMS
  const inputHistory = session?.inputHistory ?? EMPTY_HISTORY

  // 动态获取设备支持指令
  const [commands, setCommands] = useState([])
  const [commandsLoading, setCommandsLoading] = useState(true)
  const [commandsError, setCommandsError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const fetchCommands = async () => {
      setCommandsLoading(true)
      setCommandsError(null)
      try {
        const result = await mqttService.getDeviceCommands(deviceId)
        if (!cancelled) {
          setCommands(result.commands || FALLBACK_COMMANDS)
        }
      } catch {
        if (!cancelled) {
          setCommands(FALLBACK_COMMANDS)
          setCommandsError('无法获取设备指令列表，使用默认指令')
        }
      } finally {
        if (!cancelled) setCommandsLoading(false)
      }
    }
    fetchCommands()
    return () => { cancelled = true }
  }, [deviceId])

  // 命令列表加载后补齐未填参数的空值；已由上一次会话保留下来的值不动
  useEffect(() => {
    commands.filter(c => c.params_schema).forEach(c => {
      Object.entries(c.params_schema).forEach(([name, type]) => {
        if (paramValues[c.id]?.[name] === undefined) {
          setParamValue(deviceId, c.id, name, defaultParamValue(type))
        }
      })
    })
  }, [commands, deviceId, paramValues, setParamValue])

  const updateParam = useCallback((cmdId, fieldName, value) => {
    setParamValue(deviceId, cmdId, fieldName, value)
  }, [deviceId, setParamValue])

  const getPayloadParams = useCallback((cmdId) => {
    const cmd = commands.find(c => c.id === cmdId)
    if (!cmd?.params_schema) return {}
    const raw = paramValues[cmdId] || {}
    const result = {}
    Object.entries(cmd.params_schema).forEach(([name, type]) => {
      const val = castParamValue(type, raw[name])
      if (val !== undefined) result[name] = val
    })
    return result
  }, [commands, paramValues])

  // 检查一个命令的必填参数是否都已填写
  const paramsReady = useCallback((cmdId) => {
    const cmd = commands.find(c => c.id === cmdId)
    if (!cmd?.params_schema) return true
    const raw = paramValues[cmdId] || {}
    return Object.entries(cmd.params_schema).every(([name]) => {
      const v = raw[name]
      return v !== undefined && v !== null && String(v).trim() !== ''
    })
  }, [commands, paramValues])

  // 轮询单条指令结果：既可接刚刚下发的，也可接上一次会话留下的 pending
  const startPolling = useCallback((entryId, commandId) => {
    if (!commandId || pollTimersRef.current[entryId]) return

    let retries = 0
    const poll = async () => {
      try {
        const cmdResult = await mqttService.getCommandResult(commandId)
        if (cmdResult.acknowledged) {
          resolveEntry(deviceId, entryId, {
            status: 'acknowledged',
            response: cmdResult.response,
            respondedAt: cmdResult.responded_at,
          })
          return
        }
      } catch {
        // 查询失败忽略，继续轮询
      }
      retries++
      if (retries < POLL_MAX_RETRIES) {
        pollTimersRef.current[entryId] = setTimeout(poll, POLL_INTERVAL)
      } else {
        delete pollTimersRef.current[entryId]
        resolveEntry(deviceId, entryId, {
          status: 'timeout',
          response: null,
          respondedAt: null,
        })
      }
    }
    pollTimersRef.current[entryId] = setTimeout(poll, POLL_INTERVAL)
  }, [deviceId, resolveEntry])

  // 下发一条指令并记账（预设命令与命令行输入共用）
  const dispatch = useCallback(async ({ command, params, source = 'preset', display }) => {
    const entryId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const payloadParams = params && Object.keys(params).length > 0 ? params : undefined

    appendEntry(deviceId, {
      id: entryId,
      command,
      params: payloadParams,
      timestamp: new Date().toISOString(),
      status: 'pending',
      source,
      display,
    })
    // 该条已由这里接管轮询，挂载时的补轮询不再重复
    resumedIdsRef.current.add(entryId)

    try {
      const result = await mqttService.sendCommand(deviceId, command, payloadParams || {})
      updateEntry(deviceId, entryId, { commandId: result.command_id })
      showSuccess(`命令 "${display || command}" 已发送`)
      if (onCommandSent) onCommandSent(result.command_id)
      startPolling(entryId, result.command_id)
    } catch (err) {
      showError(err?.response?.data?.detail || '命令发送失败')
      resolveEntry(deviceId, entryId, { status: 'error', response: null })
    } finally {
      setSending(null)
    }
  }, [deviceId, appendEntry, updateEntry, resolveEntry, startPolling, showSuccess, showError, onCommandSent])

  const handleSendCommand = useCallback((command) => {
    const cmdDef = commands.find(c => c.id === command)

    // 如果有参数但未填完，不发送
    if (cmdDef?.params_schema && !paramsReady(command)) return

    if (cmdDef?.require_confirm) {
      if (!window.confirm(`确定要对设备执行 "${cmdDef.label}" 吗？`)) return
    }

    setSending(command)
    dispatch({ command, params: getPayloadParams(command) })
  }, [commands, getPayloadParams, paramsReady, dispatch])

  // 命令行：整行输入交给设备端的 execute_shell
  const handleShellSubmit = useCallback((line) => {
    const trimmed = line.trim()
    if (!trimmed || sending !== null) return

    setSending(SHELL_COMMAND)
    pushInput(deviceId, trimmed)
    historyCursorRef.current = -1
    setInput('')
    dispatch({
      command: SHELL_COMMAND,
      params: { [SHELL_PARAM_KEY]: trimmed },
      source: 'shell',
      display: trimmed,
    })
  }, [deviceId, sending, pushInput, dispatch])

  // 命令行输入框的按键处理：回车执行、↑↓ 翻历史、Ctrl+C 清空
  const handleInputKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleShellSubmit(input)
      return
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (inputHistory.length === 0) return
      e.preventDefault()
      const cursor = historyCursorRef.current
      let next
      if (e.key === 'ArrowUp') {
        next = cursor + 1
        if (next >= inputHistory.length) next = inputHistory.length - 1
      } else {
        next = cursor - 1
        if (next < -1) next = -1
      }
      historyCursorRef.current = next
      setInput(next === -1 ? '' : inputHistory[next])
      return
    }

    if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      historyCursorRef.current = -1
      setInput('')
    }
  }, [input, inputHistory, handleShellSubmit])

  // 组件挂载 / 卸载：卸载只清理定时器，不清空记录；
  // 重新挂载时把仍未回复的指令重新接上轮询 —— 会话得以延续
  useEffect(() => {
    logs.forEach(entry => {
      if (resumedIdsRef.current.has(entry.id)) return
      if (entry.status !== 'pending') return
      resumedIdsRef.current.add(entry.id)

      // 拿到 command_id 的：把中断的结果重新接回来
      if (entry.commandId) {
        startPolling(entry.id, entry.commandId)
        return
      }
      // 没拿到 command_id：说明上次是在发送过程中离开的，下发是否成功无从得知，标为失败
      resolveEntry(deviceId, entry.id, { status: 'error', response: null })
    })
  }, [logs, startPolling, resolveEntry, deviceId])

  useEffect(() => {
    const timers = pollTimersRef.current
    return () => {
      Object.values(timers).forEach(clearTimeout)
      pollTimersRef.current = {}
    }
  }, [])

  // 记录面板保持贴底滚动（用户手动往上翻阅时不打断）
  useEffect(() => {
    const el = journalBodyRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (nearBottom) el.scrollTop = el.scrollHeight
  }, [logs])

  const handleClearLogs = useCallback(() => {
    clearEntriesStore(deviceId)
  }, [deviceId, clearEntriesStore])

  const statusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock size={14} className="cmd-status-pending" />
      case 'acknowledged': return <CheckCircle2 size={14} className="cmd-status-ok" />
      case 'timeout': return <Clock size={14} className="cmd-status-timeout" />
      case 'error': return <XCircle size={14} className="cmd-status-error" />
      default: return null
    }
  }

  const statusLabel = (status) => {
    switch (status) {
      case 'pending': return '等待回复…'
      case 'acknowledged': return '已回复'
      case 'timeout': return '超时'
      case 'error': return '发送失败'
      default: return status
    }
  }

  const resolveIcon = (iconName) => {
    return ICON_MAP[iconName] || Terminal
  }

  // ── 拖拽调整「预设命令」面板宽度 ──
  const clampWidth = useCallback((raw) => {
    const containerWidth = containerRef.current?.clientWidth || PRESET_WIDTH_MAX + JOURNAL_WIDTH_MIN
    const max = Math.max(PRESET_WIDTH_MIN, Math.min(PRESET_WIDTH_MAX, containerWidth - JOURNAL_WIDTH_MIN))
    return Math.round(Math.min(Math.max(raw, PRESET_WIDTH_MIN), max))
  }, [])

  const startResize = useCallback((e) => {
    if (e.button !== undefined && e.button !== 0) return
    e.preventDefault()

    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setResizing(true)

    const onMove = (ev) => setPresetWidth(clampWidth(rect.right - ev.clientX))
    const onUp = () => {
      setResizing(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }, [clampWidth, setPresetWidth])

  // 键盘可达：聚焦分隔条后用 ←/→ 微调
  const handleResizerKeyDown = useCallback((e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    setPresetWidth(clampWidth(presetWidth + (e.key === 'ArrowLeft' ? 16 : -16)))
  }, [presetWidth, setPresetWidth, clampWidth])

  return (
    <div
      ref={containerRef}
      className={`command-console${fill ? ' command-console--fill' : ''}${resizing ? ' command-console--resizing' : ''}`}
      style={{ '--cmd-preset-w': `${presetWidth}px` }}
    >
      {/* ── 左侧：执行记录 + 命令行输入 ── */}
      <section className="cmd-journal">
        <header className="cmd-journal-head">
          <span className="cmd-journal-title">
            <Terminal size={14} />
            执行记录
          </span>
          <span className="cmd-journal-count" title={`本机保留最近 ${MAX_ENTRIES} 条执行记录`}>{logs.length}</span>
          {logs.length > 0 && (
            <button
              type="button"
              className="cmd-journal-clear"
              onClick={handleClearLogs}
              disabled={sending !== null}
              title="清空本机保存的执行记录"
            >
              <Trash2 size={12} />
              清空
            </button>
          )}
        </header>

        <div className="cmd-journal-body" ref={journalBodyRef}>
          {logs.length === 0 ? (
            <div className="cmd-journal-empty">
              <p className="cmd-journal-empty-title">暂无执行记录</p>
              <p className="cmd-journal-empty-hint">
                从下方命令行输入，或从右侧预设命令下发，返回值会实时回显在这里。
              </p>
            </div>
          ) : (
            /* 终端习惯：新的在下，旧的在上 */
            logs.slice().reverse().map((entry) => {
              const isExpanded = expandedIds.includes(entry.id)
              const hasBody = entry.status !== 'pending'
              const isShell = entry.source === 'shell'
              const outText =
                entry.status === 'acknowledged'
                  ? (isShell ? formatShellOutput(entry.response) : formatResponse(entry.response))
                  : entry.status === 'timeout'
                    ? '设备未在 20 秒内回复'
                    : '命令下发失败，请检查设备在线状态'

              return (
                <div key={entry.id} className={`cmd-jl-entry cmd-jl-${entry.status}`}>
                  <div
                    className={`cmd-jl-line${hasBody ? ' cmd-jl-line--clickable' : ''}`}
                    onClick={() => hasBody && toggleExpanded(deviceId, entry.id)}
                  >
                    <ChevronDown
                      size={12}
                      className={`cmd-jl-chevron ${isExpanded ? 'rotated' : ''}${!hasBody ? ' cmd-jl-chevron-hidden' : ''}`}
                    />
                    <span className="cmd-jl-time">{formatTime(entry.timestamp)}</span>
                    <span className="cmd-jl-prompt">$</span>
                    <span className="cmd-jl-cmd">{isShell ? (entry.display || entry.command) : entry.command}</span>
                    {!isShell && entry.params && (
                      <span className="cmd-jl-params">{formatParams(entry.params)}</span>
                    )}
                    <span className={`cmd-jl-status cmd-jl-status-${entry.status}`}>
                      {statusIcon(entry.status)}
                      {statusLabel(entry.status)}
                    </span>
                  </div>
                  {isExpanded && hasBody && (
                    <pre className="cmd-jl-out">{outText}</pre>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* ── 命令行输入：整行经 execute_shell 下发到设备 ── */}
        <form
          className="cmd-cli"
          onSubmit={(e) => { e.preventDefault(); handleShellSubmit(input) }}
        >
          <span className="cmd-cli-prompt">$</span>
          <input
            ref={cliInputRef}
            className="cmd-cli-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={`输入命令行内容，回车经 ${SHELL_COMMAND} 下发`}
            disabled={sending !== null}
            spellCheck={false}
            autoComplete="off"
          />
          <Button
            type="submit"
            size="small"
            variant="primary"
            icon={sending === SHELL_COMMAND ? null : Send}
            loading={sending === SHELL_COMMAND}
            disabled={sending !== null || input.trim() === ''}
          >
            执行
          </Button>
        </form>

        <footer className="cmd-journal-foot">
          <span className="cmd-journal-blink" />
          <span>↑↓ 翻输入历史 · Ctrl+C 清空 · 记录本机保存，离开页面再回来继续同一会话</span>
        </footer>
      </section>

      {/* ── 左右面板之间的可拖拽分隔条 ── */}
      <div
        className={`cmd-resizer${resizing ? ' cmd-resizer--active' : ''}`}
        role="separator"
        aria-orientation="vertical"
        aria-label="调整预设命令面板宽度"
        tabIndex={0}
        title="拖拽调整宽度，双击复位"
        onPointerDown={startResize}
        onDoubleClick={() => setPresetWidth(DEFAULT_PRESET_WIDTH)}
        onKeyDown={handleResizerKeyDown}
      />

      {/* ── 右侧：预设命令面板 ── */}
      <section className="cmd-presets">
        <header className="cmd-presets-head">
          <span className="cmd-presets-title">
            <Zap size={14} />
            预设命令
          </span>
          <span className="cmd-presets-device" title={deviceId}>
            {deviceId.length > 12 ? `${deviceId.slice(0, 12)}…` : deviceId}
          </span>
        </header>

        <div className="cmd-presets-body">
          {/* 指令列表加载中 */}
          {commandsLoading && (
            <div className="command-console-loading">
              <Loader2 size={18} className="spinning-inline" />
              <span>正在获取设备可执行指令…</span>
            </div>
          )}

          {/* 指令获取失败提示 */}
          {!commandsLoading && commandsError && (
            <div className="command-console-notice">
              <AlertTriangle size={14} />
              <span>{commandsError}</span>
            </div>
          )}

          {/* 指令列表 */}
          {!commandsLoading && commands.length > 0 && (
            <div className="command-list">
              {commands.map((cmd) => {
                const IconComp = resolveIcon(cmd.icon)
                const hasParams = cmd.params_schema && Object.keys(cmd.params_schema).length > 0
                const isReady = paramsReady(cmd.id)
                const currentParams = paramValues[cmd.id] || {}

                return (
                  <div key={cmd.id} className={`command-item${hasParams ? ' command-item--with-params' : ''}`}>
                    <div className="command-item-info">
                      <div className="command-item-name">
                        <IconComp size={14} />
                        <span>{cmd.label}</span>
                        {cmd.require_confirm && (
                          <span className="cmd-confirm-badge" title="需要二次确认">确认</span>
                        )}
                      </div>
                      <p className="command-item-desc">{cmd.description}</p>
                    </div>

                    <Button
                      variant={cmd.require_confirm ? 'warning' : 'primary'}
                      size="small"
                      icon={sending === cmd.id ? null : Send}
                      loading={sending === cmd.id}
                      onClick={() => handleSendCommand(cmd.id)}
                      disabled={sending !== null || (hasParams && !isReady)}
                      title={hasParams && !isReady ? '请填写所有参数' : ''}
                    >
                      {sending === cmd.id ? '发送中' : '发送'}
                    </Button>

                    {/* 参数输入区 — 整行换行显示 */}
                    {hasParams && (
                      <div className="cmd-param-fields">
                        {Object.entries(cmd.params_schema).map(([name, type]) => (
                          <div key={name} className="cmd-param-field">
                            <label className="cmd-param-label">{name}</label>
                            <input
                              type={type === 'number' ? 'number' : 'text'}
                              className="cmd-param-input"
                              placeholder={name}
                              value={currentParams[name] ?? ''}
                              onChange={(e) => updateParam(cmd.id, name, e.target.value)}
                              disabled={sending !== null}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* 无可用指令 */}
          {!commandsLoading && !commandsError && commands.length === 0 && (
            <div className="command-console-notice">
              <Info size={14} />
              <span>该设备暂无可执行指令</span>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default CommandConsole
