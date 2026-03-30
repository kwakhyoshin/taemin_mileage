# 태민이 마일리지 (mile.ly) 프로젝트 규칙

## 📄 공식 문서
- **`CLAUDE.md`** (이 파일): Claude 세션 필수 규칙 — 새 세션 시작 시 가장 먼저 읽을 것
- **`dev_guide.md`** (공식 개발 가이드): 아키텍처, 기능 상세, 트러블슈팅, 변경 이력 등 모든 상세 내용
  - 새 기능 추가, 버그 수정, 사고 사례 등은 반드시 `dev_guide.md`에 기록
  - ⚠️ `DEV_GUIDE.md`는 사용하지 않음 (과거 중복 파일, 삭제됨)

## Git 워크플로우
- **main 브랜치에서 직접 작업** (별도 dev 브랜치 없음)
- `main` 루트 `index.html`: 운영기 전용 코드. 사용자 명시 요청 없이 수정 금지
- `main`의 `dev/index.html`: 개발기 코드. 모든 개발은 여기서
- dev 브랜치는 현재 사용하지 않음 (main에 직접 커밋)

## 배포 규칙
- 개발기만 반영: `git add dev/index.html && git commit && git push origin main`
- 운영기 동시 반영: 사용자 요청 시에만, `_ENV='prod'` 유지 반드시 확인
- **git plumbing 명령어(read-tree, write-tree, commit-tree 등)로 main에 커밋 금지**
- **git worktree 사용 금지** — 오래된 코드 기반으로 운영 코드 덮어쓸 위험

## 🔴 배포 시 필수 현행화 (매 배포마다 반드시 수행)
1. **`dev_guide.md` 현행화**: 변경사항, 커밋 이력, 트러블슈팅 등 최신 상태로 업데이트
2. **APP_CHANGELOG 업데이트**: 개발기/운영기 각각의 `APP_CHANGELOG` 배열에 해당 배포의 신규 기능/버그 수정 항목을 추가
3. 배포 대상이 운영기인 경우 `_ENV='prod'` 유지 반드시 확인

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
