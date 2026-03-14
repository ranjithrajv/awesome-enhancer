import { existsSync } from 'fs';
import { join } from 'path';

/**
 * GitService handles local Git repository detection and operations
 */
export class GitService {
  /**
   * Check if the current working directory is a Git repository
   */
  static isGitRepo(): boolean {
    return existsSync(join(process.cwd(), '.git'));
  }

  /**
   * Check if a specific file exists locally (e.g., README.md)
   */
  static hasFile(filename: string): boolean {
    return existsSync(join(process.cwd(), filename));
  }

  /**
   * Get common README filenames in order of preference
   */
  static getReadmeCandidates(): string[] {
    return ['README.md', 'readme.md', 'Readme.md'];
  }

  /**
   * Find the most likely README file in the current directory
   */
  static findLocalReadme(): string | null {
    for (const candidate of this.getReadmeCandidates()) {
      if (this.hasFile(candidate)) {
        return candidate;
      }
    }
    return null;
  }
}
