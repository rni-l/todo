import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { TodoStoreRuntime } from '../src/storeRuntime.js';
import { createMcpHttpServer } from '../src/mcp/server.js';

async function tempRuntime() {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-mcp-'));
  const runtime = new TodoStoreRuntime({ dataDir });
  await runtime.init();
  return runtime;
}

function parseToolPayload(result) {
  const item = result.content.find(entry => entry.type === 'text');
  return JSON.parse(item.text);
}

test('store runtime serializes concurrent writes and preserves both changes', async () => {
  const runtimeA = await tempRuntime();
  const runtimeB = new TodoStoreRuntime({ dataDir: runtimeA.store.dataDir });
  await runtimeB.init();

  await Promise.all([
    runtimeA.write(store => store.createTask({ title: 'write from A' })),
    runtimeB.write(store => store.createTask({ title: 'write from B' }))
  ]);

  await runtimeA.reload();
  const titles = runtimeA.store.data.tasks.map(task => task.title);
  assert.ok(titles.includes('write from A'));
  assert.ok(titles.includes('write from B'));
});

test('MCP HTTP service exposes authorized task tools', async () => {
  const previousToken = process.env.TODO_MCP_TOKEN;
  process.env.TODO_MCP_TOKEN = 'test-token';
  const runtime = await tempRuntime();
  const httpServer = await createMcpHttpServer({ runtime });
  await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address();
  const url = new URL(`http://127.0.0.1:${address.port}/mcp`);

  const client = new Client({ name: 'todo-mcp-test', version: '1.0.0' }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: {
      headers: {
        Authorization: 'Bearer test-token'
      }
    }
  });

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert.ok(tools.tools.some(tool => tool.name === 'todo_create_task'));
    assert.ok(tools.tools.some(tool => tool.name === 'todo_list_tasks'));

    const created = parseToolPayload(await client.callTool({
      name: 'todo_create_task',
      arguments: {
        title: 'MCP created task',
        priority: 'high',
        dueDate: '2026-07-09'
      }
    }));
    assert.equal(created.ok, true);
    assert.equal(created.task.title, 'MCP created task');

    const listed = parseToolPayload(await client.callTool({
      name: 'todo_list_tasks',
      arguments: {
        status: 'open',
        query: 'MCP created',
        limit: 10
      }
    }));
    assert.equal(listed.tasks.length, 1);
    assert.equal(listed.tasks[0].id, created.task.id);

    const completed = parseToolPayload(await client.callTool({
      name: 'todo_complete_task',
      arguments: {
        id: created.task.id,
        value: true
      }
    }));
    assert.equal(completed.task.completed, true);

    await runtime.reload();
    assert.equal(runtime.store.data.tasks.find(task => task.id === created.task.id).completed, true);
  } finally {
    await client.close();
    await new Promise(resolve => httpServer.close(resolve));
    if (previousToken === undefined) {
      delete process.env.TODO_MCP_TOKEN;
    } else {
      process.env.TODO_MCP_TOKEN = previousToken;
    }
  }
});

test('MCP HTTP service rejects missing bearer token and disallowed origins', async () => {
  const previousToken = process.env.TODO_MCP_TOKEN;
  const previousOrigins = process.env.TODO_MCP_ALLOWED_ORIGINS;
  process.env.TODO_MCP_TOKEN = 'test-token';
  process.env.TODO_MCP_ALLOWED_ORIGINS = 'https://allowed.example';
  const runtime = await tempRuntime();
  const httpServer = await createMcpHttpServer({ runtime });
  await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address();
  const url = `http://127.0.0.1:${address.port}/mcp`;

  try {
    const noAuth = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
    });
    assert.equal(noAuth.status, 401);

    const badOrigin = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
        Origin: 'https://blocked.example'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
    });
    assert.equal(badOrigin.status, 403);
  } finally {
    await new Promise(resolve => httpServer.close(resolve));
    if (previousToken === undefined) {
      delete process.env.TODO_MCP_TOKEN;
    } else {
      process.env.TODO_MCP_TOKEN = previousToken;
    }
    if (previousOrigins === undefined) {
      delete process.env.TODO_MCP_ALLOWED_ORIGINS;
    } else {
      process.env.TODO_MCP_ALLOWED_ORIGINS = previousOrigins;
    }
  }
});
