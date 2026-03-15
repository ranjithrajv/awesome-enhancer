# awesome-enhancer

> CLI tool to automatically enhance awesome lists with metadata and improved descriptions

[![Test](https://github.com/ranjithrajv/awesome-enhancer/actions/workflows/bun.yml/badge.svg)](https://github.com/ranjithrajv/awesome-enhancer/actions/workflows/bun.yml)
[![Release](https://github.com/ranjithrajv/awesome-enhancer/actions/workflows/release.yml/badge.svg)](https://github.com/ranjithrajv/awesome-enhancer/actions/workflows/release.yml)
[![npm](https://img.shields.io/npm/v/awesome-enhancer.svg)](https://www.npmjs.com/package/awesome-enhancer)
[![npm](https://img.shields.io/npm/dm/awesome-enhancer.svg)](https://www.npmjs.com/package/awesome-enhancer)
[![Enhanced with awesome-enhancer](https://img.shields.io/badge/enhanced%20with-awesome--enhancer-blue?style=flat-square)](https://github.com/ranjithrajv/awesome-enhancer)

**Cross-Platform Support:** 🐧 Linux | 🍎 macOS | 🪟 Windows

## Clients

| Client | Package | Status |
|--------|---------|--------|
| **CLI** — interactive TUI + non-interactive flags | `awesome-enhancer` | ✅ Available |
| **GitHub Action** — runs in CI, annotations + step summaries | `@awesome-enhancer/action` | ✅ Available |
| **GitLab CI** — env-var driven, posts MR notes | `@awesome-enhancer/gitlab-ci` | ✅ Available |
| **HTTP API** — REST server on port 9867 | `@awesome-enhancer/http-server` | ✅ Available |
| **MCP Server** — AI agent integration (Claude, etc.) | `@awesome-enhancer/mcp-server` | ✅ Available |
| **Web UI** — SPA served at `/ui`, Alpine.js + marked, no build | `@awesome-enhancer/web` | ✅ Available |
| **VS Code Extension** — enhance from the editor command palette | — | 🗓️ Planned |
| **GitHub App** — auto-enhances on schedule or PR trigger | — | 🗓️ Planned |
| **Raycast Extension** — quick-access from macOS command palette | — | 🗓️ Planned |

## 🎯 Quick Start

```bash
# Try it now (requires Bun for development)
bunx awesome-enhancer README.md --add-metadata

# Or install globally
npm install -g awesome-enhancer

# Then use anywhere
awesome-enhancer README.md --add-metadata
```

> **Note:** For development, use `bun run dev` or install globally. After npm publish, `npx awesome-enhancer` will work without installation.

## ✨ Visual Example

**Before:**

```markdown
- [axios](https://github.com/axios/axios) - Promise based HTTP client
- [node-fetch](https://github.com/node-fetch/node-fetch) - A light-weight module
```

**After (with `--add-metadata --detect-stale`):**

```markdown
- [axios](https://github.com/axios/axios) (⭐ 110k) - Promise based HTTP client for browser and Node.js ![TypeScript](https://img.shields.io/github/languages/top/axios/axios)
- [node-fetch](https://github.com/node-fetch/node-fetch) (⭐ 8.5k) - A light-weight module that brings window.fetch to Node.js ![JavaScript](https://img.shields.io/github/languages/top/node-fetch/node-fetch)
```

**Enhancement Summary:**

- ⭐ **Metadata added**: Stars, forks, language badges
- 📝 **Improved descriptions**: More context and clarity
- 🔍 **Stale detection**: Identifies archived/deleted repos
- 🔀 **Redirect detection**: Finds renamed/transferred repos

## Installation

```bash
# Install globally (recommended)
npm install -g awesome-enhancer

# Or via Bun
bun install -g awesome-enhancer

# Try without installation (after npm publish)
npx awesome-enhancer README.md --add-metadata
```

## Features

- 📊 **Metadata Extraction** - Automatically add GitHub/GitLab stats (stars, forks, language)
- 📝 **Auto-describe** - Generate or improve descriptions via web scraping
- 🛡️ **Stale Detection** - Detect archived, disabled, and deleted GitHub/GitLab repositories
- 🔀 **Redirect Detection** - Detect repository transfers and renames
- 🌐 **URL Support** - Enhance lists directly from GitHub or GitLab repository URLs
- 🤖 **AI-Agent Friendly** - MCP server and HTTP API for programmatic access
- 🖥️ **Interactive TUI** - Guided prompts for option selection
- 🔁 **GitHub Action** - Run enhancements in CI with annotations and step summaries
- 🦊 **GitLab CI** - Native GitLab CI client with MR note posting
- ⚡ **Fast** - Built with Bun, cached API calls

## CLI Usage

### One-Command Enhancement (Recommended)

```bash
# Enhance with metadata
awesome-enhancer README.md --add-metadata

# Enhance with metadata and stale detection
awesome-enhancer README.md --add-metadata --detect-stale

# Preview changes before applying
awesome-enhancer README.md --add-metadata --dry-run

# Save to a different file
awesome-enhancer README.md --add-metadata --output enhanced.md
```

### Interactive Mode

```bash
# Run with guided prompts
awesome-enhancer
```

### With Flags (Non-Interactive)

```bash
# Interactive mode (with prompts)
awesome-enhancer

# With flags
awesome-enhancer README.md --add-metadata --dry-run
awesome-enhancer https://github.com/user/awesome-list --add-metadata --output enhanced.md
```

### Options

| Flag                    | Description                                                |
| ----------------------- | ---------------------------------------------------------- |
| `--add-metadata`        | Add GitHub/GitLab stars, forks, language badges            |
| `--update-descriptions` | Improve descriptions via web scraping                      |
| `--detect-stale`        | Detect archived, disabled, and deleted GitHub/GitLab repos |
| `--detect-redirects`    | Detect repository transfers and renames                    |
| `--output <file>`       | Output file path                                           |
| `--dry-run`             | Preview without writing                                    |
| `--skip-lint`           | Skip awesome-lint checks                                   |
| `--github-token`        | GitHub API token for higher rate limits                    |
| `--gitlab-token`        | GitLab API token for higher rate limits                    |

## CI/CD Integration

### GitHub Action

Add to any workflow — no installation needed:

```yaml
# .github/workflows/enhance.yml
name: Enhance awesome list

on:
  schedule:
    - cron: '0 0 * * 0'  # weekly
  workflow_dispatch:

jobs:
  enhance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ranjithrajv/awesome-enhancer/packages/action@main
        with:
          file: README.md
          add-metadata: true
          detect-stale: true
          commit-changes: true
```

**Inputs:**

| Input | Default | Description |
|---|---|---|
| `file` | `README.md` | Path to the awesome list |
| `add-metadata` | `true` | Add stars, forks, language badges |
| `update-descriptions` | `false` | Improve descriptions via scraping |
| `detect-stale` | `false` | Flag archived/deleted repos |
| `detect-redirects` | `false` | Detect URL redirects |
| `dry-run` | `false` | Preview in step summary without writing |
| `commit-changes` | `false` | Auto-commit and push enhanced file |
| `commit-message` | `chore: enhance awesome list` | Commit message |
| `github-token` | `github.token` | GitHub API token |

Stale and redirect findings appear as annotations in the Actions UI. Dry-run output is posted as a step summary.

### GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - enhance

enhance-readme:
  image: node:20-slim
  stage: enhance
  variables:
    AE_ADD_METADATA: "true"
    AE_DETECT_STALE: "true"
    AE_COMMIT_CHANGES: "true"
    AE_COMMIT_MESSAGE: "chore: enhance awesome list"
    # GL_TOKEN: set in Settings > CI/CD > Variables (write_repository scope)
  script:
    - npx @awesome-enhancer/gitlab-ci
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
    - if: $CI_PIPELINE_SOURCE == "web"
```

**Variables:**

| Variable | Default | Description |
|---|---|---|
| `AE_FILE` | `README.md` | Path to the awesome list |
| `AE_ADD_METADATA` | `true` | Add stars, forks, language badges |
| `AE_UPDATE_DESCRIPTIONS` | `false` | Improve descriptions via scraping |
| `AE_DETECT_STALE` | `false` | Flag archived/deleted repos |
| `AE_DETECT_REDIRECTS` | `false` | Detect URL redirects |
| `AE_DRY_RUN` | `false` | Preview without writing |
| `AE_COMMIT_CHANGES` | `false` | Auto-commit and push enhanced file |
| `AE_COMMIT_MESSAGE` | `chore: enhance awesome list` | Commit message |

When running in a merge request pipeline, results are automatically posted as an MR note.

## AI-Agent Integration

### MCP Server (for Claude, etc.)

```bash
# Start MCP server
awesome-enhancer-mcp
```

Available tools:

- `enhance_local_file` - Enhance local markdown files
- `enhance_github_url` - Enhance GitHub URLs
- `enhance_with_json_output` - Get results as JSON

### HTTP API Server

```bash
# Start HTTP server on port 9867
awesome-enhancer-server
```

```bash
# Or run directly
npm run dev:server
```

**Endpoints:**

| Method | Path              | Description             |
| ------ | ----------------- | ----------------------- |
| GET    | `/`               | API info                |
| GET    | `/health`         | Health check            |
| POST   | `/enhance`        | Auto-detect source type |
| POST   | `/enhance/local`  | Enhance local file      |
| POST   | `/enhance/github` | Enhance GitHub URL      |
| POST   | `/enhance/gitlab` | Enhance GitLab URL      |

**Example:**

```bash
curl -X POST http://localhost:9867/enhance/local \
  -H "Content-Type: application/json" \
  -d '{"file_path": "README.md", "add_metadata": true, "dry_run": true}'
```

## Claude Desktop Integration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "awesome-enhancer": {
      "command": "npx",
      "args": ["awesome-enhancer-mcp"]
    }
  }
}
```

## Example

**Before:**

```markdown
- [axios](https://github.com/axios/axios) - Promise based HTTP client
- [axios/axios-mock-adapter](https://github.com/axios/axios-mock-adapter) - Mock library
```

**After (with --add-metadata --detect-stale):**

```markdown
- [axios](https://github.com/axios/axios) (⭐ 110k) - Promise based HTTP client for browser and Node.js ![TypeScript](https://img.shields.io/github/languages/top/axios/axios)
- [axios/axios-mock-adapter](https://github.com/axios/axios-mock-adapter) - Mock library ![Status](https://img.shields.io/badge/status-archived-red?style=flat-square)
- [gitlab-org/gitlab](https://gitlab.com/gitlab-org/gitlab) (⭐ 10k) - GitLab - Ruby on Rails based Git hosting, CI/CD, and more ![Ruby](https://img.shields.io/gitlab/languages/top/gitlab-org/gitlab)
```

## Configuration

Set `GITHUB_TOKEN` or `GITLAB_TOKEN` env vars for higher rate limits.

## 🏷️ Add Badge to Your Awesome List

Show that your list is enhanced with awesome-enhancer:

```markdown
[![Enhanced with awesome-enhancer](https://img.shields.io/badge/enhanced%20with-awesome--enhancer-blue?style=flat-square)](https://github.com/ranjithrajv/awesome-enhancer)
```

**Other badge styles:**

```markdown
<!-- Flat style -->

[![Enhanced with awesome-enhancer](https://img.shields.io/badge/enhanced%20with-awesome--enhancer-blue?style=flat)](https://github.com/ranjithrajv/awesome-enhancer)

<!-- For the badge style -->

[![Enhanced with awesome-enhancer](https://img.shields.io/badge/enhanced%20with-awesome--enhancer-blue)](https://github.com/ranjithrajv/awesome-enhancer)

<!-- Social style -->

[![Enhanced with awesome-enhancer](https://img.shields.io/badge/enhanced%20with-awesome--enhancer-blue?style=social)](https://github.com/ranjithrajv/awesome-enhancer)
```

## License

- **Code**: AGPL-3.0 (see [LICENSE](LICENSE))
- **Content**: CC0 1.0 recommended for awesome lists
