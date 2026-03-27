#!/usr/bin/env bash
# scripts/pre-push-hook.sh
# .git/hooks/pre-push 로 복사(또는 심링크)해서 사용
# main 브랜치 push 시 루트 index.html의 _ENV가 'prod'인지 검증

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
REMOTE="$1"
# REMOTE_URL="$2"  # 필요 시 사용

while read -r LOCAL_REF LOCAL_SHA REMOTE_REF _REMOTE_SHA; do
  # 삭제 push (SHA가 0이면) 무시
  if [ "$LOCAL_SHA" = "0000000000000000000000000000000000000000" ]; then
    continue
  fi

  # main 브랜치 push 감지
  if echo "$REMOTE_REF" | grep -qE "^refs/heads/main$"; then
    INDEX_HTML="$REPO_ROOT/index.html"

    if [ ! -f "$INDEX_HTML" ]; then
      echo "⚠️  pre-push: index.html을 찾을 수 없습니다. 계속 진행합니다."
      continue
    fi

    ENV_VALUE=$(grep -oP "const _ENV = '\K[^']+" "$INDEX_HTML" 2>/dev/null || true)

    if [ "$ENV_VALUE" = "dev" ]; then
      echo ""
      echo "🚨 =============================================="
      echo "🚨  PUSH 차단: 운영기 보호 규칙 위반"
      echo "🚨 =============================================="
      echo "🚨  main 브랜치 index.html의 _ENV = 'dev' 입니다!"
      echo "🚨  운영기에 개발 코드가 배포될 위험이 있습니다."
      echo ""
      echo "   해결 방법:"
      echo "   1. git checkout main -- index.html   # 운영기 원본 복원"
      echo "   2. 또는 scripts/sync-dev-to-main.sh 사용 (안전한 동기화)"
      echo ""
      echo "🚨 =============================================="
      exit 1
    fi

    if [ -z "$ENV_VALUE" ]; then
      echo "⚠️  pre-push: index.html에서 _ENV 값을 감지할 수 없습니다."
      echo "   계속 진행하지만 운영기 파일을 직접 확인하세요."
    else
      echo "✅ pre-push: main index.html _ENV='$ENV_VALUE' 확인됨."
    fi
  fi
done

exit 0
