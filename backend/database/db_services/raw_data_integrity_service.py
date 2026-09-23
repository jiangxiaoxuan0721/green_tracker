"""
原始数据 ↔ MinIO 一致性巡检

背景：
    上传路径早期是 user_{user_id}/raw/images/...，后来统一为
    user_{user_id}/data/session_{session_id}/...。旧路径的文件被清理或从未落地后，
    库里会留下「有 object_key、MinIO 里没有对象」的悬空记录，
    前端表现为图片打不开。

这里提供：
- scan_object_key_integrity：比对库中的 object_key 与 MinIO 实际对象，产出体检报告
- delete_raw_data_records：批量删除记录（含子表，子表缺表时跳过）
"""

from typing import Any, Dict, Iterable, List, Optional, Sequence, Set

from sqlalchemy import inspect
from sqlalchemy.orm import Session

from database.db_models.user_models import (
    CollectionSession,
    DataProcessing,
    RawData,
    RawDataTag,
)


def _iter_raw_data_rows(db: Session, limit: Optional[int] = None):
    """查询带 object_key 的记录，并标记其所属会话是否仍存在"""
    query = (
        db.query(
            RawData.id,
            RawData.session_id,
            RawData.object_key,
            RawData.data_type,
            RawData.data_subtype,
            RawData.data_format,
            RawData.capture_time,
            CollectionSession.id.label("session_pk")
        )
        .outerjoin(CollectionSession, CollectionSession.id == RawData.session_id)
        .filter(RawData.object_key.isnot(None))
        .order_by(RawData.capture_time.desc())
    )

    if limit:
        query = query.limit(limit)

    return query.all()


def _row_to_item(row: Any) -> Dict[str, Any]:
    """查询结果行 → 可序列化的字典"""
    return {
        "id": str(row.id),
        "session_id": str(row.session_id) if row.session_id else None,
        "object_key": row.object_key,
        "data_type": row.data_type,
        "data_subtype": row.data_subtype,
        "data_format": row.data_format,
        "capture_time": row.capture_time.isoformat() if row.capture_time else None,
        # 会话已被删除时，这条数据在界面上永远看不到，属于孤儿记录
        "session_exists": row.session_pk is not None
    }


def classify_rows(rows: Iterable[Any], existing_object_keys: Set[str]) -> Dict[str, List[Dict[str, Any]]]:
    """
    把记录分成两类（纯函数，便于单测）

    Args:
        rows: _iter_raw_data_rows 的查询结果
        existing_object_keys: MinIO 中真实存在的对象路径集合

    Returns:
        dict: {"orphan_rows": 会话已不存在的记录, "missing_objects": 对象缺失的记录}
    """
    orphan_rows: List[Dict[str, Any]] = []
    missing_objects: List[Dict[str, Any]] = []

    for row in rows:
        item = _row_to_item(row)
        if not item["session_exists"]:
            orphan_rows.append(item)
        if item["object_key"] not in existing_object_keys:
            missing_objects.append(item)

    return {"orphan_rows": orphan_rows, "missing_objects": missing_objects}


def scan_object_key_integrity(
    db: Session,
    existing_object_keys: Set[str],
    sample_limit: int = 20,
    scan_limit: Optional[int] = None
) -> Dict[str, Any]:
    """
    体检：库里有 object_key、但 MinIO 里没有对应对象的记录

    Args:
        db: 数据库会话
        existing_object_keys: MinIO 中真实存在的对象路径集合
        sample_limit: 报告里最多返回多少条样例
        scan_limit: 最多扫描多少条记录（None 表示全量）

    Returns:
        dict: 体检报告
    """
    rows = _iter_raw_data_rows(db, limit=scan_limit)
    classified = classify_rows(rows, existing_object_keys)

    missing = classified["missing_objects"]
    orphan_ids = {item["id"] for item in classified["orphan_rows"]}

    return {
        "checked": len(rows),
        # 受 scan_limit 截断时，各项计数只是「已扫描部分」的统计，不是全量结论
        "truncated": scan_limit is not None and len(rows) >= scan_limit,
        "orphan_rows": len(classified["orphan_rows"]),
        "missing": len(missing),
        # 会话已删 + 文件也没了：可以直接清掉
        "missing_with_orphan_session": sum(1 for item in missing if item["id"] in orphan_ids),
        # 会话还在但文件没了：需要人工确认，默认不动
        "missing_in_session": sum(1 for item in missing if item["id"] not in orphan_ids),
        "samples": missing[:sample_limit],
    }


def collect_integrity_targets(
    db: Session,
    existing_object_keys: Set[str],
    include_missing_in_session: bool = False,
    limit: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    收集待清理的记录

    - 默认只收「会话已不存在」的孤儿记录：界面上看不到，文件也无引用，可直接删
    - include_missing_in_session=True 时，再收「会话仍在但对象已缺失」的记录

    Args:
        db: 数据库会话
        existing_object_keys: MinIO 中真实存在的对象路径集合
        include_missing_in_session: 是否包含会话仍在但对象缺失的记录
        limit: 最多扫描多少条记录
    """
    classified = classify_rows(_iter_raw_data_rows(db, limit=limit), existing_object_keys)

    targets = list(classified["orphan_rows"])

    if include_missing_in_session:
        known_ids = {item["id"] for item in targets}
        targets.extend(
            item for item in classified["missing_objects"]
            if item["id"] not in known_ids
        )

    # 两类可能重叠，按ID去重
    unique: List[Dict[str, Any]] = []
    seen: Set[str] = set()
    for item in targets:
        if item["id"] not in seen:
            seen.add(item["id"])
            unique.append(item)

    return unique


def get_object_keys_by_ids(db: Session, ids: Sequence[str]) -> List[str]:
    """取回这些记录的对象路径（用于清理仍存在的孤儿文件）"""
    id_list = [str(i) for i in ids if i]
    if not id_list:
        return []

    rows = db.query(RawData.object_key).filter(RawData.id.in_(id_list)).all()
    return [row[0] for row in rows if row[0]]


def delete_raw_data_records(db: Session, ids: Sequence[str]) -> int:
    """
    按ID批量删除原始数据及其子表记录

    Args:
        db: 数据库会话
        ids: 原始数据ID列表

    Returns:
        int: 实际删除的记录数
    """
    id_list = [str(i) for i in ids if i]
    if not id_list:
        return 0

    # 子表可能尚未建（历史库缺表），缺表时跳过
    existing_tables = set(inspect(db.bind).get_table_names())

    if DataProcessing.__tablename__ in existing_tables:
        db.query(DataProcessing).filter(
            DataProcessing.raw_data_id.in_(id_list)
        ).delete(synchronize_session=False)

    if RawDataTag.__tablename__ in existing_tables:
        db.query(RawDataTag).filter(
            RawDataTag.raw_data_id.in_(id_list)
        ).delete(synchronize_session=False)

    deleted = db.query(RawData).filter(
        RawData.id.in_(id_list)
    ).delete(synchronize_session=False)

    db.commit()

    return deleted or 0
