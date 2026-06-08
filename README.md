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

## PM2

The repository includes `ecosystem.config.cjs` for PM2 deployment. It runs the app as `personal-todo` on port `38887` and uses `./data` as the data directory.

```bash
npm run pm2:start
npm run pm2:logs
```

To restart or stop the process:

```bash
npm run pm2:restart
npm run pm2:stop
```

## Implemented Scope

- Single-user password login
- Workspace views: Today, Inbox, Upcoming, Recent 7 Days, Calendar, Matrix, Projects, Tags, Smart Filters, Completed, Settings
- Task create/edit/complete/delete with priority, urgent marker, tags, due dates, reminders, recurrence, checklist subtasks, markdown notes, and attachments
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

```
pgrep -af myself-todo
lsof :i 38887
```
