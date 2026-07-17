import test from 'node:test';
import assert from 'node:assert/strict';
import { createMcpLogger, isMcpDevLoggingEnabled, summarizeRpcBody } from '../src/mcp/logger.js';

test('MCP dev logging is enabled for mcp:dev lifecycle and can be overridden', () => {
  assert.equal(isMcpDevLoggingEnabled({ npm_lifecycle_event: 'mcp:dev' }), true);
  assert.equal(isMcpDevLoggingEnabled({ npm_lifecycle_event: 'mcp:start' }), false);
  assert.equal(isMcpDevLoggingEnabled({ npm_lifecycle_event: 'mcp:dev', TODO_MCP_LOG: '0' }), false);
  assert.equal(isMcpDevLoggingEnabled({ TODO_MCP_LOG: '1' }), true);
});

test('MCP logger emits concise lines without request payloads', () => {
  const lines = [];
  const logger = createMcpLogger({
    enabled: true,
    output: {
      log: line => lines.push(line),
      error: line => lines.push(line)
    }
  });

  logger.info('tool.start', { tool: 'todo_create_task' });
  logger.error('tool.error', { tool: 'todo_get_task', error: 'task_not_found' });

  assert.equal(lines.length, 2);
  assert.match(lines[0], /\[mcp\].*info tool\.start tool="todo_create_task"/);
  assert.match(lines[1], /\[mcp\].*error tool\.error tool="todo_get_task" error="task_not_found"/);
});

test('summarizeRpcBody keeps only protocol method and tool name', () => {
  assert.deepEqual(summarizeRpcBody({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'todo_create_task',
      arguments: {
        title: 'private task title'
      }
    }
  }), {
    rpcMethod: 'tools/call',
    toolName: 'todo_create_task'
  });
  assert.deepEqual(summarizeRpcBody([{ method: 'initialize' }, { method: 'tools/list' }]), {
    rpcMethod: 'batch',
    batchSize: 2
  });
});
