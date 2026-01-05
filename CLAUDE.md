# CLAUDE.md - inner-lens

> AI 어시스턴트를 위한 프로젝트 컨텍스트 문서

## 프로젝트 개요

**inner-lens**: Self-Debugging QA Agent - 유니버설 버그 리포팅 위젯 + AI 분석

```
┌─────────────────────────────────────────────────────────────────────┐
│                        inner-lens 아키텍처                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Frontend Widget]                    [Backend]                     │
│  ┌─────────────────┐                  ┌─────────────────┐          │
│  │ React/Vue/      │   POST /report   │ Hosted API      │          │
│  │ Vanilla Widget  │ ───────────────► │ (Vercel)        │          │
│  │                 │                  │ api/report.ts   │          │
│  │ - Log Capture   │                  └────────┬────────┘          │
│  │ - User Actions  │                           │                   │
│  │ - Navigation    │        OR                 │ GitHub App        │
│  │ - Performance   │                           ▼                   │
│  │ - Masking       │                  ┌─────────────────┐          │
│  └─────────────────┘                  │ GitHub Issue    │          │
│          │                            │ (inner-lens     │          │
│          │ Self-Hosted Mode           │  label)         │          │
│          ▼                            └────────┬────────┘          │
│  ┌─────────────────┐                           │                   │
│  │ Your Backend    │                           │ Triggers          │
│  │ src/server.ts   │ ──────────────────────────┤                   │
│  │ handlers        │                           ▼                   │
│  └─────────────────┘                  ┌─────────────────┐          │
│                                       │ Analysis Engine │          │
│                                       │ (GitHub Actions)│          │
│                                       │ scripts/        │          │
│                                       │ analyze-issue.ts│          │
│                                       └─────────────────┘          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 기술 스택

| 분류 | 기술 |
|------|------|
| Build | tsup (ESM + CJS dual output) |
| Test | Vitest + jsdom |
| Validation | Zod |
| AI | Vercel AI SDK (Anthropic/OpenAI/Google) |
| GitHub | Octokit (REST API) |

---

## 필수 명령어

```bash
# 개발 시 항상 실행 (변경 후 필수)
npm run typecheck    # TypeScript 타입 체크
npm run test         # Vitest 테스트

# 빌드 검증
npm run sync:check   # Vercel 동기화 검증 ⚠️ 중요
npm run build        # tsup 빌드
```

### CI 파이프라인

```bash
# PR 제출 전 반드시 통과해야 함
npm run typecheck && npm run sync:check && npm run test
```

---

## ⚠️ Critical: Vercel 제약

**`api/` 폴더는 `src/`에서 import 불가!**

Vercel Serverless Functions는 독립 실행되어 `src/` 모듈을 참조할 수 없습니다.
따라서 공유 타입과 유틸리티는 **복제**해서 관리합니다.

```
┌──────────────────────┐         ┌──────────────────────┐
│     src/types.ts     │ ──복제─► │   api/_shared.ts     │
│ src/utils/masking.ts │ ──복제─► │   (타입 + 마스킹)    │
└──────────────────────┘         └──────────────────────┘
```

### 동기화 규칙

| 변경 대상 | 동기화 필요 |
|-----------|-------------|
| `src/types.ts` (LogEntry, UserAction, etc.) | `api/_shared.ts` |
| `src/utils/masking.ts` (MASKING_PATTERNS) | `api/_shared.ts` |
| API 페이로드 구조 | `api/report.ts` + `src/server.ts` 둘 다 |

### 검증 방법

```bash
npm run sync:check  # 자동 비교 스크립트
```

이 검사가 실패하면 CI도 실패합니다.

---

## 프로젝트 구조

```
inner-lens/
├── src/                          # 클라이언트 SDK 소스
│   ├── types.ts                  # 공유 타입 정의 ⭐
│   ├── core/
│   │   └── InnerLensCore.ts      # 프레임워크 무관 핵심 클래스
│   ├── components/
│   │   └── InnerLensWidget.tsx   # React 위젯 컴포넌트
│   ├── hooks/
│   │   └── useInnerLens.ts       # React Hook
│   ├── utils/
│   │   ├── masking.ts            # 민감정보 마스킹 (20개 패턴) ⭐
│   │   ├── log-capture.ts        # 콘솔 로그 캡처
│   │   ├── user-action-capture.ts # 클릭/입력 캡처
│   │   ├── navigation-capture.ts  # 라우팅 히스토리 캡처
│   │   ├── performance-capture.ts # Core Web Vitals 캡처
│   │   ├── session-replay.ts     # rrweb DOM 리플레이
│   │   └── styles.ts             # 위젯 스타일 생성
│   ├── server.ts                 # Self-hosted 백엔드 핸들러 ⭐
│   ├── react.ts                  # React 엔트리포인트
│   ├── vue.ts                    # Vue 엔트리포인트
│   ├── vanilla.ts                # Vanilla JS 엔트리포인트
│   ├── replay.ts                 # Session replay 엔트리포인트
│   ├── cli.ts                    # CLI (npx inner-lens init)
│   └── create.ts                 # create-inner-lens 래퍼
│
├── api/                          # Vercel Serverless Functions
│   ├── _shared.ts                # src/types + masking 복제본 ⭐
│   ├── report.ts                 # POST /api/report (Hosted API)
│   └── health.ts                 # GET /api/health
│
├── scripts/                      # AI 분석 엔진
│   ├── analyze-issue.ts          # 메인 분석 진입점 ⭐
│   ├── sync-check.ts             # Vercel 동기화 검증
│   ├── agents/                   # 분석 에이전트 시스템
│   │   ├── orchestrator.ts       # 에이전트 조율
│   │   ├── finder.ts             # 관련 파일 검색
│   │   ├── investigator.ts       # 버그 조사
│   │   ├── explainer.ts          # 분석 결과 설명
│   │   ├── reviewer.ts           # 분석 검증
│   │   └── types.ts              # 에이전트 타입
│   └── lib/                      # 분석 유틸리티
│       ├── file-discovery.ts     # 파일 검색
│       ├── code-chunking.ts      # AST-like 코드 청킹
│       ├── llm-rerank.ts         # LLM 기반 재정렬
│       ├── confidence.ts         # 신뢰도 보정
│       ├── hallucination-check.ts # 환각 검증
│       ├── comment-formatter.ts  # GitHub 코멘트 포맷팅
│       └── i18n.ts               # 다국어 지원
│
├── .github/
│   └── workflows/
│       ├── analysis-engine.yml   # AI 분석 재사용 워크플로우
│       └── test.yml              # CI 테스트
│
├── dist/                         # 빌드 출력 (git-ignored)
├── examples/                     # 예제 코드
└── docs/                         # 추가 문서
```

---

## 핵심 모듈 설명

### 1. InnerLensCore (src/core/InnerLensCore.ts)

프레임워크 무관 핵심 클래스. React/Vue/Vanilla 모두 이것을 래핑.

```typescript
class InnerLensCore {
  // 생명주기
  mount()     // DOM에 마운트, 캡처 시작
  unmount()   // 정리
  open()      // 다이얼로그 열기
  close()     // 다이얼로그 닫기
  
  // 내부 동작
  private submit()              // API 호출
  private capturePageContext()  // 페이지 컨텍스트 수집
}
```

### 2. 마스킹 시스템 (src/utils/masking.ts)

20개 정규식 패턴으로 민감정보 마스킹:

| 패턴 | 치환값 |
|------|--------|
| 이메일 | `[EMAIL_REDACTED]` |
| Bearer 토큰 | `Bearer [TOKEN_REDACTED]` |
| JWT | `[JWT_REDACTED]` |
| AWS 키 | `[AWS_KEY_REDACTED]` |
| GitHub 토큰 | `[GITHUB_TOKEN_REDACTED]` |
| OpenAI 키 | `[OPENAI_KEY_REDACTED]` |
| 신용카드 | `[CARD_REDACTED]` |
| 전화번호 | `[PHONE_REDACTED]` |
| SSN | `[SSN_REDACTED]` |
| IP 주소 | `[IP_REDACTED]` |
| ... 등 20개 패턴 |

### 3. 서버 핸들러 (src/server.ts)

다양한 프레임워크용 핸들러 제공:

```typescript
// Web Standards (Next.js App Router, Hono, Bun, Deno)
export function createFetchHandler(config): (req: Request) => Promise<Response>

// Express
export function createExpressHandler(config)

// Fastify
export function createFastifyHandler(config)

// Koa
export function createKoaHandler(config)

// Node.js HTTP
export function createNodeHandler(config)

// 공통 핵심 로직
export async function handleBugReport(body, config)
```

### 4. 분석 엔진 (scripts/analyze-issue.ts)

GitHub Issue를 분석하고 AI 코멘트를 작성:

```
1. Issue 내용 파싱
2. 에러 위치, 키워드 추출
3. 관련 파일 검색 (import graph 포함)
4. LLM 재정렬
5. 코드 컨텍스트 구성
6. AI 분석 (Chain-of-Thought)
7. 환각 검증 + 신뢰도 보정
8. GitHub 코멘트 작성
```

---

## 배포 모드

### Hosted Mode (권장)

```typescript
// 클라이언트만 설정하면 됨
<InnerLensWidget repository="owner/repo" />
```

- GitHub App 인증 (`inner-lens-app[bot]`)
- Rate limit: 10 req/min/IP
- 환경변수: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` (Vercel에서 관리)

### Self-Hosted Mode

```typescript
// 커스텀 엔드포인트 지정
<InnerLensWidget 
  endpoint="/api/inner-lens/report" 
  repository="owner/repo" 
/>
```

백엔드 구현 필요:

```typescript
// app/api/inner-lens/report/route.ts (Next.js)
import { createFetchHandler } from 'inner-lens/server';

export const POST = createFetchHandler({
  githubToken: process.env.GITHUB_TOKEN!,
  repository: 'owner/repo',
});
```

- Personal Access Token 인증
- Rate limit 없음
- 환경변수: `GITHUB_TOKEN`, `GITHUB_REPOSITORY`

---

## 코드 규칙

### ✅ 필수

1. **변경 전 관련 파일 읽기**
   - 기존 패턴/구조 파악

2. **변경 후 검증**
   ```bash
   npm run typecheck && npm run test
   ```

3. **Vercel 제약 준수**
   - `src/types.ts` 변경 시 → `api/_shared.ts` 동기화
   - `src/utils/masking.ts` 변경 시 → `api/_shared.ts` 동기화
   - `npm run sync:check` 실행

4. **테스트 작성**
   - 새 기능: 테스트 필수
   - 버그 수정: 회귀 테스트 추가

### ❌ 금지

| 항목 | 이유 |
|------|------|
| `any` 타입 | 타입 안전성 위반 |
| `@ts-ignore` / `@ts-expect-error` | 에러 무시 금지 |
| 요청하지 않은 리팩토링 | 스코프 유지 |
| `console.log` 남기기 | 프로덕션 코드 오염 |
| TODO/FIXME 주석 | 이슈 트래커 사용 |
| 직접 `fetch` 대신 핸들러 우회 | 보안/일관성 위반 |

---

## 테스트 가이드

### 파일 위치

```
src/utils/masking.ts       → src/utils/masking.test.ts
src/server.ts              → src/server.test.ts
scripts/sync-check.ts      → scripts/sync-check.test.ts
```

### 실행

```bash
npm run test                    # 전체 테스트
npm run test -- --watch         # Watch 모드
npm run test -- masking         # 특정 파일
npm run test:coverage           # 커버리지
```

### 패턴

```typescript
import { describe, it, expect, vi } from 'vitest';
import { maskSensitiveData } from './masking';

describe('maskSensitiveData', () => {
  it('should mask email addresses', () => {
    expect(maskSensitiveData('user@example.com'))
      .toBe('[EMAIL_REDACTED]');
  });
  
  it('should handle empty input', () => {
    expect(maskSensitiveData('')).toBe('');
  });
});
```

---

## npm exports

```typescript
// 클라이언트
import { InnerLensWidget, useInnerLens } from 'inner-lens/react';
import { InnerLensWidget } from 'inner-lens/vue';
import { InnerLens } from 'inner-lens/vanilla';
import { startSessionReplay, getSessionReplaySnapshot } from 'inner-lens/replay';

// 서버
import { 
  createFetchHandler,
  createExpressHandler,
  createFastifyHandler,
  createKoaHandler,
  createNodeHandler,
  handleBugReport,
  maskSensitiveData,
} from 'inner-lens/server';
```

---

## 조건부 규칙 (.claude/rules/)

특정 파일 패턴에 따라 자동 로드:

| 파일 | 적용 대상 | 내용 |
|------|----------|------|
| `typescript.md` | 모든 `.ts` | strict 타입, 코딩 스타일 |
| `testing.md` | `*.test.ts` | Vitest 패턴, 모킹 |
| `security.md` | masking, server, api | 마스킹 필수, 시크릿 관리 |
| `react.md` | components, hooks | React 패턴 |
| `api.md` | api/, server.ts | Zod 검증, 에러 응답 |

---

## 자주 묻는 질문

### Q: `api/_shared.ts`를 왜 분리했나요?

Vercel Serverless Functions는 배포 시 각 함수가 독립적으로 번들됩니다.
`src/` 폴더를 참조할 수 없어서 필요한 타입과 유틸리티를 복제합니다.

### Q: 마스킹 패턴을 추가하려면?

1. `src/utils/masking.ts`의 `MASKING_PATTERNS` 배열에 추가
2. `api/_shared.ts`에도 동일하게 추가
3. `npm run sync:check`로 동기화 확인
4. `src/utils/masking.test.ts`에 테스트 추가

### Q: 새 프레임워크 핸들러를 추가하려면?

1. `src/server.ts`에 `createXxxHandler` 함수 추가
2. `handleBugReport` 호출하는 어댑터 패턴 사용
3. README.md에 예제 추가

### Q: AI 분석 언어를 추가하려면?

1. `scripts/lib/i18n.ts`에 언어 추가
2. `src/types.ts`의 `WidgetLanguage` 타입 확장
3. `WIDGET_TEXTS` 객체에 번역 추가

---

## 버전 관리

- `v1` 태그: 안정 버전 (분석 엔진 워크플로우에서 참조)
- `main` 브랜치: 개발 버전

```bash
# v1 태그 업데이트 (main 변경 후)
git tag -f v1
git push origin v1 --force
```

---

## 문의

- **이슈**: [GitHub Issues](https://github.com/jhlee0409/inner-lens/issues)
- **기여 가이드**: [CONTRIBUTING.md](./CONTRIBUTING.md)
