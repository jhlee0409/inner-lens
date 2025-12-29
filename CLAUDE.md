# CLAUDE.md - AI Assistant Guide for inner-lens

This document provides essential context for AI assistants working with the inner-lens codebase.

## Project Overview

**inner-lens** is a Self-Debugging QA Agent - a universal bug reporting widget with AI-powered analysis. It captures console logs, masks sensitive data, creates GitHub issues, and uses AI to analyze bugs and suggest fixes.

### Core Value Proposition
1. Users report bugs via an embedded widget
2. Console logs + metadata are captured automatically
3. Sensitive data is masked client-side and server-side
4. GitHub issue is created with structured format
5. AI analyzes the issue and provides root cause + fix suggestions

## Tech Stack

| Category | Technology |
|----------|------------|
| Language | TypeScript (ES2022, strict mode) |
| Build | tsup (ESM + CJS dual output) |
| Testing | Vitest with jsdom |
| Validation | Zod schemas |
| AI | Vercel AI SDK (@ai-sdk/anthropic, @ai-sdk/openai, @ai-sdk/google) |
| GitHub | Octokit REST client |
| CLI | Commander, Inquirer, Chalk |

## Project Structure

```
inner-lens/
├── src/
│   ├── core.ts              # Main export (framework-agnostic)
│   ├── react.ts             # React widget + hooks export
│   ├── vue.ts               # Vue component + composables export
│   ├── vanilla.ts           # Vanilla JS with auto-init export
│   ├── server.ts            # Backend handlers export
│   ├── cli.ts               # CLI entry point
│   ├── types.ts             # Shared TypeScript types
│   ├── core/
│   │   └── InnerLensCore.ts # Framework-agnostic widget class
│   ├── components/
│   │   └── InnerLensWidget.tsx  # React UI component
│   ├── hooks/
│   │   └── useInnerLens.ts  # React hook for programmatic control
│   └── utils/
│       ├── masking.ts       # Sensitive data masking engine
│       ├── log-capture.ts   # Console log interceptor
│       └── styles.ts        # Inline CSS generation
├── scripts/
│   └── analyze-issue.ts     # AI analysis engine (GitHub Actions)
├── .github/workflows/
│   ├── test.yml             # CI: tests + build
│   └── analysis-engine.yml  # AI analysis on new issues
├── tsup.config.ts           # Build configuration (6 separate builds)
├── vitest.config.ts         # Test configuration
└── tsconfig.json            # TypeScript configuration
```

## Package Exports

The package uses conditional exports for different environments:

| Import Path | Entry File | Purpose |
|-------------|-----------|---------|
| `inner-lens` | `src/core.ts` | Framework-agnostic core |
| `inner-lens/react` | `src/react.ts` | React components (has "use client" banner) |
| `inner-lens/vue` | `src/vue.ts` | Vue 3 components |
| `inner-lens/vanilla` | `src/vanilla.ts` | Vanilla JS with auto-init |
| `inner-lens/server` | `src/server.ts` | Backend handlers |
| CLI: `inner-lens` | `src/cli.ts` | Interactive setup wizard |

## Development Commands

```bash
npm run build        # Build all packages with tsup
npm run dev          # Watch mode for development
npm run test         # Run tests once
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run typecheck    # TypeScript type checking only
```

## Architecture Patterns

### 1. Framework-Agnostic Core
The `InnerLensCore` class (`src/core/InnerLensCore.ts`) contains all widget logic. Framework adapters (React, Vue) wrap this core class.

### 2. Universal Server Handlers
`src/server.ts` provides a single `handleBugReport()` function with framework-specific adapters:
- `createFetchHandler()` - Web Fetch API (Next.js App Router, Hono, Bun)
- `createExpressHandler()` - Express middleware
- `createFastifyHandler()` - Fastify handler
- `createKoaHandler()` - Koa middleware
- `createNodeHandler()` - Node.js http module

### 3. Security-First Data Masking
`src/utils/masking.ts` contains regex patterns for masking:
- Emails, phone numbers, SSNs
- API keys (OpenAI, Anthropic, Google, AWS, GitHub, Stripe)
- Bearer tokens, JWTs
- Database URLs, private keys
- Credit card numbers

Masking happens on both client (before submission) and server (before AI analysis).

### 4. Zod Schema Validation
All incoming bug reports are validated with the `BugReportSchema` in `src/server.ts`.

## Key Files to Understand

| File | Purpose |
|------|---------|
| `src/server.ts` | Server handlers + GitHub issue creation |
| `src/core/InnerLensCore.ts` | Widget state management + DOM manipulation |
| `src/components/InnerLensWidget.tsx` | React UI with dialog, form, status states |
| `src/utils/masking.ts` | Sensitive data regex patterns |
| `src/utils/log-capture.ts` | Console.error/warn/info/log interceptor |
| `scripts/analyze-issue.ts` | AI analysis engine with Chain-of-Thought prompts |

## Testing Conventions

- Tests are in `*.test.ts` files alongside source files
- Use Vitest with jsdom environment
- Test files: `src/server.test.ts`, `src/utils/masking.test.ts`, `src/utils/log-capture.test.ts`, `src/qa-flow.integration.test.ts`

Example test pattern:
```typescript
import { describe, it, expect, vi } from 'vitest';

describe('functionName', () => {
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

### Modifying AI Analysis
Edit `scripts/analyze-issue.ts`:
- `SYSTEM_PROMPT` - Chain-of-Thought methodology
- `AnalysisResultSchema` - Zod schema for structured output
- `formatAnalysisComment()` - GitHub comment formatting

## Environment Variables

### For Server Handlers
- `GITHUB_TOKEN` - GitHub Personal Access Token (repo scope)

### For AI Analysis (GitHub Actions)
- `AI_PROVIDER` - `anthropic`, `openai`, or `google`
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_API_KEY`
- `ISSUE_NUMBER`, `REPO_OWNER`, `REPO_NAME` - Set by GitHub Actions

## CI/CD

### test.yml
- Runs on PRs and pushes to main
- Tests on Node.js 20 and 22
- Uploads coverage to Codecov (Node 20 only)
- Uses SHA-pinned GitHub Actions for security

### analysis-engine.yml
- Triggers on new issues with `inner-lens` label
- Runs AI analysis and posts comment
- Adds severity/category labels

## Important Considerations

1. **Peer Dependencies** - React and Vue are optional peer dependencies
2. **Build Output** - Each entry point has separate ESM + CJS builds
3. **"use client"** - React build includes this banner for Next.js App Router
4. **No External CSS** - All styles are inline (see `src/utils/styles.ts`)
5. **Security** - Never log unmasked data; always call `maskSensitiveData()` before AI processing
