from sqlalchemy.orm import Session
from database.db_models.meta_model import Feedback
import uuid
from typing import Optional

def create_feedback(db: Session, name: str, email: str, subject: str, content: str) -> Feedback:
    """
    创建新反馈
    
    Args:
        db: 数据库会话
        name: 用户姓名
        email: 邮箱
        subject: 反馈主题
        content: 反馈内容
    
    Returns:
        Feedback: 创建的反馈对象
    """
    print(f"[后端FeedbackService] 开始创建反馈: 姓名={name}, 邮箱={email}, 主题={subject}")
    
    # 创建新反馈
    print("[后端FeedbackService] 创建新反馈对象")
    new_feedback = Feedback(
        id=str(uuid.uuid4()),
        name=name,
        email=email,
        subject=subject,
        content=content
    )
    
    print(f"[后端FeedbackService] 反馈对象创建成功, id={new_feedback.id}")
    
    # 保存到数据库
    print("[后端FeedbackService] 保存反馈到数据库")
    db.add(new_feedback)
    db.commit()
    db.refresh(new_feedback)
    
    print(f"[后端FeedbackService] 反馈保存成功: {new_feedback.id}")
    return new_feedback

def get_feedback_by_id(db: Session, feedback_id: str) -> Optional[Feedback]:
    """
    根据ID获取反馈
    
    Args:
        db: 数据库会话
        feedback_id: 反馈ID
    
    Returns:
        Optional[Feedback]: 反馈对象，如果不存在则返回None
    """
    print(f"[后端FeedbackService] 查询反馈: ID={feedback_id}")
    return db.query(Feedback).filter(Feedback.id == feedback_id).first()

def get_all_feedback(db: Session) -> list[Feedback]:
    """
    获取所有反馈
    
    Args:
        db: 数据库会话
    
    Returns:
        list[Feedback]: 所有反馈的列表
    """
    print("[后端FeedbackService] 查询所有反馈")
    return db.query(Feedback).all()