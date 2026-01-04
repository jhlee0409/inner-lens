# CLAUDE.md - inner-lens

## 🔴 확인 없이 주장 금지 (최우선)

**"~가 없다", "~가 부족하다", "~가 필요하다"** 말하기 전에:

1. **먼저 확인**: `Grep`, `Read`, `Glob`으로 실제로 있는지 검색
2. **결과 인용**: 확인 결과를 명시 ("확인 결과: X에 Y가 있음/없음")
3. **그 후 주장**: 확인된 사실 기반으로만 주장

```
❌ 잘못됨: "이 기능이 없네요" (확인 안 함)
✅ 올바름: "Grep으로 확인한 결과, X 파일에 해당 기능이 없습니다"
```

**위반 시**: 즉시 멈추고, 확인 후 정정

---

## 🤖 서브에이전트 선택 (의도 기반)

**키워드가 아닌 의도를 파악하여 에이전트를 선택합니다.**

### 1️⃣ Critical (반드시 직접 호출)

이 상황에서는 반드시 해당 에이전트를 먼저 호출:

| 상황 | 에이전트 | 이유 |
|------|----------|------|
| `types.ts` 또는 `_shared.ts` 수정 | `type-sync-checker` | 동기화 누락 방지 |
| `masking.ts` 또는 보안 관련 수정 | `security-validator` | 보안 검증 필수 |
| `api/` 폴더 수정 | `vercel-constraint-checker` | Vercel 제약 검증 |
| 코드 변경 완료 후 | `code-reviewer` | 품질 게이트 |
| 테스트 작성 후 | `test-quality-validator` | 커버리지 검증 |

### 2️⃣ 의도 기반 라우팅

**사용자의 의도를 파악하여 적절한 에이전트 선택:**

| 의도 | 에이전트 | 설명 |
|------|----------|------|
| **만들어줘, 구현해줘, 추가해줘** | `pm-orchestrator` | 구현 요청 → PM이 판단 |
| **고쳐줘, 안돼, 에러야** | `issue-fixer` | 문제 해결 |
| **개선해줘, 더 좋게, 빠르게** | `inner-lens-enhancer` | 개선/최적화 |
| **어떻게 해?, 가능해?, 좋을까?** | `inner-lens-architect` | 기술 자문 |
| **뭐가 필요해?, 정리해줘** | `inner-lens-planner` | 요구사항 정리 |
| **테스트 짜줘** | `test-generator` | 테스트 작성 |
| **리뷰해줘, 검토해줘** | `code-reviewer` | 코드 리뷰 |
| **이어서, 계속, 아까 하던거** | `inner-lens-task-manager` | 세션 복원 |

### 3️⃣ 폴백 규칙

**위에 해당하지 않거나 모호한 경우:**

```
모든 모호한 요청 → pm-orchestrator
pm-orchestrator가 적절한 전문가에게 위임
```

### 4️⃣ 자동 트리거 (작업 완료 시)

| 트리거 | 에이전트 | 동작 |
|--------|----------|------|
| 코드 변경 완료 | `code-reviewer` | 자동 리뷰 |
| 타입/API 변경 | `type-sync-checker` + `api-integration` | 동기화 검증 |
| 에이전트 생성/수정 | `agent-manager` | 등록 및 검증 |
| 작업 완료 | `docs-sync` | 문서 동기화 |
| Public API 변경 | `readme-sync` | README 업데이트 |
| 컨텍스트 50%+ | `context-optimizer` | 메모리 최적화 |

### 5️⃣ 네거티브 룰 (이건 아님)

| 이런 요청은 | 이 에이전트가 아님 |
|-------------|-------------------|
| 단순 질문/설명 요청 | 에이전트 불필요 (직접 답변) |
| 파일 읽기만 | 에이전트 불필요 |
| git 작업만 | `git-guardian` (다른 에이전트 아님) |

### 예시

```
사용자: "로그인 버그 수정해줘"
→ issue-fixer 자동 선택

사용자: "마스킹 패턴 추가해줘"
→ security-validator + type-sync-checker 자동 선택

사용자: "새 API 엔드포인트 만들어줘"
→ api-integration + vercel-constraint-checker + test-generator 자동 선택

사용자: "에이전트 상태 확인해줘"
→ agent-manager 자동 선택 (헬스체크 실행)

사용자: "에이전트 간 연계가 잘 되고 있는지 확인해줘"
→ agent-manager 자동 선택 (상호작용 헬스체크 + 의존성 분석)

[작업 완료 후 자동]
→ docs-sync가 변경사항 감지 후 CLAUDE.md, rules/ 자동 업데이트
```

---

## Quick Reference

```bash
npm run typecheck    # 타입 체크 (필수)
npm run test         # 테스트 (필수)
npm run dev          # 개발 서버
npm run build        # 빌드
```

**슬래시 명령어:**
- `/project:new-feature 기능명` - 새 기능 구현

> 💡 이슈 수정, 코드 리뷰, 테스트 작성은 자연어로 요청하면 위 테이블의 에이전트가 자동 선택됩니다.

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

## 프로젝트 구조

```
src/
├── types.ts              # 공유 타입 정의 ⭐
├── core/InnerLensCore.ts # 위젯 핵심 로직
├── components/           # React 컴포넌트
├── hooks/                # React 훅
├── utils/
│   └── masking.ts        # 민감정보 마스킹 ⭐
├── server.ts             # Self-hosted 백엔드
└── cli.ts                # CLI

api/
└── report.ts             # POST /api/report ⭐

scripts/
└── analyze-issue.ts      # AI 분석 엔진 ⭐
```

---

## 상세 규칙 (자동 로드)

`.claude/rules/` 디렉토리에 상세 규칙이 모듈화되어 있습니다:

| 파일 | 적용 대상 | 내용 |
|------|----------|------|
| `typescript.md` | 모든 TS 파일 | 타입 임포트, undefined 처리, 금지 사항 |
| `testing.md` | `*.test.ts` | 테스트 구조, 모킹, 필수 케이스 |
| `security.md` | masking, server, api | 마스킹 규칙, 인증, 체크리스트 |
| `react.md` | components, hooks | 컴포넌트 구조, 훅 규칙, SSR |
| `api.md` | api/, server.ts | 페이로드 검증, 에러 응답 |

> 조건부 규칙: 해당 파일 작업 시에만 컨텍스트에 로드됩니다.

---

## 일관성 체크

| 변경 시 | 함께 확인 |
|---------|-----------|
| `src/types.ts` | 모든 컴포넌트, API, 문서, **`api/_shared.ts`** |
| API 페이로드 | `api/report.ts`, `src/server.ts`, `types.ts`, **`api/_shared.ts`** |
| `src/utils/masking.ts` | **`api/_shared.ts`** (동기화 필수) |
| CLI 예시 | README.md, docs/ |

---

## 배포 모드

| 모드 | 인증 | 환경변수 |
|------|------|----------|
| Hosted | GitHub App | `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` |
| Self-Hosted | GitHub PAT | `GITHUB_TOKEN`, `GITHUB_REPOSITORY` |

---

## 가드레일

```bash
# 자율 실행
"허락 묻지 말고 끝까지 진행해"

# 확인 필요
"커밋 전에 멈춰"

# 범위 제한
"src/utils만 수정해"
```

---

## Sub-agent 활용

다음 상황에서 sub-agent 검증 요청:
- 보안 관련 (`masking.ts`, auth)
- 여러 파일 동시 수정 시 일관성
- API 페이로드 변경 시 E2E 검증

---

## 주의사항

1. **보안**: AI 처리 전 반드시 마스킹
2. **번들**: Session replay ~77KB (on-demand 로드)
3. **SSR**: 위젯은 클라이언트만
4. **⚠️ Vercel Functions 제약**: `api/` 폴더는 `src/`에서 import 불가!
   - `api/_shared.ts`에 필요한 타입/유틸 복제 유지
   - `src/types.ts` 변경 시 `api/_shared.ts` 동기화 필수
