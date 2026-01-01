# inner-lens ROADMAP

> 이 파일은 Claude Code가 자동으로 읽고 업데이트합니다.
> 체크박스: `[ ]` Todo, `[-]` In Progress, `[x]` Completed

---

## Phase 1: 즉시 수정 (P0)

### 1.1 templates/ 폴더 삭제 + README 백엔드 가이드 단순화
- [x] templates/ 폴더 삭제 ✅ 2025-12-30
- [x] README.md 백엔드 섹션 단순화 (프레임워크별 → 단일 가이드) ✅ 2025-12-30
- [x] Serverless 배포 섹션 정리 (Cloudflare/Vercel/Netlify 코드 예시만) ✅ 2025-12-30

### 1.2 InnerLensCore 편의 옵션 추가
- [x] `position` 옵션 추가 (styles.buttonPosition 매핑) ✅ 2025-12-30
- [x] `buttonColor` 옵션 추가 (styles.buttonColor 매핑) ✅ 2025-12-30
- [x] UI 텍스트 옵션 추가: `buttonText`, `dialogTitle`, `dialogDescription`, `submitText`, `cancelText`, `successMessage` ✅ 2025-12-30
- [x] examples/vanilla/index.html 업데이트 ✅ 2025-12-30
- [x] 타입 정의 업데이트 ✅ 2025-12-30

### 1.3 degit → tiged 마이그레이션
- [x] README.md에서 degit 참조 없음 (templates 삭제됨) ✅ 2025-12-30

---

## Phase 2: 중요 개선 (P1)

### 2.1 CLI UX 현대화 (Clack 도입)
- [x] @clack/prompts 의존성 추가 ✅ 2025-12-30
- [x] inquirer 의존성 제거 ✅ 2025-12-30
- [x] CLI 프롬프트 마이그레이션 ✅ 2025-12-30
- [x] 스피너/진행률 표시 개선 ✅ 2025-12-30
- [x] 취소 처리 (isCancel) 추가 ✅ 2025-12-30
- [x] 테스트 (138개 모두 통과) ✅ 2025-12-30

### 2.2 npm create inner-lens 지원
- [x] package.json bin 필드에 create-inner-lens 추가 ✅ 2025-12-30
- [x] src/create.ts 래퍼 스크립트 생성 ✅ 2025-12-30
- [x] tsup.config.ts에 create 빌드 추가 ✅ 2025-12-30
- [x] README에 사용법 추가 ✅ 2025-12-30

---

## Phase 3: UX 개선 (P2)

### 3.1 문서화 개선
- [x] Quick Start 섹션 강화 (30초 설정) ✅ 2025-12-30
- [x] 트러블슈팅 섹션 추가 ✅ 2025-12-30
- [x] FAQ 추가 ✅ 2025-12-30

### 3.2 에러 메시지 개선
- [x] GITHUB_TOKEN 미설정 에러 메시지 개선 ✅ 2025-12-30
- [x] GITHUB_REPOSITORY 형식 오류 메시지 개선 ✅ 2025-12-30
- [x] 네트워크 오류 메시지 개선 ✅ 2025-12-30
- [x] 해결 방법 + 문서 링크 포함 ✅ 2025-12-30

### 3.3 devOnly 동작 명확화
- [x] 프로덕션에서 위젯 비활성화 시 콘솔 info 메시지 추가 ✅ 2025-12-30
- [x] README에 devOnly 기본값 명시 ✅ 2025-12-30

### 3.4 GitHub Actions Reusable Workflow
- [x] 재사용 가능한 워크플로우 이미 구현됨 (analysis-engine.yml) ✅ 2025-12-30
- [x] README에 Manual Workflow Setup 가이드 추가 ✅ 2025-12-30
- [x] Reusable Workflow Options 문서화 ✅ 2025-12-30

---

## 완료된 작업

<!-- 완료된 항목은 여기로 이동 -->

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2025-12-30 | 초기 ROADMAP 생성 |
| 2025-12-30 | Phase 1 완료: templates 삭제, README 정리, 편의 옵션 추가 |
| 2025-12-30 | Phase 2.1 완료: CLI Clack 마이그레이션 (inquirer → @clack/prompts) |
| 2025-12-30 | Phase 2.2 완료: npx create-inner-lens 지원 추가 |
| 2025-12-30 | Phase 3.1-3.3 완료: 문서화 개선, 에러 메시지 개선, devOnly 명확화 |
| 2025-12-30 | Phase 3.4 완료: Reusable Workflow 문서화 |
| 2025-12-30 | **모든 Phase 완료!** 🎉 |
| 2025-12-31 | Phase 4 추가: AI 분석 엔진 개선 |
| 2026-01-01 | Phase 4.4 완료: Import 그래프 추적 (P1-1) |

---

## Phase 4: AI 분석 엔진 개선 (2025-12-31 ~)

> 2025년 Best Practices 기반 버그 분석 플로우 개선
> 참고: [LLM-based Agents for Bug Fixing](https://arxiv.org/html/2411.10213v2), [RAG for Large-Scale Code Repos](https://www.qodo.ai/blog/rag-for-large-scale-code-repos/)

### 4.0 허위/거짓 제보 필터링
- [x] `isValidReport` 필드 추가 (AnalysisResultSchema) ✅ 2025-12-31
- [x] AI 프롬프트에 Step 0: 유효성 검증 추가 ✅ 2025-12-31
- [x] Invalid 리포트용 별도 코멘트 포맷 ✅ 2025-12-31
- [x] `needs-more-info` 라벨 자동 추가 ✅ 2025-12-31

### 4.1 스택트레이스 파싱 강화 (P0-1)
- [x] Node.js/Chrome 스택트레이스 파싱 ✅ 2025-12-31
- [x] Firefox 스택트레이스 파싱 ✅ 2025-12-31
- [x] Python 스택트레이스 파싱 ✅ 2025-12-31
- [x] Webpack/번들러 경로 파싱 ✅ 2025-12-31
- [x] `extractErrorLocations()` 함수 구현 ✅ 2025-12-31
- [x] `extractErrorMessages()` 함수 구현 ✅ 2025-12-31

### 4.2 내용 기반 검색 (P0-2)
- [x] `searchFileContent()` 함수 구현 ✅ 2025-12-31
- [x] 스택트레이스 파일 매칭 (score +50) ✅ 2025-12-31
- [x] 함수명 매칭 (score +25) ✅ 2025-12-31
- [x] 에러 메시지 프래그먼트 매칭 (score +15) ✅ 2025-12-31
- [x] 키워드 매칭 (score +5 per match, max 20) ✅ 2025-12-31
- [x] 콘텐츠 스코어 2배 가중치 적용 ✅ 2025-12-31

### 4.3 에러 위치 직접 검색 (P0-3)
- [x] `readFileWithLineContext()` 함수 구현 ✅ 2025-12-31
- [x] 에러 라인 >>> 마커 표시 ✅ 2025-12-31
- [x] `buildCodeContext()` 우선순위 로직 ✅ 2025-12-31
- [x] 스택트레이스 파일 우선 로드 ✅ 2025-12-31

### 4.4 Import 그래프 추적 (P1-1)
- [x] TypeScript/JavaScript import 파싱 ✅ 2026-01-01
- [x] 관련 파일의 의존성 추적 ✅ 2026-01-01
- [x] 그래프 기반 관련 파일 확장 ✅ 2026-01-01

### 4.5 LLM Re-ranking (P1-2)
- [ ] 검색 결과를 LLM으로 재정렬
- [ ] 관련성 점수 재계산
- [ ] 컨텍스트 품질 검증

### 4.6 테스트 및 검증 (P2)
- [ ] 스택트레이스 파싱 테스트 케이스
- [ ] 내용 기반 검색 테스트
- [ ] 실제 버그 리포트로 E2E 테스트
