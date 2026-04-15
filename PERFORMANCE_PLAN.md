# 성능 개선 계획 (PERFORMANCE_PLAN)

> 작성일: 2026-04-15  
> 배경: PWA 콜드스타트 시 "데이터 불러오는 중..." 화면이 10초 이상 머무는 현상 빈도가 점점 증가. Play Store 배포 대비 개선 필요.

## 1. 현재 상태 진단

### 콜드스타트 경로 (`dev/index.html` L24407~L24489)
모두 **직렬**로 실행됨:

1. **Firebase SDK 4개 dynamic import** (`_initFirebase` L9493~) — app/firestore/auth/app-check 각각 gstatic.com HTTPS fetch. 콜드 네트워크에서 2~5초.
2. **App Check (reCAPTCHA Enterprise) 초기화** (L9520) — grecaptcha 스크립트 + attestation 토큰. WebView에서 1~3초.
3. **onAuthStateChanged 최대 3초 대기** (L9530) — iPhone PWA 이슈 안전장치지만 정상 유저도 세금.
4. 세션 없으면 **익명 로그인 추가 왕복**.
5. **레거시 마이그레이션 포인터 getDoc** 1회.
6. **메인 가족 문서 `await getDoc(DATA_DOC)`** (L24419) ← **결정적 병목**.
7. 마이그레이션 + 경우에 따라 `save()` (전체 doc 재작성).
8. `hideLoading()`.

### 근본 문제 — 단일 거대 문서 + 오프라인 캐시 부재
- `S` 한 객체에 activities / log / moodLog / familyMessages / rewardLog / rewardInventory / rewardRequests / actVerifyRequests / memberData / pushDevices / photos 전부 JSON blob 저장 (`setDoc(DATA_DOC, S)` L10201)
- 사용자 활동이 쌓일수록 문서 선형 증가 → **"점점 빈도가 늘어남"의 정체**
- Firestore 1MB 문서 한계 위협 (시한폭탄)
- `initializeFirestore({localCache:...})` / `enableIndexedDbPersistence` **어디에도 없음** → 매 콜드스타트 풀 네트워크 왕복

### Play Store 배포 시 추가 리스크
- **Android WebView 페널티**: Chrome 탭 캐시 공유 안 함. Chrome 3초 → WebView 6~10초.
- **Google Play Vitals**: cold start > 5초면 "Bad" 판정 → Play Console에 "느린 시작" 경고 노출 → 설치 전환율 하락.
- **네트워크 취약 환경**: `getDoc` 타임아웃 없음 → 무한 "데이터 불러오는 중..." → 강제종료 → 1점 리뷰.

---

## 2. 개선 로드맵 (효과 순서대로)

### ① Firestore 오프라인 캐시 활성화 [효과 최대, 반나절]
- `initializeFirestore({ localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`
- IndexedDB 실패 시 메모리 캐시 폴백
- 두 번째 이후 콜드스타트 수초 → 300ms 이하 기대
- **리스크**: 사파리 프라이빗 브라우징/저장소 부족 시 fallback 필요

### ② 스플래시/로딩 UX 이원화 [수시간]
- 캐시 데이터 있으면 즉시 홈 렌더 → onSnapshot으로 백그라운드 갱신
- "데이터 불러오는 중..." 풀블로킹은 최초 설치 때만
- `showLoading('데이터 불러오는 중...')`(L24407) 제거 또는 조건부 호출

### ③ onAuthStateChanged 3초 → 1초, 익명 로그인 지연 [30분]
- L9536 `setTimeout(...,3000)` → 1000
- `signInAnonymously`는 write 필요한 시점(회원가입)으로 지연

### ④ preconnect / modulepreload [30분]
- `<head>`에 추가:
  - `<link rel="preconnect" href="https://www.gstatic.com" crossorigin>`
  - `<link rel="preconnect" href="https://firestore.googleapis.com">`
  - `<link rel="modulepreload" href="...firebase-firestore.js">`
- TCP·TLS 수백ms 절약

### ⑤ 거대 문서 분할 — 서브컬렉션 이행 [1~2주, 중기 필수]
- `families/{id}` — 메타·familyMeta·settings만 (콜드스타트 필수 필드만)
- `families/{id}/log/{logId}` — 활동 로그
- `families/{id}/messages/{msgId}` — 가족 메시지 (페이지네이션)
- `families/{id}/rewardLog`, `rewardRequests`, `actVerifyRequests` 서브컬렉션
- **이점**: 콜드스타트 read 수 KB로 축소, save 비용 급감, 1MB 한계 해소
- **리스크**: 마이그레이션 스크립트 + 기존 사용자 영향. 배포 **전**에 해야 10배 쉬움.

### ⑥ save() 전체 재작성 → `updateDoc` 부분 patch [⑤ 이후]
- L10201 `setDoc(DATA_DOC, S)` → 변경된 필드만 update
- 서브컬렉션 분할 후 자연스럽게 달성

### ⑦ onSnapshot 리스너의 `JSON.stringify(S)` 비교 제거 [⑤ 이후, 2시간]
- L6696 snapshot마다 전체 S stringify — dirty flag/타임스탬프 비교로 대체

### ⑧ App Check 지연 초기화 [1시간]
- 현재 `_initFirebase` 내부에서 무조건 초기화
- 첫 write 직전까지 지연 → 첫 read 경로 단축

### ⑨ HTML 파일 분리 / 번들러 도입 [중장기]
- 현재 25,000줄 단일 HTML → 초기 parse 부담
- 외부 JS 파일로 분리 + esbuild 같은 경량 번들러

---

## 3. Play Store 배포 체크리스트

### 출시 전 필수
1. ①②③ 완료 (오프라인 캐시 + UX + 타임아웃 가드)
2. ⑤ 완료 (문서 분할) — 밀리면 출시 후 마이그레이션 10배 어려움
3. **타임아웃 가드**: `getDoc`을 `Promise.race`로 8초 타임아웃, 실패 시 캐시 폴백 + "오프라인 모드" 안내
4. **Firebase Performance Monitoring SDK** — p50/p95 cold start 실측
5. **Firebase Crashlytics** + `window.onerror` / `unhandledrejection` 커스텀 로그
6. **Play Console pre-launch report** — 내부 테스트 트랙 올려 실기기 자동 테스트
7. **Data Safety 섹션** — 수집 데이터 정직하게 기재 (이메일, 가족 메타, 활동 로그, 사진 URL, FCM 토큰)
8. **Firestore security rules 리뷰** — 가족 격리, anonymous 권한 범위
9. **실기기 테스트** — 갤럭시 A 저가형(RAM 3~4GB) + "Slow 3G" 시뮬레이션

### 모니터링 지표 (Google Play Vitals 기준)
- Cold start p95 < 5초 (Bad 임계)
- ANR 비율 < 0.47%
- Crash 비율 < 1.09%

---

## 4. 우선순위별 실행 계획

### 시나리오 A: 2주 내 출시
- **1주차**: ① 오프라인 캐시 + ② UX + ③ 타임아웃
- **2주차**: Performance + Crashlytics + pre-launch report
- ⑤ 문서 분할은 **v1.1로 연기** (출시 후 리스크 존재)

### 시나리오 B: 4주 여유
- **1~2주차**: ⑤ 문서 분할 먼저 (데이터 많은 사용자 평점 방어)
- **3주차**: ①②③
- **4주차**: 계측 + pre-launch + 최종 QA

---

## 5. 작업 로그

| 단계 | 상태 | PR | 개발기 | 운영기 | 비고 |
|------|------|----|--------|--------|------|
| ① Firestore 오프라인 캐시 | 개발기+운영기 반영 | #381 | v0415j | v0415j | 2026-04-15 |
| ② 스플래시/로딩 UX 이원화 | 개발기 반영 | PR 예정 | v0415k | — | 2026-04-15, 사용자 검증 후 운영 반영 |
| ③ auth 대기 단축 + 익명 지연 | 대기 | — | — | — | |
| ④ preconnect/modulepreload | 대기 | — | — | — | |
| ⑤ 거대 문서 분할 | 대기 | — | — | — | 설계 문서 필요 |
| ⑥ updateDoc 부분 patch | 대기 | — | — | — | ⑤ 선행 |
| ⑦ snapshot stringify 제거 | 대기 | — | — | — | ⑤ 선행 |
| ⑧ App Check 지연 초기화 | 대기 | — | — | — | |
| ⑨ HTML 분리/번들러 | 대기 | — | — | — | 중장기 |

---

## 6. 결정 사항 / 열린 질문
- (열림) 시나리오 A vs B 확정 필요
- (열림) ⑤ 서브컬렉션 스키마 상세 설계 (별도 문서)
- (열림) 타임아웃 시 "오프라인 모드" UX 디자인
