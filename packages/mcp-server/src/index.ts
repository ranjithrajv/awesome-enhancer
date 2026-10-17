import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  HttpEnhanceLocalSchema,
  HttpEnhanceGithubSchema,
  HttpEnhanceGitLabSchema,
} from '@awesome-enhancer/core';
import { runEnhanceLocal, runEnhanceGithub, runEnhanceGitLab } from '@awesome-enhancer/core';

const server = new Server(
  { name: 'awesome-enhancer', version: '0.4.0' },
  { capabilities: { tools: {} } },
);

const tools = [
  {
    name: 'enhance_local_file',
    description:
      'Enhance a local awesome-list markdown file with repository metadata (stars, forks, languages) and detect stale/archived repositories. Useful for maintaining curated resource lists.',
    inputSchema: zodToJsonSchema(HttpEnhanceLocalSchema as any),
  },
  {
    name: 'enhance_github_url',
    description:
      'Fetch and enhance an awesome list directly from a GitHub repository URL. Adds metadata badges and detects archived/deleted repositories. Perfect for AI agents working with GitHub-based documentation.',
    inputSchema: zodToJsonSchema(HttpEnhanceGithubSchema as any),
  },
  {
    name: 'enhance_gitlab_url',
    description:
      'Fetch and enhance an awesome list from a GitLab repository (including self-hosted instances). Useful for enterprise environments using GitLab.',
    inputSchema: zodToJsonSchema(HttpEnhanceGitLabSchema as any),
  },
  {
    name: 'detect_stale_repos',
    description:
      'Quickly scan an awesome list markdown file and identify all archived, disabled, or deleted repository links without making changes. Useful for cleanup tasks.',
    inputSchema: zodToJsonSchema({
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Path to local markdown file' },
      },
      required: ['file_path'],
    } as any),
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  function toMcpResult(data: object) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  }

  try {
    if (name === 'enhance_local_file') {
      const parsed = HttpEnhanceLocalSchema.parse(args);
      return toMcpResult(await runEnhanceLocal(parsed));
    }

    if (name === 'enhance_github_url') {
      const parsed = HttpEnhanceGithubSchema.parse(args);
      return toMcpResult(await runEnhanceGithub(parsed));
    }

    if (name === 'enhance_gitlab_url') {
      const parsed = HttpEnhanceGitLabSchema.parse(args);
      return toMcpResult(await runEnhanceGitLab(parsed));
    }

    if (name === 'detect_stale_repos') {
      const { file_path } = args as { file_path: string };
      const parsed = HttpEnhanceLocalSchema.parse({
        file_path,
        add_metadata: false,
        update_descriptions: false,
        detect_stale: true,
        detect_redirects: false,
        dry_run: true,
      });
      const result = await runEnhanceLocal(parsed);
      return toMcpResult({
        stale_entries: result.stale_entries,
        redirect_entries: result.redirect_entries,
        total_issues: (result.stale_entries?.length ?? 0) + (result.redirect_entries?.length ?? 0),
      });
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { ...toMcpResult({ success: false, error: message }), isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('awesome-enhancer MCP server running...');
