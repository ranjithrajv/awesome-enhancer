import { DEFAULT_BADGE_STYLE } from '../core/constants.js';

/**
 * BadgeGenerator handles creating shields.io badges
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
    type: 'stars' | 'forks' | 'language' | 'last-commit',
    owner: string,
    repo: string,
    useHtml: boolean = true,
  ): string {
    const labels: Record<string, string> = {
      stars: 'Stars',
      forks: 'Forks',
      language: 'Language',
      'last-commit': 'Last Commit',
    };

    const paths: Record<string, string> = {
      stars: `stars/${owner}/${repo}`,
      forks: `forks/${owner}/${repo}`,
      language: `languages/top/${owner}/${repo}`,
      'last-commit': `last-commit/${owner}/${repo}`,
    };

    const label = labels[type] || 'GitHub';
    const path = paths[type];
    const url = `https://img.shields.io/github/${path}?style=${this.style}`;

    if (useHtml) {
      return `<img src="${url}" alt="${label}">`;
    }

    return `![${label}](${url})`;
  }
}
