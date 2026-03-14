import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/core',
  'packages/cli',
  'packages/mcp-server',
  'packages/http-server',
]);
