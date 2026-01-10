# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.3] - 2026-01-10

### Added
- **(Build)** Git branch tracking utilities and `inner-lens/build` export (`getGitBranch` and helpers)
- **(Widget)** Branch prop wired through React/Vue → API payload
- **(Tests)** Branch tracking utilities and branch prop coverage for InnerLensCore/api/_shared

### Changed
- **(Workflow)** Removed unused `max_tokens`/`node_version` options; increased explainer output limit to 6000
- **(Docs)** Quick Start aligned with branch tracking; masking pattern count corrected (27 → 30)

### Fixed
- **(Widget)** Branch prop wiring fixes (React/Vue → API)
- **(Self-hosted)** Report optional fields and metadata aligned between self-hosted and hosted flows
- **(Analysis Engine)** Complete i18n support for all comment output sections
  - Analysis Level, Total Duration, Agents Used labels now translated
  - Hallucination Check Report fully localized (8 languages)
  - Confidence Calibration messages translated
  - Reviewer Notes section headers localized
- **(Analysis Engine)** Added 29 new translation keys across 8 languages
- **(Docs)** Masking 패턴 수 표기 수정 (27 → 30)

## [0.4.2] - 2025-01-09

### Fixed
- **(Widget)** User action capture no longer records clicks on inner-lens widget itself
- **(Analysis Engine)** Language setting now properly propagates through P5 pipeline (issue/comment language respects user config)
- **(Analysis Engine)** Enhanced keywords and category hints now reach LLM analysis phase
- **(Workflow)** CI dependency version pinning uses tilde (~) instead of caret (^) for stability

### Changed
- **(Analysis Engine)** Finder agent refactored to LLM-first intent-based architecture
  - Pattern search no longer pollutes LLM relevance rankings
  - Pattern results now only supplement LLM findings (max 5 high-confidence files)
  - Improved file discovery accuracy for bug analysis

## [0.4.1] - 2025-01-08

### Changed
- **(Analysis Engine)** P5 multi-agent pipeline is now the default (removed legacy single-model flow)
- **(Analysis Engine)** Confidence calibration and hallucination verification now active in P5 pipeline
- **(Analysis Engine)** Removed ~140 lines of legacy format conversion code

## [0.4.0] - 2025-01-08

### Added
- 5 new masking patterns: Discord webhooks, Slack tokens, NPM tokens, SendGrid keys, Twilio credentials (22 → 27 patterns)
- Extended type exports for advanced use cases (`UserAction`, `NavigationEntry`, `PerformanceSummary`, `CoreWebVitals`, `PageContext`)
- Early warning when repository is not configured in hosted mode
- Export `Reporter` type from `inner-lens/react` and `inner-lens/vue`
- Add `homepage` field to package.json
- Browser compatibility FAQ in README
- User-friendly network error messages (i18n for all languages)
- `.nvmrc` file for consistent development environment
- `submitError`, `timeoutError`, `repositoryNotConfigured` i18n messages for all 5 languages
- 30 second fetch timeout to prevent infinite loading state
- textarea maxlength attribute (10000 chars, matches server validation)
- Print styles to hide widget when printing page
- **(Analysis Engine)** web-tree-sitter AST-based code chunking for accurate bracket handling in strings/regex
- **(Analysis Engine)** Key-name based masking detection for enhanced security

### Fixed
- Prevent multiple widget instances from mounting
- Double-mount bug in `useInnerLens` hook
- Empty description validation in InnerLensCore
- Memory leak in log-capture module
- Error handling for vanilla.ts dynamic import
- Vue component props now fully synced with React API
- Vue `useInnerLens` hook now detects config changes
- Hardcoded English error messages replaced with i18n texts
- **(Analysis Engine)** Type annotations now skipped when counting brackets
- **(Analysis Engine)** Proper tracking of both brackets `[]` and braces `{}` in code chunking
- **(Analysis Engine)** `const` array/object pattern recognition for better context extraction
- **(Workflow)** issue_number input type changed to string for job output compatibility

### Changed
- Masking pattern ordering optimized (URL patterns processed first to prevent conflicts)
- Minimum Node.js version bumped to 20 (from 18)
- Remove misleading 'svelte' keyword (no native Svelte component)
- Remove `./replay` export (internal use only, use `captureSessionReplay` prop)
- **(Analysis Engine)** Default AI model changed to `gemini-2.5-flash`

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

[Unreleased]: https://github.com/jhlee0409/inner-lens/compare/v0.4.3...HEAD
[0.4.3]: https://github.com/jhlee0409/inner-lens/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/jhlee0409/inner-lens/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/jhlee0409/inner-lens/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/jhlee0409/inner-lens/compare/v0.3.4...v0.4.0
[0.3.4]: https://github.com/jhlee0409/inner-lens/compare/v0.3.2...v0.3.4
[0.3.2]: https://github.com/jhlee0409/inner-lens/compare/v0.3.0...v0.3.2
[0.3.0]: https://github.com/jhlee0409/inner-lens/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/jhlee0409/inner-lens/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/jhlee0409/inner-lens/releases/tag/v0.1.0
