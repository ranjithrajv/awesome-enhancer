# Contributing to awesome-enhancer

Thank you for contributing to awesome-enhancer!

## Development Setup

```bash
# Clone and install
git clone https://github.com/ranjithrajv/awesome-enhancer.git
cd awesome-enhancer
bun install

# Development
bun run dev              # Interactive CLI
bun run dev:server       # HTTP API server
bun run dev:mcp          # MCP server

# Testing
bun run test             # Run tests
bun run test:coverage    # Run with coverage

# Build all packages
bun run build
```

## Project Structure

```
packages/
├── core/           # Shared library — Effect layers, processors, services
│   ├── src/
│   │   ├── core/       # Engine, schemas, config, errors, constants
│   │   ├── lib/        # Processors (metadata, descriptions, badges, stale, redirects)
│   │   └── services/   # GitHub, GitLab, scraper, cache, logger
│   └── tests/
├── cli/            # Interactive TUI + non-interactive CLI (Ink + React)
│   ├── src/
│   │   ├── commands/   # enhance command
│   │   ├── services/   # Git service (CLI-only)
│   │   └── ui/         # Ink components
│   └── bin/            # Entry point (cli.js)
├── action/         # GitHub Action (JavaScript action, Node 20)
│   ├── src/index.ts    # Uses @actions/core for annotations and step summaries
│   ├── action.yml      # Action metadata (runs: node20)
│   └── dist/           # Bundled output — committed to repo for action use
├── gitlab-ci/      # GitLab CI client
│   └── src/index.ts    # Reads AE_*/CI_* env vars, posts MR notes
├── http-server/    # HTTP REST API server (port 9867)
└── mcp-server/     # Model Context Protocol server for AI agents
```

## Requirements

- **Node.js** >= 20
- **Bun** (for development)
- **100% test coverage** required (lines, functions, branches, statements)

## Coding Standards

- TypeScript throughout — all imports use `.js` extension (nodenext module resolution)
- Effect Layers for dependency injection — no constructor injection
- Zod schemas at all system boundaries (CLI args, HTTP bodies, MCP inputs)
- Run `bun run lint` and `bun run format` before committing
- Ensure tests pass: `bun run test`
- Pre-commit hook runs: version check → tests+coverage → typecheck → lint → build → format → knip

## Adding a New Package

1. Create `packages/<name>/` with `src/`, `package.json`, `vite.config.ts`, `tsconfig.json`
2. `tsconfig.json` extends `../../tsconfig.base.json` — do **not** set `composite: true` or explicit `rootDir` on leaf packages
3. Add `effect` as a direct dependency if the package uses it (not just via `@awesome-enhancer/core`)
4. Externalize Node built-ins in vite config: `external: [/^node:/, ...builtinModules]`
5. Run `bun install` to register the workspace package

## Publishing

```bash
# Create version tag to trigger release workflow
git tag v0.x.x
git push origin v0.x.x
```

This runs tests, builds, and publishes all packages to npm automatically.

## License

By contributing, you agree your code will be licensed under AGPL-3.0.
