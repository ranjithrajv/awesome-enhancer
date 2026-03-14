#!/usr/bin/env node

import http from 'http';
import { ZodError } from 'zod';
import {
  HttpEnhanceLocalSchema,
  HttpEnhanceGithubSchema,
  HttpEnhanceGitLabSchema,
} from '../src/core/schemas.js';
import { runEnhanceLocal, runEnhanceGithub, runEnhanceGitLab } from '../src/core/runner.js';

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

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
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
      sendJson(res, 200, { status: 'ok', name: 'awesome-enhancer' });
      return;
    }

    if (method === 'GET' && path === '/') {
      sendJson(res, 200, {
        name: 'awesome-enhancer',
        endpoints: {
          'POST /enhance': 'Enhance a local file or URL',
          'POST /enhance/local': 'Enhance local file',
          'POST /enhance/github': 'Enhance GitHub URL',
          'POST /enhance/gitlab': 'Enhance GitLab URL',
          'GET /health': 'Health check',
        },
      });
      return;
    }

    if (method === 'POST' && path === '/enhance/local') {
      const body = await readJsonBody(req);
      const args = HttpEnhanceLocalSchema.parse(body);
      sendJson(res, 200, await runEnhanceLocal(args));
      return;
    }

    if (method === 'POST' && path === '/enhance/github') {
      const body = await readJsonBody(req);
      const args = HttpEnhanceGithubSchema.parse(body);
      sendJson(res, 200, await runEnhanceGithub(args));
      return;
    }

    if (method === 'POST' && path === '/enhance/gitlab') {
      const body = await readJsonBody(req);
      const args = HttpEnhanceGitLabSchema.parse(body);
      sendJson(res, 200, await runEnhanceGitLab(args));
      return;
    }

    if (method === 'POST' && path === '/enhance') {
      const body = (await readJsonBody(req)) as any;
      const isUrl = typeof body?.source === 'string' && body.source.startsWith('http');
      if (isUrl) {
        const args = HttpEnhanceGithubSchema.parse({ ...body, github_url: body.source });
        sendJson(res, 200, await runEnhanceGithub(args));
      } else {
        const args = HttpEnhanceLocalSchema.parse({ ...body, file_path: body.source });
        sendJson(res, 200, await runEnhanceLocal(args));
      }
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      sendJson(res, 400, { success: false, error: 'Invalid request', details: error.issues });
    } else {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, { error: message });
    }
  }
});

const port = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
server.listen(port, () => {
  console.log(`🚀 awesome-enhancer server running at http://localhost:${port}`);
  console.log(`   POST /enhance/local   - Enhance local file`);
  console.log(`   POST /enhance/github  - Enhance GitHub URL`);
  console.log(`   POST /enhance/gitlab  - Enhance GitLab URL`);
  console.log(`   GET  /health          - Health check`);
});
