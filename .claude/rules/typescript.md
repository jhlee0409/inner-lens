# TypeScript 규칙

## 타입 임포트

```typescript
// ✅ 올바름
import type { InnerLensConfig } from './types';
import { createWidget } from './core';

// ❌ 잘못됨
import { InnerLensConfig } from './types'; // 타입은 type으로 import
```

## undefined 처리

```typescript
// ✅ 올바름: split() 결과는 undefined 가능
const [parsedOwner, parsedRepo] = repository.split('/');
const owner = parsedOwner ?? '';
const repo = parsedRepo ?? '';

// ❌ 잘못됨
const [owner, repo] = repository.split('/'); // undefined 가능성 무시
```

## 옵셔널 체이닝

```typescript
// ✅ 올바름: 기본값 제공
const value = obj?.prop ?? defaultValue;
const name = user?.profile?.name ?? 'Anonymous';

// ❌ 잘못됨: undefined 타입 남음
const value = obj?.prop;
```

## 함수 리턴 타입

```typescript
// ✅ 올바름: 명시적 리턴 타입
function processData(data: RawData): ProcessedData {
  return { ... };
}

// ❌ 잘못됨: 리턴 타입 추론에 의존
function processData(data: RawData) {
  return { ... };
}
```

## 금지 사항

- `any` 타입 사용 금지
- `@ts-ignore` 사용 금지 (불가피한 경우 `@ts-expect-error` + 사유)
- `!` (non-null assertion) 남용 금지
- `as` 타입 단언 최소화

## Zod 스키마

```typescript
// ✅ 올바름: Zod로 런타임 검증
const ConfigSchema = z.object({
  repository: z.string().regex(/^[\w-]+\/[\w-]+$/),
  endpoint: z.string().url().optional(),
});

type Config = z.infer<typeof ConfigSchema>;
```
