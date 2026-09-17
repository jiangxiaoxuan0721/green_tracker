#!/usr/bin/env python3
"""
声明 vs 环境一致性扫描

目标：找出 backend 依赖中"声明 ↔ 运行 conda env"的所有疏漏。
- 对每个声明的包，按包名→模块名反向映射做 importlib 探测
- 对源码所有顶层 import 做第三方 vs stdlib 区分后做 importlib 探测
- 交叉比对：源码用但声明中没有的（潜在传递依赖风险）
- 运行 pip check 看版本冲突

用法：python3 scripts/check_deps_env_sync.py
退出码：0 = 一致；1 = 有缺失/不一致。
"""
import json
import re
import sys
import tomllib
import importlib
import importlib.util
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PYPROJECT = REPO / "backend" / "pyproject.toml"
REQUIREMENTS = REPO / "backend" / "requirements.txt"
BACKEND = REPO / "backend"

# 项目自身的本地包（非第三方，不参与依赖检查）
LOCAL_PACKAGES = {"api", "database", "mqtt", "storage", "utils", "main"}
# 已知第三方包名 → 实际模块名（处理名字不直接对应的，如 pillow→PIL）
KNOWN_NAME_OVERRIDES = {
    "pillow": ["PIL"],
    "python-jose": ["jose"],
    "python-dotenv": ["dotenv"],
    "python-magic": ["magic"],
    "python-multipart": ["multipart"],
    "psycopg2-binary": ["psycopg2"],
    "dnspython": ["dns"],
    "paho-mqtt": ["paho.mqtt", "paho"],
    "email-validator": ["email_validator"],
    "pyyaml": ["yaml"],
}


def parse_declared():
    pkgs = []
    d = tomllib.loads(PYPROJECT.read_text())
    for x in d["project"]["dependencies"]:
        pkgs.append(re.split(r"[<>=!~;\[]", x, 1)[0].strip().lower())
    for line in REQUIREMENTS.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            pkgs.append(re.split(r"[<>=!~;\[]", line, 1)[0].strip().lower())
    # 去重保序
    return list(dict.fromkeys(pkgs))


def modules_for(pkg):
    """返回该包可能提供的模块名列表（按可信度排序）。"""
    if pkg in KNOWN_NAME_OVERRIDES:
        return KNOWN_NAME_OVERRIDES[pkg]
    # 优先用 importlib.metadata 反向映射
    try:
        from importlib.metadata import packages_distributions

        mods = packages_distributions().get(pkg.lower(), [])
        if mods:
            # Python 实际模块名一律小写（display name 如 SQLAlchemy → sqlalchemy）
            return [m.lower() for m in mods]
    except Exception:
        pass
    # fallback：包名直接试一下
    return [pkg.replace("-", "_"), pkg.split("-")[0]]


def can_import(mod):
    try:
        importlib.import_module(mod)
        return True
    except Exception:
        return False


def collect_source_imports():
    mods = set()
    for f in BACKEND.rglob("*.py"):
        if "egg-info" in str(f):
            continue
        for line in f.read_text().splitlines():
            m = re.match(r"^(?:from\s+(\w+)|import\s+(\w+))", line.strip())
            if m:
                mods.add(m.group(1) or m.group(2))  # 保留大小写（如 PIL）
    mods -= {"__future__"}
    return mods


def main():
    declared = parse_declared()
    src = collect_source_imports()

    decl_missing = []
    for pkg in declared:
        mods = modules_for(pkg)
        # modules_for 已返回正确大小写，直接 import（大小写敏感）
        if not any(can_import(m) for m in mods):
            decl_missing.append({"package": pkg, "expected_modules": mods})

    ext_src_missing = sorted(
        m for m in src
        if m not in LOCAL_PACKAGES and not can_import(m)
    )

    # 源码使用但声明中无（潜在传递依赖）
    # 仅考虑带 pip 分布的第三方模块（stdlib 没有 pip 包，自动排除）
    decl_pkg_norm = {p.replace("-", "_").lower() for p in declared}
    # 模块名同时保留大小写键与 lower 键，兼容 PIL / paho.mqtt 这种区分大小写的查找
    mod_to_dist = {}
    try:
        from importlib.metadata import packages_distributions

        for d, mods in packages_distributions().items():
            for mod in mods:
                mod_to_dist.setdefault(mod, set()).add(d.lower())
                mod_to_dist.setdefault(mod.lower(), set()).add(d.lower())
    except Exception:
        pass
    undeclared_third_party = sorted(
        m for m in src
        if m not in LOCAL_PACKAGES
        and can_import(m)
        and (m in mod_to_dist or m.lower() in mod_to_dist)
        and not (mod_to_dist.get(m, set()) & decl_pkg_norm)
    )

    # pip check
    try:
        pip_check = subprocess.check_output(
            [sys.executable, "-m", "pip", "check"], text=True
        ).strip()
    except subprocess.CalledProcessError as e:
        pip_check = e.output.strip() if e.output else f"pip check 退出 {e.returncode}"

    report = {
        "summary": {
            "declared_count": len(declared),
            "source_imports": len(src),
            "declared_missing_in_env": len(decl_missing),
            "source_thirdparty_missing": len(ext_src_missing),
            "source_thirdparty_undeclared": len(undeclared_third_party),
            "pip_check_ok": pip_check == "No broken requirements found.",
        },
        "declared_missing": decl_missing,
        "source_thirdparty_missing": ext_src_missing,
        "source_thirdparty_undeclared": undeclared_third_party,
        "pip_check_output": pip_check,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    ok = (
        not decl_missing
        and not ext_src_missing
        and report["summary"]["pip_check_ok"]
    )
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())