# Contributing to inner-lens

Thank you for your interest in contributing to inner-lens! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. Please be kind and constructive in all interactions.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- Git

### Finding Issues to Work On

- Look for issues labeled `good first issue` for beginner-friendly tasks
- Issues labeled `help wanted` are open for community contributions
- Check the [Issues](https://github.com/jhlee0409/inner-lens/issues) page for open tasks

## Development Setup

1. **Fork and clone the repository**

```bash
git clone https://github.com/YOUR_USERNAME/inner-lens.git
cd inner-lens
```

2. **Install dependencies**

```bash
npm install
```

3. **Build the project**

```bash
npm run build
```

4. **Run tests**

```bash
npm run test
```

5. **Start development mode**

```bash
npm run dev
```

## Making Changes

### Branch Naming Convention

Use descriptive branch names:

- `feat/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation changes
- `refactor/description` - Code refactoring
- `test/description` - Test additions or fixes

### Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance tasks

Examples:
```
feat(widget): add custom button text option
fix(masking): handle edge case in email detection
docs(readme): add Svelte integration example
```

## Pull Request Process

1. **Create a new branch** from `main`

```bash
git checkout -b feat/your-feature
```

2. **Make your changes** and commit them

3. **Run tests and type checking**

```bash
npm run test
npm run typecheck
```

4. **Push your branch**

```bash
git push origin feat/your-feature
```

5. **Open a Pull Request** against `main`

6. **PR Requirements**:
   - All tests must pass
   - Type checking must pass
   - Include a clear description of changes
   - Link related issues using `Fixes #123` or `Closes #123`

## Coding Standards

### TypeScript

- Use strict TypeScript (`strict: true`)
- Prefer `type` imports: `import type { Foo } from './types'`
- Use explicit return types for public functions
- Avoid `any` - use `unknown` if type is truly unknown

### Code Style

- Use 2-space indentation
- Use single quotes for strings
- Add trailing commas in multiline arrays/objects
- Maximum line length: 100 characters

### File Organization

```
src/
├── core/           # Framework-agnostic core logic
├── components/     # React components
├── hooks/          # React hooks
├── utils/          # Utility functions
├── types.ts        # Shared TypeScript types
├── react.ts        # React entry point
├── vue.ts          # Vue entry point
├── vanilla.ts      # Vanilla JS entry point
├── server.ts       # Server handlers
└── replay.ts       # Session replay
```

## Testing

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Place test files next to source files: `foo.ts` → `foo.test.ts`
- Use Vitest with jsdom environment
- Mock external dependencies (rrweb, Octokit, etc.)

Example:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { maskSensitiveData } from './masking';

describe('maskSensitiveData', () => {
  it('should mask email addresses', () => {
    const input = 'Contact: john@example.com';
    const result = maskSensitiveData(input);
    expect(result).toBe('Contact: [EMAIL_REDACTED]');
  });
});
```

### Test Coverage Requirements

- New features should include tests
- Bug fixes should include regression tests
- Aim for >80% coverage on new code

## Documentation

### README Updates

When adding new features, update:
- Feature description in README.md
- API reference table if adding new exports
- Configuration options table if adding new options
- CLAUDE.md for AI assistant context

### Code Comments

- Add JSDoc comments for public APIs
- Explain complex logic with inline comments
- Keep comments up-to-date with code changes

## Project Structure

| Directory | Purpose |
|-----------|---------|
| `src/` | Source code |
| `scripts/` | Build and analysis scripts |
| `examples/` | Example implementations |
| `.github/workflows/` | GitHub Actions workflows |
| `dist/` | Build output (git-ignored) |

## Workflow Development

### Reusable Workflow Isolation Pattern

The `analysis-engine.yml` is a reusable workflow that runs in **caller repositories**. This creates a critical constraint: our dependencies must not conflict with the caller's dependencies.

**Problem**: npm resolves peer dependencies against the caller repo's `package.json`, causing conflicts like:
```
npm error ERESOLVE could not resolve
npm error peerOptional @typescript-eslint/eslint-plugin@"6 - 7" 
npm error Found: @typescript-eslint/eslint-plugin@8.38.0
```

**Solution**: Install dependencies in an isolated environment:

```yaml
- name: Install analysis dependencies
  working-directory: .inner-lens
  run: |
    echo '{"name":"inner-lens-analysis","private":true,"type":"module"}' > package.json
    npm install --no-save --prefer-offline \
      ai@~6.0.12 \
      ...

- name: Run analysis
  env:
    NODE_PATH: ${{ github.workspace }}/.inner-lens/node_modules
  run: |
    export PATH="${{ github.workspace }}/.inner-lens/node_modules/.bin:$PATH"
    tsx .inner-lens/scripts/analyze-issue.ts
```

**Key Points**:
1. `working-directory: .inner-lens` - npm ignores caller's package.json
2. Create isolated `package.json` - prevents npm from searching parent directories  
3. `NODE_PATH` - ensures Node.js finds modules in `.inner-lens/node_modules`
4. `PATH` modification - ensures `tsx` binary is found in isolated node_modules
5. Use tilde (`~`) for versions - allows patch updates but prevents breaking changes

## Need Help?

- Open an issue for questions
- Join discussions on GitHub
- Check existing issues and PRs for context

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
