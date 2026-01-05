# CLAUDE.md - inner-lens

## 프로젝트 개요

**inner-lens**: AI 기반 버그 분석 QA 에이전트

```
Widget → 데이터 캡처 → 마스킹 → GitHub Issue → AI 분석
```

| 스택 | 기술 |
|------|------|
| Build | tsup (ESM + CJS) |
| Test | Vitest + jsdom |
| Validation | Zod |

---

## 명령어

```bash
npm run typecheck    # 타입 체크 (필수)
npm run test         # 테스트 (필수)
npm run sync:check   # Vercel 동기화 검증
npm run build        # 빌드
```

---

## ⚠️ Vercel 제약 (Critical)

**`api/` 폴더는 `src/`에서 import 불가!**

```
src/types.ts ──복제──▶ api/_shared.ts
src/utils/masking.ts ──복제──▶ api/_shared.ts
```

| 변경 시 | 동기화 대상 |
|---------|-------------|
| `src/types.ts` | `api/_shared.ts` |
| `src/utils/masking.ts` | `api/_shared.ts` |
| API 페이로드 | `api/report.ts` + `src/server.ts` |

**검증**: `npm run sync:check`

---

## 핵심 파일

```
src/
├── types.ts              # 공유 타입 ⭐
├── core/InnerLensCore.ts # 위젯 핵심
├── utils/masking.ts      # 민감정보 마스킹 ⭐
├── server.ts             # Self-hosted 백엔드
api/
├── _shared.ts            # 복제된 타입/유틸 ⭐
└── report.ts             # Hosted API
scripts/
└── analyze-issue.ts      # AI 분석 엔진
```

---

## 규칙

### ✅ 필수
- 변경 전 관련 파일 읽기
- 변경 후 `npm run typecheck && npm run test`
- 기존 패턴 따르기

### ❌ 금지
- `any` 타입
- 요청하지 않은 리팩토링
- console.log 남기기
- TODO/FIXME 주석

---

## 배포 모드

| 모드 | 인증 | 환경변수 |
|------|------|----------|
| Hosted | GitHub App | `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` |
| Self-Hosted | PAT | `GITHUB_TOKEN`, `GITHUB_REPOSITORY` |

---

## 상세 규칙

`.claude/rules/`에서 조건부 로드:

| 파일 | 적용 대상 |
|------|----------|
| `typescript.md` | 모든 TS |
| `testing.md` | `*.test.ts` |
| `security.md` | masking, server, api |
| `react.md` | components, hooks |
| `api.md` | api/, server.ts |
