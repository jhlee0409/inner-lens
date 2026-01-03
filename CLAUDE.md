# CLAUDE.md - inner-lens

## Quick Reference

```bash
npm run typecheck    # 타입 체크 (필수)
npm run test         # 테스트 (필수)
npm run dev          # 개발 서버
npm run build        # 빌드
```

**슬래시 명령어:**
- `/project:fix-issue #123` - 이슈 수정
- `/project:new-feature 기능명` - 새 기능 구현
- `/project:review 파일경로` - 코드 리뷰
- `/project:test 대상` - 테스트 작성

---

## 핵심 규칙

### ✅ 필수 (MUST)
- 코드 변경 전 관련 파일 먼저 읽기
- 변경 후 `npm run typecheck && npm run test` 실행
- 기존 패턴 따르기 (새 패턴 도입 금지)
- 불확실하면 먼저 질문하기

### ❌ 금지 (NEVER)
- 요청하지 않은 리팩토링
- 불필요한 추상화/헬퍼 함수 생성
- 변경하지 않은 코드에 주석 추가
- console.log 남기기
- TODO/FIXME 주석 (완전히 구현할 것)
- any 타입 사용

---

## 프로젝트 개요

**inner-lens**: AI 기반 버그 분석을 제공하는 셀프 디버깅 QA 에이전트

**흐름:** Widget → Log/Network 캡처 → 민감정보 마스킹 → API → GitHub Issue → AI 분석

## 기술 스택

| 분류 | 기술 |
|------|------|
| Language | TypeScript (ES2022, strict mode) |
| Build | tsup (ESM + CJS) |
| Test | Vitest + jsdom |
| Validation | Zod |
| Session Replay | rrweb |
| AI | Vercel AI SDK |
| GitHub | Octokit, @octokit/app |

## 프로젝트 구조

```
src/
├── types.ts              # 공유 타입 정의 ⭐
├── core/InnerLensCore.ts # 위젯 핵심 로직
├── components/           # React 컴포넌트
├── hooks/                # React 훅
├── utils/
│   ├── masking.ts        # 민감정보 마스킹 ⭐
│   ├── log-capture.ts    # 콘솔/네트워크 캡처
│   └── analysis.ts       # 코드 분석
├── server.ts             # Self-hosted 백엔드
└── cli.ts                # CLI

api/                      # Vercel Serverless
├── report.ts             # POST /api/report ⭐
└── health.ts

scripts/
└── analyze-issue.ts      # AI 분석 엔진 ⭐
```

---

## 코드 스타일

```typescript
// ✅ 타입 임포트
import type { InnerLensConfig } from './types';

// ✅ undefined 처리
const [owner, repo] = repository.split('/');
const safeOwner = owner ?? '';
const safeRepo = repo ?? '';

// ✅ 옵셔널 체이닝 + 기본값
const value = obj?.prop ?? defaultValue;

// ❌ 금지
const [owner, repo] = repository.split('/'); // undefined 가능
const value = obj?.prop; // undefined 타입 남음
```

---

## 일관성 체크

| 변경 시 | 함께 확인 |
|---------|-----------|
| `src/types.ts` | 모든 컴포넌트, API, 문서 |
| API 페이로드 | `api/report.ts`, `src/server.ts`, `types.ts` |
| CLI 예시 | README.md, docs/ |
| Workflow | README.md, CLI 생성 코드 |

**데이터 흐름:**
```
InnerLensConfig.repository ("owner/repo")
  → BugReportPayload.owner, .repo (파싱 필수!)
  → API 검증
```

---

## 테스트 규칙

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('기능명', () => {
  it('should 동작 설명', () => {
    // Given - When - Then
  });
});
```

- 파일 위치: `src/foo.ts` → `src/foo.test.ts`
- 외부 의존성 모킹 필수
- 새 기능 = 테스트 필수

---

## 배포 모드

### Hosted (권장)
- Endpoint: `inner-lens-one.vercel.app/api/report`
- Auth: GitHub App
- Env: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`

### Self-Hosted
- Auth: GitHub PAT
- Env: `GITHUB_TOKEN`, `GITHUB_REPOSITORY`

---

## 가드레일 예시

```bash
# 자율 실행
"허락 묻지 말고 끝까지 진행해"
"테스트 통과할 때까지 계속해"

# 확인 필요
"커밋 전에 멈춰"
"5개 이상 파일 수정 시 확인"

# 범위 제한
"src/utils만 수정해"
"타입만 변경하고 구현은 건드리지 마"
```

---

## Sub-agent 활용

다음 상황에서 sub-agent 검증 요청:
- 보안 관련 (`masking.ts`, auth)
- 여러 파일 동시 수정 시 일관성
- API 페이로드 변경 시 E2E 검증

---

## 컨텍스트 제공

```bash
# 파일 참조
"@src/types.ts 의 InnerLensConfig 확장해줘"

# 패턴 참조
"InnerLensWidget 패턴 따라서 새 컴포넌트 만들어줘"

# 문서 참조
/url https://docs.github.com/en/rest/issues
```

---

## 주의사항

1. **보안**: AI 처리 전 반드시 마스킹
2. **번들**: Session replay ~77KB (on-demand 로드)
3. **SSR**: 위젯은 클라이언트만
4. **Peer Deps**: React, Vue는 선택적
