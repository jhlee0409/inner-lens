# 작업별 파일 그룹

작업 유형별로 필요한 파일을 미리 정의

## 버그 수정 (bug-fix)
```yaml
approach:
  1. 에러 메시지/스택트레이스에서 파일 위치 파악
  2. keyword_routing에서 관련 파일 확인
  3. find_symbol로 해당 함수만 읽기
common_validators: [code-reviewer, test-generator]
```

## 타입 변경 (type-change)
```yaml
must_modify:
  - src/types.ts
  - api/_shared.ts  # 동기화 필수!
must_check:
  - api/report.ts (BugReportPayload 사용)
  - src/server.ts (타입 사용)
  - src/core/InnerLensCore.ts (InnerLensConfig 사용)
validators: [type-sync-checker]
warning: "src/types.ts 변경 시 api/_shared.ts 동기화 필수!"
```

## API 변경 (api-change)
```yaml
must_modify:
  - api/report.ts
  - api/_shared.ts
must_check:
  - src/server.ts (Self-hosted 모드)
  - src/types.ts (페이로드 타입)
  - README.md (API 문서)
validators: [api-integration, vercel-constraint-checker]
warning: "api/는 src/에서 import 불가!"
```

## 보안 변경 (security-change)
```yaml
must_modify:
  - src/utils/masking.ts
must_sync:
  - api/_shared.ts (마스킹 함수 복제)
must_review:
  - 새 데이터 필드에 마스킹 필요 여부
  - 에러 메시지에 민감정보 노출 여부
validators: [security-validator]
warning: "AI 처리 전 반드시 마스킹!"
```

## 위젯 기능 추가 (widget-feature)
```yaml
must_modify:
  - src/core/InnerLensCore.ts
may_modify:
  - src/components/InnerLensWidget.tsx (React)
  - src/hooks/useInnerLens.ts (React hook)
  - src/types.ts (새 옵션 추가 시)
must_check:
  - SSR 안전성 (typeof window)
  - 번들 크기 영향
validators: [i18n-validator]
```

## UI 텍스트 변경 (ui-text)
```yaml
must_modify:
  - src/types.ts (WIDGET_TEXTS)
must_ensure:
  - 5개 언어 모두 추가 (en, ko, ja, zh, es)
  - UI 텍스트는 영어
  - 주석만 한글 허용
validators: [i18n-validator]
```

## 새 유틸리티 추가 (new-util)
```yaml
location: src/utils/
naming: kebab-case.ts
must_create:
  - src/utils/{name}.ts
  - src/utils/{name}.test.ts
export_from:
  - 필요시 src/core.ts에서 export
```

## 테스트 추가 (add-test)
```yaml
location: 소스 파일과 같은 디렉토리
naming: {source}.test.ts
structure:
  - describe → it
  - Given-When-Then
필수_케이스:
  - 정상 입력
  - 빈 입력 ([], '', null, undefined)
  - 경계값 (0, -1, MAX)
  - 에러 케이스
validators: [test-quality-validator]
```

## 문서 업데이트 (docs-update)
```yaml
files:
  - README.md (사용자용)
  - CLAUDE.md (개발자용)
  - docs/ (상세 문서)
triggers:
  - API 변경
  - 새 기능 추가
  - 설정 옵션 추가
validators: [docs-sync, readme-sync]
```

## 사용법
```
1. 작업 유형 파악
2. 이 테이블에서 해당 그룹 확인
3. must_modify 파일들 우선 확인
4. must_check로 영향도 파악
5. validators로 검증
```
