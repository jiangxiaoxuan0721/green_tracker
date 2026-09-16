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
        # 在 Task 7 实现完整编排
        try:
            await asyncio.sleep(0.1)
            task.finish("running", result={"port": 0, "image": "stub", "container_id": "stub"})
        finally:
            self._build_locks[task.algorithm_id].release()
            self._tasks_by_algorithm[task.algorithm_id].discard(task.task_id)

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
