# 요청사항 추적 (Request Tracker)

> 사용자 요청사항의 개발기/운영기 반영 현황을 기록한다.
> 새 요청이 들어오면 반드시 이 문서에 추가하고, 배포 시 상태를 업데이트할 것.

## 상태 범례

| 상태 | 의미 |
|------|------|
| 대기 | 아직 개발 시작 안 함 |
| 개발중 | 개발기에서 작업 중 |
| 개발완료 | 개발기 반영 완료, 운영 미반영 |
| 운영완료 | 개발기 + 운영기 모두 반영 완료 |
| 설계중 | 설계 문서 작성 단계 (구현 전) |
| 보류 | 일시 보류 |

## 요청 목록

| # | 요청일 | 요청 내용 | 개발기 | 운영기 | 비고 |
|---|--------|-----------|--------|--------|------|
| R-001 | 2025-04-08 | Firestore save failed 콘솔 에러 수정 (dh 권한 오류) | v0408zA | PR #300 반영 | Firestore rules 수동 배포 포함 |
| R-002 | 2025-04-08 | logout 시 _milyOpen ReferenceError 수정 | v0408zA | PR #300 반영 | IIFE 스코프 격리 이슈 |
| R-003 | 2025-04-08 | Firestore Security Rules: users 서브컬렉션 와일드카드 추가 | N/A (규칙) | 수동 배포 완료 | `{userId}` → `{userId}/{document=**}` |
| R-004 | 2025-04-08 | 법적고지(약관/개인정보) 인앱 오버레이 전환 | v0408zB | PR #303 반영 | window.open → 뱃지뷰 스타일 오버레이 |
| R-005 | 2025-04-08 | 법적고지 오버레이 태블릿 border-radius 수정 | v0408zB | PR #303 반영 | 768px/1024px 미디어쿼리 |
| R-006 | 2025-04-09 | Firestore 데이터 모델 ERD 작성 | erd.html, erd.mermaid | N/A (문서) | 인터랙티브 HTML + Mermaid |
| R-007 | 2025-04-09 | ERD 유지보수 규칙 CLAUDE.md에 추가 | 반영 완료 | N/A (규칙) | 배포 체크리스트 항목 5 |
| R-008 | 2025-04-09 | 백엔드 아키텍처 전환 설계서 작성 | 설계중 | 미적용 | BACKEND_ARCHITECTURE.docx |
| R-009 | 2025-04-09 | 요청사항 추적 문서(REQUESTS.md) 생성 | 반영 완료 | N/A (문서) | 이 문서 |
| R-010 | 2025-04-09 | 요청사항 추적 의무화 규칙 CLAUDE.md에 추가 | 반영 완료 | N/A (규칙) | |
| R-011 | 2026-04-10 | 오늘 할일 이력: 부모 선정 오늘 할일만 표시 (비할일 활동 제외) | v0410a | PR #305 반영 | showHome 필터 적용 |
| R-012 | 2026-04-10 | 오늘 할일 이력: 과거일 조회 스크롤 → 날짜 이동 충돌 수정 | v0410a | PR #305 반영 | 스크롤 우선, 끝 도달 시 이동 |
| R-013 | 2026-04-10 | AI 검수 이름 마일리 → mily 통일 | v0410a | PR #305 반영 | |
| R-014 | 2026-04-10 | 최근 활동 목록에 AI 검수 결과(승인/반려/이관) 표시 | v0410a | PR #305 반영 | 활동명 하단에 사유 포함 |
| R-015 | 2026-04-12 | 스플래시 화면: mily 캐릭터 → mile.ly 로고로 교체 | v0410b | PR #306 반영 | 글래스모피즘 + pulse 애니메이션 |
| R-016 | 2026-04-12 | 편집 버튼 높이 축소 + 둥근 사각형 + 연필 아이콘 | v0410c | PR #307 반영 | 제목 영역 정렬 개선 |
| R-017 | 2026-04-12 | 홈 인사말: mily 캐릭터 → mile.ly 로고 아이콘 교체 | v0410d | PR #308 반영 | 42px 둥근 로고 |
| R-018 | 2026-04-12 | 모든활동/교환가능한보상 섹션 제목 아이콘-텍스트 정렬 | v0410e | PR #309 반영 | R-016 보완 |
| R-019 | 2026-04-12 | 로딩 화면(데이터 불러오는 중) mily 캐릭터 → mile.ly 로고 텍스트 | v0410f | PR #310 반영 | 기존 앱 SVG 폰트 사용 |
| R-020 | 2026-04-12 | 홈 인사말 캐릭터 원복 (잘못된 변경 v0410d 되돌림) | v0410f | PR #310 반영 | |
| R-021 | 2026-04-12 | 편집/추가 버튼 글씨·아이콘 키우고 네모 패딩 줄이기 | v0410f | PR #310 반영 | R-016 보완 |
| R-022 | 2026-04-12 | 브랜드 폰트 변경 금지 가이드라인 CLAUDE.md에 추가 | v0410f | N/A (규칙) | |
| R-023 | 2026-04-12 | 로딩 화면 mile.ly 로고 크기 확대 + 태그라인 추가 | v0410h | PR #314 반영 | "성장하는 우리 아이의 첫 마일리지" |
| R-024 | 2026-04-12 | 편집/추가 버튼 디자인을 이력보기 버튼과 동일 스타일로 통일 | v0410i | PR #314 반영 | R-016 최종 보완 |
| R-025 | 2026-04-12 | 뱃지 목록에 마일리지 수령/미수령 상태 아이콘 표시 | v0410l | PR #319 반영 | 수령: 초록체크, 미수령: 노랑선물. v0410j는 잘못된 함수만 수정, v0410l에서 실제 화면(renderBadgeViewGrid) 수정 |
| R-026 | 2026-04-12 | 메뚜기 뒷다리 ㅅ 대칭 수정 + 높이 통일 | v0410k | PR #319 반영 | 무릎 위치 대칭화, 발끝 앞다리와 동일 |
| R-027 | 2026-04-12 | 뱃지 마일리지 수령 후 목록 아이콘 즉시 갱신 | v0410m | PR #321 반영 | renderAll()에 renderBadgeViewGrid/History 추가 |
| R-028 | 2026-04-13 | 회원가입 역할 선택 아이콘 8종 리디자인 | v0413a | PR #322 반영 | 아빠(넥타이), 엄마(단발보브), 할아버지(은발+금테안경), 할머니(짧은파마), 외할아버지(5:5가르마+사각안경), 외할머니(곱슬파마), 삼촌(투블럭), 이모(일자뱅+꽃헤어핀) |
| R-029 | 2026-04-13 | 챗봇 대화기록 다른 사용자 로그인 시 보이는 버그 수정 | v0413c | PR #324 반영 | localStorage 키를 사용자별로 분리 (_getMilyChatLSKey) |
| R-030 | 2026-04-13 | 관리자 설정에 가족 전체 삭제 기능 추가 | v0413c | PR #324 반영 | Firestore 문서 삭제 + Auth Registry 정리 + localStorage 전체 정리 |
| R-031 | 2026-04-13 | 역할 선택 아이콘 순서 수정 + 아빠 눈썹 추가 | v0413b→c | PR #323,#324 반영 | 아빠→엄마→할아버지→할머니→외할아버지→외할머니→삼촌→이모 |
| R-032 | 2026-04-13 | 소개 페이지 실제 앱 스크린샷으로 교체 | v0413d | PR #325 반영 | SVG→실제 스크린샷 8장, 다크/라이트 자동 전환, 4단계 확장, 과학적 근거 문구 |
| R-033 | 2026-04-13 | 역할 선택에서 미선택 시 건너뛰기 방지 | v0413e | PR #326 반영 | 건너뛰기 버튼 제거, 역할 필수 선택 |
| R-034 | 2026-04-13 | 가족 전체 삭제를 시스템 관리자 페이지(admin.html)로 이동 | v0413f | PR #334 반영 | 앱 내 관리자에서 제거 → admin.html 가족상세에 추가. CLAUDE.md에 관리자 구분 지침 추가 |
| R-035 | 2026-04-13 | 운영기 소개페이지 이미지 경로 수정 (ob-*.png → dev/ob-*.png) | v0413f | PR #334 반영 | index.html이 루트에 있어 dev/ 폴더 이미지 참조 불가 문제 |
| R-036 | 2026-04-14 | 디자인 Phase 1: 색상 팔레트 CSS 변수화 (349개 교체) | v0414a | PR #335 반영 | 누락 변수 12개 추가, 하드코딩 색상→var() 교체 |
| R-037 | 2026-04-14 | 디자인 Phase 2: border-radius 7단계 통합 (185개 교체) | v0414a | PR #335 반영 | --rxs~--rfull 변수 체계 |
| R-038 | 2026-04-14 | 디자인 Phase 2: font-size 9단계 통합 (410개 교체) | v0414a | PR #335 반영 | --fs-xs~--fs-4xl 변수 체계 |
| R-039 | 2026-04-14 | 디자인 Phase 2: --shadow-sm 변수 추가 | v0414a | PR #335 반영 | box-shadow 3단계 체계 (sm/default/lg) |
| R-040 | 2026-04-14 | 홈 이력보기 날짜 이동 화살표 방향 수정 (▲ 이전날 ↔ ▼ 다음날) | v0414b | PR #342 운영반영 | diaryNav 호출 인자 교체 |
| R-041 | 2026-04-14 | PWA 설치 안내 팝업 제거 (Android/iOS 가입 완료 시 자동 팝업) | v0414c | PR #342 운영반영 | 3곳 비활성화, 수동 tryPwaInstall은 유지 |
| R-042 | 2026-04-14 | AI 기능 소개 팝업 제거 (_maybeShowFeatureIntros 비활성화) | v0414c | PR #342 운영반영 | 관리자 미리보기 및 함수 코드는 유지 |
| R-043 | 2026-04-14 | Android FCM 알림 브릿지 연동 — subscribePush/unsubscribePush/updatePushUI MilelyBridge 분기 | v0414d | PR #342 운영반영 | getDeviceId도 native_ 접두사로 분리 |
| R-044 | 2026-04-14 | handleNativeNotificationClick 전역 함수 추가 — 알림 클릭 시 화면 이동 | v0414d | PR #342 운영반영 | type별 탭 이동 (family_msg/reward/activity/home) |
| R-045 | 2026-04-14 | Cloud Functions sendToDevices FCM 분기 추가 — type:'fcm' 기기 admin.messaging().send() 처리 | v0414d | PR #342 운영반영 | 토큰 만료 시 자동 enabled:false |
| R-046 | 2026-04-14 | 나의 메뉴 알림 항목 레이블 개선 — "푸시 알림" → "알림 수신" + 설명 문구 추가 | v0414e | PR #342 운영반영 | "가족 메시지·아이 활동 승인 요청 등 중요한 소식을 알림으로 받아요" |
| R-047 | 2026-04-14 | Galaxy Fold 펼침 화면 하단 탭바 고정 버그 수정 — position:fixed+transform 조합 문제 | v0414f | PR #344 운영반영 | body.native-app CSS+JS로 WebView 전용 처리, bottom:0 항상 고정 |
| R-048 | 2026-04-14 | Galaxy Fold 탭바 동작 수정 — 항상 고정 방식 → 일반 폰과 동일한 floating↔dock 방식 | v0414g | PR #346 운영반영 | checkNavDock()이 native-app에서도 동작 |
| R-049 | 2026-04-14 | 하단 탭바 원래 스타일 복원 — body.native-app nav CSS 오버라이드 제거 | v0414h | PR #348 운영반영 | nav CSS !important 전부 삭제 (넓은 화면 사이드바 겹침 문제 발생) |
| R-050 | 2026-04-14 | native-app nav CSS를 @media(min-width:768px)로 스코프 | v0414i | PR #350 운영반영 | 좁은 폰은 기본 CSS 유지, 넓은 화면 사이드바→하단바 오버라이드 |
| R-051 | 2026-04-14 | Galaxy Fold 펼침=태블릿 모드(사이드바) — native-app nav 오버라이드 전부 제거 | v0414j | PR #352 운영반영 | body.native-app CSS/JS 원복, 기존 미디어쿼리 위임 |
| R-052 | 2026-04-14 | Galaxy Fold 세로 펼침: 하단 floating→dock 동작 + 가로 펼침: 사이드바 | v0414k | PR #354 운영반영 | isSidebarMode() 도입: ≥1024px 또는 768+landscape=사이드바skip, 768-1023 portrait=스크롤 dock. docked 스타일은 폰과 동일(var(--tab-lt)) |
| R-053 | 2026-04-14 | 갤럭시 폴드 세로모드 docked nav backdrop-filter 복원 | v0414l | 개발완료 | 768-1023 portrait 미디어쿼리에서 backdrop-filter:blur(24px) saturate(180%)!important 적용 |
| R-054 | 2026-04-14 | Android 3버튼 네비바가 floating nav 겹침 수정 | v0414p | 개발완료 | UA 기반 html.is-android 감지 + bottom:76px!important (native-app 의존 제거) |
| R-055 | 2026-04-14 | Android WebView에서 카카오 로그인: window.open()이 외부 브라우저로 열려 콜백 불가 | v0414q | PR #366 운영반영 | _isNativeWebView() 헬퍼 추가, WebView 감지 시 redirect 방식 강제 + 리다이렉트 복귀 처리기 추가 |
| R-056 | 2026-04-14 | Android WebView에서 네이버 로그인 후 로그인 화면 멈춤 | v0414q | PR #366 운영반영 | WebView 감지 시 redirect 방식 강제 (기존 popup 시도 생략) |
| R-057 | 2026-04-14 | Android WebView에서 온보딩 소개 이미지 깨짐 (ob-*.png) | v0414q | PR #366 운영반영 | 상대 경로 → 절대 URL(https://kwakhyoshin.github.io/taemin_mileage/dev/ob-*.png) |
| R-058 | 2026-04-15 | FCM 푸시 data 페이로드에 title/body 추가 (APK data 우선 읽음) | PR #367 | N/A (서버) | functions-index.js sendToDevices data 블록에 title/body 포함 |
| R-059 | 2026-04-15 | activity_verify 푸시 타입 매핑 (familyMessages.type → push data.type) | PR #367 | N/A (서버) | buildFamilyMsgPayload 헬퍼, activity_verify_request/_approval/_rejection → activity_verify |
| R-060 | 2026-04-15 | push-sender.js FCM 분기 추가 (admin.messaging().send) | PR #367 | N/A (서버) | CLI 리마인더 스크립트에서도 FCM 기기에 발송 가능. 만료 토큰 자동 비활성화 |
| R-061 | 2026-04-15 | 안드로이드 APK edge-to-edge 하단 네비바와 AI 검수 팝업/하단 고정 UI 겹침 수정 | v0415n / v0415o | release/v0415o 반영 | v0415n: 전역 sheet-body/foot/nav-container/mily-fab/toast/ep-pop에 `--android-nav-inset` 반영. v0415o: AI 검수 팝업 stage 컨테이너 명시 셀렉터 추가 + `--native-nav-bar-h` 변수명도 함께 인식. iOS safe-area 및 데스크탑 0px fallback 공존 |
| R-062 | 2026-04-16 | subscribePush() 네이티브 경로 즉시 피드백 (로딩 상태 + 토스트) | v0416a | — | 권한 요청 중 토글 opacity .5 + pointerEvents none, 완료 후 복원 |
| R-063 | 2026-04-16 | _milelyOnFCMToken 토스트 중복 방지 — 기존 등록 + 동일 토큰이면 생략 | v0416a | — | 앱 실행마다 "활성화됐어요" 뜨던 문제 해결 |
| R-064 | 2026-04-16 | 알림 상태 체크 네이티브 분기 누락 (sendFamilyMsg + _showPushOffBanner) | v0416a | — | pushSubscription 대신 MilelyBridge.isNotificationEnabled() 사용. 안드로이드 APK에서 "알림이 꺼져 있어요" 항상 뜨던 문제 해결 |
| R-065 | 2026-04-16 | 운영기 알림 토글: 토스트+토글 안 변하는 문제 — _milelyOnFCMToken의 await setDoc hang 대응 | v0416b | — | UI/토스트를 Firestore write 앞으로 이동, setDoc은 fire-and-forget + 8초 타임아웃. async→sync 함수 변경 |
| R-066 | 2026-04-16 | 운영기 알림: 네이티브 evaluateJavascript 콜백 미수신 — 5초 폴백 타이머 + 권한 승인 즉시 UI 갱신 | v0416c | — | _milelyOnPermissionResult에서 즉시 updatePushUI, subscribePush에 5초 폴백 타이머 |
| R-067 | 2026-04-16 | 적응형 UI Type 4: 태블릿 세로(768-1023px portrait) 하단 바 바닥 밀착 + 로고 밑줄 제거 | v0416d | — | 플로팅→솔리드 바, bottom:0, border-radius:0, nav-brand 숨김 |
| R-068 | 2026-04-16 | 적응형 UI Type 5: 갤럭시 폴드 펼친 세로(580-767px portrait) 카드 레이아웃 태블릿 동일화 | v0416d | — | 활동·보상 4열, 통계 2열, 대시보드 masonry 2열. 네비는 스마트폰 하단 스타일 유지 |

## 미착수 백로그 (ROADMAP.md 기준)

| # | 카테고리 | 항목 | 상태 |
|---|----------|------|------|
| B-001 | Phase 1 게이미피케이션 | 콜렉션 도감 | 대기 |
| B-002 | Phase 1 게이미피케이션 | 시즌 패스 / 이벤트 | 대기 |
| B-003 | Phase 1 게이미피케이션 | 마일리 캐릭터 진화 | 대기 |
| B-004 | Phase 1 게이미피케이션 | 연속일수 보호 아이템 | 대기 |
| B-005 | Phase 2 가족 협업 | 가족 챌린지 | 대기 |
| B-006 | Phase 2 가족 협업 | 응원 스티커/이모지 반응 | 대기 |
| B-007 | Phase 2 가족 협업 | 주간 가족 리뷰 | 대기 |
| B-008 | Phase 2 가족 협업 | 형제자매 비교/협력 모드 | 대기 |
| B-009 | Phase 3 AI 챗봇 | 주간 코치 리포트 | 대기 |
| B-010 | Phase 3 AI 챗봇 | 음성 입력 | 대기 |
| B-011 | Phase 3 AI 챗봇 | 이미지 인증 | 대기 |
| B-012 | Phase 3 AI 챗봇 | 부모 대신 답변 | 대기 |
| B-013 | Phase 4 기반 안정화 | 단일 HTML 모듈화 (Vite) | 대기 |
| B-014 | Phase 4 기반 안정화 | Firestore 백업/복원 자동화 | 대기 |
| B-015 | Phase 4 기반 안정화 | 에러 모니터링 (Sentry) | 대기 |
| B-016 | Phase 4 기반 안정화 | PRO 등급 결제 연동 | 대기 |
| B-017 | Phase 4 기반 안정화 | 다국어(i18n) 기반 | 대기 |

## 보안 백로그

| # | 항목 | 상태 |
|---|------|------|
| S-006 | Naver auth code flow 전환 | 대기 |
| S-007 | Kakao PKCE 적용 | 대기 |
| S-008 | crypto.getRandomValues 전환 | 대기 |
| S-010 | eval() 대체 | 대기 |
| S-011 | SRI (Subresource Integrity) | 대기 |
