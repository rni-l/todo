# Calendar View Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the calendar fill the available viewport, keep its page and month headers visible, and default month cells to hiding adjacent-month dates through a persisted setting.

**Architecture:** Keep the existing vertically lazy-loaded month window and drag contracts. Add one normalized setting, one pure helper that converts a month grid into week windows with column offsets, then use those interfaces in the React calendar before applying a calendar-route viewport grid and synchronized sticky month headers.

**Tech Stack:** Node.js 20+, React 19, TypeScript 6, Vite 8, CSS Grid/Sticky positioning, Node test runner, Playwright browser verification.

## Global Constraints

- `calendarShowAdjacentDays` is a persisted boolean under `AppSettings`; its default and legacy backfill value are exactly `false`.
- The configuration control is located only in `设置 -> 外观` and saves through the existing `POST /api/settings` flow.
- Hidden adjacent dates retain grid positions but expose no date text, tasks, selection, creation, or drop target.
- Week view behavior is unchanged.
- Preserve `IntersectionObserver` month extension, prepend scroll anchoring, calendar-selected create defaults, single-day drag updates, and whole-range drag movement.
- Do not add dependencies, API routes, or a data-version migration.
- Bump the application version from `1.7.7` to `1.7.8` so the existing HTML and Service Worker cache query changes.

---

## File Map

- `src/storage.js`: normalize, seed, persist, and backfill `calendarShowAdjacentDays`.
- `src/client/types.ts`: expose the new setting in the client data contract.
- `src/client/lib/dates.ts`: produce testable per-week visible-day windows and original-grid column offsets.
- `src/client/App.tsx`: render placeholders, clip range bars, synchronize horizontal headers, add the setting control, and mark the calendar route layout.
- `src/client/styles/app.css`: fill the viewport, make month headers sticky, preserve mobile horizontal containment, and hide placeholder content.
- `tests/core.test.js`: cover setting defaults, persistence, and legacy backfill.
- `tests/task-date.test.js`: cover visible week windows and column offsets.
- `package.json`, `package-lock.json`: update the cache-busting application version.

---

### Task 1: Persist the Adjacent-Month Setting

**Files:**
- Modify: `tests/core.test.js`
- Modify: `src/storage.js`
- Modify: `src/client/types.ts`

**Interfaces:**
- Produces: `AppSettings.calendarShowAdjacentDays: boolean`.
- Produces: `TodoStore.publicData().settings.calendarShowAdjacentDays` with legacy/default value `false`.

- [ ] **Step 1: Write failing setting tests**

Add this standalone test near the other settings/storage tests in `tests/core.test.js`:

```js
test('calendar adjacent day setting defaults off and persists updates', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-store-'));
  const store = new TodoStore({ dataDir });
  await store.init();

  assert.equal(store.publicData().settings.calendarShowAdjacentDays, false);

  const settings = await store.updateSettings({ calendarShowAdjacentDays: true });
  assert.equal(settings.calendarShowAdjacentDays, true);

  const reloaded = new TodoStore({ dataDir });
  await reloaded.init();
  assert.equal(reloaded.publicData().settings.calendarShowAdjacentDays, true);
});
```

Extend the existing legacy payload test with one deletion and one assertion:

```js
delete payload.settings.calendarShowAdjacentDays;
```

```js
assert.equal(migrated.data.settings.calendarShowAdjacentDays, false);
```

- [ ] **Step 2: Run the tests and verify the new contract fails**

Run:

```bash
node --experimental-strip-types --test --test-name-pattern="calendar adjacent day|legacy payloads" tests/core.test.js
```

Expected: FAIL because `calendarShowAdjacentDays` is `undefined` before normalization is implemented.

- [ ] **Step 3: Add the normalized setting and client type**

Add the field to `normalizeSettings()` in `src/storage.js` immediately before `calendarDayLimit`:

```js
calendarShowAdjacentDays: Boolean(
  input.calendarShowAdjacentDays ?? existing.calendarShowAdjacentDays ?? false
),
```

Add the seeded value immediately before `calendarDayLimit` in `seedData()`:

```js
calendarShowAdjacentDays: false,
```

Add the field immediately before `calendarDayLimit` in `AppSettings` in `src/client/types.ts`:

```ts
calendarShowAdjacentDays: boolean;
```

- [ ] **Step 4: Run the focused and complete storage tests**

Run:

```bash
node --experimental-strip-types --test --test-name-pattern="calendar adjacent day|legacy payloads" tests/core.test.js
npm test
```

Expected: the focused tests PASS, then the complete suite reports zero failures.

- [ ] **Step 5: Commit the persisted setting**

```bash
git add src/storage.js src/client/types.ts tests/core.test.js
git commit -m "feat: persist calendar adjacent day setting"
```

---

### Task 2: Add Testable Month Week Windows

**Files:**
- Modify: `tests/task-date.test.js`
- Modify: `src/client/lib/dates.ts`

**Interfaces:**
- Consumes: existing `MonthDay { date: string; inMonth: boolean }` values from `monthGridDays()`.
- Produces: `CalendarWeekWindow { days: MonthDay[]; columnOffset: number }`.
- Produces: `calendarMonthWeekWindows(days: MonthDay[], showAdjacentDays: boolean): CalendarWeekWindow[]`.

- [ ] **Step 1: Write failing week-window tests**

Add `calendarMonthWeekWindows` to the import list in `tests/task-date.test.js`, then add:

```js
test('calendarMonthWeekWindows hides adjacent dates and preserves grid columns', () => {
  const days = monthGridDays('2026-02');
  const weeks = calendarMonthWeekWindows(days, false);

  assert.equal(weeks.length, 5);
  assert.deepEqual(weeks[0], {
    days: [{ date: '2026-02-01', inMonth: true }],
    columnOffset: 6
  });
  assert.deepEqual(weeks[4], {
    days: [
      { date: '2026-02-23', inMonth: true },
      { date: '2026-02-24', inMonth: true },
      { date: '2026-02-25', inMonth: true },
      { date: '2026-02-26', inMonth: true },
      { date: '2026-02-27', inMonth: true },
      { date: '2026-02-28', inMonth: true }
    ],
    columnOffset: 0
  });
});

test('calendarMonthWeekWindows keeps complete weeks when adjacent dates are enabled', () => {
  const weeks = calendarMonthWeekWindows(monthGridDays('2026-02'), true);

  assert.equal(weeks.length, 5);
  assert.equal(weeks.every(week => week.days.length === 7), true);
  assert.equal(weeks.every(week => week.columnOffset === 0), true);
  assert.equal(weeks[0].days[0].date, '2026-01-26');
  assert.equal(weeks[4].days[6].date, '2026-03-01');
});

test('hidden adjacent days clip a cross-month range to active-month columns', () => {
  const firstWeek = calendarMonthWeekWindows(monthGridDays('2026-02'), false)[0];
  const [segment] = buildTaskRangeSegments([
    { id: 'cross-month', title: '跨月任务', startDate: '2026-01-30', dueDate: '2026-02-03' }
  ], firstWeek.days.map(day => day.date));

  assert.equal(firstWeek.columnOffset, 6);
  assert.equal(segment.startIndex + firstWeek.columnOffset, 6);
  assert.equal(segment.span, 1);
  assert.equal(segment.continuesBefore, true);
  assert.equal(segment.continuesAfter, true);
});
```

- [ ] **Step 2: Run the focused tests and verify the helper is missing**

Run:

```bash
node --experimental-strip-types --test --test-name-pattern="calendarMonthWeekWindows" tests/task-date.test.js
```

Expected: FAIL because `calendarMonthWeekWindows` is not exported.

- [ ] **Step 3: Implement the pure week-window helper**

Add the interface next to `CalendarMonth` in `src/client/lib/dates.ts`:

```ts
export interface CalendarWeekWindow {
  days: MonthDay[];
  columnOffset: number;
}
```

Add this helper immediately after `monthGridDays()`:

```ts
export function calendarMonthWeekWindows(days: MonthDay[], showAdjacentDays: boolean): CalendarWeekWindow[] {
  const weeks: CalendarWeekWindow[] = [];
  for (let index = 0; index < days.length; index += 7) {
    const week = days.slice(index, index + 7);
    if (showAdjacentDays) {
      weeks.push({ days: week, columnOffset: 0 });
      continue;
    }
    const firstVisibleIndex = week.findIndex(day => day.inMonth);
    weeks.push({
      days: week.filter(day => day.inMonth),
      columnOffset: Math.max(0, firstVisibleIndex)
    });
  }
  return weeks;
}
```

- [ ] **Step 4: Run focused date tests and the full suite**

Run:

```bash
node --experimental-strip-types --test --test-name-pattern="monthGridDays|calendarMonthWeekWindows|calendar month windows" tests/task-date.test.js
npm test
```

Expected: all focused tests PASS and the complete suite reports zero failures.

- [ ] **Step 5: Commit the month window helper**

```bash
git add src/client/lib/dates.ts tests/task-date.test.js
git commit -m "test: define calendar month visibility windows"
```

---

### Task 3: Wire Calendar Visibility, Range Clipping, and Header Synchronization

**Files:**
- Modify: `src/client/App.tsx`

**Interfaces:**
- Consumes: `AppSettings.calendarShowAdjacentDays` from Task 1.
- Consumes: `calendarMonthWeekWindows()` and `MonthDay` from Task 2.
- Produces: `syncCalendarHorizontalScroll(event: ReactUIEvent<HTMLDivElement>): void`.
- Changes internal component props: `CalendarRangeLayer.days` becomes `MonthDay[]`, and `CalendarRangeBar` receives `columnOffset: number`.

- [ ] **Step 1: Establish a green baseline before UI wiring**

Run:

```bash
npm test
npm run build:client
```

Expected: both commands PASS before `App.tsx` changes.

- [ ] **Step 2: Import the new types and helper**

Change the React type import to include an alias for React's UI event:

```ts
import type { DragEvent, FormEvent, ReactNode, UIEvent as ReactUIEvent } from 'react';
```

Add these entries to the `./lib/dates.ts` import:

```ts
calendarMonthWeekWindows,
type MonthDay,
```

- [ ] **Step 3: Mark the calendar route as a dedicated viewport layout**

Replace the main pane element in `AppShell` with:

```tsx
<section className={`main-pane ${state.route.name === 'calendar' ? 'calendar-pane' : ''}`}>
  <MainView state={state} actions={actions} />
</section>
```

- [ ] **Step 4: Make the week and month range models use visible day windows**

In `CalendarView`, add:

```ts
const showAdjacentDays = state.data.settings.calendarShowAdjacentDays;
```

Change the week row count and week range layer calls to:

```ts
const weekRangeRows = calendarRangeRowCount(rangeTasks, weekDayModels, limit, true);
```

```tsx
<CalendarRangeLayer
  actions={actions}
  days={weekDayModels}
  limit={limit}
  rangeTasks={rangeTasks}
  showAdjacentDays={true}
/>
```

Inside the month map, compute rows from month models instead of strings:

```ts
const rangeRows = calendarRangeRowCount(rangeTasks, month.days, limit, showAdjacentDays);
```

- [ ] **Step 5: Split each month's sticky header from its grid scroller**

Replace each month section body with this structure:

```tsx
<section className="calendar-month-section" data-month-key={month.key} key={month.key}>
  <div className="calendar-month-sticky">
    <div className="calendar-month-title">
      <h2>{month.label}</h2>
      <span>{month.days.filter(day => day.inMonth).length} 天</span>
    </div>
    <div
      className="calendar-month-weekdays-scroll"
      data-calendar-horizontal
      onScroll={syncCalendarHorizontalScroll}
    >
      <div className="month-weekdays">
        {monthWeekdayLabels().map(label => <span key={label}>{label}</span>)}
      </div>
    </div>
  </div>
  <div
    className="calendar-month-grid-scroll"
    data-calendar-horizontal
    onScroll={syncCalendarHorizontalScroll}
  >
    <div className="month-grid calendar-range-grid" style={{ '--range-rows': rangeRows } as React.CSSProperties}>
      {month.days.map((day, index) => (
        <CalendarCell
          key={day.date}
          state={state}
          actions={actions}
          day={day}
          index={index}
          showAdjacentDays={showAdjacentDays}
        />
      ))}
      <CalendarRangeLayer
        actions={actions}
        days={month.days}
        limit={limit}
        rangeTasks={rangeTasks}
        showAdjacentDays={showAdjacentDays}
      />
    </div>
  </div>
</section>
```

Add the synchronization helper below `calendarMonthNearestTop()`:

```ts
function syncCalendarHorizontalScroll(event: ReactUIEvent<HTMLDivElement>) {
  const source = event.currentTarget;
  const section = source.closest('.calendar-month-section');
  if (!section) return;
  for (const target of Array.from(section.querySelectorAll<HTMLElement>('[data-calendar-horizontal]'))) {
    if (target !== source && target.scrollLeft !== source.scrollLeft) {
      target.scrollLeft = source.scrollLeft;
    }
  }
}
```

- [ ] **Step 6: Render inaccessible blank placeholders when adjacent dates are hidden**

Extend `CalendarCell` with the prop and early return before task lookup:

```tsx
function CalendarCell({ state, actions, day, index, showAdjacentDays = true }: {
  state: ReadyState;
  actions: AppActions;
  day: MonthDay;
  index: number;
  showAdjacentDays?: boolean;
}) {
  const isMonth = state.calendarMode === 'month';
  const style = isMonth
    ? { gridColumn: (index % 7) + 1, gridRow: Math.floor(index / 7) + 1 }
    : { gridColumn: index + 1, gridRow: 1 };

  if (isMonth && !day.inMonth && !showAdjacentDays) {
    return <article aria-hidden="true" className="calendar-day calendar-day-placeholder" style={style} />;
  }

  const allDayTasks = openTasks(state.data).filter(task => taskCoversDate(task, day.date));
```

Remove the old duplicate `isMonth` and `style` declarations later in this function. All existing click and drag handlers remain below the early return, so placeholders receive none of them.

- [ ] **Step 7: Clip range bars and row counts to the visible month portion**

Replace `CalendarRangeLayer`, extend `CalendarRangeBar`, and replace `calendarRangeRowCount` with:

```tsx
function CalendarRangeLayer({ actions, days, limit, rangeTasks, showAdjacentDays }: {
  actions: AppActions;
  days: MonthDay[];
  limit: number;
  rangeTasks: Task[];
  showAdjacentDays: boolean;
}) {
  const weeks = calendarMonthWeekWindows(days, showAdjacentDays);
  return (
    <>
      {weeks.map((week, rowIndex) => {
        const dayDates = week.days.map(day => day.date);
        if (!dayDates.length) return null;
        const segments = sortCalendarSegments(buildTaskRangeSegments(rangeTasks, dayDates));
        const visible = segments.slice(0, limit);
        const hidden = Math.max(0, segments.length - visible.length);
        return (
          <div className="calendar-range-layer" key={dayDates[0]} style={{ '--week-row': rowIndex + 1, '--range-count': visible.length } as React.CSSProperties}>
            {visible.map((segment, segmentIndex) => (
              <CalendarRangeBar
                actions={actions}
                columnOffset={week.columnOffset}
                key={`${segment.task.id}-${segment.visibleStart}`}
                segment={segment}
                row={segmentIndex + 1}
              />
            ))}
            {hidden ? (
              <button
                className="calendar-range-more tiny-action"
                type="button"
                style={{ '--range-row': visible.length + 1 } as React.CSSProperties}
                onClick={event => {
                  event.stopPropagation();
                  actions.setSelectedCalendarDate(dayDates[0]);
                }}
              >
                还有 {hidden} 项范围任务
              </button>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function CalendarRangeBar({ actions, columnOffset, segment, row }: {
  actions: AppActions;
  columnOffset: number;
  segment: TaskRangeSegment<Task>;
  row: number;
}) {
  const priority = priorityMeta(segment.task.priority).key;
  const className = [
    'calendar-range-bar',
    priority,
    segment.continuesBefore ? 'continues-before' : '',
    segment.continuesAfter ? 'continues-after' : ''
  ].filter(Boolean).join(' ');
  return (
    <button
      className={className}
      draggable
      type="button"
      data-task-id={segment.task.id}
      style={{ '--range-start': segment.startIndex + columnOffset + 1, '--range-span': segment.span, '--range-row': row } as React.CSSProperties}
      onClick={event => { event.stopPropagation(); actions.openDetail(segment.task.id); }}
      onDragStart={event => writeCalendarDragPayload(event, segment.task.id, 'range')}
      onDragEnd={event => event.currentTarget.classList.remove('dragging')}
    >
      <span>{segment.continuesBefore ? '‹ ' : ''}{segment.task.title}{segment.continuesAfter ? ' ›' : ''}</span>
      <small>{formatDateRange(segment.startDate, segment.endDate)}</small>
    </button>
  );
}

function calendarRangeRowCount(rangeTasks: Task[], days: MonthDay[], limit: number, showAdjacentDays: boolean) {
  let max = 0;
  for (const week of calendarMonthWeekWindows(days, showAdjacentDays)) {
    const dayDates = week.days.map(day => day.date);
    max = Math.max(max, Math.min(limit, buildTaskRangeSegments(rangeTasks, dayDates).length));
  }
  return max;
}
```

- [ ] **Step 8: Add the Appearance setting switch**

In the `appearance` branch of `settingsPanel()`, insert this switch immediately after the “日历每日显示条数” field:

```tsx
{switchRow(
  '显示相邻月份日期',
  '开启后，月视图会在月初和月末显示相邻月份的日期与任务。',
  state.data.settings.calendarShowAdjacentDays,
  () => actions.updateSettings({
    calendarShowAdjacentDays: !state.data.settings.calendarShowAdjacentDays
  })
)}
```

- [ ] **Step 9: Compile and run all logic tests**

Run:

```bash
npm test
npm run build:client
```

Expected: all tests PASS and Vite completes without TypeScript or JSX errors.

- [ ] **Step 10: Commit the calendar behavior**

```bash
git add src/client/App.tsx
git commit -m "feat: hide adjacent dates in calendar months"
```

---

### Task 4: Fill the Viewport and Style Sticky Month Headers

**Files:**
- Modify: `src/client/styles/app.css`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `.calendar-pane`, `.calendar-month-sticky`, `.calendar-month-weekdays-scroll`, `[data-calendar-horizontal]`, and `.calendar-day-placeholder` from Task 3.
- Produces: a viewport-height calendar workspace and sticky, synchronized month header presentation.

- [ ] **Step 1: Add the calendar-route viewport grid**

Add after the base `.main-pane` rule:

```css
.main-pane.calendar-pane {
  height: 100dvh;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  overflow: hidden;
  padding-bottom: 28px;
}
.calendar-pane .calendar-shell {
  height: 100%;
  min-height: 0;
}
```

- [ ] **Step 2: Replace the bounded month scroll and add sticky header styles**

Replace the calendar scroll/header block with:

```css
.calendar-shell { display: grid; gap: 12px; width: 100%; min-width: 0; }
.calendar-month-scroll {
  display: grid;
  gap: 22px;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
  scrollbar-gutter: stable;
}
.calendar-scroll-sentinel {
  min-height: 1px;
  pointer-events: none;
}
.calendar-month-section {
  position: relative;
  display: grid;
  gap: 10px;
  min-width: 0;
}
.calendar-month-sticky {
  position: sticky;
  top: 0;
  z-index: 6;
  display: grid;
  gap: 8px;
  padding: 4px 0 10px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
.calendar-month-weekdays-scroll,
.calendar-month-grid-scroll {
  min-width: 0;
}
.calendar-month-weekdays-scroll {
  overflow-x: hidden;
  scrollbar-width: none;
}
.calendar-month-weekdays-scroll::-webkit-scrollbar {
  display: none;
}
.calendar-month-grid-scroll {
  display: grid;
  gap: 8px;
}
.calendar-day-placeholder {
  visibility: hidden;
  pointer-events: none;
}
```

Keep the existing `.calendar-month-title`, `.month-weekdays`, `.month-grid`, task pill, and range bar declarations after this replacement.

- [ ] **Step 3: Update mobile horizontal containment without restoring a height cap**

Inside `@media (max-width: 980px)`, replace the existing calendar month scroll rules with:

```css
.main-pane.calendar-pane {
  height: 100dvh;
  padding-bottom: 96px;
}
.calendar-month-scroll {
  padding-right: 0;
}
.calendar-month-weekdays-scroll,
.calendar-month-grid-scroll {
  overflow-x: auto;
  padding-bottom: 2px;
}
.calendar-month-weekdays-scroll .month-weekdays,
.calendar-month-grid-scroll .month-grid {
  min-width: 980px;
}
```

Inside `@media (max-width: 560px)`, replace the old weekday/grid selector with:

```css
.calendar-month-weekdays-scroll .month-weekdays,
.calendar-month-grid-scroll .month-grid {
  min-width: 944px;
}
```

- [ ] **Step 4: Bump the cache-busting application version**

Run:

```bash
npm version 1.7.8 --no-git-tag-version
```

Expected: `package.json` and the root package entries in `package-lock.json` both report `1.7.8`; no Git tag is created.

- [ ] **Step 5: Run the full automated verification**

Run:

```bash
npm test
npm run build:client
git diff --check
```

Expected: all tests PASS, Vite writes `public/dist`, and `git diff --check` prints nothing.

- [ ] **Step 6: Commit layout, sticky headers, and version**

```bash
git add src/client/styles/app.css package.json package-lock.json
git commit -m "feat: make calendar fill the viewport"
```

---

### Task 5: Verify Desktop, Mobile, Settings, and Regressions in a Real Browser

**Files:**
- Verify only: `src/client/App.tsx`
- Verify only: `src/client/styles/app.css`
- Verify only: `src/storage.js`

**Interfaces:**
- Consumes: the completed calendar UI at `/#/calendar` and settings UI at `/#/settings`.
- Produces: browser evidence that all acceptance criteria work together; no tracked artifact is created.

- [ ] **Step 1: Start an isolated server and read the Playwright skill before browser automation**

Run the app in a persistent terminal session:

```bash
PORT=39020 TODO_DATA_DIR=/private/tmp/myself-todo-calendar-view-20260717 npm run dev
```

Expected: the server reports `http://127.0.0.1:39020` and app version `1.7.8`. Before controlling the browser, read and follow `/Users/ddd/.codex/skills/playwright/SKILL.md` completely.

- [ ] **Step 2: Verify default-hidden behavior at desktop size**

Open `http://127.0.0.1:39020/#/calendar`, authenticate against the isolated default account, and set the viewport to `1440x900`.

Verify all of the following:

- `.calendar-day-placeholder` exists and every placeholder has empty `textContent`, no `data-date`, and `aria-hidden="true"`.
- Clicking the center of a placeholder does not change the selected calendar date.
- Current-month cells still select dates and task pills still open task details.
- The page has no console errors and no failed application requests.

- [ ] **Step 3: Verify large-screen height and the complete sticky stack**

Set the viewport to `2560x1440`. Measure the layout in the page:

```js
const pane = document.querySelector('.main-pane.calendar-pane');
const scroller = document.querySelector('.calendar-month-scroll');
const paneRect = pane.getBoundingClientRect();
const scrollerRect = scroller.getBoundingClientRect();
({
  viewportHeight: window.innerHeight,
  paneHeight: paneRect.height,
  scrollerBottomGap: window.innerHeight - scrollerRect.bottom,
  scrollable: scroller.scrollHeight > scroller.clientHeight
});
```

Expected:

- `paneHeight` equals `viewportHeight` within 1 CSS pixel.
- `scrollerBottomGap` is between 20 and 40 CSS pixels on desktop.
- `scrollable` is `true` once multiple months are loaded.
- The page title, actions, and statistics remain visible while only `.calendar-month-scroll` moves.
- After scrolling into the next month, that month's `.calendar-month-sticky` top aligns with the scroll container top and its month title plus weekday labels remain visible.

Capture a desktop screenshot showing the large viewport and sticky month header.

- [ ] **Step 4: Verify the persisted setting can restore adjacent dates**

Navigate to `/#/settings`, open `外观`, enable “显示相邻月份日期”, then return to `/#/calendar` and reload.

Expected:

- The setting remains enabled after reload.
- Cells before and after the active month show dates and tasks with the existing muted treatment.
- Adjacent cells can be selected and accept the same date interactions as before.
- Disabling the setting restores empty placeholders immediately and remains disabled after reload.

- [ ] **Step 5: Verify mobile horizontal synchronization and containment**

Set the viewport to `390x844`, keep adjacent dates disabled, and scroll a `.calendar-month-grid-scroll` horizontally.

Expected:

- The same month's `.calendar-month-weekdays-scroll.scrollLeft` equals the grid scroller's `scrollLeft`.
- Scrolling the weekday strip also updates the grid scroller.
- Weekday labels remain aligned above their date columns.
- The month sticky header remains below the fixed mobile top bar within the calendar workspace.
- The calendar bottom is not covered by the fixed bottom navigation.
- `document.documentElement.scrollWidth === window.innerWidth` and the body has no page-level horizontal overflow.

Capture a mobile screenshot after horizontal scrolling.

- [ ] **Step 6: Run drag, lazy-load, and final repository checks**

Verify in the browser that a single-day task remains draggable to a current-month cell, a range task remains draggable as one range, and scrolling to both month boundaries still appends/prepends months without a visible jump.

Then stop the dev server and run:

```bash
npm test
npm run build:client
git status --short
```

Expected: all tests and the build PASS; `git status --short` prints nothing.
