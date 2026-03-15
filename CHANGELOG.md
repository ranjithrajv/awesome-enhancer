# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2026-03-15

### Added

- **GitHub Action** (`packages/action`): JavaScript action that runs on Node 20. Supports all enhancement flags, dry-run preview via step summary, automatic commit-and-push, and annotates stale/redirect findings directly in the Actions UI.
- **GitLab CI client** (`packages/gitlab-ci`): Node.js script configured via `AE_*` environment variables. Reads GitLab CI context (`CI_*` vars), auto-posts an MR note with stale/redirect results when running in a merge request pipeline, and optionally commits enhanced output back to the branch.
- **Visual Before/After UI**: New `BeforeAfter` component showing side-by-side comparison of content before and after enhancement in the TUI.
- **Enhancement Statistics**: `StatsDisplay` component displaying enhancement metrics (links processed, metadata added, descriptions improved, stale repos detected).
- **ASCII Art Banner**: Professional CLI banner displayed across all interactive screens for improved branding.
- **Badge Generator**: Added badge suggestions at the end of enhancement process, encouraging users to add "Enhanced with awesome-enhancer" badge to their READMEs.
- **Enhanced Help Text**: Updated `--help` output with ASCII banner and npx usage examples.
- **README Visual Example**: Added before/after visual comparison in README showing transformation results.
- **Quick Start Section**: Added prominent quick start guide with installation and usage examples.
- **Badge Documentation**: Added badge generator section with multiple style options (flat-square, flat, social).
- **New UI Component**: `src/ui/before-after.tsx` - Reusable components for visual comparisons and statistics display.

### Changed

- **Enhanced TUI Completion Screen**: Updated `EnhanceUI` component to show before/after preview and enhancement statistics when available.
- **Interactive Screens**: All interactive screens (Welcome, Options, Mode, InputPrompt) now display the ASCII art banner for consistent branding.
- **README Structure**: Reorganized README with visual example at the top for immediate impact.
- **Package Configuration**: Added `preferGlobal: true` to package.json for better npm global installation experience.

### Technical

- **New Component**: `BeforeAfter` - Side-by-side visual comparison component for Ink TUI.
- **New Component**: `StatsDisplay` - Statistics display showing enhancement metrics.
- **New Function**: `getAsciiBanner()` - Returns formatted ASCII art banner.
- **Enhanced State**: Extended `EnhanceState` interface with `before`, `after`, and `enhancements` fields for visual feedback.

## [0.4.0] - 2026-03-14

### Added

- **Stale/Archived Repo Detection**: Added `--detect-stale` flag to detect archived, disabled, and deleted (404) GitHub repositories in awesome lists. When enabled, stale entries receive a red shields.io badge appended in-place, and a summary report is printed to stdout.
- **Redirect/Transfer Detection**: Added `--detect-redirects` flag to detect repository transfers and renames. Makes HEAD requests to GitHub URLs to detect 301 redirects and adds badges showing "transferred" or "renamed" status.
- **RepoMetadata Expansion**: Extended `RepoMetadata` interface with `archived: boolean` and `disabled: boolean` fields to properly type GitHub API responses.
- **StaleProcessor**: New processor that identifies stale repositories using GitHub API signals (archived, disabled, or 404) and appends status badges.
- **RedirectProcessor**: New processor that detects repository redirects and transfers using HEAD requests with redirect following disabled.
- **ProcessorResult Interface**: Updated processor interface to return `ProcessorResult` objects that can contain stale entry and redirect entry information.
- **Idempotency Protection**: Stale and redirect detection skip entries that already have respective badges to prevent duplication.
- **CLI Integration**: Added `--detect-stale` and `--detect-redirects` flags to CLI with appropriate validation and reporting.
- **HTTP/MCP Support**: Enhanced HTTP and MCP APIs to accept and return stale and redirect detection results.
- **GitLab Support**: Added full GitLab support on par with GitHub. All features work with both platforms:
  - `--add-metadata`: Add stars, forks, and language badges using shields.io
  - `--update-descriptions`: Fetch and improve descriptions via web scraping
  - `--detect-stale`: Detect archived GitLab repositories
- **GitLabService**: New Effect-based service for GitLab API integration (`src/services/gitlab.ts`).
- **HTTP/MCP GitLab Endpoint**: Added `POST /enhance/gitlab` endpoint for GitLab URL enhancement.
- **GitLab URL Parsing**: Updated `parseGitLabUrl` utility to properly parse GitLab.com URLs.
- **GitLab Badges**: Badge generator now supports GitLab-specific badge URLs via shields.io.
- **GitLab Configuration**: Added `gitlabToken` option and `GITLAB_TOKEN` env var support.

### Changed

- **Processor Interface**: Modified `Processor.execute()` to return `ProcessorResult` instead of boolean to support stale entry tracking.
- **ProcessorEngine**: Updated to collect stale entries from all processors and return them alongside processed content.
- **Engine Factory**: Updated to register `StaleProcessor` when `detectStale` option is enabled.
- **Validation Schemas**: Added `detectStale`/`detect_stale` fields to all validation schemas (CLI, HTTP, MCP).
- **Return Types**: Updated `enhance()` function and related APIs to return `ProcessResult` with stale entries.
- **Badge Generator**: Extended to support generating `status-archived` badges for stale detection.
- **BadgeGenerator**: Extended to accept `provider` parameter (`'github'` or `'gitlab'`) for platform-specific badge URLs.
- **Processors**: Updated `MetadataProcessor`, `StaleProcessor`, and `DescriptionProcessor` to handle both GitHub and GitLab URLs.
- **ScraperService**: Added `fetchGitLabDescription` method for GitLab description extraction.
- **App Layer**: Updated to include GitLab service layer alongside GitHub service.
- **Schemas**: Added `gitlabToken` to config and enhance options schemas.

### Fixed

- Fixed GitLab service class declaration syntax to match GitHub service pattern.

## [0.3.0] - 2026-03-12

### Added

- **Effect integration**: All async operations now return `Effect<A, E, R>` — typed error channel, no more `Promise<T | null>`.
- **Zod validation**: All external inputs (CLI options, HTTP bodies, MCP args) validated with Zod schemas at system boundaries.
- **Typed error hierarchy**: `NetworkError`, `ConfigError`, `EnhanceError`, `ValidationError` via `Data.TaggedError` — exhaustive matching, structural equality.
- **Effect Layers for DI**: `GitHubService`, `ScraperService`, `CacheService`, `LoggerService` as Effect `Context.Tag` Layers — no more constructor-injected dependencies.
- **`LoggerService`**: `ConsoleLive` (CLI) and `SilentLive` (library/tests) layers — no more `console.*` in library code.
- **`CacheService`**: `FileCacheLive(cacheDir, ttl)` layer wrapping existing cache.
- **`src/core/constants.ts`**: Single source of truth for all magic numbers (`DEFAULT_CACHE_TTL`, `DEFAULT_REQUEST_TIMEOUT`, etc.).
- **`src/core/schemas.ts`**: Zod schemas shared across CLI, HTTP, and MCP — `EnhanceOptionsSchema`, `HttpEnhanceLocalSchema`, `HttpEnhanceGithubSchema`.
- **`src/core/engine-factory.ts`**: `createEngine(config)` — eliminates duplicated processor registration.
- **`src/core/app-layer.ts`**: `buildAppLayer(options)` — assembles full service Layer from parsed options.
- **`src/core/runner.ts`**: Shared `runEnhanceLocal` / `runEnhanceGithub` — eliminates temp-dir duplication between MCP and HTTP servers.
- **`zod-to-json-schema`**: MCP tool `inputSchema` now derived from Zod schemas — no more manual duplication.

### Changed

- **Breaking**: `enhance()` now returns `Effect<string, AppError, never>` instead of `Promise<string>`. Call `Effect.runPromise(enhance(content, options))` at your boundary.
- `bin/http-server.ts`: Refactored with `readJsonBody` helper (eliminates 3× repeated chunk-reading), Zod body validation, shared runner.
- `bin/mcp-server.ts`: Reduced from ~327 lines to ~56 lines using `zodToJsonSchema` and shared runner.

### Removed

- `src/services/base-service.ts`: Deleted — fully replaced by `CacheService` + `LoggerService` Layers.
- `enhance_with_json_output` MCP tool: Removed (redundant with `enhance_local_file`).

## [0.2.0] - 2026-03-11

### Added

- **Interactive TUI**: Added Ink-based interactive CLI with guided prompts for option selection.
- **MCP Server**: Added Model Context Protocol server for AI agent integration (`awesome-enhancer-mcp`).
- **HTTP API Server**: Added HTTP REST API server on port 9867 (`awesome-enhancer-server`).
- **Skill File**: Added `skill/awesome-enhancer/SKILL.md` for Claude agent documentation.
- **AI-Agent Friendly**: Tool now accessible via MCP, HTTP API, and JSON output.
- **Test Coverage**: Added 80% minimum test coverage threshold in pre-commit hooks.
- **GitHub Actions CI**: Added Bun workflow for automated testing, linting, and building.
- **Security Scanning**: Added CodeQL analysis workflow for vulnerability detection.
- **PR Automation**: Added labeler workflow to auto-label pull requests based on changed files.
- **.gitignore**: Added comprehensive `.gitignore` file with standard Node.js patterns.

### Changed

- Removed ESLint and TypeScript ESLint dependencies for simplified tooling.
- Renamed `test/` directory to `tests/` for consistency.

### Fixed

- Updated package versions for improved compatibility.
- Fixed failing scraper tests (axios mock).
- Added missing GitHub service tests.

### Features

- `enhance_local_file` - MCP tool for enhancing local markdown files
- `enhance_github_url` - MCP tool for enhancing GitHub URLs
- `enhance_with_json_output` - MCP tool returning JSON for AI agents
- HTTP endpoints: `POST /enhance`, `POST /enhance/local`, `POST /enhance/github`, `GET /health`

## [0.1.0] - 2026-01-26

### Added

- Initial release of awesome-enhancer.
- **TypeScript Migration**: Entire codebase rewritten in TypeScript for better safety and DX.
- **Architectural Refactor**: Moved to a modular structure (`bin/`, `src/core/`, `src/services/`, `src/lib/`, `src/commands/`).
- **Smart Auto-Detection**: CLI now automatically suggests local README if run inside a Git repository.
- **Environment Support**: Added `.env` file support for GitHub tokens and other configurations.
- **Pre-commit Hooks**: Integrated Husky and lint-staged for automated linting and formatting.
- **Programmatic API**: Exported core logic for use as a library (`src/index.ts`).
- Support for GitHub repository URLs as input (auto-fetches README).
- Metadata extraction for GitHub repositories (stars, language).
- Auto-description feature via web scraping (GitHub and project websites).
- File-based caching system for API and scraping results.
- CLI interface with dry-run and configuration support.
- Support for AGPLv3 license for code and CC0 recommendation for content.
- Documentation: README, CONTRIBUTING, CHANGELOG.

### Fixed

- Dry-run mode now correctly skips the final linting step check.
- Caching inconsistency in `BaseService` ensuring reliable metadata retrieval.
