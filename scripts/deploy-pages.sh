#!/usr/bin/env bash
# scripts/deploy-pages.sh — 手动部署到 gh-pages 分支（不用 GitHub Actions 也能 push）
# 用法: bash scripts/deploy-pages.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT/frontend"

echo "🧱  Building frontend..."
npm ci --no-audit --no-fund
npm run build

echo "🌐  Switching to gh-pages branch (orphan)..."
cd "$REPO_ROOT"

# 把当前 gh-pages 内容暂存到临时目录（如有）
TMP_DIR="$(mktemp -d)"
git worktree add -B gh-pages "$TMP_DIR/gh-pages" 2>/dev/null || git worktree add "$TMP_DIR/gh-pages" gh-pages

rm -rf "$TMP_DIR/gh-pages"/*
cp -r "$REPO_ROOT/frontend/dist/." "$TMP_DIR/gh-pages/"
cp "$REPO_ROOT/frontend/dist/.nojekyll" "$TMP_DIR/gh-pages/.nojekyll" 2>/dev/null || touch "$TMP_DIR/gh-pages/.nojekyll"

cd "$TMP_DIR/gh-pages"

echo "📝  Committing..."
git add -A
git -c user.name="lzs" -c user.email="lzs@example.com" \
    commit -m "deploy: frontend build $(date +%Y-%m-%dT%H:%M:%S)" \
    --allow-empty

echo "🚀  Pushing gh-pages..."
git push origin gh-pages

cd "$REPO_ROOT"
git worktree remove "$TMP_DIR/gh-pages" --force

echo "✅  Deployed: https://$(git config --get remote.origin.url | sed -E 's/.*://; s/\.git$//')/"
