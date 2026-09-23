"""原始数据 ↔ MinIO 一致性巡检服务测试。

只覆盖纯逻辑：通过 monkeypatch 替换 _iter_raw_data_rows，避免依赖数据库/PostGIS。
"""
from datetime import datetime
from types import SimpleNamespace

from database.db_services import raw_data_integrity_service as svc


def _row(id_, object_key, session_id="s-1", session_exists=True):
    return SimpleNamespace(
        id=id_,
        session_id=session_id,
        object_key=object_key,
        data_type="image",
        data_subtype="rgb",
        data_format="jpg",
        capture_time=datetime(2026, 3, 5, 11, 19, 44),
        session_pk=session_id if session_exists else None,
    )


def test_classify_rows_splits_orphan_and_missing():
    rows = [
        _row("r1", "user_1/data/session_a/1.jpg", session_exists=True),   # 正常
        _row("r2", "user_1/data/session_a/2.jpg", session_exists=False),  # 孤儿
        _row("r3", "user_1/raw/images/3.jpg", session_exists=True),       # 对象缺失
    ]
    existing = {"user_1/data/session_a/1.jpg", "user_1/data/session_a/2.jpg"}

    result = svc.classify_rows(rows, existing)

    assert [i["id"] for i in result["orphan_rows"]] == ["r2"]
    assert [i["id"] for i in result["missing_objects"]] == ["r3"]
    assert result["missing_objects"][0]["session_exists"] is True


def test_scan_report_counts(monkeypatch):
    rows = [
        _row("r1", "user_1/data/session_a/1.jpg", session_exists=True),
        _row("r2", "user_1/raw/images/2.jpg", session_exists=True),
        _row("r3", "user_1/raw/images/3.jpg", session_exists=False),
    ]
    monkeypatch.setattr(svc, "_iter_raw_data_rows", lambda db, limit=None: rows)

    report = svc.scan_object_key_integrity(
        None, {"user_1/data/session_a/1.jpg"}, sample_limit=10
    )

    assert report["checked"] == 3
    assert report["orphan_rows"] == 1
    assert report["missing"] == 2
    assert report["missing_with_orphan_session"] == 1  # r3：会话没了 + 文件没了
    assert report["missing_in_session"] == 1           # r2：会话还在，只是文件没了
    assert report["truncated"] is False                # 未设 scan_limit


def test_scan_report_marks_truncation(monkeypatch):
    """扫描被 scan_limit 截断时，报告必须如实标记，避免计数被当成全量结论"""
    rows = [_row("r1", "user_1/raw/images/1.jpg", session_exists=False)]
    monkeypatch.setattr(svc, "_iter_raw_data_rows", lambda db, limit=None: rows[:limit])

    report = svc.scan_object_key_integrity(None, set(), scan_limit=1)

    assert report["checked"] == 1
    assert report["truncated"] is True


def test_collect_targets_default_only_orphan(monkeypatch):
    rows = [
        _row("r2", "user_1/raw/images/2.jpg", session_exists=True),
        _row("r3", "user_1/raw/images/3.jpg", session_exists=False),
    ]
    monkeypatch.setattr(svc, "_iter_raw_data_rows", lambda db, limit=None: rows)

    targets = svc.collect_integrity_targets(None, set())

    assert [i["id"] for i in targets] == ["r3"]


def test_collect_targets_includes_missing_in_session_when_asked(monkeypatch):
    rows = [
        _row("r2", "user_1/raw/images/2.jpg", session_exists=True),
        _row("r3", "user_1/raw/images/3.jpg", session_exists=False),
    ]
    monkeypatch.setattr(svc, "_iter_raw_data_rows", lambda db, limit=None: rows)

    targets = svc.collect_integrity_targets(None, set(), include_missing_in_session=True)

    # r3 同时在「孤儿」和「对象缺失」里，去重后只出现一次
    assert [i["id"] for i in targets] == ["r3", "r2"]
