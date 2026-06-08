import { getRecentWindowDays, getTaskDateStatus, shouldShowInRecentView } from './task-date.js';

const app = document.querySelector('#app');
const state = {
  data: null,
  route: parseRoute(),
  selectedTaskId: null,
  commandOpen: false,
  taskModalOpen: false,
  projectModalOpen: false,
  tagModalOpen: false,
  filterModalOpen: false,
  filterEditingId: null,
  importPreview: null,
  taskModalDefaults: {},
  saveTimer: null,
  saveState: '已保存',
  calendarMode: 'week',
  settingsPanel: 'account',
  toastTimer: null,
  deferredInstallPrompt: null
};

const navItems = [
  { id: 'today', label: '今日', icon: '☑', mobile: true },
  { id: 'inbox', label: '收件箱', icon: '▣', mobile: true },
  { id: 'upcoming', label: '即将到来', icon: '◷' },
  { id: 'recent', label: '最近7天', icon: '↺', mobile: true, mobileLabel: '近7天' },
  { id: 'calendar', label: '日历', icon: '▦', mobile: true },
  { id: 'matrix', label: '四象限', icon: '⊞', mobile: true },
  { id: 'projects', label: '项目', icon: '●', mobile: true },
  { id: 'tags', label: '标签', icon: '#'},
  { id: 'filters', label: '智能过滤器', icon: '⚑'},
  { id: 'completed', label: '已完成', icon: '✓'},
  { id: 'settings', label: '设置', icon: '⚙', mobile: true, mobileLabel: '更多' }
];

const routeTitles = {
  today: ['TODAY · 今日执行', '今日'],
  inbox: ['INBOX · 默认捕获容器', '收件箱'],
  upcoming: ['UPCOMING · 轻量计划', '即将到来'],
  recent: ['RECENT · 最近7天', '最近7天'],
  calendar: ['CALENDAR · 日期分布', '日历'],
  matrix: ['MATRIX · 重要紧急', '四象限'],
  projects: ['PROJECTS · 任务组织', '项目'],
  project: ['PROJECT · 项目详情', '项目详情'],
  tags: ['TAGS · 横向组织', '标签'],
  tag: ['TAG · 标签详情', '标签详情'],
  filters: ['FILTERS · 保存视图', '智能过滤器'],
  filter: ['FILTER · 过滤结果', '智能过滤器'],
  completed: ['COMPLETED · 完成记录', '已完成'],
  settings: ['SETTINGS · 单用户配置', '设置']
};

window.addEventListener('hashchange', () => {
  state.route = parseRoute();
  state.commandOpen = false;
  render();
});

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  state.deferredInstallPrompt = event;
  if (state.data && !state.data.settings.pwaInstallDismissed) {
    showToast('可以安装为 PWA');
    render();
  }
});

document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    state.commandOpen = true;
    render();
  }
  if (event.key === 'Escape') {
    state.commandOpen = false;
    state.taskModalOpen = false;
    state.projectModalOpen = false;
    state.tagModalOpen = false;
    state.filterModalOpen = false;
    closeDrawer();
    render();
  }
});

document.addEventListener('click', event => {
  const formTagPicker = event.target.closest('[data-tag-picker="form"]');
  if (formTagPicker) requestAnimationFrame(() => syncTagPickerState(formTagPicker));
  const actionTarget = event.target.closest('[data-action]');
  if (!actionTarget) return;
  const action = actionTarget.dataset.action;
  const payload = actionTarget.dataset;
  event.preventDefault();
  handleAction(action, payload, actionTarget);
});

document.addEventListener('submit', event => {
  const form = event.target;
  const action = form.dataset.submit;
  if (!action) return;
  event.preventDefault();
  handleSubmit(action, form);
});

document.addEventListener('input', event => {
  const target = event.target;
  if (target.matches('[data-drawer-field]')) {
    updateSelectedTaskDraft(target.dataset.drawerField, target.value);
  }
  if (target.matches('[data-command-input]')) {
    renderCommandResults(target.value);
  }
  if (target.matches('[data-autosize]')) {
    autosizeTextarea(target);
  }
});

document.addEventListener('change', event => {
  const target = event.target;
  if (target.matches('[data-task-date-input]')) {
    setTaskDate(target.dataset.taskId, target.value, target);
  }
  if (target.matches('[data-task-reminder-time]')) {
    setTaskReminder(target.dataset.taskId, target.value);
  }
  if (target.matches('[data-form-date-input]')) {
    setFormDate(target.closest('form'), target.value);
  }
  if (target.matches('[data-form-reminder-time]')) {
    setFormReminder(target.closest('form'), target.value);
  }
  if (target.matches('[data-subtask-title]')) {
    updateSubtaskTitle(target.dataset.taskId, target.dataset.subtaskId, target.value);
  }
  if (target.matches('[data-drawer-select]')) {
    if (target.dataset.drawerSelect === 'projectId') {
      updateTask(state.selectedTaskId, { projectId: target.value || null, sectionId: null });
    } else {
      updateTask(state.selectedTaskId, { [target.dataset.drawerSelect]: target.value || null });
    }
  }
  if (target.matches('[data-setting-select]')) {
    updateSettings({ [target.dataset.settingSelect]: target.value });
  }
  const formTagPicker = target.closest('[data-tag-picker="form"]');
  if (formTagPicker && target.matches('input[name="tags"]')) {
    syncTagPickerState(formTagPicker);
  }
  if (target.matches('[data-file-upload]')) {
    uploadAttachment(target.dataset.taskId, target.files);
  }
  if (target.matches('[data-import-file]')) {
    previewImport(target.files?.[0]);
  }
  if (target.matches('[data-attachment-zip]')) {
    importAttachmentZip(target.files?.[0]);
  }
});

document.addEventListener('dragstart', event => {
  const row = event.target.closest('[data-task-id]');
  if (!row) return;
  event.dataTransfer?.setData('text/task-id', row.dataset.taskId);
});

document.addEventListener('dragover', event => {
  const zone = event.target.closest('[data-drop-date], [data-drop-section]');
  if (!zone) return;
  event.preventDefault();
  zone.classList.add('drag-over');
});

document.addEventListener('dragleave', event => {
  event.target.closest('[data-drop-date], [data-drop-section]')?.classList.remove('drag-over');
});

document.addEventListener('drop', event => {
  const zone = event.target.closest('[data-drop-date], [data-drop-section]');
  if (!zone) return;
  event.preventDefault();
  zone.classList.remove('drag-over');
  const taskId = event.dataTransfer?.getData('text/task-id');
  if (!taskId) return;
  if (zone.dataset.dropDate !== undefined) updateTask(taskId, { dueDate: zone.dataset.dropDate || null });
  if (zone.dataset.dropSection !== undefined) {
    updateTask(taskId, {
      projectId: zone.dataset.dropProject || null,
      sectionId: zone.dataset.dropSection || null
    });
  }
});

init();

async function init() {
  applyTheme('system');
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  try {
    await loadData();
    render();
  } catch (error) {
    renderLogin(error);
  }
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  let body = options.body;
  if (body && !(body instanceof FormData) && !(body instanceof Blob)) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }
  const response = await fetch(path, {
    ...options,
    headers,
    body,
    credentials: 'same-origin'
  });
  if (response.status === 401) {
    state.data = null;
    renderLogin();
    throw new Error('unauthorized');
  }
  if (!response.ok) {
    let detail = {};
    try { detail = await response.json(); } catch {}
    const error = new Error(detail.error || response.statusText || 'request_failed');
    error.status = response.status;
    throw error;
  }
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json();
  return response;
}

async function loadData() {
  state.data = await api('/api/data');
  if (!state.selectedTaskId) {
    const first = openTasks().find(task => task.dueDate === todayISO()) || openTasks()[0];
    state.selectedTaskId = first?.id || null;
  }
  applyTheme(state.data.settings.theme);
  return state.data;
}

async function refreshFromPayload(payload) {
  if (payload?.data) state.data = payload.data;
  else await loadData();
  applyTheme(state.data.settings.theme);
  render();
}

function parseRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [name = 'today', id = null] = hash.split('/');
  return { name: name || 'today', id };
}

function navigate(route) {
  location.hash = `#/${route}`;
}

function render() {
  if (!state.data) {
    renderLogin();
    return;
  }

  const selectedTask = taskById(state.selectedTaskId);
  const hasDrawer = Boolean(selectedTask);
  app.className = '';
  app.innerHTML = `
    ${mobileTopbar()}
    <main class="app-shell ${hasDrawer ? 'has-drawer' : ''}">
      ${sidebar()}
      <section class="main-pane">${mainView()}</section>
      ${hasDrawer ? drawer(selectedTask) : ''}
    </main>
    ${mobileBottom()}
    <button class="fab" type="button" data-action="open-task-modal">+</button>
    ${taskModal()}
    ${projectModal()}
    ${tagModal()}
    ${filterModal()}
    ${commandModal()}
    <div class="toast" data-toast></div>
  `;
  syncToast();
  autosizeTextareas();
}

function renderLogin(error) {
  app.className = 'login-screen';
  app.innerHTML = `
    <form class="login-card" data-submit="login">
      <div class="login-title">
        <div class="brand-mark">✓</div>
        <h1>My Tasks</h1>
        <p>Private task workspace</p>
      </div>
      <div class="field">
        <label>账号</label>
        <input class="input" name="username" value="self-hosted-user" autocomplete="username" />
      </div>
      <div class="field">
        <label>密码</label>
        <input class="input" name="password" type="password" autocomplete="current-password" required autofocus />
      </div>
      <p class="page-subtitle" style="margin:0;">首次启动默认密码是 <strong>todo123456</strong>。部署时请用 <code>TODO_PASSWORD</code> 环境变量覆盖，或登录后在设置中修改。</p>
      ${error ? `<p class="chip danger">${escapeHtml(error.message === 'unauthorized' ? '请先登录' : '服务器连接失败')}</p>` : ''}
      <button class="primary-add" type="submit">登录</button>
      <a class="quiet-button" href="/prototype/index.html">查看原型设计稿</a>
    </form>
  `;
}

function mobileTopbar() {
  const [, title] = routeMeta();
  return `
    <div class="mobile-topbar">
      <div class="brand-row" style="padding:0;">
        <div class="brand-mark">${routeIcon()}</div>
        <div class="brand-copy"><strong>${escapeHtml(title)}</strong><span>${openTasks().length} 项未完成</span></div>
      </div>
      <button class="icon-btn" type="button" data-action="open-command">⌘</button>
    </div>
  `;
}

function sidebar() {
  const counts = sidebarCounts();
  const projects = activeProjects().slice(0, 5);
  const pinnedFilters = state.data.filters.filter(filter => filter.pinned).slice(0, 4);
  return `
    <aside class="sidebar">
      <div class="brand-row">
        <div class="brand-mark">✓</div>
        <div class="brand-copy"><strong>个人 TODO</strong><span>自托管工作台</span></div>
      </div>
      <button class="primary-add" type="button" data-action="open-task-modal">+ 新建任务</button>
      <nav class="nav-block" aria-label="主要视图">
        <div class="nav-heading">主要视图</div>
        ${navItems.slice(0, 6).map(item => navButton(item, counts[item.id])).join('')}
      </nav>
      <nav class="nav-block" aria-label="组织">
        <div class="nav-heading">组织</div>
        ${navButton(navItems.find(item => item.id === 'tags'), counts.tags)}
        ${navButton(navItems.find(item => item.id === 'filters'), counts.filters)}
        ${navButton(navItems.find(item => item.id === 'completed'), counts.completed)}
      </nav>
      <nav class="nav-block" aria-label="项目">
        <div class="nav-heading">项目</div>
        ${projects.map(project => `
          <button class="nav-item ${state.route.name === 'project' && state.route.id === project.id ? 'active' : ''}" type="button" data-action="navigate" data-route="project/${project.id}">
            <span class="project-dot ${project.color || ''}"></span><span>${escapeHtml(project.name)}</span><span class="nav-count">${countOpenByProject(project.id)}</span>
          </button>
        `).join('')}
      </nav>
      <div class="sidebar-bottom">
        ${pinnedFilters.map(filter => `
          <button class="nav-item ${state.route.name === 'filter' && state.route.id === filter.id ? 'active' : ''}" type="button" data-action="navigate" data-route="filter/${filter.id}">
            <span>⚑</span><span>${escapeHtml(filter.name)}</span><span class="nav-count">${filterTasks(filter).length}</span>
          </button>
        `).join('')}
        ${navButton(navItems.find(item => item.id === 'settings'), '')}
      </div>
    </aside>
  `;
}

function navButton(item, count) {
  const active = state.route.name === item.id || (item.id === 'projects' && state.route.name === 'project') || (item.id === 'tags' && state.route.name === 'tag') || (item.id === 'filters' && state.route.name === 'filter');
  return `
    <button class="nav-item ${active ? 'active' : ''}" type="button" data-action="navigate" data-route="${item.id}">
      <span>${item.icon}</span><span>${escapeHtml(item.label)}</span>${count === '' ? '<span></span>' : `<span class="nav-count">${count}</span>`}
    </button>
  `;
}

function mobileBottom() {
  return `
    <nav class="mobile-bottom" aria-label="移动端导航">
      ${navItems.filter(item => item.mobile).map(item => {
        const active = state.route.name === item.id || (item.id === 'projects' && state.route.name === 'project') || (item.id === 'settings' && ['settings', 'tags', 'filters', 'completed', 'tag', 'filter'].includes(state.route.name));
        return `<button class="${active ? 'active' : ''}" type="button" data-action="navigate" data-route="${item.id}">${escapeHtml(item.mobileLabel || item.label)}</button>`;
      }).join('')}
    </nav>
  `;
}

function mainView() {
  const route = state.route;
  if (route.name === 'today') return listPage({
    eyebrow: 'TODAY · 今日执行',
    title: '今日',
    subtitle: `${formatLongDate(todayISO())} · 今日承诺、逾期和提醒集中处理。`,
    stats: todayStats(),
    quickContext: { dueDate: todayISO() },
    placeholder: '添加一个今天要处理的任务',
    groups: [
      taskGroup('已逾期', openTasks().filter(task => task.dueDate && task.dueDate < todayISO()), 'danger'),
      taskGroup('今天', openTasks().filter(task => task.dueDate === todayISO()), 'success'),
      taskGroup('无提醒时间', openTasks().filter(task => task.dueDate === todayISO() && !task.reminderAt), 'muted'),
      taskGroup('今日已完成', completedTasks().filter(task => task.completedAt?.slice(0, 10) === todayISO()), 'muted')
    ]
  });
  if (route.name === 'inbox') return listPage({
    eyebrow: 'INBOX · 默认捕获容器',
    title: '收件箱',
    subtitle: '没有指定项目的新任务会先进入这里。这个页面重点支持整理，而不是长期囤积。',
    stats: inboxStats(),
    quickContext: { projectId: null, dueDate: null },
    placeholder: '快速记录一个想法，默认无项目、无日期',
    extraActions: '<button class="soft-button" type="button" data-action="bulk-hint">整理</button>',
    groups: [taskGroup('未整理', openTasks().filter(task => !task.projectId), 'success')]
  });
  if (route.name === 'upcoming') return upcomingPage();
  if (route.name === 'recent') return recentPage();
  if (route.name === 'calendar') return calendarPage();
  if (route.name === 'matrix') return matrixPage();
  if (route.name === 'projects') return projectsPage();
  if (route.name === 'project') return projectDetailPage(route.id);
  if (route.name === 'tags') return tagsPage();
  if (route.name === 'tag') return tagDetailPage(route.id);
  if (route.name === 'filters') return filtersPage();
  if (route.name === 'filter') return filterDetailPage(route.id);
  if (route.name === 'completed') return completedPage();
  if (route.name === 'settings') return settingsPage();
  return listPage({
    eyebrow: 'TODAY · 今日执行',
    title: '今日',
    subtitle: '默认视图。',
    stats: todayStats(),
    quickContext: { dueDate: todayISO() },
    placeholder: '添加任务',
    groups: [taskGroup('今天', openTasks().filter(task => task.dueDate === todayISO()), 'success')]
  });
}

function pageHeader({ eyebrow, title, subtitle, actions = '' }) {
  return `
    <header class="page-header">
      <div>
        <p class="eyebrow">${escapeHtml(eyebrow)}</p>
        <h1 class="page-title">${escapeHtml(title)}</h1>
        <p class="page-subtitle">${escapeHtml(subtitle)}</p>
      </div>
      <div class="header-actions">
        <button class="quiet-button" type="button" data-action="open-command">搜索 <span class="shortcut">⌘K</span></button>
        ${actions}
        <button class="soft-button" type="button" data-action="open-task-modal">新建任务</button>
      </div>
    </header>
  `;
}

function listPage(config) {
  return `
    ${pageHeader({
      eyebrow: config.eyebrow,
      title: config.title,
      subtitle: config.subtitle,
      actions: `${config.extraActions || ''}<button class="soft-button" type="button" data-action="sort-hint">排序</button>`
    })}
    ${stats(config.stats)}
    ${quickAdd(config.placeholder, config.quickContext)}
    <section class="task-board">
      ${config.groups.map(group => groupHtml(group)).join('')}
    </section>
  `;
}

function stats(items) {
  return `<div class="stat-strip">${items.map(item => `<article class="stat-card"><strong>${item.value}</strong><span>${escapeHtml(item.label)}</span></article>`).join('')}</div>`;
}

function quickAdd(placeholder, context = {}) {
  return `
    <form class="quick-add" data-submit="quick-task">
      <input name="title" autocomplete="off" placeholder="${escapeHtml(placeholder)}" />
      <input type="hidden" name="projectId" value="${context.projectId || ''}" />
      <input type="hidden" name="sectionId" value="${context.sectionId || ''}" />
      <input type="hidden" name="tagId" value="${context.tagId || ''}" />
      <span class="chip">${contextLabel(context)}</span>
      <button class="chip" type="button" data-action="open-project-menu">项目</button>
      <button class="soft-button mobile-visible" type="submit">添加</button>
      ${schedulePicker({ mode: 'form', defaults: { dueDate: context.dueDate || '', reminderAt: context.reminderAt || '' }, compact: true })}
    </form>
  `;
}

function groupHtml(group) {
  const dropAttrs = group.dropSectionId !== undefined
    ? ` data-drop-section="${group.dropSectionId || ''}" data-drop-project="${group.dropProjectId || ''}"`
    : '';
  const rows = group.tasks.map(taskRow).join('');
  return `
    <section class="group"${dropAttrs}>
      <div class="group-header">
        <div class="group-title"><span class="dot ${group.tone || ''}"></span>${escapeHtml(group.title)}</div>
        <div class="group-meta">${group.tasks.length} 项</div>
      </div>
      <div class="task-list">
        ${rows || emptyCompact(group.empty || '这里没有任务')}
      </div>
    </section>
  `;
}

function taskGroup(title, tasks, tone = '') {
  return { title, tasks: sortTasks(tasks), tone };
}

function taskRow(task) {
  const project = projectById(task.projectId);
  const tags = task.tags.map(tagById).filter(Boolean);
  const attachmentCount = task.attachments?.length || 0;
  const dateStatus = getTaskDateStatus(task, todayISO());
  return `
    <button class="task-row ${task.completed ? 'done' : ''} ${task.id === state.selectedTaskId ? 'selected' : ''}" type="button" draggable="true" data-task-id="${task.id}" data-action="select-task">
      <span class="check" data-action="toggle-task" data-id="${task.id}">✓</span>
      <span class="priority ${task.priority || 'none'}"></span>
      <span>
        <span class="task-title">${escapeHtml(task.title)}</span>
        <span class="task-meta">
          ${taskDateTag(task, dateStatus)}
          ${task.reminderAt ? `<span class="mini-tag">${escapeHtml(formatTime(task.reminderAt))}</span>` : ''}
          ${task.urgent ? '<span class="mini-tag urgent">紧急</span>' : ''}
          ${project ? `<span class="mini-tag">${escapeHtml(project.name)}</span>` : '<span class="mini-tag">收件箱</span>'}
          ${tags.map(tag => `<span class="mini-tag">#${escapeHtml(tag.name)}</span>`).join('')}
          ${attachmentCount ? `<span class="mini-tag">${attachmentCount} 个附件</span>` : ''}
          ${task.recurrence ? '<span class="mini-tag">重复</span>' : ''}
        </span>
      </span>
      <span class="task-actions">
        <span class="tiny-action" data-action="postpone-task" data-id="${task.id}">明天</span>
        <span class="tiny-action" data-action="toggle-urgent" data-id="${task.id}">${task.urgent ? '取消紧急' : '标紧急'}</span>
        <span class="tiny-action" data-action="cycle-priority" data-id="${task.id}">优先级</span>
      </span>
    </button>
  `;
}

function taskDateTag(task, status = getTaskDateStatus(task, todayISO())) {
  return `<span class="mini-tag task-date-tag ${status.tone}">${escapeHtml(taskDateLabel(task, status))}</span>`;
}

function taskDateLabel(task, status = getTaskDateStatus(task, todayISO())) {
  if (status.key === 'overdue') return `已过期 · ${shortDate(status.dueDate)}`;
  if (status.key === 'today') return '今天';
  if (status.key === 'future') return shortDate(status.dueDate);
  return '无日期';
}

function selectControl(attrs, optionsHtml, options = {}) {
  const classes = ['select-wrap', options.compact ? 'compact' : '', options.invalid ? 'invalid' : ''].filter(Boolean).join(' ');
  return `<span class="${classes}"><select class="select" ${attrs}>${optionsHtml}</select></span>${options.helper ? formHint(options.helper) : ''}`;
}

function formHint(text, tone = '') {
  return `<p class="form-hint ${tone ? `is-${tone}` : ''}">${escapeHtml(text)}</p>`;
}

function tagPicker(selectedIds = [], { mode = 'form', taskId = '' } = {}) {
  const selected = new Set(selectedIds);
  if (!state.data.tags.length) {
    return '<div class="empty-note compact">还没有标签。可以先在标签页创建。</div>';
  }
  const selectedCount = state.data.tags.filter(tag => selected.has(tag.id)).length;
  return `
    <div class="tag-picker-shell" data-tag-picker="${mode}">
      <div class="tag-picker">
        ${state.data.tags.map(tag => {
          const active = selected.has(tag.id);
          const name = escapeHtml(tag.name);
          if (mode === 'drawer') {
            return `<button class="tag-choice ${active ? 'active' : ''}" type="button" data-action="toggle-task-tag" data-task-id="${taskId}" data-tag-id="${tag.id}" aria-pressed="${active ? 'true' : 'false'}"><span class="project-dot ${tag.color || ''}"></span><span class="tag-name">#${name}</span></button>`;
          }
          return `<label class="tag-choice ${active ? 'active' : ''}"><input type="checkbox" name="tags" value="${tag.id}" ${active ? 'checked' : ''} /><span class="project-dot ${tag.color || ''}"></span><span class="tag-name">#${name}</span></label>`;
        }).join('')}
      </div>
      <p class="form-hint">${selectedCount ? `已选 ${selectedCount} 个标签` : '未选择标签'}</p>
    </div>
  `;
}

function schedulePicker({ mode = 'form', task = null, defaults = {}, compact = false } = {}) {
  const isTask = mode === 'task';
  const dueDate = isTask ? task?.dueDate || '' : defaults.dueDate || '';
  const reminderAt = isTask ? task?.reminderAt || '' : defaults.reminderAt || '';
  const taskId = task?.id || '';
  const selectedTime = localTimeValue(reminderAt);
  const reminderDate = localDateValue(reminderAt);
  const dateInputAttrs = isTask
    ? `data-task-date-input data-task-id="${taskId}"`
    : 'data-form-date-input';
  const timeInputAttrs = isTask
    ? `data-task-reminder-time data-task-id="${taskId}"`
    : 'data-form-reminder-time';
  const dateAction = isTask ? 'set-task-date' : 'set-form-date';
  const reminderAction = isTask ? 'set-task-reminder' : 'set-form-reminder';
  const taskIdAttr = isTask ? ` data-task-id="${taskId}"` : '';
  const hiddenInputs = isTask ? '' : `
    <input type="hidden" name="dueDate" value="${escapeHtml(dueDate)}" data-form-due-date />
    <input type="hidden" name="reminderAt" value="${escapeHtml(reminderAt)}" data-form-reminder-at />
  `;

  return `
    <div class="schedule-picker ${compact ? 'compact' : ''}" data-schedule-picker>
      ${hiddenInputs}
      <div class="schedule-summary" data-schedule-summary>
        <span>
          <strong>${escapeHtml(dueDate ? shortDate(dueDate) : '无日期')}</strong>
          <small>${escapeHtml(reminderAt ? `${formatTime(reminderAt)} 提醒` : '无提醒')}</small>
        </span>
      </div>
      <div class="schedule-row">
        <span class="schedule-label">日期</span>
        <div class="schedule-options">
          ${dateShortcutOptions().map(option => `
            <button class="schedule-option ${dueDate === option.value ? 'active' : ''}" type="button" data-action="${dateAction}" data-value="${option.value}"${taskIdAttr}>${escapeHtml(option.label)}</button>
          `).join('')}
          <input class="input schedule-custom-input" type="text" value="${escapeHtml(dateInputDisplayValue(dueDate))}" placeholder="24 / 6/24 / 2026-06-24" aria-label="自定义日期" ${dateInputAttrs} />
        </div>
      </div>
      <div class="schedule-row">
        <span class="schedule-label">提醒</span>
        <div class="schedule-options">
          ${reminderTimeOptions().map(option => {
            const active = option.value ? selectedTime === option.value && (!dueDate || reminderDate === dueDate) : !reminderAt;
            return `<button class="schedule-option ${active ? 'active' : ''}" type="button" data-action="${reminderAction}" data-time="${option.value}"${taskIdAttr}>${escapeHtml(option.label)}</button>`;
          }).join('')}
          <input class="input schedule-custom-input time" type="time" value="${escapeHtml(selectedTime)}" aria-label="自定义提醒时间" ${timeInputAttrs} />
        </div>
      </div>
    </div>
  `;
}

function syncTagPickerState(shell) {
  if (!shell) return;
  const choices = [...shell.querySelectorAll('.tag-choice')];
  const selectedCount = choices.reduce((count, choice) => {
    const checked = Boolean(choice.querySelector('input[name="tags"]')?.checked);
    choice.classList.toggle('active', checked);
    return checked ? count + 1 : count;
  }, 0);
  const hint = shell.querySelector('.form-hint');
  if (hint) hint.textContent = selectedCount ? `已选 ${selectedCount} 个标签` : '未选择标签';
}

function emptyCompact(text) {
  return `<div class="empty-state" style="margin:14px;"><h2>空</h2><p>${escapeHtml(text)}</p></div>`;
}

function upcomingPage() {
  const tasks = openTasks();
  const today = todayISO();
  return listPage({
    eyebrow: 'UPCOMING · 轻量计划',
    title: '即将到来',
    subtitle: '按日期分组查看未来任务，可拖拽到日历日期或用快捷按钮改期。',
    stats: [
      { value: tasks.filter(task => task.dueDate > today).length, label: '未来任务' },
      { value: tasks.filter(task => task.dueDate === todayISO(1)).length, label: '明天' },
      { value: tasks.filter(task => task.dueDate && task.dueDate > todayISO(1) && task.dueDate <= todayISO(7)).length, label: '本周以后' },
      { value: tasks.filter(task => !task.dueDate).length, label: '无日期' }
    ],
    placeholder: '添加一个未来任务',
    quickContext: { dueDate: todayISO(1) },
    groups: [
      taskGroup('明天', tasks.filter(task => task.dueDate === todayISO(1)), 'success'),
      taskGroup('本周', tasks.filter(task => task.dueDate && task.dueDate > todayISO(1) && task.dueDate <= todayISO(7)), 'warn'),
      taskGroup('下周', tasks.filter(task => task.dueDate && task.dueDate > todayISO(7) && task.dueDate <= todayISO(14)), ''),
      taskGroup('以后', tasks.filter(task => task.dueDate && task.dueDate > todayISO(14)), 'muted'),
      taskGroup('无日期', tasks.filter(task => !task.dueDate), 'muted')
    ]
  });
}

function recentPage() {
  const today = todayISO();
  const tasks = recentTasks(today);
  const recentDays = getRecentWindowDays(today);
  const groups = [
    taskGroup('已过期', tasks.filter(task => getTaskDateStatus(task, today).key === 'overdue'), 'danger'),
    taskGroup('今天', tasks.filter(task => task.dueDate === today), 'success'),
    ...recentDays.slice(1).map(day => taskGroup(shortDate(day), tasks.filter(task => task.dueDate === day), 'accent'))
  ].filter(group => group.tasks.length);

  return listPage({
    eyebrow: 'RECENT · 最近7天',
    title: '最近7天',
    subtitle: '显示所有逾期任务，以及今天起未来七天内的待办任务。',
    stats: [
      { value: tasks.length, label: '窗口任务' },
      { value: tasks.filter(task => getTaskDateStatus(task, today).key === 'overdue').length, label: '已逾期' },
      { value: tasks.filter(task => task.dueDate === today).length, label: '今天' },
      { value: tasks.filter(task => task.dueDate && task.dueDate > today).length, label: '未来' }
    ],
    placeholder: '添加一个今天要处理的任务',
    quickContext: { dueDate: today },
    groups
  });
}

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

function calendarPage() {
  const days = Array.from({ length: 7 }, (_, index) => todayISO(index - 2));
  const monthDays = monthGridDays();
  return `
    ${pageHeader({
      eyebrow: 'CALENDAR · 日期分布',
      title: '日历',
      subtitle: '日历只按截止日期展示任务。提醒时间作为辅助文字显示，不形成时间块。',
      actions: `
        <button class="quiet-button" type="button" data-action="calendar-today">今天</button>
        <div class="segmented">
          <button class="${state.calendarMode === 'week' ? 'active' : ''}" type="button" data-action="calendar-mode" data-mode="week">周</button>
          <button class="${state.calendarMode === 'month' ? 'active' : ''}" type="button" data-action="calendar-mode" data-mode="month">月</button>
        </div>
      `
    })}
    ${stats([
      { value: openTasks().filter(task => task.dueDate).length, label: '有日期任务' },
      { value: openTasks().filter(task => task.dueDate === todayISO()).length, label: '今天' },
      { value: openTasks().filter(task => task.reminderAt).length, label: '有提醒' },
      { value: openTasks().filter(task => task.recurrence).length, label: '重复任务' }
    ])}
    <section class="calendar-shell">
      ${state.calendarMode === 'week' ? `
        <div class="week-grid">
          ${days.map(day => calendarDayColumn(day)).join('')}
        </div>
      ` : `
        <div class="month-grid">
          ${monthDays.map(day => calendarMonthCell(day)).join('')}
        </div>
      `}
    </section>
  `;
}

function calendarDayColumn(day) {
  const tasks = sortTasks(openTasks().filter(task => task.dueDate === day));
  return `
    <article class="day-column ${day === todayISO() ? 'today' : ''}" data-drop-date="${day}">
      <div class="day-head"><strong>${escapeHtml(weekdayName(day))}</strong><span>${escapeHtml(shortDate(day))} · ${tasks.length}</span></div>
      ${tasks.map(calendarPill).join('')}
      <button class="tiny-action" type="button" data-action="open-task-modal" data-due-date="${day}">+ 在这天新建</button>
    </article>
  `;
}

function calendarMonthCell(day) {
  const tasks = sortTasks(openTasks().filter(task => task.dueDate === day));
  const visible = tasks.slice(0, 2);
  return `
    <article class="calendar-day ${day === todayISO() ? 'today' : ''}" data-drop-date="${day}">
      <div class="day-head"><strong>${Number(day.slice(8, 10))}</strong><span>${tasks.length}</span></div>
      ${visible.map(calendarPill).join('')}
      ${tasks.length > visible.length ? `<button class="tiny-action" type="button" data-action="filter-date" data-date="${day}">还有 ${tasks.length - visible.length} 项</button>` : ''}
    </article>
  `;
}

function calendarPill(task) {
  return `
    <button class="calendar-pill" type="button" draggable="true" data-task-id="${task.id}" data-action="select-task">
      <strong>${escapeHtml(task.title)}</strong>
      <span class="task-meta">${task.reminderAt ? `${escapeHtml(formatTime(task.reminderAt))} 提醒 · ` : ''}${escapeHtml(priorityLabel(task.priority))}</span>
    </button>
  `;
}

function projectsPage() {
  const projects = activeProjects();
  return `
    ${pageHeader({
      eyebrow: 'PROJECTS · 任务组织',
      title: '项目',
      subtitle: '项目是任务的主要容器。每个任务只能属于一个项目，可在项目内继续分章节整理。',
      actions: '<button class="soft-button" type="button" data-action="open-project-modal">新建项目</button><button class="quiet-button" type="button" data-action="show-archived">显示已归档</button>'
    })}
    <div class="project-grid">
      ${projects.map(projectCard).join('') || emptyCard('还没有项目', '创建一个项目后，就可以按章节组织任务。')}
    </div>
  `;
}

function projectCard(project) {
  const tasks = state.data.tasks.filter(task => task.projectId === project.id);
  const open = tasks.filter(task => !task.completed);
  const todayDue = open.filter(task => task.dueDate === todayISO()).length;
  const progress = tasks.length ? Math.round((tasks.filter(task => task.completed).length / tasks.length) * 100) : 0;
  return `
    <article class="project-card">
      <header><span class="chip strong"><span class="project-dot ${project.color || ''}"></span>${escapeHtml(project.name)}</span><span class="group-meta">${escapeHtml(relativeDate(project.updatedAt))}</span></header>
      <h2 style="font-size:32px;">${escapeHtml(project.name)}</h2>
      <p>${escapeHtml(project.description || '没有说明')}</p>
      ${statsInline([
        { value: open.length, label: '未完成' },
        { value: todayDue, label: '今天到期' },
        { value: project.sections.length, label: '章节' }
      ])}
      <div class="progress-track" style="--value:${progress}%;"><span></span></div>
      <footer class="header-actions" style="justify-content:space-between;">
        <button class="tiny-action" type="button" data-action="navigate" data-route="project/${project.id}">打开项目</button>
        <button class="tiny-action" type="button" data-action="archive-project" data-id="${project.id}">归档</button>
      </footer>
    </article>
  `;
}

function projectDetailPage(id) {
  const project = projectById(id) || activeProjects()[0];
  if (!project) return emptyFull('项目不存在', '可以先创建一个项目。');
  const groups = [
    ...project.sections.map(section => ({ ...taskGroup(section.name, openTasks().filter(task => task.projectId === project.id && task.sectionId === section.id), ''), dropProjectId: project.id, dropSectionId: section.id })),
    { ...taskGroup('无章节', openTasks().filter(task => task.projectId === project.id && !task.sectionId), 'muted'), dropProjectId: project.id, dropSectionId: '' }
  ];
  return `
    ${pageHeader({
      eyebrow: 'PROJECT · 项目详情',
      title: project.name,
      subtitle: project.description || '管理项目中的任务和章节。',
      actions: '<button class="soft-button" type="button" data-action="add-section" data-project-id="' + project.id + '">新建章节</button><button class="quiet-button danger-button" type="button" data-action="delete-project" data-id="' + project.id + '">删除项目</button>'
    })}
    ${quickAdd(`添加任务到 ${project.name}`, { projectId: project.id, sectionId: project.sections[0]?.id || '' })}
    <section class="task-board">
      ${groups.map(group => groupHtml({
        ...group,
        tasks: group.tasks.map(task => ({ ...task, dropProjectId: project.id })),
        empty: '这个章节是空的'
      })).join('')}
    </section>
  `;
}

function tagsPage() {
  return `
    ${pageHeader({
      eyebrow: 'TAGS · 横向组织',
      title: '标签',
      subtitle: '标签用于跨项目组织任务，颜色只用于小面积 chip，不喧宾夺主。',
      actions: '<button class="soft-button" type="button" data-action="open-tag-modal">新建标签</button>'
    })}
    <div class="tag-grid">
      ${state.data.tags.map(tag => `
        <article class="tag-card">
          <header><span class="chip strong">#${escapeHtml(tag.name)}</span><span class="project-dot ${tag.color || ''}"></span></header>
          <h2 style="font-size:28px;">${escapeHtml(tag.name)}</h2>
          <p>${tagTasks(tag.id).length} 个未完成任务使用这个标签。</p>
          <footer class="header-actions" style="justify-content:space-between;">
            <button class="tiny-action" type="button" data-action="navigate" data-route="tag/${tag.id}">打开标签</button>
            <button class="tiny-action" type="button" data-action="delete-tag" data-id="${tag.id}">删除</button>
          </footer>
        </article>
      `).join('') || emptyCard('还没有标签', '创建标签后可用于智能过滤器。')}
    </div>
  `;
}

function tagDetailPage(id) {
  const tag = tagById(id) || state.data.tags[0];
  if (!tag) return emptyFull('标签不存在', '可以先创建一个标签。');
  return listPage({
    eyebrow: 'TAG · 标签详情',
    title: `#${tag.name}`,
    subtitle: `${tagTasks(tag.id).length} 项任务匹配这个标签。`,
    stats: [
      { value: tagTasks(tag.id).length, label: '未完成' },
      { value: completedTasks().filter(task => task.tags.includes(tag.id)).length, label: '已完成' },
      { value: tagTasks(tag.id).filter(task => task.dueDate === todayISO()).length, label: '今天' },
      { value: tagTasks(tag.id).filter(task => task.priority === 'high').length, label: '高优先级' }
    ],
    placeholder: `添加带 #${tag.name} 标签的任务`,
    quickContext: { tagId: tag.id },
    groups: [taskGroup(`#${tag.name}`, tagTasks(tag.id), 'success')]
  });
}

function filtersPage() {
  return `
    ${pageHeader({
      eyebrow: 'FILTERS · 保存视图',
      title: '智能过滤器',
      subtitle: '保存常用筛选条件，快速切换工作视图。第一版使用友好的条件构建器，不暴露查询语言。',
      actions: '<button class="soft-button" type="button" data-action="open-filter-modal">新建过滤器</button>'
    })}
    <div class="filter-grid">
      ${state.data.filters.map(filter => `
        <article class="filter-card">
          <header><span class="chip strong">⚑ ${escapeHtml(filter.name)}</span><span class="group-meta">${filterTasks(filter).length} 项</span></header>
          <h2 style="font-size:28px;">${escapeHtml(filter.name)}</h2>
          <p>${escapeHtml(filterSummary(filter))}</p>
          <footer class="header-actions" style="justify-content:space-between;">
            <button class="tiny-action" type="button" data-action="navigate" data-route="filter/${filter.id}">打开</button>
            <button class="tiny-action" type="button" data-action="duplicate-filter" data-id="${filter.id}">复制</button>
            <button class="tiny-action" type="button" data-action="delete-filter" data-id="${filter.id}">删除</button>
          </footer>
        </article>
      `).join('') || emptyCard('还没有智能过滤器', '保存条件后就能快速打开常用任务视图。')}
    </div>
  `;
}

function filterDetailPage(id) {
  const filter = state.data.filters.find(item => item.id === id) || state.data.filters[0];
  if (!filter) return emptyFull('过滤器不存在', '可以先创建一个过滤器。');
  return listPage({
    eyebrow: 'FILTER · 过滤结果',
    title: filter.name,
    subtitle: filterSummary(filter),
    stats: [
      { value: filterTasks(filter).length, label: '匹配任务' },
      { value: filter.conditions.length, label: '条件' },
      { value: sortLabel(filter.sort), label: '排序' },
      { value: groupLabel(filter.group), label: '分组' }
    ],
    quickContext: {},
    placeholder: '添加任务',
    extraActions: `<button class="soft-button" type="button" data-action="edit-filter" data-id="${filter.id}">编辑过滤器</button>`,
    groups: groupedFilterTasks(filter)
  });
}

function completedPage() {
  const completed = completedTasks();
  return listPage({
    eyebrow: 'COMPLETED · 完成记录',
    title: '已完成',
    subtitle: '查看和恢复已完成任务。恢复后任务回到原项目和原日期。',
    stats: [
      { value: completed.length, label: '已完成总数' },
      { value: completed.filter(task => task.completedAt?.slice(0, 10) === todayISO()).length, label: '今天完成' },
      { value: completed.filter(task => task.completedAt?.slice(0, 10) >= todayISO(-7)).length, label: '本周完成' },
      { value: completed.filter(task => task.attachments?.length).length, label: '含附件' }
    ],
    placeholder: '添加任务',
    groups: [
      taskGroup('今天', completed.filter(task => task.completedAt?.slice(0, 10) === todayISO()), 'success'),
      taskGroup('本周', completed.filter(task => task.completedAt?.slice(0, 10) >= todayISO(-7) && task.completedAt?.slice(0, 10) !== todayISO()), ''),
      taskGroup('更早', completed.filter(task => task.completedAt?.slice(0, 10) < todayISO(-7)), 'muted')
    ]
  });
}

function settingsPage() {
  const settings = state.data.settings;
  const attachmentStats = allAttachments();
  return `
    ${pageHeader({
      eyebrow: 'SETTINGS · 单用户配置',
      title: '设置',
      subtitle: '集中管理账号安全、外观、通知、数据导入导出和附件恢复。危险操作保留确认。',
      actions: '<button class="quiet-button danger-button" type="button" data-action="logout">退出登录</button>'
    })}
    <section class="settings-grid">
      ${settingsCard('account', '账号与安全', '当前会话有效', '当前账号、修改密码、会话信息和退出登录确认。')}
      ${settingsCard('appearance', '外观', themeLabel(settings.theme), '主题模式、界面密度和侧边栏显示偏好，设置即时生效。')}
      ${settingsCard('notifications', '通知', notificationState(), '浏览器通知权限、测试通知和默认提醒时间。')}
      ${settingsCard('data', '数据导入导出', `${state.data.tasks.length} 个任务`, '导出 JSON、选择导入文件、预检冲突和确认导入。')}
      ${settingsCard('attachments', '附件导入导出', `${attachmentStats.length} 个附件`, '附件 ZIP 导出、元数据匹配、缺失附件恢复和导入失败状态。')}
      ${settingsCard('about', '应用信息', 'PWA 可安装', '部署版本、离线状态、存储位置和浏览器支持说明。')}
    </section>
    <section class="section-list" style="margin-top:22px;">
      <nav class="section-tabs" aria-label="设置分组">
        ${['account','appearance','notifications','data','attachments','about'].map(id => `<button class="${state.settingsPanel === id ? 'active' : ''}" type="button" data-action="settings-panel" data-panel="${id}">${settingsPanelLabel(id)}</button>`).join('')}
      </nav>
      <div class="task-board">${settingsPanel()}</div>
    </section>
  `;
}

function settingsCard(id, title, meta, copy) {
  return `
    <article class="settings-card">
      <header><span class="chip ${id === state.settingsPanel ? 'strong' : ''}">${escapeHtml(title)}</span><span class="group-meta">${escapeHtml(meta)}</span></header>
      <p>${escapeHtml(copy)}</p>
      <button class="tiny-action" type="button" data-action="settings-panel" data-panel="${id}">进入设置</button>
    </article>
  `;
}

function settingsPanel() {
  const panel = state.settingsPanel;
  if (panel === 'account') return `
    <section class="group">
      <div class="group-header"><div class="group-title"><span class="dot"></span>账号与安全</div><span class="group-meta">${escapeHtml(state.data.user.username)}</span></div>
      <form class="panel" data-submit="change-password" style="border:0;border-radius:0;">
        <div class="field"><label>当前账号</label><input class="input" value="${escapeHtml(state.data.user.username)}" readonly /></div>
        <div class="field"><label>当前密码</label><input class="input" name="currentPassword" type="password" required /></div>
        <div class="field"><label>新密码</label><input class="input" name="newPassword" type="password" minlength="8" required /></div>
        <div class="field"><label>再次输入新密码</label><input class="input" name="confirmPassword" type="password" minlength="8" required /></div>
        <div class="header-actions" style="justify-content:flex-start;"><button class="soft-button" type="submit">保存新密码</button><button class="quiet-button danger-button" type="button" data-action="logout">退出登录</button></div>
      </form>
    </section>
  `;
  if (panel === 'appearance') return `
    <section class="group">
      <div class="group-header"><div class="group-title"><span class="dot success"></span>外观</div><span class="group-meta">即时生效</span></div>
      <div class="panel" style="border:0;border-radius:0;">
        <div class="segmented" style="justify-self:start;">
          ${['system','light','dark'].map(theme => `<button class="${state.data.settings.theme === theme ? 'active' : ''}" type="button" data-action="theme" data-theme="${theme}">${themeLabel(theme)}</button>`).join('')}
        </div>
        ${switchRow('紧凑任务行', '桌面任务行更紧凑，适合高任务量。', 'compactRows', state.data.settings.compactRows)}
        ${switchRow('固定右侧详情抽屉', '宽屏时保持详情常驻，窄屏自动切为覆盖层。', 'dockDrawer', state.data.settings.dockDrawer)}
        <div class="panel" style="background:var(--accent-quiet);"><div class="panel-title">预览</div>${state.data.tasks[0] ? taskRow(openTasks()[0] || state.data.tasks[0]) : '<p class="page-subtitle" style="margin:0;">暂无任务可预览。</p>'}</div>
      </div>
    </section>
  `;
  if (panel === 'notifications') return `
    <section class="group">
      <div class="group-header"><div class="group-title"><span class="dot warn"></span>通知</div><span class="group-meta">${escapeHtml(notificationState())}</span></div>
      <div class="panel" style="border:0;border-radius:0;">
        <div class="empty-state" style="padding:24px;">
          <h2>${escapeHtml(notificationHeading())}</h2>
          <p>浏览器通知需要用户授权。已拒绝时需要到浏览器设置中手动恢复。</p>
          <div class="header-actions">
            <button class="soft-button" type="button" data-action="request-notifications">开启通知</button>
            <button class="quiet-button" type="button" data-action="test-notification">发送测试通知</button>
          </div>
        </div>
        <div class="field"><label>默认提醒时间</label>${selectControl('data-setting-select="defaultReminderTime"', `${['09:00','12:00','18:00',''].map(value => `<option value="${value}" ${state.data.settings.defaultReminderTime === value ? 'selected' : ''}>${value || '不自动设置'}</option>`).join('')}`)}</div>
      </div>
    </section>
  `;
  if (panel === 'data') return `
    <section class="group">
      <div class="group-header"><div class="group-title"><span class="dot"></span>数据导入导出</div><span class="group-meta">任务、项目、标签、提醒、重复规则</span></div>
      <div class="panel" style="border:0;border-radius:0;">
        ${statsInline([
          { value: state.data.tasks.length, label: '任务' },
          { value: state.data.projects.length, label: '项目' },
          { value: state.data.tags.length, label: '标签' },
          { value: state.data.filters.length, label: '过滤器' }
        ])}
        <div class="panel">
          <div class="panel-title">导出数据</div>
          <p class="page-subtitle" style="margin:0;">数据导出包含任务、项目、章节、标签、过滤器、提醒、重复规则和附件元数据，不包含附件文件本体。</p>
          <div class="header-actions" style="justify-content:flex-start;"><a class="soft-button" href="/api/export/data">导出 JSON</a></div>
        </div>
        <div class="panel">
          <div class="panel-title">导入数据</div>
          <p class="page-subtitle" style="margin:0;">导入必须先预检。第一版支持替换当前数据。</p>
          <input class="input" type="file" accept="application/json,.json" data-import-file />
          ${state.importPreview ? importPreviewHtml() : ''}
        </div>
      </div>
    </section>
  `;
  if (panel === 'attachments') {
    const attachments = allAttachments();
    const missing = attachments.filter(item => item.attachment.missing).length;
    const total = attachments.reduce((sum, item) => sum + (item.attachment.size || 0), 0);
    return `
      <section class="group">
        <div class="group-header"><div class="group-title"><span class="dot success"></span>附件导入导出</div><span class="group-meta">${attachments.length} 个文件 · ${formatBytes(total)}</span></div>
        <div class="panel" style="border:0;border-radius:0;">
          ${statsInline([
            { value: attachments.length, label: '附件' },
            { value: formatBytes(total), label: '总大小' },
            { value: missing, label: '缺失附件' }
          ])}
          <div class="panel"><div class="panel-title">导出附件</div><p class="page-subtitle" style="margin:0;">附件 ZIP 使用内部存储 ID 匹配，导入时可恢复缺失文件。</p><a class="soft-button" href="/api/export/attachments">导出全部附件</a></div>
          <div class="panel">
            <div class="panel-title">导入附件 ZIP</div>
            <label class="upload-dropzone compact">
              <input class="file-input" type="file" accept=".zip,application/zip" data-attachment-zip />
              <span class="file-icon">ZIP</span>
              <span><strong>选择附件备份包</strong><span class="task-meta">导入后按内部存储 ID 恢复缺失文件</span></span>
              <span class="tiny-action">选择文件</span>
            </label>
          </div>
        </div>
      </section>
    `;
  }
  return `
    <section class="group">
      <div class="group-header"><div class="group-title"><span class="dot muted"></span>应用信息</div><span class="group-meta">self-hosted</span></div>
      <div class="panel" style="border:0;border-radius:0;">
        <div class="file-row"><span class="file-icon">PWA</span><span><strong>PWA 可安装</strong><span class="task-meta">安装后仍使用同一服务端和登录会话</span></span><button class="tiny-action" type="button" data-action="install-pwa">安装</button></div>
        <div class="file-row"><span class="file-icon">NET</span><span><strong>在线优先</strong><span class="task-meta">第一版以服务端数据一致性为主</span></span><span class="chip success">正常</span></div>
        <div class="file-row"><span class="file-icon">SRC</span><span><strong>原型设计稿</strong><span class="task-meta">保留在 /prototype/index.html 供评审对照</span></span><a class="tiny-action" href="/prototype/index.html">打开</a></div>
      </div>
    </section>
  `;
}

function switchRow(title, copy, key, enabled) {
  return `<div class="switch-row"><div><strong>${escapeHtml(title)}</strong><p class="page-subtitle" style="margin:2px 0 0;">${escapeHtml(copy)}</p></div><button class="switch ${enabled ? 'on' : ''}" type="button" data-action="toggle-setting" data-key="${key}"></button></div>`;
}

function importPreviewHtml() {
  const preview = state.importPreview;
  return `
    <div class="panel">
      <div class="panel-title">预检结果 <span class="chip warn">替换当前数据</span></div>
      <div class="task-meta">
        <span class="mini-tag">${preview.tasks} 任务</span>
        <span class="mini-tag">${preview.projects} 项目</span>
        <span class="mini-tag">${preview.tags} 标签</span>
        <span class="mini-tag">${preview.attachmentMetadata} 附件元数据</span>
      </div>
      <p class="page-subtitle" style="margin:0;">当前有 ${preview.currentTasks} 个任务。确认导入会替换当前任务数据，但不会替换登录密码。</p>
      <button class="quiet-button danger-button" type="button" data-action="confirm-import">确认导入</button>
    </div>
  `;
}

function drawer(task) {
  const project = projectById(task.projectId);
  return `
    <aside class="drawer open">
      <div class="drawer-toolbar">
        <button class="icon-btn" type="button" data-action="close-drawer">×</button>
        <span class="save-state">${escapeHtml(state.saveState)}</span>
        <button class="icon-btn" type="button" data-action="delete-task" data-id="${task.id}">⌫</button>
      </div>
      <div class="drawer-content">
        <textarea class="drawer-title" data-drawer-field="title">${escapeHtml(task.title)}</textarea>
        <div class="property-grid">
          <label class="property"><span class="property-label">完成</span><span class="property-value"><input type="checkbox" ${task.completed ? 'checked' : ''} data-action="toggle-task" data-id="${task.id}" /> ${task.completed ? '已完成' : '未完成'}</span></label>
          <label class="property"><span class="property-label">项目</span><span class="property-value">${selectControl('data-drawer-select="projectId"', `<option value="">收件箱</option>${state.data.projects.map(item => `<option value="${item.id}" ${item.id === task.projectId ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}`)}</span></label>
          <label class="property"><span class="property-label">章节</span><span class="property-value">${selectControl('data-drawer-select="sectionId"', `<option value="">无章节</option>${(project?.sections || []).map(section => `<option value="${section.id}" ${section.id === task.sectionId ? 'selected' : ''}>${escapeHtml(section.name)}</option>`).join('')}`)}</span></label>
          <div class="property schedule-property"><span class="property-label">日期提醒</span><span class="property-value">${schedulePicker({ mode: 'task', task })}</span></div>
          <label class="property"><span class="property-label">优先级</span><span class="property-value">${selectControl('data-drawer-select="priority"', `${['none','low','medium','high'].map(priority => `<option value="${priority}" ${priority === task.priority ? 'selected' : ''}>${priorityLabel(priority)}</option>`).join('')}`)}</span></label>
          <div class="property"><span class="property-label">紧急</span><span class="property-value"><button class="switch ${task.urgent ? 'on' : ''}" type="button" data-action="toggle-urgent" data-id="${task.id}" aria-label="${task.urgent ? '取消紧急' : '标记紧急'}"></button>${task.urgent ? '紧急' : '不紧急'}</span></div>
          <div class="property tag-property"><span class="property-label">标签</span><span class="property-value">${tagPicker(task.tags || [], { mode: 'drawer', taskId: task.id })}</span></div>
          <label class="property"><span class="property-label">重复</span><span class="property-value">${selectControl('data-drawer-select="recurrence"', `<option value="">不重复</option><option value='{"type":"daily","interval":1}' ${task.recurrence?.type === 'daily' ? 'selected' : ''}>每天</option><option value='{"type":"weekly","interval":1}' ${task.recurrence?.type === 'weekly' ? 'selected' : ''}>每周</option><option value='{"type":"monthly","interval":1}' ${task.recurrence?.type === 'monthly' ? 'selected' : ''}>每月</option><option value='{"type":"workdays","interval":1}' ${task.recurrence?.type === 'workdays' ? 'selected' : ''}>工作日</option>`)}</span></label>
        </div>
        <section class="panel">
          <div class="panel-title">描述</div>
          <textarea class="textarea" data-drawer-field="description" placeholder="写一些任务上下文。">${escapeHtml(task.description || '')}</textarea>
        </section>
        ${checklistPanel(task)}
        <section class="panel">
          <div class="panel-title">附件 <span class="chip">${(task.attachments || []).length} 个</span></div>
          <label class="upload-dropzone">
            <input class="file-input" type="file" multiple data-file-upload data-task-id="${task.id}" />
            <span class="file-icon">UP</span>
            <span><strong>上传附件</strong><span class="task-meta">支持多文件，单个文件最大 100MB</span></span>
            <span class="tiny-action">选择文件</span>
          </label>
          ${(task.attachments || []).map(file => `
            <div class="file-row">
              <span class="file-icon">${escapeHtml(fileExtension(file.originalName))}</span>
              <span><strong>${escapeHtml(file.originalName)}</strong><span class="task-meta">${formatBytes(file.size)} · ${escapeHtml(shortDate(file.uploadedAt))}${file.missing ? ' · 文件缺失' : ''}</span></span>
              <span class="header-actions">
                <a class="tiny-action" href="/api/attachments/${file.id}/download">下载</a>
                <button class="tiny-action" type="button" data-action="delete-attachment" data-id="${file.id}">删除</button>
              </span>
            </div>
          `).join('') || '<p class="page-subtitle" style="margin:0;">附件会随任务元数据记录，文件本体可单独导出 ZIP。</p>'}
        </section>
      </div>
    </aside>
  `;
}

function taskModal() {
  const defaults = taskModalDefaults();
  return modal('taskModalOpen', '新建任务', `
    <form class="dialog-body" data-submit="create-task">
      <div class="field"><label>任务标题</label><input class="input" name="title" required autofocus placeholder="例如：整理今天的任务" /></div>
      <div class="field"><label>项目</label>${selectControl('name="projectId"', `<option value="" ${!defaults.projectId ? 'selected' : ''}>收件箱</option>${state.data.projects.map(project => `<option value="${project.id}" ${project.id === defaults.projectId ? 'selected' : ''}>${escapeHtml(project.name)}</option>`).join('')}`)}</div>
      <div class="field"><label>日期和提醒</label>${schedulePicker({ mode: 'form', defaults })}</div>
      <div class="field"><label>优先级</label>${selectControl('name="priority"', '<option value="none">普通</option><option value="low">低</option><option value="medium">中</option><option value="high">高</option>')}</div>
      <div class="field"><label>标签</label>${tagPicker(defaults.tagId ? [defaults.tagId] : [], { mode: 'form' })}</div>
      <label class="check-field"><input type="checkbox" name="urgent" value="true" /><span>标记为紧急</span></label>
      <input type="hidden" name="sectionId" value="${escapeHtml(defaults.sectionId || '')}" />
      <input type="hidden" name="tagId" value="${escapeHtml(defaults.tagId || '')}" />
      <button class="primary-add" type="submit">创建任务</button>
    </form>
  `);
}

function checklistPanel(task) {
  const subtasks = task.subtasks || [];
  const doneCount = subtasks.filter(subtask => subtask.completed).length;
  return `
    <section class="panel checklist-panel">
      <div class="panel-title">
        <span>Checklist</span>
        <span class="chip">${doneCount}/${subtasks.length}</span>
      </div>
      <form class="subtask-composer" data-submit="add-subtask">
        <textarea class="input subtask-input" name="title" rows="2" data-autosize placeholder="添加检查项，支持粘贴多行内容"></textarea>
        <input type="hidden" name="taskId" value="${task.id}" />
        <button class="tiny-action" type="submit">添加</button>
      </form>
      <div class="subtask-list">
        ${subtasks.map(subtask => `
          <div class="subtask ${subtask.completed ? 'done' : ''}">
            <input type="checkbox" aria-label="切换检查项完成状态" ${subtask.completed ? 'checked' : ''} data-action="toggle-subtask" data-task-id="${task.id}" data-subtask-id="${subtask.id}" />
            <textarea class="subtask-title" rows="1" data-autosize data-subtask-title data-task-id="${task.id}" data-subtask-id="${subtask.id}">${escapeHtml(subtask.title)}</textarea>
            <button class="tiny-action" type="button" data-action="delete-subtask" data-task-id="${task.id}" data-subtask-id="${subtask.id}" aria-label="删除检查项">删除</button>
          </div>
        `).join('') || '<div class="empty-note">还没有检查项。先添加一条能推进任务的下一步。</div>'}
      </div>
    </section>
  `;
}

function projectModal() {
  return modal('projectModalOpen', '新建项目', `
    <form class="dialog-body" data-submit="create-project">
      <div class="field"><label>项目名称</label><input class="input" name="name" required placeholder="例如：家庭事务" /></div>
      <div class="field"><label>说明</label><textarea class="textarea" name="description" placeholder="这个项目主要用来整理什么？"></textarea></div>
      <button class="primary-add" type="submit">创建项目</button>
    </form>
  `);
}

function tagModal() {
  return modal('tagModalOpen', '新建标签', `
    <form class="dialog-body" data-submit="create-tag">
      <div class="field"><label>标签名称</label><input class="input" name="name" required placeholder="例如：家务" /></div>
      <div class="field"><label>颜色</label>${selectControl('name="color"', '<option value="blue">蓝</option><option value="green">绿</option><option value="amber">黄</option><option value="red">红</option><option value="violet">紫</option>')}</div>
      <button class="primary-add" type="submit">创建标签</button>
    </form>
  `);
}

function filterModal() {
  const editing = state.data.filters.find(filter => filter.id === state.filterEditingId) || null;
  const condition = editing?.conditions?.[0] || {};
  const conditionValue = condition.value === undefined ? '' : String(condition.value);
  return modal('filterModalOpen', editing ? '编辑智能过滤器' : '智能过滤器', `
    <form class="dialog-body" data-submit="create-filter">
      <div class="field"><label>名称</label><input class="input" name="name" required placeholder="例如：本周高优先级" value="${escapeHtml(editing?.name || '')}" /></div>
      <div class="field"><label>字段</label>${selectControl('name="field"', `${['priority','projectId','tag','due','hasAttachment','hasReminder'].map(field => `<option value="${field}" ${field === condition.field ? 'selected' : ''}>${conditionFieldLabel(field)}</option>`).join('')}`)}</div>
      <div class="field"><label>值</label><input class="input" name="value" placeholder="high / 项目ID / 标签ID / today / upcoming / true" value="${escapeHtml(conditionValue)}" /></div>
      <button class="primary-add" type="submit">${editing ? '保存修改' : '保存过滤器'}</button>
    </form>
  `);
}

function modal(flag, title, body) {
  return `
    <div class="modal-layer ${state[flag] ? 'open' : ''}" aria-hidden="${state[flag] ? 'false' : 'true'}">
      <div class="dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <div class="dialog-head"><h2 class="dialog-title">${escapeHtml(title)}</h2><button class="icon-btn" type="button" data-action="close-modals">×</button></div>
        ${body}
      </div>
    </div>
  `;
}

function commandModal() {
  const tasks = openTasks().slice(0, 8);
  return `
    <div class="modal-layer ${state.commandOpen ? 'open' : ''}" aria-hidden="${state.commandOpen ? 'false' : 'true'}">
      <div class="dialog" role="dialog" aria-modal="true" aria-label="命令面板">
        <div class="dialog-head"><h2 class="dialog-title">命令面板</h2><button class="icon-btn" type="button" data-action="close-command">×</button></div>
        <div class="dialog-body">
          <input class="input" data-command-input placeholder="搜索任务、项目或动作" autofocus />
          <div class="cmd-list" data-command-results>
            <button class="cmd-item active" type="button" data-action="open-task-modal"><span class="file-icon">+</span><span><strong>新建任务</strong><span class="task-meta">默认应用当前页面上下文</span></span><span class="shortcut">Enter</span></button>
            ${navItems.slice(0, 9).map(item => `<button class="cmd-item" type="button" data-action="navigate" data-route="${item.id}"><span class="file-icon">${item.icon}</span><span><strong>打开${escapeHtml(item.label)}</strong><span class="task-meta">视图</span></span><span class="shortcut">G</span></button>`).join('')}
            ${tasks.map(task => `<button class="cmd-item" type="button" data-action="select-task" data-task-id="${task.id}"><span class="file-icon">T</span><span><strong>${escapeHtml(task.title)}</strong><span class="task-meta">${escapeHtml(taskMetaText(task))}</span></span><span class="shortcut">↵</span></button>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderCommandResults(query) {
  const box = document.querySelector('[data-command-results]');
  if (!box || !state.data) return;
  const normalized = query.trim().toLowerCase();
  const tasks = openTasks().filter(task => !normalized || `${task.title} ${taskMetaText(task)}`.toLowerCase().includes(normalized)).slice(0, 8);
  const projects = activeProjects().filter(project => !normalized || project.name.toLowerCase().includes(normalized)).slice(0, 4);
  const tags = state.data.tags.filter(tag => !normalized || tag.name.toLowerCase().includes(normalized)).slice(0, 4);
  box.innerHTML = `
    <button class="cmd-item active" type="button" data-action="open-task-modal"><span class="file-icon">+</span><span><strong>新建任务</strong><span class="task-meta">当前页面上下文</span></span><span class="shortcut">Enter</span></button>
    ${tasks.map(task => `<button class="cmd-item" type="button" data-action="select-task" data-task-id="${task.id}"><span class="file-icon">T</span><span><strong>${escapeHtml(task.title)}</strong><span class="task-meta">${escapeHtml(taskMetaText(task))}</span></span><span class="shortcut">↵</span></button>`).join('')}
    ${projects.map(project => `<button class="cmd-item" type="button" data-action="navigate" data-route="project/${project.id}"><span class="file-icon">P</span><span><strong>${escapeHtml(project.name)}</strong><span class="task-meta">${countOpenByProject(project.id)} 项未完成</span></span><span class="shortcut">↵</span></button>`).join('')}
    ${tags.map(tag => `<button class="cmd-item" type="button" data-action="navigate" data-route="tag/${tag.id}"><span class="file-icon">#</span><span><strong>${escapeHtml(tag.name)}</strong><span class="task-meta">${tagTasks(tag.id).length} 项任务</span></span><span class="shortcut">↵</span></button>`).join('')}
    ${!tasks.length && !projects.length && !tags.length ? '<div class="empty-state"><h2>没有结果</h2><p>换一个关键词试试。</p></div>' : ''}
  `;
}

async function handleAction(action, payload, target) {
  try {
    if (action === 'noop') return;
    if (action === 'navigate') return navigate(payload.route);
    if (action === 'open-command') { state.commandOpen = true; return render(); }
    if (action === 'close-command') { state.commandOpen = false; return render(); }
    if (action === 'close-modals') { closeModals(); return render(); }
    if (action === 'open-task-modal') { state.taskModalDefaults = defaultsFromPayload(payload); state.taskModalOpen = true; return render(); }
    if (action === 'open-project-modal') { state.projectModalOpen = true; return render(); }
    if (action === 'open-tag-modal') { state.tagModalOpen = true; return render(); }
    if (action === 'open-filter-modal') { state.filterEditingId = null; state.filterModalOpen = true; return render(); }
    if (action === 'edit-filter') { state.filterEditingId = payload.id || null; state.filterModalOpen = true; return render(); }
    if (action === 'close-drawer') { closeDrawer(); return render(); }
    if (action === 'select-task') { state.selectedTaskId = payload.taskId || target.closest('[data-task-id]')?.dataset.taskId; state.commandOpen = false; return render(); }
    if (action === 'toggle-task') {
      const task = taskById(payload.id || target.closest('[data-task-id]')?.dataset.taskId);
      if (task) await updateTask(task.id, { completed: !task.completed });
      return;
    }
    if (action === 'postpone-task') return updateTask(payload.id, { dueDate: todayISO(1) });
    if (action === 'cycle-priority') return cyclePriority(payload.id);
    if (action === 'toggle-urgent') {
      const task = taskById(payload.id);
      if (task) await updateTask(task.id, { urgent: !task.urgent });
      return;
    }
    if (action === 'delete-task') return deleteTask(payload.id);
    if (action === 'delete-attachment') return deleteAttachment(payload.id);
    if (action === 'add-subtask') return addSubtask(payload.id);
    if (action === 'toggle-subtask') return toggleSubtask(payload.taskId, payload.subtaskId);
    if (action === 'delete-subtask') return deleteSubtask(payload.taskId, payload.subtaskId);
    if (action === 'toggle-task-tag') return toggleTaskTag(payload.taskId, payload.tagId);
    if (action === 'set-task-date') return setTaskDate(payload.taskId, payload.value || '');
    if (action === 'set-task-reminder') return setTaskReminder(payload.taskId, payload.time || '');
    if (action === 'set-form-date') { setFormDate(target.closest('form'), payload.value || ''); return; }
    if (action === 'set-form-reminder') { setFormReminder(target.closest('form'), payload.time || ''); return; }
    if (action === 'calendar-mode') { state.calendarMode = payload.mode; return render(); }
    if (action === 'calendar-today') { showToast('已回到今天'); return; }
    if (action === 'filter-date') { showToast(`已聚焦 ${payload.date}`); return; }
    if (action === 'settings-panel') { state.settingsPanel = payload.panel; return render(); }
    if (action === 'theme') return updateSettings({ theme: payload.theme });
    if (action === 'toggle-setting') return updateSettings({ [payload.key]: !state.data.settings[payload.key] });
    if (action === 'request-notifications') return requestNotifications();
    if (action === 'test-notification') return testNotification();
    if (action === 'install-pwa') return installPwa();
    if (action === 'logout') return logout();
    if (action === 'confirm-import') return confirmImport();
    if (action === 'archive-project') return archiveProject(payload.id);
    if (action === 'delete-project') return deleteProject(payload.id);
    if (action === 'delete-tag') return deleteTag(payload.id);
    if (action === 'duplicate-filter') return duplicateFilter(payload.id);
    if (action === 'delete-filter') return deleteFilter(payload.id);
    if (action === 'add-section') return addSection(payload.projectId);
    if (action === 'bulk-hint') return showToast('批量整理第一版支持通过任务详情修改项目、标签和日期');
    if (action === 'sort-hint') return showToast('当前按完成状态、优先级和手动顺序排序');
    if (action === 'open-date-menu') return showToast('在任务详情里可以设置日期和提醒');
    if (action === 'open-project-menu') return showToast('在任务详情里可以移动项目');
    if (action === 'show-archived') return showToast('归档项目可在数据导出中保留');
  } catch (error) {
    showToast(error.message || '操作失败');
  }
}

async function handleSubmit(action, form) {
  const formData = new FormData(form);
  try {
    if (action === 'login') {
      await api('/api/auth/login', {
        method: 'POST',
        body: {
          username: formData.get('username'),
          password: formData.get('password')
        }
      });
      await loadData();
      render();
      return;
    }
    if (action === 'quick-task' || action === 'create-task') {
      const tagId = formData.get('tagId');
      const selectedTags = formData.getAll('tags');
      const payload = {
        title: formData.get('title'),
        projectId: formData.get('projectId') || null,
        sectionId: formData.get('sectionId') || null,
        dueDate: formData.get('dueDate') || null,
        reminderAt: normalizeReminderInput(formData.get('reminderAt')) || null,
        priority: formData.get('priority') || 'none',
        urgent: formData.get('urgent') === 'true',
        tags: [...new Set([...selectedTags, ...(tagId ? [tagId] : [])])]
      };
      const response = await api('/api/tasks', { method: 'POST', body: payload });
      state.selectedTaskId = response.task.id;
      closeModals();
      await refreshFromPayload(response);
      showToast('任务已添加');
      return;
    }
    if (action === 'add-subtask') {
      await addSubtask(formData.get('taskId'), formData.get('title'));
      form.reset();
      autosizeTextareas();
      return;
    }
    if (action === 'create-project') {
      const response = await api('/api/projects', {
        method: 'POST',
        body: { name: formData.get('name'), description: formData.get('description'), sections: [{ name: '默认', order: 1 }] }
      });
      closeModals();
      await refreshFromPayload(response);
      navigate(`project/${response.project.id}`);
      return;
    }
    if (action === 'create-tag') {
      const response = await api('/api/tags', {
        method: 'POST',
        body: { name: formData.get('name'), color: formData.get('color') }
      });
      closeModals();
      await refreshFromPayload(response);
      navigate(`tag/${response.tag.id}`);
      return;
    }
    if (action === 'create-filter') {
      const field = formData.get('field');
      let value = formData.get('value');
      if (value === 'true') value = true;
      if (value === 'false') value = false;
      const body = {
        name: formData.get('name'),
        pinned: state.filterEditingId ? undefined : true,
        conditions: [{ field, operator: 'is', value }],
        sort: 'dueDate',
        group: 'date'
      };
      const response = state.filterEditingId
        ? await api(`/api/filters/${state.filterEditingId}`, { method: 'PATCH', body })
        : await api('/api/filters', { method: 'POST', body });
      const filterId = state.filterEditingId || response.filter.id;
      state.filterEditingId = null;
      closeModals();
      await refreshFromPayload(response);
      navigate(`filter/${filterId}`);
      return;
    }
    if (action === 'change-password') {
      if (formData.get('newPassword') !== formData.get('confirmPassword')) {
        showToast('两次新密码不一致');
        return;
      }
      await api('/api/account/password', {
        method: 'POST',
        body: {
          currentPassword: formData.get('currentPassword'),
          newPassword: formData.get('newPassword')
        }
      });
      form.reset();
      showToast('密码已更新');
    }
  } catch (error) {
    showToast(error.message === 'invalid_credentials' ? '密码错误' : error.message || '提交失败');
  }
}

function updateSelectedTaskDraft(field, value) {
  const task = taskById(state.selectedTaskId);
  if (!task) return;
  task[field] = value;
  task.updatedAt = new Date().toISOString();
  state.saveState = '保存中...';
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(async () => {
    try {
      await updateTask(task.id, { [field]: value }, { silent: true });
      state.saveState = '已保存 · 刚刚';
      render();
    } catch {
      state.saveState = '保存失败';
      render();
    }
  }, 650);
  const save = document.querySelector('.save-state');
  if (save) save.textContent = state.saveState;
}

async function updateTask(id, patch, { silent = false } = {}) {
  if (!id) return;
  if (patch.recurrence !== undefined && typeof patch.recurrence === 'string') {
    patch.recurrence = patch.recurrence ? JSON.parse(patch.recurrence) : null;
  }
  if (patch.reminderAt && patch.reminderAt.length === 16) {
    patch.reminderAt = new Date(patch.reminderAt).toISOString();
  }
  const response = await api(`/api/tasks/${id}`, { method: 'PATCH', body: patch });
  await refreshFromPayload(response);
  if (!silent) showToast('任务已更新');
}

async function deleteTask(id) {
  if (!id || !confirm('确认删除这个任务？')) return;
  const response = await api(`/api/tasks/${id}`, { method: 'DELETE' });
  if (state.selectedTaskId === id) state.selectedTaskId = null;
  await refreshFromPayload(response);
  showToast('任务已删除');
}

async function cyclePriority(id) {
  const task = taskById(id);
  if (!task) return;
  const order = ['none', 'low', 'medium', 'high'];
  const next = order[(order.indexOf(task.priority) + 1) % order.length];
  await updateTask(id, { priority: next });
}

async function toggleTaskTag(taskId, tagId) {
  const task = taskById(taskId);
  if (!task || !tagId) return;
  const current = new Set(task.tags || []);
  if (current.has(tagId)) current.delete(tagId);
  else current.add(tagId);
  await updateTask(taskId, { tags: [...current] });
}

async function setTaskDate(taskId, value, input = null) {
  const task = taskById(taskId);
  if (!task) return;
  const parsedDate = parseDateInput(value, task.dueDate || todayISO());
  if (parsedDate === null) {
    input?.classList.add('invalid');
    showToast('日期格式可写 24、6/24 或 2026-06-24');
    return;
  }
  input?.classList.remove('invalid');
  const dueDate = parsedDate || null;
  const patch = { dueDate };
  if (!dueDate) {
    patch.reminderAt = null;
  } else if (task.reminderAt) {
    const time = localTimeValue(task.reminderAt);
    if (time) patch.reminderAt = dateTimeLocalValue(dueDate, time);
  }
  await updateTask(taskId, patch);
}

async function setTaskReminder(taskId, time) {
  const task = taskById(taskId);
  if (!task) return;
  if (!time) {
    await updateTask(taskId, { reminderAt: null });
    return;
  }
  const dueDate = task.dueDate || todayISO();
  const patch = { reminderAt: dateTimeLocalValue(dueDate, time) };
  if (!task.dueDate) patch.dueDate = dueDate;
  await updateTask(taskId, patch);
}

function setFormDate(form, value) {
  if (!form) return;
  const dueDateInput = form.querySelector('[data-form-due-date]');
  const reminderInput = form.querySelector('[data-form-reminder-at]');
  if (!dueDateInput || !reminderInput) return;
  const customDateInput = form.querySelector('[data-form-date-input]');
  const parsedDate = parseDateInput(value, dueDateInput.value || todayISO());
  if (parsedDate === null) {
    customDateInput?.classList.add('invalid');
    showToast('日期格式可写 24、6/24 或 2026-06-24');
    return;
  }
  const dueDate = parsedDate || '';
  const currentTime = localTimeValue(reminderInput.value);
  dueDateInput.value = dueDate;
  if (customDateInput) {
    customDateInput.value = dateInputDisplayValue(dueDate);
    customDateInput.classList.remove('invalid');
  }
  if (!dueDate) {
    reminderInput.value = '';
  } else if (currentTime) {
    reminderInput.value = reminderISO(dueDate, currentTime);
  }
  syncSchedulePicker(form.querySelector('[data-schedule-picker]'));
}

function setFormReminder(form, time) {
  if (!form) return;
  const dueDateInput = form.querySelector('[data-form-due-date]');
  const reminderInput = form.querySelector('[data-form-reminder-at]');
  if (!dueDateInput || !reminderInput) return;
  const reminderTime = time || '';
  if (!reminderTime) {
    reminderInput.value = '';
  } else {
    const dueDate = dueDateInput.value || todayISO();
    dueDateInput.value = dueDate;
    reminderInput.value = reminderISO(dueDate, reminderTime);
    const customDateInput = form.querySelector('[data-form-date-input]');
    if (customDateInput) {
      customDateInput.value = dateInputDisplayValue(dueDate);
      customDateInput.classList.remove('invalid');
    }
  }
  const customTimeInput = form.querySelector('[data-form-reminder-time]');
  if (customTimeInput) customTimeInput.value = reminderTime;
  syncSchedulePicker(form.querySelector('[data-schedule-picker]'));
}

function syncSchedulePicker(picker) {
  if (!picker) return;
  const dueDate = picker.querySelector('[data-form-due-date]')?.value || '';
  const reminderAt = picker.querySelector('[data-form-reminder-at]')?.value || '';
  const selectedTime = localTimeValue(reminderAt);
  const reminderDate = localDateValue(reminderAt);
  const summary = picker.querySelector('[data-schedule-summary]');
  if (summary) {
    const title = summary.querySelector('strong');
    const subtitle = summary.querySelector('small');
    if (title) title.textContent = dueDate ? shortDate(dueDate) : '无日期';
    if (subtitle) subtitle.textContent = reminderAt ? `${formatTime(reminderAt)} 提醒` : '无提醒';
  }
  picker.querySelectorAll('[data-action="set-form-date"]').forEach(button => {
    button.classList.toggle('active', (button.dataset.value || '') === dueDate);
  });
  picker.querySelectorAll('[data-action="set-form-reminder"]').forEach(button => {
    const value = button.dataset.time || '';
    const active = value ? selectedTime === value && (!dueDate || reminderDate === dueDate) : !reminderAt;
    button.classList.toggle('active', active);
  });
  const customDateInput = picker.querySelector('[data-form-date-input]');
  if (customDateInput) customDateInput.value = dateInputDisplayValue(dueDate);
}

async function addSubtask(id, inputTitle) {
  const task = taskById(id);
  if (!task) return;
  const title = inputTitle === undefined ? prompt('子任务标题，可以粘贴多行内容') : String(inputTitle || '').trim();
  if (!title) return;
  const subtasks = [...(task.subtasks || []), { title, completed: false, order: (task.subtasks || []).length + 1 }];
  await updateTask(id, { subtasks });
}

async function updateSubtaskTitle(taskId, subtaskId, title) {
  const task = taskById(taskId);
  if (!task) return;
  const subtasks = (task.subtasks || []).map(subtask => (
    subtask.id === subtaskId ? { ...subtask, title: String(title || '').trim() || '未命名子任务' } : subtask
  ));
  await updateTask(taskId, { subtasks }, { silent: true });
  showToast('子任务已保存');
}

async function toggleSubtask(taskId, subtaskId) {
  const task = taskById(taskId);
  if (!task) return;
  const subtasks = task.subtasks.map(subtask => subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask);
  await updateTask(taskId, { subtasks }, { silent: true });
}

async function deleteSubtask(taskId, subtaskId) {
  const task = taskById(taskId);
  if (!task) return;
  const subtasks = task.subtasks.filter(subtask => subtask.id !== subtaskId);
  await updateTask(taskId, { subtasks });
}

async function uploadAttachment(taskId, files) {
  if (!files?.length) return;
  for (const file of files) {
    const formData = new FormData();
    formData.set('file', file);
    const response = await api(`/api/tasks/${taskId}/attachments`, { method: 'POST', body: formData });
    await refreshFromPayload(response);
  }
  showToast('附件已上传');
}

async function deleteAttachment(id) {
  if (!confirm('确认删除这个附件？')) return;
  const response = await api(`/api/attachments/${id}`, { method: 'DELETE' });
  await refreshFromPayload(response);
  showToast('附件已删除');
}

let pendingImportFile = null;
async function previewImport(file) {
  if (!file) return;
  pendingImportFile = file;
  try {
    const formData = new FormData();
    formData.set('file', file);
    const response = await api('/api/import/preview', { method: 'POST', body: formData });
    state.importPreview = response.preview;
    render();
  } catch (error) {
    pendingImportFile = null;
    state.importPreview = null;
    showToast(error.message || '导入预检失败');
    render();
  }
}

async function confirmImport() {
  if (!pendingImportFile || !confirm('确认替换当前任务数据？')) return;
  const formData = new FormData();
  formData.set('file', pendingImportFile);
  const response = await api('/api/import/data', { method: 'POST', body: formData });
  pendingImportFile = null;
  state.importPreview = null;
  await refreshFromPayload(response);
  showToast('数据导入完成');
}

async function importAttachmentZip(file) {
  if (!file) return;
  try {
    const formData = new FormData();
    formData.set('file', file);
    const response = await api('/api/import/attachments', { method: 'POST', body: formData });
    await refreshFromPayload(response);
    showToast(`附件匹配完成：${response.summary.matched} 个`);
  } catch (error) {
    showToast(error.message || '附件导入失败');
  }
}

async function updateSettings(patch) {
  const response = await api('/api/settings', { method: 'POST', body: patch });
  state.data.settings = response.settings;
  applyTheme(response.settings.theme);
  render();
  showToast('设置已更新');
}

async function requestNotifications() {
  if (!('Notification' in window)) {
    showToast('浏览器不支持通知');
    return;
  }
  const permission = await Notification.requestPermission();
  await updateSettings({ notificationsEnabled: permission === 'granted' });
}

function testNotification() {
  if (!('Notification' in window)) {
    showToast('浏览器不支持通知');
    return;
  }
  if (Notification.permission !== 'granted') {
    showToast('请先开启通知权限');
    return;
  }
  new Notification('个人 TODO', { body: '测试通知已发送。' });
  showToast('测试通知已发送');
}

async function installPwa() {
  if (!state.deferredInstallPrompt) {
    showToast('当前浏览器暂未提供安装提示');
    await updateSettings({ pwaInstallDismissed: true });
    return;
  }
  state.deferredInstallPrompt.prompt();
  await state.deferredInstallPrompt.userChoice.catch(() => null);
  state.deferredInstallPrompt = null;
  await updateSettings({ pwaInstallDismissed: true });
}

async function logout() {
  await api('/api/auth/logout', { method: 'POST' });
  state.data = null;
  renderLogin();
}

async function archiveProject(id) {
  const response = await api(`/api/projects/${id}`, { method: 'PATCH', body: { archived: true } });
  await refreshFromPayload(response);
  showToast('项目已归档');
}

async function deleteProject(id) {
  if (!confirm('删除项目？确定后任务会移回收件箱。')) return;
  const response = await api(`/api/projects/${id}`, { method: 'DELETE', body: { mode: 'move' } });
  await refreshFromPayload(response);
  navigate('projects');
}

async function addSection(projectId) {
  const project = projectById(projectId);
  if (!project) return;
  const name = prompt('章节名称');
  if (!name) return;
  const sections = [...project.sections, { name, order: project.sections.length + 1 }];
  const response = await api(`/api/projects/${projectId}`, { method: 'PATCH', body: { sections } });
  await refreshFromPayload(response);
}

async function deleteTag(id) {
  if (!confirm('删除标签？任务不会被删除。')) return;
  const response = await api(`/api/tags/${id}`, { method: 'DELETE' });
  await refreshFromPayload(response);
}

async function duplicateFilter(id) {
  const filter = state.data.filters.find(item => item.id === id);
  if (!filter) return;
  const response = await api('/api/filters', { method: 'POST', body: { ...filter, id: undefined, name: `${filter.name} 副本` } });
  await refreshFromPayload(response);
}

async function deleteFilter(id) {
  if (!confirm('删除这个智能过滤器？')) return;
  const response = await api(`/api/filters/${id}`, { method: 'DELETE' });
  await refreshFromPayload(response);
}

function closeDrawer() {
  state.selectedTaskId = null;
}

function closeModals() {
  state.commandOpen = false;
  state.taskModalOpen = false;
  state.projectModalOpen = false;
  state.tagModalOpen = false;
  state.filterModalOpen = false;
  state.filterEditingId = null;
  state.taskModalDefaults = {};
}

function showToast(message) {
  const toast = document.querySelector('[data-toast]');
  if (toast) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  } else {
    state.pendingToast = message;
  }
}

function syncToast() {
  if (state.pendingToast) {
    const message = state.pendingToast;
    state.pendingToast = '';
    requestAnimationFrame(() => showToast(message));
  }
}

function autosizeTextareas() {
  document.querySelectorAll('[data-autosize]').forEach(autosizeTextarea);
}

function autosizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function taskModalDefaults() {
  return {
    dueDate: todayISO(),
    projectId: '',
    sectionId: '',
    tagId: '',
    ...state.taskModalDefaults
  };
}

function defaultsFromPayload(payload = {}) {
  return {
    dueDate: payload.dueDate || todayISO(),
    projectId: payload.projectId || '',
    sectionId: payload.sectionId || '',
    tagId: payload.tagId || ''
  };
}

function openTasks() {
  return state.data.tasks.filter(task => !task.completed);
}

function completedTasks() {
  return state.data.tasks.filter(task => task.completed).sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || '')));
}

function sortTasks(tasks) {
  const priority = { high: 3, medium: 2, low: 1, none: 0 };
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
    if ((priority[a.priority] || 0) !== (priority[b.priority] || 0)) return (priority[b.priority] || 0) - (priority[a.priority] || 0);
    if ((a.dueDate || '') !== (b.dueDate || '')) return String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'));
    return (a.order || 0) - (b.order || 0);
  });
}

function recentTasks(today = todayISO()) {
  return state.data.tasks.filter(task => shouldShowInRecentView(task, today));
}

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

function taskById(id) {
  return state.data?.tasks.find(task => task.id === id) || null;
}

function projectById(id) {
  return state.data?.projects.find(project => project.id === id) || null;
}

function tagById(id) {
  return state.data?.tags.find(tag => tag.id === id) || null;
}

function activeProjects() {
  return state.data.projects.filter(project => !project.archived).sort((a, b) => (a.order || 0) - (b.order || 0));
}

function countOpenByProject(id) {
  return openTasks().filter(task => task.projectId === id).length;
}

function tagTasks(id) {
  return openTasks().filter(task => task.tags.includes(id));
}

function allAttachments() {
  return state.data.tasks.flatMap(task => (task.attachments || []).map(attachment => ({ task, attachment })));
}

function filterTasks(filter) {
  const tasks = openTasks().filter(task => filter.conditions.every(condition => matchCondition(task, condition)));
  return sortTasks(tasks);
}

function matchCondition(task, condition) {
  const value = condition.value;
  if (condition.field === 'priority') return task.priority === value;
  if (condition.field === 'projectId') return task.projectId === value;
  if (condition.field === 'tag') return task.tags.includes(value);
  if (condition.field === 'due') {
    if (value === 'today') return task.dueDate === todayISO();
    if (value === 'upcoming') return task.dueDate && task.dueDate > todayISO();
    if (value === 'none') return !task.dueDate;
    return task.dueDate === value;
  }
  if (condition.field === 'hasAttachment') return Boolean(task.attachments?.length) === Boolean(value);
  if (condition.field === 'hasReminder') return Boolean(task.reminderAt) === Boolean(value);
  if (condition.field === 'completed') return Boolean(task.completed) === Boolean(value);
  return true;
}

function groupedFilterTasks(filter) {
  const tasks = filterTasks(filter);
  if (filter.group === 'project') {
    const ids = [...new Set(tasks.map(task => task.projectId || ''))];
    return ids.map(id => taskGroup(id ? projectById(id)?.name || '未知项目' : '收件箱', tasks.filter(task => (task.projectId || '') === id), ''));
  }
  if (filter.group === 'priority') {
    return ['high','medium','low','none'].map(priority => taskGroup(priorityLabel(priority), tasks.filter(task => task.priority === priority), priority === 'high' ? 'danger' : ''));
  }
  if (filter.group === 'date') {
    return [
      taskGroup('今天', tasks.filter(task => task.dueDate === todayISO()), 'success'),
      taskGroup('未来', tasks.filter(task => task.dueDate && task.dueDate > todayISO()), ''),
      taskGroup('无日期', tasks.filter(task => !task.dueDate), 'muted')
    ];
  }
  return [taskGroup(filter.name, tasks, 'success')];
}

function sidebarCounts() {
  return {
    today: openTasks().filter(task => task.dueDate === todayISO() || (task.dueDate && task.dueDate < todayISO())).length,
    inbox: openTasks().filter(task => !task.projectId).length,
    upcoming: openTasks().filter(task => task.dueDate && task.dueDate > todayISO()).length,
    recent: recentTasks().length,
    calendar: openTasks().filter(task => task.dueDate).length,
    matrix: openTasks().length,
    projects: activeProjects().length,
    tags: state.data.tags.length,
    filters: state.data.filters.length,
    completed: completedTasks().length
  };
}

function todayStats() {
  return [
    { value: openTasks().filter(task => task.dueDate === todayISO()).length, label: '今天待办' },
    { value: openTasks().filter(task => task.dueDate && task.dueDate < todayISO()).length, label: '已逾期' },
    { value: openTasks().filter(task => task.reminderAt?.slice(0, 10) === todayISO()).length, label: '今日提醒' },
    { value: completedTasks().filter(task => task.completedAt?.slice(0, 10) === todayISO()).length, label: '今日已完成' }
  ];
}

function inboxStats() {
  const inbox = openTasks().filter(task => !task.projectId);
  return [
    { value: inbox.length, label: '未整理任务' },
    { value: inbox.filter(task => task.dueDate === todayISO()).length, label: '建议今天处理' },
    { value: inbox.filter(task => !task.dueDate).length, label: '无日期' },
    { value: inbox.filter(task => task.attachments?.length).length, label: '含附件' }
  ];
}

function statsInline(items) {
  return `<div class="stat-strip" style="grid-template-columns:repeat(${items.length},minmax(0,1fr));margin:0;">${items.map(item => `<article class="stat-card"><strong>${escapeHtml(String(item.value))}</strong><span>${escapeHtml(item.label)}</span></article>`).join('')}</div>`;
}

function emptyCard(title, copy) {
  return `<article class="empty-state"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p></article>`;
}

function emptyFull(title, copy) {
  const [eyebrow] = routeMeta();
  return `${pageHeader({ eyebrow, title, subtitle: copy, actions: '' })}<div class="empty-state"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p></div>`;
}

function routeMeta() {
  return routeTitles[state.route.name] || routeTitles.today;
}

function routeIcon() {
  if (state.route.name === 'project') return '●';
  if (state.route.name === 'tag') return '#';
  if (state.route.name === 'filter') return '⚑';
  if (state.route.name === 'matrix') return '⊞';
  if (state.route.name === 'recent') return '↺';
  return navItems.find(item => item.id === state.route.name)?.icon || '✓';
}

function contextLabel(context) {
  if (context.projectId) return projectById(context.projectId)?.name || '当前项目';
  if (context.tagId) return `#${tagById(context.tagId)?.name || '标签'}`;
  if (context.dueDate) return shortDate(context.dueDate);
  return '收件箱';
}

function taskMetaText(task) {
  const project = projectById(task.projectId)?.name || '收件箱';
  const date = task.dueDate ? shortDate(task.dueDate) : '无日期';
  return `${project} · ${date} · ${priorityLabel(task.priority)}`;
}

function filterSummary(filter) {
  const conditionText = filter.conditions.map(condition => `${conditionFieldLabel(condition.field)} ${condition.operator || '是'} ${conditionValueLabel(condition)}`).join('，');
  return `${conditionText || '全部任务'} · 按${sortLabel(filter.sort)}排序 · ${groupLabel(filter.group)}`;
}

function conditionFieldLabel(field) {
  return { priority: '优先级', projectId: '项目', tag: '标签', due: '日期', hasAttachment: '附件', hasReminder: '提醒', completed: '完成状态' }[field] || field;
}

function conditionValueLabel(condition) {
  if (condition.field === 'projectId') return projectById(condition.value)?.name || condition.value;
  if (condition.field === 'tag') return `#${tagById(condition.value)?.name || condition.value}`;
  if (condition.field === 'priority') return priorityLabel(condition.value);
  if (condition.field === 'due') return { today: '今天', upcoming: '未来', none: '无日期' }[condition.value] || condition.value;
  return String(condition.value);
}

function sortLabel(sort) {
  return { dueDate: '截止日期', priority: '优先级', createdAt: '创建时间', updatedAt: '更新时间', manual: '手动' }[sort] || '截止日期';
}

function groupLabel(group) {
  return { none: '不分组', date: '按日期', project: '按项目', tag: '按标签', priority: '按优先级', completion: '按完成状态' }[group] || '不分组';
}

function settingsPanelLabel(id) {
  return { account: '账号与安全', appearance: '外观', notifications: '通知', data: '数据导入导出', attachments: '附件导入导出', about: '应用信息' }[id] || id;
}

function themeLabel(theme) {
  return { system: '跟随系统', light: '浅色', dark: '深色' }[theme] || theme;
}

function notificationState() {
  if (!('Notification' in window)) return '浏览器不支持';
  return { default: '权限未请求', granted: '已允许', denied: '已拒绝' }[Notification.permission] || Notification.permission;
}

function notificationHeading() {
  if (!('Notification' in window)) return '当前浏览器不支持通知';
  if (Notification.permission === 'granted') return '浏览器通知已开启';
  if (Notification.permission === 'denied') return '通知权限已被拒绝';
  return '尚未开启浏览器通知';
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') root.dataset.theme = 'dark';
  else if (theme === 'light') root.dataset.theme = 'light';
  else root.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function dateShortcutOptions() {
  return [
    { label: '无日期', value: '' },
    { label: '今天', value: todayISO() },
    { label: '明天', value: todayISO(1) },
    { label: '本周末', value: nextWeekdayISO(6) },
    { label: '下周一', value: nextWeekdayISO(1) }
  ];
}

function reminderTimeOptions() {
  const defaultTime = state.data?.settings?.defaultReminderTime || '';
  const values = [...new Set([defaultTime, '09:00', '12:00', '18:00', '21:00'].filter(Boolean))];
  return [
    { label: '无提醒', value: '' },
    ...values.map(value => ({ label: value === defaultTime ? `默认 ${value}` : value, value }))
  ];
}

function todayISO(offset = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function nextWeekdayISO(targetDay) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  const currentDay = date.getDay();
  let offset = (targetDay - currentDay + 7) % 7;
  if (offset === 0) offset = 7;
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function dateInputDisplayValue(value) {
  return value ? value.replace(/-/g, '/') : '';
}

function parseDateInput(value, baseValue = todayISO()) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = raw
    .replace(/[年月.]/g, '/')
    .replace(/日/g, '')
    .replace(/-/g, '/')
    .replace(/\s+/g, '');
  const base = new Date(`${baseValue || todayISO()}T12:00:00`);
  let year = base.getFullYear();
  let month = base.getMonth() + 1;
  let day = null;

  if (/^\d{1,2}$/.test(normalized)) {
    day = Number(normalized);
  } else if (/^\d{1,2}\/\d{1,2}$/.test(normalized)) {
    const parts = normalized.split('/').map(Number);
    month = parts[0];
    day = parts[1];
  } else if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(normalized)) {
    const parts = normalized.split('/').map(Number);
    year = parts[0];
    month = parts[1];
    day = parts[2];
  } else if (/^\d{8}$/.test(normalized)) {
    year = Number(normalized.slice(0, 4));
    month = Number(normalized.slice(4, 6));
    day = Number(normalized.slice(6, 8));
  } else {
    return null;
  }

  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function monthGridDays() {
  const base = new Date();
  base.setDate(1);
  base.setHours(12, 0, 0, 0);
  const start = new Date(base);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return Array.from({ length: 35 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

function shortDate(value) {
  if (!value) return '无日期';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  if (value === todayISO()) return '今天';
  if (value === todayISO(1)) return '明天';
  if (value === todayISO(-1)) return '昨天';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatLongDate(value) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(`${value}T12:00:00`));
}

function weekdayName(value) {
  return new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(new Date(`${value}T12:00:00`));
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function localDatetime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function localDateValue(value) {
  return localDatetime(value).slice(0, 10);
}

function localTimeValue(value) {
  return localDatetime(value).slice(11, 16);
}

function dateTimeLocalValue(date, time) {
  return date && time ? `${date}T${time}` : '';
}

function reminderISO(date, time) {
  const value = dateTimeLocalValue(date, time);
  return value ? new Date(value).toISOString() : '';
}

function normalizeReminderInput(value) {
  const raw = String(value || '');
  if (!raw) return '';
  return raw.length === 16 ? new Date(raw).toISOString() : raw;
}

function relativeDate(value) {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知';
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return shortDate(date.toISOString().slice(0, 10));
}

function priorityLabel(priority) {
  return { high: '高优先级', medium: '中优先级', low: '低优先级', none: '普通' }[priority] || '普通';
}

function fileExtension(name) {
  const extension = String(name || '').split('.').pop();
  return extension && extension !== name ? extension.slice(0, 3).toUpperCase() : 'FILE';
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
