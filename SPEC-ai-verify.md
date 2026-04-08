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
  verify: {
    mode: 'ai' | 'parent',
    result: 'pass' | 'reject' | 'uncertain',
    comment: string,             // AI 또는 부모가 남긴 한 줄 평
    by: 'ai' | 'parent',         // 최종 판정 주체
    aiRaw: { ... } | null        // AI 응답 원본 (디버깅용, 선택)
  } | null
}
```

활동 카드 하단 표시 형식:
- AI 통과: `🤖 AI 검수: 치아가 깨끗함 ✓`
- AI 반려: `🤖 AI 검수: 음식물이 보임 ✗`
- 부모 통과(AI 한도 초과 또는 uncertain): `👨‍👩 부모 검수: 통과`

### 3.3 일일 카운터

```
Firestore: users/taemin/aiVerify/{YYYY-MM-DD}
{
  count: number,            // 호출 횟수 (성공/실패 무관)
  limit: 20,                // 일일 한도 (기본 20)
  updatedAt: timestamp
}
```

자정(KST) 기준 새 문서 생성. 과거 문서는 유지하여 통계용으로 활용.

### 3.4 부모 승인 큐 (기존 재사용)

기존 보상 사용 신청 큐 구조에 `type` 필드를 추가하여 통합한다.

```
approvalRequest = {
  type: 'reward' | 'activity-verify',     // 신규 'activity-verify'
  activityId: string,                     // type='activity-verify'일 때
  logEntryId: string,                     // 어느 로그를 검수할지
  mediaUrl: string,                       // 임시 업로드된 사진 URL (24h TTL)
  verifyPrompt: string,                   // 원래 검증 지시문 (참고용)
  aiResult: 'uncertain' | null,           // AI가 uncertain 판정 시 표시
  reason: 'over-limit' | 'uncertain',     // 부모 승인 큐로 넘어온 사유
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
6. 결과:
   - **pass**: 마일리지 적립 + 통과 애니메이션 + 코멘트 표시
   - **reject**: 친근한 사유 + "다시 찍기" 버튼 (재시도 시 카운트 추가 +1)
   - **uncertain**: "엄마아빠가 한 번 더 봐줄게요" → 부모 승인 큐로 자동 이관
   - **한도 초과**: AI 호출 없이 즉시 부모 승인 큐로 이관 + "오늘은 엄마아빠가 확인해 주실 거예요"

### 4.3 아이: 잔여 한도 표시

활동 완료 모달 우측 상단에 작은 표시: `🤖 17/20`. 한도 가까워지면 노란색, 초과 시 회색.

### 4.4 부모: 검수 대기 처리

1. 푸시 알림 ("태민이가 양치하기 활동을 완료했어요. 확인해주세요.")
2. 앱 진입 → "활동 검수 대기" 카드
3. 카드 내용: 활동명, 아이가 올린 사진, 원래 검증 지시문, AI 결과(있으면)
4. 버튼: ✅ 통과 / ❌ 반려(사유 입력) / 자세히 보기
5. 처리 결과는 활동 로그에 `by:'parent'`로 기록.

---

## 5. 백엔드 API

mile.ly는 현재 단일 HTML + Firestore 직결 구조이므로, AI 키 보호를 위해 **첫 서버사이드 함수**가 필요하다.

### 5.1 인프라 선택

- **1순위**: Cloudflare Workers (무료 한도 충분, 콜드스타트 거의 없음)
- **2순위**: Firebase Cloud Functions (Firestore와 연동 쉬움)

Step 1은 Cloudflare Workers + Firebase Admin SDK 조합 권장.

### 5.2 엔드포인트

```
POST /verify
Headers:
  Authorization: Bearer <Firebase ID Token>
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
    result: 'pass' | 'reject' | 'uncertain',
    comment: string,            // 한 줄 코멘트 (한국어, 30자 이내)
    confidence: number,         // 0~1
    countToday: number,         // 처리 후 카운트
    limit: number
  }
```

### 5.3 처리 순서

1. Firebase ID Token 검증 → userId 추출
2. Firestore에서 사용자 PRO 등급 확인. 비PRO면 403.
3. 오늘 카운터 조회. `count >= limit`이면 200 + `{result:'over-limit'}` 반환 (호출 안 함, 카운트도 증가 안 함). 클라이언트가 부모 승인 큐로 이관.
4. Anthropic API 호출 (Claude Haiku 4.5 멀티모달):
   - System: AI 검수봇 역할 안내, **이분법적 판정 강제**, **민감 콘텐츠 가드**, JSON으로만 응답.
   - User: 검증 지시문 + 이미지
5. 응답 파싱 → `pass/reject/uncertain` + comment + confidence
6. 카운트 +1 (성공/실패 무관)
7. Firestore 활동 로그에 `verify` 필드 기록
8. 클라이언트에 결과 반환

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
```

### 5.5 보안·비용 가드

- Firebase ID Token 필수.
- 사용자별 1초당 1회 rate limit (Workers KV 또는 Durable Objects).
- 이미지 크기 5MB 제한, 1024×1024로 리사이즈 후 호출 (클라이언트에서 선처리).
- 오늘 카운트 + 30일 누적 카운트 둘 다 저장 (운영 모니터링).

---

## 6. 클라이언트 구현 작업 목록 (dev/index.html)

대략적 작업 지점. 실제 구현 시 구체 라인은 그때 결정.

1. 활동 객체 마이그레이션: `defaultState`/`load` 시점에 `verifyMode` 기본값 채우기.
2. 활동 만들기/수정 화면에 완료 조건 UI 추가.
3. PRO 등급 체크 함수 (현재 PRO 신청 플로우 재사용).
4. AI 검수 모달 컴포넌트 (카메라 입력, 미리보기, 결과 표시).
5. 백엔드 호출 헬퍼 (`/verify` POST + Firebase ID Token).
6. 부모 승인 큐에 `type:'activity-verify'` 처리 추가.
7. 활동 카드 렌더링에 `verify` 코멘트 1줄 추가.
8. 잔여 한도 카운터 UI.
9. 푸시 알림 텍스트 분기 (보상 vs 활동 검수).
10. 에러 케이스: 네트워크 실패, 토큰 만료, 카메라 권한 거부, 이미지 너무 큼.

---

## 7. 안전·프라이버시

- **사진 저장 정책 (기본값)**: 검증 후 즉시 삭제. Firestore에는 검증 결과 텍스트만 보관.
- **부모 승인 큐로 이관된 경우만 임시 저장 (24시간 TTL)** — 부모가 봐야 하므로. Firebase Storage 임시 버킷.
- **AI 응답 원본**(`aiRaw`)은 디버깅 옵션이 켜진 경우만 저장. 기본은 OFF.
- **민감 콘텐츠 차단**: 검증 지시문에 외모/신체/옷차림 관련 키워드가 들어가면 활동 저장 자체를 차단(클라이언트 + 서버 양쪽 검사).
- **부모 오버라이드 우선**: AI 결과는 항상 부모가 뒤집을 수 있고, 활동 로그에 양쪽 모두 기록한다.

---

## 8. 비용 추정 (Haiku 4.5 기준)

- 1건당: 약 $0.001 ~ $0.003
- 사용자 1명 × 일 20건 × 30일 = 600건 → **월 $0.6 ~ $1.8**
- PRO 월 5,000원 가정 시 마진 99% 이상.
- 비용 폭주 방어: 일일 20회 하드 캡 + Workers 레벨 IP rate limit + 사용자별 30일 누적 모니터링.

---

## 9. 단계 구분

| 단계 | 범위 |
|------|------|
| **Step 1 (이번 스펙)** | 사진 검증, 일일 20회, 부모 승인 폴백, Haiku 4.5, 결과 텍스트만 보관 |
| Step 2 | 음성 검증 (Whisper STT + Haiku 텍스트 평가) |
| Step 3 | 사진 영구 보관 옵션, 검증 프롬프트 프리셋 |
| Step 4 | 검증 히스토리 통계, 게이미피케이션 연동(연속 통과 보너스 등) |

---

## 10. 미해결 / 합의 필요 항목

1. PRO 등급 가격 (월 5,000원 가정 — 확정 필요)
2. Cloudflare Workers vs Firebase Functions 최종 선택
3. 일일 한도 기본값 20 — 사용자별 부모가 조정 가능하게 할지?
4. uncertain 판정 시 부모 확인 없이 자동 반려할지, 항상 부모 큐로 보낼지 (현 스펙은 후자)
5. 검증 실패(reject) 시에도 카운트 +1을 유지할지 — 오남용 방지엔 유리, UX엔 불리
6. 활동 카드의 검수 코멘트 줄 표시 위치(현재 정의: 활동명 아래 1줄)

---

## 11. 다음 단계

1. 본 스펙 사용자 리뷰 → 합의 필요 항목 결정
2. 합의 완료 후 feature 브랜치(`feature/ai-verify-step1`) 생성
3. dev/index.html 구현 → PR → 통시테스트 → main merge
4. 구현 완료 후 `dev_guide.md`에 구현 결과·트러블슈팅·변경 이력 기록
5. PRO 결제 연동(Phase 4)이 준비되면 정식 런칭, 그 전엔 신청 폼 기반 베타로 운영
