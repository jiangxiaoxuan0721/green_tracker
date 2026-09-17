"""ImageBuildService 流式日志 + 旧 tag 清理测试。"""
import io
import zipfile

import pytest
from unittest.mock import MagicMock

from storage.image_build_service import ImageBuildService


@pytest.fixture
def svc(tmp_path):
    """直接设 build_context=tmp_path；os.makedirs 真实运行（不要 monkeypatch，否则 build_dir 不会被创建）。"""
    s = ImageBuildService()
    s.build_context = str(tmp_path)
    return s


def _fake_minio(payload: bytes):
    m = MagicMock()
    m.get_object.return_value = payload
    return m


def _async_returns(value):
    """返回 async lambda（build_image 用 await 调 _list_image_tags / _build_docker_image）。"""
    async def _fake(*args, **kwargs):
        return value
    return _fake


def _build_zip(payload_kwargs: dict) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as z:
        for name, content in payload_kwargs.items():
            z.writestr(name, content)
    return buf.getvalue()


@pytest.mark.asyncio
async def test_build_image_cleans_old_tags_first(svc, monkeypatch):
    """build_image 启动 docker build 前必须先 docker rmi 同前缀旧 tag。"""
    cmd_log: list[list[str]] = []

    async def fake_exec(cmd, capture=False, log_sink=None, check=False):
        cmd_log.append(cmd)
        return 0, "", ""

    async def fake_build(*args, **kwargs):
        # 记录 docker build 启动以让测试断言 rmi < build
        cmd_log.append(['docker', 'build', '-f', 'fake-dockerfile', '-t', 'fake', 'fake-context'])
        return True

    monkeypatch.setattr(svc, "_exec", fake_exec)
    monkeypatch.setattr(svc, "_list_image_tags", _async_returns(["old_tag1:latest", "old_tag2:b1"]))
    monkeypatch.setattr(svc, "_build_docker_image", fake_build)
    monkeypatch.setattr(svc, "_next_tag", lambda uuid: "algorithm_xxx:build-1")

    payload = _build_zip({
        "algorithm.yaml": "framework: python\n",
        "src/main.py": "print('ok')",
    })
    minio = _fake_minio(payload)
    ok, tag, port = await svc.build_image(
        "550e8400-e29b-41d4-a716-446655440000",
        "fake/path.zip", minio, log_sink=lambda x: None,
    )
    assert ok
    # 验证：docker rmi 出现在 docker build 之前
    rmi_idx = next(i for i, c in enumerate(cmd_log) if c[:2] == ["docker", "rmi"])
    build_idx = next(i for i, c in enumerate(cmd_log) if c[:2] == ["docker", "build"])
    assert rmi_idx < build_idx


@pytest.mark.asyncio
async def test_build_image_streams_logs(svc, monkeypatch):
    """log_sink 应收到每行 build 输出。"""
    sink_lines: list[str] = []

    async def fake_build(*args, log_sink, **kwargs):
        log_sink("Step 1/3 : FROM python")
        log_sink("Step 2/3 : COPY .")
        return True

    monkeypatch.setattr(svc, "_exec", lambda *a, **k: (0, "", ""))
    monkeypatch.setattr(svc, "_list_image_tags", _async_returns([]))
    monkeypatch.setattr(svc, "_build_docker_image", fake_build)
    monkeypatch.setattr(svc, "_next_tag", lambda uuid: "algorithm_xxx:build-2")

    payload = _build_zip({
        "algorithm.yaml": "framework: python\n",
        "src/main.py": "print()",
    })
    minio = _fake_minio(payload)

    await svc.build_image(
        "550e8400-e29b-41d4-a716-446655440000",
        "fake/path.zip", minio,
        log_sink=sink_lines.append,
    )
    assert any("Step 1/3" in l for l in sink_lines)
    assert any("Step 2/3" in l for l in sink_lines)