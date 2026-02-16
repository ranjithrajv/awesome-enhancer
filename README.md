# awesome-enhance

> CLI tool to automatically enhance awesome lists with metadata and improved descriptions

## Features

- 📊 **Metadata Extraction** - Automatically add GitHub stats (stars, forks, last updated, language)
- 📝 **Auto-describe** - Generate or improve descriptions using web scraping
- 🔍 **Linting Integration** - Runs `awesome-lint` both **before and after** enhancements to help you track improvements
- 🌐 **URL Support** - Enhance lists directly from GitHub repository URLs

## Installation

```bash
npm install
# Or for global usage
npm install -g .
```

## Usage

Pass a **local markdown file** or a **GitHub repository URL** to the `enhance` command:

```bash
# Enhance a local file
awesome-enhance enhance your-list.md --add-metadata

# Enhance a remote GitHub repository
awesome-enhance enhance https://github.com/user/repo --add-metadata --output enhanced-list.md
```

### Options

- `--add-metadata` - Add GitHub repository metadata (stars, language)
- `--update-descriptions` - Improve descriptions via web scraping
- `--output <file>` - Output file (default: overwrites input, or `enhanced-readme.md` for URLs)
- `--dry-run` - Preview changes without writing to file
- `--github-token <token>` - GitHub API token for higher rate limits
- `--skip-lint` - Skip running awesome-lint

## Configuration

Create a `.awesomerc.json` file in your project root:

```json
{
  "githubToken": "your-github-token-here",
  "cacheTTL": 86400
}
```

### GitHub Token

For better rate limits, create a GitHub personal access token:

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. No scopes needed for public repositories
4. Add to `.awesomerc.json` or use `--github-token` flag

## Example

**Before:**

```markdown
- [axios](https://github.com/axios/axios) - Promise based HTTP client
```

**After:**

```markdown
- [axios](https://github.com/axios/axios) - Promise based HTTP client for the browser and node.js ![Stars](https://img.shields.io/github/stars/axios/axios?style=flat-square) ![Language](https://img.shields.io/github/languages/top/axios/axios?style=flat-square)
```

## License Recommendations

### For Awesome Lists (Content)

We strongly recommend using the **CC0 1.0 Universal (CC0 1.0) Public Domain Dedication** for your awesome list content.

Awesome lists are curated collections of information. Using CC0 ensures that:

- Anyone can reuse and build upon the list without legal friction.
- There are no requirements for attribution (though it's still good practice).
- The list remains a truly open community resource.

To apply CC0, add a `LICENSE` file with the CC0 text and include the following in your README:

```markdown
[![CC0](https://mirrors.creativecommons.org/presskit/buttons/88x31/svg/cc-zero.svg)](https://creativecommons.org/publicdomain/zero/1.0/)

To the extent possible under law, [Your Name] has waived all copyright and related or neighboring rights to this work.
```

### For This Tool (Code)

This tool is licensed under the **GNU Affero General Public License v3.0 (AGPLv3)**. See [LICENSE](LICENSE) for details.

This choice ensures that improvements to the tool are shared back with the community, especially if the tool is used to provide a service over a network.
