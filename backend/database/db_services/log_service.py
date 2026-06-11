"""
系统日志服务
提供系统日志的写入和查询操作
"""
from sqlalchemy.orm import Session
from sqlalchemy import desc
from database.db_models.user_models import SystemLog
from datetime import datetime
import uuid
from typing import Optional, List, Dict, Any


def create_log(
    db: Session,
    level: str,
    source: str,
    message: str,
    detail: Optional[str] = None,
    related_id: Optional[str] = None,
    related_type: Optional[str] = None,
) -> SystemLog:
    """
    写入一条系统日志

    Args:
        db: 用户数据库会话
        level: 日志级别（error/warning/info/success）
        source: 日志来源
        message: 日志消息
        detail: 详细信息（可选）
        related_id: 关联对象ID（可选）
        related_type: 关联对象类型（可选）

    Returns:
        SystemLog: 创建的日志对象
    """
    log = SystemLog(
        id=str(uuid.uuid4()),
        timestamp=datetime.utcnow(),
        level=level,
        source=source,
        message=message,
        detail=detail,
        related_id=related_id,
        related_type=related_type,
        created_at=datetime.utcnow(),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_logs(
    db: Session,
    page: int = 1,
    page_size: int = 20,
    level: Optional[str] = None,
    source: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> Dict[str, Any]:
    """
    分页查询系统日志

    Args:
        db: 用户数据库会话
        page: 页码（从1开始）
        page_size: 每页数量
        level: 日志级别筛选
        source: 来源模糊匹配
        date_from: 开始日期（YYYY-MM-DD）
        date_to: 结束日期（YYYY-MM-DD）

    Returns:
        dict: { total, page, page_size, items }
    """
    query = db.query(SystemLog)

    if level and level != 'all':
        query = query.filter(SystemLog.level == level)

    if source and source != 'all':
        query = query.filter(SystemLog.source.ilike(f'%{source}%'))

    if date_from:
        try:
            from_dt = datetime.strptime(date_from, '%Y-%m-%d')
            query = query.filter(SystemLog.timestamp >= from_dt)
        except ValueError:
            pass

    if date_to:
        try:
            to_dt = datetime.strptime(date_to + ' 23:59:59', '%Y-%m-%d %H:%M:%S')
            query = query.filter(SystemLog.timestamp <= to_dt)
        except ValueError:
            pass

    total = query.count()
    items = (
        query
        .order_by(desc(SystemLog.timestamp))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        'total': total,
        'page': page,
        'page_size': page_size,
        'items': [
            {
                'id': item.id,
                'timestamp': item.timestamp.strftime('%Y-%m-%d %H:%M:%S') if item.timestamp else '',
                'level': item.level,
                'source': item.source,
                'message': item.message,
                'detail': item.detail,
                'related_id': item.related_id,
                'related_type': item.related_type,
            }
            for item in items
        ],
    }


def get_log_sources(db: Session) -> List[str]:
    """
    获取所有日志来源

    Args:
        db: 用户数据库会话

    Returns:
        list: 日志来源列表
    """
    sources = db.query(SystemLog.source).distinct().all()
    return [s[0] for s in sources if s[0]]


def delete_log(db: Session, log_id: str) -> bool:
    """
    删除一条日志

    Args:
        db: 用户数据库会话
        log_id: 日志ID

    Returns:
        bool: 是否成功
    """
    log = db.query(SystemLog).filter(SystemLog.id == log_id).first()
    if not log:
        return False
    db.delete(log)
    db.commit()
    return True


def clear_logs(db: Session, before_days: Optional[int] = None) -> int:
    """
    清理日志

    Args:
        db: 用户数据库会话
        before_days: 清理多少天前的日志，None 则清理全部

    Returns:
        int: 删除的日志数量
    """
    query = db.query(SystemLog)
    if before_days:
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(days=before_days)
        query = query.filter(SystemLog.timestamp < cutoff)
    count = query.count()
    query.delete()
    db.commit()
    return count
