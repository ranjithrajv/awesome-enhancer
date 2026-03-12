import { readFile } from 'fs/promises';
import { join } from 'path';
import dotenv from 'dotenv';
import { DEFAULT_CACHE_TTL } from './constants.js';

// Load .env file
dotenv.config();

export interface Config {
  githubToken?: string;
  cacheTTL: number;
}

const DEFAULT_CONFIG: Config = {
  cacheTTL: DEFAULT_CACHE_TTL,
};

/**
 * Load configuration from .awesomerc.json or environment variables
 */
export async function loadConfig(): Promise<Config> {
  const configPath = join(process.cwd(), '.awesomerc.json');
  let fileConfig: Partial<Config> = {};

  try {
    const content = await readFile(configPath, 'utf-8');
    fileConfig = JSON.parse(content);
  } catch {
    // Config file is optional
  }

  return {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    // Environment variables take precedence for DX
    githubToken: process.env.GITHUB_TOKEN || fileConfig.githubToken,
  };
}
