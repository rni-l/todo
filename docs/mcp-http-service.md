# Personal TODO MCP HTTP Service

This document is the integration guide for AI agents that need to read or update the current TODO workspace through MCP.

## Overview

The MCP service is a separate Streamable HTTP server. It shares the same runtime data directory as the web app through `TODO_DATA_DIR`, and exposes only task-focused tools.

Default endpoint:

```text
POST http://127.0.0.1:38888/mcp
```

Health check:

```text
GET http://127.0.0.1:38888/health
```

Authentication:

```text
Authorization: Bearer <TODO_MCP_TOKEN>
```

The service does not expose account settings, password changes, import/export, attachment downloads, project/tag management, or hard-delete operations.

## Start The Service

Local development:

Create `.env` once:

```bash
printf 'TODO_MCP_TOKEN=%s\n' 'replace-with-a-long-random-token' >> .env
```

Start the service:

```bash
npm run mcp:dev
```

Production under PM2:

```bash
npm run pm2:mcp:start
npm run pm2:mcp:logs
```

Restart after changing environment variables:

```bash
npm run pm2:mcp:restart
```

## Configuration

| Variable | Default | Required | Purpose |
| --- | --- | --- | --- |
| `TODO_MCP_TOKEN` | unset | yes | Bearer token required for all `/mcp` requests |
| `TODO_MCP_HOST` | `127.0.0.1` | no | Bind host for the MCP HTTP service |
| `TODO_MCP_PORT` | `38888` | no | Bind port for the MCP HTTP service |
| `TODO_MCP_ALLOWED_ORIGINS` | unset | no | Comma-separated browser Origin allowlist |
| `TODO_MCP_LOG` | auto | no | Set `1` to force MCP request/tool logs, `0` to disable |
| `TODO_DATA_DIR` | `./data` | no | Runtime TODO data directory shared with the web app |

The Node entrypoints load `.env` automatically. Shell environment variables still win over `.env` values, so production overrides can be supplied by PM2, systemd, Docker, or the shell.

Keep `TODO_DATA_DIR` aligned with the web app. If the web app is using the default local data directory, the MCP service should also use the default unless you intentionally want an isolated dataset.

## Dev Logging

`npm run mcp:dev` enables MCP logs automatically. The service logs HTTP lifecycle events and tool-call lifecycle events:

```text
[mcp] 2026-07-09T14:00:00.000Z info http.start requestId="req_1" method="POST" path="/mcp" remoteAddress="127.0.0.1"
[mcp] 2026-07-09T14:00:00.001Z info rpc.request requestId="req_1" rpcMethod="tools/call" toolName="todo_list_tasks"
[mcp] 2026-07-09T14:00:00.002Z info tool.start tool="todo_list_tasks"
[mcp] 2026-07-09T14:00:00.006Z info tool.ok tool="todo_list_tasks" durationMs=4
[mcp] 2026-07-09T14:00:00.007Z info http.finish requestId="req_1" method="POST" path="/mcp" status=200 durationMs=7
```

The logger intentionally does not print bearer tokens, request headers, task titles, task descriptions, or full tool arguments.

Controls:

```bash
# Silence logs even when using npm run mcp:dev
TODO_MCP_LOG=0 npm run mcp:dev

# Force the same logs outside dev mode
TODO_MCP_LOG=1 npm run mcp:start
```

## Agent Client Configuration

Use Streamable HTTP transport and pass the bearer token as an HTTP header.

Generic shape:

```json
{
  "url": "http://127.0.0.1:38888/mcp",
  "headers": {
    "Authorization": "Bearer <TODO_MCP_TOKEN>"
  }
}
```

For remote agents, expose the service through HTTPS, bind `TODO_MCP_HOST` deliberately, and configure the client URL to the HTTPS reverse-proxy URL. Do not expose the raw HTTP endpoint directly on the public internet.

## JavaScript Client Example

```js
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const client = new Client(
  { name: 'todo-agent', version: '1.0.0' },
  { capabilities: {} }
);

const transport = new StreamableHTTPClientTransport(
  new URL('http://127.0.0.1:38888/mcp'),
  {
    requestInit: {
      headers: {
        Authorization: `Bearer ${process.env.TODO_MCP_TOKEN}`
      }
    }
  }
);

await client.connect(transport);

const result = await client.callTool({
  name: 'todo_list_tasks',
  arguments: {
    status: 'open',
    limit: 20
  }
});

console.log(result.content[0].text);
await client.close();
```

## Tools

All tool results are returned as JSON text content. The common result envelope is:

```json
{
  "ok": true,
  "task": {},
  "tasks": [],
  "dataVersion": 1,
  "updatedAt": "2026-07-09T00:00:00.000Z"
}
```

### `todo_list_tasks`

List tasks with optional filters.

Arguments:

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `status` | `open | completed | closed | all` | `open` | `open` excludes completed and closed tasks |
| `query` | string | unset | Searches title, description, priority, project id, section id, tag ids, and subtask titles |
| `projectId` | string | unset | Exact project id |
| `tagIds` | string array | unset | Task must include all provided tag ids |
| `due` | `today | overdue | upcoming | none | any` | `any` | Date filter based on `dueDate` |
| `limit` | integer | `50` | Min `1`, max `200` |

Example:

```json
{
  "status": "open",
  "query": "MCP",
  "due": "today",
  "limit": 20
}
```

### `todo_get_task`

Get one task by id.

Arguments:

```json
{
  "id": "task_xxx"
}
```

### `todo_create_task`

Create a task. `title` is required.

Arguments:

| Field | Type | Default |
| --- | --- | --- |
| `title` | string | required |
| `projectId` | string or null | unset |
| `sectionId` | string or null | unset |
| `startDate` | `YYYY-MM-DD` or null | unset |
| `dueDate` | `YYYY-MM-DD` or null | unset |
| `reminderAt` | string or null | unset |
| `reminderEndAt` | string or null | unset |
| `priority` | `none | low | medium | high` | `none` |
| `urgent` | boolean | `false` |
| `tags` | string array | `[]` |
| `description` | string | `""` |
| `subtasks` | subtask array | `[]` |
| `recurrence` | object or null | unset |

Example:

```json
{
  "title": "整理 MCP 接入说明",
  "priority": "high",
  "dueDate": "2026-07-09",
  "tags": ["tag_docs"],
  "description": "给其他 AI agent 使用。"
}
```

### `todo_update_task`

Patch editable task fields.

Arguments:

```json
{
  "id": "task_xxx",
  "patch": {
    "title": "新的标题",
    "priority": "medium",
    "dueDate": null,
    "tags": []
  }
}
```

Patch supports the same editable fields as `todo_create_task`, plus `completed`, `closed`, `order`, and `subtasks`.

### `todo_complete_task`

Mark a task completed or reopen it.

Arguments:

```json
{
  "id": "task_xxx",
  "value": true
}
```

When `value` is `true`, the task is completed and unclosed. Existing recurrence behavior from the TODO app is preserved.

### `todo_close_task`

Close or reopen a task without deleting it.

Arguments:

```json
{
  "id": "task_xxx",
  "value": true
}
```

When `value` is `true`, the task is closed and marked incomplete.

## Task Object

Task results follow the public TODO data model:

```json
{
  "id": "task_xxx",
  "title": "Task title",
  "completed": false,
  "completedAt": null,
  "closed": false,
  "closedAt": null,
  "projectId": null,
  "sectionId": null,
  "startDate": null,
  "dueDate": "2026-07-09",
  "reminderAt": null,
  "reminderEndAt": null,
  "priority": "none",
  "urgent": false,
  "tags": [],
  "recurrence": null,
  "description": "",
  "subtasks": [],
  "attachments": [],
  "order": 0,
  "createdAt": "2026-07-09T00:00:00.000Z",
  "updatedAt": "2026-07-09T00:00:00.000Z"
}
```

## Error Behavior

HTTP-level errors:

| Status | Meaning |
| --- | --- |
| `401` | Missing or invalid bearer token, or `TODO_MCP_TOKEN` is not configured |
| `403` | Request `Origin` is not allowed |
| `404` | Unknown endpoint |
| `405` | Only `POST /mcp` is supported for MCP calls |
| `413` | Request body is too large |
| `503` | TODO data store is temporarily locked |

Tool-level errors use MCP errors. Common messages include:

| Message | Meaning |
| --- | --- |
| `task_not_found` | The provided task id does not exist |
| `todo_store_locked` | Another process is writing TODO data and the lock timed out |

## Operational Notes

- The MCP service and web app can run at the same time. Writes are protected with a local file lock under the active `TODO_DATA_DIR`.
- The lock is process-safe for local filesystem usage. Do not put `TODO_DATA_DIR` on a network filesystem unless you know its directory-create and rename semantics are atomic.
- Keep token values out of git, shell history, and shared screenshots.
- For browser-based MCP clients, set `TODO_MCP_ALLOWED_ORIGINS` to the exact allowed origins.
- For server-to-server agents with no `Origin` header, origin checks do not block the request; bearer auth is still required.

## Smoke Checks

Check service health:

```bash
curl -s http://127.0.0.1:38888/health
```

Expected shape:

```json
{
  "ok": true,
  "appVersion": "1.7.7",
  "dataVersion": 1,
  "dataDir": "/path/to/data"
}
```

Run automated coverage:

```bash
npm test
```

The test suite includes MCP HTTP integration coverage for authentication, tool listing, task creation, task listing, and task completion.
