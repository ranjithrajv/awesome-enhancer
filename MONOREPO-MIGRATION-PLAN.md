# Monorepo Migration Plan

**Architecture:** Bun Workspaces + Vite+  
**Goal:** Separate CLI from library to support multiple client apps (web, VSCode extension, etc.)

---

## Target Structure

```
awesome-enhancer/
├── package.json                    # Root workspace config
├── bun.lock
├── tsconfig.base.json              # Shared TypeScript config
├── vite.config.ts                  # Root Vite config (optional)
├── vitest.workspace.ts             # Vitest workspace config
├── .vscode/                        # Workspace settings
│   └── settings.json
├── packages/
│   │
│   ├── core/                       # @awesome-enhancer/core
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── src/
│   │   │   ├── index.ts            # Main entry point
│   │   │   ├── enhance.ts          # Core enhance() function
│   │   │   ├── types/              # Shared types & schemas
│   │   │   ├── engine/             # ProcessorEngine
│   │   │   ├── processors/         # metadata, description, stale, redirect
│   │   │   ├── services/           # GitHub, GitLab, Scraper, Cache
│   │   │   └── utils/              # Utilities, errors
│   │   └── tests/                  # Core-specific tests
│   │
│   ├── cli/                        # @awesome-enhancer/cli
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── src/
│   │   │   ├── index.tsx           # CLI entry point
│   │   │   ├── commands/           # CLI commands
│   │   │   └── ui/                 # Ink/React UI components
│   │   └── bin/
│   │       └── cli.js              # Shebang wrapper
│   │
│   ├── mcp-server/                 # @awesome-enhancer/mcp-server
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── src/
│   │       └── index.ts            # MCP server
│   │
│   ├── http-server/                # @awesome-enhancer/http-server
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   └── src/
│   │       └── index.ts            # HTTP server
│   │
│   └── web/                        # @awesome-enhancer/web (future)
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── src/
│           ├── components/         # React web components
│           └── app/                # Next.js/Remix app
│
└── packages.json                   # Workspace root
```

---

## Package Definitions

### 1. @awesome-enhancer/core

**Purpose:** Pure library - no UI, no CLI dependencies

```json
{
  "name": "@awesome-enhancer/core",
  "version": "0.5.0",
  "type": "module",
  "main": "dist/index.js",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch",
    "test": "vitest run",
    "lint": "oxlint --deny-warnings"
  },
  "dependencies": {
    "effect": "^3.19.19",
    "zod": "^4.3.6",
    "zod-to-json-schema": "^3.25.1",
    "remark": "^15.0.0",
    "remark-parse": "^11.0.0",
    "remark-stringify": "^11.0.0",
    "unified": "^11.0.0",
    "unist-util-visit": "^5.0.0",
    "axios": "^1.13.3",
    "cheerio": "^1.2.0",
    "awesome-lint": "^2.2.3",
    "dotenv": "^17.2.3"
  },
  "devDependencies": {
    "@types/node": "^25.0.10",
    "vite": "latest",
    "vite-plugin-dts": "latest",
    "vitest": "latest",
    "typescript": "^5.9.3"
  }
}
```

**API:**

```typescript
import { enhance, type EnhanceOptions } from '@awesome-enhancer/core';

const result = await enhance(markdownContent, {
  addMetadata: true,
  updateDescriptions: true,
  githubToken: '...',
});
```

---

### 2. @awesome-enhancer/cli

**Purpose:** Interactive CLI with Ink UI

```json
{
  "name": "@awesome-enhancer/cli",
  "version": "0.5.0",
  "type": "module",
  "bin": {
    "awesome-enhancer": "./bin/cli.js"
  },
  "files": ["dist", "bin"],
  "scripts": {
    "build": "vite build",
    "dev": "bun run src/index.tsx",
    "lint": "oxlint --deny-warnings"
  },
  "dependencies": {
    "@awesome-enhancer/core": "workspace:*",
    "ink": "^6.8.0",
    "ink-select-input": "^6.2.0",
    "react": "^19.2.4",
    "commander": "^13.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.14",
    "vite": "latest",
    "typescript": "^5.9.3"
  }
}
```

**bin/cli.js:**

```javascript
#!/usr/bin/env node
import '../dist/index.js';
```

---

### 3. @awesome-enhancer/mcp-server

**Purpose:** Model Context Protocol server for AI agents

```json
{
  "name": "@awesome-enhancer/mcp-server",
  "version": "0.5.0",
  "type": "module",
  "bin": {
    "awesome-enhancer-mcp": "./bin/mcp-server.js"
  },
  "files": ["dist", "bin"],
  "scripts": {
    "build": "vite build",
    "dev": "bun run src/index.ts",
    "lint": "oxlint --deny-warnings"
  },
  "dependencies": {
    "@awesome-enhancer/core": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.27.1",
    "zod-to-json-schema": "^3.25.1"
  },
  "devDependencies": {
    "vite": "latest",
    "typescript": "^5.9.3"
  }
}
```

---

### 4. @awesome-enhancer/http-server

**Purpose:** REST API server

```json
{
  "name": "@awesome-enhancer/http-server",
  "version": "0.5.0",
  "type": "module",
  "bin": {
    "awesome-enhancer-server": "./bin/http-server.js"
  },
  "files": ["dist", "bin"],
  "scripts": {
    "build": "vite build",
    "dev": "bun run src/index.ts",
    "start": "node dist/index.js",
    "lint": "oxlint --deny-warnings"
  },
  "dependencies": {
    "@awesome-enhancer/core": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^25.0.10",
    "vite": "latest",
    "typescript": "^5.9.3"
  }
}
```

---

### 5. @awesome-enhancer/web (Future)

**Purpose:** Web UI (Next.js/Remix app)

```json
{
  "name": "@awesome-enhancer/web",
  "version": "0.5.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "oxlint --deny-warnings"
  },
  "dependencies": {
    "@awesome-enhancer/core": "workspace:*",
    "react": "^19.2.4",
    "react-dom": "^19.2.4"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "latest",
    "vite": "latest",
    "typescript": "^5.9.3"
  }
}
```

---

## Root Configuration Files

### Root package.json

```json
{
  "name": "awesome-enhancer-monorepo",
  "version": "0.5.0",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "bun run --filter='@awesome-enhancer/cli' dev",
    "dev:server": "bun run --filter='@awesome-enhancer/http-server' dev",
    "dev:mcp": "bun run --filter='@awesome-enhancer/mcp-server' dev",
    "build": "bun run build:core && bun run build:all",
    "build:core": "bun --filter='@awesome-enhancer/core' build",
    "build:all": "bun --filter='@awesome-enhancer/*' build",
    "test": "vp test run",
    "test:watch": "vp test",
    "test:coverage": "vp test run --coverage",
    "lint": "vp lint",
    "lint:all": "bun --filter='@awesome-enhancer/*' lint",
    "format": "prettier --write .",
    "typecheck": "bun --filter='@awesome-enhancer/*' typecheck",
    "clean": "bun run --filter='@awesome-enhancer/*' clean && rm -rf dist",
    "clean:all": "bun run clean && rm -rf node_modules packages/*/node_modules"
  },
  "devDependencies": {
    "@types/node": "^25.0.10",
    "oxlint": "^1.41.0",
    "prettier": "^3.8.1",
    "typescript": "^5.9.3",
    "vite": "latest",
    "vite-plus": "^0.1.11",
    "vite-plugin-dts": "latest",
    "vitest": "latest"
  }
}
```

---

### tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "allowJs": true,
    "jsx": "react-jsx",
    "types": ["node"],
    "paths": {
      "@awesome-enhancer/core": ["./packages/core/src/index.ts"]
    }
  },
  "exclude": ["node_modules", "dist"]
}
```

---

### vitest.workspace.ts

```typescript
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/core',
  'packages/cli',
  'packages/mcp-server',
  'packages/http-server',
]);
```

---

### .vscode/settings.json

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.preferences.importModuleSpecifier": "relative",
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/dist/**": true
  }
}
```

---

## Migration Phases

### Phase 1: Preparation (Day 1)

**Goal:** Set up workspace structure without breaking existing code

#### Step 1.1: Create Directory Structure

```bash
# Create packages directory
mkdir -p packages

# Move existing source to core package
mkdir -p packages/core/src
mv src/* packages/core/src/
mv tests/* packages/core/tests/ 2>/dev/null || true

# Create other package directories
mkdir -p packages/cli/src
mkdir -p packages/mcp-server/src
mkdir -p packages/http-server/src
```

#### Step 1.2: Create Root Workspace Config

```bash
# Backup current package.json
cp package.json package.json.backup

# Create new root package.json (see above)
```

#### Step 1.3: Create Package Configs

Create `packages/core/package.json`, `packages/cli/package.json`, etc.

#### Step 1.4: Install Workspace Dependencies

```bash
# Clean and reinstall
rm -rf node_modules bun.lock
bun install
```

**Verification:**

```bash
bun install --dry-run  # Should show workspace packages
```

---

### Phase 2: Extract Core Library (Day 2)

**Goal:** Move all core logic to `@awesome-enhancer/core`

#### Step 2.1: Update Imports in Core

Update all imports within `packages/core/src/` to use relative paths.

#### Step 2.2: Create Core Entry Point

```typescript
// packages/core/src/index.ts
export { enhance } from './enhance.js';
export { createEngine } from './core/engine-factory.js';
export { buildAppLayer } from './core/app-layer.js';

// Re-export types
export type { EnhanceOptions } from './core/schemas.js';
export type { StaleEntry } from './lib/stale-processor.js';
export type { RedirectEntry } from './lib/redirect-processor.js';
export type { AppError } from './core/errors.js';

// Re-export services
export { GitHubService, GitHubLive } from './services/github.js';
export { GitLabService, GitLabLive } from './services/gitlab.js';
export { ScraperService, ScraperLive } from './services/scraper.js';
export { CacheService, FileCacheLive } from './services/cache.js';
export { LoggerService, ConsoleLive, SilentLive } from './services/logger.js';

// Re-export errors
export { NetworkError, ConfigError, EnhanceError, ValidationError } from './core/errors.js';
```

#### Step 2.3: Configure Core Build

Create `packages/core/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.tsx'],
      tsconfigPath: './tsconfig.json',
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['esm'],
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    rollupOptions: {
      external: [/^node:/, 'axios', 'cheerio', 'dotenv', 'awesome-lint', 'fs', 'fs/promises'],
      output: {
        preserveModules: true,
        entryFileNames: '[name].js',
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

#### Step 2.4: Test Core Package

```bash
cd packages/core
bun run build
bun run test
```

---

### Phase 3: Extract CLI Package (Day 3)

**Goal:** Move CLI code to `@awesome-enhancer/cli`

#### Step 3.1: Move CLI Files

```bash
# Move CLI source
mv bin/cli.tsx packages/cli/src/index.tsx
mv src/ui/* packages/cli/src/ui/
mv src/commands/* packages/cli/src/commands/
```

#### Step 3.2: Update CLI Imports

Update imports to use `@awesome-enhancer/core`:

```typescript
// Before
import { enhance } from '../core/index.js';

// After
import { enhance } from '@awesome-enhancer/core';
```

#### Step 3.3: Create CLI Build Config

```typescript
// packages/cli/vite.config.ts
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      formats: ['esm'],
    },
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      external: [/^node:/, 'ink', 'react', '@awesome-enhancer/core'],
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
});
```

#### Step 3.4: Create CLI Binary Wrapper

```javascript
// packages/cli/bin/cli.js
#!/usr/bin/env node
import '../dist/index.js';
```

#### Step 3.5: Test CLI

```bash
cd packages/cli
bun run build
node bin/cli.js --help
```

---

### Phase 4: Extract Server Packages (Day 4)

**Goal:** Move MCP and HTTP servers to separate packages

#### Step 4.1: Move Server Files

```bash
# Move MCP server
mv bin/mcp-server.ts packages/mcp-server/src/index.ts

# Move HTTP server
mv bin/http-server.ts packages/http-server/src/index.ts
```

#### Step 4.2: Update Server Imports

```typescript
// Before
import { runEnhanceLocal, runEnhanceGithub } from '../src/core/runner.js';

// After
import { runEnhanceLocal, runEnhanceGithub } from '@awesome-enhancer/core';
```

#### Step 4.3: Create Server Build Configs

Similar to CLI config, create `packages/mcp-server/vite.config.ts` and `packages/http-server/vite.config.ts`.

#### Step 4.4: Test Servers

```bash
cd packages/mcp-server
bun run build

cd ../http-server
bun run build
```

---

### Phase 5: Update Root Configuration (Day 5)

**Goal:** Configure root-level tooling for monorepo

#### Step 5.1: Update Vite Config

Remove individual vite configs from root, keep only in packages.

#### Step 5.2: Configure Vitest Workspace

```typescript
// vitest.workspace.ts
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/core',
  'packages/cli',
  'packages/mcp-server',
  'packages/http-server',
]);
```

#### Step 5.3: Update Vite+ Config

If using `vite.config.ts` at root for shared config:

```typescript
// vite.config.ts (root)
import { defineConfig } from 'vite';

export default defineConfig({
  // Shared config for all packages
  // Can be extended by package-level configs
});
```

#### Step 5.4: Test All Commands

```bash
# Build all packages
bun run build

# Test all packages
bun run test

# Lint all packages
bun run lint
```

---

### Phase 6: Cleanup & Polish (Day 6)

**Goal:** Remove old files, update documentation

#### Step 6.1: Remove Old Files

```bash
# Remove old configs
rm -f rolldown.config.ts  # Already done
rm -f vite.config.cli.ts vite.config.mcp.ts vite.config.server.ts

# Remove old directories (now empty)
rmdir bin src tests 2>/dev/null || true
```

#### Step 6.2: Update Documentation

- Update README.md with new structure
- Update AGENTS.md
- Update CONTRIBUTING.md

#### Step 6.3: Update CI/CD

Update GitHub Actions workflows to work with monorepo:

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: voidzero-dev/setup-vp@v1
        with:
          node-version: '22'

      - uses: oven-sh/setup-bun@v2

      - run: bun install

      - run: bun run build
      - run: bun run test
      - run: bun run lint
```

---

## Migration Scripts

### Script 1: Setup Workspace

```bash
#!/bin/bash
# scripts/setup-monorepo.sh

set -e

echo "🚀 Setting up monorepo structure..."

# Create directories
mkdir -p packages/core/src packages/core/tests
mkdir -p packages/cli/src packages/cli/bin
mkdir -p packages/mcp-server/src
mkdir -p packages/http-server/src

# Move source files
echo "📦 Moving source files..."
mv src/* packages/core/src/
mv tests/* packages/core/tests/ 2>/dev/null || true
mv bin/cli.tsx packages/cli/src/index.tsx
mv bin/mcp-server.ts packages/mcp-server/src/index.ts
mv bin/http-server.ts packages/http-server/src/index.ts

echo "✅ Monorepo structure created!"
echo "Next steps:"
echo "1. Update package.json files"
echo "2. Run: bun install"
echo "3. Run: bun run build"
```

### Script 2: Update Imports

```bash
#!/bin/bash
# scripts/update-imports.sh

set -e

echo "🔄 Updating imports..."

# Find and replace imports in CLI package
find packages/cli/src -name "*.tsx" -o -name "*.ts" | while read file; do
  sed -i '' "s|from '\.\./\.\./src/|from '@awesome-enhancer/core/|g" "$file"
  sed -i '' "s|from '\.\./\.\./core/|from '@awesome-enhancer/core/|g" "$file"
done

# Find and replace imports in server packages
for pkg in mcp-server http-server; do
  find packages/$pkg/src -name "*.ts" | while read file; do
    sed -i '' "s|from '\.\./\.\./src/|from '@awesome-enhancer/core/|g" "$file"
  done
done

echo "✅ Imports updated!"
```

---

## Post-Migration Checklist

- [ ] All packages build successfully
- [ ] All tests pass (112 tests)
- [ ] Lint passes with 0 errors
- [ ] CLI binary works: `node packages/cli/bin/cli.js --help`
- [ ] MCP server works: `node packages/mcp-server/bin/mcp-server.js`
- [ ] HTTP server works: `node packages/http-server/bin/http-server.js`
- [ ] Type definitions generated correctly
- [ ] Documentation updated
- [ ] CI/CD pipeline updated
- [ ] README examples updated

---

## Publishing Strategy

### Using Changesets (Recommended)

```bash
# Install changesets
bun add -D @changesets/cli

# Initialize
bun changeset init

# When making changes
bun changeset
bun changeset version
bun changeset publish
```

### Package Publishing Order

1. `@awesome-enhancer/core` (no internal deps)
2. `@awesome-enhancer/cli` (depends on core)
3. `@awesome-enhancer/mcp-server` (depends on core)
4. `@awesome-enhancer/http-server` (depends on core)

---

## Troubleshooting

### Issue: Workspace packages not resolving

```bash
# Clear cache and reinstall
rm -rf node_modules bun.lock
bun install
```

### Issue: Import errors between packages

Ensure `workspace:*` is used in package.json:

```json
{
  "dependencies": {
    "@awesome-enhancer/core": "workspace:*"
  }
}
```

### Issue: Build outputs conflicting

Ensure each package has unique `outDir`:

```typescript
// Each package uses its own dist folder
outDir: 'dist'; // Not '../../dist/package-name'
```

---

## Timeline Summary

| Phase              | Duration | Tasks                       |
| ------------------ | -------- | --------------------------- |
| 1. Preparation     | Day 1    | Create structure, configs   |
| 2. Core Library    | Day 2    | Extract core, test builds   |
| 3. CLI Package     | Day 3    | Extract CLI, update imports |
| 4. Server Packages | Day 4    | Extract MCP & HTTP servers  |
| 5. Root Config     | Day 5    | Vitest workspace, Vite+     |
| 6. Cleanup         | Day 6    | Documentation, CI/CD        |

**Total Estimated Time:** 6 days (can be compressed to 2-3 days if no major issues)

---

## Next Steps After Migration

1. **Add VSCode Extension** - Create `packages/vscode-ext`
2. **Add Web UI** - Create `packages/web` with Next.js
3. **Add Desktop App** - Create `packages/desktop` with Electron/Tauri
4. **Add API Client** - Create `packages/client` for browser/Node
5. **Add Documentation Site** - Create `packages/docs` with VitePress

Each new package can import from `@awesome-enhancer/core` without touching CLI or server code.
