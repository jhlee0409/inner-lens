<p align="center">
  <img width="120" height="120" alt="inner-lens-logo" src="https://github.com/user-attachments/assets/c535635b-daf8-4db5-bb50-82c32014f8c2" />
</p>

<h1 align="center">inner-lens</h1>

<p align="center">
  <strong>Self-Debugging QA Agent</strong> — Universal bug reporting widget with AI-powered analysis
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/inner-lens"><img src="https://img.shields.io/npm/v/inner-lens.svg?style=flat-square&color=6366f1" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/inner-lens"><img src="https://img.shields.io/npm/dm/inner-lens.svg?style=flat-square&color=6366f1" alt="npm downloads" /></a>
  <a href="https://github.com/jhlee0409/inner-lens/actions/workflows/test.yml"><img src="https://img.shields.io/github/actions/workflow/status/jhlee0409/inner-lens/test.yml?branch=main&style=flat-square&label=tests" alt="CI Status" /></a>
  <a href="https://github.com/jhlee0409/inner-lens/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/inner-lens.svg?style=flat-square&color=22c55e" alt="License" /></a>
  <a href="https://github.com/jhlee0409/inner-lens"><img src="https://img.shields.io/github/stars/jhlee0409/inner-lens?style=flat-square&color=fbbf24" alt="GitHub Stars" /></a>
</p>

<p align="center">
  <b>English</b> | <a href="./README.ko.md">한국어</a>
</p>

---

## Installation

```bash
npm install inner-lens
# or
yarn add inner-lens
# or
pnpm add inner-lens

# Optional: With Session Replay (see below)
npm install inner-lens rrweb@2.0.0-alpha.17
# or
yarn add inner-lens rrweb@2.0.0-alpha.17
# or
pnpm add inner-lens rrweb@2.0.0-alpha.17
```

## Quick Start

```bash
npx inner-lens init
```

Or manually:

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

## Why inner-lens?

Bug reports like *"it doesn't work"* waste hours of debugging time.

| Without inner-lens | With inner-lens |
|-------------------|-----------------|
| "The button doesn't work" | Console logs, network errors, DOM state, session replay |
| Hours of back-and-forth | One-click bug reports with full context |
| Manual log collection | Automatic capture with PII masking |
| Guessing what happened | AI-powered root cause analysis |

### How It Works

```
User clicks "Report Bug"
    ↓
Widget captures context (logs, actions, performance, DOM)
    ↓
GitHub Issue created with full context
    ↓
AI analyzes code & identifies root cause
    ↓
Analysis posted as comment with fix suggestions
```

---

## Hosted vs Self-Hosted

| | Hosted (Recommended) | Self-Hosted |
|---|:---:|:---:|
| **Setup Time** | 2 minutes | 10 minutes |
| **Backend Required** | No | Yes |
| **Issue Author** | `inner-lens-app[bot]` | Your GitHub account |
| **Rate Limit** | 10 req/min/IP | None |

### Hosted Mode

1. Install [GitHub App](https://github.com/apps/inner-lens-app)
2. Add widget with `repository` prop

```tsx
<InnerLensWidget repository="owner/repo" />
```

### Self-Hosted Mode

1. Create [GitHub Token](https://github.com/settings/tokens/new?scopes=repo)
2. Add backend handler:

```ts
// Next.js App Router
import { createFetchHandler } from 'inner-lens/server';

export const POST = createFetchHandler({
  githubToken: process.env.GITHUB_TOKEN!,
  repository: 'owner/repo',
});
```

3. Add widget with `endpoint` prop:

```tsx
<InnerLensWidget 
  endpoint="/api/inner-lens/report" 
  repository="owner/repo" 
/>
```

<details>
<summary><b>Other frameworks (Express, Fastify, Hono, Koa...)</b></summary>

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

## AI Analysis

Enable AI-powered bug analysis with GitHub Actions.

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

## Session Replay

Record DOM changes to visually replay what the user experienced.

**Why use it?** See exactly what the user saw — clicks, scrolls, and UI changes — without asking them to reproduce the issue.

**When to use it?** Complex UI bugs that are hard to reproduce from logs alone.

> **Note:** Adds ~500KB to your bundle. Only enable if needed.

```bash
npm install rrweb@2.0.0-alpha.17
```

```tsx
<InnerLensWidget repository="owner/repo" captureSessionReplay={true} />
```

---

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `repository` | `string` | - | GitHub repo (`owner/repo`) |
| `endpoint` | `string` | Hosted API | Custom backend URL |
| `language` | `string` | `en` | UI language (`en`, `ko`, `ja`, `zh`, `es`) |
| `position` | `string` | `bottom-right` | Button position |
| `buttonColor` | `string` | `#6366f1` | Button color |
| `hidden` | `boolean` | `false` | Hide widget |
| `disabled` | `boolean` | `false` | Disable widget |
| `captureSessionReplay` | `boolean` | `false` | Enable DOM recording |
| `reporter` | `object` | - | User info `{ name, email?, id? }` |

<details>
<summary><b>All options</b></summary>

| Option | Type | Default |
|--------|------|---------|
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

## Security

Sensitive data is automatically masked before transmission (22 patterns):

| Category | Replacement |
|----------|-------------|
| Email, Phone, SSN | `[EMAIL_REDACTED]`, `[PHONE_REDACTED]`, `[SSN_REDACTED]` |
| Credit cards | `[CARD_REDACTED]` |
| Auth tokens, JWTs | `[TOKEN_REDACTED]`, `[JWT_REDACTED]` |
| API keys (AWS, OpenAI, Anthropic, Google, Stripe, GitHub) | `[*_KEY_REDACTED]` |
| Database URLs, Private keys | `[DATABASE_URL_REDACTED]`, `[PRIVATE_KEY_REDACTED]` |

---

## API Reference

### Client

| Package | Exports |
|---------|---------|
| `inner-lens/react` | `InnerLensWidget`, `useInnerLens` |
| `inner-lens/vue` | `InnerLensWidget`, `useInnerLens` |
| `inner-lens/vanilla` | `InnerLens` |

### Server

| Export | Frameworks |
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
<summary><b>How do I use it with Next.js?</b></summary>

The widget uses browser APIs, so it must run as a client component.

```tsx
// App Router: Add 'use client' directive
'use client';
import { InnerLensWidget } from 'inner-lens/react';

// Pages Router: Use dynamic import
import dynamic from 'next/dynamic';
const InnerLensWidget = dynamic(
  () => import('inner-lens/react').then(m => m.InnerLensWidget),
  { ssr: false }
);
```
</details>

<details>
<summary><b>Is my data safe?</b></summary>

Sensitive data (emails, API keys, tokens, etc.) is automatically masked **before** leaving the browser. In Hosted mode, we don't store any data — it goes directly to GitHub.
</details>

<details>
<summary><b>Widget doesn't appear?</b></summary>

1. Check if `hidden={true}` prop is set
2. Verify import path is `'inner-lens/react'` (or `/vue`, `/vanilla`)
3. Check browser console (F12) for error messages
</details>

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © 2025 [jack](https://github.com/jhlee0409)
