import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui'
import useToast from '@/hooks/useToast'
import { mqttService } from '@/services/mqttService'
import { Terminal, Send, Info, Zap, Sliders, RotateCw, CheckCircle2, XCircle, Clock, ChevronDown } from 'lucide-react'

const POLL_INTERVAL = 2000
const POLL_MAX_RETRIES = 10

const QUICK_COMMANDS = [
  { id: 'get_info', label: '获取设备信息', icon: Info, description: '获取设备基本信息、平台、主机名等' },
  { id: 'ping', label: '心跳检测', icon: Zap, description: '立即检测设备是否响应' },
  { id: 'get_metrics', label: '运行指标', icon: Sliders, description: '获取 CPU/内存/温度等运行指标' },
  { id: 'reboot', label: '重启设备', icon: RotateCw, description: '向设备发送重启指令（需确认）' },
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

const CommandConsole = ({ deviceId, onCommandSent }) => {
  const { success: showSuccess, error: showError } = useToast()
  const [sending, setSending] = useState(null)
  const [logs, setLogs] = useState([])
  const [logExpanded, setLogExpanded] = useState(false)
  const [expandedEntries, setExpandedEntries] = useState(new Set())
  const pollTimersRef = useRef({})

  const handleSendCommand = useCallback(async (command) => {
    if (command === 'reboot') {
      if (!window.confirm('确定要重启该设备吗？')) return
    }

    const entryId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const entry = {
      id: entryId,
      command,
      timestamp: new Date().toISOString(),
      status: 'pending',
      response: null,
    }
    setLogs(prev => [entry, ...prev])
    if (!logExpanded) setLogExpanded(true)

    setSending(command)
    try {
      const result = await mqttService.sendCommand(deviceId, command)
      showSuccess(`命令 "${command}" 已发送`)
      if (onCommandSent) onCommandSent(result.command_id)

      // 开始轮询获取回复
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
  }, [deviceId, showSuccess, showError, onCommandSent, logExpanded])

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

  return (
    <div className="command-console">
      <div className="command-console-header">
        <Terminal size={16} />
        <h4>命令控制台</h4>
        <span className="command-device-id">
          {deviceId.length > 16 ? `${deviceId.slice(0, 8)}...` : deviceId}
        </span>
      </div>

      <div className="command-list">
        {QUICK_COMMANDS.map((cmd) => (
          <div key={cmd.id} className="command-item">
            <div className="command-item-info">
              <div className="command-item-name">
                <cmd.icon size={14} />
                <span>{cmd.label}</span>
              </div>
              <p className="command-item-desc">{cmd.description}</p>
            </div>
            <Button
              variant="primary"
              size="small"
              icon={sending === cmd.id ? null : Send}
              loading={sending === cmd.id}
              onClick={() => handleSendCommand(cmd.id)}
              disabled={sending !== null}
            >
              {sending === cmd.id ? '发送中' : '发送'}
            </Button>
          </div>
        ))}
      </div>

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
                    <span className="cmd-reply-cmd">{entry.command}</span>
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
