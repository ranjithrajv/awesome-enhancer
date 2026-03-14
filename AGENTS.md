# Project Overview

- **Name**: awesome-enhancer
- **Description**: CLI tool to automatically enhance awesome lists with metadata and improved descriptions
- **Type**: Node.js CLI tool (ESM)
- **License**: AGPL-3.0-or-later

## Build System

- **Bundler**: Vite (with vite-plugin-dts for type generation)
- **Tests**: Vitest (via Vite+ `vp test`)
- **Linting**: Oxlint (via Vite+ `vp lint`)
- **Formatting**: Prettier
- **Package Manager**: Bun (uses `bun.lock`)
- **Toolchain**: Vite+ unified CLI (`vp` command)

## Current Commands

- `dev`: `bun run bin/cli.tsx` - Run CLI in development mode
- `dev:server`: `bun run bin/http-server.ts` - Run HTTP server
- `dev:mcp`: `bun run bin/mcp-server.ts` - Run MCP server
- `build`: `bun run build` - Build library and all binaries
  - `build:lib`: Build core library to `dist/src/`
  - `build:cli`: Build CLI binary to `dist/bin/cli.js`
  - `build:mcp`: Build MCP server to `dist/bin/mcp-server.js`
  - `build:server`: Build HTTP server to `dist/bin/http-server.js`
- `test`: `vp test run` - Run tests via Vite+
- `test:watch`: `vp test` - Run tests in watch mode
- `test:coverage`: `vp test run --coverage` - Run tests with coverage
- `lint`: `vp lint` - Lint via Vite+ (Oxlint)
- `format`: `prettier --write .` - Format code

## Vite+ Configuration

- `vite.config.ts` - Core library build config
- `vite.config.cli.ts` - CLI binary build config
- `vite.config.mcp.ts` - MCP server build config
- `vite.config.server.ts` - HTTP server build config

## Project Structure

- `bin/`: CLI entry points (cli.tsx, mcp-server.ts, http-server.ts)
- `src/`: Source code
  - `core/`: Core logic (engine, schemas, errors, utils)
  - `lib/`: Processors (metadata, description, stale, redirect)
  - `services/`: External services (GitHub, GitLab, Scraper, Cache)
  - `ui/`: React/Ink UI components
  - `commands/`: CLI commands
  - `types/`: TypeScript types
- `tests/`: Test files
- `dist/`: Build output

## Key Dependencies

- React/Ink for CLI UI
- Effect for functional error handling
- Zod for validation
- Remark/Unified for Markdown processing
- Vite+ for unified tooling (build, test, lint)

## Useful Scripts

- `bun run dev`: Run the CLI in development
- `bun run test:e2e`: Run end-to-end test
- `bun run typecheck`: Type checking with TypeScript
- `bun run check-version`: Verify package version matches git tag
