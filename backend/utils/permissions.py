"""
API 密钥权限定义

一个密钥可以持有 1~3 种权限，权限决定"持有该密钥的远程设备/第三方系统"能调用哪类接口：

| 权限值           | 名称     | 语义                                   | 典型载体               |
|------------------|----------|----------------------------------------|------------------------|
| data_upload      | 数据上传 | 将自身采集的数据写入云端数据库/对象存储 | 田间传感器、边缘网关   |
| data_read        | 数据读取 | 从云端数据库读取已存储的数据             | 分析平台、边缘侧模型   |
| device_control   | 设备控制 | 云端通过该密钥对"绑定设备"下发控制指令   | 运维平台、自动化系统   |

说明：
- JWT（Web 控制台登录用户）视为账号所有者，不做权限项校验，可调用全部接口；
- API 密钥（X-API-Key）必须显式持有对应权限，否则返回 403；
- 密钥与设备不绑定：一把密钥可作用于该用户名下的任意设备，鉴权只看权限项。
"""

from typing import Any, Iterable, List, Optional

import json

# ============ 权限常量 ============

PERMISSION_DATA_UPLOAD = "data_upload"
PERMISSION_DATA_READ = "data_read"
PERMISSION_DEVICE_CONTROL = "device_control"

ALL_PERMISSIONS: List[str] = [
    PERMISSION_DATA_UPLOAD,
    PERMISSION_DATA_READ,
    PERMISSION_DEVICE_CONTROL,
]

# 创建密钥时的默认权限：保持与历史行为一致（只上传）
DEFAULT_PERMISSIONS: List[str] = [PERMISSION_DATA_UPLOAD]


# ============ 权限说明书（供接口/前端/文档共用） ============

PERMISSION_DEFINITIONS: List[dict] = [
    {
        "value": PERMISSION_DATA_UPLOAD,
        "label": "数据上传",
        "description": "允许持有该密钥的设备把自身采集的数据写入云端数据库与对象存储",
        "scenario": "无浏览器的采集终端（传感器、无人机、边缘网关）定时上报环境/土壤/图像数据",
        "endpoints": [
            "POST /api/raw-data/upload-data",
            "POST /api/raw-data/upload-file"
        ],
        "requires_device_binding": False
    },
    {
        "value": PERMISSION_DATA_READ,
        "label": "数据读取",
        "description": "允许持有该密钥的一方从云端数据库读取该账号名下的数据（只读，不能写入）",
        "scenario": "边缘侧本地分析、第三方平台/大屏拉取历史数据与时序数据",
        "endpoints": [
            "GET /api/raw-data/list",
            "GET /api/raw-data/{raw_data_id}",
            "GET /api/raw-data/timeseries",
            "GET /api/raw-data/statistics",
            "GET /api/raw-data/overview",
            "GET /api/raw-data/export"
        ],
        "requires_device_binding": False
    },
    {
        "value": PERMISSION_DEVICE_CONTROL,
        "label": "设备控制",
        "description": "允许云端通过该密钥向该用户名下的设备下发控制指令，并查询/回收指令执行结果",
        "scenario": "远程运维：重启设备、调整采样配置、拉取运行指标、设备侧回执上报",
        "endpoints": [
            "POST /api/device-commands",
            "GET /api/device-commands",
            "GET /api/device-commands/{command_id}",
            "POST /api/device-commands/{command_id}/cancel",
            "GET /api/device-commands/pending（设备侧拉取）",
            "POST /api/device-commands/{command_id}/result（设备侧回执）"
        ],
        # 密钥不与设备绑定：一把密钥可作用于该用户名下的任意设备
        "requires_device_binding": False
    }
]

_PERMISSION_DEF_MAP = {item["value"]: item for item in PERMISSION_DEFINITIONS}


def get_permission_definition(permission: str) -> Optional[dict]:
    """获取单个权限的说明（未知权限返回 None）"""
    return _PERMISSION_DEF_MAP.get(permission)


# ============ 权限列表的解析与序列化 ============
# 历史数据里 permissions 用 str(list) 写入（Python 字面量，单引号），
# 新数据统一用 json.dumps 写入。解析时两种都要兼容。


def parse_permissions(raw: Any) -> List[str]:
    """
    将数据库中存储的权限字符串解析为列表

    兼容三种形态：
    1. JSON 数组：'["data_upload"]'（新数据）
    2. Python 字面量：'['data_upload']'（历史数据）
    3. 已经是 list 的情况
    """
    if raw is None:
        return []
    if isinstance(raw, (list, tuple, set)):
        return [str(item) for item in raw if str(item)]
    if not isinstance(raw, str):
        return []

    text = raw.strip()
    if not text:
        return []

    try:
        parsed = json.loads(text)
    except (ValueError, TypeError):
        # 退回 Python 字面量解析，避免使用 eval 带来的代码注入风险
        try:
            import ast
            parsed = ast.literal_eval(text)
        except (ValueError, SyntaxError):
            return []

    if isinstance(parsed, (list, tuple, set)):
        return [str(item) for item in parsed if str(item)]
    if isinstance(parsed, str):
        return [parsed]
    return []


def dump_permissions(permissions: Optional[Iterable[str]]) -> str:
    """将权限列表序列化为 JSON 字符串（统一存储格式）"""
    if not permissions:
        return json.dumps([])
    return json.dumps([str(item) for item in permissions])


def normalize_permissions(
    permissions: Optional[Iterable[str]],
    strict: bool = True
) -> List[str]:
    """
    规范化权限列表：去空白、去重、剔除未知权限

    Args:
        permissions: 原始权限列表
        strict: True 时遇到未知权限抛 ValueError；False 时静默丢弃

    Returns:
        List[str]: 规范化后的权限列表（顺序与 ALL_PERMISSIONS 一致）

    Raises:
        ValueError: strict=True 且存在未知权限
    """
    if not permissions:
        return []

    cleaned: List[str] = []
    unknown: List[str] = []

    for item in permissions:
        value = str(item).strip()
        if not value:
            continue
        if value in ALL_PERMISSIONS:
            if value not in cleaned:
                cleaned.append(value)
        else:
            unknown.append(value)

    if unknown and strict:
        raise ValueError(
            f"未知的权限值: {', '.join(unknown)}；可选权限: {', '.join(ALL_PERMISSIONS)}"
        )

    # 按固定顺序输出，保证存储结果稳定
    return [p for p in ALL_PERMISSIONS if p in cleaned]


def has_permission(permissions: Optional[Iterable[str]], permission: str) -> bool:
    """判断权限列表是否包含指定权限"""
    return permission in (permissions or [])


def requires_device_binding(permission: str) -> bool:
    """该权限是否要求密钥绑定设备"""
    definition = get_permission_definition(permission)
    return bool(definition and definition.get("requires_device_binding"))


__all__ = [
    "PERMISSION_DATA_UPLOAD",
    "PERMISSION_DATA_READ",
    "PERMISSION_DEVICE_CONTROL",
    "ALL_PERMISSIONS",
    "DEFAULT_PERMISSIONS",
    "PERMISSION_DEFINITIONS",
    "get_permission_definition",
    "parse_permissions",
    "dump_permissions",
    "normalize_permissions",
    "has_permission",
    "requires_device_binding",
]
