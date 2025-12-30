# 🔍 inner-lens

[![Universal Framework Support](https://img.shields.io/badge/Works%20with-React%20%7C%20Vue%20%7C%20Vanilla%20JS-blue)](https://github.com/jhlee0409/inner-lens)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org)

**Self-Debugging QA Agent** — Universal bug reporting widget with AI-powered analysis for any frontend framework.

inner-lens is an open-source developer tool that integrates seamlessly into **any web application**, enabling users to report bugs with captured console logs that are automatically analyzed by AI.

## ✨ Features

- **🌐 Universal Framework Support** — Works with React, Vue, Svelte, vanilla JS, and more
- **🚀 Zero-Config Setup** — One command to get started: `npx create-inner-lens`
- **🤖 Universal LLM Support** — Choose from Anthropic (Claude), OpenAI (GPT-4o), or Google (Gemini)
- **🔒 Security-First** — Automatic masking of emails, API keys, tokens, and PII
- **📱 Lightweight Widget** — Clean, accessible UI with zero external CSS dependencies
- **⚡ Multi-Backend Support** — Works with Express, Fastify, Hono, Next.js, Koa, and more
- **🎨 Customizable** — Inline styles prevent conflicts with your app's design system

## 📦 Installation

```bash
npm install inner-lens
```

## ⚡ 30-Second Setup

```bash
# 1. Run the setup wizard
npx create-inner-lens

# 2. Add widget to your app (React example)
```

```tsx
import { InnerLensWidget } from 'inner-lens/react';

export default function App() {
  return (
    <>
      <YourApp />
      <InnerLensWidget />
    </>
  );
}
```

```bash
# 3. Start your app - that's it!
npm run dev
```

> 💡 The CLI wizard auto-generates the API route and GitHub Actions workflow for you.

---

## 🚀 Quick Start

### Choose Your Framework

<details>
<summary><b>⚛️ React / Next.js</b></summary>

```tsx
// React / Next.js App Router
import { InnerLensWidget } from 'inner-lens/react';

function App() {
  return (
    <div>
      <YourApp />
      <InnerLensWidget
        endpoint="/api/inner-lens/report"
        repository="owner/repo"
      />
    </div>
  );
}
```

**Using the hook for programmatic control:**

```tsx
import { useInnerLens } from 'inner-lens/react';

function MyComponent() {
  const { open, close } = useInnerLens({
    endpoint: '/api/inner-lens/report',
  });

  return <button onClick={open}>Report Bug</button>;
}
```

</details>

<details>
<summary><b>💚 Vue 3</b></summary>

```vue
<script setup>
import { InnerLensWidget } from 'inner-lens/vue';
</script>

<template>
  <div>
    <YourApp />
    <InnerLensWidget
      endpoint="/api/inner-lens/report"
      repository="owner/repo"
    />
  </div>
</template>
```

**Using the composable:**

```vue
<script setup>
import { useInnerLens } from 'inner-lens/vue';

const { open, close, isOpen } = useInnerLens({
  endpoint: '/api/inner-lens/report',
});
</script>

<template>
  <button @click="open">Report Bug</button>
</template>
```

</details>

<details>
<summary><b>🟨 Vanilla JavaScript</b></summary>

```html
<script type="module">
  import { InnerLens } from 'inner-lens/vanilla';

  const widget = new InnerLens({
    endpoint: '/api/inner-lens/report',
    repository: 'owner/repo',
  });

  widget.mount();
</script>
```

**Auto-initialize with config:**

```html
<script>
  window.innerLensConfig = {
    endpoint: '/api/inner-lens/report',
    repository: 'owner/repo',
  };
</script>
<script type="module" src="node_modules/inner-lens/dist/vanilla.js"></script>
```

</details>

<details>
<summary><b>🔶 Svelte</b></summary>

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import { InnerLens } from 'inner-lens/vanilla';

  let widget;

  onMount(() => {
    widget = new InnerLens({
      endpoint: '/api/inner-lens/report',
      repository: 'owner/repo',
    });
    widget.mount();
  });

  onDestroy(() => {
    widget?.unmount();
  });
</script>
```

</details>

<details>
<summary><b>🚀 Astro</b></summary>

```astro
---
// For client-side hydration
---

<script>
  import { InnerLens } from 'inner-lens/vanilla';

  const widget = new InnerLens({
    endpoint: '/api/inner-lens/report',
    repository: 'owner/repo',
  });

  widget.mount();
</script>
```

</details>

---

## 🖥️ Backend Setup

버그 리포트를 GitHub Issue로 전송하려면 백엔드 API가 필요합니다.

### Web Fetch API (권장)

Next.js, Vercel, Netlify, Cloudflare Workers, Hono, Bun, Deno 등 Web Standards를 지원하는 환경:

```ts
// Next.js: app/api/inner-lens/report/route.ts
// Vercel: api/inner-lens/report.ts
// Cloudflare Workers: src/index.ts
import { createFetchHandler } from 'inner-lens/server';

export const POST = createFetchHandler({
  githubToken: process.env.GITHUB_TOKEN!,
  repository: 'owner/repo', // 또는 process.env.GITHUB_REPOSITORY
});
```

### 환경변수

| 변수 | 설명 |
|------|------|
| `GITHUB_TOKEN` | [Personal Access Token](https://github.com/settings/tokens/new) (repo 권한 필요) |
| `GITHUB_REPOSITORY` | `owner/repo` 형식 (선택) |

<details>
<summary><b>다른 프레임워크 (Express, Fastify, Koa, Node.js)</b></summary>

**Express:**
```ts
import express from 'express';
import { createExpressHandler } from 'inner-lens/server';

const app = express();
app.use(express.json());
app.post('/api/inner-lens/report', createExpressHandler({
  githubToken: process.env.GITHUB_TOKEN!,
  repository: 'owner/repo',
}));
```

**Fastify:**
```ts
import Fastify from 'fastify';
import { createFastifyHandler } from 'inner-lens/server';

const fastify = Fastify();
fastify.post('/api/inner-lens/report', createFastifyHandler({
  githubToken: process.env.GITHUB_TOKEN!,
  repository: 'owner/repo',
}));
```

**Koa:**
```ts
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { createKoaHandler } from 'inner-lens/server';

const app = new Koa();
app.use(bodyParser());
const handler = createKoaHandler({
  githubToken: process.env.GITHUB_TOKEN!,
  repository: 'owner/repo',
});
app.use(async (ctx, next) => {
  if (ctx.path === '/api/inner-lens/report' && ctx.method === 'POST') {
    await handler(ctx);
  } else {
    await next();
  }
});
```

**Node.js HTTP:**
```ts
import http from 'http';
import { createNodeHandler } from 'inner-lens/server';

const handler = createNodeHandler({
  githubToken: process.env.GITHUB_TOKEN!,
  repository: 'owner/repo',
});
const server = http.createServer(async (req, res) => {
  if (req.url === '/api/inner-lens/report' && req.method === 'POST') {
    await handler(req, res);
  }
});
server.listen(3000);
```

</details>

<details>
<summary><b>Cloudflare Workers 전체 예시</b></summary>

```ts
// src/index.ts
import { createFetchHandler } from 'inner-lens/server';

interface Env {
  GITHUB_TOKEN: string;
  GITHUB_REPOSITORY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method === 'POST') {
      const handler = createFetchHandler({
        githubToken: env.GITHUB_TOKEN,
        repository: env.GITHUB_REPOSITORY,
      });
      const response = await handler(request);

      // CORS 헤더 추가
      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(response.body, { status: response.status, headers });
    }

    return new Response('Method not allowed', { status: 405 });
  },
};
```

</details>

---

## 🛠️ CLI Setup

Initialize GitHub Actions workflow:

```bash
# Option 1: Using create command
npx create-inner-lens

# Option 2: Using inner-lens CLI
npx inner-lens init
```

This interactive CLI will:
- Ask which AI provider you want to use
- Generate the GitHub Actions workflow
- Provide instructions for setting up secrets

### CLI Options

```bash
# Initialize with specific provider
npx create-inner-lens --provider anthropic

# Eject mode (full workflow source)
npx create-inner-lens --eject

# Skip prompts, use defaults
npx create-inner-lens -y

# Check configuration
npx inner-lens check
```

### Manual Workflow Setup

If you prefer to set up the workflow manually without the CLI:

1. Create `.github/workflows/inner-lens.yml`:

```yaml
name: inner-lens Analysis

on:
  issues:
    types: [opened, labeled]

jobs:
  analyze:
    if: contains(github.event.issue.labels.*.name, 'inner-lens')
    uses: jhlee0409/inner-lens/.github/workflows/analysis-engine.yml@v1
    with:
      provider: 'anthropic'  # or 'openai', 'google'
    secrets:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

2. Add your AI provider's API key to GitHub Secrets.

### Reusable Workflow Options

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | `string` | `anthropic` | AI provider (`anthropic`, `openai`, `google`) |
| `max_files` | `number` | `25` | Maximum files to analyze (5-50) |
| `max_tokens` | `number` | `4000` | Maximum tokens for AI response |
| `node_version` | `string` | `20` | Node.js version |

**Required Secrets by Provider:**
- `anthropic`: `ANTHROPIC_API_KEY`
- `openai`: `OPENAI_API_KEY`
- `google`: `GOOGLE_GENERATIVE_AI_API_KEY`

---

## ⚙️ Configuration

### Widget Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `endpoint` | `string` | `/api/inner-lens/report` | API endpoint for submissions |
| `repository` | `string` | - | GitHub repository (owner/repo) |
| `labels` | `string[]` | `['bug', 'inner-lens']` | Issue labels |
| `captureConsoleLogs` | `boolean` | `true` | Capture console.error/warn |
| `maxLogEntries` | `number` | `50` | Max logs to capture |
| `maskSensitiveData` | `boolean` | `true` | Auto-mask PII |
| `styles.buttonColor` | `string` | `#6366f1` | Button color |
| `styles.buttonPosition` | `string` | `bottom-right` | Button position |
| `disabled` | `boolean` | `false` | Disable widget |
| `devOnly` | `boolean` | `true` | **Auto-disable in production** (checks `NODE_ENV` and `import.meta.env.PROD`) |
| `onSuccess` | `function` | - | Success callback |
| `onError` | `function` | - | Error callback |

> ⚠️ **Note:** `devOnly: true` (default) automatically disables the widget in production. Set `devOnly: false` to enable bug reporting in production environments.

---

## 🔐 Security

### Data Masking

inner-lens automatically masks sensitive data before submission:

| Pattern | Replaced With |
|---------|---------------|
| Email addresses | `[EMAIL_REDACTED]` |
| Bearer tokens | `Bearer [TOKEN_REDACTED]` |
| API keys (OpenAI, Anthropic, etc.) | `[API_KEY_REDACTED]` |
| JWTs | `[JWT_REDACTED]` |
| Credit card numbers | `[CARD_REDACTED]` |
| Database URLs | `[DATABASE_URL_REDACTED]` |
| Private keys | `[PRIVATE_KEY_REDACTED]` |

---

## 📊 AI Providers

| Provider | Model | Best For |
|----------|-------|----------|
| **Anthropic** | Claude Sonnet 4 | Nuanced code analysis |
| **OpenAI** | GPT-4o | Fast general debugging |
| **Google** | Gemini 2.0 Flash | Cost-effective |

---

## 📚 API Reference

### Client Exports

| Package | Export | Description |
|---------|--------|-------------|
| `inner-lens` | `InnerLensCore` | Framework-agnostic core class |
| `inner-lens/react` | `InnerLensWidget` | React component |
| `inner-lens/react` | `useInnerLens` | React hook |
| `inner-lens/vue` | `InnerLensWidget` | Vue component |
| `inner-lens/vue` | `useInnerLens` | Vue composable |
| `inner-lens/vanilla` | `InnerLens` | Vanilla JS class |

### Server Exports

| Export | Description |
|--------|-------------|
| `createFetchHandler` | Web Fetch API (Next.js, Hono, Bun, Deno) |
| `createExpressHandler` | Express/Connect middleware |
| `createFastifyHandler` | Fastify handler |
| `createKoaHandler` | Koa middleware |
| `createNodeHandler` | Node.js http module |
| `handleBugReport` | Core handler (framework-agnostic) |
| `validateBugReport` | Validate payload |
| `createGitHubIssue` | Create GitHub issue |

---

## 🔧 Troubleshooting

### Widget doesn't appear

1. **Check if widget is disabled:** By default, the widget is enabled. Check `disabled` prop.
2. **Check console for errors:** Look for any JavaScript errors in browser console.
3. **Verify import path:** Make sure you're using the correct import for your framework:
   - React: `inner-lens/react`
   - Vue: `inner-lens/vue`
   - Vanilla: `inner-lens/vanilla` or `inner-lens`

### Bug report submission fails

1. **Check API endpoint:** Ensure `endpoint` matches your API route path.
2. **Verify GITHUB_TOKEN:** Check that the token has `repo` scope.
3. **Check CORS:** If using a separate backend, configure CORS headers.

```bash
# Verify configuration
npx inner-lens check
```

### GitHub issue not created

1. **Token permissions:** GITHUB_TOKEN needs `repo` scope for private repos, `public_repo` for public.
2. **Repository format:** Use `owner/repo` format (e.g., `jhlee0409/inner-lens`).
3. **Rate limits:** Check GitHub API rate limits if submitting many reports.

### AI analysis not running

1. **Check workflow file:** Ensure `.github/workflows/inner-lens.yml` exists.
2. **Verify secrets:** Add `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `GOOGLE_GENERATIVE_AI_API_KEY` to GitHub Secrets.
3. **Check issue labels:** Analysis only runs on issues with `inner-lens` label.

---

## ❓ FAQ

<details>
<summary><b>How does sensitive data masking work?</b></summary>

inner-lens automatically masks common sensitive patterns before sending to AI:
- Email addresses → `[EMAIL]`
- API keys (OpenAI, Anthropic, etc.) → `[API_KEY]`
- Bearer tokens → `[BEARER_TOKEN]`
- Credit card numbers → `[CREDIT_CARD]`
- And more...

Masking happens on both client-side (before submission) and server-side (before AI analysis).

</details>

<details>
<summary><b>Can I use inner-lens in production?</b></summary>

Yes! inner-lens is designed for production use. You can:
- Set `disabled={process.env.NODE_ENV === 'production'}` to disable in production
- Or keep it enabled for real user bug reports

</details>

<details>
<summary><b>Which AI provider should I choose?</b></summary>

| Provider | Model | Best For |
|----------|-------|----------|
| Anthropic | Claude Sonnet 4 | Best code understanding (recommended) |
| OpenAI | GPT-4o | Fast, versatile |
| Google | Gemini 2.0 Flash | Cost-effective |

</details>

<details>
<summary><b>Does inner-lens work with SSR/SSG?</b></summary>

Yes! The widget only renders on the client side. For frameworks with SSR:
- **Next.js:** Use `'use client'` directive or dynamic import
- **Nuxt:** The Vue component is SSR-safe
- **SvelteKit:** Mount the widget in `onMount`

</details>

<details>
<summary><b>Can I customize the widget appearance?</b></summary>

Yes! Use the `styles` prop or convenience options:

```tsx
<InnerLensWidget
  position="bottom-left"
  buttonColor="#10b981"
  buttonText="Report Issue"
  dialogTitle="Found a bug?"
/>
```

</details>

<details>
<summary><b>How do I deploy the backend?</b></summary>

For frontend-only frameworks (Vite, CRA), deploy a serverless function:

- **Cloudflare Workers:** Free 100k requests/day
- **Vercel Serverless:** Integrates with Vercel projects
- **Netlify Functions:** Integrates with Netlify projects

See [Backend Setup](#️-backend-setup) for code examples.

</details>

---

## ⚠️ Legal & Security Notice

**Data Processing:** Bug reports are processed by your chosen AI provider (Anthropic, OpenAI, or Google). While sensitive data masking is enabled by default:

1. Review your application's logging practices
2. Audit what data appears in console logs
3. Review your AI provider's data handling policies

**Disclaimer:** This software is provided "AS IS". The authors are not responsible for AI-generated suggestions or data handling by third-party providers.

---

## 🤝 Contributing

```bash
git clone https://github.com/jhlee0409/inner-lens.git
cd inner-lens
npm install
npm run build
npm run dev  # Watch mode
```

---

## 📄 License

[MIT License](LICENSE) © 2025 jack

---

<p align="center">
  Made with ❤️ for the developer community
</p>
