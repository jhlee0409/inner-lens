# 작업 완료 체크리스트

## 변경 후 필수 실행
1. `npm run typecheck` - 타입 체크 통과
2. `npm run test` - 테스트 통과

## 변경 시 일관성 확인
| 변경 시 | 함께 확인 |
|---------|-----------|
| `src/types.ts` | 모든 컴포넌트, API, 문서, `api/_shared.ts` |
| API 페이로드 | `api/report.ts`, `src/server.ts`, `types.ts`, `api/_shared.ts` |
| `src/utils/masking.ts` | `api/_shared.ts` (동기화 필수) |
| CLI 예시 | README.md, docs/ |

## 보안 검토 필수 파일
- `src/utils/masking.ts`
- `api/report.ts`
- `src/server.ts`

## 커밋 전 확인
- [ ] 타입 체크 통과
- [ ] 테스트 통과
- [ ] console.log 제거
- [ ] 하드코딩된 시크릿 없음
