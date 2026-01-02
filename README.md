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

Choose one of the following setup methods:

### Option A: Automated Setup (Recommended)

```bash
# The CLI wizard installs the package, generates API routes, and sets up GitHub Actions
npx create-inner-lens
```

### Option B: Manual Installation

```bash
npm install inner-lens
```

> 💡 **Option A vs B**: Use Option A if you want a guided setup that configures everything automatically. Use Option B if you prefer manual control or are adding to an existing project.

---

## 🚀 Quick Start

After installation, add the widget to your app:

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
<summary><b>🔶 Svelte / SvelteKit</b> <i>(via vanilla wrapper)</i></summary>

Svelte uses the framework-agnostic vanilla wrapper:

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

<slot />
```

</details>

<details>
<summary><b>🚀 Astro</b> <i>(via vanilla wrapper)</i></summary>

Astro uses the framework-agnostic vanilla wrapper in a client-side script:

```astro
---
// No server-side code needed
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

> **Tip:** For Astro with React islands, you can also use `inner-lens/react` in React components.

</details>

---

## 🖥️ Backend Setup

A backend API is required to send bug reports to GitHub Issues.

### Web Fetch API (Recommended)

For environments supporting Web Standards (Next.js, Vercel, Netlify, Cloudflare Workers, Hono, Bun, Deno):

```ts
// Next.js: app/api/inner-lens/report/route.ts
// Vercel: api/inner-lens/report.ts
// Cloudflare Workers: src/index.ts
import { createFetchHandler } from 'inner-lens/server';

export const POST = createFetchHandler({
  githubToken: process.env.GITHUB_TOKEN!,
  repository: 'owner/repo', // or process.env.GITHUB_REPOSITORY
});
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | [Personal Access Token](https://github.com/settings/tokens/new) (requires `repo` scope) |
| `GITHUB_REPOSITORY` | `owner/repo` format (optional) |

<details>
<summary><b>Other Frameworks (Express, Fastify, Koa, Node.js)</b></summary>

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
<summary><b>Cloudflare Workers Full Example</b></summary>

### Prerequisites

`inner-lens/server` uses `@octokit/rest` which requires Node.js APIs. You must enable the `nodejs_compat` compatibility flag.

---

### Option A: Wrangler CLI (Recommended)

Use this method if you want to use the `inner-lens` npm package.

**1. Create a new Worker project:**

```bash
npm create cloudflare@latest my-bug-reporter
cd my-bug-reporter
npm install inner-lens
```

**2. Configure `wrangler.toml`:**

```toml
name = "my-bug-reporter"
main = "src/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]
```

**3. Write `src/index.ts`:**

```ts
import { createFetchHandler } from 'inner-lens/server';

interface Env {
  GITHUB_TOKEN: string;
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
        repository: 'your-username/your-repo',  // Hardcode your repo
      });
      const response = await handler(request);

      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(response.body, { status: response.status, headers });
    }

    return new Response('Method not allowed', { status: 405 });
  },
};
```

**4. Deploy:**

```bash
wrangler secret put GITHUB_TOKEN
wrangler deploy
```

---

### Option B: Dashboard GUI Only (No npm packages)

Use this method if you want to set up everything via the Cloudflare Dashboard without CLI.

> ⚠️ **Important:** Dashboard Quick Edit cannot import npm packages. You must use the standalone code below that calls GitHub API directly.

**1. Create a Worker in Dashboard:**

Go to **Workers & Pages → Create → Create Worker**

**2. Configure Compatibility Settings:**

Go to **Settings → Build** and configure:

| Setting | Value |
|---------|-------|
| Compatibility date | `2025-01-01` |
| Compatibility flags | `nodejs_compat` (type manually, not in dropdown) |

> 💡 **Note:** `nodejs_compat` is NOT in the dropdown list. You must type it directly into the input field.

**3. Set Environment Variables:**

Go to **Settings → Variables and Secrets**:

| Name | Type |
|------|------|
| `GITHUB_TOKEN` | Secret (Encrypt) |

**4. Edit Code (Quick Edit):**

Replace the default code with:

```js
export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, message: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    try {
      const payload = await request.json();

      if (!payload.description || typeof payload.description !== 'string') {
        return new Response(JSON.stringify({ success: false, message: 'description is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const result = await createGitHubIssue(payload, env.GITHUB_TOKEN);

      return new Response(JSON.stringify(result), {
        status: result.success ? 201 : 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ success: false, message: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};

async function createGitHubIssue(payload, token) {
  // ⚠️ Change this to your repository
  const owner = 'your-username';
  const repo = 'your-repo';

  const formattedLogs = (payload.logs || [])
    .slice(-20)
    .map(log => `[${new Date(log.timestamp).toISOString()}] [${log.level?.toUpperCase() || 'LOG'}] ${log.message}`)
    .join('\n');

  const issueBody = `## Bug Report

### Description
${payload.description}

### Environment
- **URL:** ${payload.url || 'N/A'}
- **User Agent:** ${payload.userAgent || 'N/A'}
- **Reported At:** ${new Date(payload.timestamp || Date.now()).toISOString()}

### Console Logs
\`\`\`
${formattedLogs || 'No logs captured'}
\`\`\`

---
*This issue was automatically created by [inner-lens](https://github.com/jhlee0409/inner-lens).*
*Awaiting AI analysis...*`;

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'inner-lens-worker',
    },
    body: JSON.stringify({
      title: `[Bug Report] ${payload.description.slice(0, 80)}${payload.description.length > 80 ? '...' : ''}`,
      body: issueBody,
      labels: ['bug', 'inner-lens'],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${error}`);
  }

  const issue = await response.json();
  return {
    success: true,
    issueUrl: issue.html_url,
    issueNumber: issue.number,
  };
}
```

**5. Save and Deploy**

Click **Save and deploy** in the Quick Edit interface.

---

### Custom Entry Point

You can change the entry point path in `wrangler.toml`:

```toml
main = "src/inner-lens/index.ts"  # Custom path
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
| `disabled` | `boolean` | `false` | Disable widget |
| `devOnly` | `boolean` | `true` | **Auto-disable in production** — When `true`, widget is hidden if `NODE_ENV === 'production'` or `import.meta.env.PROD === true`. Set to `false` to enable in production. |
| `onSuccess` | `function` | - | Success callback with issue URL |
| `onError` | `function` | - | Error callback |

### Styling Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `position` | `string` | `bottom-right` | Button position (`bottom-right`, `bottom-left`, `top-right`, `top-left`) |
| `buttonColor` | `string` | `#6366f1` | Button background color |

<details>
<summary><b>Legacy Styling (Backward Compatible)</b></summary>

The `styles` object is still supported for backward compatibility. Top-level props are preferred for cleaner syntax:

| Legacy Option | Preferred |
|---------------|-----------|
| `styles.buttonColor` | `buttonColor` |
| `styles.buttonPosition` | `position` |

Both approaches work in all frameworks (React, Vue, Vanilla JS):

```tsx
// Preferred: top-level props
<InnerLensWidget position="bottom-left" buttonColor="#10b981" />

// Legacy: styles object (still works)
<InnerLensWidget styles={{ buttonPosition: "bottom-left", buttonColor: "#10b981" }} />
```

</details>

### UI Text Customization

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `buttonText` | `string` | `Report a bug` | Trigger button aria-label and title |
| `dialogTitle` | `string` | `Report an Issue` | Dialog header title |
| `dialogDescription` | `string` | `Describe the issue` | Textarea label text |
| `submitText` | `string` | `Submit Report` | Submit button text |
| `cancelText` | `string` | `Cancel` | Cancel button text |
| `successMessage` | `string` | `Report Submitted` | Success state title |

### Lifecycle Callbacks

| Option | Type | Description |
|--------|------|-------------|
| `onOpen` | `() => void` | Called when dialog opens |
| `onClose` | `() => void` | Called when dialog closes |
| `onSuccess` | `(issueUrl?: string) => void` | Called on successful submission |
| `onError` | `(error: Error) => void` | Called on submission error |

> ⚠️ **Production Usage:** By default (`devOnly: true`), the widget is automatically hidden in production. To enable bug reporting from real users in production:
> ```tsx
> <InnerLensWidget devOnly={false} />
> ```

---

## 🎬 Session Replay (Optional)

inner-lens supports DOM-level session recording via [rrweb](https://www.rrweb.io/), providing visual reproduction of bugs regardless of console logging practices.

### Installation

Session replay requires rrweb as an optional peer dependency:

```bash
npm install rrweb
```

### Usage

```tsx
import { startSessionReplay, stopSessionReplay, getSessionReplaySnapshot } from 'inner-lens/replay';

// Start recording early in your app lifecycle
await startSessionReplay({
  maxBufferDuration: 60000,  // Keep last 60 seconds
  maskInputs: true,          // Mask all input values
});

// Get replay data when submitting bug report
const replayData = getSessionReplaySnapshot();

// Or stop recording and get data
const replayData = stopSessionReplay();
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxBufferDuration` | `number` | `60000` | Maximum recording duration to keep (ms) |
| `checkoutInterval` | `number` | `30000` | Interval for creating new snapshots (ms) |
| `maskInputs` | `boolean` | `true` | Mask all input field values |
| `blockSelectors` | `string[]` | `[]` | CSS selectors for elements to hide completely |
| `maskSelectors` | `string[]` | `['.sensitive', '[data-sensitive]', '.pii']` | CSS selectors for elements to mask |
| `onStart` | `() => void` | - | Callback when recording starts |
| `onStop` | `() => void` | - | Callback when recording stops |
| `onError` | `(error: Error) => void` | - | Callback on error |

### Privacy Controls

```tsx
await startSessionReplay({
  // Hide sensitive elements completely
  blockSelectors: ['.credit-card-form', '#ssn-input'],

  // Mask text content (shows placeholder)
  maskSelectors: ['.pii', '[data-sensitive]', '.user-email'],

  // Always mask all input values
  maskInputs: true,
});
```

### API Reference

| Export | Description |
|--------|-------------|
| `startSessionReplay(config?)` | Start recording (async) |
| `stopSessionReplay()` | Stop and return captured data |
| `getSessionReplaySnapshot()` | Get current data without stopping |
| `isRecording()` | Check if currently recording |
| `compressReplayData(data)` | Compress for transmission (async) |
| `calculateReplayQualityScore(data)` | Get quality score for debugging |

> **Bundle Size Note:** Session replay adds ~77KB gzipped when used. rrweb is loaded on-demand to minimize initial bundle impact.

---

## 🔐 Security

### Data Masking

inner-lens automatically masks sensitive data before submission:

| Pattern | Replaced With |
|---------|---------------|
| Email addresses | `[EMAIL_REDACTED]` |
| Bearer tokens | `Bearer [TOKEN_REDACTED]` |
| Authorization headers | `[AUTH_REDACTED]` |
| JWTs | `[JWT_REDACTED]` |
| Credit card numbers | `[CARD_REDACTED]` |
| SSN (US Social Security) | `[SSN_REDACTED]` |
| Phone numbers | `[PHONE_REDACTED]` |
| IPv4 addresses | `[IP_REDACTED]` |
| Database URLs | `[DATABASE_URL_REDACTED]` |
| Private keys (PEM) | `[PRIVATE_KEY_REDACTED]` |

**Provider-Specific API Keys:**

| Provider | Replaced With |
|----------|---------------|
| OpenAI (`sk-...`) | `[OPENAI_KEY_REDACTED]` |
| Anthropic (`sk-ant-...`) | `[ANTHROPIC_KEY_REDACTED]` |
| Google (`AIza...`) | `[GOOGLE_KEY_REDACTED]` |
| AWS Access Key (`AKIA...`) | `[AWS_KEY_REDACTED]` |
| AWS Secret Key | `[AWS_SECRET_REDACTED]` |
| GitHub Token (`ghp_...`) | `[GITHUB_TOKEN_REDACTED]` |
| Stripe (`sk_live_...`) | `[STRIPE_KEY_REDACTED]` |
| Generic secrets/passwords | `[SECRET_REDACTED]` |

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
| `inner-lens/replay` | `startSessionReplay` | Start session recording |
| `inner-lens/replay` | `stopSessionReplay` | Stop and get replay data |
| `inner-lens/replay` | `getSessionReplaySnapshot` | Get current replay data |

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
- Email addresses → `[EMAIL_REDACTED]`
- API keys (OpenAI, Anthropic, etc.) → `[OPENAI_KEY_REDACTED]`, `[ANTHROPIC_KEY_REDACTED]`
- Bearer tokens → `Bearer [TOKEN_REDACTED]`
- Credit card numbers → `[CARD_REDACTED]`
- And more (see [Security](#-security) section for full list)

Masking happens on both client-side (before submission) and server-side (before AI analysis).

</details>

<details>
<summary><b>Can I use inner-lens in production?</b></summary>

Yes! inner-lens is designed for production use. By default, the widget is hidden in production (`devOnly: true`). To enable it:

```tsx
// Enable bug reporting from real users in production
<InnerLensWidget devOnly={false} />
```

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

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

```bash
git clone https://github.com/jhlee0409/inner-lens.git
cd inner-lens
npm install
npm run test     # Run tests
npm run build    # Build all packages
npm run dev      # Watch mode
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for coding standards, PR process, and more.

---

## 📄 License

[MIT License](LICENSE) © 2025 jack

---

<p align="center">
  Made with ❤️ for the developer community
</p>
