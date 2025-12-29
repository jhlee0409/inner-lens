# 🔍 inner-lens

[![Universal Framework Support](https://img.shields.io/badge/Works%20with-React%20%7C%20Vue%20%7C%20Vanilla%20JS-blue)](https://github.com/jhlee0409/inner-lens)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org)

**Self-Debugging QA Agent** — Universal bug reporting widget with AI-powered analysis for any frontend framework.

inner-lens is an open-source developer tool that integrates seamlessly into **any web application**, enabling users to report bugs with captured console logs that are automatically analyzed by AI.

## ✨ Features

- **🌐 Universal Framework Support** — Works with React, Vue, Svelte, vanilla JS, and more
- **🚀 Zero-Config Setup** — One command to get started: `npx inner-lens init`
- **🤖 Universal LLM Support** — Choose from Anthropic (Claude), OpenAI (GPT-4o), or Google (Gemini)
- **🔒 Security-First** — Automatic masking of emails, API keys, tokens, and PII
- **📱 Lightweight Widget** — Clean, accessible UI with zero external CSS dependencies
- **⚡ Multi-Backend Support** — Works with Express, Fastify, Hono, Next.js, Koa, and more
- **🎨 Customizable** — Inline styles prevent conflicts with your app's design system

## 📦 Installation

```bash
npm install inner-lens
```

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

Choose your backend framework:

<details>
<summary><b>Next.js App Router</b></summary>

```ts
// app/api/inner-lens/report/route.ts
import { createFetchHandler } from 'inner-lens/server';

export const POST = createFetchHandler({
  githubToken: process.env.GITHUB_TOKEN!,
  repository: process.env.GITHUB_REPOSITORY!,
});
```

</details>

<details>
<summary><b>Express</b></summary>

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

</details>

<details>
<summary><b>Fastify</b></summary>

```ts
import Fastify from 'fastify';
import { createFastifyHandler } from 'inner-lens/server';

const fastify = Fastify();

fastify.post('/api/inner-lens/report', createFastifyHandler({
  githubToken: process.env.GITHUB_TOKEN!,
  repository: 'owner/repo',
}));
```

</details>

<details>
<summary><b>Hono / Bun / Deno</b></summary>

```ts
import { Hono } from 'hono';
import { createFetchHandler } from 'inner-lens/server';

const app = new Hono();
const handler = createFetchHandler({
  githubToken: process.env.GITHUB_TOKEN!,
  repository: 'owner/repo',
});

app.post('/api/inner-lens/report', (c) => handler(c.req.raw));
```

</details>

<details>
<summary><b>Koa</b></summary>

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

</details>

<details>
<summary><b>Node.js HTTP</b></summary>

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

---

## 🛠️ CLI Setup

Initialize GitHub Actions workflow:

```bash
npx inner-lens init
```

This interactive CLI will:
- Ask which AI provider you want to use
- Generate the GitHub Actions workflow
- Provide instructions for setting up secrets

### CLI Options

```bash
# Initialize with specific provider
npx inner-lens init --provider anthropic

# Eject mode (full workflow source)
npx inner-lens init --eject

# Skip prompts, use defaults
npx inner-lens init -y

# Check configuration
npx inner-lens check
```

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
| `onSuccess` | `function` | - | Success callback |
| `onError` | `function` | - | Error callback |

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
