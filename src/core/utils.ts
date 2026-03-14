/**
 * Parse GitHub repository URL
 * @param {string} url - URL to parse
 * @returns {object|null} - { owner, repo } or null if not a GitHub URL
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [
    /github\.com\/([^/]+)\/([^/\s#?]+)/i,
    /github\.com\/([^/]+)\/([^/\s#?]+)\.git/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
      };
    }
  }

  return null;
}

/**
 * Parse GitLab repository URL
 * @param {string} url - URL to parse
 * @returns {object|null} - { owner, repo } or null if not a GitLab URL
 */
export function parseGitLabUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [
    /gitlab\.com\/([^/]+)\/([^/\s#?]+)/i,
    /gitlab\.com\/([^/]+)\/([^/\s#?]+)\.git/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
      };
    }
  }

  return null;
}

/**
 * Validate URL format
 */
export function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

/**
 * Format number with K/M suffix
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
