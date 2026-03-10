# awesome-enhance

AI-agent friendly CLI tool to automatically enhance awesome lists with metadata and improved descriptions.

## Installation

```bash
npm install -g awesome-enhance
# or
bun install -g awesome-enhance
```

## For AI Agents

This tool exposes three MCP tools for enhancing awesome lists:

### enhance_local_file

Enhance a local markdown file.

```json
{
  "name": "enhance_local_file",
  "arguments": {
    "file_path": "path/to/README.md",
    "add_metadata": true,
    "update_descriptions": false,
    "output_path": "path/to/output.md",
    "dry_run": false
  }
}
```

### enhance_github_url

Enhance a GitHub repository's README directly.

```json
{
  "name": "enhance_github_url",
  "arguments": {
    "github_url": "https://github.com/user/awesome-list",
    "add_metadata": true,
    "update_descriptions": true,
    "output_path": "enhanced.md",
    "dry_run": false
  }
}
```

### enhance_with_json_output

Enhance and get results as JSON for programmatic use.

```json
{
  "name": "enhance_with_json_output",
  "arguments": {
    "file_path": "path/to/README.md",
    "add_metadata": true,
    "update_descriptions": false
  }
}
```

## Options

| Option                | Description                              | Default          |
| --------------------- | ---------------------------------------- | ---------------- |
| `add_metadata`        | Add GitHub stars, forks, language badges | `true`           |
| `update_descriptions` | Scrape and improve descriptions          | `false`          |
| `output_path`         | Output file path                         | Overwrites input |
| `dry_run`             | Preview without writing                  | `false`          |
| `skip_lint`           | Skip awesome-lint checks                 | `false`          |
| `github_token`        | GitHub API token for higher rate limits  | From env         |

## Environment Variables

- `GITHUB_TOKEN` - GitHub API token for higher rate limits
- `AWESOME_ENHANCE_CACHE_TTL` - Cache TTL in seconds (default: 3600)

## Usage Examples

### CLI

```bash
# Add metadata to local file
awesome-enhance README.md --add-metadata

# Add metadata and improve descriptions
awesome-enhance README.md --add-metadata --update-descriptions

# Preview changes without writing
awesome-enhance README.md --add-metadata --dry-run

# Enhance from GitHub URL
awesome-enhance https://github.com/user/awesome-list --add-metadata
```

### JSON Output

```bash
# Get JSON output for programmatic use
awesome-enhance README.md --add-metadata --dry-run --json
```
