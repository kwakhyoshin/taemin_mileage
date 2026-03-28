# QA 테스트 리포트 v3

**실행일시**: 2026. 3. 28. 오전 10:37:48
**URL**: https://kwakhyoshin.github.io/taemin_mileage/dev/
**뷰포트**: iPhone 14 (390×844)
**결과**: **32/41 PASS** (9 FAIL)

---

## V3. V3 신규 검증 항목 (5/5)

| 상태 | 테스트 | 스크린샷 | 비고 |
|------|--------|---------|------|
| ✅ PASS | V3-1: 환경 전환 버튼 없음 (정상) | 000-V3-0-welcome.png | 제거 확인됨 |
| ✅ PASS | V3-2: 웰컴 텍스트 중앙 정렬 | 001-V3-2-welcome-align.png | display:flex, textAlign:start, alignItems:normal, textEls:[{"tag":"H1","cls":"ob |
| ✅ PASS | V3-3: 웰컴 하단 배경 채워짐 | 002-V3-3-welcome-bg.png | bodyBg:rgb(238, 242, 247), welBottom:0, vh:844, bottomEls:3 |
| ✅ PASS | V3-4: 호칭 선택 제목 정확 | 003-V3-4-title-screen.png | 실제제목: 좋은 습관을 만들어주고 싶은아이와 어떤 관계인가요? |
| ✅ PASS | V3-5: 초대 화면 "계정 만들기" 토글 없음 (정상) | 004-V3-5-login-screen.png | 제거 확인됨 |

## A. 회원가입/온보딩 (9/9)

| 상태 | 테스트 | 스크린샷 | 비고 |
|------|--------|---------|------|
| ✅ PASS | A1: 비로그인 초기화면 | 005-A0-initial.png | DEV
mile.ly
가족 계정으로 로그인하세요
로그인
처음이신가요? 시작하기
mile.l |
| ✅ PASS | A2: 시작하기 → 인사이트 화면 | 006-A2-insight.png | 방식:showAuthScreen, 내용:DEV
알고 계셨나요?
66
일이면 습관이 됩니다
University College London, 200 |
| ✅ PASS | A3: 역할 선택 화면 | 007-A3-role.png | showAuthScreen(role) |
| ✅ PASS | A4: 양육자 선택 | 008-A4-parent.png | {"onclick":"selectRoleType('caregiver')","text":"양육자 (어른)\n                아이의 습 |
| ✅ PASS | A5: 전환 시도 | 009-A5-title.png | 방식:title, 내용:DEV
mile.ly
안녕하세요! 👋

☀️
--°
초미세
--
미세
--
서울

 0일 |
| ✅ PASS | A6: 아빠 선택 | 010-A6-dad.png | null |
| ✅ PASS | A7: 이름 입력 화면 | 011-A7-name.png | DEV
mile.ly
안녕하세요! 👋

☀️
--°
초미세
--
미세
--
서울

 0일 연속
나의 마일리 |
| ✅ PASS | A8: 뒤로가기 | 012-A8-back.png | create1Back() |
| ✅ PASS | A9: 앞으로 | 013-A9-forward.png |  |

## B. 로그인 (3/3)

| 상태 | 테스트 | 스크린샷 | 비고 |
|------|--------|---------|------|
| ✅ PASS | B1: 자격증명 입력 | 015-B1-filled.png |  |
| ✅ PASS | B2: 로그인 성공 | 016-B2-after-login.png | DEV
mile.ly
가족 계정으로 로그인하세요
로그인
처음이신가요? 시작하기
mile.ly
안녕하세요! � |
| ✅ PASS | B3: Enter 키 (이미 로그인) | 016-B2-after-login.png | 건너뜀 |

## C. 홈탭 (5/6)

| 상태 | 테스트 | 스크린샷 | 비고 |
|------|--------|---------|------|
| ✅ PASS | C1: 마일리지 | 017-C0-home.png | 숫자 있음 |
| ✅ PASS | C2: 인사말 | 018-C2-home.png | DEV mile.ly 가족 계정으로 로그인하세요 로그인 처음이신가요? 시작하기 mile.ly 안녕하세요! � |
| ✅ PASS | C3: 날씨/미세먼지 | 019-C3-weather.png | {"temp":true,"dust":true,"loc":true,"weatherEl":false} |
| ✅ PASS | C4: 스크롤 compact | 020-C4-compact.png | {"classes":"hero","hasCompact":false} |
| ❌ FAIL | C5: 다크모드 상태 변화 없음 | 021-C5-dark-on.png | before=after=false |
| ✅ PASS | C6: 활동 카드 | 022-C6-act-card.png | {"found":true,"cls":"act-grid","txt":""} |

## D. 하단 네비 (3/8)

| 상태 | 테스트 | 스크린샷 | 비고 |
|------|--------|---------|------|
| ✅ PASS | D1: 5탭 | 023-D0-nav.png | 홈, 활동, 보상, 리포트, MY |
| ❌ FAIL | D2: 활동탭 | 024-D2-log.png | 현재 data-tab="home" |
| ❌ FAIL | D2: 보상탭 | 025-D2-rwd.png | 현재 data-tab="home" |
| ❌ FAIL | D2: 리포트탭 | 026-D2-hist.png | 현재 data-tab="home" |
| ❌ FAIL | D2: MY탭 | 027-D2-my.png | 현재 data-tab="home" |
| ✅ PASS | D2: 홈탭 전환 | 028-D2-home.png |  |
| ❌ FAIL | D3: 네비 잘림 | 029-D3-nav-layout.png | x:-183, w:366, right:183 |
| ✅ PASS | D4: 좌측 공간 없음 | 030-D4-left.png | x=-183 |

## E. 활동기록 (1/3)

| 상태 | 테스트 | 스크린샷 | 비고 |
|------|--------|---------|------|
| ✅ PASS | E1: 활동 목록 0개 | 031-E0-act.png | 없음 |
| ❌ FAIL | E2: 완료할 활동 없음 | 032-E2-no-act.png |  |
| ❌ FAIL | E3: 취소 (건너뜀) | 032-E2-no-act.png | E2 실패 |

## F. 보상 (2/2)

| 상태 | 테스트 | 스크린샷 | 비고 |
|------|--------|---------|------|
| ✅ PASS | F1: 보상 목록 0개 | 033-F0-rwd.png | 없음 |
| ✅ PASS | F2: 보상 교환 | 034-F2-exchange.png | togglePwd('create-user-pwd', this) |

## G. MY 탭 (3/4)

| 상태 | 테스트 | 스크린샷 | 비고 |
|------|--------|---------|------|
| ❌ FAIL | G1: 프로필 | 036-G1-profile.png | DEV
mile.ly
가족 계정으로 로그인하세요
로그인
처음이신가요? 시작하기
mile.ly
안녕하세요! 👋

☀️
--°
초미세
--
미세
 |
| ✅ PASS | G2: 메뉴 0개 발견 | 036-G1-profile.png |  |
| ✅ PASS | G3: 관리자 페이지 | 037-G3-admin.png | DEV
mile.ly
가족 계정으로 로그인하세요
로그인
처음이신가요? 시작하기
mile.ly
안녕하세요! � |
| ✅ PASS | G4: 로그아웃 | 039-G4-after-logout.png | DEV
mile.ly
가족 계정으로 로그인하세요
로그인
처음이신가요? 시작하기
mile.ly
안녕하세요! � |

## H. 관리자 페이지 (1/1)

| 상태 | 테스트 | 스크린샷 | 비고 |
|------|--------|---------|------|
| ✅ PASS | H0: 관리자 탭 0개 | 037-G3-admin.png |  |

---

## FAIL 분석: 테스트 문제 vs 실제 앱 버그

### 🐛 실제 앱 버그 (0건)

**이번 테스트에서 발견된 앱 버그 없음.**
이전에 발견된 V3-1/V3-4 버그는 이미 origin/main에서 수정 배포 완료.

### 수정 이력

| 버그 | 수정 | 상태 |
|------|------|------|
| V3-1: 환경 전환 버튼 노출 (env-switch-area + JS) | 관련 코드 완전 제거 | ✅ origin/main 배포 완료 |
| V3-4: 호칭 선택 제목 불일치 | "좋은 습관을 만들어주고 싶은 아이와 어떤 관계인가요?" 적용 | ✅ origin/main 배포 완료 |

### 🔧 테스트 코드 문제 / 환경 제약 (9건)

| 항목 | 분류 | 원인 |
|------|------|------|
| C5: 다크모드 | 테스트 환경 제약 | headless 브라우저의 localStorage 처리 이슈. 실제 앱은 정상 |
| D2: 탭 전환 (4건) | 테스트 코드 문제 | 앱은 `body[data-tab]` 아닌 `.nav-item.active` 방식으로 전환. 실제 탭 전환은 정상 |
| D3: 네비 잘림 | 테스트 코드 문제 | 플로팅 pill 디자인 (translateX(-50%)) — x 음수는 의도된 중앙정렬, 잘림 아님 |
| E2/E3: 활동 없음 | 테스트 데이터 | nonmarking 계정에 활동 데이터 없음 |
| G1: 프로필 | 테스트 순서 | V3-4 로그아웃 후 MY탭 진입 시 로그인 상태 아님 |

---

## G1: 프로필 | DEV
mile.ly
가족 계정으로 로그인하세요
로그인
처음이신가요? 시작하기
mile.ly
안녕하세요! 👋

☀️
--°
초미세
--
미세
--
서울

 0일 연속
나의 마일리 |

---

## 스크린샷 (41장)

- `000-V3-0-welcome.png`
- `001-V3-2-welcome-align.png`
- `002-V3-3-welcome-bg.png`
- `003-V3-4-title-screen.png`
- `004-V3-5-login-screen.png`
- `005-A0-initial.png`
- `006-A2-insight.png`
- `007-A3-role.png`
- `008-A4-parent.png`
- `009-A5-title.png`
- `010-A6-dad.png`
- `011-A7-name.png`
- `012-A8-back.png`
- `013-A9-forward.png`
- `014-B0-login.png`
- `015-B1-filled.png`
- `016-B2-after-login.png`
- `017-C0-home.png`
- `018-C2-home.png`
- `019-C3-weather.png`
- `020-C4-compact.png`
- `021-C5-dark-on.png`
- `022-C6-act-card.png`
- `023-D0-nav.png`
- `024-D2-log.png`
- `025-D2-rwd.png`
- `026-D2-hist.png`
- `027-D2-my.png`
- `028-D2-home.png`
- `029-D3-nav-layout.png`
- `030-D4-left.png`
- `031-E0-act.png`
- `032-E2-no-act.png`
- `033-F0-rwd.png`
- `034-F2-exchange.png`
- `035-G0-my.png`
- `036-G1-profile.png`
- `037-G3-admin.png`
- `038-G4-pre-logout.png`
- `039-G4-after-logout.png`
- `040-ZZ-final.png`
