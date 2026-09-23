"""设备指令状态流转测试。

只覆盖纯逻辑：用假 Session 替换数据库访问，不依赖 Postgres。
重点守住「轮询补取」这条路径——sent 指令若不能推进为 delivered，
会被每次轮询反复返回，直到过期。
"""
from types import SimpleNamespace

from database.db_services import device_command_service as svc


class _FakeQuery:
    def __init__(self, record):
        self._record = record

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._record


class _FakeDB:
    def __init__(self, record):
        self._record = record

    def query(self, model):
        return _FakeQuery(self._record)

    def commit(self):
        pass

    def refresh(self, obj):
        pass

    def rollback(self):
        pass


def _record(**overrides):
    """构造一条指令记录，字段与 _to_dict 读取范围保持一致"""
    fields = dict(
        id=1,
        command_id="cmd-1",
        device_id="d-1",
        device_name="1号网关",
        command="ping",
        params={},
        status="pending",
        transport="mqtt",
        source="console",
        api_key_id="k-1",
        issued_by="u-1",
        result={},
        error_message=None,
        created_at=None,
        sent_at=None,
        delivered_at=None,
        executed_at=None,
        expires_at=None,
        updated_at=None,
    )
    fields.update(overrides)
    return SimpleNamespace(**fields)


def test_mark_delivered_advances_pending_and_sent():
    """pending 与 sent 都应推进为 delivered"""
    for start in ("pending", "sent"):
        record = _record(status=start)
        result = svc.mark_delivered(_FakeDB(record), "cmd-1")

        assert result["status"] == "delivered"
        assert record.delivered_at is not None


def test_mark_delivered_keeps_final_status():
    """终态指令不应被改写"""
    for start in ("acked", "failed", "cancelled", "expired"):
        record = _record(status=start)
        result = svc.mark_delivered(_FakeDB(record), "cmd-1")

        assert result["status"] == start
        assert record.delivered_at is None
