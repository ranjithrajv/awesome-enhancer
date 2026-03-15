/**
 * Smoke test: evaluates dist/bundle.js in a minimal browser-like environment
 * and verifies that window.AE exposes the expected functions.
 * Run after every build — catches runtime crashes before deployment.
 */
import { readFileSync } from 'fs';
import { createContext, runInNewContext } from 'vm';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bundlePath = resolve(__dirname, '../dist/bundle.js');

let source;
try {
  source = readFileSync(bundlePath, 'utf-8');
} catch {
  console.error('✗ dist/bundle.js not found — run bun run build first');
  process.exit(1);
}

// Minimal Node.js-like global environment (no `window` — that triggers browser-mode
// code paths in cheerio/htmlparser2 that expect a real DOM we can't provide in vm)
const globals = {
  process: {
    env: { NODE_ENV: 'production' },
    cwd: () => '/',
    platform: 'linux',
    version: '0.0.0',
    argv: [],
    nextTick: (fn) => setTimeout(fn, 0),
    hrtime: Object.assign(() => [0, 0], { bigint: () => BigInt(0) }),
    stdout: { write: () => {} },
    stderr: { write: () => {} },
  },
  setTimeout, clearTimeout, setInterval, clearInterval,
  Promise, Map, Set, WeakMap, WeakSet, Symbol, BigInt,
  TextEncoder, TextDecoder,
  URL, URLSearchParams,
  Buffer,
  console,
  Error, TypeError, RangeError, SyntaxError, URIError, EvalError,
  Object, Array, Number, String, Boolean, RegExp, Date, JSON,
  parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
};
// Minimal document stub: some deps (e.g. `entities`) call document.createElement at module level
// for HTML entity decoding. The real browser provides this; we mock it for the smoke test.
globals.document = {
  createElement(tag) {
    return {
      tagName: tag.toUpperCase(),
      innerHTML: '',
      get textContent() { return this.innerHTML; },
      cookie: '',
    };
  },
  cookie: '',
};
// Omit `window` so cheerio stays in server mode; IIFE will use `global`/`globalThis`
globals.globalThis = globals;
globals.global = globals;

try {
  runInNewContext(source, globals);
} catch (err) {
  console.error(`✗ Bundle threw at runtime: ${err.message}`);
  console.error(err.stack?.split('\n').slice(0, 5).join('\n'));
  process.exit(1);
}

const AE = globals.AE;

if (typeof AE?.enhanceGitHub !== 'function') {
  console.error(`✗ AE.enhanceGitHub is not a function (got: ${typeof AE?.enhanceGitHub})`);
  process.exit(1);
}
if (typeof AE?.enhanceGitLab !== 'function') {
  console.error(`✗ AE.enhanceGitLab is not a function (got: ${typeof AE?.enhanceGitLab})`);
  process.exit(1);
}
if (typeof AE?.enhanceText !== 'function') {
  console.error(`✗ AE.enhanceText is not a function (got: ${typeof AE?.enhanceText})`);
  process.exit(1);
}

console.log('✓ Bundle verified: AE.enhanceGitHub, AE.enhanceGitLab, AE.enhanceText are functions');
