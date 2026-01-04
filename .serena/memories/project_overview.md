# inner-lens 프로젝트 개요

## 목적
AI 기반 버그 분석을 제공하는 셀프 디버깅 QA 에이전트

## 핵심 흐름
Widget → Log/Network 캡처 → 민감정보 마스킹 → API → GitHub Issue → AI 분석

## 기술 스택
| 분류 | 기술 |
|------|------|
| Language | TypeScript (ES2022, strict mode) |
| Build | tsup (ESM + CJS 이중 빌드) |
| Test | Vitest + jsdom |
| Validation | Zod |
| UI | React, Vue, Vanilla JS 지원 |

## 지원 프레임워크
- React (>=17.0.0)
- Vue (>=3.0.0)
- Vanilla JS
- Next.js, Vite, Remix, Astro 호환

## 배포 모드
| 모드 | 인증 | 환경변수 |
|------|------|----------|
| Hosted | GitHub App | `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` |
| Self-Hosted | GitHub PAT | `GITHUB_TOKEN`, `GITHUB_REPOSITORY` |
