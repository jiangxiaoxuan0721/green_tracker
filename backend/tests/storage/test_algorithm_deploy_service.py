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
