/**
 * Parse GitHub repository URL
 * @param {string} url - URL to parse
 * @returns {object|null} - { owner, repo } or null if not a GitHub URL
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  return parseGitUrl(url, 'github.com');
}

/**
 * Parse GitLab repository URL
 * @param {string} url - URL to parse
 * @param {string} [customDomain] - Optional custom GitLab domain (e.g., 'gitlab.company.com')
 * @returns {object|null} - { owner, repo } or null if not a GitLab URL
 */
export function parseGitLabUrl(
  url: string,
  customDomain?: string,
): { owner: string; repo: string } | null {
  const domain = customDomain || 'gitlab.com';
  return parseGitUrl(url, domain);
}

function parseGitUrl(url: string, domain: string): { owner: string; repo: string } | null {
  const patterns = [
    new RegExp(`${domain}/([^/]+)/([^/\\s#?]+)`, 'i'),
    new RegExp(`${domain}/([^/]+)/([^/\\s#?]+)\\.git`, 'i'),
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

export type BadgeType = 'stars' | 'forks' | 'language' | 'last-commit';

const BADGE_PATTERNS: Record<BadgeType, RegExp> = {
  stars: /img\.shields\.io\/(?:github|gitlab)\/stars\/[^/]+\/[^/?#]+/i,
  forks: /img\.shields\.io\/(?:github|gitlab)\/forks\/[^/]+\/[^/?#]+/i,
  language: /img\.shields\.io\/(?:github\/languages\/top|gitlab\/v\/release)\/[^/?#]+/i,
  'last-commit': /img\.shields\.io\/(?:github|gitlab)\/last-commit\/[^/]+\/[^/?#]+/i,
};

/**
 * Detect which metadata badges are already present in the text
 */
export function detectExistingBadges(text: string): BadgeType[] {
  const existing: BadgeType[] = [];
  for (const [badgeType, pattern] of Object.entries(BADGE_PATTERNS) as [BadgeType, RegExp][]) {
    if (pattern.test(text)) {
      existing.push(badgeType);
    }
  }
  return existing;
}

/**
 * Get list of missing badge types
 */
export function getMissingBadges(existing: BadgeType[]): BadgeType[] {
  const allBadges: BadgeType[] = ['stars', 'forks', 'language', 'last-commit'];
  return allBadges.filter((badge) => !existing.includes(badge));
}
