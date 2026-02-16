import { BaseService } from './base-service.js';

export class GitHubService extends BaseService {
  private githubToken: string | null;
  private rateLimitRemaining: string | null = null;

  constructor(githubToken: string | null = null, cacheTTL: number = 86400) {
    super('awesome-enhance-github', cacheTTL);
    this.githubToken = githubToken;
  }

  async fetchRepoMetadata(owner: string, repo: string): Promise<any> {
    const url = `https://api.github.com/repos/${owner}/${repo}`;

    const headers: any = {
      Accept: 'application/vnd.github.v3+json',
    };

    if (this.githubToken) {
      headers['Authorization'] = `token ${this.githubToken}`;
    }

    const result = await this.getCached<any>(url, headers);

    if (result) {
      this.rateLimitRemaining = result.headers['x-ratelimit-remaining'];
      return result.data;
    }

    return null;
  }

  async fetchRepoReadme(owner: string, repo: string): Promise<string | null> {
    const url = `https://api.github.com/repos/${owner}/${repo}/readme`;

    const headers: any = {
      Accept: 'application/vnd.github.v3.raw',
    };

    if (this.githubToken) {
      headers['Authorization'] = `token ${this.githubToken}`;
    }

    const result = await this.getCached<string>(url, headers);
    return result ? result.data : null;
  }

  getRateLimitStatus(): string | null {
    return this.rateLimitRemaining;
  }
}
