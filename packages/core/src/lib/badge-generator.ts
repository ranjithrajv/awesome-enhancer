import { DEFAULT_BADGE_STYLE } from '../core/constants.js';

/**
 * BadgeGenerator handles creating shields.io badges for GitHub and GitLab
 */
export class BadgeGenerator {
  private style: string;

  constructor(style: string = DEFAULT_BADGE_STYLE) {
    this.style = style;
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

    const label = labels[type];
    const path = paths[type];
    let url = `https://img.shields.io/${path}?style=${this.style}`;

    if (type !== 'status-archived') {
      url = `https://img.shields.io/github/${path}?style=${this.style}`;
    }

    if (useHtml) {
      return `<img src="${url}" alt="${label}">`;
    }

    return `![${label}](${url})`;
  }

  generateRedirectBadge(label: string, owner: string, repo: string): string {
    const url = `https://img.shields.io/badge/${label}-${owner}/${repo}-blue?style=flat-square`;
    return `<img src="${url}" alt="${label}">`;
  }
}
