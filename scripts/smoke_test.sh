#!/usr/bin/env bash
set -euo pipefail

# Green Tracker 冒烟回归
# 验证：后端存活、API 路由可达、Nginx 反代正确、双前缀防护、前端入口可用
# 用法: bash scripts/smoke_test.sh [FRONT_BASE_URL] [API_BASE_URL]
#   FRONT_BASE_URL 默认 https://localhost（自签名证书自动加 -k）
#   API_BASE_URL   默认 http://localhost:6130

FRONT_URL="${1:-https://localhost}"
API_URL="${2:-http://localhost:6130}"

KFLAG=""
if [[ "$FRONT_URL" == https://* ]]; then
  KFLAG="-k"
fi

PASS=0
FAIL=0

check() {
  local name="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    printf '  [PASS] %-52s -> %s\n' "$name" "$actual"
    PASS=$((PASS + 1))
  else
    printf '  [FAIL] %-52s -> %s（期望 %s）\n' "$name" "$actual" "$expected"
    FAIL=$((FAIL + 1))
  fi
}

echo "=========================================="
echo " Green Tracker 冒烟回归"
echo " 前端入口: $FRONT_URL"
echo " 后端直连: $API_URL"
echo "=========================================="

echo "[1/5] 后端直连"
check "GET  /health"                        200 "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$API_URL/health" 2>/dev/null || echo 000)"
check "POST /api/auth/login（空body=路由存在）" 422 "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X POST "$API_URL/api/auth/login" -H 'Content-Type: application/json' -d '{}' 2>/dev/null || echo 000)"

echo "[2/5] 经 Nginx 反代"
check "GET  /health"                        200 "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 $KFLAG "$FRONT_URL/health" 2>/dev/null || echo 000)"
check "POST /api/auth/login"                422 "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 $KFLAG -X POST "$FRONT_URL/api/auth/login" -H 'Content-Type: application/json' -d '{}' 2>/dev/null || echo 000)"

echo "[3/5] 双前缀反例（必须 404；若 422 即 baseURL 配置回归）"
check "POST /api/api/auth/login"            404 "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 $KFLAG -X POST "$FRONT_URL/api/api/auth/login" -H 'Content-Type: application/json' -d '{}' 2>/dev/null || echo 000)"

echo "[4/5] 鉴权接口（无 token 应 401；FastAPI 会把 /api/fields 307 重定向到带尾斜杠路径，故直接用尾斜杠形式）"
check "GET  /api/fields/"                   401 "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 $KFLAG "$FRONT_URL/api/fields/" 2>/dev/null || echo 000)"

echo "[5/5] 前端入口"
check "GET  /"                              200 "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 $KFLAG "$FRONT_URL/" 2>/dev/null || echo 000)"

if [[ -n "${SMOKE_USERNAME:-}" && -n "${SMOKE_PASSWORD:-}" ]]; then
  echo "[可选] 真实登录（SMOKE_USERNAME 已设置）"
  code=$(curl -s -o /tmp/gt_smoke_login.json -w '%{http_code}' --max-time 15 $KFLAG \
    -X POST "$FRONT_URL/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$SMOKE_USERNAME\",\"password\":\"$SMOKE_PASSWORD\"}")
  check "POST /api/auth/login（真实凭据）" 200 "$code"
  rm -f /tmp/gt_smoke_login.json
else
  echo "[跳过] 真实登录（未设置 SMOKE_USERNAME/SMOKE_PASSWORD）"
fi

echo "=========================================="
echo " 结果: $PASS 通过, $FAIL 失败"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
echo " 冒烟回归全部通过 ✓"
