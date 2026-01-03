# CLAUDE.md - AI Assistant Guide for inner-lens

Essential context for AI assistants working with the inner-lens codebase.

## Project Overview

**inner-lens** is a Self-Debugging QA Agent — a universal bug reporting widget with AI-powered analysis. It captures console logs, network requests, and session replays, creates GitHub issues, and uses AI to analyze bugs and suggest fixes.

### How It Works

1. User reports a bug via the embedded widget
2. Console logs, network requests, and optionally DOM state are captured
3. Sensitive data is masked client-side
4. Bug report is sent to either:
   - **Hosted API** (`inner-lens-one.vercel.app`) — uses GitHub App
   - **Self-hosted backend** — uses user's GitHub token
5. GitHub issue is created with structured format
6. GitHub Actions workflow triggers AI analysis
7. AI posts a comment with root cause and fix suggestions

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │
│  │ Widget UI   │  │ Log Capture │  │ Session Replay (rrweb)  │   │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘   │
│         └────────────────┴──────────────────────┘                │
│                              │                                    │
│                    POST /api/report                               │
└──────────────────────────────┼───────────────────────────────────┘
                               │
          ┌────────────────────┴────────────────────┐
          ▼                                         ▼
┌──────────────────────┐               ┌──────────────────────┐
│    Hosted API        │               │   Self-Hosted API    │
│  (Vercel + GitHub    │               │   (User's server +   │
│   App)               │               │    GitHub Token)     │
└──────────┬───────────┘               └──────────┬───────────┘
           │                                      │
           └──────────────┬───────────────────────┘
                          ▼
              ┌──────────────────────┐
              │   GitHub Issues API  │
              │   (Create Issue)     │
              └──────────┬───────────┘
                         ▼
              ┌──────────────────────┐
              │  GitHub Actions      │
              │  (AI Analysis)       │
              └──────────────────────┘
```

## Tech Stack

| Category | Technology |
|----------|------------|
| Language | TypeScript (ES2022, strict mode) |
| Build | tsup (ESM + CJS dual output) |
| Testing | Vitest with jsdom |
| Validation | Zod schemas |
| Session Replay | rrweb |
| AI | Vercel AI SDK (@ai-sdk/anthropic, @ai-sdk/openai, @ai-sdk/google) |
| GitHub | Octokit REST, @octokit/app (for hosted mode) |
| CLI | Commander, @clack/prompts |

## Project Structure

```
inner-lens/
├── src/
│   ├── core.ts              # Main export (framework-agnostic)
│   ├── react.ts             # React widget + hooks
│   ├── vue.ts               # Vue component + composables
│   ├── vanilla.ts           # Vanilla JS with auto-init
│   ├── server.ts            # Backend handlers (self-hosted)
│   ├── replay.ts            # Session replay (rrweb)
│   ├── cli.ts               # CLI entry point
│   ├── types.ts             # Shared TypeScript types
│   ├── core/
│   │   └── InnerLensCore.ts # Widget logic
│   ├── components/
│   │   └── InnerLensWidget.tsx
│   ├── hooks/
│   │   └── useInnerLens.ts
│   └── utils/
│       ├── masking.ts       # Sensitive data masking
│       ├── log-capture.ts   # Console + network interceptor
│       ├── session-replay.ts
│       ├── analysis.ts      # Code analysis utilities
│       └── styles.ts        # Inline CSS
├── api/                     # Vercel Serverless (Hosted Mode)
│   ├── report.ts            # POST /api/report
│   └── health.ts            # GET /api/health
├── scripts/
│   └── analyze-issue.ts     # AI analysis engine
├── .github/workflows/
│   ├── test.yml             # CI
│   ├── analyze-issues.yml   # Trigger workflow
│   └── analysis-engine.yml  # Reusable AI analysis
└── docs/
    └── CENTRALIZED_SETUP.md # Server admin guide
```

## Key Files

| File | Purpose |
|------|---------|
| `api/report.ts` | Hosted API endpoint (GitHub App auth) |
| `src/server.ts` | Self-hosted backend handlers |
| `src/core/InnerLensCore.ts` | Widget state + DOM |
| `src/utils/masking.ts` | 18+ sensitive data patterns |
| `scripts/analyze-issue.ts` | AI analysis with CoT prompts |

## Development

```bash
npm run build        # Build all packages
npm run dev          # Watch mode
npm run test         # Run tests
npm run typecheck    # Type checking
```

## Deployment Modes

### Hosted Mode (Recommended)

- Endpoint: `https://inner-lens-one.vercel.app/api/report`
- Auth: GitHub App (`inner-lens-app`)
- Issues created by: `inner-lens-app[bot]`
- Rate limit: 10 req/min/IP

**Environment Variables (Vercel):**
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY`

### Self-Hosted Mode

- Endpoint: User-defined
- Auth: GitHub Personal Access Token
- Issues created by: Token owner

**Environment Variables:**
- `GITHUB_TOKEN`
- `GITHUB_REPOSITORY`

## Code Patterns

### Data Masking

```typescript
// src/utils/masking.ts
const MASKING_PATTERNS = [
  { pattern: /email-regex/g, replacement: '[EMAIL]' },
  { pattern: /api-key-regex/g, replacement: '[API_KEY]' },
  // ... 18+ patterns
];
```

### Server Handler

```typescript
// src/server.ts
export function createFetchHandler(config) {
  return async (request) => {
    const result = await handleBugReport(body, config);
    return new Response(JSON.stringify(result));
  };
}
```

### GitHub App Auth

```typescript
// api/report.ts
const app = new App({
  appId: process.env.GITHUB_APP_ID,
  privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
});
const octokit = await app.getInstallationOctokit(installationId);
```

## Testing

- Tests in `*.test.ts` files
- Use Vitest with jsdom
- Mock external dependencies

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('function', () => {
  it('should work', () => {
    expect(result).toBe(expected);
  });
});
```

## Code Style

1. TypeScript strict mode
2. ESM first (`"type": "module"`)
3. `import type { }` for type imports
4. Target ES2022
5. No external CSS (inline styles only)

## CRITICAL: Post-Change Verification

**After ANY code change, ALWAYS run these checks before committing:**

```bash
npm run typecheck    # REQUIRED - Must pass
npm run test         # REQUIRED - Must pass
# npm run build      # Skip (slow) - CI will catch build errors
```

### When to Run Full Verification

| Change Type | typecheck | test | Consistency Check |
|-------------|-----------|------|-------------------|
| src/**/*.ts, src/**/*.tsx | ✅ | ✅ | ✅ |
| api/**/*.ts | ✅ | ✅ | ✅ |
| scripts/**/*.ts | ✅ | - | ✅ |
| .github/workflows/** | - | - | ✅ |
| README.md, docs/** | - | - | ✅ |

### Consistency Check Required Files

When modifying **any** of these, verify ALL related files match:

| If you change... | Also check... |
|------------------|---------------|
| Widget props (`src/types.ts`) | `InnerLensWidget.tsx`, `InnerLensCore.ts`, `vue.ts`, README, docs |
| API payload structure | `api/report.ts`, `src/server.ts`, `src/types.ts` (BugReportPayload) |
| CLI examples (`src/cli.ts`) | README.md, docs/CENTRALIZED_SETUP.md |
| Workflow files | README.md (workflow examples), CLI generated code |

### Common Type Errors to Avoid

```typescript
// ❌ BAD: split() returns (string | undefined)[]
const [owner, repo] = repository.split('/');

// ✅ GOOD: Handle undefined
const [parsedOwner, parsedRepo] = repository.split('/');
owner = parsedOwner || '';
repo = parsedRepo || '';

// ❌ BAD: Optional chaining without fallback
const value = obj?.prop;  // type: T | undefined

// ✅ GOOD: Provide default
const value = obj?.prop ?? defaultValue;
```

### Data Flow Consistency

```
Widget Props (InnerLensConfig)
       ↓
  repository: "owner/repo"
       ↓
Payload (BugReportPayload)
       ↓
  owner: string, repo: string  ← Must be parsed!
       ↓
API Validation
       ↓
  Hosted: owner/repo required
  Self-hosted: config.repository used
```

**ALWAYS verify this flow works end-to-end when changing any part.**

## Important Notes

1. **Security**: Always mask data before AI processing
2. **Bundle Size**: Session replay adds ~77KB (loaded on-demand)
3. **SSR Safe**: Widget renders client-side only
4. **Peer Dependencies**: React and Vue are optional
