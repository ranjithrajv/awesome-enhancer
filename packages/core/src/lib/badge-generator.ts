import { DEFAULT_BADGE_STYLE } from '../core/constants.js';

export type Platform = 'github' | 'gitlab';

/**
 * BadgeGenerator handles creating shields.io badges for GitHub and GitLab
 */
export class BadgeGenerator {
  private style: string;
  private platform: Platform;

  constructor(style: string = DEFAULT_BADGE_STYLE, platform: Platform = 'github') {
    this.style = style;
    this.platform = platform;
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
    let url: string;

    if (this.platform === 'gitlab') {
      if (type === 'status-archived') {
        url = `https://img.shields.io/badge/status-archived-red?style=${this.style}`;
      } else if (type === 'language') {
        url = `https://img.shields.io/gitlab/v/release/${owner}%2F${repo}?style=${this.style}`;
      } else {
        url = `https://img.shields.io/gitlab/${path}?style=${this.style}`;
      }
    } else {
      if (type === 'status-archived') {
        url = `https://img.shields.io/badge/status-archived-red?style=${this.style}`;
      } else {
        url = `https://img.shields.io/github/${path}?style=${this.style}`;
      }
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
