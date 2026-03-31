# 태민이 마일리지 (mile.ly) 프로젝트 규칙

## 🔴 사고 사례 — 반드시 읽고 숙지할 것
아래 사고들이 실제로 발생했다. 같은 실수를 절대 반복하지 말 것.

### 사고 1: dev/index.html 롤백 (2025-03-29)
- **원인**: 세션 A가 git worktree를 만들어 작업 후, 그 worktree(오래된 코드 기반)에서 main의 dev/index.html로 sync했다.
  그 사이 세션 B가 main에 직접 47개 커밋을 해서 dev/index.html을 크게 발전시킨 상태였으나, 세션 A는 그것을 모르고 덮어썼다.
- **피해**: 새벽에 한 47커밋 분량의 작업이 전부 날아감
- **교훈**: sync 전 반드시 `origin/main:dev/index.html`의 최신 버전과 줄 수/해시를 비교해야 한다

### 사고 2: Firestore 운영 데이터 전부 초기화 (2025-03-29)
- **원인**: dev/index.html이 구버전으로 롤백되면서, 사용자 브라우저에서 구버전 코드가 실행됨.
  구버전 코드는 familyMeta 마이그레이션 등의 로직이 달라서, `defaultState()` 기반의 빈 데이터로 Firestore에 save() 해버림.
- **피해**: 505 마일리지, 활동기록 70건, 보상 17개, 뱃지 19개, 가족메시지 57건 등 전부 초기화
- **교훈**: 코드 변경은 곧 데이터 변경이다. Firestore에 쓰는 코드를 배포할 때는 특히 주의

### 사고 3: dev/ 폴더 전체 sync로 아이콘·에셋 롤백 (2026-03-31)
- **원인**: sync 스크립트가 dev 브랜치의 `dev/` 폴더 **전체**를 main의 `dev/`에 복사.
  dev 브랜치에는 구버전 아이콘 파일들이 있었으나, main의 `dev/` 폴더에는 이후에 직접 커밋한 최신 아이콘이 있었음.
  sync 스크립트는 index.html 줄 수만 비교하고, 아이콘/매니페스트 등 다른 파일은 비교 없이 덮어씀.
- **피해**: PWA 아이콘 14개가 구버전으로 교체, icon-180-maskable.png/icon-preview.png/og-image.png 삭제, manifest.json 구버전으로 변경 → 아이폰 바로가기 아이콘이 예전 아이콘으로 변경됨
- **교훈**:
  1. sync 스크립트는 `index.html`뿐 아니라 **모든 파일**을 비교해야 한다
  2. dev 브랜치에 없는 파일이 main에 있으면 **삭제하면 안 된다**
  3. **sync 전 `git diff --stat` 출력을 사용자에게 보여주고 승인받을 것**
  4. 아이콘/에셋 등 바이너리 파일은 dev 브랜치가 아닌 **main에 직접 관리**하는 것이 안전

---

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

## 🔴 동기화 안전 규칙 (필수) — 위반 시 운영 에셋 소실됨
1. **sync 대상은 `dev/index.html` 단일 파일만** — 아이콘, 매니페스트, 이미지 등 에셋은 sync 대상에서 제외
2. dev 브랜치의 `dev/` 폴더 전체를 main에 복사하는 것은 **금지** — main의 dev/ 폴더에 직접 커밋된 에셋이 있을 수 있음
3. sync 전 반드시 `git diff --stat` 출력을 **사용자에게 보여주고 승인** 받기
4. **index.html 이외 파일이 변경/삭제되면 즉시 중단**하고 사용자에게 확인
5. 아이콘/매니페스트/이미지 등 에셋은 **main 브랜치에서 직접 관리** (dev 브랜치 sync 대상 아님)
6. **sync 스크립트(`scripts/sync-dev-to-main.sh`) 사용 금지** — 이 스크립트는 dev/ 폴더 전체를 복사하므로 에셋 롤백 위험이 있음
7. 대신 수동으로: `git checkout main` → `git show dev:dev/index.html > dev/index.html` → `git add dev/index.html` → `git commit` → `git push`

## 🔴 배포 시 필수 현행화 (매 배포마다 반드시 수행)
1. **`dev_guide.md` 현행화**: 변경사항, 커밋 이력, 트러블슈팅 등 최신 상태로 업데이트
2. **APP_CHANGELOG 업데이트**: 개발기/운영기 각각의 `APP_CHANGELOG` 배열에 해당 배포의 신규 기능/버그 수정 항목을 추가
3. 배포 대상이 운영기인 경우 `_ENV='prod'` 유지 반드시 확인

## 🔴 버그 수정 시 필수: 문서 먼저 읽기
- **문제가 발생하면 코드를 만지기 전에 반드시 `dev_guide.md`를 먼저 읽을 것**
- 특히 **섹션 12 (인증 화면 UX 트러블슈팅)** — 과거에 동일한 문제가 발생하여 원인과 해결법이 이미 기록되어 있을 가능성이 높음
- 문서에 기록된 해결법이 있으면 그것을 **그대로** 따를 것. 임의로 다른 접근법을 시도하지 말 것
- 문서에 없는 새로운 문제인 경우에만 자체 분석 진행
- **해결 후에는 반드시 `dev_guide.md`에 증상·원인·수정·교훈을 기록**

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
