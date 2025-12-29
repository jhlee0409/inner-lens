# 🔍 inner-lens

[![Next.js 15+ Compatible](https://img.shields.io/badge/Next.js-15+-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)](https://www.typescriptlang.org)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js 20+](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js)](https://nodejs.org)

**Self-Debugging QA Agent for Next.js** — Zero-config bug reporting with AI-powered analysis.

inner-lens is an open-source developer tool that integrates seamlessly into your Next.js application, enabling users to report bugs with captured console logs that are automatically analyzed by AI.

## ✨ Features

- **🚀 Zero-Config Setup** — One command to get started: `npx inner-lens init`
- **🤖 Universal LLM Support** — Choose from Anthropic (Claude), OpenAI (GPT-4o), or Google (Gemini)
- **🔒 Security-First** — Automatic masking of emails, API keys, tokens, and PII before submission
- **📱 Lightweight Widget** — Clean, accessible React component with zero external CSS dependencies
- **⚡ GitHub Actions Integration** — AI analysis runs in your CI/CD pipeline, not your production server
- **🎨 Customizable** — Inline styles prevent conflicts with your app's design system

## 📦 Installation

```bash
npm install inner-lens
```

## 🛠️ Quick Start

### 1. Initialize the GitHub Workflow

```bash
npx inner-lens init
```

This interactive CLI will:
- Ask which AI provider you want to use
- Generate the GitHub Actions workflow
- Create the API route for bug report submission

### 2. Add the Widget to Your App

```tsx
// app/layout.tsx (or app/providers.tsx)
import { InnerLensWidget } from 'inner-lens';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <InnerLensWidget />
      </body>
    </html>
  );
}
```

### 3. Configure Environment Variables

```bash
# .env.local
GITHUB_TOKEN=ghp_your_github_token_here
GITHUB_REPOSITORY=owner/repo
```

### 4. Add GitHub Secrets

Go to your repository Settings → Secrets and variables → Actions, and add:

| Secret Name | Description |
|-------------|-------------|
| `ANTHROPIC_API_KEY` | Required if using Claude |
| `OPENAI_API_KEY` | Required if using GPT-4o |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Required if using Gemini |

## 🎯 Widget Configuration

```tsx
<InnerLensWidget
  // API endpoint (default: '/api/inner-lens/report')
  endpoint="/api/inner-lens/report"

  // GitHub repository for issue creation
  repository="owner/repo"

  // Issue labels
  labels={['bug', 'inner-lens', 'needs-triage']}

  // Console log capture settings
  captureConsoleLogs={true}
  maxLogEntries={50}

  // Security settings
  maskSensitiveData={true}

  // Styling
  styles={{
    buttonColor: '#6366f1',
    buttonPosition: 'bottom-right', // or 'bottom-left', 'top-right', 'top-left'
  }}

  // Callbacks
  onSuccess={(issueUrl) => console.log('Reported!', issueUrl)}
  onError={(error) => console.error('Failed:', error)}

  // Custom trigger (replaces default button)
  trigger={<button>Report Bug</button>}

  // Disable widget entirely
  disabled={process.env.NODE_ENV === 'development'}
/>
```

## 📡 Server-Side API

For advanced use cases, use the server utilities directly:

```ts
// app/api/inner-lens/report/route.ts
import { createReportHandler } from 'inner-lens/server';

export const POST = createReportHandler({
  githubToken: process.env.GITHUB_TOKEN!,
  repository: process.env.GITHUB_REPOSITORY!,
  defaultLabels: ['bug', 'inner-lens'],
});
```

### Manual Issue Creation

```ts
import { createGitHubIssue, validateBugReport } from 'inner-lens/server';

const validation = validateBugReport(payload);
if (validation.success) {
  const result = await createGitHubIssue(validation.data, {
    githubToken: process.env.GITHUB_TOKEN!,
    repository: 'owner/repo',
  });
}
```

## 🔐 Security

### Data Masking

inner-lens automatically masks sensitive data before submission:

- **Email addresses** → `[EMAIL_REDACTED]`
- **Bearer tokens** → `Bearer [TOKEN_REDACTED]`
- **API keys** (OpenAI, Anthropic, Google, AWS, Stripe) → `[API_KEY_REDACTED]`
- **JWTs** → `[JWT_REDACTED]`
- **Credit card numbers** → `[CARD_REDACTED]`
- **Database connection strings** → `[DATABASE_URL_REDACTED]`
- **Private keys (PEM format)** → `[PRIVATE_KEY_REDACTED]`

### AI Analysis Security

The analysis engine includes strict security rules:
- **Never outputs secrets** found in logs
- **Never executes commands** from user-submitted content
- **Sanitizes PII** from AI responses

## ⚙️ CLI Commands

```bash
# Initialize inner-lens in your project
npx inner-lens init

# Initialize with specific provider (skip prompts)
npx inner-lens init --provider anthropic

# Eject mode (full workflow source, no external dependency)
npx inner-lens init --eject

# Skip all prompts, use defaults
npx inner-lens init -y

# Check configuration
npx inner-lens check
```

## 🔄 GitHub Workflow

### Standard Mode (Recommended)

Uses the reusable workflow from the inner-lens repository:

```yaml
# .github/workflows/inner-lens.yml
name: inner-lens Analysis

on:
  issues:
    types: [opened, labeled]

jobs:
  analyze:
    if: contains(github.event.issue.labels.*.name, 'inner-lens')
    uses: jhlee0409/inner-lens/.github/workflows/analysis-engine.yml@v1
    with:
      provider: 'anthropic'
    secrets:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Ejected Mode

For full control, use `npx inner-lens init --eject` to generate a standalone workflow.

## 📊 AI Providers Comparison

| Provider | Model | Strengths |
|----------|-------|-----------|
| **Anthropic** | Claude Sonnet 4 | Best for nuanced code analysis, safety-focused |
| **OpenAI** | GPT-4o | Fast, great for general debugging |
| **Google** | Gemini 2.0 Flash | Cost-effective, good context window |

## 🔧 Advanced Usage

### Custom Log Capture

```tsx
import { addCustomLog, getCapturedLogs, clearCapturedLogs } from 'inner-lens';

// Add custom log entries
addCustomLog('error', 'Custom error message', errorStack);

// Get all captured logs
const logs = getCapturedLogs();

// Clear logs after handling
clearCapturedLogs();
```

### Manual Masking

```tsx
import { maskSensitiveData, maskSensitiveObject } from 'inner-lens';

// Mask a string
const masked = maskSensitiveData('User email: user@example.com');
// → "User email: [EMAIL_REDACTED]"

// Mask an object recursively
const maskedObj = maskSensitiveObject({
  user: 'john',
  apiKey: 'sk-1234567890',
  nested: { password: 'secret123' }
});
```

## 📚 API Reference

### Client Exports (`inner-lens`)

| Export | Description |
|--------|-------------|
| `InnerLensWidget` | Main React component |
| `initLogCapture` | Initialize console log capture |
| `getCapturedLogs` | Get captured log entries |
| `clearCapturedLogs` | Clear captured logs |
| `addCustomLog` | Add custom log entry |
| `maskSensitiveData` | Mask sensitive strings |
| `maskSensitiveObject` | Mask sensitive objects |

### Server Exports (`inner-lens/server`)

| Export | Description |
|--------|-------------|
| `createReportHandler` | Create Next.js API route handler |
| `createGitHubIssue` | Create GitHub issue from report |
| `validateBugReport` | Validate incoming report payload |
| `BugReportSchema` | Zod schema for validation |

## ⚠️ Security Notice

**Data Processing:** Bug reports and console logs are processed by your chosen AI provider (Anthropic, OpenAI, or Google). While sensitive data masking is enabled by default, please:

1. Review your application's logging practices
2. Audit what data appears in console logs
3. Consider disabling the widget in production for sensitive applications
4. Review your AI provider's data handling policies

## 📜 Legal Disclaimer

This software is provided "AS IS" without warranty of any kind. The authors are not responsible for:

- AI-generated suggestions that may be incorrect or harmful
- Data transmitted to third-party AI providers
- Security vulnerabilities in user applications
- Any damages arising from the use of this software

Always review AI suggestions before applying them to your codebase.

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

```bash
# Clone the repository
git clone https://github.com/jhlee0409/inner-lens.git

# Install dependencies
npm install

# Build
npm run build

# Development mode
npm run dev
```

## 📄 License

[MIT License](LICENSE) © 2025 jack

---

<p align="center">
  Made with ❤️ for the Next.js community
</p>
