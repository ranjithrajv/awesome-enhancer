import { DEFAULT_BADGE_STYLE } from '../core/constants.js';

/**
 * BadgeGenerator handles creating shields.io badges for GitHub and GitLab
 */
export class BadgeGenerator {
  private style: string;
  private provider: 'github' | 'gitlab';

  constructor(style: string = DEFAULT_BADGE_STYLE, provider: 'github' | 'gitlab' = 'github') {
    this.style = style;
    this.provider = provider;
  }

  /**
   * Generate badge in HTML (default)
   */
  generateBadge(
    type: 'stars' | 'forks' | 'language' | 'last-commit' | 'status-archived',
    owner: string,
    repo: string,
    useHtml: boolean = true,
  ): string {
    const labels: Record<string, string> = {
      stars: 'Stars',
      forks: 'Forks',
      language: 'Language',
      'last-commit': 'Last Commit',
      'status-archived': 'Status',
    };

    const paths: Record<string, string> = {
      stars: `stars/${owner}/${repo}`,
      forks: `forks/${owner}/${repo}`,
      language: `languages/top/${owner}/${repo}`,
      'last-commit': `last-commit/${owner}/${repo}`,
      'status-archived': `badge/status-archived-red`,
    };

    const label = labels[type] || (this.provider === 'github' ? 'GitHub' : 'GitLab');
    const path = paths[type];
    let url = `https://img.shields.io/${path}?style=${this.style}`;

    // For GitHub badges, we need the github/ prefix
    if (this.provider === 'github' && type !== 'status-archived') {
      url = `https://img.shields.io/github/${path}?style=${this.style}`;
    }

    // For GitLab badges, we need the gitlab/ prefix
    if (this.provider === 'gitlab' && type !== 'status-archived') {
      url = `https://img.shields.io/gitlab/${path}?style=${this.style}`;
    }

    if (useHtml) {
      return `<img src="${url}" alt="${label}">`;
    }

    return `![${label}](${url})`;
  }
}
