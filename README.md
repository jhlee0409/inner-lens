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

1. Configure build to inject git branch:
```js
// next.config.js
const { getGitBranch } = require('inner-lens/build');

module.exports = {
  env: {
    NEXT_PUBLIC_GIT_BRANCH: getGitBranch(),
  },
};
```

2. Add the widget:
```tsx
import { InnerLensWidget } from 'inner-lens/react';

export default function App() {
  return (
    <>
      <YourApp />
      <InnerLensWidget
        mode="hosted"
        repository="your-org/your-repo"
        branch={process.env.NEXT_PUBLIC_GIT_BRANCH}
      />
    </>
  );
}
```

**Vue 3 (Vite):**

1. Configure build:
```js
// vite.config.js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { getGitBranch } from 'inner-lens/build';

export default defineConfig({
  plugins: [vue()],
  define: {
    'import.meta.env.VITE_GIT_BRANCH': JSON.stringify(getGitBranch()),
  },
});
```

2. Add the widget:
```vue
<script setup>
import { InnerLensWidget } from 'inner-lens/vue';
</script>

<template>
  <YourApp />
  <InnerLensWidget
    mode="hosted"
    repository="your-org/your-repo"
    :branch="import.meta.env.VITE_GIT_BRANCH"
  />
</template>
```

**Vanilla JS (Vite):**

1. Configure build (same as Vue)
2. Add the widget:
```js
import { InnerLens } from 'inner-lens/vanilla';

const widget = new InnerLens({
  mode: 'hosted',
  repository: 'your-org/your-repo',
  branch: import.meta.env.VITE_GIT_BRANCH,
});
widget.mount();
```

> **Note:** The `branch` prop tells the AI analysis engine which code version to analyze. If you only deploy from `main`, you can omit it (defaults to `main`). The `getGitBranch()` utility auto-detects branch from CI/CD environment variables (Vercel, Netlify, AWS Amplify, Cloudflare Pages, Render, Railway, GitHub Actions, Heroku).

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
| **Rate Limit** | 10 req/min/IP + 100 req/day per repo | None |

### Hosted Mode

1. Install [GitHub App](https://github.com/apps/inner-lens-app)
2. Add widget with `mode="hosted"` and `repository` prop

```tsx
<InnerLensWidget mode="hosted" repository="owner/repo" />
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

3. Add widget with `mode="self-hosted"` and `endpoint` prop:

```tsx
<InnerLensWidget
  mode="self-hosted"
  endpoint="/api/inner-lens/report"
  repository="owner/repo"
/>
```

For external API servers (Cloudflare Workers, separate domain, etc.), use `fullUrl`:

```tsx
<InnerLensWidget
  mode="self-hosted"
  fullUrl="https://api.example.com/inner-lens/report"
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

| Provider | Model (example) | Secret | Notes |
|----------|-----------------|--------|-------|
| Anthropic | claude-sonnet-4-5-20250929 | `ANTHROPIC_API_KEY` | `model` is optional; omit to use provider default |
| OpenAI | gpt-4o | `OPENAI_API_KEY` | `model` is optional; omit to use provider default |
| Google | gemini-2.5-flash | `GOOGLE_GENERATIVE_AI_API_KEY` | `model` is optional; omit to use provider default |

### Workflow Options

| Option | Required | Type | Default | Description |
|--------|:--------:|------|---------|-------------|
| `provider` | No | `string` | `anthropic` | AI provider (`anthropic`, `openai`, `google`) |
| `model` | No | `string` | `''` | Optional model name (e.g., `claude-sonnet-4-20250514`); empty string uses provider default |
| `language` | No | `string` | `en` | Analysis output language (`en`, `ko`, `ja`, `zh`, `es`, `de`, `fr`, `pt`) |
| `max_files` | No | `number` | `25` | Maximum files to analyze (5-50) |

**Secrets** (required based on provider):

| Secret | Required |
|--------|----------|
| `ANTHROPIC_API_KEY` | When `provider: 'anthropic'` |
| `OPENAI_API_KEY` | When `provider: 'openai'` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | When `provider: 'google'` |

<details>
<summary><b>Example with all options</b></summary>

```yaml
jobs:
  analyze:
    if: contains(github.event.issue.labels.*.name, 'inner-lens')
    uses: jhlee0409/inner-lens/.github/workflows/analysis-engine.yml@v1
    with:
      provider: 'anthropic'
      model: 'claude-sonnet-4-20250514'
      language: 'ko'
      max_files: 30
    secrets:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

</details>

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
<InnerLensWidget mode="hosted" repository="owner/repo" captureSessionReplay={true} />
```

---

## Configuration

> **Migration from v0.4.7 or earlier:** The `mode` prop is now **required**.
> - If using hosted API: add `mode="hosted"`
> - If using custom endpoint: add `mode="self-hosted"`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `'hosted' \| 'self-hosted'` | **required** | API mode (see below) |
| `repository` | `string` | - | GitHub repo (`owner/repo`) |
| `endpoint` | `string` | - | Relative backend URL (self-hosted only) |
| `fullUrl` | `string` | - | Absolute backend URL (self-hosted only) |
| `branch` | `string` | - | Git branch for AI analysis |
| `language` | `string` | `en` | UI language (`en`, `ko`, `ja`, `zh`, `es`) |
| `position` | `string` | `bottom-right` | Button position |
| `buttonColor` | `string` | `#6366f1` | Button color |
| `buttonSize` | `sm\|md\|lg` | `lg` | Trigger button size |
| `styles` | `{ buttonColor?, buttonPosition?, buttonSize? }` | - | Advanced style config (overrides position/color/size) |
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
| `captureSessionReplay` | `boolean` | `false` |
| `styles` | `{ buttonColor?, buttonPosition?, buttonSize? }` | - |
| `buttonSize` | `sm\|md\|lg` | `lg` |
| `buttonText` | `string` | i18n |
| `dialogTitle` | `string` | i18n |
| `dialogDescription` | `string` | i18n |
| `submitText` | `string` | i18n |
| `cancelText` | `string` | i18n |
| `successMessage` | `string` | i18n |
| `trigger` | `ReactNode` | - |
| `onOpen` | `() => void` | - |
| `onClose` | `() => void` | - |
| `onSuccess` | `(url) => void` | - |
| `onError` | `(error) => void` | - |

</details>

---

## Security & Privacy

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Your Application (Browser)                        │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────────────┐ │
│  │ User clicks │───►│ Widget       │───►│ Client-side Masking         │ │
│  │ Report Bug  │    │ captures     │    │ (30 patterns applied)       │ │
│  └─────────────┘    │ context      │    │ • Emails → [EMAIL_REDACTED] │ │
│                     └──────────────┘    │ • API keys → [*_REDACTED]   │ │
│                                         │ • Tokens → [TOKEN_REDACTED] │ │
│                                         └──────────────┬──────────────┘ │
└────────────────────────────────────────────────────────┼────────────────┘
                                                         │
                                                         ▼
                              ┌───────────────────────────────────────────┐
                              │      inner-lens API (Pass-through)        │
                              │  • No data storage                        │
                              │  • No logging of report content           │
                              │  • Rate limiting only                     │
                              └───────────────────────┬───────────────────┘
                                                      │
                                                      ▼
                              ┌───────────────────────────────────────────┐
                              │           GitHub Issues API               │
                              │  • Issue created in YOUR repository       │
                              │  • Data stored only in GitHub             │
                              │  • Access controlled by your repo perms   │
                              └───────────────────────────────────────────┘
```

### What We Collect

| Data Type | Purpose | Privacy Notes |
|-----------|---------|---------------|
| Console logs | Debug errors & warnings | Auto-masked for sensitive content |
| User actions | Understand user journey | Generic selectors only (no personal text) |
| Navigation history | Track page flow | URLs only (query params masked) |
| Browser & OS info | Environment debugging | Summarized (e.g., "Chrome 120", "Windows 10") |
| Performance metrics | Identify slow operations | Timing data only (LCP, FCP, etc.) |
| DOM snapshot (opt-in) | Visual debugging | Session replay disabled by default |

### What We DON'T Collect

- ❌ **IP addresses** — Not logged or stored
- ❌ **Cookies** — Never accessed
- ❌ **localStorage/sessionStorage** — Never read
- ❌ **Geolocation** — Not requested
- ❌ **Device fingerprints** — No unique identifiers
- ❌ **Form field values** — Input content excluded
- ❌ **Full User Agent string** — Only browser/OS summary

### Automatic Masking (30+ Patterns)

Sensitive data is masked **client-side, before transmission**:

| Category | Replacement |
|----------|-------------|
| Email, Phone, SSN | `[EMAIL_REDACTED]`, `[PHONE_REDACTED]`, `[SSN_REDACTED]` |
| Credit cards | `[CARD_REDACTED]` |
| Auth tokens, JWTs | `[TOKEN_REDACTED]`, `[JWT_REDACTED]` |
| API keys (AWS, OpenAI, Anthropic, Google, Stripe, GitHub) | `[*_KEY_REDACTED]` |
| Database URLs, Private keys | `[DATABASE_URL_REDACTED]`, `[PRIVATE_KEY_REDACTED]` |
| Discord webhooks, Slack tokens | `[DISCORD_WEBHOOK_REDACTED]`, `[SLACK_TOKEN_REDACTED]` |
| NPM, SendGrid, Twilio | `[NPM_TOKEN_REDACTED]`, `[SENDGRID_KEY_REDACTED]`, `[TWILIO_REDACTED]` |

### Key Security Principles

1. **Client-side first** — All masking happens in the browser before data leaves
2. **No data retention** — Hosted API is a pass-through; no logs stored
3. **User-initiated only** — Reports sent only when user clicks submit
4. **Minimal collection** — Only debugging-relevant data captured
5. **Transparent storage** — Data goes to YOUR GitHub repo, nowhere else

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

### Utilities (Vue bundle re-exports)
- Masking: `maskSensitiveData`, `maskSensitiveObject`, `validateMasking`
- Log capture: `initLogCapture`, `getCapturedLogs`, `clearCapturedLogs`, `addCustomLog`, `restoreConsole`
(available from `inner-lens/vue`)

---

## FAQ

<details>
<summary><b>How do I use it with Next.js?</b></summary>

The widget uses browser APIs, so it must run as a client component.

```tsx
// App Router: Add 'use client' directive
'use client';
import { InnerLensWidget } from 'inner-lens/react';

function BugReportWidget() {
  return <InnerLensWidget mode="hosted" repository="owner/repo" />;
}

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

<details>
<summary><b>Browser compatibility?</b></summary>

inner-lens targets ES2022 and works with modern browsers:
- Chrome 94+
- Firefox 93+
- Safari 15.4+
- Edge 94+

Node.js 20+ is required for server-side features.
</details>

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © 2025 [jack](https://github.com/jhlee0409)
