import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { enhanceCommand, EnhanceOptions } from '../src/commands/enhance.js';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';

interface EnhanceLocalFileArgs {
  file_path: string;
  add_metadata?: boolean;
  update_descriptions?: boolean;
  output_path?: string;
  dry_run?: boolean;
}

interface EnhanceGithubUrlArgs {
  github_url: string;
  add_metadata?: boolean;
  update_descriptions?: boolean;
  output_path?: string;
  dry_run?: boolean;
}

interface EnhanceJsonArgs {
  file_path: string;
  add_metadata?: boolean;
  update_descriptions?: boolean;
}

const server = new Server(
  {
    name: 'awesome-enhance',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'enhance_local_file',
        description:
          'Enhance a local awesome-list markdown file with GitHub metadata and improved descriptions',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Path to the local markdown file to enhance',
            },
            add_metadata: {
              type: 'boolean',
              description: 'Add GitHub repository metadata (stars, forks, language)',
              default: true,
            },
            update_descriptions: {
              type: 'boolean',
              description: 'Improve descriptions via web scraping',
              default: false,
            },
            output_path: {
              type: 'string',
              description: 'Output file path (optional, defaults to overwriting input)',
            },
            dry_run: {
              type: 'boolean',
              description: 'Preview changes without writing to file',
              default: false,
            },
          },
          required: ['file_path'],
        },
      },
      {
        name: 'enhance_github_url',
        description: 'Enhance an awesome list from a GitHub URL',
        inputSchema: {
          type: 'object',
          properties: {
            github_url: {
              type: 'string',
              description: 'GitHub repository URL (e.g., https://github.com/user/awesome-list)',
            },
            add_metadata: {
              type: 'boolean',
              description: 'Add GitHub repository metadata (stars, forks, language)',
              default: true,
            },
            update_descriptions: {
              type: 'boolean',
              description: 'Improve descriptions via web scraping',
              default: false,
            },
            output_path: {
              type: 'string',
              description: 'Output file path',
              default: 'enhanced-readme.md',
            },
            dry_run: {
              type: 'boolean',
              description: 'Preview changes without writing to file',
              default: false,
            },
          },
          required: ['github_url'],
        },
      },
      {
        name: 'enhance_with_json_output',
        description: 'Enhance an awesome list and return results as JSON for AI agents',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: {
              type: 'string',
              description: 'Path to the local markdown file or GitHub URL',
            },
            add_metadata: {
              type: 'boolean',
              description: 'Add GitHub repository metadata',
              default: true,
            },
            update_descriptions: {
              type: 'boolean',
              description: 'Improve descriptions via web scraping',
              default: false,
            },
          },
          required: ['file_path'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'enhance_local_file') {
      const params = args as unknown as EnhanceLocalFileArgs;
      const tempDir = await mkdtemp(join(tmpdir(), 'awesome-enhance-'));
      const inputFile = params.file_path;
      const outputPath = params.output_path || inputFile;
      const dryRun = params.dry_run ?? false;

      const options: EnhanceOptions = {
        addMetadata: params.add_metadata ?? true,
        updateDescriptions: params.update_descriptions ?? false,
        dryRun,
        skipLint: true,
      };

      const content = await readFile(inputFile, 'utf-8');
      const tempInput = join(tempDir, 'input.md');
      await writeFile(tempInput, content, 'utf-8');

      if (!dryRun && outputPath !== inputFile) {
        options.output = outputPath;
      }

      await enhanceCommand(tempInput, options);

      if (dryRun) {
        const result = await readFile(join(tempDir, 'input.md'), 'utf-8');
        await rm(tempDir, { recursive: true, force: true });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                dry_run: true,
                preview: result,
                message: 'Preview of enhanced content (no file was modified)',
              }),
            },
          ],
        };
      }

      const enhancedContent = await readFile(outputPath, 'utf-8');
      await rm(tempDir, { recursive: true, force: true });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              output_file: outputPath,
              enhanced_content: enhancedContent,
              message: `Enhanced content written to ${outputPath}`,
            }),
          },
        ],
      };
    }

    if (name === 'enhance_github_url') {
      const params = args as unknown as EnhanceGithubUrlArgs;
      const options: EnhanceOptions = {
        addMetadata: params.add_metadata ?? true,
        updateDescriptions: params.update_descriptions ?? false,
        dryRun: params.dry_run ?? false,
        skipLint: true,
        output: params.output_path || 'enhanced-readme.md',
      };

      const outputPath = options.output!;

      await enhanceCommand(params.github_url, options);

      if (options.dryRun) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                dry_run: true,
                message: 'Preview of enhanced content (no file was modified)',
              }),
            },
          ],
        };
      }

      const enhancedContent = await readFile(outputPath, 'utf-8');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              output_file: outputPath,
              enhanced_content: enhancedContent,
              message: `Enhanced content written to ${outputPath}`,
            }),
          },
        ],
      };
    }

    if (name === 'enhance_with_json_output') {
      const params = args as unknown as EnhanceJsonArgs;
      const tempDir = await mkdtemp(join(tmpdir(), 'awesome-enhance-'));
      const inputFile = params.file_path;
      const isUrl = inputFile.startsWith('http');

      const options: EnhanceOptions = {
        addMetadata: params.add_metadata ?? true,
        updateDescriptions: params.update_descriptions ?? false,
        dryRun: true,
        skipLint: true,
      };

      const outputPath = join(tempDir, 'output.md');
      if (!isUrl) {
        options.output = outputPath;
      }

      await enhanceCommand(inputFile, options);

      let content: string;
      if (isUrl) {
        content = await readFile('enhanced-readme.md', 'utf-8');
      } else {
        content = await readFile(outputPath, 'utf-8');
      }

      await rm(tempDir, { recursive: true, force: true });
      if (!isUrl) {
        try {
          await rm('enhanced-readme.md', { force: true });
        } catch {
          // ignore
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              input: inputFile,
              enhanced_content: content,
              options_used: {
                add_metadata: options.addMetadata,
                update_descriptions: options.updateDescriptions,
              },
            }),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: message,
          }),
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
