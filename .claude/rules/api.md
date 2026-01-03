---
paths:
  - "api/**/*.ts"
  - "src/server.ts"
---

# API 규칙

## 페이로드 검증

```typescript
import { z } from 'zod';

// ✅ Zod 스키마로 검증
const BugReportSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  title: z.string().min(1).max(256),
  description: z.string(),
  logs: z.array(LogEntrySchema).optional(),
});

export async function handler(req: Request) {
  const body = await req.json();
  const result = BugReportSchema.safeParse(body);

  if (!result.success) {
    return new Response(
      JSON.stringify({ error: result.error.flatten() }),
      { status: 400 }
    );
  }

  // result.data 사용
}
```

## 에러 응답

```typescript
// ✅ 일관된 에러 형식
interface ErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}

// 상태 코드 가이드
// 400: 잘못된 요청 (검증 실패)
// 401: 인증 필요
// 403: 권한 없음
// 404: 리소스 없음
// 429: Rate limit 초과
// 500: 서버 에러
```

## Repository 파싱

```typescript
// ✅ 올바른 파싱
function parseRepository(repository: string): { owner: string; repo: string } {
  const [parsedOwner, parsedRepo] = repository.split('/');
  const owner = parsedOwner ?? '';
  const repo = parsedRepo ?? '';

  if (!owner || !repo) {
    throw new Error('Invalid repository format. Expected: owner/repo');
  }

  return { owner, repo };
}
```

## 데이터 흐름

```
Client Request
  ↓
Zod Validation (400 on fail)
  ↓
Auth Check (401/403 on fail)
  ↓
Rate Limit Check (429 on fail)
  ↓
Business Logic
  ↓
GitHub API Call
  ↓
Response
```

## Hosted vs Self-Hosted

| 항목 | Hosted | Self-Hosted |
|------|--------|-------------|
| 인증 | GitHub App | GitHub PAT |
| owner/repo | 페이로드에서 | config에서 |
| Rate Limit | 10 req/min/IP | 사용자 설정 |

## 변경 시 체크리스트

- [ ] `api/report.ts` ↔ `src/server.ts` 동기화
- [ ] `src/types.ts` (BugReportPayload) 업데이트
- [ ] Zod 스키마 업데이트
- [ ] README.md API 문서 업데이트
