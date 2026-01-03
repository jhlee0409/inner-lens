# 테스트 작성

다음에 대한 테스트를 작성해주세요: $ARGUMENTS

## 테스트 원칙

### 구조
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('기능명', () => {
  beforeEach(() => {
    // 설정
  });

  describe('정상 케이스', () => {
    it('should 동작 설명', () => {
      // Given
      // When
      // Then
    });
  });

  describe('에러 케이스', () => {
    it('should throw when 조건', () => {
      // 테스트
    });
  });

  describe('엣지 케이스', () => {
    it('should handle 상황', () => {
      // 테스트
    });
  });
});
```

### 필수 테스트 케이스
- [ ] 정상 입력 → 정상 출력
- [ ] 빈 입력 처리
- [ ] 잘못된 타입 입력
- [ ] null/undefined 입력
- [ ] 경계값 테스트
- [ ] 비동기 에러 처리

### 모킹 가이드
- 외부 API: `vi.mock()`
- 타이머: `vi.useFakeTimers()`
- DOM: jsdom 환경 사용

### 파일 위치
- 소스: `src/foo.ts`
- 테스트: `src/foo.test.ts` (같은 위치)

## 완료 조건
- [ ] `npm run test` 통과
- [ ] 새 테스트 모두 통과
- [ ] 기존 테스트 깨지지 않음
