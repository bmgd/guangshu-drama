#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_DIR="$ROOT/.tools/node-v22.14.0-darwin-arm64"

if [ ! -x "$NODE_DIR/bin/node" ]; then
  echo "正在安装 Node.js 22..."
  mkdir -p "$ROOT/.tools"
  ARCH="$(uname -m)"
  case "$ARCH" in
    arm64) NODE_ARCH="darwin-arm64" ;;
    x86_64) NODE_ARCH="darwin-x64" ;;
    *) echo "不支持的架构: $ARCH"; exit 1 ;;
  esac
  curl -fsSL "https://nodejs.org/dist/v22.14.0/node-v22.14.0-${NODE_ARCH}.tar.xz" -o "$ROOT/.tools/node22.tar.xz"
  tar -xf "$ROOT/.tools/node22.tar.xz" -C "$ROOT/.tools"
  rm "$ROOT/.tools/node22.tar.xz"
fi

export PATH="$NODE_DIR/bin:$PATH"

echo "Node $(node -v) / npm $(npm -v)"

# PostgreSQL
if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="postgres://guangshu:guangshu@127.0.0.1:5432/guangshu_drama"
fi
echo ""
echo "数据库: DATABASE_URL=${DATABASE_URL}"
echo "提示: 请确保 PostgreSQL 已启动。可用 Docker 快速启动："
echo "  docker run -d --name guangshu-pg -e POSTGRES_USER=guangshu -e POSTGRES_PASSWORD=guangshu -e POSTGRES_DB=guangshu_drama -p 5432:5432 postgres:16"
echo ""

if command -v docker >/dev/null 2>&1; then
  if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^guangshu-pg$'; then
    if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q '^guangshu-pg$'; then
      echo "检测到 guangshu-pg 容器未运行，尝试启动..."
      docker start guangshu-pg >/dev/null 2>&1 || true
    fi
  fi
fi

if [ ! -d "$ROOT/backend/node_modules" ]; then
  echo "安装后端依赖..."
  (cd "$ROOT/backend" && npm install)
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "安装前端依赖..."
  (cd "$ROOT/frontend" && npm install)
fi

mkdir -p "$ROOT/data/static"

echo ""
echo "启动光束短剧..."
echo "  后端 API:  http://localhost:5679"
echo "  前端界面:  http://localhost:3013"
echo "  按 Ctrl+C 停止"
echo ""

trap 'kill 0' EXIT
(cd "$ROOT/backend" && npm run dev) &
(cd "$ROOT/frontend" && npm run dev) &
wait
