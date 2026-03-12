import { readFile } from 'fs/promises';
import { join } from 'path';
import dotenv from 'dotenv';
import { ConfigSchema, type Config } from './schemas.js';

dotenv.config();

export type { Config };

export async function loadConfig(): Promise<Config> {
  const configPath = join(process.cwd(), '.awesomerc.json');
  let fileConfig: Record<string, unknown> = {};

  try {
    const content = await readFile(configPath, 'utf-8');
    fileConfig = JSON.parse(content);
  } catch {
    // Config file is optional
  }

  return ConfigSchema.parse({
    ...fileConfig,
    githubToken: process.env.GITHUB_TOKEN || fileConfig.githubToken,
  });
}
