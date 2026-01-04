# LLM 분석 엔진 설계 연구 보고서 (2025년 기준)

> 연구 일자: 2025-01-04
> 대상: inner-lens 분석 엔진 개선

---

## Executive Summary

2025년 LLM 코드 분석 분야는 **Agentic RAG**, **AST 기반 시맨틱 청킹**, **다중 에이전트 협업**이 핵심 트렌드입니다. inner-lens는 이미 LLM 재랭킹, 코드 청킹, Self-Consistency 검증 등 일부 기법을 도입했으나, **정확한 파일 타겟팅**과 **아키텍처 인식** 측면에서 개선 여지가 있습니다.

**핵심 개선 방향:**
1. **AST 기반 진짜 시맨틱 파싱** (현재 Regex 기반)
2. **Multi-hop Agentic 검색** (현재 단일 패스)
3. **아키텍처 인식 컨텍스트** (Form → API → Schema 체인 추적)
4. **신뢰도 보정 강화** (위치 불확실 시 자동 하향)

---

## 1. 2025년 LLM 코드 분석 트렌드

### 1.1 Agentic RAG 아키텍처

기존 RAG의 한계를 넘어 **자율 에이전트**가 검색 전략을 동적으로 관리합니다.

| 구분 | Traditional RAG | Agentic RAG |
|------|-----------------|-------------|
| 검색 | 단일 쿼리 → 결과 | 계획 → 다중 검색 → 검증 → 반복 |
| 도구 | Vector DB만 | Vector + Grep + AST + Web |
| 반복 | 없음 | Self-reflection 기반 재시도 |

**핵심 패턴:**
- **Reflection**: 자기 결정 평가 및 오류 수정
- **Planning**: 하위 작업 분해 및 순서 결정
- **Tool Use**: 상황별 최적 도구 선택 (RAG/SQL/Code Interpreter)
- **Multi-agent Collaboration**: 전문 에이전트 협업

> **Sources:** [Agentic RAG Survey (arXiv)](https://arxiv.org/abs/2501.09136), [LlamaIndex Blog](https://www.llamaindex.ai/blog/rag-is-dead-long-live-agentic-retrieval)

### 1.2 AST 기반 코드 청킹 (HASTE Framework)

단순 텍스트 분할 대신 **Abstract Syntax Tree** 기반 의미 단위 청킹:

```
Text Chunking: 500 tokens씩 무작위 분할
     ↓ 문제: 함수 중간에서 잘림, 컨텍스트 손실

AST Chunking: function/class/interface 단위 분할
     ↓ 장점: 구조적 완전성, 실행 가능한 코드 블록
```

**HASTE 성과:**
- 85% 코드 압축 달성
- 자동 코드 편집 성공률 대폭 향상
- 모델 할루시네이션 감소

> **Sources:** [HASTE (ICLR 2026)](https://openreview.net/forum?id=ao7VBbvWIK), [Qodo RAG](https://www.qodo.ai/blog/rag-for-large-scale-code-repos/)

### 1.3 정확도 향상 기법 (2025 SOTA)

| 기법 | 효과 | 적용 대상 |
|------|------|-----------|
| **Fine-tuning** | +40% (42.5% → 84.8%) | Mistral-7B |
| **CoT + Few-shot** | F1 0.883 | 버그 분류 |
| **Self-Validation** | 일관성 향상 | 응답 검증 |
| **LLM + Static Analysis** | 실제 Linux 버그 4개 발견 | LLift Framework |
| **Multi-run Majority Voting** | 확률적 변동 감소 | 모든 분석 |

> **Sources:** [Meta LLM Bug Catchers](https://engineering.fb.com/2025/02/05/security/revolutionizing-software-testing-llm-powered-bug-catchers-meta-ach/), [LLift (OOPSLA)](https://dl.acm.org/doi/10.1145/3649828)

---

## 2. inner-lens 현재 아키텍처 분석

### 2.1 현재 구현 (analyze-issue.ts)

```
┌─────────────────────────────────────────────────────────┐
│                    inner-lens v2                        │
├─────────────────────────────────────────────────────────┤
│ 1. 키워드 추출 (extractKeywords)                        │
│    - 에러 메시지, 스택 트레이스 파싱                    │
│    - 함수명/클래스명 추출                               │
│                                                         │
│ 2. 파일 검색 (findRelevantFiles)                        │
│    - 키워드 기반 relevance scoring                      │
│    - import graph 확장                                  │
│                                                         │
│ 3. LLM 재랭킹 (rerankFilesWithLLM)                      │
│    - 저렴한 모델(Haiku/Nano)로 파일 순위 조정           │
│    - 70% LLM + 30% original 블렌딩                      │
│                                                         │
│ 4. 코드 청킹 (extractCodeChunks)                        │
│    - Regex 기반 function/class/interface 추출           │
│    - 에러 라인과 키워드 매칭으로 관련 청크 선택         │
│                                                         │
│ 5. LLM 분석 (generateObject)                            │
│    - Chain-of-Thought 프롬프트                          │
│    - Structured JSON 출력 (Zod 스키마)                  │
│    - Self-Consistency (다중 실행 → 일관성 검증)         │
│                                                         │
│ 6. 신뢰도 보정                                          │
│    - 증거 품질 기반 점수 가이드라인                     │
│    - Counter-Evidence Check 지시                        │
└─────────────────────────────────────────────────────────┘
```

### 2.2 현재 강점

| 기능 | 상태 | 평가 |
|------|------|------|
| LLM 재랭킹 | ✅ 구현됨 | 좋음 - 2단계 검색 |
| 코드 청킹 | ⚠️ Regex 기반 | 개선 필요 |
| Self-Consistency | ✅ 구현됨 | 좋음 - 다중 실행 |
| CoT 프롬프트 | ✅ 구현됨 | 좋음 |
| 신뢰도 가이드라인 | ✅ 프롬프트에 명시 | 시행 불완전 |
| Import Graph | ✅ 구현됨 | 좋음 |

### 2.3 QA 피드백에서 발견된 문제

**문제 사례:** "멤버 추가 시 이름 유효성 검사 누락"
- **봇 제안:** `hooks/useAnalytics.ts` 수정 (분석 전용 파일)
- **실제 위치:** Form 컴포넌트 또는 API 라우트
- **결과:** 잘못된 파일에 비즈니스 로직 추가 제안 (SoC 위반)

**근본 원인:**
1. 아키텍처 패턴 무인식 (Analytics ≠ Business Logic)
2. Form → API → Schema 체인 추적 부재
3. 위치 불확실해도 높은 신뢰도(85%) 유지

---

## 3. 개선 제안

### 3.1 🔴 Critical: AST 기반 시맨틱 파싱 도입

**현재 문제:** Regex 기반 추출은 중첩 구조, 복잡한 표현식에서 실패

**개선안:** tree-sitter 기반 진짜 AST 파싱

```typescript
// Before (현재)
function extractCodeChunks(content: string): CodeChunk[] {
  // Regex patterns - 제한적
  const patterns = [
    { regex: /^export\s+(async\s+)?function\s+(\w+)\s*\(/m, ... },
  ];
}

// After (개선)
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';

function extractCodeChunks(content: string, language: string): CodeChunk[] {
  const parser = new Parser();
  parser.setLanguage(TypeScript.tsx);

  const tree = parser.parse(content);
  return traverseAST(tree.rootNode);
}
```

**기대 효과:**
- 구조적 완전성 보장
- 다중 언어 지원 용이
- 청크 품질 향상 → 분석 정확도 향상

### 3.2 🔴 Critical: 아키텍처 인식 컨텍스트

**현재 문제:** 파일 역할(UI/Logic/API/Schema)을 구분하지 않음

**개선안:** 파일 역할 분류 + 연관 체인 추적

```typescript
interface FileRole {
  type: 'component' | 'hook' | 'api' | 'schema' | 'util' | 'config' | 'test';
  patterns: string[];
  relatedRoles: string[]; // Form → API → Schema 체인
}

const FILE_ROLES: FileRole[] = [
  {
    type: 'component',
    patterns: ['components/**', 'app/**/page.tsx'],
    relatedRoles: ['hook', 'api', 'schema']  // 관련 파일도 함께 검색
  },
  {
    type: 'hook',
    patterns: ['hooks/**', '**/use*.ts'],
    relatedRoles: [] // 훅은 주로 독립적
  },
  {
    type: 'api',
    patterns: ['api/**', 'app/api/**'],
    relatedRoles: ['schema', 'util']
  },
  // ...
];

// 분석 시 역할 기반 필터링
function filterByRelevantRoles(files: FileInfo[], bugType: string): FileInfo[] {
  // "유효성 검사 누락" → component, api, schema 우선
  // "렌더링 오류" → component, hook 우선
  // "분석/추적" 관련 파일은 비즈니스 로직에서 제외
}
```

### 3.3 🟡 Important: Multi-hop Agentic 검색

**현재 문제:** 단일 패스 검색 → 관련 파일 누락 가능

**개선안:** 반복적 검색 + 자기 반성

```typescript
async function agenticFileSearch(
  query: string,
  maxHops: number = 3
): Promise<FileInfo[]> {
  let results: FileInfo[] = [];
  let gaps: string[] = [];

  for (let hop = 0; hop < maxHops; hop++) {
    // 1. 현재 쿼리로 검색
    const newResults = await searchFiles(query, gaps);
    results = mergeResults(results, newResults);

    // 2. Self-reflection: 충분한가?
    const reflection = await llm.evaluate({
      prompt: `Found files: ${results.map(f => f.path)}
               Bug report: ${query}

               Are we missing any related files?
               What roles (Form/API/Schema) are not covered?`,
    });

    if (reflection.sufficient) break;

    // 3. 갭 기반 추가 검색
    gaps = reflection.missingTypes;
  }

  return results;
}
```

### 3.4 🟡 Important: 신뢰도 자동 보정

**현재 문제:** 프롬프트에 가이드라인만 있고 강제 없음

**개선안:** 구조적 신뢰도 검증

```typescript
function calibrateConfidence(analysis: Analysis): number {
  let confidence = analysis.confidence;
  let penalties: string[] = [];

  // 1. 파일 위치 확실성 체크
  if (analysis.affectedFiles.length === 0) {
    confidence = Math.min(confidence, 40);
    penalties.push('No specific file identified');
  }

  // 2. 에러 라인 매칭 체크
  const hasLineMatch = analysis.affectedFiles.some(f =>
    f.includes(':') // 라인 번호 포함 여부
  );
  if (!hasLineMatch && confidence > 70) {
    confidence -= 20;
    penalties.push('No line number match');
  }

  // 3. 역할 불일치 체크
  const suggestedRole = getFileRole(analysis.affectedFiles[0]);
  const expectedRole = getBugTypeExpectedRole(analysis.category);
  if (suggestedRole !== expectedRole) {
    confidence -= 15;
    penalties.push(`Role mismatch: ${suggestedRole} vs expected ${expectedRole}`);
  }

  // 4. 추가 노트에 "uncertain" 키워드
  if (analysis.additionalNotes?.includes('uncertain') ||
      analysis.additionalNotes?.includes('추가 조사')) {
    confidence = Math.min(confidence, 60);
  }

  return { confidence, penalties };
}
```

### 3.5 🟢 Suggestion: Import Chain 강화

**현재:** 단순 import 그래프 확장

**개선안:** 방향성 있는 의존성 체인

```typescript
// "유효성 검사 누락" 버그 분석 시
// Form → calls → API → validates with → Schema

function buildDependencyChain(bugType: string, entryFile: string): string[] {
  const chain: string[] = [entryFile];

  if (bugType === 'validation') {
    // Form 파일에서 시작 → 호출하는 API 찾기
    const apiCalls = findAPICallsInFile(entryFile);
    chain.push(...apiCalls);

    // API에서 사용하는 Schema 찾기
    for (const api of apiCalls) {
      const schemas = findSchemaImports(api);
      chain.push(...schemas);
    }
  }

  return chain;
}
```

---

## 4. 구현 우선순위

| 순위 | 개선 항목 | 난이도 | 예상 효과 | 소요 시간 |
|------|----------|--------|----------|----------|
| 1 | 아키텍처 인식 컨텍스트 | 중 | 높음 | 2-3일 |
| 2 | 신뢰도 자동 보정 | 낮음 | 높음 | 1일 |
| 3 | Multi-hop Agentic 검색 | 중 | 중간 | 3-4일 |
| 4 | AST 기반 파싱 (tree-sitter) | 높음 | 중간 | 5-7일 |
| 5 | Import Chain 강화 | 낮음 | 낮음 | 1일 |

---

## 5. 참고 자료

### 아키텍처 & 트렌드
- [State of LLMs 2025](https://magazine.sebastianraschka.com/p/state-of-llms-2025) - Sebastian Raschka
- [Awesome Code LLM](https://github.com/codefuse-ai/Awesome-Code-LLM) - Curated research list
- [LLM Coding Workflow 2026](https://medium.com/@addyosmani/my-llm-coding-workflow-going-into-2026-52fe1681325e) - Addy Osmani

### Agentic RAG
- [Agentic RAG Survey (arXiv)](https://arxiv.org/abs/2501.09136)
- [RAG is Dead, Long Live Agentic Retrieval](https://www.llamaindex.ai/blog/rag-is-dead-long-live-agentic-retrieval) - LlamaIndex
- [Building Agentic Deep-Thinking RAG](https://levelup.gitconnected.com/building-an-agentic-deep-thinking-rag-pipeline-to-solve-complex-queries-af69c5e044db)

### 코드 분석 & AST
- [HASTE: Hybrid AST-guided Selection](https://openreview.net/forum?id=ao7VBbvWIK) - ICLR 2026
- [RAG for Large Scale Code Repos](https://www.qodo.ai/blog/rag-for-large-scale-code-repos/) - Qodo
- [AST-based Chunking for RAG](https://vxrl.medium.com/enhancing-llm-code-generation-with-rag-and-ast-based-chunking-5b81902ae9fc)

### 정확도 향상
- [LLM Bug Detection Survey](https://arxiv.org/html/2404.11595v3)
- [LLift: LLM + Static Analysis](https://dl.acm.org/doi/10.1145/3649828) - OOPSLA
- [Meta LLM Bug Catchers](https://engineering.fb.com/2025/02/05/security/revolutionizing-software-testing-llm-powered-bug-catchers-meta-ach/)

---

## 6. 결론

inner-lens 분석 엔진은 2024년 기준 합리적인 구조를 갖추고 있으나, 2025년 최신 기법 대비 다음이 부족합니다:

1. **아키텍처 무인식** → 잘못된 파일 타겟팅 (QA 피드백의 핵심 문제)
2. **단일 패스 검색** → 관련 파일 체인 누락 가능
3. **신뢰도 미보정** → 불확실해도 높은 점수 유지

**즉각 적용 가능한 Quick Win:**
- 파일 역할 분류 로직 추가 (1일)
- 신뢰도 자동 보정 로직 추가 (1일)

**중기 개선:**
- Multi-hop 검색 도입 (1주)
- tree-sitter AST 파싱 (2주)

이 개선을 통해 QA 피드백에서 지적된 "60점" 수준에서 **80점 이상**으로 품질 향상이 기대됩니다.
