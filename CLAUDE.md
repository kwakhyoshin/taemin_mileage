# 태민이 마일리지 (mile.ly) 프로젝트 규칙

## 🔴 사고 사례 — 반드시 읽고 숙지할 것
아래 사고들이 실제로 발생했다. 같은 실수를 절대 반복하지 말 것.

### 사고 1: dev/index.html 롤백 (2025-03-29)
- **원인**: 세션 A가 git worktree를 만들어 작업 후, 그 worktree(오래된 코드 기반)에서 main의 dev/index.html로 sync했다.
  그 사이 세션 B가 main에 직접 47개 커밋을 해서 dev/index.html을 크게 발전시킨 상태였으나, 세션 A는 그것을 모르고 덮어썼다.
- **피해**: 새벽에 한 47커밋 분량의 작업이 전부 날아감
- **교훈**: 반드시 최신 main을 pull한 후 작업해야 한다

### 사고 2: Firestore 운영 데이터 전부 초기화 (2025-03-29)
- **원인**: dev/index.html이 구버전으로 롤백되면서, 사용자 브라우저에서 구버전 코드가 실행됨.
  구버전 코드는 familyMeta 마이그레이션 등의 로직이 달라서, `defaultState()` 기반의 빈 데이터로 Firestore에 save() 해버림.
- **피해**: 505 마일리지, 활동기록 70건, 보상 17개, 뱃지 19개, 가족메시지 57건 등 전부 초기화
- **교훈**: 코드 변경은 곧 데이터 변경이다. Firestore에 쓰는 코드를 배포할 때는 특히 주의

### 사고 3: dev/ 폴더 전체 sync로 아이콘·에셋 롤백 (2026-03-31)
- **원인**: sync 스크립트가 dev 브랜치의 `dev/` 폴더 **전체**를 main의 `dev/`에 복사.
  dev 브랜치에는 구버전 아이콘 파일들이 있었으나, main의 `dev/` 폴더에는 이후에 직접 커밋한 최신 아이콘이 있었음.
- **피해**: PWA 아이콘 14개가 구버전으로 교체, icon-180-maskable.png/icon-preview.png/og-image.png 삭제, manifest.json 구버전으로 변경 → 아이폰 바로가기 아이콘이 예전 아이콘으로 변경됨
- **교훈**:
  1. 구 sync 스크립트나 dev 브랜치를 통한 동기화는 에셋 롤백 위험이 있다
  2. **feature 브랜치에서 작업 → PR로 diff 확인 → merge** 절차가 이런 사고를 방지한다
  3. 아이콘/에셋 등 바이너리 파일 변경은 PR diff에서 반드시 확인

---

## 📄 공식 문서
- **`CLAUDE.md`** (이 파일): Claude 세션 필수 규칙 — 새 세션 시작 시 가장 먼저 읽을 것
- **`dev_guide.md`** (공식 개발 가이드): 아키텍처, 기능 상세, 트러블슈팅, 변경 이력 등 모든 상세 내용
  - 새 기능 추가, 버그 수정, 사고 사례 등은 반드시 `dev_guide.md`에 기록
  - ⚠️ `DEV_GUIDE.md`는 사용하지 않음 (과거 중복 파일, 삭제됨)

## 🔵 Git 워크플로우 — 트렁크 베이스드 개발
### 원칙
- **main 브랜치 하나만 사용** (trunk)
- **모든 코드 변경은 feature 브랜치에서 작업** → PR → main에 merge
- main에 직접 코드 커밋하지 않는다 (문서/설정 파일 예외 — 아래 참고)

### 프로젝트 구조
```
main 브랜치
├── index.html          ← 운영기 코드 (_ENV='prod'). 사용자 명시 요청 없이 수정 금지
├── dev/index.html      ← 개발기 코드 (_ENV='dev'). 모든 기능 개발은 여기서
├── dev/icon-*.png      ← PWA 아이콘 (main에서 직접 관리)
├── dev/manifest.json   ← PWA 매니페스트 (main에서 직접 관리)
├── CLAUDE.md           ← 이 파일
└── dev_guide.md        ← 공식 개발 가이드
```

### 개발기 작업 절차 (feature 브랜치)
```bash
# 1. 최신 main에서 feature 브랜치 생성
git checkout main && git pull origin main
git checkout -b feature/기능명

# 2. 코드 수정 (dev/index.html만)
#    ... 수정 작업 ...

# 3. 커밋 & 푸시
git add dev/index.html
git commit -m "feat: 기능 설명"
git push origin feature/기능명

# 4. PR 생성 → diff 확인 → 문제 없으면 merge
gh pr create --title "제목" --body "설명"

# 5. main에 merge 후 feature 브랜치 삭제
gh pr merge --merge
git checkout main && git pull
git branch -d feature/기능명
```

### 운영기 배포 절차 (release 브랜치)
사용자가 운영 반영을 요청한 경우에만 진행한다.
```bash
# 1. 최신 main에서 release 브랜치 생성
git checkout main && git pull origin main
git checkout -b release/v날짜

# 2. dev/index.html 내용을 루트 index.html에 반영
#    - dev/index.html → index.html로 복사
#    - _ENV='dev' → _ENV='prod' 변경
#    - 반드시 diff로 변경 내용 사용자에게 보여주고 승인받기

# 3. 커밋 & 푸시
git add index.html
git commit -m "release: 운영 반영 설명"
git push origin release/v날짜

# 4. PR 생성 → diff 확인
gh pr create --title "release: 운영 반영" --body "변경 내용"

# 5. 통시테스트 (release 브랜치의 GitHub Pages로 검증)
#    - 사용자가 운영기 동작 확인
#    - 문제 발견 시 release 브랜치에서 수정 후 재테스트

# 6. 통시테스트 통과 → main에 merge
gh pr merge --merge
git checkout main && git pull

# 7. main 배포 후 최종 테스트
#    - 사용자가 실제 운영 URL에서 최종 확인
#    - 문제 시 git revert로 롤백

# 8. release 브랜치 삭제
git branch -d release/v날짜
git push origin --delete release/v날짜
```

### 운영기 배포 시 주의사항
- `_ENV='prod'` 유지 반드시 확인 (가장 중요)
- dev/index.html과 index.html의 diff를 사용자에게 보여주고 **승인 후** merge
- 통시테스트 없이 main merge 금지
- 문제 발생 시 즉시 `git revert`로 롤백

### main 직접 커밋 허용 범위
다음 파일들만 main에 직접 커밋 허용 (코드 변경 아님):
- `CLAUDE.md`, `dev_guide.md` (문서)
- `scripts/`, `.claude/` (도구/설정)
- `dev/icon-*.png`, `dev/manifest.json`, `dev/og-image.png` (에셋)

### 금지 사항
- **main에 코드(index.html, dev/index.html) 직접 커밋 금지** — 반드시 feature 브랜치 → PR → merge
- **git worktree 사용 금지** — 오래된 코드 기반으로 덮어쓸 위험
- **git plumbing 명령어(read-tree, write-tree, commit-tree 등) 금지**
- **`scripts/sync-dev-to-main.sh` 사용 금지** — 폴더 전체 복사로 에셋 롤백 위험
- **dev 브랜치 사용 금지** — 과거 워크플로우, 현재는 feature 브랜치 사용

## 🔴 배포 시 필수 사항
1. **버전 정보 알려주기**: 배포 후 개발기 좌측 상단 DEV 버전 값 (예: `DEV v0331k`)을 반드시 사용자에게 메시지로 전달
2. **`dev_guide.md` 현행화**: 변경사항, 커밋 이력, 트러블슈팅 등 최신 상태로 업데이트
3. **APP_CHANGELOG 업데이트**: 개발기/운영기 각각의 `APP_CHANGELOG` 배열에 해당 배포의 신규 기능/버그 수정 항목 추가
4. 배포 대상이 운영기인 경우 `_ENV='prod'` 유지 반드시 확인

## 🔴 버그 수정 시 필수: 문서 먼저 읽기
- **문제가 발생하면 코드를 만지기 전에 반드시 `dev_guide.md`를 먼저 읽을 것**
- 특히 **섹션 12 (인증 화면 UX 트러블슈팅)** — 과거에 동일한 문제가 발생하여 원인과 해결법이 이미 기록되어 있을 가능성이 높음
- 문서에 기록된 해결법이 있으면 그것을 **그대로** 따를 것. 임의로 다른 접근법을 시도하지 말 것
- 문서에 없는 새로운 문제인 경우에만 자체 분석 진행
- **해결 후에는 반드시 `dev_guide.md`에 증상·원인·수정·교훈을 기록**

## 🔴 코드 수정 안전 규칙
- 수정 후 Playwright로 세로모드(390x844) 스크린샷 검증 권장
- **코드 덮어쓰기 전 항상 기존 파일 줄 수(wc -l)와 해시(md5sum) 확인**
- PR의 diff에서 **의도하지 않은 파일 변경이 없는지** 반드시 확인
- 아이콘/매니페스트/이미지 등 에셋 파일이 변경되면 즉시 중단하고 사용자에게 확인

## 🔴 운영기 보호
- `index.html` (루트): 운영기 전용. 사용자(kwakhyoshin)가 직접 업로드한 버전 유지
- 개발기 코드(`dev/index.html`)와 운영기 코드(`index.html`)는 완전히 분리
- `_ENV='prod'`는 운영기, `_ENV='dev'`는 개발기

## 🔴 Firestore 데이터 보호 규칙 (최우선)
1. **운영기 Firestore 문서(`users/taemin`)는 절대 코드로 직접 수정하지 않는다**
2. **save() 호출이 포함된 코드 변경 시**: 변경 전후 `defaultState()` 리턴값이 동일한지 확인
3. **마이그레이션 코드 배포 시**: dev 환경(`users/taemin_dev`)에서 먼저 충분히 테스트한 후 운영 배포
4. **앱 코드의 save()에 데이터 소실 방지 로직이 구현되어 있음** — 제거하지 말 것:
   - `S.log` 배열 길이가 기존보다 줄어들면 Firestore에 쓰지 않는다
   - `S.users`가 비어있으면 Firestore에 쓰지 않는다
5. **localStorage 백업(`taemin_v6_backup`)은 삭제하지 않는다** — 유일한 복구 수단
6. **운영 데이터 백업**: `backups/` 폴더에 정기적으로 Firestore 스냅샷 저장할 것 (node scripts/backup-firestore.js)
7. **Chrome에서 Firestore를 직접 조작(setDoc 등)하는 것은 최후의 수단으로만 사용** — 반드시 사용자 승인 후

## Claude Code 세션 주의사항
- 작업 시작 전 반드시 현재 브랜치 확인: `git branch`
- **feature 브랜치에서 작업 중인지 확인** — main에서 직접 코드 수정하고 있다면 즉시 중단
- 실수로 main에서 코드를 수정했다면 즉시 `git stash` → feature 브랜치 생성 → `git stash pop`
- **rollback 요청 시 main의 git log를 확인하여 가장 최신 안정 버전 파악**
