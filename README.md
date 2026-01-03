# inner-lens

[![Universal Framework Support](https://img.shields.io/badge/Works%20with-React%20%7C%20Vue%20%7C%20Vanilla%20JS-blue)](https://github.com/jhlee0409/inner-lens)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org)

**Self-Debugging QA Agent** — Universal bug reporting widget with AI-powered analysis.

inner-lens captures console logs, network requests, and session replays when users report bugs. Issues are created on GitHub and automatically analyzed by AI to suggest fixes.

## Features

- **Universal Framework Support** — React, Vue, Svelte, vanilla JS, and more
- **AI-Powered Analysis** — Anthropic Claude, OpenAI GPT-4, or Google Gemini
- **Automatic Data Capture** — Console logs, network errors, DOM state
- **Security-First** — PII, API keys, and tokens are masked automatically
- **Multi-Language** — Analysis in 8 languages (EN, KO, JA, ZH, ES, DE, FR, PT)
- **Zero External CSS** — Inline styles prevent conflicts with your design

---

## Quick Start (2 minutes)

The fastest way to get started is with our **Hosted API** — no backend setup required.

### Step 1: Install

```bash
npm install inner-lens
```

### Step 2: Install GitHub App

Visit [github.com/apps/inner-lens-app](https://github.com/apps/inner-lens-app) and install it on your repository.

### Step 3: Add Widget

**React / Next.js:**
```tsx
import { InnerLensWidget } from 'inner-lens/react';

function App() {
  return (
    <>
      <YourApp />
      <InnerLensWidget
        endpoint="https://inner-lens-one.vercel.app/api/report"
        repository="your-org/your-repo"
      />
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
  <InnerLensWidget
    endpoint="https://inner-lens-one.vercel.app/api/report"
    repository="your-org/your-repo"
  />
</template>
```

**Vanilla JS:**
```js
import { InnerLens } from 'inner-lens/vanilla';

const widget = new InnerLens({
  endpoint: 'https://inner-lens-one.vercel.app/api/report',
  repository: 'your-org/your-repo',
});
widget.mount();
```

That's it! Bug reports will be created by `inner-lens-app[bot]` on your repository.

---

## Setup AI Analysis

To enable AI-powered analysis on bug reports, add a GitHub Actions workflow.

### Option A: CLI (Recommended)

```bash
npx inner-lens init
```

The CLI will:
- Ask which AI provider you prefer
- Generate the workflow file
- Provide instructions for setting up secrets

### Option B: Manual Setup

Create `.github/workflows/inner-lens.yml`:

```yaml
name: inner-lens Analysis

on:
  issues:
    types: [opened]  # Triggers once on issue creation

  workflow_dispatch:  # Manual trigger for existing issues
    inputs:
      issue_number:
        description: 'Issue number to analyze'
        required: true
        type: number

jobs:
  analyze:
    if: contains(github.event.issue.labels.*.name, 'inner-lens')
    uses: jhlee0409/inner-lens/.github/workflows/analysis-engine.yml@v1
    with:
      provider: 'anthropic'  # or 'openai', 'google'
      language: 'en'         # en, ko, ja, zh, es, de, fr, pt
    secrets:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

Add your API key to **Settings → Secrets and variables → Actions**.

### AI Provider Options

| Provider | Default Model | API Key Secret |
|----------|---------------|----------------|
| Anthropic | `claude-sonnet-4-5` | `ANTHROPIC_API_KEY` |
| OpenAI | `gpt-4.1` | `OPENAI_API_KEY` |
| Google | `gemini-2.0-flash` | `GOOGLE_GENERATIVE_AI_API_KEY` |

### Workflow Options

| Input | Default | Description |
|-------|---------|-------------|
| `provider` | `anthropic` | AI provider |
| `model` | (auto) | Custom model name |
| `language` | `en` | Output language (en, ko, ja, zh, es, de, fr, pt) |
| `max_files` | `25` | Maximum files to analyze |

---

## Self-Hosted Backend (Advanced)

If you prefer to run your own backend instead of using the hosted API:

<details>
<summary><b>Self-Hosted Setup Instructions</b></summary>

### Why Self-Host?

- Full control over data flow
- Custom domain
- No rate limits
- Private repository support without installing the GitHub App

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | [Personal Access Token](https://github.com/settings/tokens/new) with `repo` scope |
| `GITHUB_REPOSITORY` | `owner/repo` format |

### Next.js / Vercel

```ts
// app/api/inner-lens/report/route.ts
import { createFetchHandler } from 'inner-lens/server';

export const POST = createFetchHandler({
  githubToken: process.env.GITHUB_TOKEN!,
  repository: 'owner/repo',
});
```

### Express

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

### Other Frameworks

| Framework | Handler |
|-----------|---------|
| Fastify | `createFastifyHandler()` |
| Koa | `createKoaHandler()` |
| Hono / Bun / Deno | `createFetchHandler()` |
| Node.js HTTP | `createNodeHandler()` |

### Widget Configuration (Self-Hosted)

```tsx
<InnerLensWidget
  endpoint="/api/inner-lens/report"  // Your endpoint
  repository="owner/repo"
/>
```

</details>

<details>
<summary><b>Cloudflare Workers</b></summary>

### Prerequisites

Enable `nodejs_compat` compatibility flag in `wrangler.toml`:

```toml
name = "inner-lens-worker"
main = "src/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]
```

### Worker Code

```ts
import { createFetchHandler } from 'inner-lens/server';

interface Env {
  GITHUB_TOKEN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    const handler = createFetchHandler({
      githubToken: env.GITHUB_TOKEN,
      repository: 'your-org/your-repo',
    });

    const response = await handler(request);
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, { status: response.status, headers });
  },
};
```

### Deploy

```bash
wrangler secret put GITHUB_TOKEN
wrangler deploy
```

</details>

---

## Configuration

### Widget Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `endpoint` | `string` | `/api/inner-lens/report` | API endpoint URL |
| `repository` | `string` | - | GitHub repository in `owner/repo` format |
| `devOnly` | `boolean` | `true` | Hide in production |
| `disabled` | `boolean` | `false` | Disable widget |

### Styling

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `position` | `string` | `bottom-right` | `bottom-right`, `bottom-left`, `top-right`, `top-left` |
| `buttonColor` | `string` | `#6366f1` | Button background color |

### UI Text

| Option | Default | Description |
|--------|---------|-------------|
| `buttonText` | `Report a bug` | Button tooltip |
| `dialogTitle` | `Report an Issue` | Dialog title |
| `submitText` | `Submit Report` | Submit button text |

### Callbacks

| Option | Type | Description |
|--------|------|-------------|
| `onOpen` | `() => void` | Dialog opened |
| `onClose` | `() => void` | Dialog closed |
| `onSuccess` | `(url?: string) => void` | Report submitted |
| `onError` | `(error: Error) => void` | Submission failed |

### Production Usage

By default, the widget is hidden in production (`devOnly: true`). To enable:

```tsx
<InnerLensWidget devOnly={false} />
```

---

## Session Replay (Optional)

Capture DOM-level recordings for visual bug reproduction.

### Setup

```bash
npm install rrweb
```

### Usage

```ts
import { startSessionReplay, getSessionReplaySnapshot } from 'inner-lens/replay';

// Start recording early in app lifecycle
await startSessionReplay({
  maxBufferDuration: 60000,  // Keep last 60 seconds
  maskInputs: true,
});

// Get data when submitting bug report
const replayData = getSessionReplaySnapshot();
```

### Privacy Controls

```ts
await startSessionReplay({
  blockSelectors: ['.credit-card-form'],  // Hide completely
  maskSelectors: ['.pii', '.user-email'], // Mask content
  maskInputs: true,                       // Mask all inputs
});
```

---

## Security

### Automatic Data Masking

Sensitive data is masked before submission and AI analysis:

| Pattern | Replaced With |
|---------|---------------|
| Email addresses | `[EMAIL_REDACTED]` |
| API keys | `[OPENAI_KEY_REDACTED]`, etc. |
| Bearer tokens | `Bearer [TOKEN_REDACTED]` |
| JWTs | `[JWT_REDACTED]` |
| Credit cards | `[CARD_REDACTED]` |
| SSN | `[SSN_REDACTED]` |
| Phone numbers | `[PHONE_REDACTED]` |

---

## API Reference

### Client

| Package | Export | Description |
|---------|--------|-------------|
| `inner-lens/react` | `InnerLensWidget` | React component |
| `inner-lens/react` | `useInnerLens` | React hook |
| `inner-lens/vue` | `InnerLensWidget` | Vue component |
| `inner-lens/vue` | `useInnerLens` | Vue composable |
| `inner-lens/vanilla` | `InnerLens` | Vanilla JS class |
| `inner-lens/replay` | `startSessionReplay` | Start recording |
| `inner-lens/replay` | `stopSessionReplay` | Stop and get data |

### Server

| Export | Description |
|--------|-------------|
| `createFetchHandler` | Next.js, Hono, Bun, Deno |
| `createExpressHandler` | Express middleware |
| `createFastifyHandler` | Fastify handler |
| `createKoaHandler` | Koa middleware |
| `createNodeHandler` | Node.js HTTP |

---

## Troubleshooting

### Widget doesn't appear

1. Check `disabled` and `devOnly` props
2. Verify import path matches your framework
3. Check browser console for errors

### Bug report fails

1. Verify endpoint URL is correct
2. For hosted mode: ensure GitHub App is installed
3. For self-hosted: check `GITHUB_TOKEN` has `repo` scope

### AI analysis not running

1. Verify workflow file exists at `.github/workflows/`
2. Check API key is set in repository secrets
3. Ensure issue has `inner-lens` label

---

## FAQ

<details>
<summary><b>Hosted vs Self-Hosted?</b></summary>

**Hosted (Recommended):**
- No backend setup
- No token management
- Issues created by `inner-lens-app[bot]`
- Rate limited (10 req/min/IP)

**Self-Hosted:**
- Full control
- No rate limits
- Requires your own backend
- Issues created by your GitHub token owner

</details>

<details>
<summary><b>Does it work with SSR?</b></summary>

Yes. The widget renders client-side only. For Next.js, use `'use client'` or dynamic import.

</details>

<details>
<summary><b>Which AI provider is best?</b></summary>

| Provider | Best For |
|----------|----------|
| Anthropic | Code understanding |
| OpenAI | Speed |
| Google | Cost |

</details>

---

## Contributing

```bash
git clone https://github.com/jhlee0409/inner-lens.git
cd inner-lens
npm install
npm run test
npm run build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## License

[MIT License](LICENSE) © 2025 jack
