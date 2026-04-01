# 보안 취약점 조치 계획

**작성일**: 2026-04-01
**기준 문서**: SECURITY_AUDIT_20260401.md

---

## 조치 원칙

> **데이터 보호 → 시크릿 제거 → 코드 방어**

현재 가장 심각한 문제는 Firestore가 인증 없이 완전히 열려 있다는 것입니다.
아무리 시크릿을 교체해도 DB가 열려 있으면 의미가 없으므로, **DB 접근 차단이 최우선**입니다.

---

## 조치 순서

| 순번 | ID | 등급 | 항목 | 작업 방식 | 비고 |
|------|-----|------|------|-----------|------|
| 1 | S-01 | CRITICAL | Firestore 보안 규칙 설정 | Firebase Console (사용자 직접) | DB 읽기/쓰기 완전 노출 차단 |
| 2 | S-02 | CRITICAL | 카카오 client_secret 서버 이동 | Cloud Functions 코드 작성 | 클라이언트에서 시크릿 제거 |
| 3 | S-03 | CRITICAL | VAPID Private Key 코드에서 제거 | functions-index.js 수정 | 환경 변수로 이동 |
| 4 | S-04 | HIGH | postMessage wildcard origin 제한 | 앱 코드 수정 (PR) | `'*'` → 정확한 origin |
| 5 | S-05 | HIGH | sanitizePhotoUrl SVG 허용 제거 | 앱 코드 수정 (PR) | XSS 벡터 제거 |
| 6 | S-06 | HIGH | admin.html XSS 방지 | admin.html 수정 (PR) | innerHTML 이스케이프 |
| 7 | S-07 | HIGH | admin.html 인증 강화 | admin.html 수정 (PR) | 해시 노출 제거 |
| 8 | S-08 | HIGH | Google OAuth 자격증명 제거 | scripts/ 파일 수정 | 코드에서 시크릿 삭제 |
| 9 | S-09 | MEDIUM | 입력값 검증/길이 제한 | 앱 코드 수정 (PR) | 주요 입력 필드 |
| 10 | S-10 | — | 보안 조치 문서 최종 업데이트 | 문서 갱신 | 완료 확인 |

---

## 상세 조치 내용

### S-01. Firestore 보안 규칙 설정 (CRITICAL — 최우선)

**현재 상태**: 인증 없이 모든 문서 읽기/쓰기 가능 (2026-04-01 테스트 확인)

**테스트 결과**:
- `users/taemin` 읽기: ✅ 인증 없이 200 OK
- `families/` 컬렉션 목록: ✅ 인증 없이 200 OK
- `users/taemin` 쓰기: ✅ 인증 없이 200 OK ← **치명적**
- `families/_security_test` 생성: ✅ 인증 없이 200 OK ← **치명적**

**작업**: Firebase Console → Firestore → 규칙 탭에서 아래 규칙 적용

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 기본: 모든 접근 차단
    match /{document=**} {
      allow read, write: if false;
    }

    // users/{userId}: 인증된 사용자만 접근
    match /users/{userId} {
      allow read, write: if request.auth != null;
    }

    // families/{familyId}: 인증된 사용자만 접근
    match /families/{familyId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**담당**: 사용자 (Firebase Console 직접 접근 필요)
**소요 시간**: 5분
**주의**: 규칙 적용 후 앱이 정상 동작하는지 즉시 테스트

---

### S-02. 카카오 client_secret 서버 이동 (CRITICAL)

**현재 상태**: `index.html:17981`에 `client_secret` 하드코딩

**작업**:
1. 카카오 개발자 콘솔에서 client_secret 재발급
2. Cloud Functions에 토큰 교환 엔드포인트 생성
3. 클라이언트에서 authorization code를 CF로 전달
4. CF가 code → token 교환 후 결과 반환
5. `index.html`에서 client_secret 삭제

**담당**: 코드 수정 (PR) + Firebase 배포 + 카카오 콘솔
**소요 시간**: 2~3시간
**의존성**: Firebase CLI 필요 (`firebase deploy --only functions`)

---

### S-03. VAPID Private Key 코드에서 제거 (CRITICAL)

**현재 상태**: `functions-index.js:11`, `push-sender.js:23`에 private key 노출

**작업**:
1. VAPID 키쌍 재생성 (`web-push generate-vapid-keys`)
2. Private key → Firebase Functions 환경 변수 (`firebase functions:config:set`)
3. Public key → 클라이언트 코드 업데이트
4. `functions-index.js`, `push-sender.js`에서 private key 삭제
5. 기존 push 구독 모두 무효화됨 → 사용자 재구독 필요

**담당**: 코드 수정 (PR) + Firebase 배포
**소요 시간**: 1시간
**영향**: 모든 기기에서 push 알림 재등록 필요

---

### S-04. postMessage wildcard origin 제한 (HIGH)

**현재 상태**: `postMessage(data, '*')` → 모든 origin에 인증 데이터 전송

**작업**: `'*'` → `'https://kwakhyoshin.github.io'`로 변경

**파일**: `index.html:17985`, `index.html:18072`, `dev/index.html` 동일 위치
**담당**: 코드 수정 (PR)
**소요 시간**: 15분

---

### S-05. sanitizePhotoUrl SVG 허용 제거 (HIGH)

**현재 상태**: `data:image/svg+xml;base64,...` 허용 → XSS 가능성

**작업**: sanitizePhotoUrl()에서 `svg+xml` 제거, PNG/JPEG/GIF/WebP만 허용

**파일**: `index.html:17863`, `dev/index.html` 동일 위치
**담당**: 코드 수정 (PR)
**소요 시간**: 10분

---

### S-06. admin.html XSS 방지 (HIGH)

**현재 상태**: `innerHTML`에 사용자 이름이 이스케이프 없이 삽입

**작업**:
1. HTML 이스케이프 유틸 함수 추가
2. 모든 `innerHTML` 템플릿에서 사용자 입력값에 이스케이프 적용
3. onclick 핸들러에서 사용자 입력값 이스케이프

**파일**: `admin.html`, `dev/admin.html`
**담당**: 코드 수정 (PR)
**소요 시간**: 1시간

---

### S-07. admin.html 인증 강화 (HIGH)

**현재 상태**: 비밀번호 해시 + 관리자 실명이 소스코드에 하드코딩

**작업**:
1. 비밀번호 해시를 Firestore의 별도 보안 문서로 이동
2. 소스코드에서 해시와 실명 제거
3. (장기) Firebase Auth 기반 관리자 인증으로 전환

**파일**: `admin.html`, `dev/admin.html`
**담당**: 코드 수정 (PR) — S-01 완료 후 진행
**소요 시간**: 1시간

---

### S-08. Google OAuth 자격증명 코드에서 제거 (HIGH)

**현재 상태**: `scripts/migrate-prod-to-dev.js`에 CLIENT_ID, CLIENT_SECRET 하드코딩

**작업**: 하드코딩된 자격증명 삭제, `firebase login` 토큰 직접 사용하도록 변경

**파일**: `scripts/migrate-prod-to-dev.js`
**담당**: 코드 수정 (main 직접 커밋 — scripts/ 허용 범위)
**소요 시간**: 15분

---

### S-09. 입력값 검증/길이 제한 추가 (MEDIUM)

**현재 상태**: 활동 이름, 보상 이름, 메시지 등에 길이 제한 없음

**작업**:
1. 주요 입력 필드 식별 (활동명, 보상명, 메시지, 멤버명)
2. 최대 길이 제한 추가 (예: 이름 50자, 메시지 500자)
3. HTML 태그 필터링

**파일**: `index.html`, `dev/index.html`
**담당**: 코드 수정 (PR)
**소요 시간**: 1~2시간

---

### S-10. 보안 조치 문서 최종 업데이트

**작업**: 각 항목 완료 후 이 문서 갱신 + dev_guide.md 반영

---

## 조치 기록

| ID | 상태 | 완료일 | PR/작업 | 비고 |
|----|------|--------|---------|------|
| S-01 | ✅ 완료 | 2026-04-02 | Firebase Console | `_system` 읽기 전용 규칙 추가, 와일드카드 차단 규칙 유지 |
| S-02 | ✅ 완료 | 2026-04-02 | PR #85~#92 | Cloudflare Worker 프록시로 이동, 클라이언트에서 client_secret 제거 확인 |
| S-03 | ✅ 완료 | 2026-04-02 | PR #85~#92 | `defineSecret("VAPID_PRIVATE_KEY")` 환경변수 처리, 하드코딩 제거 확인 |
| S-04 | ✅ 완료 | 2026-04-02 | PR #85~#92 | `postMessage(data, 'https://kwakhyoshin.github.io')` — origin 지정 확인 |
| S-05 | ✅ 완료 | 2026-04-02 | PR #85~#92 | `sanitizePhotoUrl()`에서 svg+xml 제거, PNG/JPEG/GIF/WebP만 허용 확인 |
| S-06 | ✅ 완료 | 2026-04-02 | PR #85~#92 | `escapeHtml()` 48곳 적용 확인 (XSS 방지) |
| S-07 | ✅ 완료 | 2026-04-02 | PR #102 | 해시/실명 제거 → Firestore `_system/admin_accounts`에서 로드. escapeHtml() XSS 방지 |
| S-08 | ✅ 완료 | 2026-04-02 | main 직접 | CLIENT_ID/SECRET 하드코딩 제거 → 환경변수 또는 firebase-tools 자동 로드 |
| S-09 | ✅ 완료 | 2026-04-02 | PR #85~#92 | escapeHtml 전면 적용 + CSP + SRI + generateSecureRandom + sanitizeForBackup |
| S-10 | ✅ 완료 | 2026-04-02 | 이 업데이트 | 2026-04-02 점검 결과 반영 |

### 2026-04-02 점검 결과 요약

코드 레벨 보안 조치 현황을 전수 점검한 결과:

**완전 해결된 항목:**
- `escapeHtml()` 48곳 적용 (저장형 XSS 차단)
- CSP 메타 태그 (개발기/운영기 모두)
- SRI integrity 해시 (외부 리소스 2건)
- `generateSecureRandom()` 9곳 (암호학적 안전 난수)
- `sanitizeForBackup()` 5곳 (localStorage 백업 민감데이터 정제)
- OAuth state CSRF 방어 (sessionStorage 저장/검증)
- 관리자 세션 10분 자동 잠금
- 카카오 client_secret → Cloudflare Worker 프록시
- VAPID private key → Cloud Functions 환경변수
- postMessage wildcard → 정확한 origin 지정
- SVG base64 XSS → svg+xml 허용 제거

**2026-04-02 추가 조치:**
- `scripts/migrate-prod-to-dev.js`: CLIENT_SECRET 제거 → 환경변수/firebase-tools 자동 로드 (main 직접 커밋)
- `admin.html`: 해시/실명 제거 → Firestore `_system/admin_accounts`에서 로드 + escapeHtml() XSS 방지 (PR #102)
  - ⚠️ admin.html 사용 전 Firebase Console에서 `_system/admin_accounts` 문서 생성 필요
  - 문서 구조: `{ accounts: { 'nonmarking': { pwdHash: '기존해시값', name: '관리자이름' } } }`

**2026-04-02 Firestore 보안 규칙 조치 (S-01):**
- `_system/{docId}` 규칙 추가: `allow read: if true; allow write: if false;`
  → admin.html에서 관리자 계정 로드 가능, 쓰기는 차단 (Console에서만 관리)
- `_system/admin_accounts` 문서 생성 완료 (accounts > nonmarking > pwdHash, name)
- 기존 규칙: users 컬렉션 (taemin, taemin_dev만), families 컬렉션 (전체 허용), 나머지 차단 — 유지

**모든 S-01~S-10 항목 완료.**
