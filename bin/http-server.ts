#!/usr/bin/env node

import http from 'http';
import { enhanceCommand, EnhanceOptions } from '../src/commands/enhance.js';
import { readFile } from 'fs/promises';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const DEFAULT_PORT = 9867;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function sendJson(res: http.ServerResponse, statusCode: number, data: object) {
  res.writeHead(statusCode, { ...corsHeaders, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function enhanceLocalFile(args: {
  file_path: string;
  add_metadata?: boolean;
  update_descriptions?: boolean;
  output_path?: string;
  dry_run?: boolean;
}) {
  const tempDir = await mkdtemp(join(tmpdir(), 'awesome-enhance-'));
  const inputFile = args.file_path;
  const outputPath = args.output_path || inputFile;
  const dryRun = args.dry_run ?? false;

  const options: EnhanceOptions = {
    addMetadata: args.add_metadata ?? true,
    updateDescriptions: args.update_descriptions ?? false,
    dryRun,
    skipLint: true,
  };

  if (!dryRun && outputPath !== inputFile) {
    options.output = outputPath;
  }

  await enhanceCommand(inputFile, options);

  if (dryRun) {
    const content = await readFile(inputFile, 'utf-8');
    return { success: true, dry_run: true, preview: content };
  }

  const content = await readFile(outputPath, 'utf-8');
  await rm(tempDir, { recursive: true, force: true });

  return {
    success: true,
    output_file: outputPath,
    enhanced_content: content,
  };
}

async function enhanceGithubUrl(args: {
  github_url: string;
  add_metadata?: boolean;
  update_descriptions?: boolean;
  output_path?: string;
  dry_run?: boolean;
}) {
  const options: EnhanceOptions = {
    addMetadata: args.add_metadata ?? true,
    updateDescriptions: args.update_descriptions ?? false,
    dryRun: args.dry_run ?? false,
    skipLint: true,
    output: args.output_path || 'enhanced-readme.md',
  };

  const outputPath = options.output || 'enhanced-readme.md';

  await enhanceCommand(args.github_url, options);

  if (options.dryRun) {
    return { success: true, dry_run: true, message: 'Preview mode' };
  }

  const content = await readFile(outputPath, 'utf-8');

  return {
    success: true,
    output_file: outputPath,
    enhanced_content: content,
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${DEFAULT_PORT}`);
  const path = url.pathname;
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  try {
    if (method === 'GET' && path === '/health') {
      sendJson(res, 200, { status: 'ok', name: 'awesome-enhance', version: '0.1.0' });
      return;
    }

    if (method === 'GET' && path === '/') {
      sendJson(res, 200, {
        name: 'awesome-enhance',
        version: '0.1.0',
        endpoints: {
          'POST /enhance': 'Enhance a local file or URL',
          'POST /enhance/local': 'Enhance local file',
          'POST /enhance/github': 'Enhance GitHub URL',
          'GET /health': 'Health check',
        },
      });
      return;
    }

    if (method === 'POST' && path === '/enhance/local') {
      let body = '';
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        try {
          const args = JSON.parse(body);
          const result = await enhanceLocalFile(args);
          sendJson(res, 200, result);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          sendJson(res, 400, { success: false, error: message });
        }
      });
      return;
    }

    if (method === 'POST' && path === '/enhance/github') {
      let body = '';
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        try {
          const args = JSON.parse(body);
          const result = await enhanceGithubUrl(args);
          sendJson(res, 200, result);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          sendJson(res, 400, { success: false, error: message });
        }
      });
      return;
    }

    if (method === 'POST' && path === '/enhance') {
      let body = '';
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        try {
          const args = JSON.parse(body);
          const isUrl = args.source?.startsWith('http');

          if (isUrl) {
            const result = await enhanceGithubUrl({
              github_url: args.source,
              add_metadata: args.add_metadata,
              update_descriptions: args.update_descriptions,
              output_path: args.output_path,
              dry_run: args.dry_run,
            });
            sendJson(res, 200, result);
          } else {
            const result = await enhanceLocalFile({
              file_path: args.source,
              add_metadata: args.add_metadata,
              update_descriptions: args.update_descriptions,
              output_path: args.output_path,
              dry_run: args.dry_run,
            });
            sendJson(res, 200, result);
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          sendJson(res, 400, { success: false, error: message });
        }
      });
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: message });
  }
});

const port = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
server.listen(port, () => {
  console.log(`🚀 awesome-enhance server running at http://localhost:${port}`);
  console.log(`   POST /enhance          - Enhance local file or URL`);
  console.log(`   POST /enhance/local   - Enhance local file`);
  console.log(`   POST /enhance/github  - Enhance GitHub URL`);
  console.log(`   GET  /health          - Health check`);
});
