<p align="center">
  <img width="120" height="120" alt="inner-lens-logo" src="https://github.com/user-attachments/assets/c535635b-daf8-4db5-bb50-82c32014f8c2" />
</p>

<h1 align="center">inner-lens</h1>

<p align="center">
  <strong>Self-Debugging QA Agent</strong> — AI 분석 기반 유니버설 버그 리포팅 위젯
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/inner-lens"><img src="https://img.shields.io/npm/v/inner-lens.svg?style=flat-square&color=6366f1" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/inner-lens"><img src="https://img.shields.io/npm/dm/inner-lens.svg?style=flat-square&color=6366f1" alt="npm downloads" /></a>
  <a href="https://github.com/jhlee0409/inner-lens/actions/workflows/test.yml"><img src="https://img.shields.io/github/actions/workflow/status/jhlee0409/inner-lens/test.yml?branch=main&style=flat-square&label=tests" alt="CI Status" /></a>
  <a href="https://github.com/jhlee0409/inner-lens/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/inner-lens.svg?style=flat-square&color=22c55e" alt="License" /></a>
  <a href="https://github.com/jhlee0409/inner-lens"><img src="https://img.shields.io/github/stars/jhlee0409/inner-lens?style=flat-square&color=fbbf24" alt="GitHub Stars" /></a>
</p>

<p align="center">
  <a href="./README.md">English</a> | <b>한국어</b>
</p>

---

## 설치

```bash
npm install inner-lens
# or
yarn add inner-lens
# or
pnpm add inner-lens

# 선택: 세션 리플레이 포함 (하단 참고)
npm install inner-lens rrweb@2.0.0-alpha.17
# or
yarn add inner-lens rrweb@2.0.0-alpha.17
# or
pnpm add inner-lens rrweb@2.0.0-alpha.17
```

## 빠른 시작

```bash
npx inner-lens init
```

또는 수동 설정:

**React / Next.js:**
```tsx
import { InnerLensWidget } from 'inner-lens/react';

export default function App() {
  return (
    <>
      <YourApp />
      <InnerLensWidget repository="your-org/your-repo" />
    </>
  );
}
```

**Vue 3:**
```vue
<script setup>
import { InnerLensWidget } from 'inner-lens/vue';
</script>

<template>
  <YourApp />
  <InnerLensWidget repository="your-org/your-repo" />
</template>
```

**Vanilla JS:**
```js
import { InnerLens } from 'inner-lens/vanilla';

const widget = new InnerLens({ repository: 'your-org/your-repo' });
widget.mount();
```

---

## 왜 inner-lens?

*"안 돼요"* 같은 버그 리포트로 디버깅에 몇 시간을 낭비하고 계신가요?

| inner-lens 없이 | inner-lens 사용 |
|----------------|-----------------|
| "버튼이 안 돼요" | 콘솔 로그, 네트워크 에러, DOM 상태, 세션 리플레이 |
| 끝없는 질문과 답변 | 원클릭으로 전체 컨텍스트 수집 |
| 수동 로그 수집 | 민감정보 자동 마스킹 후 캡처 |
| 추측으로 디버깅 | AI 기반 원인 분석 |

### 동작 방식

```
사용자가 "버그 리포트" 클릭
    ↓
위젯이 컨텍스트를 수집 (로그, 액션, 성능, DOM)
    ↓
GitHub Issue 생성 (전체 컨텍스트 포함)
    ↓
AI가 코드를 분석하고 원인 파악
    ↓
분석 결과를 코멘트로 작성 (수정 제안 포함)
```

---

## Hosted vs Self-Hosted

| | Hosted (권장) | Self-Hosted |
|---|:---:|:---:|
| **설정 시간** | 2분 | 10분 |
| **백엔드 필요** | 아니요 | 예 |
| **Issue 작성자** | `inner-lens-app[bot]` | 본인 GitHub 계정 |
| **Rate Limit** | 10 req/min/IP | 없음 |

### Hosted 모드

1. [GitHub App](https://github.com/apps/inner-lens-app) 설치
2. `repository` prop으로 위젯 추가

```tsx
<InnerLensWidget repository="owner/repo" />
```

### Self-Hosted 모드

1. [GitHub Token](https://github.com/settings/tokens/new?scopes=repo) 생성
2. 백엔드 핸들러 추가:

```ts
// Next.js App Router
import { createFetchHandler } from 'inner-lens/server';

export const POST = createFetchHandler({
  githubToken: process.env.GITHUB_TOKEN!,
  repository: 'owner/repo',
});
```

3. `endpoint` prop으로 위젯 추가:

```tsx
<InnerLensWidget 
  endpoint="/api/inner-lens/report" 
  repository="owner/repo" 
/>
```

<details>
<summary><b>다른 프레임워크 (Express, Fastify, Hono, Koa...)</b></summary>

```ts
// Express
import { createExpressHandler } from 'inner-lens/server';
app.post('/api/report', createExpressHandler({ githubToken, repository }));

// Fastify
import { createFastifyHandler } from 'inner-lens/server';
fastify.post('/api/report', createFastifyHandler({ githubToken, repository }));

// Hono / Bun / Deno
import { createFetchHandler } from 'inner-lens/server';
app.post('/api/report', (c) => createFetchHandler({ githubToken, repository })(c.req.raw));

// Koa
import { createKoaHandler } from 'inner-lens/server';
router.post('/api/report', createKoaHandler({ githubToken, repository }));

// Node.js HTTP
import { createNodeHandler } from 'inner-lens/server';
const handler = createNodeHandler({ githubToken, repository });
```

</details>

---

## AI 분석

GitHub Actions로 AI 기반 버그 분석을 활성화하세요.

```yaml
# .github/workflows/inner-lens.yml
name: inner-lens Analysis

on:
  issues:
    types: [opened]

jobs:
  analyze:
    if: contains(github.event.issue.labels.*.name, 'inner-lens')
    uses: jhlee0409/inner-lens/.github/workflows/analysis-engine.yml@v1
    with:
      provider: 'anthropic'  # or 'openai', 'google'
    secrets:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

| Provider | Model | Secret |
|----------|-------|--------|
| Anthropic | claude-sonnet-4-5-20250929 | `ANTHROPIC_API_KEY` |
| OpenAI | gpt-4o | `OPENAI_API_KEY` |
| Google | gemini-2.5-flash | `GOOGLE_GENERATIVE_AI_API_KEY` |

---

## 세션 리플레이

사용자가 경험한 화면을 그대로 녹화하여 재생할 수 있습니다.

**왜 필요한가요?** 클릭, 스크롤, UI 변화 등 사용자가 실제로 본 화면을 그대로 확인할 수 있습니다.

**언제 사용하나요?** 로그만으로는 재현하기 어려운 복잡한 UI 버그를 디버깅할 때 유용합니다.

> **참고:** 번들 크기가 약 500KB 증가합니다. 필요한 경우에만 활성화하세요.

```bash
npm install rrweb@2.0.0-alpha.17
```

```tsx
<InnerLensWidget repository="owner/repo" captureSessionReplay={true} />
```

---

## 설정

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `repository` | `string` | - | GitHub 저장소 (`owner/repo`) |
| `endpoint` | `string` | Hosted API | 커스텀 백엔드 URL |
| `language` | `string` | `en` | UI 언어 (`en`, `ko`, `ja`, `zh`, `es`) |
| `position` | `string` | `bottom-right` | 버튼 위치 |
| `buttonColor` | `string` | `#6366f1` | 버튼 색상 |
| `hidden` | `boolean` | `false` | 위젯 숨김 |
| `disabled` | `boolean` | `false` | 위젯 비활성화 |
| `captureSessionReplay` | `boolean` | `false` | DOM 녹화 활성화 |
| `reporter` | `object` | - | 사용자 정보 `{ name, email?, id? }` |

<details>
<summary><b>전체 옵션</b></summary>

| 옵션 | 타입 | 기본값 |
|------|------|--------|
| `labels` | `string[]` | `['inner-lens']` |
| `captureConsoleLogs` | `boolean` | `true` |
| `maxLogEntries` | `number` | `50` |
| `maskSensitiveData` | `boolean` | `true` |
| `captureUserActions` | `boolean` | `true` |
| `captureNavigation` | `boolean` | `true` |
| `capturePerformance` | `boolean` | `true` |
| `buttonSize` | `sm\|md\|lg` | `lg` |
| `buttonText` | `string` | i18n |
| `dialogTitle` | `string` | i18n |
| `submitText` | `string` | i18n |
| `cancelText` | `string` | i18n |
| `onOpen` | `() => void` | - |
| `onClose` | `() => void` | - |
| `onSuccess` | `(url) => void` | - |
| `onError` | `(error) => void` | - |

</details>

---

## 보안

민감한 데이터는 전송 전 자동으로 마스킹됩니다 (22개 패턴):

| 카테고리 | 치환값 |
|----------|--------|
| 이메일, 전화번호, SSN | `[EMAIL_REDACTED]`, `[PHONE_REDACTED]`, `[SSN_REDACTED]` |
| 신용카드 | `[CARD_REDACTED]` |
| 인증 토큰, JWT | `[TOKEN_REDACTED]`, `[JWT_REDACTED]` |
| API 키 (AWS, OpenAI, Anthropic, Google, Stripe, GitHub) | `[*_KEY_REDACTED]` |
| 데이터베이스 URL, 개인키 | `[DATABASE_URL_REDACTED]`, `[PRIVATE_KEY_REDACTED]` |

---

## API Reference

### 클라이언트

| 패키지 | Exports |
|--------|---------|
| `inner-lens/react` | `InnerLensWidget`, `useInnerLens` |
| `inner-lens/vue` | `InnerLensWidget`, `useInnerLens` |
| `inner-lens/vanilla` | `InnerLens` |

### 서버

| Export | 프레임워크 |
|--------|------------|
| `createFetchHandler` | Next.js, Hono, Bun, Deno, Cloudflare |
| `createExpressHandler` | Express |
| `createFastifyHandler` | Fastify |
| `createKoaHandler` | Koa |
| `createNodeHandler` | Node.js HTTP |
| `handleBugReport` | Any |

---

## FAQ

<details>
<summary><b>Next.js에서 어떻게 사용하나요?</b></summary>

위젯은 브라우저 API를 사용하므로 클라이언트 컴포넌트로 사용해야 합니다.

```tsx
// App Router: 'use client' 지시어 추가
'use client';
import { InnerLensWidget } from 'inner-lens/react';

// Pages Router: dynamic import 사용
import dynamic from 'next/dynamic';
const InnerLensWidget = dynamic(
  () => import('inner-lens/react').then(m => m.InnerLensWidget),
  { ssr: false }
);
```
</details>

<details>
<summary><b>민감한 정보는 어떻게 보호되나요?</b></summary>

이메일, API 키, 토큰 등 민감한 데이터는 서버로 전송되기 **전에** 브라우저에서 자동 마스킹됩니다. Hosted 모드에서도 inner-lens 서버에 데이터를 저장하지 않고 GitHub로 바로 전달합니다.
</details>

<details>
<summary><b>위젯 버튼이 화면에 안 보여요</b></summary>

1. `hidden={true}` prop이 설정되어 있진 않은지 확인
2. import 경로가 `'inner-lens/react'` (또는 `/vue`, `/vanilla`)인지 확인
3. 브라우저 개발자 도구(F12) 콘솔에서 에러 메시지 확인
</details>

---

## 기여

기여를 환영합니다! [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.

## 라이선스

[MIT](LICENSE) © 2025 [jack](https://github.com/jhlee0409)
