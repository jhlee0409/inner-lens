# 키워드 라우팅 테이블

요청에서 키워드를 감지하면 검색 없이 바로 해당 파일/심볼로 이동

## 마스킹/보안
```yaml
keywords: [마스킹, masking, 민감정보, sensitive, PII, 개인정보]
primary:
  file: src/utils/masking.ts
  symbol: maskSensitiveData
sync_required: [api/_shared.ts]
validator: security-validator
```

## API/페이로드
```yaml
keywords: [API, 페이로드, payload, report, 리포트, 버그리포트]
primary:
  file: api/report.ts
  symbol: handler
related:
  - file: src/server.ts
    symbol: createServer
  - file: api/_shared.ts
  - file: src/types.ts
    symbol: BugReportPayload
validators: [api-integration, type-sync-checker]
```

## 위젯/UI
```yaml
keywords: [위젯, widget, UI, 버튼, 모달, 폼]
primary:
  file: src/core/InnerLensCore.ts
  symbol: InnerLensCore
related:
  - file: src/components/InnerLensWidget.tsx
    symbol: InnerLensWidget
  - file: src/hooks/useInnerLens.ts
    symbol: useInnerLens
```

## 타입/인터페이스
```yaml
keywords: [타입, type, 인터페이스, interface, 스키마]
primary:
  file: src/types.ts
sync_required: [api/_shared.ts]
validator: type-sync-checker
```

## 로그/캡처
```yaml
keywords: [로그, log, 캡처, capture, 콘솔]
primary:
  file: src/utils/log-capture.ts
  symbol: LogCapture
related:
  - file: src/types.ts
    symbol: LogEntry
```

## 세션 리플레이
```yaml
keywords: [리플레이, replay, 녹화, recording, 세션]
primary:
  file: src/utils/session-replay.ts
  symbol: SessionReplay
```

## CLI
```yaml
keywords: [CLI, 명령어, command, 터미널]
primary:
  file: src/cli.ts
```

## AI 분석
```yaml
keywords: [분석, analyze, AI, 이슈분석, analysis]
primary:
  file: scripts/analyze-issue.ts
```

## 테스트
```yaml
keywords: [테스트, test, 검증, 커버리지]
pattern: "{target}.test.ts"
example: "masking 테스트" → src/utils/masking.test.ts
```

## 사용법
```
1. 요청에서 키워드 감지
2. 이 테이블에서 매칭
3. primary.file + primary.symbol로 find_symbol 직접 호출
4. 관련 파일은 related 참조
5. sync_required가 있으면 함께 수정 필요
```
