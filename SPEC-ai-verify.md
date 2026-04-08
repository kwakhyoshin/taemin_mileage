# SPEC: AI 활동 검증 (AI Verify) — Phase 3 / Step 1

> 마일리(mile.ly) Phase 3의 첫 번째 기능. 활동 완료 시 부모 대신 AI(Claude Haiku 4.5)가 사진을 보고 통과/반려를 판정한다. PRO 등급 전용. 본 문서는 **구현 전 합의용 스펙**이며, 구현 후 변경 이력은 `dev_guide.md`에 기록한다.

---

## 1. 목표

- 부모가 매번 활동을 일일이 확인해주지 않아도, 사전에 정의한 검증 기준을 AI가 대신 판정해준다.
- 기존 "활동 완료 → 즉시 마일리지 적립" 구조에 **검증 모드** 개념을 도입한다.
- 비용·오남용을 방지하기 위해 일일 한도와 부모 오버라이드 안전망을 둔다.

## 2. 비목표 (Step 1 범위 외)

- 음성 검증 (Step 2)
- 검증용 사진의 영구 저장 (Step 3, 옵션)
- 검증 프롬프트 프리셋/템플릿 마켓 (Step 3)
- 검증 히스토리 그래프/통계 화면 (Step 4)

---

## 3. 데이터 모델

### 3.1 활동(activity) 객체 확장

기존 활동 구조에 다음 필드 추가. 기존 활동은 마이그레이션 시 모두 `verifyMode='auto'`로 채운다.

```
activity = {
  ...기존 필드,
  verifyMode: 'auto' | 'parent' | 'ai',   // 기본 'auto'
  verifyConfig: {
    media: 'photo',                         // Step 1은 photo만
    prompt: string                          // 부모가 입력하는 검증 지시문
  } | null
}
```

- `auto`: 기존 동작. 완료 누르면 즉시 적립.
- `parent`: 부모 승인 후 적립. 기존 보상 승인 큐와 동일한 방식.
- `ai`: AI 검증 후 적립. **PRO 등급 전용.** 비PRO 사용자가 활동 만들기 화면에서 선택 시 PRO 안내 모달.

### 3.2 활동 로그(activity log) 항목 확장

```
logEntry = {
  ...기존 필드,
  status: 'pending' | 'approved' | 'rejected' | 'cancelled',
  verify: {
    mode: 'ai' | 'parent',
    result: 'pass' | 'reject' | 'uncertain' | 'over-limit',
    aiResult: 'pass' | 'reject' | 'uncertain' | null,   // AI 1차 결과 (있으면)
    parentResult: 'pass' | 'reject' | null,             // 부모 최종 결정 (있으면)
    comment: string,             // 최종 표시될 한 줄 평
    by: 'ai' | 'parent',         // 최종 판정 주체
    aiRaw: { ... } | null        // AI 응답 원본 (디버깅 옵션 ON일 때만)
  } | null
}
```

**상태 전이**:
- AI `pass` → `status: approved`, `verify.by: 'ai'`, 마일리지 적립
- AI `reject` → `status: cancelled`, 활동 카드에서 사라지거나 토스트만 표시. 카운트는 +1.
- AI `uncertain` → `status: pending`, 부모 승인 큐로 자동 이관 → 부모 결정 후 `approved` 또는 `rejected`
- 한도 초과 → AI 호출 X, `status: pending`, 부모 승인 큐로 직행

**활동 카드 표시 (섹션 4.5에서 상세)**:
- 활동명 옆 **상태 칩** + 클릭 시 상세 모달

### 3.3 일일 카운터

```
Firestore: users/taemin/aiVerify/{YYYY-MM-DD}
{
  count: number,            // AI 호출 횟수 (pass/reject/uncertain 모두 포함)
  updatedAt: timestamp
}

system/config (시스템 관리자 전용)
{
  aiVerifyDailyLimit: 20,   // 글로벌 기본값
  userOverrides: { 'taemin': 30, ... }   // 사용자별 오버라이드 (선택)
}
```

- 자정(KST) 기준 새 문서 생성. 과거 문서는 유지하여 통계용으로 활용.
- **한도 조정 권한**: 부모 사용자는 조정 불가. 시스템 관리자 페이지에서만 조정 가능.

### 3.4 부모 승인 큐 (기존 재사용)

기존 보상 사용 신청 큐 구조에 `type` 필드를 추가하여 통합한다.

```
approvalRequest = {
  type: 'reward' | 'activity-verify',     // 신규 'activity-verify'
  activityId: string,
  logEntryId: string,
  mediaUrl: string,                       // 임시 업로드된 사진 URL (24h TTL)
  verifyPrompt: string,                   // 원래 검증 지시문 (참고용)
  aiResult: 'uncertain' | null,           // AI uncertain 판정 시 표시
  aiComment: string | null,
  reason: 'over-limit' | 'uncertain',
  createdAt, status, ...
}
```

부모 화면의 기존 "보상 승인" 카드 옆에 **"활동 검수 대기"** 섹션이 새로 생성된다. 동일한 푸시 알림 채널을 사용한다.

---

## 4. 사용자 흐름

### 4.1 부모: 활동 만들 때

1. 활동 생성 화면 하단에 **완료 조건** 섹션 신규 추가.
2. 라디오 버튼 3개:
   - ⚪ 자동 (눌렀을 때 바로 적립)
   - ⚪ 부모 승인 (내가 직접 확인 후 적립)
   - ⚪ 🤖 AI 검수 ✨PRO
3. AI 선택 시 하위 입력란 표시:
   - 매체: `사진` (Step 1은 고정)
   - 검증 지시문 (textarea, placeholder 예시 제공)
   - 💡 "AI가 잘 판단할 수 있게 쓰는 팁" 토글 (좋은 예/나쁜 예)
4. 비PRO 사용자가 AI 라디오를 누르면 PRO 안내 모달 → 닫으면 라디오 선택 취소.

### 4.2 아이: 활동 완료할 때 (verifyMode='ai')

1. 완료 버튼 누름 → "AI 검수 모달" 오픈.
2. 모달 상단: 마일리 캐릭터 + 말풍선 ("양치한 입 안 사진을 보여줘!")
3. 큰 카메라 버튼 1개 (`<input type=file accept=image/* capture=environment>`)
4. 사진 캡처 → 미리보기 → "검수 받기" 버튼
5. "검수 받기" 누르면 백엔드 호출 → 로딩 ("마일리가 확인중이에요...")
6. 결과 분기:
   - **pass**: 마일리지 적립 + 통과 애니메이션 + 코멘트 표시
   - **reject**: **활동 자체 취소** (기록 남지 않음). 친근한 사유 토스트만 잠깐 표시 후 사라짐. **카운트는 +1** (무한 재시도 방지)
   - **uncertain**: "엄마아빠가 한 번 더 봐줄게요" → 활동을 `pending`으로 두고 부모 승인 큐로 이관
   - **한도 초과**: AI 호출 없이 즉시 부모 승인 큐로 이관 + "오늘은 엄마아빠가 확인해 주실 거예요"

### 4.3 아이: 잔여 한도 표시

활동 완료 모달 우측 상단에 작은 표시: `🤖 17/20`. 한도 가까워지면 노란색, 초과 시 회색.

### 4.4 부모: 검수 대기 처리

1. 푸시 알림 ("태민이가 양치하기 활동을 완료했어요. 확인해주세요.")
2. 앱 진입 → "활동 검수 대기" 카드 (또는 **활동 목록의 노란 ⏳ 칩 클릭**으로도 진입 가능 — 섹션 4.5)
3. 카드 내용: 활동명, 아이가 올린 사진, 원래 검증 지시문, AI 결과·코멘트(있으면)
4. 버튼: ✅ 통과 / ❌ 반려(사유 입력) / 자세히 보기
5. 처리 결과는 활동 로그에 `verify.by:'parent'`로 기록.

### 4.5 활동 카드 검수 결과 표시 (칩 + 모달 하이브리드)

활동 목록의 각 항목은 활동명 옆에 **상태 칩**을 둔다. 칩은 시각적으로 한눈에 스캔 가능한 색상으로 구분한다.

```
┌─────────────────────────────────────────┐
│ 🪥 양치하기              [🤖 통과 ✓]    │  ← 칩
│ 오전 8:15 · +10 · 치아가 깨끗해요        │  ← 통과 시 미니 코멘트 (회색 작게)
└─────────────────────────────────────────┘
```

**칩 종류**:
- `🤖 통과` (초록) — AI 통과
- `⏳ 검수 대기` (노란, 깜빡임) — uncertain 또는 한도 초과로 부모 승인 대기
- `👨‍👩 통과` (파랑) — 부모가 검수 통과
- `👨‍👩 반려` (회색) — 부모가 반려 (이력 보존)
- AI 반려는 활동 자체가 취소되므로 **칩 없이 카드가 사라짐**

**클릭 동작**:
- **통과/반려된 칩** → 상세 모달 (검증 지시문, AI/부모 코멘트 전문, 검수 사진 미리보기, 사후 오버라이드 버튼)
- **⏳ 검수 대기 칩** → **즉시 검수 모달이 열림** (부모가 그 자리에서 통과/반려 처리 가능). 부모 승인 메뉴를 따로 안 거쳐도 됨.

**미니 코멘트 줄**:
- AI/부모 통과 시에만 활동 시간 옆에 코멘트 첫 20자를 회색 작은 글씨로 함께 표시 → 부모가 칩을 누르지 않아도 흐름 따라가며 볼 수 있음.

---

## 5. 백엔드 API

### 5.1 인프라 선택 — Vercel Edge Function (기존 mily-proxy 재사용)

**중요**: Cloudflare Workers는 사용 불가. 과거 `mily-proxy.workers.dev`에서 Anthropic API 호출 시 403 "Request not allowed" 오류 발생. 원인은 Anthropic API도 Cloudflare 뒤에 있어 **CF→CF 라우팅 충돌** (debug에서 HKG colo + `server: cloudflare` 헤더로 확인). 현재 챗봇(밀리)이 사용 중인 **Vercel Edge Function 프록시** `https://mily-proxy.vercel.app`로 마이그레이션되어 안정 운영 중. 이 사고는 `dev_guide.md`의 "챗봇 프록시 마이그레이션 (Cloudflare Worker → Vercel Edge Function)" 섹션에 기록됨.

**Step 1 인프라**:
- 기존 `mily-proxy` 저장소(Vercel)에 **`api/verify.js` 신규 추가**
- 도메인: `https://mily-proxy.vercel.app/api/verify`
- 시크릿: 챗봇과 동일하게 Vercel 환경변수 `ANTHROPIC_API_KEY` 재사용
- CSP: 이미 `connect-src`에 `https://mily-proxy.vercel.app` 허용됨 → 추가 작업 불필요
- Firestore: 클라이언트가 직접 쓰는 기존 구조 유지. 단, **카운터 증가와 PRO 검사는 서버에서 수행**해야 우회 불가능 → Firebase Admin SDK(REST)로 서버에서 카운터 문서 read/write

**왜 챗봇용 `/api/proxy`와 분리하는가**:
- 일일 카운터·PRO 검사·시스템 프롬프트 가드를 서버사이드에서 강제해야 함 → 비즈니스 로직 분리
- 챗봇 프록시 변경이 검증 기능에 영향 주지 않도록 격리

### 5.2 엔드포인트

```
POST https://mily-proxy.vercel.app/api/verify
Headers:
  Authorization: Bearer <Firebase ID Token>
  Content-Type: application/json
Body:
  {
    activityId: string,
    logEntryId: string,
    prompt: string,
    imageBase64: string,
    imageMime: 'image/jpeg' | 'image/png'
  }
Response:
  {
    result: 'pass' | 'reject' | 'uncertain' | 'over-limit',
    comment: string,            // 한 줄 코멘트 (한국어, 30자 이내). over-limit이면 안내 문구
    confidence: number,         // 0~1
    countToday: number,         // 처리 후 카운트
    limit: number               // system/config에서 가져온 한도
  }
```

### 5.3 처리 순서

1. Firebase ID Token 검증 → userId 추출 (Firebase Admin SDK / REST)
2. Firestore에서 사용자 PRO 등급 확인. 비PRO면 403.
3. `system/config`에서 한도 로드 (사용자별 오버라이드 우선, 없으면 글로벌)
4. 오늘 카운터 조회.
   - `count >= limit`이면 200 + `{result:'over-limit'}` 반환 (Anthropic 호출 X, 카운트 증가 X). 클라이언트가 부모 승인 큐로 이관.
5. Anthropic API 호출 (Claude Haiku 4.5 멀티모달) — Vercel Edge에서 fetch
   - System: AI 검수봇 역할 안내, **이분법적 판정 강제**, **민감 콘텐츠 가드**, JSON으로만 응답.
   - User: 검증 지시문 + 이미지
6. 응답 파싱 → `pass/reject/uncertain` + comment + confidence
7. 카운트 +1 (pass/reject/uncertain 모두 포함, over-limit 제외)
8. Firestore 활동 로그에 `verify` 필드 기록 (서버에서 직접 쓰기)
9. 클라이언트에 결과 반환

### 5.4 시스템 프롬프트 (초안)

```
당신은 어린이 활동 검수봇 "마일리"입니다.
부모가 정한 검증 기준에 따라 사진을 보고 통과/반려를 판정합니다.

규칙:
1. 반드시 JSON으로만 응답합니다: {"result":"pass|reject|uncertain","comment":"...","confidence":0.0~1.0}
2. comment는 한국어 30자 이내, 친근한 말투. 아이가 상처받지 않게 작성.
3. 판정 기준이 모호하거나 사진 품질이 낮으면 "uncertain".
4. 절대 평가하지 않을 항목: 외모, 신체, 옷차림, 표정, 인종, 체형.
5. 사진에 사람 얼굴이 크게 잡혀도 그것 자체는 평가 대상이 아님. 검증 기준에만 집중.
6. 검증 기준과 사진이 명백히 무관하면 "uncertain"으로 응답하고 comment에 "사진을 다시 찍어줘" 안내.
7. Haiku 4.5의 한계를 고려해 이분법적으로 단순 판단. 미묘한 판단은 "uncertain".
```

### 5.5 보안·비용 가드

- Firebase ID Token 필수 (Anonymous 토큰도 허용 — 기존 인증 구조 유지)
- 사용자별 1초당 1회 rate limit (Vercel Edge Config 또는 Upstash Redis)
- 이미지 크기 5MB 제한, 1024×1024로 리사이즈 후 호출 (클라이언트에서 선처리)
- 오늘 카운트 + 30일 누적 카운트 둘 다 저장 (운영 모니터링)
- 시스템 관리자 대시보드: 사용자별 일일 사용량, 누적 비용, 한도 변경 UI

---

## 6. 클라이언트 구현 작업 목록 (dev/index.html)

대략적 작업 지점. 실제 구현 시 구체 라인은 그때 결정.

1. 활동 객체 마이그레이션: `defaultState`/`load` 시점에 `verifyMode='auto'` 기본값 채우기.
2. 활동 만들기/수정 화면에 완료 조건 UI 추가 (라디오 3개 + AI 선택 시 검증 지시문 입력란 + PRO 안내).
3. PRO 등급 체크 함수 (현재 PRO 신청 플로우 재사용).
4. AI 검수 모달 컴포넌트 (카메라 입력, 미리보기, 결과 표시, 잔여 한도 칩).
5. 백엔드 호출 헬퍼 (`POST /api/verify` + Firebase ID Token + 이미지 리사이즈).
6. 부모 승인 큐에 `type:'activity-verify'` 처리 추가 (기존 보상 승인 컴포넌트 확장).
7. 활동 카드 렌더링에 **상태 칩** + 클릭 시 상세 모달 + AI 통과 시 미니 코멘트 1줄 추가.
8. ⏳ 검수 대기 칩 클릭 → 즉시 검수 모달 (부모가 활동 목록에서 바로 처리).
9. 푸시 알림 텍스트 분기 (보상 vs 활동 검수).
10. 에러 케이스: 네트워크 실패, 토큰 만료, 카메라 권한 거부, 이미지 너무 큼, over-limit.

---

## 7. 안전·프라이버시

- **사진 저장 정책 (기본값)**: AI 검증 후 즉시 삭제. Firestore에는 검증 결과 텍스트만 보관.
- **부모 승인 큐로 이관된 경우만 임시 저장 (24시간 TTL)** — 부모가 봐야 하므로. Firebase Storage 임시 버킷.
- **AI 응답 원본**(`aiRaw`)은 디버깅 옵션이 켜진 경우만 저장. 기본은 OFF.
- **민감 콘텐츠 차단**: 검증 지시문에 외모/신체/옷차림 관련 키워드가 들어가면 활동 저장 자체를 차단(클라이언트 + 서버 양쪽 검사).
- **부모 오버라이드 우선**: AI 통과 결과도 부모가 사후 취소 가능. 활동 로그에 양쪽 모두 기록.

---

## 8. 비용 추정 (Haiku 4.5 기준)

- 1건당: 약 $0.001 ~ $0.003
- 사용자 1명 × 일 20건 × 30일 = 600건 → **월 $0.6 ~ $1.8**
- PRO 월 5,000원(가정) 시 마진 99% 이상.
- 비용 폭주 방어: 일일 20회 하드 캡 + Vercel Edge IP rate limit + 사용자별 30일 누적 모니터링.

---

## 9. 단계 구분

| 단계 | 범위 |
|------|------|
| **Step 1 (이번 스펙)** | 사진 검증, 일일 20회, 부모 승인 폴백, Haiku 4.5, 결과 텍스트만 보관, Vercel Edge Function |
| Step 2 | 음성 검증 (Whisper STT + Haiku 텍스트 평가) |
| Step 3 | 사진 영구 보관 옵션, 검증 프롬프트 프리셋 |
| Step 4 | 검증 히스토리 통계, 게이미피케이션 연동(연속 통과 보너스 등) |

---

## 10. 결정 사항 (확정)

| 항목 | 결정 |
|------|------|
| 인프라 | **Vercel Edge Function** (`mily-proxy` 저장소에 `api/verify.js` 추가). Cloudflare Workers는 CF→CF 충돌로 사용 불가 |
| AI 모델 | **Claude Haiku 4.5** (현재 챗봇과 동일) |
| 일일 한도 기본값 | **20회** (글로벌). 부모 조정 불가, **시스템 관리자 페이지에서만 조정** |
| uncertain 처리 | **항상 부모 승인 큐로 이관** |
| reject 처리 | **활동 자체 취소** (기록 남지 않음). 카운트는 +1로 무한 재시도 방지 |
| 검수 결과 표시 | **활동명 옆 상태 칩 + 클릭 시 모달**. 통과 시 활동 시간 옆 미니 코멘트 1줄 |
| ⏳ 검수 대기 칩 | 클릭 시 부모 검수 모달 즉시 오픈 (활동 목록에서 바로 처리 가능) |

## 11. 미해결 / 합의 필요 항목

1. PRO 등급 가격 (월 5,000원 가정 — 확정 필요. Phase 4 결제 연동까지는 신청 폼 기반 베타로 운영)
2. 부모 반려(`👨‍👩 반려`) 결과를 활동 카드에 칩으로 남길지, 완전 삭제할지 (현 스펙은 회색 칩으로 보존)

---

## 12. 다음 단계

1. 본 스펙 사용자 최종 리뷰 → 미해결 항목 확정
2. 합의 완료 후 feature 브랜치(`feature/ai-verify-step1`) 생성
3. **Vercel mily-proxy 저장소에 `api/verify.js` 추가** → 배포 → 단독 테스트
4. **dev/index.html 구현** → PR → 통시테스트 → main merge
5. 구현 완료 후 `dev_guide.md`에 구현 결과·트러블슈팅·변경 이력 기록
6. PRO 결제 연동(Phase 4)이 준비되면 정식 런칭, 그 전엔 신청 폼 기반 베타로 운영
