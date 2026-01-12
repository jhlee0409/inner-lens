# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.8] - 2026-01-12

### Fixed
- **(Widget)** Detect and warn when endpoint contains `/undefined` or `/null` in full URLs
  - Automatically falls back to hosted API when environment variables are not set
  - Only applies to absolute URLs (http/https) - relative paths are unaffected

## [0.4.7] - 2026-01-12

### Fixed
- **(Widget)** i18n fallback for dialogTitle and buttonText when language is not supported
- **(Analysis Engine)** Added 60-second timeout to all LLM calls to prevent indefinite hangs
- **(Analysis Engine)** Fixed error response format (lowercase `error` field for consistency)
- **(Analysis Engine)** Fixed Zod schema for optional fields (hypotheses, counterEvidence, etc.)

### Changed
- **(Tests)** Removed 690 lines of placeholder tests that didn't catch real bugs
- **(Tests)** Fixed N/A prevention tests to match actual table cell format (`| URL | N/A |`)
- **(Tests)** Added meaningful i18n fallback tests

## [0.4.6] - 2026-01-11

### Fixed
- **(Widget)** Fixed dialog title not displaying when embedded in apps with global CSS resets
  - h2 tag now preserves inline styles by using `all: initial !important` instead of `all: revert !important`
- **(Widget)** Fixed endpoint default value being overridden when explicitly set to `undefined`
  - Now correctly falls back to `HOSTED_API_ENDPOINT` when endpoint is not provided

## [0.4.5] - 2026-01-11

### Fixed
- **(Widget)** Widget styles now use `!important` on all CSS properties to prevent host app CSS (Tailwind, etc.) from overriding widget appearance
  - Fixes invisible dialog title and other styling issues when embedded in apps with aggressive global CSS resets
  - Added explicit textarea/input color and background styles in global CSS to override host `all: revert` rules
- **(Widget)** Fixed JSON parsing error when API returns non-JSON error response (e.g., 404 HTML page)
  - Now checks response status before attempting to parse JSON body

## [0.4.4] - 2026-01-11

### Changed
- **(Widget)** React Widget rewritten to wrap InnerLensCore (828 → 160 lines)
- **(CLI)** cli.ts split into modular structure (1,973 → 6 files)
  - `src/cli/index.ts`: Commander setup
  - `src/cli/types.ts`: Type definitions and constants
  - `src/cli/auth.ts`: GitHub OAuth Device Flow
  - `src/cli/frameworks.ts`: Framework detection
  - `src/cli/workflow.ts`: GitHub Actions generation
  - `src/cli/setup.ts`: init/check commands
- **(Internal)** Zod schema sync validation added to sync-check script
- **(API)** RuntimeEnvironmentSchema updated (browser/os fields added, platform removed)

## [0.4.3] - 2026-01-10

### Added
- **(Widget/API)** Issue body enriched with Versions / Deployment / Environment tables (URL, user agent, branch, runtime: locale/timezone/viewport/device/color-scheme/online/platform)
- **(Widget/API)** Bug report payload now carries `version`, `deployment`, `runtime` fields end-to-end (core → API → issue body)
- **(Build)** Auto-populate version/deployment/runtime metadata at build time via tsup defines
  - `__INNER_LENS_VERSION__`: from package.json
  - `__INNER_LENS_COMMIT__`: auto-detect from `git rev-parse --short HEAD`
  - `__INNER_LENS_RELEASE__`: auto-generate `v{version}`
  - `__INNER_LENS_BUILD_TIME__`: ISO timestamp at build
  - Eliminates most N/A fields in GitHub issue bodies without user configuration

### Fixed
- **(Analysis Engine)** Complete i18n support for all comment output sections
  - Analysis Level, Total Duration, Agents Used labels now translated
  - Hallucination Check Report fully localized (8 languages)
  - Confidence Calibration messages translated
  - Reviewer Notes section headers localized
- **(Analysis Engine)** Added 29 new translation keys across 8 languages

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
