"""
设备指令定义（云端维护的唯一清单）

MQTT 控制台（/api/mqtt/devices/{id}/commands）与设备控制接口
（/api/device-commands）共用这一份定义，避免两处维护产生偏差。

设备端只需返回命令 ID 列表，展示信息（label/icon/是否二次确认）由云端查表补齐。
"""

# 命令定义表：命令 ID -> 展示信息
COMMAND_DEFS: dict = {
    "ping": {
        "label": "心跳检测",
        "description": "立即检测设备是否响应",
        "icon": "zap",
        "require_confirm": False
    },
    "get_info": {
        "label": "获取设备信息",
        "description": "获取设备基本信息、平台、主机名等",
        "icon": "info",
        "require_confirm": False
    },
    "get_metrics": {
        "label": "运行指标",
        "description": "获取 CPU/内存/温度等运行指标",
        "icon": "sliders",
        "require_confirm": False
    },
    "reboot": {
        "label": "重启设备",
        "description": "向设备发送重启指令",
        "icon": "rotate-cw",
        "require_confirm": True,
        "params_schema": {"delay": "number"}
    },
    "set_config": {
        "label": "写配置项",
        "description": "写入设备配置项（key/value）",
        "icon": "settings",
        "require_confirm": False,
        "params_schema": {"key": "string", "value": "string"}
    },
    "list_commands": {
        "label": "获取命令列表",
        "description": "获取设备支持的全部命令",
        "icon": "list",
        "require_confirm": False,
        "hidden": True
    },
    "revoke_control": {
        "label": "撤销远程控制授权",
        "description": "云端撤销该设备的远程控制授权，设备应停止接受指令并重新签到",
        "icon": "shield-off",
        "require_confirm": False,
        "hidden": True
    },
}

def list_command_definitions(include_hidden: bool = False) -> list:
    """
    返回指令清单

    Args:
        include_hidden: 是否包含内部指令（如 list_commands）
    """
    return [
        {"id": command_id, **info}
        for command_id, info in COMMAND_DEFS.items()
        if include_hidden or not info.get("hidden")
    ]
