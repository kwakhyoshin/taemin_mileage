# QA 테스트 리포트 v3

**실행일시**: 2026. 3. 28. 오후 3:55:09
**URL**: https://kwakhyoshin.github.io/taemin_mileage/dev/
**뷰포트**: iPhone 14 (390×844)
**결과**: **37/41 PASS** (4 FAIL)

---

## V3. V3 신규 검증 항목 (3/5)

| 상태 | 테스트 | 스크린샷 | 비고 |
|------|--------|---------|------|
| ❌ FAIL | V3-1: 환경 전환 버튼 존재 (버그) | 000-V3-0-welcome.png | txt:🚀운영 환경으로 전환, oc:switchEnv(), id: |
| ✅ PASS | V3-2: 웰컴 텍스트 중앙 정렬 | 001-V3-2-welcome-align.png | display:flex, textAlign:start, alignItems:normal, textEls:[{"tag":"H1","cls":"ob |
| ✅ PASS | V3-3: 웰컴 하단 배경 채워짐 | 002-V3-3-welcome-bg.png | bodyBg:rgba(0, 0, 0, 0), welBottom:0, vh:844, bottomEls:3 |
| ❌ FAIL | V3-4: 호칭 선택 제목 미발견 | 003-V3-4-title-screen.png | 실제제목: 가족이 당신을뭐라고 부르나요?, 화면: DEV
가족에서 어떤
역할이세요?
역할에 맞는 방식으로 시작해드릴게요
양육자 (어른)
아이의  |
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
매일 작은 활동이
습관이 돼요
66일이면 자연스러운 일상이 됩니다
가족이 함께하면
동기부여가 달라 |
| ✅ PASS | A3: 화면 전환 | 007-A3-role.png | 방식:showAuthScreen(role), 내용:DEV
mile.ly
안녕, 태민아! 👋

3월 28일 (토)

☀️
18°
초미세
15 |
| ✅ PASS | A4: 양육자 선택 | 008-A4-parent.png | {"onclick":"selectRoleType('caregiver')","text":"양육자 (어른)\n                아이의 습 |
| ✅ PASS | A5: 전환 시도 | 009-A5-title.png | 방식:title, 내용:DEV
mile.ly
안녕, 태민아! 👋

3월 28일 (토)

☀️
18°
초미세
15 |
| ✅ PASS | A6: 아빠 선택 | 010-A6-dad.png | null |
| ✅ PASS | A7: 이름 입력 화면 | 011-A7-name.png | DEV
mile.ly
안녕, 태민아! 👋

3월 28일 (토)

☀️
18°
초미세
152
미세
66
명동 |
| ✅ PASS | A8: 뒤로가기 | 012-A8-back.png | create1Back() |
| ✅ PASS | A9: 앞으로 | 013-A9-forward.png |  |

## B. 로그인 (3/3)

| 상태 | 테스트 | 스크린샷 | 비고 |
|------|--------|---------|------|
| ✅ PASS | B1: 자격증명 입력 | 015-B1-filled.png |  |
| ✅ PASS | B2: 로그인 성공 | 016-B2-after-login.png | DEV
mile.ly
가족 계정으로 로그인하세요
🙈
로그인
처음이신가요? 시작하기
mile.ly
안녕, 태 |
| ✅ PASS | B3: Enter 키 (이미 로그인) | 016-B2-after-login.png | 건너뜀 |

## C. 홈탭 (6/6)

| 상태 | 테스트 | 스크린샷 | 비고 |
|------|--------|---------|------|
| ✅ PASS | C1: 마일리지 | 017-C0-home.png | 숫자 있음 |
| ✅ PASS | C2: 인사말 | 018-C2-home.png | DEV mile.ly 가족 계정으로 로그인하세요 🙈 로그인 처음이신가요? 시작하기 mile.ly 안녕, 태 |
| ✅ PASS | C3: 날씨/미세먼지 | 019-C3-weather.png | {"temp":true,"dust":true,"loc":true,"weatherEl":false} |
| ✅ PASS | C4: 스크롤 compact | 020-C4-compact.png | {"classes":"hero","hasCompact":false} |
| ✅ PASS | C5: 다크모드 토글 | 021-C5-dark-on.png | before:false→after:true |
| ✅ PASS | C6: 활동 카드 | 022-C6-act-card.png | {"found":true,"cls":"act-grid","txt":"🦷\n양치질\n+20 마일리지\n✓\n8시간 5분 후\n🧼\n"} |

## D. 하단 네비 (7/8)

| 상태 | 테스트 | 스크린샷 | 비고 |
|------|--------|---------|------|
| ✅ PASS | D1: 5탭 | 023-D0-nav.png | 홈, 활동, 보상, 리포트, MY |
| ✅ PASS | D2: 활동탭 전환 | 024-D2-log.png |  |
| ✅ PASS | D2: 보상탭 전환 | 025-D2-rwd.png |  |
| ✅ PASS | D2: 리포트탭 전환 | 026-D2-hist.png |  |
| ✅ PASS | D2: MY탭 전환 | 027-D2-my.png |  |
| ✅ PASS | D2: 홈탭 전환 | 028-D2-home.png |  |
| ✅ PASS | D3: 네비 레이아웃 정상 | 029-D3-nav-layout.png | x:63.375, w:263.25, right:326.625 |
| ❌ FAIL | D4: 좌측 빈 공간 | 030-D4-left.png | x=63.375px |

## E. 활동기록 (3/3)

| 상태 | 테스트 | 스크린샷 | 비고 |
|------|--------|---------|------|
| ✅ PASS | E1: 활동 목록 21개 | 031-E0-act.png | 
      
      
      🦷
      양치질
      +20 마일리지
  |
| ✅ PASS | E2: 활동 완료 | 032-E2-complete.png | actId:a2 |
| ✅ PASS | E3: 취소 (역방향) | 033-E3-cancel.png | toggle |

## F. 보상 (2/2)

| 상태 | 테스트 | 스크린샷 | 비고 |
|------|--------|---------|------|
| ✅ PASS | F1: 보상 목록 9개 | 034-F0-rwd.png | 🎯 목표
🧱
레고 닌자고
1,500 마일리지
마일리지 부족
1,470 마일리지 더 필요 |
| ✅ PASS | F2: 보상 교환 | 035-F2-exchange.png | togglePwd('create-user-pwd', this) |

## G. MY 탭 (3/4)

| 상태 | 테스트 | 스크린샷 | 비고 |
|------|--------|---------|------|
| ❌ FAIL | G1: 프로필 | 037-G1-profile.png | DEV
mile.ly
가족 계정으로 로그인하세요
👁️
로그인
처음이신가요? 시작하기
이름
역할
기분 & 프로필
기분 표현
프로필 사진 변경
가 |
| ✅ PASS | G2: 메뉴 0개 발견 | 037-G1-profile.png |  |
| ✅ PASS | G3: 관리자 페이지 | 038-G3-admin.png | DEV
mile.ly
가족 계정으로 로그인하세요
👁️
로그인
처음이신가요? 시작하기
이름
역할
기분 & 프 |
| ✅ PASS | G4: 로그아웃 | 040-G4-after-logout.png | DEV
매일 작은 활동이
습관이 돼요
66일이면 자연스러운 일상이 됩니다
가족이 함께하면
동기부여가 달라져요 |

## H. 관리자 페이지 (1/1)

| 상태 | 테스트 | 스크린샷 | 비고 |
|------|--------|---------|------|
| ✅ PASS | H0: 관리자 탭 0개 | 038-G3-admin.png |  |

---

## FAIL 분석: 테스트 문제 vs 실제 앱 버그

### 🐛 실제 앱 버그 (3건)

| 항목 | 스크린샷 | 내용 |
|------|---------|------|
| **V3-1: 환경 전환 버튼 존재 (버그)** | 000-V3-0-welcome.png | txt:🚀운영 환경으로 전환, oc:switchEnv(), id: |
| **V3-4: 호칭 선택 제목 미발견** | 003-V3-4-title-screen.png | 실제제목: 가족이 당신을뭐라고 부르나요?, 화면: DEV
가족에서 어떤
역할이세요?
역할에 맞는 방식으로 시작해드릴게요
양육자 (어른)
아이의 습관을 함께
만 |
| **D4: 좌측 빈 공간** | 030-D4-left.png | x=63.375px |

### 🔧 테스트 코드 개선 필요 (1건)

| 항목 | 비고 |
|------|------|
| G1: 프로필 | DEV
mile.ly
가족 계정으로 로그인하세요
👁️
로그인
처음이신가요? 시작하기
이름
역할
기분 & 프로필
기분 표현
프로필 사진 변경
가족
가족 가계도 보기
관리 (관리자  |

---

## 스크린샷 (42장)

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
- `032-E2-complete.png`
- `033-E3-cancel.png`
- `034-F0-rwd.png`
- `035-F2-exchange.png`
- `036-G0-my.png`
- `037-G1-profile.png`
- `038-G3-admin.png`
- `039-G4-pre-logout.png`
- `040-G4-after-logout.png`
- `041-ZZ-final.png`
