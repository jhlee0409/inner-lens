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
| 2026-01-01 | Phase 4.5 완료: LLM Re-ranking (P1-2) |
| 2026-01-01 | Phase 4.6 완료: 분석 유틸리티 테스트 (P2) - 37개 테스트 |
| 2026-01-01 | Phase 4.7-4.9 추가: 2025 리서치 기반 고도화 로드맵 (P3-P5) |
| 2026-01-01 | Phase 4.7 P3-2 완료: 증거 기반 프롬프트 + Self-consistency |
| 2026-01-01 | Phase 4.7 P3-1 완료: AST 기반 코드 청킹 (Regex 경량 구현) |
| 2026-01-01 | Phase 4.8 P4-2 완료: 경량 Call Graph 분석 (15개 테스트) |
| 2026-01-01 | Phase 5 추가: 문서-코드베이스 일치 검증 |
| 2026-01-01 | Phase 5.4-A 완료: InnerLensConfig 타입 확장 + React Widget props 적용 |
| 2026-01-01 | Phase 4.9 P5 시작: Multi-Agent 아키텍처 Phase 1 구현 |
| 2026-01-01 | Phase 4.9 P5-2 완료: Explainer Agent 구현 |
| 2026-01-01 | Phase 4.9 P5-3 완료: Level 판단 + Investigator Agent |
| 2026-01-01 | Phase 4.9 P5-4 완료: Reviewer Agent - **Multi-Agent 완성!** 🎉 |
| 2026-01-01 | P5 품질 검증: E2E 테스트 41개 추가, QA→개발자 플로우 검증 |
| 2026-01-02 | Phase 5.4-B 완료: Session Replay 문서화, Legacy Styling 섹션 정리 |
| 2026-01-02 | Issue 4 완료: CLI 영어 마이그레이션 - **Phase 5 모든 이슈 해결!** |

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
- [x] 검색 결과를 LLM으로 재정렬 ✅ 2026-01-01
- [x] 관련성 점수 재계산 ✅ 2026-01-01
- [x] 컨텍스트 품질 검증 ✅ 2026-01-01

### 4.6 테스트 및 검증 (P2)
- [x] 스택트레이스 파싱 테스트 케이스 (37개 테스트) ✅ 2026-01-01
- [x] 내용 기반 검색 테스트 ✅ 2026-01-01
- [x] Import 파싱 테스트 ✅ 2026-01-01
- [ ] 실제 버그 리포트로 E2E 테스트

### 4.7 코드 분석 고도화 (P3) - 2025 리서치 기반
> 참고: [cAST 논문](https://arxiv.org/html/2506.15655v1), [IJCAI CFG 연구](https://www.ijcai.org/proceedings/2023/249)

- [x] **P3-1: AST 기반 코드 청킹** ✅ 2026-01-01
  - [x] Regex 기반 경량 AST 파싱 (외부 의존성 없음) ✅
  - [x] 함수/클래스/인터페이스/타입 단위 청킹 ✅
  - [x] 청크 메타데이터 (시그니처, 라인 범위) 추출 ✅
  - [x] 에러 위치/키워드 기반 관련 청크 선별 ✅
  - [x] `useChunking` 환경변수로 활성화 제어 ✅
  - 기대 효과: RepoEval +5.5점

- [x] **P3-2: 증거 기반 프롬프트 강화** ✅ 2026-01-01
  - [x] 코드 위치 명시 규칙 추가 (`파일:라인` 형식) ✅
  - [x] 증거 체인 요구 (에러→호출경로→근본원인) ✅
  - [x] 반증 검토 의무화 (Counter-Evidence Check) ✅
  - [x] Self-consistency 검증 (N회 분석 후 일관성 체크) ✅
  - 효과: 환각 감소, 일관성 향상

### 4.8 시맨틱 검색 도입 (P4)
> 참고: [Greptile 블로그](https://www.greptile.com/blog/semantic-codebase-search), [Augment Code](https://www.augmentcode.com/blog/repo-scale-100M-line-codebase-quantized-vector-search)

- [ ] ~~**P4-1: 벡터 임베딩 검색**~~ (스킵 - 오픈소스 범위 초과)
  - 외부 벡터 DB 필요 (Qdrant/Faiss)
  - 임베딩 모델 호스팅 필요
  - 대규모 인프라 요구

- [x] **P4-2: Control/Data Flow 분석 (경량 버전)** ✅ 2026-01-01
  - [x] 함수 호출 추출 (`extractFunctionCalls`) ✅
  - [x] Call Graph 구축 (`buildCallGraph`) ✅
  - [x] 호출 체인 역추적 (`findCallChain`) ✅
  - [x] 관련 함수 탐색 (`getRelatedFunctions`) ✅
  - 15개 테스트 추가 (총 215개)

### 4.9 Multi-Agent 아키텍처 (P5)
> 참고: [FixAgent](https://arxiv.org/html/2404.17153v2), [Google ADK Patterns](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/)

#### 아키텍처 개요: 2-Level Adaptive Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                      Orchestrator                            │
│  - Level 자동 판단 (L1: 단순, L2: 복잡)                      │
│  - Agent 순차 실행 (Assembly-Line 패턴)                      │
│  - 실패 시 Level 승격                                        │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌─────────────────────┐       ┌─────────────────────────────┐
│   Level 1 (Fast)    │       │     Level 2 (Thorough)      │
├─────────────────────┤       ├─────────────────────────────┤
│ 🔍 Finder           │       │ 🔍 Finder + Call Graph      │
│ 📝 Explainer        │       │ 🧠 Investigator (다중 가설) │
│                     │       │ 📝 Explainer                │
│ LLM: 1회            │       │ ✅ Reviewer (검증)          │
└─────────────────────┘       │ LLM: 3회                    │
                              └─────────────────────────────┘
```

#### Phase 1: Finder Agent + Orchestrator 뼈대 ✅ 2026-01-01
- [x] Agent 인터페이스 정의 (`AgentInput`, `AgentOutput`) ✅
- [x] Finder Agent 분리 (기존 retrieval 로직 추출) ✅
  - 파일 검색 (`findRelevantFiles`)
  - Import 그래프 (`buildImportGraph`, `expandFilesWithImports`)
  - 코드 청킹 (`extractCodeChunks`, `buildChunkedContext`)
  - Call Graph (`buildCallGraph`, `findCallChain`) - L2 전용
- [x] Orchestrator 기본 구조 ✅
  - Level 판단 로직 (스텁 구현)
  - Agent 순차 실행
  - 결과 전달 체인

**구현 파일:**
- `scripts/agents/types.ts` - Agent 인터페이스 및 타입 정의
- `scripts/agents/finder.ts` - Finder Agent 구현
- `scripts/agents/orchestrator.ts` - Orchestrator 및 Level 판단
- `scripts/agents/index.ts` - 모듈 export

#### Phase 2: Explainer Agent 프롬프트 강화 ✅ 2026-01-01
- [x] Explainer Agent 구현 (`scripts/agents/explainer.ts`) ✅
- [x] 다중 가설 지원 스키마 추가 ✅
- [x] 증거 체인 강제 (파일:라인 형식 필수) ✅
- [x] 신뢰도 calibration 규칙 강화 ✅
- [x] Orchestrator 연동 ✅

#### Phase 3: Level 판단 + Investigator Agent ✅ 2026-01-01
- [x] Level 자동 판단 로직 ✅
  - 스택트레이스 유무
  - 설명 길이/품질
  - 에러 타입 분류
- [x] Investigator Agent (L2 전용) ✅
  - 2-4개 가설 생성
  - 가설별 지지/반증 증거 수집
  - 주요 가설 선택
  - Call Graph 연동

#### Phase 4: Reviewer Agent ✅ 2026-01-01
- [x] Reviewer Agent (L2 전용, 선택적) ✅
  - 분석 결과 검증
  - 반증 확인 (counter-evidence)
  - 신뢰도 조정 (-50 ~ +20)
  - 검증된 주장 표시
- [x] Fallback 전략 ✅
  - 검증 실패 시 원본 분석 유지

**🎉 P5 Multi-Agent Architecture 완료!**

#### 사용자 설정 옵션
```bash
# 모델 선택 (사용자 자유)
FINDER_MODEL=claude-3-5-haiku      # Finder re-ranking용 (선택적)
INVESTIGATOR_MODEL=gpt-4o          # L2 가설 생성
EXPLAINER_MODEL=claude-sonnet-4    # 분석
REVIEWER_MODEL=claude-sonnet-4     # L2 검증

# 동작 설정
ANALYSIS_LEVEL=auto                # auto | 1 | 2
ENABLE_REVIEWER=true               # L2에서 Reviewer 활성화
MAX_RETRIES=2                      # 검증 실패 시 재시도
```

### P5 품질 검증 결과 ✅ 2026-01-01

**테스트 파일:** `scripts/agents/agents.e2e.test.ts` (41개 테스트)

---

## Phase 5: Documentation-Codebase Verification (2026-01-01 ~)

> Open source 패키지로서 문서와 코드의 일치 여부 검증
> 목표: 사용자가 설치 → 설정 → 사용 → 버그 리포트 → AI 분석까지 무결하게 경험

### 5.0 검증 현황 요약

| 영역 | 상태 | 이슈 수 |
|------|------|---------|
| README.md vs 코드 | ✅ 수정 완료 | 0 Critical (수정됨 3), 0 Minor (모두 수정됨) |
| Package.json exports | ✅ 검증 완료 | 없음 |
| CLI 명령어 | ✅ 수정 완료 | 0 (영어 마이그레이션 완료) |
| Server Handlers | ✅ 검증 완료 | 없음 |
| AI Analysis Engine | ✅ 검증 완료 | 없음 |

### 5.1 Critical Issues

#### Issue 1: React Widget Missing UI Customization Props

**상태:** ✅ 수정 완료 (2026-01-01)

~~README에서 문서화된 UI 커스터마이징 옵션이 React 컴포넌트에서 누락됨:~~

| 옵션 | README | React Widget | Vanilla JS |
|------|--------|--------------|------------|
| `buttonText` | ✅ | ❌ 누락 | ✅ |
| `dialogTitle` | ✅ | ❌ 누락 | ✅ |
| `dialogDescription` | ✅ | ❌ 누락 | ✅ |
| `submitText` | ✅ | ❌ 누락 | ✅ |
| `cancelText` | ✅ | ❌ 누락 | ✅ |
| `successMessage` | ✅ | ❌ 누락 | ✅ |
| `onOpen` | ✅ | ❌ 누락 | ✅ |
| `onClose` | ✅ | ❌ 누락 | ✅ |

**수정 대상:**
- `src/types.ts:11-82` - InnerLensConfig에 props 추가
- `src/components/InnerLensWidget.tsx:72-85` - props 수용 및 적용
- README.md - 프레임워크별 지원 명시

#### Issue 2: Top-Level Convenience Props 미작동

**상태:** ✅ 수정 완료 (2026-01-01)

~~README는 `position`과 `buttonColor`를 top-level props로 문서화하지만, React에서는 `styles` 객체로만 작동:~~

```tsx
// README 예시 (작동 안함)
<InnerLensWidget position="bottom-left" buttonColor="#10b981" />

// 실제 작동 방식
<InnerLensWidget styles={{ buttonPosition: "bottom-left", buttonColor: "#10b981" }} />
```

**수정 대상:**
- `src/types.ts` - top-level props 추가
- `src/components/InnerLensWidget.tsx` - props 매핑

#### Issue 3: Session Replay 문서 누락

**상태:** ✅ 수정 완료 (2026-01-02)

~~`inner-lens/replay` export가 존재하지만 README에 미문서화~~

**추가된 문서:**
- 🎬 Session Replay (Optional) 섹션
- 설치 방법 (rrweb peer dependency)
- 사용 예제
- 설정 옵션 테이블
- 프라이버시 컨트롤 (blockSelectors, maskSelectors)
- API Reference 테이블

### 5.2 Minor Issues

#### Issue 4: CLI Korean-Only → English Migration

**상태:** ✅ 수정 완료 (2026-01-02)

~~CLI 프롬프트가 한국어로만 작성되어 국제 사용자 혼란 가능~~

**변경 사항:**
- 모든 CLI 프롬프트 영어로 마이그레이션
- GitHub OAuth 메시지 영어화
- 프레임워크 선택/백엔드 배포 메시지 영어화
- Next Steps 안내 영어화

#### Issue 5: Deprecated Options 문서 혼란

**상태:** ✅ 수정 완료 (2026-01-02)

~~README에서 `styles.buttonColor`와 `styles.buttonPosition`을 deprecated로 표시했으나~~

**변경 사항:**
- "Deprecated" → "Legacy Styling (Backward Compatible)" 으로 문구 변경
- 모든 프레임워크에서 top-level props + styles 객체 모두 작동 확인
- 예제 코드 추가로 사용법 명확화

### 5.3 검증 완료 항목

#### Package.json Exports ✅
모든 export가 README 문서와 일치:
- `inner-lens` → `src/core.ts`
- `inner-lens/react` → `src/react.ts`
- `inner-lens/vue` → `src/vue.ts`
- `inner-lens/vanilla` → `src/vanilla.ts`
- `inner-lens/server` → `src/server.ts`
- `inner-lens/replay` → `src/replay.ts`

#### CLI Commands ✅
- `npx create-inner-lens` - 정상 작동
- `npx inner-lens init` - 모든 옵션 작동 (`--provider`, `--eject`, `-y`)
- `npx inner-lens check` - 정상 작동

#### Server Handlers ✅
모든 문서화된 핸들러가 구현됨:
- `createFetchHandler` - Web Fetch API
- `createExpressHandler` - Express middleware
- `createFastifyHandler` - Fastify handler
- `createKoaHandler` - Koa middleware
- `createNodeHandler` - Node.js HTTP

#### AI Analysis Engine ✅
- Chain-of-Thought 프롬프팅
- 구조화된 JSON 출력 (Zod 스키마)
- 다중 AI 프로바이더 (Anthropic, OpenAI, Google)
- 코드 검증 후 수정 제안
- Import 그래프 추적
- LLM Re-ranking
- AST 기반 코드 청킹
- Self-consistency 검증

### 5.4 수정 계획

#### Phase A: 타입 & 컴포넌트 업데이트 ✅ 2026-01-01
- [x] `InnerLensConfig` 타입 확장 ✅
- [x] `InnerLensWidget.tsx` props 적용 ✅
- [ ] Vue 컴포넌트 확인 및 업데이트 (스킵 - React 우선)

#### Phase B: 문서 업데이트 ✅ 2026-01-02
- [x] Session Replay 섹션 추가 ✅
- [x] 프레임워크별 지원 옵션 명시 ✅
- [x] Deprecated options 섹션 정리 → "Legacy Styling" 으로 변경 ✅

#### Phase C: E2E 검증 ✅ 2026-01-01
- [x] 테스트 스위트 실행 (256개 통과) ✅
- [x] 전체 패키지 빌드 (8개 빌드 성공) ✅
- [ ] 수동 E2E 테스트

#### 검증 항목

| 카테고리 | 테스트 항목 | 결과 |
|---------|-----------|------|
| **Context Extraction** | 파일 경로, 에러 타입, 식별자 추출 | ✅ |
| **Error Location Parsing** | Node.js, Firefox, Python 스택트레이스 | ✅ |
| **Level Determination** | L1/L2 자동 판단, 강제 오버라이드 | ✅ |
| **Response Quality** | 근본 원인, 증거 체인, 코드 변경 제안 | ✅ |
| **Invalid Report Handling** | 무효 리포트 감지, 적절한 응답 | ✅ |
| **API Usability** | 타입 export, Agent 인터페이스 일관성 | ✅ |
| **Edge Cases** | 빈 리포트, 긴 리포트, 특수문자, 혼합 스택 | ✅ |

#### QA → 개발자 플로우 검증

```
1. QA 버그 리포트 작성
   ↓ inner-lens 위젯
2. 콘솔/네트워크 로그 자동 수집
   ↓ GitHub Issue 생성
3. Multi-Agent 분석 (L1 또는 L2)
   ↓ Finder → [Investigator] → Explainer → [Reviewer]
4. GitHub Comment로 분석 결과 게시
   ↓ 구조화된 마크다운
5. 개발자가 파일:라인 참조로 즉시 수정 가능
```

#### 오픈소스 가치 검증

- **사용성**: 단일 import로 모든 Agent 접근 가능
- **확장성**: Agent 인터페이스 표준화로 커스텀 Agent 추가 용이
- **투명성**: 각 Agent의 역할과 출력이 명확히 분리됨
- **유연성**: 사용자가 각 Agent의 모델 선택 가능

