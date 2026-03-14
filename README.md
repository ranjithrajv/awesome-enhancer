# awesome-enhancer

> CLI tool to automatically enhance awesome lists with metadata and improved descriptions

## Features

- 📊 **Metadata Extraction** - Automatically add GitHub stats (stars, forks, language)
- 📝 **Auto-describe** - Generate or improve descriptions via web scraping
- 🛡️ **Stale Detection** - Detect archived, disabled, and deleted GitHub repositories
- 🌐 **URL Support** - Enhance lists directly from GitHub repository URLs
- 🤖 **AI-Agent Friendly** - MCP server and HTTP API for programmatic access
- 🖥️ **Interactive TUI** - Guided prompts for option selection
- ⚡ **Fast** - Built with Bun, cached API calls

## Installation

```bash
# Global
npm install -g awesome-enhancer

# Or via Bun
bun install -g awesome-enhancer
```

## CLI Usage

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
| `--add-metadata`        | Add GitHub stars, forks, language badges                   |
| `--update-descriptions` | Improve descriptions via web scraping                      |
| `--detect-stale`        | Detect archived, disabled, and deleted GitHub repositories |
| `--output <file>`       | Output file path                                           |
| `--dry-run`             | Preview without writing                                    |
| `--skip-lint`           | Skip awesome-lint checks                                   |
| `--github-token`        | GitHub API token for higher rate limits                    |

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
```

## Configuration

Set `GITHUB_TOKEN` env var for higher rate limits.

## License

- **Code**: AGPL-3.0 (see [LICENSE](LICENSE))
- **Content**: CC0 1.0 recommended for awesome lists
