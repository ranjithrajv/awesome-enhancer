# Contributing to awesome-enhance

Thank you for contributing to awesome-enhance!

## Development Setup

```bash
# Clone and install
git clone https://github.com/ranjithrajv/awesome-enhance.git
cd awesome-enhance
bun install

# Development
bun run dev              # Interactive CLI
bun run dev:server       # HTTP API server
bun run dev:mcp          # MCP server

# Testing
bun run test             # Run tests
bun run test:coverage    # Run with coverage
```

## Project Structure

```
├── bin/                  # CLI entry points
│   ├── cli.tsx          # Interactive CLI (Ink)
│   ├── http-server.ts   # HTTP API server
│   └── mcp-server.ts    # MCP server for AI agents
├── src/
│   ├── commands/        # CLI commands
│   ├── core/            # Utilities, config, caching
│   ├── lib/             # Processors (metadata, descriptions, badges)
│   ├── services/        # External APIs (GitHub, scraper)
│   └── ui/              # Ink components for TUI
└── tests/               # Test files
```

## Requirements

- **Node.js** >= 18
- **Bun** (for development)
- **80% test coverage** required

## Coding Standards

- Use TypeScript
- Run `bun run lint` and `bun run format` before committing
- Ensure tests pass: `bun run test`
- Maintain coverage above 80%

## Publishing

```bash
# Create version tag to trigger release workflow
git tag v0.x.x
git push origin v0.x.x
```

This runs tests, builds, and publishes to npm automatically.

## License

By contributing, you agree your code will be licensed under AGPL-3.0.
