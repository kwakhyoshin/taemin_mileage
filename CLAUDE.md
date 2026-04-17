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

### 사고 4: iOS PWA 하단 검정 영역 — 10회 이상 실패 후 해결 (2026-03-31)
- **증상**: iPhone PWA 콜드스타트 시 로그인 화면 하단에 ~62px 검정 영역 발생. 로그인→로그아웃 하면 사라지고 컨텐츠가 아래로 내려감 (viewport 812px→874px 확장)
- **근본 원인**: `<body class="auth-active">`의 `overflow:hidden`이 iOS PWA 콜드스타트 시 viewport-fit=cover의 safe area 확장을 막음
- **실패한 시도들** (10+ 버전):
  1. html 배경색을 gradient 하단색으로 변경 → 검정이 보라색으로만 변경, 영역 자체 미해결
  2. html 배경을 동일 gradient로 변경 → 여전히 검정 (CSS가 viewport 밖을 그리지 못함)
  3. html 인라인 style background → 여전히 검정
  4. viewport meta 태그 제거/재삽입 → 효과 없음
  5. location.reload() 강제 리로드 → 효과 없음
  6. 색으로 채우는 모든 접근 → 사용자가 명확히 거부 ("영역 자체를 없애야 함")
- **올바른 해결 (v0331y)**:
  ```html
  <!-- body에서 auth-active 제거 -->
  <body data-tab="home">
  ```
  ```javascript
  // 2프레임 후 auth-active 추가 — iOS가 먼저 full viewport 계산하도록
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      document.body.classList.add('auth-active');
    });
  });
  ```
  ```css
  /* html에 safe-area 포함 min-height */
  html{min-height:calc(100% + env(safe-area-inset-top));padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
  ```
- **교훈**: iOS PWA에서 `overflow:hidden`은 viewport 확장을 막는다. body가 먼저 `overflow:hidden` 없이 렌더링되어야 iOS가 safe area를 포함한 full viewport를 계산함

### 사고 5: 통합모드 제거(v0417e) 배포 후 로그인 실패·버튼 무반응·데이터 소실 (2026-04-17)
- **증상**: 운영기 로그인 시 "패스워드가 틀립니다" 에러, 개발기 로그인 후 0 마일리지, 모든 버튼 무반응
- **직접 원인 — 함수 삭제 후 참조 잔존으로 ReferenceError**:
  - `selectMode()`, `createStep4Next()` 함수 본체를 삭제했지만, **window export 목록**(24641, 24649줄)에 해당 심볼이 남아있었음
  - ```javascript
    // 함수는 삭제했는데 이 줄이 남아있음 → ReferenceError
    startCreateFamily, ..., createStep4Next, ...  // ← 존재하지 않는 함수
    selectMode,                                    // ← 존재하지 않는 함수
    ```
  - JavaScript에서 선언되지 않은 변수를 참조하면 `ReferenceError` 발생 → 25,000줄 단일 HTML 파일이므로 **에러 하나가 전체 스크립트 실행을 중단** → 로그인 함수(`doLogin`), 버튼 핸들러 등 모든 함수가 정의되지 않음
- **2차 원인 — `_createState.mode` 속성 삭제 후 참조 잔존**:
  - `_createState` 객체에서 `mode: 'independent'` 속성을 제거했지만, 코드 3곳(6397, 6609, 6851줄)에서 `_createState.mode`를 여전히 참조
  - 첫 번째 에러로 실행이 안 됐기에 실제 피해는 없었지만, 없었더라도 새 가족 생성 시 `mode: undefined`로 Firestore에 저장되는 문제 발생했을 것
- **3차 피해 — 롤백 시 데이터 접근 불가 (사고 2 패턴 반복)**:
  - v0417e 장애 → v0417c로 긴급 롤백 → v0417d에서 이미 서브컬렉션으로 마이그레이션된 데이터를 v0417c가 읽지 못함 → 0 마일리지 표시
  - **데이터 구조 변경(⑤ 서브컬렉션 분할)과 코드 리팩토링(통합모드 제거)을 같은 시기에 배포**했기 때문에 발생한 복합 사고
- **복구**: v0417d(서브컬렉션 지원 코드) 재배포(PR #406)로 데이터 정상 복원
- **교훈**:
  1. **함수/변수 삭제 시 반드시 전체 파일에서 참조 검색** — `grep -n "함수명" dev/index.html`로 window export, onclick, typeof 등 모든 참조 확인 후 삭제
  2. **`replace_all`로 조건문 패턴을 일괄 제거하지 말 것** — 각 변경 지점을 개별적으로 확인해야 함
  3. **데이터 구조 변경과 코드 리팩토링은 절대 동시에 배포하지 말 것** — 롤백 시 데이터 접근 불가. 데이터 마이그레이션 후 최소 며칠 안정화 확인 후 다음 배포 진행
  4. **서브컬렉션 마이그레이션 이후에는 마이그레이션 전 코드로 롤백 불가** — 롤백 대상은 반드시 서브컬렉션을 읽을 수 있는 버전이어야 함
  5. **배포 후 브라우저 콘솔 확인 필수** — `ReferenceError`, `TypeError` 등 에러가 없는지 확인. 이번 사고는 콘솔을 한번만 봤어도 즉시 발견 가능했음

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

## 🔴 브랜드 가이드라인
- **mile.ly 로고 텍스트(브랜드명)의 SVG 경로(폰트)는 절대 변경하지 않는다**
  - 앱 내 `viewBox="34 248 3020 972"`로 시작하는 SVG가 공식 로고 텍스트
  - 새로운 폰트나 글꼴로 mile.ly 텍스트를 재생성하지 말 것 — 반드시 기존 SVG path를 그대로 복사하여 사용
  - 색상만 용도에 맞게 변경 가능 (흰색, 보라색 등)
- **로딩 화면** = `showLoading()` 함수가 생성하는 `#fb-loading` 요소 (보라색 그라데이션 배경 + "데이터 불러오는 중...")
  - "스플래시 화면" `#mily-splash`는 별도 (사용자에게 노출되지 않는 경우가 많음)
- **홈 탭 인사말의 mily 캐릭터**(`#mily-char`)는 `_milySVG()` 함수로 렌더링 — 로고로 바꾸지 말 것

## 🔴 배포 시 필수 사항
1. **버전 정보 알려주기**: 배포 후 개발기 좌측 상단 DEV 버전 값 (예: `DEV v0331k`)을 반드시 사용자에게 메시지로 전달
2. **`dev_guide.md` 현행화**: 변경사항, 커밋 이력, 트러블슈팅 등 최신 상태로 업데이트
3. **APP_CHANGELOG 업데이트**: 개발기/운영기 각각의 `APP_CHANGELOG` 배열에 해당 배포의 신규 기능/버그 수정 항목 추가
4. 배포 대상이 운영기인 경우 `_ENV='prod'` 유지 반드시 확인
5. **ERD 현행화**: 데이터 모델(Firestore 컬렉션/문서 구조, 필드, 서브컬렉션)이 변경된 경우 `erd.html`과 `erd.mermaid`를 반드시 업데이트
6. **`REQUESTS.md` 현행화**: 모든 사용자 요청사항을 `REQUESTS.md`에 기록하고, 개발기/운영기 반영 상태를 반드시 업데이트
7. **JavaScript 구문 검증**: PR merge 전 `<script>` 태그 내 JS를 추출하여 Node.js로 파싱 검증 (`node --check`). 25,000줄 단일 파일은 syntax/reference error 하나에 전체 앱이 멈춤
8. **브라우저 콘솔 확인**: 배포 후 개발기 접속 → 브라우저 콘솔에 `ReferenceError`, `TypeError`, `SyntaxError` 등 빨간 에러가 없는지 확인

## 🔴 코드 삭제/리팩토링 시 필수 규칙 (사고 5 교훈)
- **함수/변수 삭제 전 반드시 전체 파일에서 참조 검색**:
  ```bash
  # 삭제할 함수명으로 반드시 실행 — 하나라도 남으면 ReferenceError → 앱 전체 중단
  grep -n "삭제할함수명" dev/index.html
  ```
  - 특히 확인할 위치: `window.xxx = xxx` export 목록, `onclick="xxx()"` HTML 속성, `typeof xxx` 체크, 함수 내부 호출
- **`replace_all`로 조건문 패턴을 일괄 변경하지 말 것** — 각 변경 지점을 개별적으로 전후 맥락 확인하며 수정
- **객체 속성 삭제 시 해당 속성을 참조하는 모든 코드 확인** — `_createState.mode` 삭제 후 `mode: _createState.mode`가 3곳 남아있던 사례
- **데이터 구조 변경(마이그레이션)과 코드 리팩토링은 절대 동시에 배포하지 말 것**:
  - 데이터 마이그레이션 배포 후 **최소 며칠간 안정화 확인** 후에야 다음 기능 배포 진행
  - 롤백 대상은 반드시 새 데이터 구조를 읽을 수 있는 버전이어야 함 — 그렇지 않으면 사고 2/5처럼 데이터 소실로 이어짐

## 🔴 요청사항 추적 필수 규칙
- **사용자의 모든 요청(기능 추가, 버그 수정, 설계, 문서 작성 등)은 `REQUESTS.md`에 기록한다**
- 각 요청에는 요청번호(R-xxx), 요청일, 내용, 개발기 상태, 운영기 상태, 비고를 포함
- 개발기 배포 시: 해당 요청의 개발기 열에 버전(예: `v0408zA`) 기록
- 운영기 배포 시: 해당 요청의 운영기 열에 PR 번호(예: `PR #300 반영`) 기록
- 새 세션 시작 시 `REQUESTS.md`를 참고하여 미완료 요청 현황을 파악

## 🔴 버그 수정 시 필수: 문서 먼저 읽기
- **문제가 발생하면 코드를 만지기 전에 반드시 `dev_guide.md`를 먼저 읽을 것**
- 특히 **섹션 12 (인증 화면 UX 트러블슈팅)** — 과거에 동일한 문제가 발생하여 원인과 해결법이 이미 기록되어 있을 가능성이 높음
- 문서에 기록된 해결법이 있으면 그것을 **그대로** 따를 것. 임의로 다른 접근법을 시도하지 말 것
- 문서에 없는 새로운 문제인 경우에만 자체 분석 진행
- **해결 후에는 반드시 `dev_guide.md`에 증상·원인·수정·교훈을 기록**

## 🔴 절대 변경 금지 코드 (건드리면 iOS PWA 단차 재발)
다음 코드는 iOS PWA 하단 검정 영역 버그를 해결한 핵심 코드다. **절대 변경/제거하지 말 것.**
사고 4에서 10회 이상 실패 끝에 찾은 해결책이므로, 다른 접근으로 "개선"하려 하지 말 것.

1. **`<body>` 태그에 `auth-active` 클래스 직접 넣지 않는다**
   ```html
   <!-- ✅ 올바름 -->  <body data-tab="home">
   <!-- ❌ 금지 -->    <body data-tab="home" class="auth-active">
   ```
2. **body 직후 `requestAnimationFrame` 2중 호출로 auth-active 추가하는 스크립트 유지**
   ```javascript
   requestAnimationFrame(function(){
     requestAnimationFrame(function(){
       document.body.classList.add('auth-active');
     });
   });
   ```
3. **CSS `html{min-height:calc(100% + env(safe-area-inset-top));padding:env(safe-area-inset-top)...}` 유지**
4. **위 3개 중 하나라도 변경하면 iPhone에서 하단 62px 검정 영역이 재발한다**

## 🔴 코드 수정 안전 규칙
- 수정 후 Playwright로 세로모드(390x844) 스크린샷 검증 권장
- **코드 덮어쓰기 전 항상 기존 파일 줄 수(wc -l)와 해시(md5sum) 확인**
- PR의 diff에서 **의도하지 않은 파일 변경이 없는지** 반드시 확인
- 아이콘/매니페스트/이미지 등 에셋 파일이 변경되면 즉시 중단하고 사용자에게 확인

## 🔴 관리자 페이지 구분 (혼동 주의!)
이 프로젝트에는 **두 가지 관리자 페이지**가 있다. 절대 혼동하지 말 것.

| 구분 | 앱 내 관리자 설정 | 시스템 관리자 페이지 |
|------|-------------------|---------------------|
| 파일 | `dev/index.html` 내부 `adm-p4` 섹션 | `dev/admin.html` (별도 파일) |
| URL | 앱 내 관리 탭 | `/dev/admin.html` (별도 접속) |
| 접근 권한 | 가족 관리자 (일반 사용자) | 시스템 운영자 (개발자만) |
| 대상 | 자기 가족 설정만 | 전체 가족/회원 관리 |
| 위험 기능 | ❌ 넣지 말 것 | ✅ 가족 삭제, 회원 삭제 등 |

**규칙:**
- 사용자가 "관리자 페이지" 또는 "시스템 관리자"라고 하면 → **`admin.html`** (시스템 관리자)
- 가족 삭제, 회원 강제 삭제 등 위험한 기능은 **반드시 `admin.html`에만** 구현
- 앱 내 관리자 설정(`adm-p4`)에는 **자기 가족 설정** 관련 기능만 넣을 것
- **사고 교훈 (R-034)**: 가족 전체 삭제를 앱 내 관리자에 넣어 일반 사용자가 다른 가족을 삭제할 수 있는 보안 문제 발생

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
