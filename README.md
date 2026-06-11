# Personal TODO Self-Hosted App

Single-user self-hosted TODO web app built from the prototype files in this repository.

## Run

```bash
npm run dev
```

Open `http://localhost:38887`.

Default login:

- Username: `self-hosted-user`
- Password: `todo123456`

For deployment, set a strong password before first run:

```bash
TODO_PASSWORD="your-strong-password" npm start
```

Useful environment variables:

- `PORT`: server port, defaults to `38887`
- `TODO_USERNAME`: single user name, defaults to `self-hosted-user`
- `TODO_PASSWORD`: initial password for the first generated data file
- `TODO_DATA_DIR`: data directory, defaults to `./data`
- `TODO_COOKIE_SECURE=1`: add `Secure` to session cookies when serving over HTTPS

## Data

The app stores JSON data and uploaded files under `data/` by default:

- `data/todo-data.json`: tasks, projects, tags, filters, settings, attachment metadata
- `data/uploads/`: attachment files

Original static prototype files remain available from the running server at `/prototype/index.html`.

## Release Snapshot

`v1.4+` starts the online service from a packaged release snapshot instead of the active working tree. This lets you keep developing the next version without changing the files PM2 is serving.

Build a release snapshot:

```bash
npm run release:build
```

This creates:

- `.deploy/releases/<release-name>/`: immutable runtime snapshot
- `.deploy/current`: symlink pointing at the active snapshot
- `.deploy/shared/logs/`: PM2 stdout/stderr logs

## PM2

The repository includes `ecosystem.config.cjs` for PM2 deployment. It runs the app as `personal-todo` on port `38887` from `.deploy/current` and continues to use the existing `./data` directory by default.

If you want production to use another data directory, set `TODO_DATA_DIR` before starting PM2. If you want local development to avoid touching production data, run dev with another path, for example:

```bash
TODO_DATA_DIR=./data-dev npm run dev
```

First deployment:

```bash
npm run release:build
npm run pm2:start
npm run pm2:logs
```

Update an existing deployment:

```bash
npm run release:build
npm run pm2:restart
```

Stop the process:

```bash
npm run pm2:stop
```

## Implemented Scope

- Single-user password login
- Workspace views: Today, Inbox, Upcoming, Recent 7 Days, Calendar, Matrix, Reports, Projects, Tags, Smart Filters, Completed, Settings
- Task create/edit/complete/delete with priority, urgent marker, tags, due dates, reminders, recurrence, checklist subtasks, markdown notes, attachments, and continuous-create modal flow
- Task detail drawer with metadata, markdown preview, checklist subtasks, recurrence, reminders, and attachments
- Project, tag, and smart filter management
- Browser notification permission and test notification
- PWA manifest and service worker
- Data JSON export/import with preview
- Attachment upload/download/delete and ZIP export/import

## Tests

```bash
npm test
```

```bash
pgrep -af personal-todo
lsof -i :38887
```
