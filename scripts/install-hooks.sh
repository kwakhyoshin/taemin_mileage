#!/usr/bin/env bash
# scripts/install-hooks.sh
# Git hooks를 .git/hooks/에 설치 (심링크 방식)
# 새로운 개발 환경 설정 시 한 번 실행

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$REPO_ROOT/.git/hooks"
SCRIPTS_DIR="$REPO_ROOT/scripts"

echo "=== Git Hooks 설치 ==="

# pre-push hook 설치
SRC="$SCRIPTS_DIR/pre-push-hook.sh"
DST="$HOOKS_DIR/pre-push"

chmod +x "$SRC"

if [ -L "$DST" ]; then
  echo "  pre-push: 기존 심링크 교체"
  rm "$DST"
elif [ -f "$DST" ]; then
  echo "  pre-push: 기존 hook 백업 → pre-push.bak"
  mv "$DST" "$DST.bak"
fi

ln -s "$SRC" "$DST"
echo "  ✅ pre-push hook 설치: $DST → $SRC"

echo ""
echo "=== 설치 완료 ==="
echo "이제 main 브랜치에 push할 때 _ENV 검증이 자동으로 실행됩니다."
