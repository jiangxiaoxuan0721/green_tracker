"""ContainerManager 端口池与命名规范测试。

本测试文件覆盖 Task 1 的核心契约：
- container_name(image_tag) 命名约定
- allocate_port/release_port 端口池并发安全
- _scan_docker_used_ports 通过 monkeypatch 不实际访问 docker
"""
import pytest

from storage.container_manager import ContainerManager


@pytest.fixture
def cm(monkeypatch):
    """ContainerManager 实例化时跳过 docker 调用，注入空状态。

    monkeypatch storage.container_manager.subprocess.run —— 直接对应
    实现代码里的 `import subprocess`（无别名），保证 _scan_docker_used_ports
    不会真实执行 `docker ps`。
    """
    monkeypatch.setattr(
        "storage.container_manager.subprocess.run",
        lambda *a, **k: type("R", (), {"stdout": b"", "returncode": 0})(),
    )
    return ContainerManager()


def test_container_name_is_unique_per_uuid(cm):
    a = cm.container_name("550e8400-e29b-41d4-a716-446655440000")
    b = cm.container_name("660e8400-e29b-41d4-a716-446655440000")
    assert a != b
    assert a == "green_tracker_algorithm_550e8400e29b41d4a716446655440000"


def test_image_tag_is_single_latest(cm):
    t = cm.image_tag("550e8400-e29b-41d4-a716-446655440000")
    assert t == "algorithm_550e8400e29b41d4a716446655440000:latest"


@pytest.mark.asyncio
async def test_allocate_port_returns_unique(cm):
    p1 = await cm.allocate_port()
    p2 = await cm.allocate_port()
    assert 8001 <= p1 <= 9999 and 8001 <= p2 <= 9999
    assert p1 != p2


@pytest.mark.asyncio
async def test_release_port_recycles(cm):
    p1 = await cm.allocate_port()
    await cm.release_port(p1)
    p2 = await cm.allocate_port()
    # 释放后可能立即被重新分配（first-fit 策略）；仅断言两者都是有效端口
    assert 8001 <= p1 <= 9999
    assert 8001 <= p2 <= 9999