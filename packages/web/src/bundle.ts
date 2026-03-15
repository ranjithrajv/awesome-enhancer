import { Effect, Layer, Option } from 'effect';
import {
  CacheService,
  SilentLive,
  GitHubLive,
  GitLabLive,
  GitHubService,
  GitLabService,
  ScraperService,
  createEngine,
  EnhanceOptionsSchema,
  parseGitHubUrl,
  parseGitLabUrl,
} from '@awesome-enhancer/core';

// ── In-memory cache (replaces filesystem cache) ──────────────────────────────
const memCache = new Map<string, unknown>();

const BrowserCacheLive = Layer.succeed(CacheService, {
  get: <T>(key: string) =>
    Effect.sync(() => {
      const val = memCache.get(key);
      return val !== undefined ? Option.some(val as T) : Option.none<T>();
    }),
  set: <T>(key: string, data: T) =>
    Effect.sync(() => {
      memCache.set(key, data);
    }),
});

// ── No-op scraper (arbitrary URL fetches are CORS-blocked in browsers) ────────
const NoopScraperLive = Layer.succeed(ScraperService, {
  fetchGitHubDescription: () => Effect.succeed(Option.none()),
  fetchGitLabDescription: () => Effect.succeed(Option.none()),
  fetchWebsiteDescription: () => Effect.succeed(Option.none()),
});

// ── Browser app layer (no FileCacheLive, no ScraperLive) ─────────────────────
function buildBrowserLayer(githubToken: string | null, gitlabToken: string | null) {
  const deps = Layer.merge(BrowserCacheLive, SilentLive);
  const githubLayer = GitHubLive(githubToken).pipe(Layer.provide(deps));
  const gitlabLayer = GitLabLive(gitlabToken).pipe(Layer.provide(deps));
  return Layer.mergeAll(githubLayer, gitlabLayer, NoopScraperLive, SilentLive, BrowserCacheLive);
}

// ── Public API ────────────────────────────────────────────────────────────────
export interface EnhanceOpts {
  addMetadata?: boolean;
  detectStale?: boolean;
  detectRedirects?: boolean;
  githubToken?: string;
  gitlabToken?: string;
}

export interface EnhanceResult {
  success: boolean;
  preview: string;
  stale_entries: Array<{ name: string; url: string; reason: string }>;
  redirect_entries: Array<{ name: string; url: string; newUrl: string; reason: string }>;
}

async function runEngine(
  content: string,
  opts: EnhanceOpts,
  githubToken: string | null,
  gitlabToken: string | null,
): Promise<EnhanceResult> {
  const options = EnhanceOptionsSchema.parse({
    addMetadata: opts.addMetadata ?? false,
    updateDescriptions: false, // CORS-blocked in browser
    detectStale: opts.detectStale ?? true,
    detectRedirects: opts.detectRedirects ?? true,
    githubToken,
    gitlabToken,
  });

  const layer = buildBrowserLayer(githubToken, gitlabToken);
  const engine = createEngine(options);
  const result = await Effect.runPromise(engine.process(content).pipe(Effect.provide(layer)));

  return {
    success: true,
    preview: result.content,
    stale_entries: result.staleEntries ?? [],
    redirect_entries: result.redirectEntries ?? [],
  };
}

export async function enhanceGitHub(url: string, opts: EnhanceOpts = {}): Promise<EnhanceResult> {
  const githubToken = opts.githubToken || null;
  const gitlabToken = opts.gitlabToken || null;
  const info = parseGitHubUrl(url);
  if (!info) throw new Error('Invalid GitHub URL');

  const layer = buildBrowserLayer(githubToken, gitlabToken);
  const content = await Effect.runPromise(
    Effect.flatMap(GitHubService, (s) => s.fetchRepoReadme(info.owner, info.repo)).pipe(
      Effect.provide(layer),
    ),
  );
  return runEngine(content, opts, githubToken, gitlabToken);
}

export async function enhanceGitLab(url: string, opts: EnhanceOpts = {}): Promise<EnhanceResult> {
  const githubToken = opts.githubToken || null;
  const gitlabToken = opts.gitlabToken || null;
  const info = parseGitLabUrl(url);
  if (!info) throw new Error('Invalid GitLab URL');

  const layer = buildBrowserLayer(githubToken, gitlabToken);
  const content = await Effect.runPromise(
    Effect.flatMap(GitLabService, (s) => s.fetchRepoReadme(info.owner, info.repo)).pipe(
      Effect.provide(layer),
    ),
  );
  return runEngine(content, opts, githubToken, gitlabToken);
}

export async function enhanceText(content: string, opts: EnhanceOpts = {}): Promise<EnhanceResult> {
  return runEngine(content, opts, opts.githubToken || null, opts.gitlabToken || null);
}
