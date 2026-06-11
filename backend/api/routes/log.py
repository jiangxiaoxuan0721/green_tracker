"""
系统日志 API 路由
提供日志的查询、导出和清理接口
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from database.user_db_manager import get_user_db
from database.db_models.meta_model import User
from database.db_services.log_service import (
    get_logs, get_log_sources, delete_log, clear_logs,
)
from api.routes.auth import get_current_user
import io
import csv
from typing import Optional

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("/")
async def list_logs(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    level: Optional[str] = Query(None, description="日志级别筛选"),
    source: Optional[str] = Query(None, description="来源模糊搜索"),
    date_from: Optional[str] = Query(None, description="开始日期 YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
    current_user: User = Depends(get_current_user),
):
    """
    分页查询当前用户的系统日志
    """
    db = None
    try:
        db = get_user_db(str(current_user.userid))
        result = get_logs(
            db=db,
            page=page,
            page_size=page_size,
            level=level,
            source=source,
            date_from=date_from,
            date_to=date_to,
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"查询日志失败: {str(e)}"
        )
    finally:
        if db:
            db.close()


@router.get("/sources")
async def list_sources(
    current_user: User = Depends(get_current_user),
):
    """
    获取所有日志来源列表
    """
    db = None
    try:
        db = get_user_db(str(current_user.userid))
        sources = get_log_sources(db)
        return {"sources": sources}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取日志来源失败: {str(e)}"
        )
    finally:
        if db:
            db.close()


@router.get("/export")
async def export_logs(
    format: str = Query("csv", description="导出格式: csv"),
    level: Optional[str] = Query(None, description="日志级别筛选"),
    date_from: Optional[str] = Query(None, description="开始日期"),
    date_to: Optional[str] = Query(None, description="结束日期"),
    current_user: User = Depends(get_current_user),
):
    """
    导出日志为 CSV 文件
    """
    db = None
    try:
        db = get_user_db(str(current_user.userid))
        # 获取全部日志（不分页）
        result = get_logs(
            db=db,
            page=1,
            page_size=10000,
            level=level,
            source=None,
            date_from=date_from,
            date_to=date_to,
        )

        output = io.StringIO()
        writer = csv.writer(output)
        # 写入表头
        writer.writerow(['时间', '级别', '来源', '消息', '详细信息'])
        # 写入数据
        for item in result['items']:
            writer.writerow([
                item['timestamp'],
                item['level'],
                item['source'],
                item['message'],
                item.get('detail', ''),
            ])

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=system_logs.csv"
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出日志失败: {str(e)}"
        )
    finally:
        if db:
            db.close()


@router.delete("/{log_id}")
async def remove_log(
    log_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    删除一条日志
    """
    db = None
    try:
        db = get_user_db(str(current_user.userid))
        success = delete_log(db, log_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="日志不存在"
            )
        return {"message": "日志已删除"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"删除日志失败: {str(e)}"
        )
    finally:
        if db:
            db.close()
