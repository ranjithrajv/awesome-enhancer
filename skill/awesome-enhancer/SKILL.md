# awesome-enhancer

AI-agent friendly CLI tool to automatically enhance awesome lists with metadata and improved descriptions.

## Installation

```bash
npm install -g awesome-enhancer
# or
bun install -g awesome-enhancer
```

## For AI Agents

This tool exposes MCP tools for enhancing awesome lists:

### enhance_local_file

Enhance a local markdown file.

```json
{
  "name": "enhance_local_file",
  "arguments": {
    "file_path": "path/to/README.md",
    "add_metadata": true,
    "update_descriptions": false,
    "detect_stale": false,
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
    "detect_stale": false,
    "output_path": "enhanced.md",
    "dry_run": false
  }
}
```

### enhance_gitlab_url

Enhance a GitLab repository's README directly.

```json
{
  "name": "enhance_gitlab_url",
  "arguments": {
    "gitlab_url": "https://gitlab.com/user/awesome-list",
    "add_metadata": true,
    "update_descriptions": true,
    "detect_stale": false,
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
    "update_descriptions": false,
    "detect_stale": false
  }
}
```

## Options

| Option                | Description                              | Default          |
| --------------------- | ---------------------------------------- | ---------------- |
| `add_metadata`        | Add GitHub/GitLab stars, forks, lang     | `true`           |
| `update_descriptions` | Scrape and improve descriptions          | `false`          |
| `detect_stale`        | Detect archived, disabled, deleted repos | `false`          |
| `output_path`         | Output file path                         | Overwrites input |
| `dry_run`             | Preview without writing                  | `false`          |
| `skip_lint`           | Skip awesome-lint checks                 | `false`          |
| `github_token`        | GitHub API token for higher rate limits  | From env         |
| `gitlab_token`        | GitLab API token for higher rate limits  | From env         |

## Environment Variables

- `GITHUB_TOKEN` - GitHub API token for higher rate limits
- `GITLAB_TOKEN` - GitLab API token for higher rate limits
- `AWESOME_ENHANCE_CACHE_TTL` - Cache TTL in seconds (default: 3600)

## Usage Examples

### CLI

```bash
# Add metadata to local file
awesome-enhancer README.md --add-metadata

# Add metadata and improve descriptions
awesome-enhancer README.md --add-metadata --update-descriptions

# Detect stale repositories
awesome-enhancer README.md --detect-stale

# Preview changes without writing
awesome-enhancer README.md --add-metadata --dry-run

# Enhance from GitHub URL
awesome-enhancer https://github.com/user/awesome-list --add-metadata

# Enhance from GitLab URL
awesome-enhancer https://gitlab.com/user/awesome-list --add-metadata
```

### JSON Output

```bash
# Get JSON output for programmatic use
awesome-enhancer README.md --add-metadata --dry-run --json
```
