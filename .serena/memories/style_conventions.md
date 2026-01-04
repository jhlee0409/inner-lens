# 코드 스타일 및 컨벤션

## TypeScript 규칙
- `import type { ... }` 타입 임포트 필수
- `any` 타입 사용 금지
- 함수 리턴 타입 명시적 선언
- undefined 처리: `const owner = parsedOwner ?? ''`
- Zod로 런타임 검증

## React 규칙
- 함수형 컴포넌트만 사용
- `interface` Props 정의 (type alias 지양)
- 인라인 스타일 사용 (외부 CSS 금지)
- SSR 안전성 고려 (`typeof window === 'undefined'`)

## 테스트 규칙
- `describe` → `it` 구조
- Given-When-Then 패턴
- 필수 케이스: 정상, 빈 입력, 경계값, 에러

## 금지 사항
- 요청하지 않은 리팩토링
- console.log 남기기
- TODO/FIXME 주석 (완전히 구현할 것)
- 하드코딩된 시크릿
