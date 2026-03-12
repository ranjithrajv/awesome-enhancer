import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { HttpEnhanceLocalSchema, HttpEnhanceGithubSchema } from '../src/core/schemas.js';
import { runEnhanceLocal, runEnhanceGithub } from '../src/core/runner.js';

const server = new Server(
  { name: 'awesome-enhance', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'enhance_local_file',
      description: 'Enhance a local awesome-list markdown file with GitHub metadata and improved descriptions',
      inputSchema: zodToJsonSchema(HttpEnhanceLocalSchema as any),
    },
    {
      name: 'enhance_github_url',
      description: 'Enhance an awesome list from a GitHub URL',
      inputSchema: zodToJsonSchema(HttpEnhanceGithubSchema as any),
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  function toMcpResult(data: object) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
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

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { ...toMcpResult({ success: false, error: message }), isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
