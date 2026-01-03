---
paths:
  - "src/components/**/*.tsx"
  - "src/hooks/**/*.ts"
---

# React 규칙

## 컴포넌트 구조

```typescript
import type { ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export function Button({
  children,
  onClick,
  disabled = false
}: ButtonProps): JSX.Element {
  return (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
```

## 훅 규칙

```typescript
// ✅ use* 접두사 필수
export function useInnerLens(config: Config) {
  const [state, setState] = useState<State>(initialState);

  useEffect(() => {
    // 클린업 필수
    return () => cleanup();
  }, [dependencies]);

  return { state, actions };
}
```

## Props 타입

```typescript
// ✅ interface 사용 (확장 가능)
interface WidgetProps {
  config: InnerLensConfig;
  onSubmit?: (report: BugReport) => void;
}

// ❌ type alias 지양 (복잡한 경우 제외)
type WidgetProps = { ... };
```

## 스타일링

```typescript
// ✅ 인라인 스타일 (번들 최소화)
const styles = {
  container: {
    display: 'flex',
    padding: '16px',
  } as const,
};

// ❌ 외부 CSS 파일 금지
import './Widget.css';
```

## 이벤트 핸들러

```typescript
// ✅ 타입 명시
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.preventDefault();
  // ...
};

// ✅ useCallback (의존성 있는 경우)
const handleSubmit = useCallback(() => {
  submitReport(report);
}, [report]);
```

## SSR 안전

```typescript
// ✅ 클라이언트 전용 렌더링
if (typeof window === 'undefined') {
  return null;
}

// 또는 useEffect에서 초기화
useEffect(() => {
  // 브라우저 전용 로직
}, []);
```

## 금지 사항

- `any` props 타입
- 인라인 함수 남용 (렌더링마다 재생성)
- `dangerouslySetInnerHTML` (XSS 위험)
- `useEffect` 의존성 배열 누락
