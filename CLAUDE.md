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
| `src/types.ts` | 모든 컴포넌트, API, 문서 |
| API 페이로드 | `api/report.ts`, `src/server.ts`, `types.ts` |
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
