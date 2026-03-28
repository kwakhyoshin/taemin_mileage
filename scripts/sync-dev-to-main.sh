#!/usr/bin/env bash
# scripts/sync-dev-to-main.sh
# dev 브랜치의 dev/ 폴더를 main 브랜치에 동기화
# main 루트 index.html은 절대 건드리지 않음

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
SCRIPT_NAME="$(basename "$0")"

echo "=== [$SCRIPT_NAME] 시작 ==="
echo "리포지토리 루트: $REPO_ROOT"

# ── 1. 현재 브랜치 확인 ──────────────────────────────────
CURRENT_BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"
echo "현재 브랜치: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "dev" ]; then
  echo "❌ 오류: dev 브랜치에서 실행해야 합니다. 현재: $CURRENT_BRANCH"
  exit 1
fi

# ── 2. dev 브랜치 index.html의 _ENV 검증 ─────────────────
DEV_INDEX="$REPO_ROOT/index.html"
if [ ! -f "$DEV_INDEX" ]; then
  echo "❌ 오류: dev 브랜치에 index.html이 없습니다."
  exit 1
fi

DEV_ENV_VALUE=$(sed -n "s/.*const _ENV = '\([^']*\)'.*/\1/p" "$DEV_INDEX" 2>/dev/null | head -1 || true)
echo "dev index.html _ENV 값: '$DEV_ENV_VALUE'"

if [ "$DEV_ENV_VALUE" != "dev" ]; then
  echo "⚠️  경고: dev index.html의 _ENV가 'dev'가 아닙니다 (현재: '$DEV_ENV_VALUE')"
  echo "   dev 브랜치 코드를 확인하세요."
  read -rp "   계속 진행하시겠습니까? (y/N): " CONFIRM
  if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo "취소됨."
    exit 0
  fi
fi

# ── 3. 작업 디렉토리 정리 여부 확인 ──────────────────────
if ! git -C "$REPO_ROOT" diff --quiet || ! git -C "$REPO_ROOT" diff --cached --quiet; then
  echo "❌ 오류: 커밋되지 않은 변경사항이 있습니다. 먼저 commit 또는 stash하세요."
  git -C "$REPO_ROOT" status --short
  exit 1
fi

# ── 4. dev/ 폴더를 임시 저장 ─────────────────────────────
TMPDIR_SYNC="$(mktemp -d)"
echo "임시 디렉토리: $TMPDIR_SYNC"

if [ -d "$REPO_ROOT/dev" ]; then
  cp -r "$REPO_ROOT/dev" "$TMPDIR_SYNC/dev"
  echo "✅ dev/ 폴더 임시 저장 완료"
else
  echo "❌ 오류: dev/ 폴더가 없습니다."
  rm -rf "$TMPDIR_SYNC"
  exit 1
fi

# dev/index.html의 _ENV도 확인
DEV_FOLDER_INDEX="$REPO_ROOT/dev/index.html"
if [ -f "$DEV_FOLDER_INDEX" ]; then
  DEV_FOLDER_ENV=$(sed -n "s/.*const _ENV = '\([^']*\)'.*/\1/p" "$DEV_FOLDER_INDEX" 2>/dev/null | head -1 || true)
  echo "dev/index.html _ENV 값: '$DEV_FOLDER_ENV'"
  if [ "$DEV_FOLDER_ENV" != "dev" ]; then
    echo "⚠️  경고: dev/index.html의 _ENV가 'dev'가 아닙니다 (현재: '$DEV_FOLDER_ENV')"
  fi
fi

# ── 5. main 브랜치로 전환 ─────────────────────────────────
echo "main 브랜치로 전환..."
git -C "$REPO_ROOT" checkout main

# ── 6. main 루트 index.html _ENV 검증 ────────────────────
MAIN_INDEX="$REPO_ROOT/index.html"
MAIN_ENV_VALUE=$(sed -n "s/.*const _ENV = '\([^']*\)'.*/\1/p" "$MAIN_INDEX" 2>/dev/null | head -1 || true)
echo "main index.html _ENV 값: '$MAIN_ENV_VALUE'"

if [ "$MAIN_ENV_VALUE" != "prod" ]; then
  echo "🚨 위험: main index.html의 _ENV가 'prod'가 아닙니다! (현재: '$MAIN_ENV_VALUE')"
  echo "   main 루트 index.html을 복원하세요. 동기화를 중단합니다."
  git -C "$REPO_ROOT" checkout dev
  rm -rf "$TMPDIR_SYNC"
  exit 1
fi

# ── 7. main에 dev/ 폴더 동기화 ───────────────────────────
echo "main에 dev/ 폴더 동기화 중..."

# 기존 dev/ 폴더 삭제 후 새로 복사
rm -rf "$REPO_ROOT/dev"
cp -r "$TMPDIR_SYNC/dev" "$REPO_ROOT/dev"
rm -rf "$TMPDIR_SYNC"

echo "✅ dev/ 폴더 동기화 완료"

# ── 8. main index.html이 바뀌지 않았는지 최종 확인 ───────
if git -C "$REPO_ROOT" diff --name-only | grep -q "^index.html$"; then
  echo "🚨 위험: main 루트 index.html이 변경되었습니다! 복원합니다."
  git -C "$REPO_ROOT" checkout -- index.html
  echo "   index.html 복원 완료"
fi

# ── 9. 커밋 및 푸시 ──────────────────────────────────────
CHANGED=$(git -C "$REPO_ROOT" diff --name-only)
if [ -z "$CHANGED" ] && git -C "$REPO_ROOT" diff --cached --quiet; then
  echo "변경사항 없음. 동기화 불필요."
else
  git -C "$REPO_ROOT" add dev/

  # main index.html이 staged되어 있으면 제거
  if git -C "$REPO_ROOT" diff --cached --name-only | grep -q "^index.html$"; then
    echo "🚨 main index.html이 staged되었습니다. 스테이징에서 제거합니다."
    git -C "$REPO_ROOT" restore --staged index.html
  fi

  COMMIT_MSG="Sync: main ← dev ($(date '+%Y-%m-%d %H:%M'))"
  git -C "$REPO_ROOT" commit -m "$COMMIT_MSG"
  echo "✅ 커밋: $COMMIT_MSG"

  git -C "$REPO_ROOT" push origin main
  echo "✅ main 브랜치 push 완료"
fi

# ── 10. dev 브랜치로 복귀 ────────────────────────────────
git -C "$REPO_ROOT" checkout dev
echo "✅ dev 브랜치로 복귀"

echo ""
echo "=== [$SCRIPT_NAME] 완료 ==="
