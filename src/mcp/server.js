import '../load-env.cjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { TodoStoreRuntime } from '../storeRuntime.js';
import { createMcpLogger, createRequestId, summarizeRpcBody } from './logger.js';
import { registerTodoTools } from './tools.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const packageJson = JSON.parse(await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const host = process.env.TODO_MCP_HOST || '127.0.0.1';
const port = Number(process.env.TODO_MCP_PORT || 38888);
const endpoint = '/mcp';
const maxBodyBytes = 2 * 1024 * 1024;

function json(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(body);
}

function rpcError(res, status, code, message, id = null) {
  json(res, status, {
    jsonrpc: '2.0',
    error: { code, message },
    id
  });
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      const error = new Error('request_body_too_large');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('invalid_json');
    error.status = 400;
    throw error;
  }
}

function configuredOrigins() {
  return new Set(
    String(process.env.TODO_MCP_ALLOWED_ORIGINS || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  );
}

function isAuthorized(req) {
  const token = process.env.TODO_MCP_TOKEN;
  if (!token) return false;
  const expected = `Bearer ${token}`;
  return req.headers.authorization === expected;
}

function isAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  return configuredOrigins().has(origin);
}

function createServer(runtime, logger) {
  const server = new McpServer({
    name: 'personal-todo',
    version: packageJson.version || '0.0.0'
  });
  registerTodoTools(server, runtime, { logger });
  return server;
}

export async function createMcpHttpServer({
  runtime = new TodoStoreRuntime(),
  logger = createMcpLogger()
} = {}) {
  await runtime.init();

  return http.createServer(async (req, res) => {
    const requestId = createRequestId();
    const startedAt = Date.now();
    let url = null;
    res.on('finish', () => {
      logger.info('http.finish', {
        requestId,
        method: req.method,
        path: url?.pathname || req.url,
        status: res.statusCode,
        durationMs: Date.now() - startedAt
      });
    });

    try {
      url = new URL(req.url || '/', `http://${req.headers.host || `${host}:${port}`}`);
      logger.info('http.start', {
        requestId,
        method: req.method,
        path: url.pathname,
        remoteAddress: req.socket?.remoteAddress
      });

      if (req.method === 'GET' && url.pathname === '/health') {
        await runtime.reload();
        json(res, 200, {
          ok: true,
          appVersion: packageJson.version || '0.0.0',
          dataVersion: runtime.store.data.version,
          dataDir: runtime.store.dataDir
        });
        return;
      }

      if (url.pathname !== endpoint) {
        rpcError(res, 404, -32000, 'not_found');
        return;
      }

      if (!isAllowedOrigin(req)) {
        rpcError(res, 403, -32000, 'origin_not_allowed');
        return;
      }

      if (!isAuthorized(req)) {
        rpcError(res, 401, -32001, process.env.TODO_MCP_TOKEN ? 'unauthorized' : 'todo_mcp_token_not_configured');
        return;
      }

      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        rpcError(res, 405, -32000, 'method_not_allowed');
        return;
      }

      const body = await readJson(req);
      logger.info('rpc.request', {
        requestId,
        ...summarizeRpcBody(body)
      });
      const mcp = createServer(runtime, logger);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
      });
      await mcp.connect(transport);
      res.on('close', () => {
        transport.close().catch(() => {});
        mcp.close().catch(() => {});
      });
      await transport.handleRequest(req, res, body);
    } catch (error) {
      if (res.headersSent) return;
      const status = error.status || 500;
      if (status >= 500) console.error(error);
      logger.error('http.error', {
        requestId,
        method: req.method,
        path: url?.pathname || req.url,
        status,
        error: error.message || 'server_error'
      });
      rpcError(res, status, -32603, error.message || 'server_error');
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const logger = createMcpLogger();
  const server = await createMcpHttpServer({ logger });
  server.on('error', error => {
    if (error.code === 'EADDRINUSE') {
      console.error(`MCP port ${port} is already in use. Start with another port, for example: TODO_MCP_PORT=38889 npm run mcp:dev`);
    } else {
      console.error(error);
    }
    process.exit(1);
  });
  server.listen(port, host, () => {
    console.log(`Personal TODO MCP is running at http://${host}:${port}${endpoint}`);
    console.log(`Health check: http://${host}:${port}/health`);
    console.log(`Data directory: ${process.env.TODO_DATA_DIR || path.join(projectRoot, 'data')}`);
    if (logger.enabled) {
      console.log('MCP dev logs: enabled');
    }
    if (!process.env.TODO_MCP_TOKEN) {
      console.log('TODO_MCP_TOKEN is required before MCP clients can call tools.');
    }
  });
}
