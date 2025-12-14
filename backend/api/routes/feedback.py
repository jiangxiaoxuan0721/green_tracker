from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database.main_db import get_db
from database.db_services import create_feedback, get_all_feedback
from api.schemas.feedback import FeedbackCreate, FeedbackResponse
from typing import List

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


@router.post("/", response_model=FeedbackResponse)
async def submit_feedback(feedback: FeedbackCreate, db: Session = Depends(get_db)):
    """
    提交用户反馈
    """
    try:
        db_feedback = create_feedback(
            db=db, 
            name=str(feedback.name), 
            email=str(feedback.email), 
            subject=str(feedback.subject),
            content=str(feedback.content)
        )
        return db_feedback
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"提交反馈失败: {str(e)}"
        )


@router.get("/", response_model=List[FeedbackResponse])
async def get_feedback(db: Session = Depends(get_db)):
    """
    获取所有反馈信息
    """
    try:
        feedbacks = get_all_feedback(db)
        return feedbacks
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取反馈失败: {str(e)}"
        )