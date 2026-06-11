import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui'
import useToast from '@/hooks/useToast'
import { mqttService } from '@/services/mqttService'
import {
  Terminal, Send, Zap, Sliders, RotateCw, Info,
  CheckCircle2, XCircle, Clock, ChevronDown, AlertTriangle, Loader2,
} from 'lucide-react'

const POLL_INTERVAL = 2000
const POLL_MAX_RETRIES = 10

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

const CommandConsole = ({ deviceId, onCommandSent }) => {
  const { success: showSuccess, error: showError } = useToast()
  const [sending, setSending] = useState(null)
  const [logs, setLogs] = useState([])
  const [logExpanded, setLogExpanded] = useState(false)
  const [expandedEntries, setExpandedEntries] = useState(new Set())
  const pollTimersRef = useRef({})

  // 动态获取设备支持指令
  const [commands, setCommands] = useState([])
  const [commandsLoading, setCommandsLoading] = useState(true)
  const [commandsError, setCommandsError] = useState(null)

  // 参数输入状态：{ commandId: { fieldName: stringValue } }
  const [paramValues, setParamValues] = useState({})

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

  // 当命令列表加载后，为有参数的命令初始化空值
  useEffect(() => {
    const init = {}
    commands.filter(c => c.params_schema).forEach(c => {
      init[c.id] = {}
      Object.entries(c.params_schema).forEach(([name, type]) => {
        init[c.id][name] = defaultParamValue(type)
      })
    })
    setParamValues(init)
  }, [commands])

  const updateParam = useCallback((cmdId, fieldName, value) => {
    setParamValues(prev => ({
      ...prev,
      [cmdId]: { ...(prev[cmdId] || {}), [fieldName]: value },
    }))
  }, [])

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

  const handleSendCommand = useCallback(async (command) => {
    const cmdDef = commands.find(c => c.id === command)

    // 如果有参数但未填完，不发送
    if (cmdDef?.params_schema && !paramsReady(command)) return

    if (cmdDef?.require_confirm) {
      if (!window.confirm(`确定要对设备执行 "${cmdDef.label}" 吗？`)) return
    }

    const entryId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const params = getPayloadParams(command)
    const entry = {
      id: entryId,
      command,
      params: Object.keys(params).length > 0 ? params : undefined,
      timestamp: new Date().toISOString(),
      status: 'pending',
      response: null,
    }
    setLogs(prev => [entry, ...prev])
    if (!logExpanded) setLogExpanded(true)

    setSending(command)
    try {
      const result = await mqttService.sendCommand(deviceId, command, params)
      showSuccess(`命令 "${command}" 已发送`)
      if (onCommandSent) onCommandSent(result.command_id)

      let retries = 0
      const poll = async () => {
        try {
          const cmdResult = await mqttService.getCommandResult(result.command_id)
          if (cmdResult.acknowledged) {
            setLogs(prev =>
              prev.map(l => l.id === entryId
                ? { ...l, status: 'acknowledged', response: cmdResult.response, respondedAt: cmdResult.responded_at }
                : l
              )
            )
            setExpandedEntries(prev => new Set([...prev, entryId]))
            return
          }
        } catch {
          // 查询失败忽略，继续轮询
        }
        retries++
        if (retries < POLL_MAX_RETRIES) {
          pollTimersRef.current[entryId] = setTimeout(poll, POLL_INTERVAL)
        } else {
          setLogs(prev =>
            prev.map(l => l.id === entryId
              ? { ...l, status: 'timeout' }
              : l
            )
          )
          setExpandedEntries(prev => new Set([...prev, entryId]))
        }
      }
      pollTimersRef.current[entryId] = setTimeout(poll, POLL_INTERVAL)
    } catch (err) {
      showError(err?.response?.data?.detail || '命令发送失败')
      setLogs(prev =>
        prev.map(l => l.id === entryId
          ? { ...l, status: 'error' }
          : l
        )
      )
      setExpandedEntries(prev => new Set([...prev, entryId]))
    } finally {
      setSending(null)
    }
  }, [deviceId, showSuccess, showError, onCommandSent, logExpanded, commands, getPayloadParams, paramsReady])

  const statusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock size={14} className="cmd-status-pending" />
      case 'acknowledged': return <CheckCircle2 size={14} className="cmd-status-ok" />
      case 'timeout': return <Clock size={14} className="cmd-status-timeout" />
      case 'error': return <XCircle size={14} className="cmd-status-error" />
      default: return null
    }
  }

  const toggleEntry = (entryId) => {
    setExpandedEntries(prev => {
      const next = new Set(prev)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })
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

  return (
    <div className="command-console">
      <div className="command-console-header">
        <Terminal size={16} />
        <h4>命令控制台</h4>
        <span className="command-device-id">
          {deviceId.length > 16 ? `${deviceId.slice(0, 8)}...` : deviceId}
        </span>
      </div>

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

      {/* 回复日志区域 */}
      {logs.length > 0 && (
        <div className={`cmd-reply-log ${logExpanded ? 'expanded' : ''}`}>
          <div className="cmd-reply-log-header" onClick={() => setLogExpanded(e => !e)}>
            <ChevronDown size={14} className={`cmd-chevron ${logExpanded ? 'rotated' : ''}`} />
            <span>消息回复日志</span>
            <span className="cmd-reply-count">{logs.length}</span>
          </div>
          <div className="cmd-reply-log-body">
            {logs.map((entry) => {
              const isExpanded = expandedEntries.has(entry.id)
              const hasBody = entry.status !== 'pending'
              return (
                <div key={entry.id} className={`cmd-reply-entry cmd-reply-${entry.status}`}>
                  <div
                    className={`cmd-reply-entry-header ${hasBody ? 'cmd-reply-entry-clickable' : ''}`}
                    onClick={() => hasBody && toggleEntry(entry.id)}
                  >
                    <ChevronDown
                      size={12}
                      className={`cmd-entry-chevron ${isExpanded ? 'rotated' : ''} ${!hasBody ? 'cmd-entry-chevron-hidden' : ''}`}
                    />
                    {statusIcon(entry.status)}
                    <span className="cmd-reply-cmd">{entry.command}{entry.params ? ` (${JSON.stringify(entry.params)})` : ''}</span>
                    <span className="cmd-reply-time">{formatTime(entry.timestamp)}</span>
                    <span className={`cmd-reply-status cmd-reply-status-${entry.status}`}>
                      {statusLabel(entry.status)}
                    </span>
                  </div>
                  {isExpanded && entry.status === 'acknowledged' && entry.response && (
                    <pre className="cmd-reply-body">{formatResponse(entry.response)}</pre>
                  )}
                  {isExpanded && entry.status === 'timeout' && (
                    <div className="cmd-reply-body cmd-reply-hint">设备未在 20 秒内回复</div>
                  )}
                  {isExpanded && entry.status === 'error' && (
                    <div className="cmd-reply-body cmd-reply-hint">命令下发失败，请检查设备在线状态</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default CommandConsole
