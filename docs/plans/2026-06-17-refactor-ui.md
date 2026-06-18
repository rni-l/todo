# React + Vite UI Migration Plan

## Summary

- Migrate the logged-in TODO UI from public/assets/app.js string-rendered Vanilla JS to a React + Vite + TypeScript SPA.
- Keep the existing Node server, API routes, data format, auth cookie behavior, deployment model, and /prototype/ static design pages.
- Preserve current product shape: left navigation, main workspace, task drawer/create panel, command palette, mobile topbar/bottom nav, calendar/report/project/settings flows.
- Upgrade the UI code structure and visual system during migration: cleaner components, typed app state, shared design tokens, improved responsive states, but no product-flow redesign.

## Key Changes

- Add frontend build toolchain:
  - Add vite, typescript, react, react-dom, and related dev dependencies.
  - Add scripts: dev:client for Vite if needed, build:client, and make release packaging depend on built client assets.
  - Keep npm run dev as the Node server entry unless intentionally running Vite middleware/proxy during development.

- New frontend structure:
  - Put React source under src/client/ to avoid mixing with existing backend modules in src/.
  - Suggested modules:
    - src/client/main.tsx
    - src/client/App.tsx
    - src/client/api.ts
    - src/client/types.ts
    - src/client/state/
    - src/client/components/
    - src/client/views/
    - src/client/styles/

  - Move reusable date/report/subtask/create-task logic into typed client utilities, preserving current behavior from public/assets/task-date.js, reports.js, subtasks.js, and task-
    create.js.

- Server/static output:
  - Vite builds into public/dist/ or another fixed public subdirectory.
  - public/index.html becomes the Vite mount shell with version injection still supported.
  - Update service worker precache from individual old JS modules to the generated React bundle assets.
  - Keep /api/_, /api/health, attachments, import/export, auth, and /prototype/_ unchanged.

- UI architecture:
  - Use React useReducer + context for app state, no external state library in v1.
  - Use hash routing initially to preserve existing URLs like #/today, #/calendar, #/project/:id.
  - Split views by route: Today, Inbox, Upcoming, Recent, Calendar, Matrix, Reports, Projects, Project Detail, Tags, Filters, Completed, Closed, Settings.
  - Split shell components: sidebar, mobile nav, page header, quick add, task list/group, task row, drawer, modal, command palette, toast.
  - Build typed domain models for Task, Project, Tag, SmartFilter, Settings, Attachment, Subtask, and API response envelopes.

- Visual system:
  - Replace the single large CSS file with a token-first global stylesheet plus component-scoped styles.
  - Keep the current “quiet personal productivity workspace” direction: calm, dense enough for daily use, no marketing hero, no purple/blue AI-gradient look.
  - Standardize tokens for color, spacing, radius, shadows, z-index, typography, priority/status colors, focus rings, and mobile breakpoints.

## Public Interfaces And Compatibility

- API contract remains unchanged:
  - React uses the existing endpoints under /api/data, /api/tasks, /api/projects, /api/tags, /api/filters, /api/settings, /api/auth/\*, and attachment import/export routes.
  - No backend data migration is required.

- URL compatibility:
  - Existing hash routes continue to work.
  - Unknown routes fall back to Today or an explicit empty/not-found view without breaking SPA load.

- PWA/cache compatibility:
  - package.json version remains the cache-busting source.
  - sw.js cache name and precache list must include the new generated bundle assets.
  - Release snapshots must include built frontend output and still keep live data in the existing ./data path unless TODO_DATA_DIR overrides it.

## Test Plan

- Unit tests:
  - Keep existing Node tests passing with npm test.
  - Add focused tests for migrated pure utilities: date range behavior, report summary, task-create defaults, subtask append behavior.
  - Add reducer tests for route/state transitions, drawer open/close, selected calendar date, create-task defaults, sidebar/drawer settings.

- Build checks:
  - npm run build:client
  - npm test
  - npm run release:build

- Browser smoke checks:
  - Start app with an isolated data dir, e.g. TODO_DATA_DIR=/private/tmp/myself-todo-react-smoke PORT=39007 npm run dev.
  - Verify login, Today, Calendar month/week, Reports, Projects, Project detail, Settings, create task, edit task drawer, close/complete task, tag/project/filter modals, attachment
    controls.

  - Verify desktop and mobile layouts with screenshots, including docked drawer, collapsed sidebar, command palette, and bottom nav.
  - Verify /api/health returns the expected version after build/restart.

## Assumptions

- Framework: React + Vite + TypeScript.
- Styling: local CSS using shared tokens, not Tailwind or a component library.
- Migration strategy: behavior-preserving replacement, not a full product redesign.
- State management: React reducer/context only for the first migration.
- Backend and data model are out of scope except static asset serving, service worker cache updates, and release packaging support for the new build output.
