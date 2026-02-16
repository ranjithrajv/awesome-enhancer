import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class Cache {
  private cacheDir: string;
  private ttl: number;

  constructor(cacheDir: string = '.awesome-cache', ttl: number = 86400) {
    // Save cache in home directory or project root? Let's stick to project root for now
    this.cacheDir = join(process.cwd(), cacheDir);
    this.ttl = ttl * 1000; // Convert to ms
  }

  private async ensureCacheDir(): Promise<void> {
    if (!existsSync(this.cacheDir)) {
      await mkdir(this.cacheDir, { recursive: true });
    }
  }

  private getFilePath(key: string): string {
    // Simple hash/filename from key (URL)
    const fileName =
      Buffer.from(key).toString('base64').replace(/\//g, '_').substring(0, 200) + '.json';
    return join(this.cacheDir, fileName);
  }

  async get<T>(key: string): Promise<T | null> {
    const filePath = this.getFilePath(key);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(content);

      const now = Date.now();
      if (now - entry.timestamp > this.ttl) {
        return null; // Expired
      }

      return entry.data;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, data: T): Promise<void> {
    await this.ensureCacheDir();
    const filePath = this.getFilePath(key);

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };

    await writeFile(filePath, JSON.stringify(entry), 'utf-8');
  }
}
