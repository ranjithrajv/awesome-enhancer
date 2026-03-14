# Project Overview

- **Name**: awesome-enhancer-monorepo
- **Description**: Monorepo for awesome list enhancement tools
- **Type**: Node.js monorepo with Bun workspaces
- **License**: AGPL-3.0-or-later

## Architecture

This is a monorepo with the following packages:

- **@awesome-enhancer/core** - Pure library with no UI dependencies
- **@awesome-enhancer/cli** - Interactive CLI with Ink/React UI
- **@awesome-enhancer/mcp-server** - Model Context Protocol server for AI agents
- **@awesome-enhancer/http-server** - REST API server

## Build System

- **Bundler**: Vite (with vite-plugin-dts for type generation)
- **Tests**: Vitest (workspace mode)
- **Linting**: Oxlint (via Vite+ `vp lint`)
- **Formatting**: Prettier
- **Package Manager**: Bun (workspaces)
- **Toolchain**: Vite+ unified CLI (`vp` command)

## Root Commands

- `bun run dev` - Run CLI in development mode
- `bun run dev:server` - Run HTTP server in development mode
- `bun run dev:mcp` - Run MCP server in development mode
- `bun run build` - Build all packages
- `bun run test` - Run all tests
- `bun run test:watch` - Run tests in watch mode
- `bun run test:coverage` - Run tests with coverage
- `bun run lint` - Lint all packages
- `bun run format` - Format code
- `bun run typecheck` - Type check all packages

## Package Commands

Each package supports:
- `build` - Build the package
- `dev` - Development mode
- `lint` - Lint the package
- `typecheck` - Type check
- `clean` - Remove dist folder

## Project Structure

```
awesome-enhancer/
├── package.json              # Root workspace config
├── tsconfig.base.json        # Shared TypeScript config
├── vitest.workspace.ts       # Vitest workspace config
├── packages/
│   ├── core/                 # @awesome-enhancer/core
│   │   ├── src/
│   │   │   ├── index.ts      # Main entry point
│   │   │   ├── core/         # Core logic (engine, schemas, errors)
│   │   │   ├── lib/          # Processors
│   │   │   ├── services/     # External services
│   │   │   └── utils/        # Utilities
│   │   └── tests/            # Core tests
│   ├── cli/                  # @awesome-enhancer/cli
│   │   ├── src/index.tsx     # CLI entry point
│   │   └── bin/cli.js        # Shebang wrapper
│   ├── mcp-server/           # @awesome-enhancer/mcp-server
│   │   └── src/index.ts      # MCP server
│   └── http-server/          # @awesome-enhancer/http-server
│       └── src/index.ts      # HTTP server
```

## Using @awesome-enhancer/core

```typescript
import { enhance } from '@awesome-enhancer/core';

const result = await enhance(markdownContent, {
  addMetadata: true,
  updateDescriptions: true,
  githubToken: '...',
});
```

## Development

### Install dependencies
```bash
bun install
```

### Build all packages
```bash
bun run build
```

### Run tests
```bash
bun run test
```

### Run CLI in development
```bash
bun run dev --help
```

## Publishing

Packages are published together using:
```bash
bun changeset
bun changeset version
bun changeset publish
```

## Adding New Packages

1. Create `packages/<name>/` directory
2. Add `package.json` with `@awesome-enhancer/core` as dependency
3. Add `tsconfig.json` extending `../../tsconfig.base.json`
4. Add `vite.config.ts` for building
5. Add to `vitest.workspace.ts` for testing
