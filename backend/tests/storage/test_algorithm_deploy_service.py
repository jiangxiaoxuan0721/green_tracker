"""AlgorithmDeployService BuildTask 订阅模型测试。"""
import asyncio

import pytest

from storage.algorithm_deploy_service import BuildTask


def test_build_task_initial_state():
    t = BuildTask(task_id="t1", algorithm_id=1, algorithm_uuid="uuid-x")
    assert t.status == "queued"
    assert t.log_lines == []
    assert t.result is None
    assert t.error is None


@pytest.mark.asyncio
async def test_subscribe_receives_historical_then_live():
    t = BuildTask(task_id="t1", algorithm_id=1, algorithm_uuid="uuid-x")
    t.publish("历史行 1")
    t.publish("历史行 2")
    q = t.subscribe()
    # 立即拿到历史
    assert (await asyncio.wait_for(q.get(), 1)) == "历史行 1"
    assert (await asyncio.wait_for(q.get(), 1)) == "历史行 2"
    # 后续 publish 也能收到
    t.publish("实时行")
    assert (await asyncio.wait_for(q.get(), 1)) == "实时行"
    # finish 推 None 终止
    t.finish("running", result={"port": 8001})
    assert await asyncio.wait_for(q.get(), 1) is None


@pytest.mark.asyncio
async def test_finished_task_immediately_yields_none():
    t = BuildTask(task_id="t1", algorithm_id=1, algorithm_uuid="uuid-x")
    t.publish("一行")
    t.finish("failed", error="boom")
    q = t.subscribe()
    assert (await asyncio.wait_for(q.get(), 1)) == "一行"
    assert await asyncio.wait_for(q.get(), 1) is None

@pytest.mark.asyncio
async def test_submit_build_creates_task(monkeypatch):
    """submit_build 应创建 task 并立即返回（不阻塞等构建）。"""
    from storage.algorithm_deploy_service import AlgorithmDeployService
    svc = AlgorithmDeployService()

    async def fake_run(task):
        task.finish("running", result={"port": 8001, "image": "x:latest", "container_id": "cid"})

    monkeypatch.setattr(svc, "_run", fake_run)

    task = await svc.submit_build(1, "uuid-x", actor="user1")
    assert task.algorithm_id == 1
    assert task.algorithm_uuid == "uuid-x"
    assert task.task_id in svc._tasks


@pytest.mark.asyncio
async def test_concurrent_submit_same_algorithm_rejected(monkeypatch):
    """同一 algorithm 的第二次 submit_build 必须拒绝。"""
    from storage.algorithm_deploy_service import AlgorithmDeployService, BuildInProgressError
    svc = AlgorithmDeployService()

    async def slow_run(task):
        await asyncio.sleep(10)

    monkeypatch.setattr(svc, "_run", slow_run)

    task1 = await svc.submit_build(1, "uuid-x", actor="user1")
    # 等慢任务开始占用锁
    await asyncio.sleep(0)
    with pytest.raises(BuildInProgressError):
        await svc.submit_build(1, "uuid-x", actor="user2")


@pytest.mark.asyncio
async def test_run_success_path(monkeypatch):
    """happy path：build_image 成功 → start_container 成功 → wait_healthy True → finish running。"""
    from storage.algorithm_deploy_service import AlgorithmDeployService

    svc = AlgorithmDeployService()

    class FakeBuild:
        async def build_image(self, uuid, minio_path, minio_client, *, log_sink):
            log_sink("build line 1")
            return True, f"algo_{uuid.replace('-','')}:latest", None

    from tests.storage.conftest import FakeCM

    monkeypatch.setattr(
        "storage.algorithm_deploy_service.get_image_build_service", lambda: FakeBuild()
    )
    monkeypatch.setattr(
        "storage.algorithm_deploy_service.get_container_manager", lambda: FakeCM()
    )

    # mock DB：algorithm_service.get_algorithm_by_id 返回带 minio_path 的 fake algo
    class FakeAlgo:
        minio_path = "fake/path.zip"
    def fake_get_by_id(db, aid):
        return FakeAlgo()
    monkeypatch.setattr(
        "database.db_services.algorithm_service.get_algorithm_by_id", fake_get_by_id
    )

    task = await svc.submit_build(1, "uuid-abc", actor="u")
    # 等 _run 跑完（最多 2s）
    for _ in range(20):
        if task._finished.is_set():
            break
        await asyncio.sleep(0.1)
    assert task.status == "running"
    assert task.result == {"port": 8001, "image": "algo_uuidabc:latest", "container_id": "cid"}


@pytest.mark.asyncio
async def test_run_build_failure_finishes_failed(monkeypatch):
    """build_image 失败时，task finish failed。"""
    from storage.algorithm_deploy_service import AlgorithmDeployService

    svc = AlgorithmDeployService()

    from tests.storage.conftest import FakeCM
    cm = FakeCM()
    cm.remove_container = lambda uuid: None
    cm.start_container = lambda *a, **k: None
    cm.wait_healthy = lambda *a, **k: True

    class FakeBuild:
        async def build_image(self, uuid, minio_path, minio_client, *, log_sink):
            return False, "", "docker build 失败"

    monkeypatch.setattr(
        "storage.algorithm_deploy_service.get_image_build_service", lambda: FakeBuild()
    )
    monkeypatch.setattr(
        "storage.algorithm_deploy_service.get_container_manager", lambda: cm
    )

    # mock DB：返回带 minio_path 的 fake algo，让 _run 走到 build 阶段
    class FakeAlgo:
        minio_path = "fake/path.zip"
    monkeypatch.setattr(
        "database.db_services.algorithm_service.get_algorithm_by_id",
        lambda db, aid: FakeAlgo()
    )

    task = await svc.submit_build(2, "uuid-fail")
    for _ in range(20):
        if task._finished.is_set():
            break
        await asyncio.sleep(0.1)
    assert task.status == "failed"
    assert "docker build 失败" in (task.error or "")
