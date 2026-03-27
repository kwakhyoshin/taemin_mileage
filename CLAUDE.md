# 태민이 마일리지 (mile.ly) 프로젝트 규칙

## Git 워크플로우
- **main 브랜치**: 운영기. 직접 수정 절대 금지.
- **dev 브랜치**: 개발기. 모든 개발은 여기서.
- `main`의 루트 `index.html`: 운영기 전용 코드 (9,574줄). 절대 덮어쓰지 않는다.
- `main`의 `dev/` 폴더: 개발기 코드. sync 스크립트로만 동기화.

## 배포 규칙
- dev → main/dev 동기화: 반드시 `scripts/sync-dev-to-main.sh` 사용
- 이 스크립트는 main 루트 index.html의 `_ENV`를 `'prod'`로 보호함
- **수동으로 main에 push하지 않는다**

## 코드 수정 규칙
- `index.html` 수정 후 반드시 dev 브랜치에 commit + push
- 동시에 여러 세션이 같은 파일을 수정하지 않는다
- 수정 후 Playwright로 세로모드(390x844) 스크린샷 검증 권장

## 운영기 보호
- main 루트 `index.html`은 사용자(kwakhyoshin)가 직접 업로드한 버전을 유지
- 개발기 코드와 운영기 코드는 완전히 분리
- `_ENV='prod'`는 운영기, `_ENV='dev'`는 개발기

## Claude Code 세션 주의사항
- 작업 시작 전 반드시 현재 브랜치 확인: `git branch`
- main 브랜치에서는 CLAUDE.md, scripts/, .claude/ 등 비코드 파일만 수정 가능
- 실수로 main에서 index.html을 수정했다면 즉시 `git checkout main -- index.html` 으로 복원
