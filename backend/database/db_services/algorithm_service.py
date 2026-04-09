"""
算法服务 - 管理算法的 CRUD 操作
"""

from sqlalchemy.orm import Session
from database.db_models.meta_model import Algorithm, AlgorithmReview
from typing import Optional, List
import uuid
import json
from datetime import datetime


def create_algorithm(
    db: Session,
    name: str,
    author_id: str,
    author_name: str,
    description: str = None,
    category: str = None,
    tags: List[str] = None,
    version: str = "1.0.0",
    framework: str = None,
    input_type: str = None,
    output_type: str = None,
    minio_path: str = None,
    file_size: int = None
) -> Algorithm:
    """
    创建新算法
    
    Args:
        db: 数据库会话
        name: 算法名称
        author_id: 发布者ID
        author_name: 发布者名称
        description: 算法描述
        category: 分类
        tags: 标签列表
        version: 版本号
        framework: 框架
        input_type: 输入类型
        output_type: 输出类型
        minio_path: MinIO存储路径
        file_size: 文件大小
    
    Returns:
        Algorithm: 创建的算法对象
    """
    algorithm_uuid = str(uuid.uuid4())
    new_algorithm = Algorithm(
        id=str(uuid.uuid4()),
        uuid=algorithm_uuid,
        name=name,
        description=description,
        category=category,
        tags=json.dumps(tags) if tags else '[]',
        author_id=author_id,
        author_name=author_name,
        version=version,
        framework=framework,
        input_type=input_type,
        output_type=output_type,
        minio_path=minio_path,
        file_size=file_size,
        status='pending'
    )
    
    db.add(new_algorithm)
    db.commit()
    db.refresh(new_algorithm)
    
    return new_algorithm


def get_algorithm_by_id(db: Session, algorithm_id: str) -> Optional[Algorithm]:
    """根据ID获取算法"""
    return db.query(Algorithm).filter(Algorithm.id == algorithm_id).first()


def get_algorithm_by_uuid(db: Session, algorithm_uuid: str) -> Optional[Algorithm]:
    """根据UUID获取算法"""
    return db.query(Algorithm).filter(Algorithm.uuid == algorithm_uuid).first()


def get_algorithm_list(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    search: str = None,
    category: str = None,
    status: str = None,
    include_all_statuses: bool = True
) -> tuple[List[Algorithm], int]:
    """
    获取算法列表
    
    Args:
        db: 数据库会话
        skip: 跳过数量
        limit: 返回数量
        search: 搜索关键词
        category: 分类筛选
        status: 状态筛选（单个状态）
        include_all_statuses: 是否包含所有状态，默认True
    
    Returns:
        tuple: (算法列表, 总数)
    """
    query = db.query(Algorithm)
    
    # 搜索筛选
    if search:
        query = query.filter(
            (Algorithm.name.ilike(f'%{search}%')) | 
            (Algorithm.description.ilike(f'%{search}%'))
        )
    
    # 分类筛选
    if category:
        query = query.filter(Algorithm.category == category)
    
    # 状态筛选
    if status:
        query = query.filter(Algorithm.status == status)
    elif include_all_statuses:
        # 默认显示所有状态的算法（包括 pending, building, running, error, archived）
        # 这样用户可以看到自己上传的算法构建状态
        pass
    
    # 排序
    query = query.order_by(Algorithm.created_at.desc())
    
    # 总数
    total = query.count()
    
    # 分页
    algorithms = query.offset(skip).limit(limit).all()
    
    return algorithms, total


def update_algorithm(
    db: Session,
    algorithm_id: str,
    **kwargs
) -> Optional[Algorithm]:
    """
    更新算法信息
    
    Args:
        db: 数据库会话
        algorithm_id: 算法ID
        **kwargs: 更新字段
    
    Returns:
        Optional[Algorithm]: 更新后的算法
    """
    algorithm = get_algorithm_by_id(db, algorithm_id)
    if not algorithm:
        return None
    
    for key, value in kwargs.items():
        if hasattr(algorithm, key):
            setattr(algorithm, key, value)
    
    algorithm.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(algorithm)
    
    return algorithm


def delete_algorithm(db: Session, algorithm_id: str) -> bool:
    """
    删除算法
    
    Args:
        db: 数据库会话
        algorithm_id: 算法ID
    
    Returns:
        bool: 是否删除成功
    """
    algorithm = get_algorithm_by_id(db, algorithm_id)
    if not algorithm:
        return False
    
    db.delete(algorithm)
    db.commit()
    
    return True


def increment_downloads(db: Session, algorithm_id: str) -> bool:
    """增加下载次数"""
    algorithm = get_algorithm_by_id(db, algorithm_id)
    if algorithm:
        algorithm.downloads += 1
        db.commit()
        return True
    return False


def increment_calls(db: Session, algorithm_id: str) -> bool:
    """增加调用次数"""
    algorithm = get_algorithm_by_id(db, algorithm_id)
    if algorithm:
        algorithm.calls += 1
        db.commit()
        return True
    return False


def add_review(
    db: Session,
    algorithm_id: str,
    user_id: str,
    rating: int,
    comment: str = None
) -> AlgorithmReview:
    """
    添加算法评论
    
    Args:
        db: 数据库会话
        algorithm_id: 算法ID
        user_id: 用户ID
        rating: 评分(1-5)
        comment: 评论内容
    
    Returns:
        AlgorithmReview: 创建的评论
    """
    review = AlgorithmReview(
        id=str(uuid.uuid4()),
        algorithm_id=algorithm_id,
        user_id=user_id,
        rating=rating,
        comment=comment
    )
    
    db.add(review)
    db.commit()
    
    # 更新算法评分
    algorithm = get_algorithm_by_id(db, algorithm_id)
    if algorithm:
        avg_rating = db.query(AlgorithmReview).filter(
            AlgorithmReview.algorithm_id == algorithm_id
        ).with_entities(
            db.func.avg(AlgorithmReview.rating)
        ).scalar()
        algorithm.rating = int(avg_rating) if avg_rating else None
        db.commit()
    
    return review


def get_algorithm_reviews(
    db: Session,
    algorithm_id: str
) -> List[AlgorithmReview]:
    """获取算法的所有评论"""
    return db.query(AlgorithmReview).filter(
        AlgorithmReview.algorithm_id == algorithm_id
    ).order_by(AlgorithmReview.created_at.desc()).all()


def get_categories(db: Session) -> List[str]:
    """获取所有算法分类"""
    categories = db.query(Algorithm.category).distinct().filter(
        Algorithm.category.isnot(None),
        Algorithm.status.in_(['running', 'archived'])
    ).all()
    return [c[0] for c in categories if c[0]]