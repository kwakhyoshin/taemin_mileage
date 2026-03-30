# 태민이 마일리지 (mile.ly) — 개발·운영 완전 가이드

> 이 문서는 새 세션에서 실수 없이 개발·테스트·배포할 수 있도록 모든 핵심 정보를 담고 있습니다.
> **새 세션 시작 시 반드시 이 문서를 먼저 읽을 것.**
> 최종 업데이트: 2026-03-30 (소셜 로그인 TDZ 수정, 바텀시트/카카오 팝업 수정, 보상요청 알림 자기→자기 버그 수정)

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

## 변경 이력 (Change Log)

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

#### 미완료 / 추가 확인 필요
- 카카오 로그인: Kakao Developer Portal에서 앱 상태가 "개발 중"이면 등록된 테스트 계정만 사용 가능. 실 사용자가 카카오 로그인 실패 시 포탈 설정 확인 필요
- 소셜 로그인 전체 E2E 테스트: Google ✅, 네이버 ✅, 카카오 ⚠️ (팝업 구조 수정됨, 실기기 테스트 필요)
- 운영기 배포: 위 수정사항은 개발기에만 적용됨. 운영기 반영 시 sync 스크립트 사용
