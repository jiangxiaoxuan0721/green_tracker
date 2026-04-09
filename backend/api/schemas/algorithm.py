from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class AlgorithmCreate(BaseModel):
    """算法创建请求"""
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    version: str = "1.0.0"
    framework: Optional[str] = None
    input_type: Optional[str] = None
    output_type: Optional[str] = None


class AlgorithmUpdate(BaseModel):
    """算法更新请求"""
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None


class AlgorithmResponse(BaseModel):
    """算法响应"""
    id: str
    uuid: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []
    author_id: str
    author_name: Optional[str] = None
    version: str
    
    # 文件信息
    minio_path: Optional[str] = None
    file_size: Optional[int] = None
    docker_image: Optional[str] = None
    container_port: Optional[int] = None
    
    # 框架信息
    framework: Optional[str] = None
    input_type: Optional[str] = None
    output_type: Optional[str] = None
    
    # 统计
    downloads: int = 0
    calls: int = 0
    rating: Optional[int] = None
    
    # 状态
    status: str
    
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AlgorithmListResponse(BaseModel):
    """算法列表响应"""
    items: List[AlgorithmResponse]
    total: int
    page: int
    page_size: int


class AlgorithmUploadResponse(BaseModel):
    """算法上传响应"""
    algorithm: AlgorithmResponse
    message: str


class ReviewCreate(BaseModel):
    """评论创建请求"""
    rating: int
    comment: Optional[str] = None


class ReviewResponse(BaseModel):
    """评论响应"""
    id: str
    algorithm_id: str
    user_id: str
    rating: int
    comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True