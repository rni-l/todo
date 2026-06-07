# Todo App View And Form Upgrades Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Matrix and Recent 7 Days task views, support urgent task marking, and polish tag selection, dropdowns, forms, checklist wrapping, and dark-mode calendar readability.

**Architecture:** Keep the app as the current single-page vanilla JavaScript PWA: data normalization stays in `src/storage.js`, API shape remains the existing task payload, and UI rendering stays in `public/assets/app.js`. Add one small data field (`urgent`) and derive Eisenhower matrix importance from existing priority, so the feature avoids a larger schema migration. Visual upgrades are CSS-first, with small markup helpers for reusable tag pickers and select wrappers.

**Tech Stack:** Node.js 20+, native `node:test`, vanilla JavaScript, server-rendered JSON APIs from `server.js`, static HTML/CSS/JS in `public/`.

---

## Current Context

- The app shell, routing, task views, modals, drawer, and UI helper functions are in `public/assets/app.js`.
- The current task model is normalized in `src/storage.js:177-203`.
- The only automated test file is `tests/core.test.js`.
- Styling is centralized in `public/assets/app.css`.
- Existing worktree has unrelated uncommitted changes; do not revert them. Commit only files touched for this feature.

## Product Decisions

- `urgent` is a new boolean task field.
- Matrix view uses `urgent` for the urgent axis and existing priority for the important axis.
- A task is important when `priority` is `high` or `medium`.
- Recent 7 Days view means tasks with `dueDate` from today minus 6 days through today, plus completed tasks whose `completedAt` is inside that same 7-day window.
- Checklist titles must show the full text and support line breaks. Use a `textarea`, not a text `input`.
- Dropdown polish should stay native `<select>` with improved styling and a wrapper arrow. Do not add a custom ARIA combobox/listbox in this pass.

## Acceptance Criteria

- Sidebar and mobile routing include `四象限` and `最近7天`.
- New and existing tasks default to `urgent: false`.
- Drawer can toggle a task's urgent state and it persists after refresh.
- Task create modal can set urgent state.
- Matrix view has four quadrants: important and urgent, important not urgent, urgent not important, neither.
- Recent 7 Days view groups tasks by date and includes completed tasks from the window.
- Tag selection in task creation and drawer is chip-based, not a raw multi-select.
- All native selects share the polished select styling.
- Dialog and drawer form controls look consistent, including focus, labels, helper text, and dark mode.
- Checklist item text wraps and preserves line breaks without clipping.
- Calendar task pills are readable in dark mode and task titles wrap instead of being clipped to one line.
- `npm test` passes.

---

### Task 1: Add Urgent Field To Task Storage

**Files:**
- Modify: `src/storage.js:151-203`
- Modify: `tests/core.test.js:27-48`

**Step 1: Write the failing test**

Add this test after `task update can clear optional fields` in `tests/core.test.js`:

```js
test('task urgent flag defaults false and can be updated', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-store-'));
  const store = new TodoStore({ dataDir });
  await store.init();

  const task = await store.createTask({ title: 'urgent marker' });
  assert.equal(task.urgent, false);

  const marked = await store.updateTask(task.id, { urgent: true });
  assert.equal(marked.urgent, true);

  const cleared = await store.updateTask(task.id, { urgent: false });
  assert.equal(cleared.urgent, false);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test
```

Expected: FAIL because `task.urgent` is currently `undefined`.

**Step 3: Write minimal implementation**

In `src/storage.js`, update `taskSeed`:

```js
function taskSeed(title, input = {}) {
  const createdAt = nowISO();
  return {
    id: createId('task'),
    title,
    completed: false,
    completedAt: null,
    projectId: input.projectId ?? null,
    sectionId: input.sectionId ?? null,
    dueDate: input.dueDate ?? null,
    reminderAt: input.reminderAt ?? null,
    priority: input.priority ?? 'none',
    urgent: Boolean(input.urgent ?? false),
    tags: input.tags ?? [],
    recurrence: input.recurrence ?? null,
    description: input.description ?? '',
    subtasks: [
      { id: createId('sub'), title: '确认页面状态', completed: false, order: 1 },
      { id: createId('sub'), title: '补齐移动端检查', completed: false, order: 2 }
    ],
    attachments: [],
    order: input.order ?? 0,
    createdAt,
    updatedAt: createdAt
  };
}
```

In `normalizeTask`, add `urgent` after `priority`:

```js
urgent: has('urgent') ? Boolean(input.urgent) : Boolean(existing.urgent ?? false),
```

**Step 4: Run test to verify it passes**

Run:

```bash
npm test
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/storage.js tests/core.test.js
git commit -m "feat: add urgent task marker"
```

---

### Task 2: Add Matrix And Recent Views To Navigation

**Files:**
- Modify: `public/assets/app.js:22-47`
- Modify: `public/assets/app.js:309-367`
- Modify: `public/assets/app.js:370-405`
- Modify: `public/assets/app.js:1631-1641`

**Step 1: Write the expected route changes**

No automated route tests exist for `public/assets/app.js`. Before editing, write down the intended navigation data in the commit message and verify manually after implementation.

Expected new nav items:

```js
{ id: 'matrix', label: '四象限', icon: '⊞' },
{ id: 'recent', label: '最近7天', icon: '↺', mobile: true }
```

Expected route titles:

```js
matrix: ['MATRIX · 重要紧急', '四象限'],
recent: ['RECENT · 最近7天', '最近7天']
```

**Step 2: Implement nav items and route titles**

In `public/assets/app.js`, update `navItems` near the top:

```js
const navItems = [
  { id: 'today', label: '今日', icon: '☑', mobile: true },
  { id: 'inbox', label: '收件箱', icon: '▣', mobile: true },
  { id: 'upcoming', label: '即将到来', icon: '◷' },
  { id: 'recent', label: '最近7天', icon: '↺', mobile: true },
  { id: 'calendar', label: '日历', icon: '▦', mobile: true },
  { id: 'matrix', label: '四象限', icon: '⊞' },
  { id: 'projects', label: '项目', icon: '●' },
  { id: 'tags', label: '标签', icon: '#' },
  { id: 'filters', label: '智能过滤器', icon: '⚑' },
  { id: 'completed', label: '已完成', icon: '✓' },
  { id: 'settings', label: '设置', icon: '⚙', mobile: true, mobileLabel: '更多' }
];
```

Update `routeTitles`:

```js
recent: ['RECENT · 最近7天', '最近7天'],
matrix: ['MATRIX · 重要紧急', '四象限'],
```

Update `mainView()`:

```js
if (route.name === 'recent') return recentPage();
if (route.name === 'matrix') return matrixPage();
```

Update `sidebarCounts()`:

```js
recent: recentTasks().length,
matrix: openTasks().length,
```

Update `routeIcon()`:

```js
if (state.route.name === 'matrix') return '⊞';
if (state.route.name === 'recent') return '↺';
```

**Step 3: Keep sidebar grouping readable**

Use the first six nav items for the main group so `四象限` stays with core views:

```js
${navItems.slice(0, 6).map(item => navButton(item, counts[item.id])).join('')}
```

Use `Projects` only in the project shortcut area and keep organization nav for tags, filters, completed:

```js
${navButton(navItems.find(item => item.id === 'tags'), counts.tags)}
${navButton(navItems.find(item => item.id === 'filters'), counts.filters)}
${navButton(navItems.find(item => item.id === 'completed'), counts.completed)}
```

**Step 4: Run syntax and smoke checks**

Run:

```bash
npm test
node --check public/assets/app.js
```

Expected: PASS / no syntax output.

**Step 5: Commit**

```bash
git add public/assets/app.js
git commit -m "feat: add matrix and recent navigation"
```

---

### Task 3: Implement Recent 7 Days View

**Files:**
- Modify: `public/assets/app.js:523-546`
- Modify: `public/assets/app.js:1545-1660`

**Step 1: Add helper functions**

Add these helpers near `inboxStats()`:

```js
function isWithinRecentWindow(value) {
  return Boolean(value && value >= todayISO(-6) && value <= todayISO());
}

function taskRecentDate(task) {
  if (isWithinRecentWindow(task.dueDate)) return task.dueDate;
  const completedDate = task.completedAt?.slice(0, 10);
  if (isWithinRecentWindow(completedDate)) return completedDate;
  return null;
}

function recentTasks() {
  return state.data.tasks.filter(task => taskRecentDate(task));
}
```

**Step 2: Add the page renderer**

Add after `upcomingPage()`:

```js
function recentPage() {
  const tasks = recentTasks();
  const days = Array.from({ length: 7 }, (_, index) => todayISO(-index));
  return listPage({
    eyebrow: 'RECENT · 最近7天',
    title: '最近7天',
    subtitle: '回看过去七天到今天的到期和完成任务。',
    stats: [
      { value: tasks.length, label: '最近任务' },
      { value: tasks.filter(task => !task.completed).length, label: '未完成' },
      { value: tasks.filter(task => task.completed).length, label: '已完成' },
      { value: tasks.filter(task => task.urgent).length, label: '紧急' }
    ],
    quickContext: { dueDate: todayISO() },
    placeholder: '添加一个今天要处理的任务',
    groups: days.map(day => taskGroup(
      day === todayISO() ? '今天' : shortDate(day),
      tasks.filter(task => taskRecentDate(task) === day),
      day === todayISO() ? 'success' : ''
    ))
  });
}
```

**Step 3: Verify behavior manually**

Run:

```bash
npm test
PORT=38887 npm run dev
```

Open `http://localhost:38887/#/recent`.

Expected:
- Page title is `最近7天`.
- Stats render.
- Groups show today and six earlier days.
- Completed tasks from the last 7 days appear in the matching group.

**Step 4: Commit**

```bash
git add public/assets/app.js
git commit -m "feat: add recent seven days view"
```

---

### Task 4: Implement Four Quadrant Matrix View

**Files:**
- Modify: `public/assets/app.js:548-614`
- Modify: `public/assets/app.js:1545-1629`
- Modify: `public/assets/app.css:369-451`

**Step 1: Add matrix helper functions**

Add near `sortTasks()`:

```js
function isUrgentTask(task) {
  return Boolean(task.urgent);
}

function isImportantTask(task) {
  return ['high', 'medium'].includes(task.priority);
}

function matrixQuadrants() {
  const tasks = openTasks();
  return [
    {
      key: 'important-urgent',
      title: '重要且紧急',
      subtitle: '现在处理',
      tone: 'danger',
      tasks: tasks.filter(task => isImportantTask(task) && isUrgentTask(task))
    },
    {
      key: 'important-not-urgent',
      title: '重要不紧急',
      subtitle: '安排时间',
      tone: 'success',
      tasks: tasks.filter(task => isImportantTask(task) && !isUrgentTask(task))
    },
    {
      key: 'not-important-urgent',
      title: '紧急不重要',
      subtitle: '快速处理或委托',
      tone: 'warn',
      tasks: tasks.filter(task => !isImportantTask(task) && isUrgentTask(task))
    },
    {
      key: 'not-important-not-urgent',
      title: '不重要不紧急',
      subtitle: '稍后或删除',
      tone: 'muted',
      tasks: tasks.filter(task => !isImportantTask(task) && !isUrgentTask(task))
    }
  ];
}
```

**Step 2: Add matrix page renderer**

Add after `recentPage()`:

```js
function matrixPage() {
  const quadrants = matrixQuadrants();
  return `
    ${pageHeader({
      eyebrow: 'MATRIX · 重要紧急',
      title: '四象限',
      subtitle: '根据任务优先级判断重要性，根据紧急标记判断紧急性。',
      actions: '<button class="soft-button" type="button" data-action="open-task-modal">新建任务</button>'
    })}
    ${stats([
      { value: quadrants[0].tasks.length, label: '重要且紧急' },
      { value: quadrants[1].tasks.length, label: '重要不紧急' },
      { value: quadrants[2].tasks.length, label: '紧急不重要' },
      { value: quadrants[3].tasks.length, label: '不重要不紧急' }
    ])}
    <section class="matrix-grid">
      ${quadrants.map(matrixQuadrant).join('')}
    </section>
  `;
}

function matrixQuadrant(quadrant) {
  return `
    <section class="group matrix-quadrant ${quadrant.tone}">
      <div class="group-header">
        <div>
          <div class="group-title"><span class="dot ${quadrant.tone}"></span>${escapeHtml(quadrant.title)}</div>
          <p class="matrix-subtitle">${escapeHtml(quadrant.subtitle)}</p>
        </div>
        <div class="group-meta">${quadrant.tasks.length} 项</div>
      </div>
      <div class="task-list">
        ${sortTasks(quadrant.tasks).map(taskRow).join('') || emptyCompact('这里没有任务')}
      </div>
    </section>
  `;
}
```

**Step 3: Add matrix CSS**

Add near `.task-board`:

```css
.matrix-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  align-items: start;
}

.matrix-quadrant {
  min-height: 280px;
}

.matrix-subtitle {
  margin-top: 3px;
  color: var(--muted);
  font-size: 12px;
}
```

Add mobile adjustment:

```css
@media (max-width: 760px) {
  .matrix-grid { grid-template-columns: 1fr; }
}
```

**Step 4: Verify manually**

Run:

```bash
npm test
node --check public/assets/app.js
PORT=38887 npm run dev
```

Open `http://localhost:38887/#/matrix`.

Expected:
- Four quadrants render in a two-column grid on desktop.
- Mobile collapses to one column.
- Tasks move quadrants when priority or urgent state changes.

**Step 5: Commit**

```bash
git add public/assets/app.js public/assets/app.css
git commit -m "feat: add four quadrant task view"
```

---

### Task 5: Add Urgent Controls To Rows, Drawer, And Task Modal

**Files:**
- Modify: `public/assets/app.js:492-517`
- Modify: `public/assets/app.js:953-1026`
- Modify: `public/assets/app.js:1109-1156`
- Modify: `public/assets/app.js:1177-1186`
- Modify: `public/assets/app.css:414-451`

**Step 1: Add row metadata**

In `taskRow(task)`, add this meta chip after the reminder chip:

```js
${task.urgent ? '<span class="mini-tag urgent">紧急</span>' : ''}
```

Also change the action area:

```js
<span class="tiny-action" data-action="toggle-urgent" data-id="${task.id}">${task.urgent ? '取消紧急' : '标紧急'}</span>
```

**Step 2: Add drawer control**

In the drawer property grid after priority:

```js
<label class="property">
  <span class="property-label">紧急</span>
  <span class="property-value">
    <button class="switch ${task.urgent ? 'on' : ''}" type="button" data-action="toggle-urgent" data-id="${task.id}" aria-label="${task.urgent ? '取消紧急' : '标记紧急'}"></button>
    ${task.urgent ? '紧急' : '不紧急'}
  </span>
</label>
```

**Step 3: Add create modal urgent control**

In `taskModal()`, add before hidden inputs:

```js
<label class="check-field">
  <input type="checkbox" name="urgent" value="true" />
  <span>标记为紧急</span>
</label>
```

In `handleSubmit()` task payload:

```js
urgent: formData.get('urgent') === 'true',
```

**Step 4: Add action handler**

In `handleAction()` after `cycle-priority`:

```js
if (action === 'toggle-urgent') {
  const task = taskById(payload.id);
  if (task) await updateTask(task.id, { urgent: !task.urgent });
  return;
}
```

**Step 5: Add CSS**

```css
.mini-tag.urgent {
  color: var(--danger);
  background: color-mix(in oklch, var(--danger) 12%, transparent);
}

.check-field {
  min-height: 42px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in oklch, var(--bg) 35%, var(--surface));
  color: var(--fg);
}
```

**Step 6: Verify**

Run:

```bash
npm test
node --check public/assets/app.js
```

Manual:
- Create a task with `标记为紧急`.
- Select it in the drawer.
- Toggle urgent off and on.
- Confirm it moves between matrix quadrants.

**Step 7: Commit**

```bash
git add public/assets/app.js public/assets/app.css
git commit -m "feat: expose urgent task controls"
```

---

### Task 6: Replace Raw Tag Multi-Select With Chip Picker

**Files:**
- Modify: `public/assets/app.js:108-123`
- Modify: `public/assets/app.js:953-1026`
- Modify: `public/assets/app.js:1177-1186`
- Modify: `public/assets/app.css:489-528`

**Step 1: Add tag picker helpers**

Add near `taskRow()`:

```js
function tagPicker(selectedIds = [], { mode = 'form', taskId = '' } = {}) {
  const selected = new Set(selectedIds);
  if (!state.data.tags.length) {
    return '<p class="page-subtitle" style="margin:0;">还没有标签。</p>';
  }
  return `
    <div class="tag-picker" data-tag-picker="${mode}">
      ${state.data.tags.map(tag => {
        const active = selected.has(tag.id);
        if (mode === 'drawer') {
          return `<button class="tag-choice ${active ? 'active' : ''}" type="button" data-action="toggle-task-tag" data-task-id="${taskId}" data-tag-id="${tag.id}"><span class="project-dot ${tag.color || ''}"></span>#${escapeHtml(tag.name)}</button>`;
        }
        return `<label class="tag-choice ${active ? 'active' : ''}"><input type="checkbox" name="tags" value="${tag.id}" ${active ? 'checked' : ''} /><span class="project-dot ${tag.color || ''}"></span>#${escapeHtml(tag.name)}</label>`;
      }).join('')}
    </div>
  `;
}
```

**Step 2: Use tag picker in drawer**

Replace the `标签` property raw `<select multiple data-drawer-tags>` with:

```js
<label class="property tag-property">
  <span class="property-label">标签</span>
  <span class="property-value">${tagPicker(task.tags || [], { mode: 'drawer', taskId: task.id })}</span>
</label>
```

Remove the old `change` event branch:

```js
if (target.matches('[data-drawer-tags]')) {
  const tags = [...target.selectedOptions].map(option => option.value);
  updateTask(state.selectedTaskId, { tags });
}
```

**Step 3: Add tag action handler**

Add in `handleAction()`:

```js
if (action === 'toggle-task-tag') return toggleTaskTag(payload.taskId, payload.tagId);
```

Add helper near `cyclePriority()`:

```js
async function toggleTaskTag(taskId, tagId) {
  const task = taskById(taskId);
  if (!task || !tagId) return;
  const current = new Set(task.tags || []);
  if (current.has(tagId)) current.delete(tagId);
  else current.add(tagId);
  await updateTask(taskId, { tags: [...current] });
}
```

**Step 4: Use tag picker in task modal**

In `taskModal()`, add after priority:

```js
<div class="field"><label>标签</label>${tagPicker(defaults.tagId ? [defaults.tagId] : [], { mode: 'form' })}</div>
```

Update task payload:

```js
const selectedTags = formData.getAll('tags');
const tagId = formData.get('tagId');
const payload = {
  title: formData.get('title'),
  projectId: formData.get('projectId') || null,
  sectionId: formData.get('sectionId') || null,
  dueDate: formData.get('dueDate') || null,
  priority: formData.get('priority') || 'none',
  urgent: formData.get('urgent') === 'true',
  tags: [...new Set([...selectedTags, ...(tagId ? [tagId] : [])])]
};
```

**Step 5: Add CSS**

```css
.tag-property {
  align-items: start;
  padding-top: 10px;
  padding-bottom: 10px;
}

.tag-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-choice {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  padding: 0 10px;
  font-size: 13px;
}

.tag-choice input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.tag-choice.active,
.tag-choice:has(input:checked) {
  color: var(--fg);
  border-color: color-mix(in oklch, var(--accent) 34%, var(--border));
  background: var(--accent-quiet);
}
```

**Step 6: Verify**

Run:

```bash
npm test
node --check public/assets/app.js
```

Manual:
- Open a task with existing tags; chips show active states.
- Toggle tags in drawer; tags persist.
- Create a task with multiple tags from the modal.

**Step 7: Commit**

```bash
git add public/assets/app.js public/assets/app.css
git commit -m "feat: improve task tag picker"
```

---

### Task 7: Polish Dropdowns And Forms

**Files:**
- Modify: `public/assets/app.js:953-1071`
- Modify: `public/assets/app.css:302-333`
- Modify: `public/assets/app.css:489-528`
- Modify: `public/assets/app.css:723-754`

**Step 1: Add select helper**

Add near `tagPicker()`:

```js
function selectControl(attrs, optionsHtml) {
  return `<span class="select-wrap"><select class="select" ${attrs}>${optionsHtml}</select></span>`;
}
```

**Step 2: Replace visible selects with wrapped selects**

Examples:

```js
${selectControl('data-drawer-select="projectId"', `<option value="">收件箱</option>${state.data.projects.map(item => `<option value="${item.id}" ${item.id === task.projectId ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}`)}
```

```js
${selectControl('name="priority"', '<option value="none">普通</option><option value="low">低</option><option value="medium">中</option><option value="high">高</option>')}
```

Apply this to:
- Drawer project select
- Drawer section select
- Drawer priority select
- Drawer recurrence select
- Task modal project select
- Task modal priority select
- Tag modal color select
- Filter modal field select
- Settings default reminder select

**Step 3: Remove raw inline dialog styles where possible**

Replace inline dialog headings:

```js
<div class="dialog-head"><h2 class="dialog-title">${escapeHtml(title)}</h2><button class="icon-btn" type="button" data-action="close-modals">×</button></div>
```

Use `.dialog-title` in command modal too.

**Step 4: Add CSS**

```css
.select-wrap {
  position: relative;
  display: block;
  width: 100%;
}

.select-wrap::after {
  content: "";
  position: absolute;
  right: 13px;
  top: 50%;
  width: 8px;
  height: 8px;
  border-right: 1.5px solid var(--muted);
  border-bottom: 1.5px solid var(--muted);
  transform: translateY(-65%) rotate(45deg);
  pointer-events: none;
}

.select {
  appearance: none;
  padding-right: 34px;
}

.input:hover,
.textarea:hover,
.select:hover {
  border-color: color-mix(in oklch, var(--accent) 28%, var(--border));
}

.dialog-title {
  font-size: 24px;
  line-height: 1.15;
}

.dialog-body {
  gap: 16px;
}

.field {
  gap: 8px;
}

.field label {
  font-weight: 650;
}
```

**Step 5: Verify**

Run:

```bash
npm test
node --check public/assets/app.js
```

Manual:
- Open task modal, project modal, tag modal, filter modal, settings notification panel, and drawer.
- Confirm all selects have consistent arrow, focus ring, and dark-mode colors.

**Step 6: Commit**

```bash
git add public/assets/app.js public/assets/app.css
git commit -m "style: polish forms and dropdowns"
```

---

### Task 8: Make Checklist Items Wrap And Preserve Line Breaks

**Files:**
- Modify: `public/assets/app.js:98-112`
- Modify: `public/assets/app.js:980-988`
- Modify: `public/assets/app.js:1308-1324`
- Modify: `public/assets/app.css:587-594`

**Step 1: Add autosize hook**

In the document `input` listener, add:

```js
if (target.matches('[data-autosize]')) {
  autosizeTextarea(target);
}
```

After `render()` calls `syncToast();`, add:

```js
autosizeTextareas();
```

Add helper functions near `syncToast()`:

```js
function autosizeTextareas() {
  document.querySelectorAll('[data-autosize]').forEach(autosizeTextarea);
}

function autosizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}
```

**Step 2: Replace checklist text input with textarea**

In `drawer(task)`, replace:

```js
<input type="text" value="${escapeHtml(subtask.title)}" data-subtask-title data-task-id="${task.id}" data-subtask-id="${subtask.id}" />
```

with:

```js
<textarea class="subtask-title" rows="1" data-autosize data-subtask-title data-task-id="${task.id}" data-subtask-id="${subtask.id}">${escapeHtml(subtask.title)}</textarea>
```

**Step 3: Add prompt helper text for multiline checklist input**

Change `addSubtask()` prompt text:

```js
const title = prompt('子任务标题，可以粘贴多行内容');
```

**Step 4: Add CSS**

```css
.subtask {
  grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: start;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in oklch, var(--bg) 35%, var(--surface));
}

.subtask input[type="checkbox"] {
  margin-top: 8px;
}

.subtask-title {
  width: 100%;
  min-height: 32px;
  border: 0;
  background: transparent;
  color: var(--fg);
  outline: 0;
  resize: none;
  overflow: hidden;
  line-height: 1.45;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
```

Remove or replace the old `.subtask input[type="text"]` rule.

**Step 5: Verify**

Run:

```bash
npm test
node --check public/assets/app.js
```

Manual:
- Add or edit a checklist item with a long sentence.
- Paste a multiline checklist title.
- Confirm full content is visible and row height expands.

**Step 6: Commit**

```bash
git add public/assets/app.js public/assets/app.css
git commit -m "fix: show full checklist item text"
```

---

### Task 9: Fix Calendar Dark Mode Readability And Wrapping

**Files:**
- Modify: `public/assets/app.js:595-613`
- Modify: `public/assets/app.css:627-663`

**Step 1: Use full calendar pill markup in month cells**

In `calendarMonthCell(day)`, replace the inline month pill markup:

```js
${visible.map(task => `<button class="calendar-pill" type="button" draggable="true" data-task-id="${task.id}" data-action="select-task"><strong>${escapeHtml(task.title)}</strong></button>`).join('')}
```

with:

```js
${visible.map(calendarPill).join('')}
```

**Step 2: Add CSS for readable calendar pills**

Replace `.calendar-pill` and `.calendar-pill strong` rules:

```css
.calendar-pill {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: color-mix(in oklch, var(--surface) 92%, var(--bg));
  color: var(--fg);
  padding: 8px;
  font-size: 13px;
  display: grid;
  gap: 4px;
  text-align: left;
}

.calendar-pill strong {
  color: var(--fg);
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
  overflow-wrap: anywhere;
  line-height: 1.35;
}

.calendar-pill .task-meta {
  color: var(--muted);
}

:root[data-theme="dark"] .calendar-pill {
  background: color-mix(in oklch, var(--surface-2) 86%, black);
  color: var(--fg);
}
```

**Step 3: Verify**

Run:

```bash
npm test
node --check public/assets/app.js
PORT=38887 npm run dev
```

Manual:
- Open `http://localhost:38887/#/settings`.
- Set theme to `深色`.
- Open `http://localhost:38887/#/calendar`.
- Check week and month modes.
- Confirm calendar task titles are readable and wrap.

**Step 4: Commit**

```bash
git add public/assets/app.js public/assets/app.css
git commit -m "fix: improve dark calendar readability"
```

---

### Task 10: Final Documentation And Regression Pass

**Files:**
- Modify: `README.md:57-67`

**Step 1: Update implemented scope**

Update `README.md` implemented scope bullets:

```md
- Workspace views: Today, Inbox, Upcoming, Recent 7 Days, Calendar, Matrix, Projects, Tags, Smart Filters, Completed, Settings
- Task create/edit/complete/delete with priority, urgent marker, tags, due dates, reminders, recurrence, checklist subtasks, markdown notes, and attachments
```

**Step 2: Run automated checks**

Run:

```bash
npm test
node --check public/assets/app.js
node --check server.js
node --check src/storage.js
```

Expected: all pass.

**Step 3: Run browser smoke test**

Run:

```bash
PORT=38887 npm run dev
```

Open these URLs:

```text
http://localhost:38887/#/today
http://localhost:38887/#/recent
http://localhost:38887/#/matrix
http://localhost:38887/#/calendar
http://localhost:38887/#/settings
```

Check:
- Login still works.
- New task modal is polished.
- Drawer fields are polished.
- Tag chips work in modal and drawer.
- Dropdowns look consistent in light and dark modes.
- Checklist items wrap.
- Calendar task text is readable in dark mode.
- Matrix and Recent views are responsive on narrow widths.

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document task view upgrades"
```

---

## Rollback Notes

- If urgent field causes imported old data issues, verify `normalizeTask()` defaults `urgent` to `false`; no migration file should be needed.
- If CSS `:has()` support is a concern, replace `.tag-choice:has(input:checked)` with a render-time `active` class only and add a tiny `change` listener to re-render modal chip state if needed.
- If Recent 7 Days semantics are challenged, isolate the behavior in `taskRecentDate(task)` so the date rule can change without touching page rendering.

## Final Deliverable

After all tasks are complete, provide:

- Summary of changed files.
- Confirmation that `npm test` and `node --check` commands passed.
- Browser smoke-test notes for light and dark mode.
- Any known limitations, especially that Matrix importance currently derives from existing priority rather than a separate importance field.
