# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Export `Reporter` type from `inner-lens/react` and `inner-lens/vue`
- Add `homepage` field to package.json
- Browser compatibility FAQ in README
- User-friendly network error messages (i18n for all languages)
- `.nvmrc` file for consistent development environment
- `submitError`, `timeoutError`, `repositoryNotConfigured` i18n messages for all 5 languages
- 30 second fetch timeout to prevent infinite loading state
- textarea maxlength attribute (10000 chars, matches server validation)
- Print styles to hide widget when printing page

### Fixed
- Memory leak in log-capture module
- Error handling for vanilla.ts dynamic import
- Quality improvements from feedback loop
- Vue component props now fully synced with React API
- Vue `useInnerLens` hook now detects config changes
- Hardcoded English error messages replaced with i18n texts

### Changed
- Minimum Node.js version bumped to 20 (from 18)
- Remove misleading 'svelte' keyword (no native Svelte component)
- Remove `./replay` export (internal use only, use `captureSessionReplay` prop)

## [0.3.4] - 2025-01-07

### Added
- Improved server handler error messages with troubleshooting hints
- Zod validation for API payloads
- Payload size limits (10MB max, 5MB for session replay)

### Fixed
- AI SDK 6.x compatibility (@ai-sdk packages upgraded to v3)
- LLM reranking provider configuration
- Workflow isolation to prevent npm peer dependency conflicts

### Changed
- Exclude sourcemaps from npm package (reduced package size)
- Externalize rrweb to reduce bundle size

## [0.3.2] - 2025-01-06

### Added
- Collapsible sections for logs, actions, navigation in GitHub issue body

### Fixed
- Pin rrweb version to 2.0.0-alpha.17 for stability
- npm dependency conflicts

## [0.3.0] - 2025-01-05

### Added
- `reporter` prop to identify bug submitters (name, email, id)
- `disabled` prop (button visible but inactive)

### Changed
- **BREAKING**: Replace `devOnly`/`disabled` with single `hidden` prop
  - Migration: `devOnly={true}` → `hidden={process.env.NODE_ENV === 'production'}`
  - Migration: `disabled={true}` → `hidden={true}` (if you want to hide)
  - New: `disabled={true}` now keeps button visible but inactive

## [0.2.0] - 2025-01-04

### Added
- Upstash rate limiting (10 req/min/IP)
- Daily repository limit (100 reports/day)
- Error-action correlation in AI analysis
- Bug context enrichment for AI

### Fixed
- Sparse-checkout dependency validation

### Documentation
- Rate limits and security patterns in README
- Why backend is required for self-hosted mode

## [0.1.0] - 2025-01-01

### Added
- Initial release
- React, Vue, Vanilla JS support
- Console log capture with sensitive data masking (22 patterns)
- User action tracking (clicks, inputs, scrolls)
- Navigation history capture
- Performance metrics (Core Web Vitals)
- Session replay support (rrweb integration)
- Hosted mode with GitHub App
- Self-hosted mode with multiple framework handlers
- AI-powered bug analysis via GitHub Actions
- Multi-language support (en, ko, ja, zh, es)
- CLI tool (`npx inner-lens init`)

[Unreleased]: https://github.com/jhlee0409/inner-lens/compare/v0.3.4...HEAD
[0.3.4]: https://github.com/jhlee0409/inner-lens/compare/v0.3.2...v0.3.4
[0.3.2]: https://github.com/jhlee0409/inner-lens/compare/v0.3.0...v0.3.2
[0.3.0]: https://github.com/jhlee0409/inner-lens/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/jhlee0409/inner-lens/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/jhlee0409/inner-lens/releases/tag/v0.1.0
