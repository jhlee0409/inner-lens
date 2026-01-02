# CLAUDE.md - AI Assistant Guide for inner-lens

This document provides essential context for AI assistants working with the inner-lens codebase.

## Project Overview

**inner-lens** is a Self-Debugging QA Agent - a universal bug reporting widget with AI-powered analysis. It captures console logs, network requests, session replays, masks sensitive data, creates GitHub issues, and uses AI to analyze bugs and suggest fixes.

### Core Value Proposition
1. Users report bugs via an embedded widget
2. Console logs + network requests + session replay are captured automatically
3. Sensitive data is masked client-side and server-side
4. GitHub issue is created with structured format
5. AI analyzes the issue and provides root cause + fix suggestions

### Data Collection Philosophy
The system prioritizes **consistent, equal-quality data collection** across all environments:
- **Automatic capture** reduces dependency on developer logging practices
- **Session replay (rrweb)** provides visual reproduction regardless of console logs
- **Network interceptor** captures API calls uniformly
- **Structured validation** ensures all reports meet minimum quality standards

## Tech Stack

| Category | Technology |
|----------|------------|
| Language | TypeScript (ES2022, strict mode) |
| Build | tsup (ESM + CJS dual output) |
| Testing | Vitest with jsdom |
| Validation | Zod schemas |
| Session Replay | rrweb (DOM recording/playback) |
| AI | Vercel AI SDK (@ai-sdk/anthropic, @ai-sdk/openai, @ai-sdk/google) |
| GitHub | Octokit REST client |
| CLI | Commander, @clack/prompts, Chalk, fs-extra |

## Project Structure

```
inner-lens/
├── src/
│   ├── core.ts              # Main export (framework-agnostic)
│   ├── react.ts             # React widget + hooks export
│   ├── vue.ts               # Vue component + composables export
│   ├── vanilla.ts           # Vanilla JS with auto-init export
│   ├── server.ts            # Backend handlers export
│   ├── replay.ts            # Session replay export (rrweb)
│   ├── cli.ts               # CLI entry point (inner-lens command)
│   ├── create.ts            # create-inner-lens wrapper
│   ├── types.ts             # Shared TypeScript types
│   ├── core/
│   │   └── InnerLensCore.ts # Framework-agnostic widget class
│   ├── components/
│   │   └── InnerLensWidget.tsx  # React UI component
│   ├── hooks/
│   │   └── useInnerLens.ts  # React hook for programmatic control
│   └── utils/
│       ├── masking.ts       # Sensitive data masking engine
│       ├── log-capture.ts   # Console + network interceptor
│       ├── session-replay.ts # rrweb integration module
│       ├── analysis.ts      # Analysis utilities (error extraction, code chunking)
│       └── styles.ts        # Inline CSS generation
├── scripts/
│   └── analyze-issue.ts     # AI analysis engine (GitHub Actions)
├── .github/workflows/
│   ├── test.yml             # CI: tests + build
│   ├── analyze-issues.yml   # Trigger: runs analysis on new bug issues
│   └── analysis-engine.yml  # Reusable: AI analysis engine (called by analyze-issues.yml)
├── tsup.config.ts           # Build configuration (8 separate builds)
├── vitest.config.ts         # Test configuration
└── tsconfig.json            # TypeScript configuration
```

## Package Exports

The package uses conditional exports for different environments:

| Import Path | Entry File | Purpose | Bundle Size |
|-------------|-----------|---------|-------------|
| `inner-lens` | `src/core.ts` | Framework-agnostic core | ~32 KB |
| `inner-lens/react` | `src/react.ts` | React components (has "use client" banner) | ~45 KB |
| `inner-lens/vue` | `src/vue.ts` | Vue 3 components | ~35 KB |
| `inner-lens/vanilla` | `src/vanilla.ts` | Vanilla JS with auto-init | ~36 KB |
| `inner-lens/server` | `src/server.ts` | Backend handlers | ~10 KB |
| `inner-lens/replay` | `src/replay.ts` | Session replay (rrweb) | ~6 KB (+77 KB runtime) |

### CLI Binaries
| Command | Entry File | Purpose |
|---------|-----------|---------|
| `inner-lens` | `src/cli.ts` | Interactive setup wizard with `init` and `check` commands |
| `create-inner-lens` | `src/create.ts` | Wrapper that runs `inner-lens init` |

## Development Commands

```bash
npm run build        # Build all packages with tsup
npm run dev          # Watch mode for development
npm run test         # Run tests once
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run typecheck    # TypeScript type checking only
npm run example      # Run vanilla example server
```

## Architecture Patterns

### 1. Framework-Agnostic Core
The `InnerLensCore` class (`src/core/InnerLensCore.ts`) contains all widget logic:
- Widget state management (idle, submitting, success, error)
- DOM manipulation with inline styles
- Log capture integration
- Keyboard accessibility (Escape to close, Tab trap)
- Environment detection (`devOnly` option)

Framework adapters (React, Vue) wrap this core class.

### 2. Universal Server Handlers
`src/server.ts` provides a single `handleBugReport()` function with framework-specific adapters:
- `createFetchHandler()` - Web Fetch API (Next.js App Router, Hono, Bun, Cloudflare Workers)
- `createExpressHandler()` - Express middleware
- `createFastifyHandler()` - Fastify handler
- `createKoaHandler()` - Koa middleware
- `createNodeHandler()` - Node.js http module

### 3. Security-First Data Masking
`src/utils/masking.ts` contains 18+ regex patterns for masking:
- Emails, phone numbers, SSNs, IP addresses
- API keys (OpenAI, Anthropic, Google, AWS, GitHub, Stripe)
- Bearer tokens, JWTs
- Database URLs, private keys (PEM format)
- Credit card numbers

Masking happens on both client (before submission) and server (before AI analysis).

### 4. Zod Schema Validation
All incoming bug reports are validated with the `BugReportSchema` in `src/server.ts`:
```typescript
export const BugReportSchema = z.object({
  description: z.string().min(1).max(10000),
  logs: z.array(z.object({
    level: z.enum(['error', 'warn', 'info', 'log']),
    message: z.string(),
    timestamp: z.number(),
    stack: z.string().optional(),
  })),
  url: z.string().url().or(z.string().length(0)),
  userAgent: z.string(),
  timestamp: z.number(),
  metadata: z.object({...}).optional(),
});
```

### 5. Session Replay (rrweb Integration)
`src/utils/session-replay.ts` provides DOM-level recording independent of console logs:
- Full DOM snapshots for visual reproduction
- Incremental recording (mutations, clicks, scrolls, inputs)
- Privacy controls (input masking, element blocking)
- Quality scoring for replay data
- Compression support for transmission
- Dynamic loading of rrweb to minimize bundle impact

## Data Collection Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Data Collection Layers                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  │
│  │   log-capture.ts        │  │   session-replay.ts     │  │
│  │   (Always Active)       │  │   (Optional)            │  │
│  ├─────────────────────────┤  ├─────────────────────────┤  │
│  │ ✅ fetch requests       │  │ ✅ DOM state            │  │
│  │ ✅ console.error/warn   │  │ ✅ User interactions    │  │
│  │ ✅ uncaught errors      │  │ ✅ Visual changes       │  │
│  │ ✅ promise rejections   │  │ ✅ 100% reproduction    │  │
│  └─────────────────────────┘  └─────────────────────────┘  │
│                                                             │
│                    ↓ Unified Output ↓                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  BugReportPayload                                    │   │
│  │  - description (user input)                          │   │
│  │  - logs[] (network + console)                        │   │
│  │  - sessionReplay? (DOM recording)                    │   │
│  │  - url, userAgent, timestamp                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Key Files to Understand

| File | Purpose |
|------|---------|
| `src/server.ts` | Server handlers + GitHub issue creation with error handling |
| `src/core/InnerLensCore.ts` | Widget state management + DOM manipulation |
| `src/components/InnerLensWidget.tsx` | React UI with dialog, form, status states |
| `src/utils/masking.ts` | 18+ sensitive data regex patterns |
| `src/utils/log-capture.ts` | Console + fetch interceptor |
| `src/utils/session-replay.ts` | rrweb integration for DOM recording |
| `src/utils/analysis.ts` | Error extraction, code chunking, call graph utilities |
| `src/cli.ts` | CLI with GitHub OAuth Device Flow, framework detection |
| `scripts/analyze-issue.ts` | AI analysis engine with Chain-of-Thought prompts |

## Testing

### Test Files
| File | Purpose |
|------|---------|
| `src/utils/masking.test.ts` | Sensitive data masking |
| `src/utils/log-capture.test.ts` | Console/network capture |
| `src/utils/session-replay.test.ts` | rrweb session replay |
| `src/utils/analysis.test.ts` | Error extraction, code chunking |
| `src/server.test.ts` | Server handlers |
| `src/qa-flow.integration.test.ts` | Full QA flow |
| `src/qa-data-quality.test.ts` | Data quality/consistency |

Total: **~145 test cases**

### Test Conventions
- Tests are in `*.test.ts` files alongside source files
- Use Vitest with jsdom environment
- Mock external dependencies (rrweb, Octokit)

Example test pattern:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('functionName', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should do something', () => {
    expect(result).toBe(expected);
  });
});
```

## Code Style Guidelines

1. **TypeScript Strict Mode** - All code must pass strict TypeScript checks
2. **No Unchecked Index Access** - `tsconfig.json` has `noUncheckedIndexedAccess: true`
3. **ESM First** - Package uses ES modules (`"type": "module"`)
4. **Verbatim Module Syntax** - Import types with `import type { ... }`
5. **React JSX** - Uses `react-jsx` transform (no React import needed)
6. **Target ES2022** - Modern JavaScript features allowed
7. **Bundler Module Resolution** - Uses `moduleResolution: "bundler"`

## Common Tasks

### Adding a New Masking Pattern
Edit `src/utils/masking.ts`:
```typescript
const MASKING_PATTERNS: MaskingPattern[] = [
  // Add new pattern
  {
    name: 'pattern_name',
    pattern: /your-regex-here/g,
    replacement: '[REDACTED_LABEL]',
  },
  // ... existing patterns
];
```

### Adding a New Server Handler
Edit `src/server.ts`:
```typescript
export function createNewFrameworkHandler(config: IssueCreatorConfig) {
  return async (/* framework-specific params */) => {
    const result = await handleBugReport(body, config);
    // Return framework-specific response
  };
}
```

### Using Session Replay
```typescript
import { startSessionReplay, stopSessionReplay } from 'inner-lens/replay';

// Start recording (call early in app lifecycle)
await startSessionReplay({
  maxBufferDuration: 60000,  // Keep last 60 seconds
  maskInputs: true,          // Mask all input values
  maskSelectors: ['.pii'],   // Mask specific elements
});

// Get replay data when submitting bug report
const replayData = stopSessionReplay();
// Include replayData in bug report payload
```

### Modifying AI Analysis
Edit `scripts/analyze-issue.ts`:
- `SYSTEM_PROMPT` - Chain-of-Thought methodology with security rules
- `AnalysisResultSchema` - Zod schema for structured output
- `formatAnalysisComment()` - GitHub comment formatting

Key AI analysis features:
- **Chain-of-Thought prompts** - Structured reasoning methodology
- **Structured JSON output** - Using Vercel AI SDK's `generateObject`
- **Report validation** - Distinguishes bugs vs feature requests vs invalid reports
- **Code verification** - Confirms bugs exist in actual code before suggesting fixes
- **Import graph tracking** - Follows dependencies to find related files
- **LLM re-ranking** - Uses fast model to re-rank file candidates
- **AST-like chunking** - Extracts functions/classes for precise context
- **Self-consistency** - Optional multiple analysis runs for verification

## CLI Commands

### `inner-lens init`
Interactive setup wizard:
1. GitHub OAuth Device Flow authentication (or manual token)
2. Framework auto-detection (Next.js, Vite, SvelteKit, etc.)
3. AI provider selection (Anthropic, OpenAI, Google)
4. Backend deployment configuration
5. Automatic file generation (workflow, API route, widget)

### `inner-lens check`
Verifies configuration:
- GitHub workflow file exists
- Framework detected
- inner-lens package installed
- GITHUB_TOKEN configured

## Environment Variables

### For Server Handlers
- `GITHUB_TOKEN` - GitHub Personal Access Token (repo scope)
- `GITHUB_REPOSITORY` - Repository in "owner/repo" format

### For AI Analysis (GitHub Actions)
- `AI_PROVIDER` - `anthropic`, `openai`, or `google`
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`
- `ISSUE_NUMBER`, `REPO_OWNER`, `REPO_NAME` - Set by GitHub Actions
- `MAX_FILES` - Maximum files to analyze (default: 25)
- `MAX_TOKENS` - Maximum tokens for AI response (default: 4000)
- `SELF_CONSISTENCY` - Enable multiple analysis runs (default: false)
- `USE_CHUNKING` - Use AST-like code chunking (default: true)

## CI/CD

### test.yml
- Runs on PRs and pushes to main
- Tests on Node.js 20 and 22
- Uploads coverage to Codecov (Node 20 only)
- Uses SHA-pinned GitHub Actions for security
- Runs typecheck, tests, and build

### analyze-issues.yml (Trigger Workflow)
- Triggers on new issues with `bug` label or when `inner-lens` label is added
- Checks for existing analysis to prevent duplicates
- Calls the reusable `analysis-engine.yml` workflow
- Configures AI provider and parameters

### analysis-engine.yml (Reusable Workflow)
- Reusable workflow (`workflow_call`) for AI analysis
- Can be called from this repo or external repos
- Supports all three AI providers (Anthropic, OpenAI, Google)
- SHA-pinned actions for supply chain security
- Runs Chain-of-Thought AI analysis and posts comment
- Adds labels based on analysis (severity, category, confidence)
- External usage: `uses: jhlee0409/inner-lens/.github/workflows/analysis-engine.yml@v1`

## Important Considerations

1. **Peer Dependencies** - React and Vue are optional peer dependencies
2. **Build Output** - Each entry point has separate ESM + CJS builds (8 total)
3. **"use client"** - React build includes this banner for Next.js App Router
4. **No External CSS** - All styles are inline (see `src/utils/styles.ts`)
5. **Security** - Never log unmasked data; always call `maskSensitiveData()` before AI processing
6. **Bundle Size** - Session replay (`inner-lens/replay`) adds ~77KB gzipped when used
7. **Dynamic Loading** - rrweb is loaded on-demand to minimize initial bundle impact
8. **GitHub OAuth** - CLI uses Device Flow for secure token acquisition
9. **Analysis Accuracy** - AI confirms bugs exist in code before suggesting fixes

## Data Quality Guarantees

The system ensures consistent data quality across all users:

| Data Type | Collection Method | Consistency |
|-----------|------------------|-------------|
| Network requests | fetch interceptor | ✅ Uniform |
| Uncaught errors | window.onerror | ✅ Uniform |
| Promise rejections | unhandledrejection | ✅ Uniform |
| DOM state | rrweb snapshot | ✅ Uniform |
| User interactions | rrweb recording | ✅ Uniform |
| Console logs | console.error/warn | ⚠️ Developer-dependent |
| Description | User input | ⚠️ User-dependent |

For maximum consistency, enable session replay which captures visual state regardless of logging practices.
