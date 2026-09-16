"""测试 fixture：FakeCM 用于 algorithm_deploy_service 测试。"""


class FakeCM:
    async def remove_container(self, uuid): pass

    async def start_container(self, uuid, image, env=None, log_sink=None):
        return True, "cid", 8001, ""

    async def wait_healthy(self, port, timeout=30):
        return True