import { useState } from 'react'
import { Button } from '@/components/ui'
import useToast from '@/hooks/useToast'
import { mqttService } from '@/services/mqttService'
import { Terminal, Send, Info, Zap, Sliders, RotateCw } from 'lucide-react'

const QUICK_COMMANDS = [
  { id: 'get_info', label: '获取设备信息', icon: Info, description: '获取设备基本信息、平台、主机名等' },
  { id: 'ping', label: '心跳检测', icon: Zap, description: '立即检测设备是否响应' },
  { id: 'get_metrics', label: '运行指标', icon: Sliders, description: '获取 CPU/内存/温度等运行指标' },
  { id: 'reboot', label: '重启设备', icon: RotateCw, description: '向设备发送重启指令（需确认）' },
]

const CommandConsole = ({ deviceId, onCommandSent }) => {
  const { success: showSuccess, error: showError } = useToast()
  const [sending, setSending] = useState(null)

  const handleSendCommand = async (command) => {
    if (command === 'reboot') {
      if (!window.confirm('确定要重启该设备吗？')) return
    }

    setSending(command)
    try {
      const result = await mqttService.sendCommand(deviceId, command)
      showSuccess(`命令 "${command}" 已发送`)
      if (onCommandSent) onCommandSent(result.command_id)
    } catch (err) {
      showError(err?.response?.data?.detail || '命令发送失败')
    } finally {
      setSending(null)
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
    </div>
  )
}

export default CommandConsole
