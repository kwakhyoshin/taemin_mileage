# 태민이 마일리지 (mile.ly) — 개발·운영 완전 가이드

> 이 문서는 새 세션에서 실수 없이 개발·테스트·배포할 수 있도록 모든 핵심 정보를 담고 있습니다.
> **새 세션 시작 시 반드시 이 문서를 먼저 읽을 것.**
> 최종 업데이트: 2026-04-01 (소셜 연동 해제 auth 레지스트리 수정, 로그인 후 상단 색단차 수정, 시작페이지 복원)

---

## 1. 프로젝트 개요

- **앱 이름**: 태민이 마일리지 (mile.ly)
- **형태**: 단일 HTML 파일 PWA (~16,200줄, ~910KB)
- **GitHub**: `https://github.com/kwakhyoshin/taemin_mileage`
- **호스팅**: GitHub Pages (main 브랜치)
- **운영 URL**: `https://kwakhyoshin.github.io/taemin_mileage/`
- **개발 URL**: `https://kwakhyoshin.github.io/taemin_mileage/dev/`
- **Firebase 프로젝트**: `taemin-mileage`
- **API Key**: `AIzaSyDTS81EBGgiuo564ThxvTTOpR_iAHLb8tg`

---

## 2. 파일 구조

```
taemin_mileage/
├── index.html              ← 운영기 코드 (_ENV='prod') ⚠️ 직접 수정 최소화
├── dev/
│   └── index.html          ← 개발기 코드 (_ENV='dev') ← 모든 개발은 여기서
├── sw.js                   ← Service Worker (Push 전용, fetch handler 없음)
├── scripts/
│   ├── sync-dev-to-main.sh ← dev → main/dev 동기화 스크립트
│   └── backup-firestore.js ← Firestore 백업 스크립트
├── backups/                ← Firestore + 소스코드 백업
├── CLAUDE.md               ← Claude Code 세션 규칙 (필독)
└── DEV_GUIDE.md            ← 이 문서
```

---

## 3. 개발 환경 설정

### 3.1 작업 디렉토리
- **workspace repo** (`/sessions/.../mnt/taemin_mileage/`): lock file 이슈로 직접 push 불가
- **작업용 클론** (`/tmp/taemin_push/`): 모든 git 작업은 여기서 수행

```bash
# 최초 클론 (또는 /tmp가 초기화된 경우)
cd /tmp
git clone https://kwakhyoshin:<GITHUB_TOKEN>@github.com/kwakhyoshin/taemin_mileage.git taemin_push
cd taemin_push
git config user.email "nonmarking@gmail.com"
git config user.name "kwakhyoshin"
```

### 3.2 Git 워크플로우
- **main 브랜치만 사용** (별도 dev 브랜치 없음)
- `main` 루트 `index.html` = 운영기, `main` `dev/index.html` = 개발기
- **개발은 기본적으로 dev/index.html만 수정** (운영 반영은 사용자가 별도 요청 시에만)

```bash
# 개발기만 반영 (기본)
git add dev/index.html
git commit -m "변경 내용"
git push origin main

# 운영기 동시 반영 (사용자 요청 시에만)
# ⚠️ index.html의 _ENV='prod' 반드시 유지 확인!
# ⚠️ CSS style 속성에 display 중복 정의 주의!
git add index.html
git commit -m "운영기 배포: 변경 내용"
git push origin main
```

### 3.3 ⛔ 절대 하지 말 것
1. `git worktree` 사용 금지 — 오래된 코드 기반으로 운영코드 덮어쓸 위험
2. `git plumbing` 명령으로 main에 직접 커밋 금지
3. main 루트 `index.html`의 `_ENV`를 `'dev'`로 변경 금지
4. workspace repo에서 직접 push 금지 (lock file 이슈)
5. CSS `style` 속성에 동일 속성 2번 정의 금지 (예: `display:none;...;display:flex` → 마지막만 적용됨)
6. 운영기 변경 시 **사용자가 명시적으로 요청하지 않는 한** 운영기(index.html) 수정 금지

---

## 4. 핵심 아키텍처

### 4.1 환경 분리
| 구분 | 파일 | `_ENV` 값 | Firestore 경로 | localStorage prefix |
|------|------|-----------|----------------|---------------------|
| 운영기 | `index.html` (루트) | `'prod'` | `users/taemin` | `taemin_` |
| 개발기 | `dev/index.html` | `'dev'` | `users/taemin_dev` | `taemin_dev_` |

### 4.2 가족 멤버
| ID | 이름 | 역할 | isAdmin | 설명 |
|----|------|------|---------|------|
| dad | 아빠 | caregiver | true | 관리자, 양육자 |
| mom | 엄마 | caregiver | true | 관리자, 양육자 |
| taemin | 태민 | child | false | 아이 (주 사용자) |

### 4.3 데이터 구조 (Firestore 문서)
```
users/taemin (또는 users/taemin_dev)
├── pts: number                    ← 최상위 마일리지 (레거시/공유모드용)
├── streak: number                 ← 연속 달성 일수
├── longest: number                ← 최장 연속 기록
├── lastDate: string               ← 마지막 활동 날짜 (YYYY-MM-DD)
├── totalDone: number              ← 총 완료 활동 수
├── acts: array                    ← 활동 정의 목록
├── rwds: array                    ← 보상 정의 목록
├── log: array                     ← 활동 기록 [{id, emoji, name, pts, ts, user}]
├── actDone: object                ← 활동 완료 상태 {actId: {count, ts, dates[]}}
├── badges: object                 ← 획득 뱃지 {badgeId: {earnedAt, claimed}}
├── badgeLog: array                ← 뱃지 획득 기록
├── rewardLog: array               ← 보상 거래 기록
├── rewardInventory: array         ← 보유 보상 [{id, rwdId, rwdName, rwdEmoji, pts, status, ...}]
├── rewardRequests: array          ← 보상 사용 요청 [{id, user, rwdName, status, ...}]
├── familyMessages: array          ← 가족 메시지 [{from, to, text, emotion, ts, read}]
├── familyMeta: object             ← 가족 메타 {familyId, familyName, mode, members{}}
├── memberData: object             ← ⭐ 독립모드 멤버별 데이터
│   ├── taemin: {pts, streak, acts, log, actDone, badges, rewardInventory, rewardRequests, ...}
│   └── dad: {pts, streak, acts, log, actDone, badges, ...}
├── users: object                  ← 로그인 계정 {memberId: {id, pwdHash, v}}
├── settings: object               ← 앱 설정
├── customBadges: array            ← 사용자 정의 뱃지
├── stickers: array                ← 스티커
├── moodLog: array                 ← 기분 기록
└── pushDevices: object            ← 푸시 알림 등록 디바이스
```

### 4.4 독립(independent) 모드 데이터 플로우

**⚠️ 이것이 가장 중요한 개념 — 반드시 이해할 것**

```
[Firestore 로드]
  S = Object.assign(defaultState(), data)
  _lastSavedJSON = JSON.stringify(S)    ← 덮어쓰기 방지 핵심!

[로그인 (checkAuth)]
  currentUser = 'taemin'
  syncMemberToGlobal('taemin')          ← S.memberData.taemin → 글로벌 S에 복사
    S.pts = memberData.taemin.pts       ← ⚠️ 이때 최상위 S.pts는 무시됨!
    S.log = memberData.taemin.log
    S.acts = memberData.taemin.acts
    ... (전체 필드 복사)

[UI 조작 → save()]
  syncGlobalToMember('taemin')          ← 글로벌 S → S.memberData.taemin에 저장
    memberData.taemin.pts = S.pts
    memberData.taemin.log = S.log
    ...
  setDoc(DATA_DOC, S)                  ← Firestore에 전체 문서 저장
  _lastSavedJSON = json                ← 에코 방지
```

**⚠️ 핵심**: REST API로 데이터 수정 시 반드시 **S.pts + S.memberData[memberId].pts 양쪽 모두** 수정해야 함!

### 4.5 save() 메커니즘
```
save() 호출
  → syncGlobalToMember() (글로벌 → memberData)
  → _hasDirtyLocal = true
  → 400ms debounce 대기
  → _isSaving = true
  → setDoc(DATA_DOC, S)
  → _lastSavedJSON = json (에코 방지)
  → _hasDirtyLocal = false
  → _lastSaveTime = Date.now() (2초 쿨다운 시작)
  → _isSaving = false
  → _pendingSave면 재귀 호출
```

### 4.6 onSnapshot (실시간 리스너) 동작 순서
```
1. _isSaving이면 → 무시 (자신의 에코)
2. incomingJSON === _lastSavedJSON이면 → 무시 (에코)
3. incomingJSON === JSON.stringify(S)이면 → 무시 (동일)
4. 2초 쿨다운 내 →
   - familyMessages 새 항목만 머지
   - rewardRequests 새 항목만 머지
   - renderNavUsers() + checkNewMessages()
   - return (전체 교체 안 함)
5. _hasDirtyLocal이면 →
   - 인프라 필드(pushDevices, pushBroadcast)만 머지
   - rewardRequests (새 항목 + 상태 변경) 머지
   - rewardInventory (새 항목 + 상태 변경) 머지
   - rewardNotify (최신 timestamp) 머지
   - familyMeta 머지
   - return (로컬 변경 우선)
6. 그 외 → S 전체 교체 + renderAll()
```

---

## 5. 기능별 상세 가이드

### 5.1 공통 레이아웃

#### 5.1.1 하단 네비게이션
- **HTML 요소**: `.nav-container` (z-index:100)
- **탭**: home, log, rwd, hist, my (+ adm: 관리자 전용)
- **함수**:
  - `goTab(tab)` — 탭 전환 진입점
  - `reallyGoTab(tab)` — 실제 탭 렌더링 + 애니메이션
  - `swipeToTab(tab, animClass)` — 슬라이드 애니메이션
- **도킹 상태**: 스크롤 시 하단에 고정, `position:fixed;bottom:0`
- **🐛 과거 버그**: `.toast` 요소가 `pointer-events`를 차단 → `pointer-events:none` 추가로 해결
- **🐛 과거 버그**: 투어 후 `auth-welcome`이 z-index:1000으로 남아 터치 차단 → `endTour()`에서 `hideAllAuth()` 호출로 해결
- **검색어**: `.nav-container`, `.nav-item`, `reallyGoTab`

#### 5.1.2 화면 구조 (screens)
- 각 탭은 `<div class="scr" id="s-{탭명}">` 형태
- 메인 탭: `s-home`, `s-log`, `s-rwd`, `s-hist`, `s-my`, `s-adm`
- 서브 화면: `s-badge` (뱃지 상세, z-index:200, flexbox 구조)
- **z-index 계층**:
  - nav-container: 100
  - s-badge: 200
  - overlays/popups: 900~910
  - auth screens: 1000
  - loading/tour: 9999

#### 5.1.3 토스트 알림
- **HTML**: `.toast` (z-index:999, `pointer-events:none`)
- **함수**: `toast(msg)` — 하단 팝업, 2.8초 후 자동 숨김
- **주의**: 반드시 `pointer-events:none` 유지 — 제거하면 터치 차단

#### 5.1.4 다크모드
- **CSS**: `body.dark { ... }` (CSS 변수로 색상 전환)
- **함수**:
  - `toggleDark()` — 토글
  - `applyDark(v)` — 적용
  - `loadDarkPref()` — localStorage에서 로드
  - `setThemePref(pref)` — 'light'/'dark'/'system' 저장
- **CSS 변수**: `--bg`, `--tx`, `--card`, `--bdr` 등
- **검색어**: `body.dark`, `toggleDark`, `setThemePref`

#### 5.1.5 자녀 테마 색상
- **정의**: `CHILD_THEMES` 배열 (24가지 색상 프리셋)
- **함수**:
  - `getChildTheme(childId)` — 멤버의 테마 조회
  - `applyChildTheme(childId)` — CSS 변수에 적용
  - `themeFromColor(c1)` — hex → 테마 객체 생성
- **검색어**: `CHILD_THEMES`, `applyChildTheme`

---

### 5.2 홈 화면 (s-home)

- **HTML**: `id="s-home"`, `home-top-content`, `home-grid`
- **헤더**: `.home-top` (그라데이션 배경, 날씨/미세먼지 배지)
- **활동 그리드**: `.act-grid` (홈에 표시할 활동 카드)
- **함수**:
  - `renderHero()` — 인사말, 날짜, 통계 렌더링
  - `renderHdrStats()` — 오늘 완료 수, 마일리지, 연속 일수
  - `renderHomeGrid()` — 활동 카드 그리드
  - `getCurrentGreeting(userId)` — 개인화된 인사말
  - `isTodayAllDone()` — 오늘 전체 완료 여부
  - `getDisplayStreak()` — 연속 달성 표시값
- **날씨**: `fetchWeather()` (10분 간격), `weather-badge`, `pm25-badge`, `pm10-badge`
- **검색어**: `renderHero`, `renderHomeGrid`, `home-top`

---

### 5.3 활동 시스템 (s-log)

#### 5.3.1 활동 정의
- **기본 활동**: `DACTS` 배열
- **속성**: `{id, emoji, name, desc, pts, maxDay, cycle, active, showHome, assignedTo}`
- **주기**: daily(매일), weekly(매주), monthly(매달), none(제한없음)
- **상수**: `CYCLE_LABEL`, `CYCLE_CHIP`

#### 5.3.2 활동 렌더링
- **HTML**: `id="s-log"`, `log-list`, `log-child-selector`
- **CSS**: `.log-wrap`, `.log-item`, `.log-item.done`, `.log-badge`, `.log-timer`
- **함수**:
  - `renderLogList()` — 활동 목록 렌더링
  - `doAct(id)` — 활동 완료 처리 (포인트 지급, 로그 기록, 뱃지 체크)
  - `undoAct(actId)` — 활동 취소
  - `markDone(act)` / `unmarkDone(act)` — 상태 변경
  - `canDo(act)` — 수행 가능 여부
  - `countDone(act)` — 주기 내 완료 횟수
  - `isAvailableToday(act)` — 오늘 가능 여부
- **취소 제한**: 보유 마일리지보다 큰 포인트의 활동은 취소 불가 (음수 악용 방지)

#### 5.3.3 관리자: 활동 관리
- **HTML**: 관리자 탭 0번 (at-0)
- **함수**:
  - `renderAdmActList()` — 활동 관리 목록
  - `openActForm(id)` — 활동 편집 폼
  - `saveActivity()` — 활동 저장
  - `togAct(id)` — 활성/비활성 토글
  - `togActHome(id)` — 홈 표시 토글
- **검색어**: `doAct`, `DACTS`, `renderLogList`, `openActForm`

---

### 5.4 보상 시스템 (s-rwd)

#### 5.4.1 보상 정의
- **기본 보상**: `DRWDS` 배열
- **속성**: `{id, emoji, name, pts, goal, assignedTo}`
- **거래 유형**: exchange(교환), refund(환불), use_request(사용신청), approved(승인), rejected(거절), use(사용)

#### 5.4.2 보상 화면
- **HTML**: `id="s-rwd"`, `rwd-grid`, `rwd-inventory`, `rwd-history`
- **CSS**: `.rwd-grid`, `.rwd-card`, `.rwd-card.on-sale`, `.inv-btn`
- **함수**:
  - `renderRewardGrid()` — 보상 카드 표시
  - `renderRewardInventory()` — 보유 보상 표시
  - `renderRewardHistory()` — 거래 내역

#### 5.4.3 보상 교환/사용/환불
- **함수**:
  - `openRedeem(id, srcEl)` → `_openRedeemModal()` — 교환 모달
  - `useReward(invId)` — 사용 신청 (→ rewardRequests에 추가)
  - `refundReward(invId)` — 환불
  - `approveRewardRequest(req, approver)` — 사용 승인
  - `rejectRewardRequest(req, rejector)` — 사용 거절

#### 5.4.4 양육자 대리 신청 로직 (수정됨)
- **위치**: `useReward()` 함수 내
- **로직**:
  - 양육자가 대리 신청 시: `fromUser` = 현재 보고있는 아이 (`viewingChildId`)
  - `toUsers` = 모든 부모 (본인 포함)
  - 메시지에는 아이 이름이 표시됨
  - 아이가 직접 신청 시: `fromUser` = 아이, `toUsers` = 본인 제외 부모

#### 5.4.5 🐛 과거 버그: 보상 알림 누락
- **원인**: onSnapshot 2초 쿨다운이 새 메시지를 완전히 무시
- **수정**: 쿨다운 내에서도 familyMessages/rewardRequests 머지
- **추가**: `_hasDirtyLocal` 경로에서도 rewardRequests/Inventory/Notify 머지
- **검색어**: `useReward`, `approveRewardRequest`, `rewardRequests`

#### 5.4.6 승인대기 레이블 (수정됨)
- **위치**: 메시지 목록의 statusTag 생성 부분 (2곳)
- **수정**: `white-space:nowrap` 추가, '승인 대기' → '승인대기' (띄어쓰기 제거)
- **검색어**: `승인대기`, `statusTag`

---

### 5.5 뱃지 시스템 (s-badge)

#### 5.5.1 뱃지 정의
- **내장 뱃지**: `BADGES` 배열 (~60개)
- **카테고리**: 공부, 꾸준함, 도전, 성장, 생활습관, 감정, 마일리지, 히든
- **속성**: `{id, emoji, name, desc, category, hidden, bonus, label, check:function, icon}`
- **사용자 정의**: `S.customBadges` 배열

#### 5.5.2 뱃지 화면
- **HTML**: `id="s-badge"` (z-index:200, flexbox 구조)
- **구조**: 고정 헤더(`badge-hero`) + 스크롤 콘텐츠
- **함수**:
  - `openBadgeView()` — 뱃지 화면 열기 (display='flex')
  - `closeBadgeView()` — 닫기 (display='none')
  - `renderBadgeViewGrid()` — 뱃지 그리드
  - `renderBadgeViewHistory()` — 획득 히스토리
  - `showBadgeDetail(badgeOrId)` — 뱃지 상세 모달
  - `renderBadgeSummary()` — 홈 화면 요약 카드

#### 5.5.3 뱃지 획득/관리
- **함수**:
  - `checkBadges()` — 매 상태 변경 시 새 뱃지 체크
  - `showBadgeCelebration(badge)` — 획득 축하 애니메이션
  - `claimBadgeMileage(badgeId)` — 보너스 마일리지 수령
  - `manualAwardBadge(badgeId)` — 관리자 수동 부여
  - `revokeBadge(badgeId)` — 관리자 취소

#### 5.5.4 🐛 과거 버그: 뒤로가기 버튼 미동작 + 하단 잘림
- **1차 원인**: `s-badge` z-index(99) < nav-container(100) → z-index:200으로 상향
- **2차 실수**: flexbox 구조(`flex-direction:column` + `flex:1`)로 변경 → 하단 하얗게 잘림
  - `display:none;...;display:flex` 중복 정의로 뱃지 화면 항상 표시되는 버그도 발생 ⚠️
- **최종 수정**: 원래 구조 복원 (`overflow-y:auto` + `position:sticky` 헤더) + z-index:200 유지
  - `openBadgeView()`에서 `display='block'` (flex 아님!)
  - 버튼 터치영역 44px 유지
- **교훈**: CSS 구조 변경은 최소화. z-index만 올리면 되는 문제에 구조까지 건드리지 말 것
- **검색어**: `openBadgeView`, `closeBadgeView`, `s-badge`

---

### 5.6 가족 메시지 시스템

#### 5.6.1 메시지 데이터
- **저장**: `S.familyMessages[]` = `{from, to, text, emotion, ts, read, type, requestId}`
- **감정**: love, happy, cheer, hug, star, sad, angry, laugh
- **특수 타입**: `reward_request` (보상 사용 요청)

#### 5.6.2 메시지 UI
- **팝업들**:
  - `msg-bg`/`msg-pop` — 메시지 작성
  - `recv-msg-bg` — 수신 메시지 표시
  - `msglist-bg` — 대화 목록
- **함수**:
  - `openMsgPop(userId, fromFamily)` — 작성 팝업
  - `sendFamilyMsg()` — 메시지 전송
  - `showReceivedMsg(fromId, text, emotion, msgObj)` — 수신 표시
  - `checkNewMessages()` — 새 메시지 확인
  - `openMsgList(fromId, fromFamily)` — 대화 기록
  - `readMsgFromList(fromId, msgIdx)` — 특정 메시지 열기

#### 5.6.3 보상 요청 메시지
- `handleRewardAction(action)` — 수신 메시지에서 승인/거절
- `handleRewardFromList(msgTs, action)` — 목록에서 승인/거절
- **검색어**: `sendFamilyMsg`, `checkNewMessages`, `familyMessages`

---

### 5.7 기분(무드) 시스템

- **기분 종류**: happy, sad, angry, excited, calm, sick, tired, confused
- **저장**: `S.moodLog[]` = `{mood, emoji, label, ts, user}`
- **함수**:
  - `openMoodPop(fromFamily)` — 기분 선택 팝업
  - `selectMood(mood)` — 기분 선택 및 저장
  - `startMoodParticles()` / `stopMoodParticles()` — 파티클 애니메이션
  - `updateMyAvatarMoodBadge()` — 아바타에 기분 뱃지 표시
- **검색어**: `openMoodPop`, `selectMood`, `moodLog`

---

### 5.8 인증/로그인 시스템

#### 5.8.1 화면 목록
| 화면 ID | 용도 |
|---------|------|
| auth-welcome | 최초 진입 웰컴 |
| auth-insight | 소개 캐러셀 (3슬라이드) |
| auth-login | 로그인 (ID/PW) |
| auth-create-1~5 | 가족 생성 5단계 |
| auth-create-done | 가족 생성 완료 |
| auth-join-select | 가입 멤버 선택 |
| auth-join-register | 가입 등록 |

#### 5.8.2 인증 플로우
```
앱 로드 → checkAuth()
  ├── savedUser 있고 유효 → 자동 로그인 → postLoginInit() → renderAll()
  ├── familyMeta 있음 → 로그인 화면 표시
  └── 데이터 없음 → 웰컴 화면 표시
```

#### 5.8.3 핵심 함수
- `checkAuth()` — 세션 복원 또는 로그인 화면 표시
- `doLogin()` — ID/PW 검증 (SHA-512 해시)
- `postLoginInit()` — 로그인 후 자녀 뷰 설정
- `logout()` — 세션 해제
- `hideAllAuth()` — 모든 인증 화면 숨김
- `showAuthScreen(screen)` — 특정 인증 화면 표시

#### 5.8.4 비밀번호 보안
- SHA-512 해싱 (v2) 또는 레거시 해시
- `hashPassword(pwd)` — 솔트 포함 해싱
- `migratePinIfNeeded()` — PIN 해시 마이그레이션
- **검색어**: `doLogin`, `checkAuth`, `postLoginInit`, `auth-`

---

### 5.9 관리자 패널 (s-adm)

- **5개 서브탭**: Activities(0), Rewards(1), Badges(2), Settings(3), Family(4)
- **탭 전환**: `admTab(i)` 함수
- **접근 제어**: `isCurrentUserAdmin()` — admin 여부 확인

#### 5.9.1 탭 0: 활동 관리
- `renderAdmActList()`, `openActForm()`, `saveActivity()`, `togAct()`, `togActHome()`

#### 5.9.2 탭 1: 보상 관리
- `renderAdmRwdList()`, `openRwdForm()`, `saveReward()`, `toggleRwdClosed()`, `giveBonus()`, `deductPts()`

#### 5.9.3 탭 2: 뱃지 관리
- `renderBadgeMgrList()`, `filterBadgeMgr()`, `openBadgeForm()`, `saveBadgeForm()`, `manualAwardBadge()`, `revokeBadge()`

#### 5.9.4 탭 3: 설정
- 다크모드, 푸시 알림, 연속 보너스, 생일 보너스, 스마트 메시지

#### 5.9.5 탭 4: 가족 관리
- `renderFamilyManager()`, `editFamilyMember()`, `toggleFamilyAdmin()`, `removeFamilyMemberAdmin()`
- 초대 링크 생성/관리
- **검색어**: `admTab`, `renderAdm`, `s-adm`

---

### 5.10 투어/온보딩

- **HTML**: `tour-overlay` (z-index:9999)
- **투어 단계**: `_TOUR_STEPS` 배열 (스포트라이트 + 툴팁)
- **함수**:
  - `startTour()` — 투어 시작
  - `tourNext()` — 다음 단계
  - `tourSkip()` — 건너뛰기
  - `showTourStep(idx)` — 특정 단계 표시
  - `endTour()` — 투어 종료 (**hideAllAuth() 포함** — 터치 차단 방지)
- **과거 수정**: 손가락 화살표(hand) 제거 → `hand: null`로 변경
- **검색어**: `_TOUR_STEPS`, `startTour`, `endTour`, `tour-overlay`

---

### 5.11 아바타 시스템

- **캔버스 기반** 크롭 에디터 (줌/패닝)
- **함수**:
  - `openAvatarEditor(userId, fromFamily)` — 에디터 열기
  - `fitAvatar()` — 자동 맞춤
  - `drawAvatar()` — 캔버스 렌더링
  - `saveAvatarCrop()` — 크롭 저장 (base64)
  - `getAvatarHTML(userId, size)` — 아바타 HTML 생성
  - `sanitizePhotoUrl(url)` — URL 보안 검증
- **검색어**: `openAvatarEditor`, `saveAvatarCrop`, `getAvatarHTML`

---

### 5.12 푸시 알림

- **Service Worker**: `sw.js` (Push 이벤트만 처리, fetch handler 없음 → 캐시 안 함)
- **VAPID**: Firebase Cloud Messaging 사용
- **함수**:
  - `togglePush()` — 푸시 on/off
  - `updatePushUI()` — UI 상태 동기화
  - `getDeviceId()` — 고유 디바이스 ID
- **검색어**: `serviceWorker`, `togglePush`, `sw.js`

---

### 5.13 데이터 동기화 (Firestore + localStorage)

#### 5.13.1 주요 변수
| 변수 | 용도 |
|------|------|
| `S` | 글로벌 상태 객체 (Firestore 문서 전체) |
| `_firebaseReady` | Firebase 초기화 완료 여부 |
| `_isSaving` | 현재 Firestore 저장 진행 중 |
| `_hasDirtyLocal` | 로컬에 미저장 변경 있음 |
| `_lastSavedJSON` | 마지막 저장/로드한 JSON (에코 방지) |
| `_lastSaveTime` | 마지막 저장 시간 (2초 쿨다운) |
| `_pendingSave` | 저장 중 추가 요청 대기 |
| `_saveTimer` | debounce 타이머 |
| `DATA_DOC` | 현재 Firestore 문서 참조 |
| `LEGACY_DOC` | 레거시 문서 참조 (users/taemin) |
| `currentUser` | 현재 로그인 사용자 ID |
| `viewingChildId` | 양육자가 보고 있는 자녀 ID |
| `_globalDataOwner` | 현재 S에 로드된 데이터의 소유자 |
| `_admViewChildId` | 관리자 패널에서 보고 있는 자녀 ID |

#### 5.13.2 localStorage 키
| 키 (prefix + 이름) | 용도 |
|---------------------|------|
| `{prefix}current_user` | 로그인 사용자 ID |
| `{prefix}family_id` | 가족 ID |
| `{prefix}v6_backup` | 전체 데이터 백업 (**삭제 금지**) |
| `{prefix}theme` | 다크모드 설정 |
| `{prefix}onboarded` | 온보딩 완료 여부 |
| `{prefix}tour_done` | 투어 완료 여부 |

#### 5.13.3 핵심 함수
- `save()` — 메인 저장 (debounce + Firestore + localStorage)
- `syncMemberToGlobal(targetId)` — memberData → 글로벌 S
- `syncGlobalToMember(targetId)` — 글로벌 S → memberData
- `getMemberState(memberId)` — 멤버 데이터 조회/초기화
- `defaultState()` — 기본 상태 구조 반환
- **검색어**: `function save`, `syncMemberToGlobal`, `_lastSavedJSON`

---

### 5.14 가족 팝업 / 사용자 상호작용

- **HTML**: 가족 아이콘 클릭 시 팝업
- **함수**:
  - `openFamilyPopup()` / `closeFamilyPopup()` — 가족 팝업
  - `onUserIconClick(userId)` — 가족 멤버 클릭
  - `onMeIconClick()` — 자기 아이콘 클릭
  - `userFmAction(action)` — 멤버 액션 (메시지, 기분 등)
  - `meFmAction(action)` — 자기 액션
- **검색어**: `openFamilyPopup`, `onUserIconClick`

---

### 5.15 기타 기능

#### 5.15.1 스티커
- `S.stickers[]` — 화면에 배치된 스티커
- `cleanExpiredStickers()` — 하루 지난 스티커 자동 삭제

#### 5.15.2 생일 보너스
- `checkBirthdayBonus()` — 아이 생일 체크 및 보너스 지급
- 설정: `settings.birthdayBonus`, `settings.birthdayBonusPts`

#### 5.15.3 데이터 백업/복원 (관리자)
- `backupData()` — JSON 파일 다운로드
- `restoreData(input)` — JSON 파일에서 복원
- `resetToday()` / `doResetToday()` — 오늘 활동 초기화
- `resetAll()` / `doResetAll()` — 전체 초기화

#### 5.15.4 PIN 입력
- `showPin()` — 4자리 PIN 모달
- `updDots()` — 비밀번호 도트 표시

#### 5.15.5 포인트 애니메이션
- `flyCoinsToMileage(sourceEl, amount)` — 코인 날아가는 효과 (획득)
- `flyCoinsFromMileage(targetEl, amount)` — 코인 날아가는 효과 (소비)
- `confetti()` — 축하 파티클

---

## 6. Firestore 데이터 조작 (REST API)

### 6.1 데이터 읽기
```bash
curl -s "https://firestore.googleapis.com/v1/projects/taemin-mileage/databases/(default)/documents/users/taemin?key=AIzaSyDTS81EBGgiuo564ThxvTTOpR_iAHLb8tg"
```

### 6.2 특정 필드 수정 (updateMask)
```bash
curl -s -X PATCH \
  "https://firestore.googleapis.com/v1/projects/taemin-mileage/databases/(default)/documents/users/taemin?key=AIzaSyDTS81EBGgiuo564ThxvTTOpR_iAHLb8tg&updateMask.fieldPaths=memberData&updateMask.fieldPaths=pts" \
  -H "Content-Type: application/json" \
  -d '{"fields": {"pts": {"integerValue": "645"}, "memberData": {...}}}'
```

### 6.3 ⚠️ 데이터 수정 체크리스트
1. ✅ `S.pts` (최상위) + `S.memberData[memberId].pts` (멤버별) **양쪽 모두 수정**
2. ✅ `rewardInventory` / `rewardRequests`도 양쪽 모두
3. ✅ 수정 후 앱이 덮어쓰지 않는지 확인 (`_lastSavedJSON` 보호 로직)
4. ✅ 구버전 코드 캐시 가능성 → hard refresh 안내
5. ✅ localStorage backup (`ml_prod_v6_backup`) → 구버전 앱이 이 값으로 덮어쓸 수 있음

---

## 7. 배포 체크리스트

### 7.1 개발기만 반영 (기본)
```bash
# 1. 수정
vi dev/index.html

# 2. 커밋 & 푸시
git add dev/index.html
git commit -m "변경 내용"
git push origin main

# 3. 확인
# https://kwakhyoshin.github.io/taemin_mileage/dev/
```

### 7.2 운영기 동시 반영 (사용자 요청 시에만)
```bash
# 1. dev/index.html 수정 → 커밋
# 2. index.html에도 동일 수정 (⚠️ 아래 체크)
grep "const _ENV" index.html  # 반드시 'prod' 확인!
# 3. ⚠️ CSS style 속성 중복 검사 (display 등)
grep -n 'display:none.*display:' index.html  # 중복 없어야 함
# 4. 커밋 & 푸시
git add index.html && git commit -m "운영기 배포: ..." && git push
```

### 7.3 배포 전 필수 확인
- [ ] `_ENV` 값 정확한지 (dev/prod)
- [ ] CSS `style` 속성에 동일 속성 2번 정의 안 했는지
- [ ] `defaultState()` 변경 시 마이그레이션 코드 있는지
- [ ] `save()` 호출 경로에 불필요한 저장 없는지
- [ ] 뱃지/팝업 `display:none` 초기값이 다른 display 값으로 덮이지 않는지

---

## 8. 과거 사고 사례 및 교훈

### 사고 1: dev/index.html 롤백 (2025-03-29)
- **원인**: git worktree의 오래된 코드가 main의 dev/index.html 덮어씀
- **피해**: 47커밋 분량의 작업 소실
- **방지**: worktree 사용 금지, sync 전 줄 수/해시 비교

### 사고 2: Firestore 운영 데이터 전부 초기화 (2025-03-29)
- **원인**: 구버전 코드가 `defaultState()` 빈 데이터를 Firestore에 save()
- **피해**: 마일리지, 활동기록, 보상, 뱃지, 메시지 전부 초기화
- **방지**: `_lastSavedJSON` 초기화, save() 데이터 소실 방지 로직

### 사고 3: memberData vs 최상위 필드 불일치 (2026-03-30)
- **원인**: REST API로 `S.pts`만 645로 수정, `memberData.taemin.pts`는 145 그대로
- **증상**: 앱에서 145 표시 (syncMemberToGlobal이 memberData에서 로드)
- **방지**: 항상 양쪽 모두 수정

### 사고 4: Firestore 덮어쓰기 (2026-03-30)
- **원인**: `_lastSavedJSON` 미설정 → 앱이 로드 직후 save() 실행
- **수정**: Firestore 로드 직후 `_lastSavedJSON = JSON.stringify(S)` 추가

### 사고 5: CSS display 중복 → 뱃지 화면 항상 표시 (2026-03-30) ⚠️
- **원인**: `style="display:none;...;display:flex"` → 마지막 값 flex만 적용
- **피해**: 운영기+개발기 모두 뱃지 화면이 기본으로 떠서 앱 사용 불가
- **수정**: `display:flex` 제거, `flex-direction:column`만 유지
- **방지**: CSS style 속성 중복 검사 필수, 배포 전 `grep -n 'display:none.*display:'` 실행

### 사고 6: flexbox 구조 변경 → 하단 잘림 (2026-03-30)
- **원인**: 뱃지 화면을 flexbox(`flex-direction:column` + `flex:1`)로 변경
- **증상**: 하단부가 하얗게 잘리고 스크롤 영역 이상
- **수정**: 원래 구조 복원 (`overflow-y:auto` 컨테이너 + `position:sticky` 헤더)
- **교훈**: CSS 구조 변경은 최소화. z-index만 바꾸면 되는 문제에 레이아웃 구조까지 변경하지 말 것

### 버그 7: tour-overlay가 뱃지 뒤로가기 클릭 차단 (2026-03-30)
- **원인**: `#tour-content`에 `pointer-events:auto`가 기본값으로 설정됨. 투어가 비활성(`opacity:0`)일 때도 z-index:8000 위치에서 클릭을 가로챔
- **증상**: 뱃지 화면 뒤로가기 버튼 터치 무반응
- **수정**: `#tour-content` 기본값을 `pointer-events:none`으로, `#tour-overlay.active #tour-content`에만 `pointer-events:auto` 추가
- **교훈**: 높은 z-index 오버레이는 비활성 시 반드시 `pointer-events:none` 확인. `elementFromPoint()`로 클릭 차단 요소 진단

### 버그 8: PIN 변경 후 하단 네비 사라짐 (2026-03-30)
- **원인**: `showPin()`이 new1→new2 전환 시 두 번 호출, 매번 `lockBodyScroll()` 호출로 `_scrollLockCount`가 2가 됨. `closePin()`은 `unlockBodyScroll()` 한 번만 호출 → count=1 → `popup-open` 클래스 유지 → nav 숨김
- **수정**: `showPin()`에서 pin-wrap이 이미 보이면 `lockBodyScroll()` 호출 건너뜀
- **교훈**: `lockBodyScroll`/`unlockBodyScroll` 쌍은 반드시 1:1 매칭. 모드 전환 시 기존 오버레이가 열려있는지 확인 필요

---

## 9. 커밋 히스토리 (2026-03-29~30)

| 커밋 | 내용 | 범위 |
|------|------|------|
| f942165 | 투어 손가락 화살표 제거 | dev |
| c1c2784 | 투어 손가락 화살표 제거 | prod |
| 192cfd0 | 보상 알림 onSnapshot 머지 버그 수정 | dev |
| 238d365 | 보상 알림 머지 | prod |
| 0f1e287 | 하단 네비게이션 터치 버그 수정 | dev |
| 7b45029 | 하단 네비게이션 터치 | prod |
| 691ac9b | 양육자 보상 알림 + _lastSavedJSON 보호 | dev |
| d28f3f4 | 양육자 보상 알림 + 데이터 보호 | prod |
| 6884dd3 | 뱃지 뒤로가기 + 승인대기 nowrap | dev |
| ee0cae8 | 뱃지 뒤로가기 | prod |
| 561efb3 | **긴급수정**: display 중복 해결 | dev+prod |
| 39215e8 | 활동 취소 시 마일리지 음수 방지 | dev |
| 8ff1812 | 뱃지 화면 원래 구조 복원 (sticky 헤더 + overflow-y:auto) | dev |
| 62c1bb7 | tour-content pointer-events + PIN nav + 네비 아이콘 확대 | dev |
| 97d43cc | tour-content + PIN nav + 뱃지구조복원 + 네비아이콘 | prod |
| 35e1989 | 초대링크 [DEV] 태그 제거 + URL _ENV 분기 | dev+prod |
| 4d5a37b | 승인대기 nowrap + Android 상태바 갭(html::after) | dev+prod |
| e6ad6e0 | maskable 아이콘 모서리 아티팩트 제거 (full-bleed 코너) | assets |
| a60530f | 브라우저 theme-color 부팅 초기화 + OG 메타태그 | dev |
| cf357e3 | 브라우저 theme-color 부팅 초기화 + OG 메타태그 | prod |
| 4703364 | OG title에 [개발기] 태그 추가 | dev |
| 3c0b901 | 인사말/스마트메시지 대폭 확장 + 네모 이모지 교체 | dev |
| 75e629b | 미세먼지 AQI→µg/m³ 변환 버그 수정 | dev |
| 4cfaf17 | 미세먼지 AQI→µg/m³ 변환 버그 수정 | prod |

---

## 10. 긴급 복구

### Firestore 데이터 복원
```bash
# 백업 폴더 확인
ls backups/

# REST API PATCH로 특정 필드 복원
# 반드시 memberData와 최상위 필드 양쪽 모두 수정!
```

### 코드 롤백
```bash
git log --oneline -20
git checkout <commit-hash> -- dev/index.html  # 개발기
git checkout <commit-hash> -- index.html       # 운영기 (긴급 시에만)
```

### localStorage 백업
- 키: `ml_prod_v6_backup` (운영), `ml_v6_backup` (개발)
- 브라우저 DevTools > Application > Local Storage
- **절대 삭제 금지** — 유일한 클라이언트 측 복구 수단

---

## 11. 인증 시스템 개편 (2026-03-30~)

### 11.1 인증 방식 (현재 상태)
- **기존**: 자체 ID/비밀번호 (SHA-512 해시, 글로벌 ID 레지스트리)
- **신규 (Phase 1 완료)**: Google 간편로그인 (`signInWithPopup` + `onAuthStateChanged`)

| 방식 | 구현 방법 | 상태 |
|------|-----------|------|
| 기존 ID/PW | 현행 유지 | ✅ 운영 중 |
| 구글 간편로그인 | Firebase Auth `signInWithPopup(GoogleAuthProvider)` | ✅ 구현 완료 |
| 카카오 간편로그인 | REST API Authorization Code flow + 팝업 | ✅ 구현 완료 |
| 네이버 간편로그인 | Naver Login SDK 2.0 OAuth 팝업 + postMessage + localStorage fallback | ✅ 구현 완료 |
| 이메일 인증 | Cloud Functions로 6자리 코드 발송 → 검증 | 미구현 |

### 11.2 Firebase 플랜
- **Blaze(종량제) 플랜 사용 중**
- Cloud Functions, 외부 네트워크 호출(이메일 발송) 등에 Blaze 필요
- 실사용량이면 무료 범위 내 (월 125K 호출, 40K GB-초)

### 11.3 기술 스택
- **Firebase Auth SDK**: `firebase-auth.js` v10.12.0
- **Firebase Cloud Functions**: Node.js 20, `functions/` 디렉토리
- **카카오 SDK**: REST API (JS SDK 미사용, `Kakao.Auth.login()` 제거됨)
- **네이버 SDK**: `https://static.nid.naver.com/js/naveridlogin_js_sdk_2.0.2.js`

### 11.4 Firestore 스키마 변경
```javascript
// 기존 ID/PW 사용자 — 변경 없음
account: { id: string, pwdHash: string, v: 2 }

// 소셜 로그인 사용자
account: {
  authProvider: 'google'|'kakao'|'naver',
  authUid: string,
  email: string,
  v: 2
}

// 글로벌 레지스트리 (families/_auth_registry, families/_dev_auth_registry)
{
  [uid]: {
    familyId: string,
    memberId: string,
    provider: 'google'|'kakao'|'naver'|'email',
    email: string,
    createdAt: timestamp
  }
}
```

### 11.5 카카오 개발자 포털 앱
- 앱 이름: **mile.ly**, 앱 ID: **1418261**
- JavaScript Key: `cc62aab8cd94eb2306350f53bfa75dd4`
- REST API Key: `bd6311dbabf65b823a5160e3973cb483`
- 동의항목: 닉네임(필수), 이메일(비즈앱 필요)
- Authorization Code flow 사용 (`response_type=code`)

### 11.6 네이버 개발자 포털 앱
- 앱 이름: **마일리** (네이버에서 '.' 문자 불가)
- Client ID: `_fBugrKRKZm45ibQLosP`
- Client Secret: `s_ddXSvpnG`
- 개발 상태: 개발 중 (일반 사용자 서비스 시 검수 필요)
- Callback URL: `https://kwakhyoshin.github.io/taemin_mileage/dev/`, `.../taemin_mileage/`

---

## 12. 인증 화면 UX 트러블슈팅 (2026-03-30)

> 이 섹션은 인증 화면에서 발생한 까다로운 문제들의 원인과 해결법을 기록한다.
> 같은 실수를 반복하지 않기 위해 반드시 숙지할 것.

### 12.1 구글 로그인 딜레이 (로딩 표시 시점)
- **증상**: Google 로그인 버튼 클릭 → 아무 반응 없이 멈춘 것처럼 보임 → 한참 후 팝업
- **원인**: `_showSocialLoading()` 호출이 `signInWithPopup()` 반환 후에 위치
- **수정**: `_showSocialLoading(_provLabel)`을 `signInWithPopup()` **호출 전**으로 이동
- **교훈**: 사용자 피드백(로딩 UI)은 비동기 작업 시작 전에 표시해야 함

### 12.2 네이버 로그인 모바일 미완료 (`window.opener` null)
- **증상**: 모바일에서 네이버 로그인 팝업 후 아무 일도 안 일어남
- **원인**: 모바일 브라우저에서 `window.opener`가 null → `postMessage` 전달 불가
- **수정**: localStorage fallback 구현
  - 콜백 팝업: `localStorage.setItem('taemin_v6_naver_callback_result', JSON.stringify(data))` 저장
  - 부모 창: 팝업 닫힘 감지 후 `localStorage.getItem()` 폴링
- **교훈**: `window.opener`를 100% 신뢰하지 말 것. 특히 모바일에서 OAuth 팝업은 새 탭으로 열려 `opener` 참조가 끊길 수 있음

### 12.3 가입 중 사용자 가이드 투어 발동
- **증상**: 가입 마지막 단계에서 앱 화면이 아직 안 보이는데 투어 애니메이션이 실행됨
- **원인**: `renderAll()` → `checkOnboarding()` 호출 → `currentUser` 있고 `totalDone===0` → `startTour()` 실행. 가입 완료 직전에 `currentUser`가 설정되면서 조건 충족
- **수정**: `checkOnboarding()`에 가드 조건 추가:
  ```javascript
  if (document.body.classList.contains('auth-active')) return;
  const anyAuthVisible = document.querySelector('.auth-screen:not(.hidden)');
  if (anyAuthVisible) return;
  ```
- **교훈**: 투어/가이드는 인증 화면이 완전히 닫힌 후에만 시작해야 함

### 12.4 양육자/자녀 역할 선택 화면 제거
- **증상**: 자녀로 가입 시 가족 추가 후 다음 버튼 비활성화
- **결정**: 자녀는 관리자 권한이 없으므로 아이로 가입하는 것 자체를 차단. 역할 선택 화면(c1-slide-role-type) 완전 제거
- **수정**: `_createState.myRoleType`을 항상 `'caregiver'`로 고정

### 12.5 색 단차 (auth 화면 초기 로드 시 색상 불일치)
- **증상**: 앱 첫 로드 시 auth-continue 화면 상단에 색 차이가 보임. 로그인→로그아웃 후에는 안 보임
- **원인**: HTML에서 `auth-welcome`(ob-gradient, 4색 160도 그라데이션, #3B2F8C 시작)이 기본 visible → JS 로드 후 `auth-continue`(2색 135도, #5B4FC4 시작)로 전환. 이 전환 중 깜빡임 발생
- **수정**: `<head>` 인라인 스크립트에서 `localStorage`의 `onboarding_done` 체크 후 CSS 즉시 주입:
  ```javascript
  s.textContent='#auth-welcome,#auth-onboarding{display:none!important}#auth-continue{display:flex!important;pointer-events:auto!important}';
  ```
- **교훈**: 인증 화면 전환은 JS 로드 전에 CSS로 처리해야 깜빡임 없음

### 12.6 ⚠️ auth-continue 터치 통과 버그 (홈 화면 조작 가능)
- **증상**: auth-continue 화면 하단 배경(그라데이션) 영역을 터치하면 뒤에 숨겨진 홈 탭의 활동들이 눌림 (마일리지 올라가는 애니메이션 발생)
- **원인**: early CSS injection이 `#auth-continue{display:flex!important}`로 화면을 보이게 만들었지만, HTML에 `.hidden` 클래스가 남아있어 `.auth-screen.hidden{pointer-events:none}`이 여전히 적용됨. 결과적으로 auth 화면이 보이지만 터치가 전부 통과
- **수정**:
  1. CSS에 `pointer-events:auto!important` 추가
  2. `DOMContentLoaded`에서 `.hidden` 클래스 제거 + `body.auth-active` 설정
  ```javascript
  s.textContent='...#auth-continue{display:flex!important;pointer-events:auto!important}';
  document.addEventListener('DOMContentLoaded',function(){
    var ac=document.getElementById('auth-continue');
    if(ac){ac.classList.remove('hidden');}
    document.body.classList.add('auth-active');
  });
  ```
- **교훈**: CSS에서 `display` 속성만 override하면 같은 선택자의 다른 속성(`pointer-events`)은 그대로 남는다. early CSS injection 시 해당 클래스의 **모든 부작용**을 고려해야 함. 특히 `.hidden` 클래스에 여러 속성이 있을 때 `display`만 덮어쓰면 위험

### 12.7 ID/PW 로그인 폼 접기
- **변경**: auth-continue 화면에서 ID/PW 입력 폼을 기본으로 접고, "아이디/비밀번호로 로그인 ▾" 링크 클릭 시 펼침
- **함수**: `toggleIdPwLogin()` — `continue-idpw-section` display 토글
- **이유**: 소셜 로그인이 주력이므로 화면 간소화

### 12.8 모바일 카카오/네이버 로그인: parent 탭 리로드 시 결과 유실 (2026-03-31)
- **증상**: 모바일(특히 iOS)에서 카카오/네이버 로그인 팝업이 열리고, 인증은 성공하는데 결과가 parent 탭에 전달되지 않음. parent 탭으로 돌아오면 로그인 화면이 그대로 보임
- **원인**: 모바일에서 OAuth 팝업(새 탭)으로 전환 시 parent 탭이 메모리에서 해제되거나 bfcache에서 복원됨.
  - Google은 `social_pending` localStorage 플래그를 설정하여 `onAuthStateChanged`가 처리 → 문제 없음
  - 카카오/네이버는 Firebase Auth를 사용하지 않으므로 `onAuthStateChanged`가 안 됨 → `social_pending` 플래그도 없었음 → parent 탭 리로드 시 결과 수신 방법 없음
  - 콜백 탭이 `localStorage.setItem('taemin_v6_kakao_callback_result', ...)` 저장하지만, parent의 `setInterval` 폴링이 페이지 리로드로 사라져서 아무도 읽지 않음
- **수정**:
  1. `doSocialLogin()`에서 카카오/네이버 팝업 열기 **전**에 `localStorage.setItem(_LS_PREFIX+'social_pending', 'kakao'/'naver')` 설정
  2. `checkAuth()`에서 `social_pending`이 'kakao' 또는 'naver'일 때 최대 10초간 500ms 간격으로 localStorage 콜백 결과 폴링
  3. 결과 발견 시 `_handleSocialLoginResult()` 직접 호출하여 로그인 처리
  4. 취소/에러 시 `social_pending` 플래그 정리
- **핵심 원리**: 콜백 탭과 parent 탭 사이의 유일한 통신 수단은 `localStorage` (postMessage는 모바일에서 불가). parent 탭이 리로드되더라도 `social_pending` 플래그가 있으면 localStorage 폴링으로 복구 가능
- **교훈**: OAuth 팝업 기반 로그인에서 parent↔popup 간 통신은 반드시 `localStorage` 기반으로 해야 하고, parent 탭 리로드 시에도 결과를 수신할 수 있어야 함. `window.opener`, `postMessage`는 모바일에서 불안정

### 12.9 카카오/네이버 콜백 감지: `window.name` 활용 (2026-03-31)
- **증상**: 모바일에서 `window.opener`가 null → 콜백 탭이 자기가 콜백인지 감지 못함
- **원인**: `window.open(url, 'kakaoLogin', ...)` → 새 탭 열림 → OAuth 사이트를 거쳐 redirect → `window.opener`는 cross-origin에서 null
- **수정**: `window.name`은 cross-origin redirect를 거쳐도 보존됨. 콜백 감지 조건을 변경:
  ```javascript
  // before: window.opener && ...
  // after: (window.opener || window.name === 'kakaoLogin') && ...
  ```
- **교훈**: `window.name`은 같은 창/탭 내에서 navigtion을 거쳐도 유지되는 몇 안 되는 속성. 모바일 OAuth에서 콜백 탭 식별에 유용

### 12.10 iOS PWA 하단 검정 영역 (62px 단차) — 🔴 최종 해결 (v0331y, 2026-03-31)
- **증상**: iPhone PWA 콜드스타트 시 로그인 화면 하단에 ~62px 검정 영역 발생.
  로그인→로그아웃 하면 검정 영역이 **사라지고** 컨텐츠가 아래로 내려감 (viewport 812px→874px 확장).
  62px = safe-area-inset-top(28px) + safe-area-inset-bottom(34px)
- **근본 원인**: `<body class="auth-active">`의 `overflow:hidden`이 iOS PWA 콜드스타트 시 `viewport-fit=cover`의 safe area 확장을 차단.
  body에 `overflow:hidden`이 있으면 iOS WebKit이 스크롤 가능한 콘텐츠가 없다고 판단하여 viewport를 safe area 밖으로 확장하지 않음.
  로그인 후 `auth-active`가 제거되면 `overflow:hidden`이 풀리고 iOS가 viewport를 전체 화면으로 확장.
  이후 로그아웃으로 `auth-active`가 다시 붙어도 viewport는 이미 확장된 상태 유지.
- **실패한 시도들 (v0331o ~ v0331x, 10+ 버전)**:
  1. html 배경색 gradient 하단색으로 변경 → 검정이 색만 바뀜, 영역 미해결
  2. html 배경을 동일 gradient로 변경 → CSS가 viewport 밖을 그리지 못함
  3. html 인라인 style background → 동일하게 실패
  4. viewport meta 태그 제거/재삽입 (JS) → 효과 없음
  5. `location.reload()` 강제 리로드 → 효과 없음 (reload ≠ OAuth navigation)
  6. 색으로 채우는 모든 접근 → "영역 자체를 없앨 생각을 해야 한다" (사용자 피드백)
- **올바른 해결 (v0331y, PR #12)**:
  ```html
  <!-- 1. body에서 auth-active 제거 -->
  <body data-tab="home">
  ```
  ```javascript
  // 2. 2프레임 후 auth-active 추가 — iOS가 먼저 full viewport 계산하도록
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      document.body.classList.add('auth-active');
    });
  });
  ```
  ```css
  /* 3. html에 safe-area 포함 min-height (iOS PWA 모범 사례) */
  html{min-height:calc(100% + env(safe-area-inset-top));padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
  ```
- **왜 이것이 작동하는가**: body가 `overflow:hidden` 없이 먼저 렌더링되면, iOS가 스크롤 가능한 문서로 인식하고 viewport를 safe area 포함 전체 화면(874px)으로 확장함. 2프레임 후 `auth-active`(overflow:hidden)를 추가해도 viewport는 이미 확장된 상태 유지.
- **🔴 절대 변경 금지**: 위 3가지 코드 중 하나라도 변경하면 iPhone에서 62px 검정 영역이 재발한다. CLAUDE.md의 "절대 변경 금지 코드" 섹션 참조.
- **교훈**: iOS PWA에서 `overflow:hidden`은 viewport 확장을 막는다. `viewport-fit=cover` 관련 문제는 CSS 색상 변경이 아니라 **viewport 자체의 크기 문제**로 접근해야 한다.

### 12.11 소셜→기존계정 연동 화면 (socialLinkExisting) UI (2026-03-31)
- **증상**: 소셜 로그인 후 "기존 계정에 연결"을 누르면 auth-continue 화면이 뜨는데, 소셜 버튼이 보이고 ID/PW 입력란은 접혀 있고, "기존 아이디로 로그인하면 연동된다"는 안내 메시지가 접힌 영역 안에 숨겨져 있음
- **수정**: `socialLinkExisting()` 함수에서:
  1. `.social-login-btns` 숨김 (`display:none`)
  2. `#toggle-idpw-link` 숨김
  3. `#continue-idpw-section` 펼침 (`display:block`)
  4. 제목을 "기존 계정에 연결하기"로, 부제를 "기존 아이디와 비밀번호를 입력하세요"로 변경
  5. 연동 안내 메시지를 primary 색상으로 표시
  6. `showAuthScreen('continue')` 진입 시 `_socialLinkPendingUser`가 없으면 UI 자동 원복
- **교훈**: 하나의 auth 화면을 여러 컨텍스트에서 재사용할 때, 각 컨텍스트에 맞게 UI 요소의 가시성을 제어하고, 다른 컨텍스트로 전환 시 반드시 원복해야 함

### 12.12 bfcache와 소셜 로그인 충돌 방지 (2026-03-31)
- **증상**: 모바일에서 소셜 로그인 팝업 후 parent 탭으로 돌아오면 `pageshow`에서 `location.reload()` 실행 → 소셜 로그인 상태 유실
- **수정**: `pageshow` 이벤트 핸들러에서 `_socialLoginPending` (in-memory) 또는 `social_pending` (localStorage) 확인 후 reload 건너뜀
  ```javascript
  window.addEventListener('pageshow',(e)=>{
    if(e.persisted){
      if(_socialLoginPending || localStorage.getItem(_lsp)){ return; } // ← 새로고침 안 함
      location.reload();
    }
  });
  ```
- **교훈**: bfcache 새로고침 로직이 있으면, 소셜 로그인 같은 외부 탭 전환 플로우에서 예외 처리 필수

### 12.13 개발기 가족데이터 손상 복구 (2026-03-31)
- **증상**: nonmarking, beh125 등 기존 계정으로 개발기 로그인 시 "가족 데이터가 손상되었어요" 에러
- **원인**: `families/taemin_dev` 문서의 `familyMeta`가 `null`, `users`가 빈 맵 `{}`
  - 코드에서 `if(!familyData.familyMeta)` 체크에 걸림 (라인 ~6463)
  - 글로벌 레지스트리 `_dev_id_registry`에는 nonmarking→taemin_dev, beh125→taemin_dev 정상 매핑 존재
  - 가족 문서 자체는 존재하나 핵심 필드(familyMeta, users)가 비어있음
- **진단 방법**: Firestore REST API로 직접 확인
  ```bash
  # 레지스트리 확인
  curl -s "https://firestore.googleapis.com/v1/projects/taemin-mileage/databases/(default)/documents/families/_dev_id_registry?key=AIzaSyDTS81EBGgiuo564ThxvTTOpR_iAHLb8tg"
  # 가족 문서 확인
  curl -s "https://firestore.googleapis.com/v1/projects/taemin-mileage/databases/(default)/documents/families/taemin_dev?key=AIzaSyDTS81EBGgiuo564ThxvTTOpR_iAHLb8tg"
  ```
- **복구**: 운영기(`users/taemin`) 데이터에서 `familyMeta`와 `users` 필드를 추출하여 개발기 양쪽 문서에 PATCH
  ```bash
  # 운영기 데이터 추출 후 개발기에 복원
  curl -X PATCH "...families/taemin_dev?key=...&updateMask.fieldPaths=familyMeta&updateMask.fieldPaths=users" -d @patch_data.json
  curl -X PATCH "...users/taemin_dev?key=...&updateMask.fieldPaths=familyMeta&updateMask.fieldPaths=users" -d @patch_data.json
  ```
- **복원 결과**: familyMeta.members에 dad(효신/nonmarking), mom(으네/beh125), taemin(태민/abo.taemin) 정상 복원
- **교훈**:
  1. 개발기 Firestore 데이터도 정기적으로 백업해야 함
  2. `familyMeta: null`은 `defaultState()`가 Firestore에 저장된 흔적 — 사고 2와 동일 패턴
  3. 복구 시 `families/{id}`와 `users/{id}` 양쪽 모두 업데이트 필요

### 12.14 소셜 계정 연동 해제 기능 (2026-03-31)
- **기능**: 나의 메뉴에서 연동된 소셜 계정을 해제할 수 있는 버튼 추가
- **핵심 로직** (`unlinkSocial()` 함수, `linkSocialFromMyMenu()` 바로 뒤에 위치):
  - `acc.id && acc.pwdHash` 확인 → ID/PW 계정이 있는 경우에만 해제 허용
  - 소셜 전용 가입자(id/pwdHash 없음)는 해제 불가 — 로그인 수단이 사라지므로
  - 삭제 대상 필드: `authProvider`, `authUid`, `email` (두 곳 모두)
    - `S.familyMeta.members[currentUser].account`
    - `S.users[currentUser]`
  - `save()` 후 `renderMyMenu()` 호출로 UI 즉시 반영
- **UI**: 연동된 소셜이 있고 ID/PW 계정도 있으면 → 체크마크 대신 "해제" 버튼 표시
  - 소셜만 있으면 → 기존 체크마크 아이콘 유지 (해제 불가)
- **관련 코드 위치**:
  - `unlinkSocial()` — `linkSocialFromMyMenu()` 뒤 (라인 ~6290)
  - 나의 메뉴 소셜 표시 — `renderMyTab()` 내부 (라인 ~14037)

### 12.15 로그인 첫 화면 구성 (2026-03-31)
- **현재**: `auth-welcome` (시작페이지)이 기본 표시 화면 (hidden 없음)
- **이전**: `auth-continue` (소셜+ID/PW 통합)가 기본이었으나 시작페이지로 복원
- **흐름**:
  - 시작페이지 → "시작하기" → `auth-onboarding` (슬라이드 3장) → `auth-continue`
  - 시작페이지 → "이미 계정이 있어요" → `auth-continue` (skipOnboarding)
- **HTML 구조**: `auth-welcome`에는 `ob-gradient` 클래스 → 인디고 그라데이션 배경
- **⚠️ 주의**: `auth-welcome`이 기본 화면이므로 `<html style="background:#5B4FC4">`와 조합해도 iOS PWA 단차 없음 (ob-gradient가 position:fixed로 전체 화면 덮음)

### 12.16 소셜 연동 해제 시 auth 레지스트리 삭제 누락 (2026-04-01)
- **증상**: 소셜 연동 해제 후 같은 소셜 계정으로 다시 로그인하면, 선택 화면(신규 가입/기존 계정 연동) 없이 자동으로 이전 계정에 연결됨
- **원인**: `unlinkSocial()`이 `familyMeta.members`와 `S.users`에서만 필드를 삭제하고, auth 레지스트리(`_dev_auth_registry` / `_auth_registry`)의 uid→family 매핑을 삭제하지 않음
  - `_handleSocialLoginResult()`는 레지스트리를 먼저 확인하므로 매핑이 남아있으면 자동 로그인
- **수정**: `unlinkSocial()`에 `_getAuthRegistryDoc()` + `runTransaction`으로 레지스트리에서 해당 uid 삭제 추가
- **데이터 정리**: `_dev_auth_registry` 전체 초기화, `families/taemin_dev`의 dad 소셜 필드 수동 삭제
- **교훈**: 소셜 연동 데이터는 3곳에 저장된다 — ① familyMeta.members[id].account ② S.users[id] ③ auth 레지스트리. 삭제 시 3곳 모두 처리해야 함

---

## 변경 이력 (Change Log)

### 2026-04-01 세션 — 소셜 로그인/연동 최적화 + 관리자 메뉴 재구성

**적용 범위: 개발기 (main/dev/index.html)**

#### 커밋 목록 (PR #15~#20)
| PR | 설명 | 상태 |
|----|------|------|
| #15 | fix: 첫 화면 시작하기(welcome) 표시 복원 | ✅ merged |
| #16 | fix: 로그인 후 상단 색상 간격 (safe-area CSS 범위 제한) | ✅ merged |
| #17 | fix: 소셜 연동 해제 후 재연동 시 선택화면 표시 (auth registry 삭제) | ✅ merged |
| #18 | fix: 구글 소셜 로그인 속도 개선 (Promise.all 병렬 처리) | ✅ merged |
| #19 | fix: 소셜 연동 로그인 즉시 반영 (10초 지연 해결) | ✅ merged |
| #20 | feat: 관리자 메뉴 재구성 + 구글 프로필 사진 + getUserName 수정 | ✅ merged |

#### 상세 변경 내용

**PR #15: 시작하기 화면 복원**
- 문제: `checkAuth()`와 `logout()`이 항상 `showAuthScreen('continue')`를 호출하여 welcome 화면이 표시되지 않음
- 수정: `localStorage.getItem('onboarding_done')` 체크하여 첫 방문 시 welcome, 재방문 시 continue 표시

**PR #16: 로그인 후 상단 색상 간격**
- 문제: `html{min-height;padding:safe-area}` CSS가 전역 적용되어 로그인 후에도 상단 패딩 잔존
- 수정: `html:has(body.auth-active)` 셀렉터로 범위 제한하여 인증 화면에서만 적용

**PR #17: 소셜 연동 해제 후 재연동 버그**
- 문제: `unlinkSocial()`이 auth registry(`_dev_auth_registry`)에서 매핑을 삭제하지 않음 → 재연동 시 `_handleSocialLoginResult()`가 registry에서 기존 매핑 발견 → 선택 없이 자동 로그인
- 수정: `unlinkSocial()`에서 `runTransaction`으로 auth registry 삭제 추가. 소셜 데이터 3곳(familyMeta, S.users, auth registry) 모두 일관 삭제

**PR #18: 소셜 로그인 속도 개선**
- 문제: `_handleSocialLoginResult()`에서 Firestore 3회 순차 읽기 (registry → family doc → 중복 family doc)
- 수정: `Promise.all`로 registry + family doc 병렬 읽기, 결과 캐싱(`_regData`, `_cachedFamilyData`), Firebase SDK preload를 welcome 화면에서도 시작

**PR #19: 소셜 연동 즉시 반영 (DEV v0401c)**
- 문제: `_linkSocialAfterLogin()`이 fire-and-forget으로 별도 `save()` 실행, `doLogin()`의 `save()`와 경쟁 → 나의 메뉴에서 10초 뒤에야 연동 표시
- 수정: `_applySocialLinkToMemory(memberId)`를 `doLogin()` 3개 분기에서 `save()` 전에 호출하여 소셜 데이터가 로그인 save()에 포함되도록 변경. auth registry 쓰기는 non-blocking background 처리

**PR #20: 관리자 메뉴 재구성 + 구글 프로필 사진 + getUserName 수정 (DEV v0401d)**

*관리자 메뉴 탭 순서 변경:*
- 기존: 활동(0) → 보상(1) → 뱃지(2) → 설정(3) → 가족(4)
- 변경: 활동(0) → 보상(1) → 뱃지(2) → 가족(3) → 설정(4)
- adm-p3/adm-p4 패널 ID 교체, admTab() 함수 업데이트

*설정 탭 항목 재배치:*
- **활동 탭으로 이동**: 7일 연속 달성 보너스 토글 + 보너스 마일리지 입력
- **가족 탭으로 이동**: 생일 이벤트 설정 (토글+마일리지+축하메시지), 가족 프로필 사진 관리
- **설정 탭에서 제거**: 표시 설정(다크모드), 알림 설정(푸시알림), 계정(로그아웃) — 모두 나의 메뉴에 중복
- **고급설정 accordion 제거**: 스마트 메시지, 인사말, 알림테스트, 백업/복원, PIN, 데이터관리, 캐시, 앱정보를 설정 탭에서 직접 표시

*구글 프로필 사진 연동:*
- `_applySocialLinkToMemory()`: `su.profileImage`가 있으면 `S.photos[memberId]`에 저장
- `_loginToFamily()`: 6번째 파라미터 `profileImage` 추가, Firestore 저장 시 포함
- `_handleSocialLoginResult()`의 3개 `_loginToFamily()` 호출에 `profileImage` 전달

*버그 수정:*
- `_loginToFamily()` line ~7381: `getUserName(memberId)` → `MEMBERS[memberId]?.name` (함수 미정의 에러)
- 증상: 소셜 로그인 후 `[E2-loginFamily] Can't find variable: getUserName` 토스트 표시
- 원인: `getUserName`이라는 함수가 어디에도 정의되지 않음

### 2026-03-30 세션 — 소셜 로그인 버그 수정 + 알림 뱃지 수정

**적용 범위: 개발기 (main/dev/index.html)**
운영기 미적용 — 운영기 반영 시 `scripts/sync-dev-to-main.sh` 사용 필요

#### 커밋 목록
| 커밋 | 설명 | 상태 |
|------|------|------|
| `225a6c1` | fix: _ENV TDZ 에러 수정 — 모듈 스크립트 실행 불가 버그 해결 | ✅ 개발기 적용 |
| `34da991` | fix: 로그인 화면 좌우 색단차 수정 | ✅ 개발기 적용 |
| `f1af6cd` | fix: 카카오 팝업 차단 방지 + 네이버 콜백 에러 처리 강화 | ✅ 개발기 적용 |
| `c4f08ed` | fix: 소셜연동 바텀시트 닫힘 + 카카오 팝업 차단 수정 | ✅ 개발기 적용 |
| `cb9d705` | fix: 보상요청 알림이 자기 자신에게도 발송되는 버그 수정 | ✅ 개발기 적용 |
| `b4dc3aa` | feat: 로그인 화면 Vertical Stack 통합 — 소셜 + ID/PW 한 화면에 | ✅ 개발기 적용 |
| `a1daf0d` | feat: 첫 화면을 통합 로그인 화면(auth-continue)으로 변경 | ✅ 개발기 적용 |
| `787ae46` | fix: 네이버 로그인 팝업에서 로그인 화면 깜빡임 방지 | ✅ 개발기 적용 |
| `0e27bae` | feat: 온보딩 슬라이드 + 첫 화면/로그아웃 플로우 개선 | ✅ 개발기 적용 |
| `d46dd82` | fix: 이메일 인증/뒤로가기 시 auth-login→auth-continue + 개발환경 인증코드 표시 | ✅ 개발기 적용 |

#### 상세 변경 내용

**1. TDZ(Temporal Dead Zone) 에러 수정 (`225a6c1`)**
- 문제: `const _NAVER_CALLBACK_URL`(line ~6509)이 `_ENV`(line ~7351)를 참조 → ES Module에서 TDZ 에러 발생 → 전체 JS 실행 불가
- 수정: `const _NAVER_CALLBACK_URL = ...` → `function _getNaverCallbackUrl()` (lazy evaluation)
- 영향: 매우 심각 — 이 에러로 앱 전체 기능 마비되었음

**2. 로그인 화면 색단차 수정 (`34da991`)**
- 문제: `body` max-width 430px + gradient, `html` 배경 solid #5B4FC4 → 좌우에 보라색 띠
- 수정: `body.auth-active`에 `max-width:none`, `html:has(body.auth-active)`에 동일 gradient 적용

**3. 카카오 팝업 차단 방지 + 네이버 콜백 강화 (`f1af6cd`)**
- 카카오: `showAuthScreen` 진입 시 SDK 미리 로드 (async gap 최소화로 팝업 차단 방지)
- 네이버: callback handler에 10초 timeout, SDK 로드 실패 시 access_token 기반 fallback UID

**4. 바텀시트 닫힘 + 카카오 팝업 구조 수정 (`c4f08ed`)**
- 바텀시트: `[style*="z-index:9999"]` CSS 셀렉터 → `getElementById('social-link-sheet')` 변경
  (브라우저가 inline style 정규화하면서 셀렉터 매칭 실패)
- 카카오/네이버: `_doLinkSocial`에서 팝업을 먼저 열고 바텀시트를 나중에 닫도록 재구성
  (async gap으로 user gesture chain 끊겨서 팝업 차단되던 문제)
- catch 블록에서도 `_closeSocialLinkSheet()` 호출 (에러 시에도 시트 닫힘 보장)

**5. 보상요청 알림 자기→자기 버그 수정 (`cb9d705`)**
- 문제: 양육자(admin)가 아이 대신 보상 요청 시 자기 자신에게도 알림 발송 → 읽을 수 없는 unread 메시지 잔존
- 수정: `adminMembers` 생성 시 `mid !== currentUser` 조건 추가 (요청자 본인 항상 제외)
- 안전장치: `_updateFamilyBtnBadge`에서 `from===to`인 메시지 자동 읽음 처리

**6. 로그인 화면 Vertical Stack 통합 (`b4dc3aa`)**
- 변경: auth-continue 화면에 소셜 버튼 + ID/PW 폼을 한 화면에 통합 (Vertical Stack 패턴)
- 구조: 소셜 3종(Google/Kakao/Naver) → "또는 아이디로 로그인" 구분선 → ID/PW 폼 → "또는" → 이메일 인증
- `doContinueLogin()` 함수 추가 — 기존 `doLogin()`을 필드ID 인자화하여 재사용
- 참고: Airbnb/Spotify/배달의민족 등 글로벌·한국 앱 UX 리서치 기반

**7. 첫 화면을 통합 로그인 화면으로 변경 (`a1daf0d`)**
- 웰컴 화면(auth-welcome) 거치지 않고 바로 auth-continue(통합 로그인) 표시
- auth-continue를 기본 visible, auth-login을 hidden으로 HTML 변경
- `checkAuth()`에서 모든 경우 `showAuthScreen('continue')`로 통일

**8. 네이버 로그인 팝업 깜빡임 방지 (`787ae46`)**
- 네이버 OAuth 콜백 시 팝업 안에서 앱 페이지가 리로드 → auth 화면이 잠깐 보이는 문제
- 초기 스크립트에서 `window.opener` + `access_token` 해시 감지 시 모든 auth 화면 숨기고 "처리 중" 표시
- 모듈 로드 전에 실행되므로 UI 깜빡임 완전 차단

**9. 온보딩 슬라이드 + 첫 화면/로그아웃 플로우 개선 (`0e27bae`)**
- 첫 방문자: 웰컴 화면(auth-welcome) → 온보딩 슬라이드 3장 → 통합 로그인(auth-continue)
  - 슬라이드 1: ⭐ 활동하면 마일리지 적립
  - 슬라이드 2: 🎁 마일리지로 보상 교환
  - 슬라이드 3: 👨‍👩‍👧 가족이 함께 참여해요
- 재방문자: `localStorage`에 `onboarding_done` 플래그 → 웰컴/온보딩 건너뛰고 바로 통합 로그인
- 로그아웃: `showAuthScreen('continue')` — 재방문자이므로 온보딩 다시 보여줄 필요 없음
- 온보딩 UI: CSS `scroll-snap-type: x mandatory` 스와이프, 점 인디케이터(활성=24px 흰색바), "다음"/"시작하기" 버튼, "건너뛰기" 링크
- 초기 스크립트(비모듈)에서 `obNext()`, `skipOnboarding()` 함수 등록 — 모듈 로드 전에도 동작
- `checkAuth()`에서 `onboarding_done` 유무로 분기: 없으면 `showAuthScreen('welcome')`, 있으면 `showAuthScreen('continue')`
- 웰컴 화면 "시작하기" → `showAuthScreen('onboarding')`, "이미 계정이 있어요" → `skipOnboarding()`

**10. 이메일 인증 뒤로가기 + 개발환경 인증코드 표시 (`d46dd82`)**
- 문제1: `showAuthScreen('login')`이 5곳에 남아있어 뒤로가기/에러 시 사용하지 않는 `auth-login` 화면으로 이동
- 수정: 5곳 모두 `showAuthScreen('continue')`로 변경 (이메일 인증 돌아가기, 초대링크 에러, 소셜연결→기존계정 등)
- 문제2: 이메일 인증코드가 실제 이메일 발송 없이 콘솔에만 표시 → 사용자가 코드를 알 수 없음
- 수정: 개발환경(`_ENV==='dev'`)에서는 인증코드를 화면과 토스트에 직접 표시
- `socialLinkExisting()`의 에러 메시지 필드도 `login-error` → `continue-login-error`로 변경

**11. 로그인 화면 아이콘 교체 (`c98f694`)**
- auth-continue 상단 아이콘을 단순 SVG → mile.ly 로고 텍스트 포함 앱 아이콘으로 교체
- 72px 둥근 아이콘 + SVG 텍스트 로고 (mile=검정, .=노랑, ly=보라)
- 웰컴 화면과 동일한 브랜드 스타일

**12. 카카오 로그인 REST API+팝업 방식 재구현 + 네이버 안정성 개선 (`e851839`)**
- 원인: Kakao JS SDK v2.7.4에서 `Kakao.Auth.login()` 제거됨 → 기존 코드 동작 불가
- 수정: REST API Implicit Grant + popup + postMessage 방식으로 전면 재구현
  - `_KAKAO_REST_KEY` 추가, `_getKakaoCallbackUrl()` 함수 추가
  - `_doKakaoLogin()`: Kakao OAuth authorize URL을 팝업으로 열고 postMessage 수신
  - 카카오 콜백 핸들러: access_token으로 `/v2/user/me` API 호출 후 결과를 opener에 전달
- 카카오/네이버 콜백 구분: state 파라미터에 `kakao_` 접두사 사용 (동일 URL에서 두 provider 구분)
- Kakao Developer Portal: Redirect URI 등록 완료 (dev + prod), REST API 키 섹션에도 등록
- 네이버 로그인 안정성: 팝업 닫힘 감지 시 postMessage 전달을 위한 800ms 유예 기간 추가
- 소셜 콜백 팝업 깜빡임 방지: state 기반으로 카카오/네이버 정확히 구분
- ⚠️ 네이버 앱 이름: "mile.ly"가 아닌 **"마일리"**로 등록됨 (네이버 개발자센터에서 '.' 문자 사용 불가)

**13. 카카오 로그인 Authorization Code flow 전환**
- 원인: 카카오는 `response_type=token` (Implicit Grant)을 지원하지 않음 → KOE006 에러 발생
- 수정: Authorization Code flow (`response_type=code`)로 전면 전환
  - `_doKakaoLogin()`: authUrl의 `response_type=token` → `response_type=code`
  - 카카오 콜백 핸들러: `#access_token` 해시 → `?code=xxx` 쿼리스트링 방식으로 변경
  - 토큰 교환 추가: 콜백에서 `kauth.kakao.com/oauth/token`에 POST로 code → access_token 교환
  - 클라이언트 시크릿 사용: 카카오 앱 설정에서 "ON" 상태, `client_secret` 파라미터 포함
  - 에러 처리: 토큰 교환 실패 시 `_error` 필드를 postMessage로 전달, 메인 창에서 토스트 표시
- 초기 스크립트 업데이트: 카카오 콜백을 `?code=xxx&state=kakao_*` 쿼리스트링으로 감지 (네이버는 기존 `#access_token` 해시 유지)
- 흐름: 사용자 → 카카오 인증 → `?code=xxx` 리다이렉트 → 팝업에서 토큰 교환 → `/v2/user/me` API → postMessage → 메인 창 로그인 처리

#### 미완료 / 추가 확인 필요
- 카카오 로그인: Kakao Developer Portal에서 앱 상태가 "개발 중"이면 등록된 테스트 계정만 사용 가능. 실 사용자가 카카오 로그인 실패 시 포탈 설정 확인 필요
- 소셜 로그인 전체 E2E 테스트: Google ✅, 네이버 ✅, 카카오 ⚠️ (Authorization Code flow 전환됨, 실기기 테스트 필요)
- 운영기 배포: 위 수정사항은 개발기에만 적용됨. 운영기 반영 시 release 브랜치 → PR → merge 절차 사용

### 2026-03-31 세션 (2차) — 소셜 연동 해제 + 시작페이지 복원

**적용 범위: 개발기 (main/dev/index.html)**

#### 커밋 목록
| 커밋 | PR | 설명 | 상태 |
|------|-----|------|------|
| `38e4e65` | #13 | feat: 소셜 계정 연동 해제 기능 추가 | ✅ merged |
| `0831ed1` | #14 | feat: 로그인 첫 화면을 시작페이지로 복원 | ✅ merged |
| `dc25cc3` | #15 | fix: 시작페이지가 표시되지 않던 문제 수정 (checkAuth/logout 분기) | ✅ merged |
| `e2281db` | #16 | fix: 로그인 후 상단 색단차 수정 (html safe-area CSS 조건 제한) | ✅ merged |
| `55309fe` | #17 | fix: 소셜 연동 해제 시 auth 레지스트리 삭제 누락 수정 | ✅ merged |

#### 상세 변경 내용

**1. 소셜 계정 연동 해제 기능 (PR #13, DEV v0331z)**
- `unlinkSocial()` 함수 추가 (`linkSocialFromMyMenu()` 바로 뒤)
- 나의 메뉴 소셜 표시 영역에 "해제" 버튼 추가
- **조건**: ID/PW 계정이 있는 사용자만 해제 가능 (`acc.id && acc.pwdHash` 확인)
  - 소셜 전용 가입자는 해제 불가 (로그인 수단 보호)
  - 소셜 전용 가입자에게는 기존 체크마크 아이콘 유지
- 해제 시 삭제되는 필드: `authProvider`, `authUid`, `email`
  - `S.familyMeta.members[currentUser].account`에서 삭제
  - `S.users[currentUser]`에서 삭제
- confirm 다이얼로그로 사용자 확인 후 처리
- 해제 후 `save()` + `renderMyMenu()` 호출로 UI 즉시 반영
- APP_CHANGELOG v1.4.1 추가

**2. 로그인 첫 화면 시작페이지 복원 (PR #14, DEV v0331z2)**
- `auth-continue` (소셜+ID/PW 통합 로그인)에 `hidden` 추가
- `auth-welcome` (시작페이지 — "아이의 좋은 습관, 가족이 함께 만들어요")에서 `hidden` 제거
- iOS PWA 하단 단차 방지 rAF 로직 유지 (CLAUDE.md 절대 변경 금지 코드)
- 앱 흐름: 시작페이지 → "시작하기" → 온보딩 슬라이드 → 로그인 화면
  - 또는: 시작페이지 → "이미 계정이 있어요" → 로그인 화면

**3. Firestore 소셜 데이터 확인**
- 운영기(`users/taemin`), 개발기(`families/taemin_dev`) 모두 확인
- 모든 멤버(dad, mom, taemin)에 소셜 연동 데이터 없음 (이미 깨끗한 상태)
- REST API 삭제 작업 불필요

### 2026-04-01 세션 (2차) — 카카오/네이버 로그인 속도 개선 + 회원 탈퇴 기능

**적용 범위: 개발기 (main/dev/index.html)**

#### 커밋 목록
| 커밋 | PR | 설명 | 상태 |
|------|-----|------|------|
| `6b62ef9` | #21 | perf: 카카오/네이버 로그인 속도 개선 — Firebase 병렬 초기화 | ✅ merged |
| `437cfa3` | #22 | feat: 회원 탈퇴 기능 추가 | ✅ merged |

#### 상세 변경 내용

**1. 카카오/네이버 로그인 속도 개선 (PR #21, DEV v0401e)**
- 카카오/네이버 팝업이 열려있는 동안 Firebase SDK를 백그라운드에서 병렬 로드
- 기존: 팝업 완료 → Firebase SDK 로드 시작 → 초기화 대기 → 로그인 처리 (직렬)
- 수정: 팝업 open과 동시에 `_ensureFirebase()` 호출 → 팝업 닫힌 후 Firebase 이미 준비됨 (병렬)
- 팝업 닫힌 후 Firebase 초기화 대기 시간이 사실상 0으로 감소

**2. 회원 탈퇴 기능 (PR #22, DEV v0401f)**

**UI:**
- 나의 메뉴 > 로그아웃 버튼 아래에 "회원 탈퇴" 버튼 추가 (회색, 13px)
- SVG 아이콘: 사람 + X 표시 (user-x 스타일)

**비즈니스 로직 — `withdrawAccount()` 함수:**
3가지 시나리오를 분기 처리:

| 시나리오 | 조건 | 동작 |
|---------|------|------|
| Case 1: 유일한 관리자 + 다른 양육자 있음 | `isAdmin && otherAdmins===0 && otherCaregivers>0` | 다른 양육자 목록 표시 → 관리자 권한 양도 대상 선택 → 양도 후 본인만 탈퇴 |
| Case 2: 유일한 양육자 | `isCaregiver && otherCaregivers===0` | 자녀 계정도 함께 삭제된다고 안내 → 확인 시 본인 + 모든 자녀 삭제 |
| Case 3: 자녀 또는 일반 양육자 | 그 외 | 본인만 탈퇴 |

**삭제 실행 — `_executeWithdrawal(initiator, memberIdsToDelete)` 함수:**
삭제 대상 데이터:
1. **Auth Registry** (`_dev_auth_registry` / `_auth_registry`): 삭제 대상 멤버의 UID 매핑 제거
2. **S.familyMeta.members**: 멤버 객체 삭제
3. **S.users**: 사용자 계정 정보 삭제
4. **S.memberData**: 멤버별 활동 데이터 삭제
5. **S.photos**: 멤버별 프로필 사진 삭제
6. **S.familyMessages**: 삭제 대상이 from 또는 to인 메시지 필터링
7. **S.rewardRequests**: 삭제 대상이 user 또는 fromUser인 요청 필터링
8. **Firestore 저장**: `save()` 호출로 변경사항 영구 반영
9. **localStorage 정리**: `taemin_v6_lastUser` 삭제
10. **Firebase Auth**: `signOut()` 호출
11. **앱 상태 초기화**: 로그인 화면으로 전환

**보존되는 데이터:**
- `S.familyMeta` 자체 (가족 이름, 생성일 등)
- 다른 멤버의 모든 데이터
- `S.log` (전체 활동 로그)
- `S.rewards`, `S.badges` (공유 보상/뱃지 시스템)

**안전장치:**
- confirm 다이얼로그로 사용자 최종 확인
- Case 1에서 관리자 양도 후 탈퇴 (관리자 부재 방지)
- Case 2에서 자녀 삭제 경고 명시

**APP_CHANGELOG:** v1.6.0 — 회원 탈퇴 기능 추가

### 2026-04-01 세션 (3차) — 소셜 계정 교체 시 auth registry 잔존 버그 수정

**적용 범위: 개발기 (main/dev/index.html)**

#### 커밋 목록
| 커밋 | PR | 설명 | 상태 |
|------|-----|------|------|
| `2401515` | #23 | fix: 소셜 계정 교체 시 이전 auth registry 잔존 버그 수정 | ✅ merged |

#### 문제 시나리오
1. 카카오 연동 (nonmarking@gmail.com) → registry에 `kakao_uid` 등록
2. 구글 로그인 (같은 이메일) → 이메일 매치로 계정 통합 → registry에 `google_uid` 추가, **`kakao_uid`는 잔존**
3. 구글 연동 해제 → `google_uid`만 registry에서 삭제
4. 다시 구글 로그인 → 잔존 `kakao_uid`의 이메일과 매치 → 의도치 않은 계정 통합 반복

#### 수정 내용

**1. 이메일 매치 계정 통합 시 이전 UID 삭제 (DEV v0401g)**
- Step 2 (registry 이메일 매치): `runTransaction`으로 이전 `otherUid` 삭제 + 새 `uid` 등록을 원자적으로 수행
- Step 2b (가족문서 fallback 매치): 동일하게 `_uData.authUid` (이전 UID) 삭제 + 새 UID 등록
- fallback: transaction 실패 시 기존 `_registerAuthLink()`로 fallback

**2. unlinkSocial() 전체 registry 정리**
- 기존: `acc.authUid` 하나만 삭제 → 이전 provider의 UID 잔존
- 수정: `memberId + familyId`가 일치하는 **모든** registry 항목을 스캔하여 삭제
- 이로써 소셜 연동 해제 시 해당 멤버의 모든 소셜 흔적이 완전히 정리됨

**APP_CHANGELOG:** v1.6.1 — 소셜 계정 교체 시 이전 연동 정보가 남는 버그 수정

### 2026-04-01 세션 (4차) — 소셜 신규가입 후 홈탭/가이드/프로필사진 미적용

**적용 범위: 개발기 (main/dev/index.html)**

#### 커밋 목록
| 커밋 | PR | 설명 | 상태 |
|------|-----|------|------|
| `90b8cdb` | #24 | fix: 소셜 신규가입 후 홈탭/가이드/프로필사진 미적용 수정 | ✅ merged |

#### 문제
소셜 계정으로 최초 신규가입 시: 홈탭 대신 나의메뉴 표시, 가이드 투어 미실행, 구글 프로필 사진 미저장

#### 원인
`createFamilyFinish()`에서 `_loginToFamily()`와 달리 `postLoginInit()`, `reallyGoTab('home')` 호출 누락.
소셜 프로필 사진을 `S.photos`에 저장하는 로직 없음.

#### 수정
`createFamilyFinish()`에 추가: `postLoginInit()`, `reallyGoTab('home')`, 소셜 프로필 사진 저장 + `save()`

**APP_CHANGELOG:** v1.6.2

### 2026-04-01 세션 (5차) — 회원 탈퇴 UX 개선 + 관리자 설정 이동

**적용 범위: 개발기 (main/dev/index.html)**

#### 커밋 목록
| 커밋 | PR | 설명 | 상태 |
|------|-----|------|------|
| — | #25 | improve: 회원 탈퇴 UX 개선 — 커스텀 모달, 로딩, 이별 인사 | ✅ merged |
| — | #26 | refactor: 회원 탈퇴 버튼을 관리자 설정 탭으로 이동 | ✅ merged |

#### PR #25: 회원 탈퇴 UX 개선 (DEV v0401h)
- `_showWithdrawModal()`: 기존 `confirm()` 대신 커스텀 오버레이 모달 (블러 배경, 카드 디자인, 취소/확인 버튼)
- `_showFarewellScreen()`: 탈퇴 완료 후 5개의 랜덤 이별 메시지 표시 (👋 이모지, 그라디언트 배경)
- 로딩 애니메이션: 탈퇴 처리 중 스피너 표시
- 3가지 케이스 모두 `_showWithdrawModal`을 사용하도록 통합

#### PR #26: 회원 탈퇴 버튼 관리자 설정 이동 (DEV v0401i)
- 나의메뉴(로그아웃 버튼 아래)에서 제거
- 관리자 페이지 설정 탭(`adm-p4`)의 "계정" 섹션 아래에 배치

### 2026-04-01 세션 (6차) — 회원 탈퇴 후 잔존 데이터/가이드 투어 버그 수정

**적용 범위: 개발기 (main/dev/index.html)**

#### 커밋 목록
| 커밋 | PR | 설명 | 상태 |
|------|-----|------|------|
| — | #27 | fix: 회원 탈퇴 후 이전 가족 데이터 잔존 + 가이드 투어 미실행 | ✅ merged |

#### 문제
1. 회원 탈퇴 → 신규 가입 시 이전 가족 데이터(토큰 메시지 등)가 떠오름
2. 신규 가입 후 가이드 투어 애니메이션 미실행

#### 원인
1. `_executeWithdrawal()`에서 Firestore `onSnapshot` 리스너(`_dataListenerUnsub`)를 해제하지 않아, 리스너가 이전 가족 문서 변경을 감지하고 `S`에 다시 덮어씀
2. localStorage `onboarded` 플래그가 탈퇴 시 삭제되지 않아, `checkOnboarding()` → `isOnboarded()` → true → 가이드 투어 스킵

#### 수정
`_executeWithdrawal()`에 추가:
- Firestore 리스너 해제: `_dataListenerUnsub()` 호출 + null 설정
- localStorage 확장 정리: `family_id`, `onboarded`, `tour_done`, `changelog_seen` 삭제
- 상태 초기화: `DATA_DOC = null`

### 2026-04-01 세션 (7차) — 역할 미선택 버그 + 네이버 심사 안내 + 성별 토글

**적용 범위: 개발기 (main/dev/index.html)**

#### 커밋 목록
| 커밋 | PR | 설명 | 상태 |
|------|-----|------|------|
| — | #28 | fix: 회원가입 시 역할 미선택으로 넘어가는 버그 수정 | ✅ merged |
| — | #29 | feat: 네이버 로그인 심사 대기 안내 팝업 | ✅ merged |
| `500df87` | #30 | feat: 자녀 성별 선택 토글 버튼 UI | ✅ merged |

#### PR #28: 역할 선택 검증 (DEV v0401j)
- 기존: `c1SlideRoleFinish()`에서 `_createState.myRole` 미선택 시 기본값 `'caregiver'` 자동 할당
- 수정: 미선택 시 에러 메시지 "아이와의 관계를 선택해주세요" 표시 + return (진행 차단)
- 에러 표시 요소: `<p id="c1-role-error">` (빨간색)

#### PR #29: 네이버 로그인 심사 대기 안내 (DEV v0401l)
- `_showNaverPendingNotice()`: 초록 그라디언트 네이버 아이콘 + spring 팝업 애니메이션
- "개발 심사 중" 제목 + "서비스 검토 후 사용 가능합니다" 안내 문구
- `doSocialLogin('naver')` 진입 시 실제 로그인 대신 안내 팝업 표시
- 소셜 연동 바텀시트의 네이버 버튼도 동일하게 안내 팝업으로 리다이렉트

#### PR #30: 자녀 성별 토글 버튼 (DEV v0401n)
- 기존: `<select>` 드롭다운 (남자/여자/미선택)
- 수정: 두 개의 토글 버튼 (👦 남자 / 👧 여자)
- 남자: 인디고(#6366F1), 여자: 핑크(#EC4899) 색상 구분
- `<input type="hidden" id="node-gender">`로 기존 `saveNodeForm()` 저장 로직 호환 유지

### 2026-04-01 세션 (8차) — 활동 완료 도장 + 말풍선 버그 수정

**적용 범위: 개발기 (main/dev/index.html)**

#### 커밋 목록
| 커밋 | PR | 설명 | 상태 |
|------|-----|------|------|
| `d5ba72d` | #31 | feat: 활동 완료 도장 + 말풍선 잘림 수정 | ✅ merged |

#### PR #31: 활동 완료 도장 + 말풍선 잘림 수정 (DEV v0401o)

**1. 활동 완료 시 완료 도장 애니메이션**
- 보상 목표의 `.goal-tag` 도장과 동일한 SVG 스타일 (이중 원형 점선 + 텍스트)
- 색상: 초록(#10B981), 텍스트: "완료" + "DONE"
- `stampSlam` 애니메이션: scale(3)에서 축소하며 쾅 찍히는 효과
- 홈 카드: `.completion-stamp` (52px, 우하단, z-index:1)
- 활동기록: `.log-completion-stamp` (44px, 우측, z-index:1)
- 말풍선(z-index:6)보다 아래 레이어 → 말풍선이 도장에 가려지지 않음

**2. 활동기록 탭 말풍선 오른쪽 잘림 수정**
- `.log-sticker-area`: `overflow:hidden` → `overflow-x:auto; overflow-y:visible`
- 스크롤바 숨김 처리 (`scrollbar-width:none`, `::-webkit-scrollbar{display:none}`)
- 긴 텍스트의 말풍선이 잘리지 않고 가로 스크롤 가능

**3. 말풍선 애니메이션 시 아바타 아이콘 윗부분 잘림 수정**
- `.log-sticker-area`: `padding:2px 0` → `padding:4px 0` (상하 여백 확보)
- `.log-inf`: `overflow:visible` 명시 추가
- `bubbleDangle` 애니메이션의 rotate + translateY로 인한 아바타 클리핑 방지

#### 미완료 / 추가 확인 필요
- 운영기 미적용 — 운영기 반영 시 release 브랜치 → PR → merge 절차 사용
- 회원 탈퇴 후 Firebase Authentication 계정 자체 삭제는 미구현 (signOut만 수행). 필요 시 Firebase Admin SDK 또는 Cloud Function으로 처리 가능
- 네이버 로그인 검수 재제출 필요 (서비스 소개 문서 + 로그인 플로우 스크린샷)
- 카카오 개발자 콘솔에서 닉네임 동의항목 활성화 필요
