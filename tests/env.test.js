import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import envLoader from '../src/load-env.cjs';

test('loadEnvFile loads .env values without overriding existing process env', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-env-'));
  const envPath = path.join(dataDir, '.env');
  const previousToken = process.env.TODO_MCP_TOKEN;
  const previousHost = process.env.TODO_MCP_HOST;

  try {
    delete process.env.TODO_MCP_TOKEN;
    process.env.TODO_MCP_HOST = 'already-set';
    await fs.writeFile(envPath, [
      'TODO_MCP_TOKEN="from-env-file"',
      'TODO_MCP_HOST=from-env-file',
      '# comment'
    ].join('\n'));

    const result = envLoader.loadEnvFile(envPath);
    assert.equal(result.loaded, true);
    assert.deepEqual(result.keys, ['TODO_MCP_TOKEN']);
    assert.equal(process.env.TODO_MCP_TOKEN, 'from-env-file');
    assert.equal(process.env.TODO_MCP_HOST, 'already-set');
  } finally {
    if (previousToken === undefined) {
      delete process.env.TODO_MCP_TOKEN;
    } else {
      process.env.TODO_MCP_TOKEN = previousToken;
    }
    if (previousHost === undefined) {
      delete process.env.TODO_MCP_HOST;
    } else {
      process.env.TODO_MCP_HOST = previousHost;
    }
  }
});
