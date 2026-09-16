"""
算法部署任务调度与流式日志订阅。

每个提交构建请求创建一个 BuildTask：
- 状态：queued / building / starting / running / failed / cancelled
- 日志通过 publish() 推入，订阅者通过 subscribe() 拿到异步队列
- 订阅时先把历史灌进队列，再继续接收实时新行
- finish() 推 None 作为终止信号
"""
import asyncio
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class BuildTask:
    task_id: str
    algorithm_id: int
    algorithm_uuid: str
    status: str = "queued"
    log_lines: list[str] = field(default_factory=list)
    result: Optional[dict] = None
    error: Optional[str] = None
    _subscribers: list = field(default_factory=list)
    _finished: asyncio.Event = field(default_factory=asyncio.Event)

    def subscribe(self) -> asyncio.Queue:
        """订阅此任务的日志流。返回 asyncio.Queue，终止信号为 None。"""
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        self._subscribers.append(q)
        # 先把历史日志灌给新订阅者
        for line in self.log_lines:
            try:
                q.put_nowait(line)
            except asyncio.QueueFull:
                break
        if self._finished.is_set():
            try:
                q.put_nowait(None)
            except asyncio.QueueFull:
                pass
        return q

    def publish(self, line: str) -> None:
        """发布一行日志给所有订阅者（含历史）。"""
        self.log_lines.append(line)
        # 限制历史最多保留 500 行（内存安全）
        if len(self.log_lines) > 500:
            self.log_lines = self.log_lines[-500:]
        for q in self._subscribers:
            try:
                q.put_nowait(line)
            except asyncio.QueueFull:
                # 背压：队列满时丢弃，不阻塞 publish
                pass

    def finish(self, status: str, result: Optional[dict] = None, error: Optional[str] = None) -> None:
        """标记任务结束：推 None 给所有订阅者。"""
        self.status = status
        self.result = result
        self.error = error
        self._finished.set()
        for q in self._subscribers:
            try:
                q.put_nowait(None)
            except asyncio.QueueFull:
                pass
import logging
import uuid as _uuid
from typing import Optional

# 模块顶层 re-export，让 monkeypatch 可以按字符串路径替换
from storage.image_build_service import get_image_build_service
from storage.container_manager import get_container_manager

logger = logging.getLogger(__name__)


class BuildInProgressError(Exception):
    """同一算法已有构建任务在跑。"""
    pass


class AlgorithmDeployService:
    def __init__(self):
        self._tasks: dict[str, BuildTask] = {}
        self._tasks_by_algorithm: dict[int, set[str]] = {}
        self._build_locks: dict[int, asyncio.Lock] = {}

    async def submit_build(
        self,
        algorithm_id: int,
        algorithm_uuid: str,
        *,
        actor: Optional[str] = None,
    ) -> BuildTask:
        lock = self._build_locks.setdefault(algorithm_id, asyncio.Lock())
        if lock.locked():
            raise BuildInProgressError(
                f"算法 {algorithm_id} 正在构建中，请等待当前构建完成后再提交"
            )
        await lock.acquire()
        try:
            task = BuildTask(
                task_id=_uuid.uuid4().hex[:12],
                algorithm_id=algorithm_id,
                algorithm_uuid=algorithm_uuid,
            )
            self._tasks[task.task_id] = task
            self._tasks_by_algorithm.setdefault(algorithm_id, set()).add(task.task_id)
            task.publish(f"[submit] 算法 {algorithm_id} 构建已提交（actor={actor}）")
            asyncio.create_task(self._run(task))
            return task
        except Exception:
            lock.release()
            raise

    async def _run(self, task: BuildTask) -> None:
        """构建 → 清理旧容器 → 分配端口 → 启动 → 健康检查 → finish。

        任何环节失败立即 finish(failed) 并释放端口。"""
        port: Optional[int] = None
        try:
            # 使用本模块全局的 get_image_build_service / get_container_manager（顶部 re-export），
            # 让 monkeypatch.setattr 字符串路径替换生效。
            build_svc = get_image_build_service()
            cm = get_container_manager()

            task.publish("[build] 查找算法记录...")
            minio_path: Optional[str] = None
            try:
                from database.main_db import get_meta_db
                from database.db_services import algorithm_service
                db = next(get_meta_db())
                algo = algorithm_service.get_algorithm_by_id(db, str(task.algorithm_id))
                minio_path = getattr(algo, "minio_path", None) if algo else None
            except Exception as e:
                task.publish(f"[warn] 读算法记录失败: {e}")
            if not minio_path:
                task.finish("failed", error="算法记录缺失 minio_path")
                return

            from storage.minio_client import minio_client
            task.publish("[build] 下载算法包并生成 Dockerfile...")
            ok, image_tag, _port_or_err = await build_svc.build_image(
                task.algorithm_uuid, minio_path, minio_client,
                log_sink=task.publish,
            )
            if not ok:
                task.finish("failed", error=_port_or_err or "镜像构建失败")
                return
            task.publish(f"[build] 镜像构建成功: {image_tag}")

            task.publish("[cleanup] 清理同名旧容器...")
            try:
                await cm.remove_container(task.algorithm_uuid)
            except Exception as e:
                task.publish(f"[warn] 清理旧容器失败: {e}")

            task.publish("[start] 启动容器...")
            ok, cid, port, err = await cm.start_container(
                task.algorithm_uuid, image_tag, env={}, log_sink=task.publish,
            )
            if not ok:
                task.finish("failed", error=err or "容器启动失败")
                return
            task.publish(f"[start] 容器已起 cid={cid[:12]} port={port}")

            task.publish(f"[health] 等待服务就绪（最多 30s）...")
            healthy = await cm.wait_healthy(port, timeout=30)
            if not healthy:
                task.publish("[health] ⚠ 健康检查超时，但容器已起；后续可能不稳定")

            # 写回数据库
            try:
                from database.main_db import get_meta_db
                from database.db_services import algorithm_service
                db = next(get_meta_db())
                algorithm_service.update_algorithm(
                    db, str(task.algorithm_id),
                    status="running", docker_image=image_tag, container_port=port,
                    build_log="\n".join(task.log_lines[-50:]),
                )
            except Exception as e:
                task.publish(f"[warn] 写回数据库失败: {e}")

            task.finish("running", result={
                "port": port, "image": image_tag, "container_id": cid,
            })
        except Exception as e:
            logger.exception(f"_run 异常: {e}")
            if port is not None:
                try:
                    await get_container_manager().release_port(port)
                except Exception:
                    pass
            task.finish("failed", error=str(e))
        finally:
            lock = self._build_locks.get(task.algorithm_id)
            if lock and lock.locked():
                lock.release()
            self._tasks_by_algorithm.get(task.algorithm_id, set()).discard(task.task_id)

    def get_task(self, task_id: str) -> Optional[BuildTask]:
        return self._tasks.get(task_id)


# 全局单例
_deploy_service: Optional[AlgorithmDeployService] = None


def get_deploy_service() -> AlgorithmDeployService:
    """获取部署服务单例"""
    global _deploy_service
    if _deploy_service is None:
        _deploy_service = AlgorithmDeployService()
    return _deploy_service
