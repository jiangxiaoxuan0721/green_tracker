"""算法构建 NDJSON 流式端点测试。

为简化：通过 httpx AsyncClient + ASGITransport 直接驱动 app。
覆盖：
- POST /algorithms/{id}/build → 202 + {task_id, stream_url}
- POST /algorithms/{id}/build 同算法并发 → 409
- GET /algorithms/{id}/build/stream?task_id=X → NDJSON
- GET /algorithms/{id}/build?task_id=X → 终态查询
"""
import json

import pytest
from httpx import AsyncClient, ASGITransport


@pytest.fixture
def fake_algorithm():
    return type("A", (), {
        "id": 1,
        "uuid": "uuid-1",
        "minio_path": "fake/path.zip",
        "author_id": 1,
        "name": "Algo",
    })()


@pytest.fixture
def fake_user():
    from database.db_models.meta_model import User
    return User(userid=1, username="u")


@pytest.mark.asyncio
async def test_post_build_returns_202(monkeypatch, fake_algorithm, fake_user):
    """POST /build 应返回 202 + {task_id, stream_url}。"""
    from main import app
    from storage.algorithm_deploy_service import AlgorithmDeployService, BuildTask

    fake_task = BuildTask(task_id="abc123", algorithm_id=1, algorithm_uuid="uuid-1")

    async def fake_submit(*args, **kwargs):
        fake_task.publish("start")
        fake_task.finish("running", result={"port": 8001, "image": "x", "container_id": "c"})
        return fake_task

    svc = AlgorithmDeployService()
    monkeypatch.setattr(svc, "submit_build", fake_submit)
    monkeypatch.setattr("api.routes.algorithm.get_deploy_service", lambda: svc)
    monkeypatch.setattr(
        "api.routes.algorithm.algorithm_service.get_algorithm_by_id",
        lambda db, aid: fake_algorithm,
    )
    monkeypatch.setattr(
        "api.routes.algorithm.algorithm_service.update_algorithm",
        lambda *a, **k: None,
    )
    app.dependency_overrides[__import__("api.routes.auth", fromlist=["get_current_user"]).get_current_user] = lambda: fake_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.post("/api/algorithms/1/build", headers={"Authorization": "Bearer x"})
    assert r.status_code == 202
    body = r.json()
    assert body["task_id"] == "abc123"
    assert body["stream_url"].endswith("/build/stream?task_id=abc123")


@pytest.mark.asyncio
async def test_post_build_concurrent_returns_409(monkeypatch, fake_algorithm, fake_user):
    """同算法并发构建应返回 409。"""
    from main import app
    from storage.algorithm_deploy_service import AlgorithmDeployService, BuildTask, BuildInProgressError

    svc = AlgorithmDeployService()

    async def fake_submit(*args, **kwargs):
        raise BuildInProgressError("算法 1 正在构建中")

    monkeypatch.setattr(svc, "submit_build", fake_submit)
    monkeypatch.setattr("api.routes.algorithm.get_deploy_service", lambda: svc)
    monkeypatch.setattr(
        "api.routes.algorithm.algorithm_service.get_algorithm_by_id",
        lambda db, aid: fake_algorithm,
    )
    monkeypatch.setattr(
        "api.routes.algorithm.algorithm_service.update_algorithm",
        lambda *a, **k: None,
    )
    app.dependency_overrides[__import__("api.routes.auth", fromlist=["get_current_user"]).get_current_user] = lambda: fake_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.post("/api/algorithms/1/build", headers={"Authorization": "Bearer x"})
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_stream_build_emits_ndjson(monkeypatch, fake_algorithm, fake_user):
    """GET /build/stream 应输出 application/x-ndjson，含 log + status 帧。"""
    from main import app
    from storage.algorithm_deploy_service import AlgorithmDeployService, BuildTask

    svc = AlgorithmDeployService()
    task = BuildTask(task_id="st1", algorithm_id=1, algorithm_uuid="uuid-1")
    task.publish("line A")
    task.publish("line B")
    task.finish("running", result={"port": 8001, "image": "x", "container_id": "c"})
    svc._tasks["st1"] = task

    monkeypatch.setattr("api.routes.algorithm.get_deploy_service", lambda: svc)
    app.dependency_overrides[__import__("api.routes.auth", fromlist=["get_current_user"]).get_current_user] = lambda: fake_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.get("/api/algorithms/1/build/stream?task_id=st1", headers={"Authorization": "Bearer x"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/x-ndjson")
    lines = [json.loads(l) for l in r.text.splitlines() if l.strip()]
    # 首帧 status，最后一帧 status（终止），中间 log
    assert lines[0]["type"] == "status"
    assert lines[-1]["type"] == "status"
    log_lines = [l for l in lines if l["type"] == "log"]
    assert any(l["line"] == "line A" for l in log_lines)
    assert any(l["line"] == "line B" for l in log_lines)


@pytest.mark.asyncio
async def test_get_build_status_returns_terminal_state(monkeypatch, fake_algorithm, fake_user):
    """GET /build?task_id=X 应返回 task 终态。"""
    from main import app
    from storage.algorithm_deploy_service import AlgorithmDeployService, BuildTask

    svc = AlgorithmDeployService()
    task = BuildTask(task_id="gs1", algorithm_id=1, algorithm_uuid="uuid-1")
    task.finish("failed", error="boom")
    svc._tasks["gs1"] = task

    monkeypatch.setattr("api.routes.algorithm.get_deploy_service", lambda: svc)
    app.dependency_overrides[__import__("api.routes.auth", fromlist=["get_current_user"]).get_current_user] = lambda: fake_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.get("/api/algorithms/1/build?task_id=gs1", headers={"Authorization": "Bearer x"})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "failed"
    assert body["error"] == "boom"