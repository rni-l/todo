# Personal TODO Self-Hosted App

A single-user, self-hosted TODO web app for personal task management. It combines a local Node.js HTTP server with a React + TypeScript frontend, stores all runtime data on disk as JSON, and includes a PM2 release workflow for running a stable packaged snapshot while development continues in the working tree.

The product is designed as a private personal workspace, not a team SaaS app. It supports task planning, project organization, calendar-style review, reports, markdown notes, checklist subtasks, attachments, import/export, and PWA installation.

## Features

- Single-user password login with an HttpOnly session cookie
- Workspace views: Today, Inbox, Upcoming, Recent 7 Days, Calendar, Matrix, Reports, Projects, Tags, Smart Filters, Completed, Closed, and Settings
- Task create/edit/complete/close/delete flows with priority, urgent flag, tags, projects, sections, due date ranges, reminder ranges, recurrence, markdown notes, checklist subtasks, and attachments
- Project, tag, and smart filter management
- Browser notification permission and test notification flow
- JSON data export/import with preview
- Attachment upload/download/delete plus ZIP export/import
- PWA manifest and service worker with versioned cache busting
- Release snapshots under `.deploy/releases/` for PM2 deployment

## Tech Stack

- Runtime: Node.js 20+
- Server: native Node.js HTTP server
- Frontend: React, TypeScript, Vite
- Storage: local JSON files and local upload files
- Process manager: PM2, optional for deployment

## Repository Layout

```text
server.js                 HTTP server, API routes, auth cookie handling, static file serving
src/auth.js               password hashing, password validation, session token helpers
src/storage.js            JSON store, seed data, normalization, attachment paths
src/client/               React + TypeScript frontend source
public/                   production shell, manifest, service worker, built frontend assets
assets/                   legacy/prototype static assets
design/                   static design prototypes
docs/plans/               implementation notes and product planning docs
scripts/package-release.mjs
tests/                    Node test runner suites
ecosystem.config.cjs      PM2 deployment config
```

## Quick Start

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm run dev
```

Open:

```text
http://localhost:38887
```

The first generated data file uses local bootstrap credentials:

```text
Username: self-hosted-user
Password: todo123456
```

For any shared or internet-accessible deployment, set a real password before the first run:

```bash
TODO_PASSWORD="replace-with-a-strong-password" npm start
```

You can also change the password later from Settings -> Account and Security.

## Frontend Development

The backend serves the built frontend from `public/dist`. For normal local usage, `npm run dev` is enough.

When working on the React frontend with Vite, run the backend and Vite in separate terminals:

```bash
npm run dev
```

```bash
npm run dev:client
```

The Vite dev server proxies `/api` and `/prototype` to the Node server on port `38887`.

Build the frontend assets:

```bash
npm run build:client
```

## Configuration

Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `38887` | HTTP server port |
| `TODO_USERNAME` | `self-hosted-user` | Username written into the first generated data file |
| `TODO_PASSWORD` | `todo123456` | Password written into the first generated data file |
| `TODO_SESSION_SECRET` | derived from the password hash | Optional extra session signing secret |
| `TODO_DATA_DIR` | `./data` | Runtime JSON data and upload directory |
| `TODO_LOG_DIR` | `.deploy/shared/logs` | PM2 log directory |
| `TODO_COOKIE_SECURE` | unset | Set to `1` when serving over HTTPS |
| `TODO_MCP_TOKEN` | unset | Bearer token required by the optional MCP HTTP service |
| `TODO_MCP_HOST` | `127.0.0.1` | MCP HTTP bind host |
| `TODO_MCP_PORT` | `38888` | MCP HTTP port |
| `TODO_MCP_ALLOWED_ORIGINS` | unset | Comma-separated browser Origin allowlist for MCP requests |
| `TODO_MCP_LOG` | auto | Set `1` to force MCP request/tool logs, `0` to disable |

Important behavior:

- `TODO_USERNAME` and `TODO_PASSWORD` are only used when a data file is created for the first time.
- Existing credentials live in the runtime data file as a salted password hash.
- If you need an isolated development dataset, set `TODO_DATA_DIR` to another directory.

Example:

```bash
TODO_DATA_DIR=./data-dev npm run dev
```

## MCP HTTP Service

The app can run a separate MCP Streamable HTTP service for other AI agents. It uses the same `TODO_DATA_DIR` as the web app and exposes a narrow task-focused tool surface:

- `todo_list_tasks`
- `todo_get_task`
- `todo_create_task`
- `todo_update_task`
- `todo_complete_task`
- `todo_close_task`

Start it locally:

```bash
printf 'TODO_MCP_TOKEN=%s\n' 'replace-with-a-long-random-token' >> .env
```

```bash
npm run mcp:dev
```

Endpoint:

```text
POST http://127.0.0.1:38888/mcp
Authorization: Bearer <TODO_MCP_TOKEN>
```

Health check:

```text
GET http://127.0.0.1:38888/health
```

The default host is `127.0.0.1` so the MCP service is local-only. If you expose it to another machine, bind `TODO_MCP_HOST` deliberately, put it behind HTTPS, set a strong `TODO_MCP_TOKEN`, and configure `TODO_MCP_ALLOWED_ORIGINS` for browser-based clients. The MCP service does not expose account settings, password changes, import/export, attachment downloads, project/tag management, or hard-delete tools.

`npm run mcp:dev` enables MCP request and tool-call logs by default. Set `TODO_MCP_LOG=0` in `.env` to silence them, or `TODO_MCP_LOG=1` to force the same logs in another startup mode.

Full agent integration guide: [docs/mcp-http-service.md](docs/mcp-http-service.md).

## Runtime Data

By default, the app stores runtime data under `data/`:

```text
data/todo-data.json       tasks, projects, tags, filters, settings, auth hash, attachment metadata
data/uploads/             uploaded files
data/tmp/                 temporary import/export backups
```

These files are private user data and should not be committed. The repository `.gitignore` already excludes the default runtime data paths.

## Release Snapshot

Create a packaged runtime snapshot:

```bash
npm run release:build
```

This command builds the frontend and creates:

```text
.deploy/releases/<release-name>/   immutable runtime snapshot
.deploy/current                    symlink pointing at the active snapshot
.deploy/shared/logs/               PM2 stdout/stderr logs
```

The release snapshot contains code and static assets. It continues to use the shared data directory, which defaults to `./data` unless `TODO_DATA_DIR` is set.

## PM2 Deployment

First deployment:

```bash
npm run release:build
npm run pm2:start
npm run pm2:logs
```

Start the MCP service under PM2:

```bash
npm run pm2:mcp:start
npm run pm2:mcp:logs
```

Update an existing deployment:

```bash
npm run release:build
npm run pm2:restart
```

Restart an existing MCP deployment after changing MCP environment variables:

```bash
npm run pm2:mcp:restart
```

Stop the process:

```bash
npm run pm2:stop
```

The included PM2 app name is `personal-todo`.

## Tests

Run the test suite:

```bash
npm test
```

Useful local checks:

```bash
pgrep -af personal-todo
lsof -i :38887
```

## Publishing And Privacy Checklist

Before pushing this repository to GitHub:

- Do not commit `data/`; it may contain personal tasks, imported task history, settings, password hashes, and attachment metadata.
- Do not commit `data/uploads/`; it may contain private uploaded files.
- Do not commit `.deploy/`; it contains release snapshots, shared runtime data, and PM2 logs.
- Do not commit `output/` or `.playwright-cli/`; they contain local screenshots, browser snapshots, console logs, and smoke-test scripts.
- Do not commit `node_modules/`.
- Review `.od-skills/` if you want a cleaner public repository; it contains local prototype/agent helper templates rather than app runtime code.
- Replace the bootstrap password for any real deployment with `TODO_PASSWORD` before the first start, or change it immediately in Settings.

The default username and password in source are development bootstrap values, not production credentials.
