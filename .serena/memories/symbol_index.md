# 심볼 인덱스

## 핵심 타입 (src/types.ts)
| 심볼 | 종류 | 설명 |
|------|------|------|
| InnerLensConfig | interface | 위젯 설정 |
| BugReportPayload | interface | API 페이로드 |
| HostedBugReportPayload | interface | Hosted 모드 페이로드 |
| LogEntry | interface | 로그 항목 |
| HOSTED_API_ENDPOINT | const | API 엔드포인트 |
| MAX_LOG_ENTRIES | const | 최대 로그 수 |

## 핵심 클래스/함수
| 심볼 | 파일 | 설명 |
|------|------|------|
| InnerLensCore | src/core/InnerLensCore.ts | 위젯 핵심 클래스 |
| maskSensitiveData | src/utils/masking.ts | 민감정보 마스킹 |
| handler | api/report.ts | API 핸들러 |
| formatIssueBody | api/report.ts | 이슈 본문 포맷팅 |

## 훅/컴포넌트
| 심볼 | 파일 | 설명 |
|------|------|------|
| InnerLensWidget | src/components/InnerLensWidget.tsx | React 위젯 |
| useInnerLens | src/hooks/useInnerLens.ts | React 훅 |
