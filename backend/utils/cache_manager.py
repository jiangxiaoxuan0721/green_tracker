"""
缓存管理模块

提供统一的缓存接口，支持多种缓存后端：
- 内存缓存（开发环境）
- Redis缓存（生产环境）

特性：
- 自动过期
- 大小限制
- 统计信息
"""

import logging
import time
import threading
from typing import Any, Dict, Optional, Tuple
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class CacheBackend(ABC):
    """缓存后端抽象类"""
    
    @abstractmethod
    def get(self, key: str) -> Optional[Any]:
        """获取缓存值"""
        pass
    
    @abstractmethod
    def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        """设置缓存值"""
        pass
    
    @abstractmethod
    def delete(self, key: str) -> bool:
        """删除缓存"""
        pass
    
    @abstractmethod
    def clear(self) -> bool:
        """清空缓存"""
        pass
    
    @abstractmethod
    def stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        pass


class MemoryCacheBackend(CacheBackend):
    """内存缓存后端"""
    
    def __init__(self, max_size: int = 1000, default_ttl: int = 3600):
        self.max_size = max_size
        self.default_ttl = default_ttl
        self._cache: Dict[str, Tuple[Any, float, int]] = {}  # key: (value, expire_time, access_count)
        self._lock = threading.RLock()
        self._hits = 0
        self._misses = 0
    
    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            if key not in self._cache:
                self._misses += 1
                return None
            
            value, expire_time, access_count = self._cache[key]
            current_time = time.time()
            
            # 检查是否过期
            if expire_time > 0 and current_time > expire_time:
                del self._cache[key]
                self._misses += 1
                return None
            
            # 更新访问计数
            self._cache[key] = (value, expire_time, access_count + 1)
            self._hits += 1
            return value
    
    def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        with self._lock:
            try:
                # 计算过期时间
                expire_time = time.time() + ttl if ttl > 0 else 0
                
                # 如果缓存已满，删除最少使用的项
                if len(self._cache) >= self.max_size:
                    self._evict_lru()
                
                self._cache[key] = (value, expire_time, 0)
                return True
            except Exception as e:
                logger.error(f"设置缓存失败: {e}")
                return False
    
    def delete(self, key: str) -> bool:
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False
    
    def clear(self) -> bool:
        with self._lock:
            self._cache.clear()
            self._hits = 0
            self._misses = 0
            return True
    
    def _evict_lru(self):
        """删除最少使用的缓存项"""
        if not self._cache:
            return
        
        # 找到访问次数最少的键
        lru_key = min(self._cache.keys(), key=lambda k: self._cache[k][2])
        del self._cache[lru_key]
        logger.debug(f"删除最少使用缓存项: {lru_key}")
    
    def stats(self) -> Dict[str, Any]:
        with self._lock:
            total_requests = self._hits + self._misses
            hit_rate = self._hits / total_requests if total_requests > 0 else 0
            
            return {
                "type": "memory",
                "size": len(self._cache),
                "max_size": self.max_size,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": hit_rate,
                "items": {
                    key: {
                        "access_count": data[2],
                        "expires_at": data[1] if data[1] > 0 else None
                    }
                    for key, data in self._cache.items()
                }
            }


class RedisCacheBackend(CacheBackend):
    """Redis缓存后端"""
    
    def __init__(self, host='localhost', port=6379, db=0, password=None):
        try:
            import redis
            self._client = redis.Redis(
                host=host,
                port=port,
                db=db,
                password=password,
                decode_responses=False,  # 保持二进制数据
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True
            )
            # 测试连接
            self._client.ping()
            logger.info(f"Redis缓存连接成功: {host}:{port}/{db}")
        except ImportError:
            logger.error("Redis模块未安装，pip install redis")
            raise
        except Exception as e:
            logger.error(f"Redis连接失败: {e}")
            raise
    
    def get(self, key: str) -> Optional[Any]:
        try:
            import pickle
            data = self._client.get(self._make_key(key))
            if data:
                return pickle.loads(data)
            return None
        except Exception as e:
            logger.error(f"Redis get失败: {e}")
            return None
    
    def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        try:
            import pickle
            data = pickle.dumps(value)
            return self._client.setex(self._make_key(key), ttl, data)
        except Exception as e:
            logger.error(f"Redis set失败: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        try:
            return bool(self._client.delete(self._make_key(key)))
        except Exception as e:
            logger.error(f"Redis delete失败: {e}")
            return False
    
    def clear(self) -> bool:
        try:
            # 只删除应用相关的key
            import re
            pattern = self._make_key("*")
            keys = self._client.keys(pattern)
            if keys:
                return bool(self._client.delete(*keys))
            return True
        except Exception as e:
            logger.error(f"Redis clear失败: {e}")
            return False
    
    def stats(self) -> Dict[str, Any]:
        try:
            info = self._client.info()
            return {
                "type": "redis",
                "redis_version": info.get("redis_version"),
                "used_memory": info.get("used_memory_human"),
                "connected_clients": info.get("connected_clients"),
                "total_commands_processed": info.get("total_commands_processed")
            }
        except Exception as e:
            logger.error(f"Redis stats失败: {e}")
            return {"type": "redis", "error": str(e)}
    
    def _make_key(self, key: str) -> str:
        """生成Redis键名"""
        return f"green_tracker:{key}"


class CacheManager:
    """缓存管理器"""
    
    def __init__(self, backend: Optional[CacheBackend] = None):
        if backend:
            self._backend = backend
        else:
            # 自动选择后端
            try:
                self._backend = RedisCacheBackend()
                logger.info("使用Redis缓存后端")
            except:
                self._backend = MemoryCacheBackend()
                logger.info("使用内存缓存后端")
    
    def get(self, key: str) -> Optional[Any]:
        """获取缓存"""
        return self._backend.get(key)
    
    def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        """设置缓存"""
        return self._backend.set(key, value, ttl)
    
    def delete(self, key: str) -> bool:
        """删除缓存"""
        return self._backend.delete(key)
    
    def clear(self) -> bool:
        """清空缓存"""
        return self._backend.clear()
    
    def stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        return self._backend.stats()


# 全局缓存管理器实例
_cache_manager: Optional[CacheManager] = None


def get_cache_manager() -> CacheManager:
    """获取缓存管理器单例"""
    global _cache_manager
    if _cache_manager is None:
        _cache_manager = CacheManager()
    return _cache_manager


def configure_cache(backend: str = "auto", **kwargs) -> CacheManager:
    """配置缓存"""
    global _cache_manager
    
    if backend == "redis":
        cache_backend = RedisCacheBackend(**kwargs)
    elif backend == "memory":
        cache_backend = MemoryCacheBackend(**kwargs)
    elif backend == "auto":
        cache_backend = None  # 自动选择
    else:
        raise ValueError(f"不支持的缓存后端: {backend}")
    
    _cache_manager = CacheManager(cache_backend)
    logger.info(f"缓存已配置: {backend}")
    return _cache_manager


if __name__ == "__main__":
    # 测试代码
    import logging
    logging.basicConfig(level=logging.INFO)
    
    cache = get_cache_manager()
    
    # 测试基本操作
    cache.set("test_key", {"hello": "world"}, ttl=10)
    value = cache.get("test_key")
    print(f"缓存测试: {value}")
    
    # 显示统计信息
    stats = cache.stats()
    print(f"缓存统计: {stats}")