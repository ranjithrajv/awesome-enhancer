# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-02-24

### Added

- **GitHub Actions CI**: Added Bun workflow for automated testing, linting, and building.
- **Security Scanning**: Added CodeQL analysis workflow for vulnerability detection.
- **PR Automation**: Added labeler workflow to auto-label pull requests based on changed files.
- **.gitignore**: Added comprehensive `.gitignore` file with standard Node.js patterns.

### Changed

- Removed ESLint and TypeScript ESLint dependencies for simplified tooling.

### Fixed

- Updated package versions for improved compatibility.

## [0.1.0] - 2026-01-26

### Added

- Initial release of awesome-enhance.
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
