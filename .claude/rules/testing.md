---
paths:
  - "**/*.test.ts"
  - "**/*.spec.ts"
---

# 테스트 규칙

## 파일 구조

```
src/foo.ts       → src/foo.test.ts
src/utils/bar.ts → src/utils/bar.test.ts
```

## 기본 구조

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('모듈/함수명', () => {
  beforeEach(() => {
    // 설정
  });

  afterEach(() => {
    // 정리
  });

  describe('정상 케이스', () => {
    it('should 동작 설명', () => {
      // Given
      const input = createTestInput();

      // When
      const result = targetFunction(input);

      // Then
      expect(result).toEqual(expected);
    });
  });

  describe('에러 케이스', () => {
    it('should throw when 조건', () => {
      expect(() => targetFunction(invalidInput)).toThrow();
    });
  });

  describe('엣지 케이스', () => {
    it('should handle empty input', () => {
      expect(targetFunction([])).toEqual([]);
    });
  });
});
```

## 필수 테스트 케이스

- [ ] 정상 입력 → 정상 출력
- [ ] 빈 입력 ([], '', null, undefined)
- [ ] 경계값 (0, -1, MAX_VALUE)
- [ ] 잘못된 타입/형식
- [ ] 비동기 에러 처리

## 모킹

```typescript
// 외부 모듈 모킹
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    issues: { create: vi.fn() }
  }))
}));

// 함수 스파이
const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

// 타이머 모킹
vi.useFakeTimers();
vi.advanceTimersByTime(1000);
vi.useRealTimers();
```

## jsdom 환경

```typescript
// DOM 테스트 시
const container = document.createElement('div');
document.body.appendChild(container);

// 정리 필수
afterEach(() => {
  document.body.innerHTML = '';
});
```

## 금지 사항

- 실제 네트워크 요청 (모킹 필수)
- 실제 파일 시스템 접근
- 테스트 간 상태 공유
- `console.log` 디버깅 코드 남기기
