# Project Overview

- **Name**: awesome-enhancer
- **Description**: CLI tool to automatically enhance awesome lists with metadata and improved descriptions
- **Type**: Node.js CLI tool (ESM)
- **License**: AGPL-3.0-or-later

## Build System

- **Bundler**: Rolldown (configured via `rolldown.config.ts`)
- **Tests**: Vitest (`vitest.config.ts`)
- **Linting**: Oxlint
- **Formatting**: Prettier
- **Package Manager**: Bun (uses `bun.lock`)

## Current Commands

- `dev`: `bun run bin/cli.tsx`
- `build`: `bun run clean && rolldown -c rolldown.config.ts && bun run build:types`
- `test`: `vitest run`
- `lint`: `oxlint --deny-warnings --ignore-pattern dist`
- `format`: `prettier --write .`

## Project Structure

- `bin/`: CLI entry points
- `src/`: Source code
- `tests/`: Test files
- `dist/`: Build output

## Key Dependencies

- React/Ink for CLI UI
- Commander for CLI parsing
- Remark/Unified for Markdown processing
- Zod for validation

## Vite+ Evaluation Notes

- Current build uses Rolldown (which Vite+ also uses)
- Already using Oxlint for linting
- Already using Vitest for testing
- Vite+ could unify these tools into a single CLI (`vp dev`, `vp build`, `vp test`, `vp lint`, `vp format`)
- Potential benefits: standardized commands, faster builds, unified configuration
- Project is a CLI tool, not a web app, so Vite+ web features may not apply

## Useful Scripts

- `bun run dev`: Run the CLI in development
- `bun run test:e2e`: Run end-to-end test
- `bun run typecheck`: Type checking with TypeScript
