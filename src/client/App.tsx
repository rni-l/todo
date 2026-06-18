import type { FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import {
  type AttachmentResponse,
  type DeleteResponse,
  type FilterMutationResponse,
  type ImportDataResponse,
  type ImportPreviewResponse,
  type ProjectMutationResponse,
  type SettingsResponse,
  type TagMutationResponse,
  type TaskMutationResponse,
  UnauthorizedError,
  api,
} from './api.ts';
import {
  AppContext,
  appReducer,
  createInitialState,
  navItems,
  resolvedCreateDefaults,
  routeIcon,
  routeMeta,
  type AppActions,
  type ClientAction,
  type ClientState,
} from './state/appState.ts';
import type { Attachment, CreateTaskDefaults, Priority, Project, PublicData, RouteName, RouteState, SmartFilter, Tag, Task } from './types.ts';
import {
  activeProjects,
  allAttachments,
  archivedProjects,
  calendarDayLimit,
  closedTasks,
  conditionFieldLabel,
  countOpenByProject,
  filterSummary,
  filterTasks,
  groupedFilterTasks,
  matrixQuadrants,
  openTasks,
  projectById,
  projectProgress,
  recentTasks,
  sidebarCounts,
  sortTasks,
  statusLabel,
  tagById,
  tagTasks,
  taskById,
  taskMetaText,
} from './lib/derived.ts';
import {
  buildTaskRangeSegments,
  dateInputDisplayValue,
  formatDateRange,
  formatLongDate,
  formatTime,
  monthGridDays,
  monthWeekdayLabels,
  relativeDate,
  shortDate,
  taskCoversDate,
  taskDateRange,
  todayISO,
  weekdayName,
  getTaskDateStatus,
  type TaskRangeSegment,
} from './lib/dates.ts';
import { buildReportSummary } from './lib/reports.ts';
import { appendSubtasks } from './lib/subtasks.ts';
import { preserveTaskCreateContext } from './lib/taskCreate.ts';
import { fileExtension, formatBytes, groupLabel, priorityLabel, priorityMeta, settingsPanelLabel, sortLabel, themeLabel } from './lib/format.ts';
import './styles/app.css';

const APP_VERSION = (window as Window & { TODO_APP_VERSION?: string }).TODO_APP_VERSION || 'dev';
const PASSWORD_MIN_LENGTH = 3;
const PASSWORD_MAX_LENGTH = 128;
const PASSWORD_RULE_HINT = `至少 ${PASSWORD_MIN_LENGTH} 位，最多 ${PASSWORD_MAX_LENGTH} 位，且同时包含字母和数字；不能与当前密码相同。`;
const SETTINGS_PANELS = ['account', 'appearance', 'notifications', 'data', 'attachments', 'uploadUrl', 'about'] as const;

type StatItem = { value: string | number; label: string };
type ViewGroup = { id?: string; title: string; tasks: Task[]; tone?: 'danger' | 'success' | 'warn' | 'muted' | 'accent' | '' };
type ReadyState = ClientState & { data: PublicData };

function isoDay(value?: string | null) {
  return String(value || '').slice(0, 10);
}

function normalizeClientAccessPrefix(value?: string) {
  const raw = String(value || '/uploads').trim() || '/uploads';
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withSlash.replace(/\/+/g, '/').replace(/\/$/, '') || '/uploads';
}

function attachmentRelativePath(file: Attachment, settings: PublicData['settings']) {
  if (file.relativePath) return file.relativePath;
  if (file.accessPath) return file.accessPath;
  const storageName = String(file.storageName || '');
  if (storageName.includes('/')) return `${normalizeClientAccessPrefix(settings.uploadUrlConfig?.accessPrefix)}/${storageName.replace(/^\/+/, '')}`;
  return '';
}

function attachmentExternalUrl(file: Attachment, settings: PublicData['settings']) {
  const config = settings.uploadUrlConfig || { accessPrefix: '/uploads', baseUrl: '', paramKey: 'path' };
  const baseUrl = String(config.baseUrl || '').trim();
  const paramKey = String(config.paramKey || '').trim();
  const relativePath = attachmentRelativePath(file, settings);
  if (!baseUrl || !paramKey || !relativePath) return '';
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}${encodeURIComponent(paramKey)}=${encodeURIComponent(relativePath)}`;
}

export function App() {
  const [state, dispatch] = useReducer(appReducer, undefined, () => createInitialState());
  const stateRef = useRef(state);
  const toastTimer = useRef<number | null>(null);
  const pendingImportFile = useRef<File | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const putData = useCallback((data: PublicData) => {
    dispatch({ type: 'LOAD_DATA', data });
  }, []);

  const showToast = useCallback((message: string) => {
    dispatch({ type: 'SET_TOAST', toast: message });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => dispatch({ type: 'SET_TOAST', toast: '' }), 1800);
  }, []);

  const actions = useMemo<AppActions>(() => {
    const actionBag: AppActions = {
      navigate(route: string) {
        window.location.hash = `#/${route.replace(/^#\/?/, '')}`;
      },
      async loadData() {
        putData(await api<PublicData>('/api/data'));
      },
      async login(username: string, password: string) {
        await api('/api/auth/login', { method: 'POST', body: { username, password } });
        putData(await api<PublicData>('/api/data'));
      },
      async logout() {
        await api('/api/auth/logout', { method: 'POST' });
        dispatch({ type: 'LOGIN_REQUIRED' });
      },
      openCreate(defaults?: Partial<CreateTaskDefaults>) {
        const current = stateRef.current;
        dispatch({
          type: 'OPEN_CREATE',
          defaults,
          selectedDate: defaults?.dueDate || (current.route.name === 'calendar' ? current.selectedCalendarDate : undefined),
        });
      },
      openDetail(taskId: string) {
        dispatch({ type: 'OPEN_DETAIL', taskId });
      },
      closePanel() {
        dispatch({ type: 'CLOSE_PANEL' });
      },
      setCommandOpen(open: boolean) {
        dispatch({ type: 'SET_COMMAND_OPEN', open });
      },
      closeModals() {
        dispatch({ type: 'SET_MODAL', modal: null });
      },
      openProjectModal(projectId?: string | null) {
        dispatch({ type: 'SET_MODAL', modal: 'project', projectEditingId: projectId || null });
      },
      openTagModal() {
        dispatch({ type: 'SET_MODAL', modal: 'tag' });
      },
      openFilterModal(filterId?: string | null) {
        dispatch({ type: 'SET_MODAL', modal: 'filter', filterEditingId: filterId || null });
      },
      setCalendarMode(mode: ClientState['calendarMode']) {
        dispatch({ type: 'SET_CALENDAR_MODE', mode });
      },
      setSelectedCalendarDate(date: string) {
        dispatch({ type: 'SET_SELECTED_CALENDAR_DATE', date });
      },
      setSettingsPanel(panel: ClientState['settingsPanel']) {
        dispatch({ type: 'SET_SETTINGS_PANEL', panel });
      },
      toggleArchivedSidebar() {
        dispatch({ type: 'TOGGLE_ARCHIVED_SIDEBAR' });
      },
      toggleProjectsArchived() {
        dispatch({ type: 'TOGGLE_PROJECTS_ARCHIVED' });
      },
      toast: showToast,
      async createTask(values, submitMode = 'close') {
        const payload = normalizeTaskPayload(values);
        const response = await api<TaskMutationResponse>('/api/tasks', { method: 'POST', body: payload });
        putData(response.data);
        showToast('任务已添加');
        if (submitMode === 'continue') {
          dispatch({
            type: 'OPEN_CREATE',
            defaults: preserveTaskCreateContext({
              ...payload,
              projectId: payload.projectId || '',
              sectionId: payload.sectionId || '',
              startDate: payload.startDate || '',
              dueDate: payload.dueDate || '',
              reminderAt: payload.reminderAt || '',
              reminderEndAt: payload.reminderEndAt || '',
            }),
          });
        } else {
          dispatch({ type: 'OPEN_DETAIL', taskId: response.task.id });
        }
      },
      async updateTask(taskId, patch, options) {
        const response = await api<TaskMutationResponse>(`/api/tasks/${taskId}`, { method: 'PATCH', body: patch });
        putData(response.data);
        if (!options?.silent) showToast('任务已更新');
      },
      async deleteTask(taskId) {
        if (!confirm('确认删除这个任务？')) return;
        const response = await api<DeleteResponse>(`/api/tasks/${taskId}`, { method: 'DELETE' });
        putData(response.data);
        dispatch({ type: 'CLOSE_PANEL' });
        showToast('任务已删除');
      },
      async closeTask(taskId) {
        await actionBag.updateTask(taskId, { closed: true, completed: false });
      },
      async restoreTask(taskId) {
        await actionBag.updateTask(taskId, { closed: false });
      },
      async toggleTask(taskId) {
        const task = taskById(stateRef.current.data, taskId);
        if (!task) return;
        await actionBag.updateTask(taskId, { completed: !task.completed, ...(task.completed ? {} : { closed: false }) });
      },
      async cyclePriority(taskId) {
        const task = taskById(stateRef.current.data, taskId);
        if (!task) return;
        const order: Priority[] = ['none', 'low', 'medium', 'high'];
        await actionBag.updateTask(taskId, { priority: order[(order.indexOf(task.priority) + 1) % order.length] });
      },
      async toggleUrgent(taskId) {
        const task = taskById(stateRef.current.data, taskId);
        if (!task) return;
        await actionBag.updateTask(taskId, { urgent: !task.urgent });
      },
      async toggleTaskTag(taskId, tagId) {
        const task = taskById(stateRef.current.data, taskId);
        if (!task) return;
        const tags = new Set(task.tags || []);
        if (tags.has(tagId)) tags.delete(tagId);
        else tags.add(tagId);
        await actionBag.updateTask(taskId, { tags: [...tags] });
      },
      async updateSubtasks(taskId, subtasks) {
        await actionBag.updateTask(taskId, { subtasks }, { silent: true });
      },
      async uploadAttachment(taskId, files) {
        for (const file of Array.from(files)) {
          const formData = new FormData();
          formData.set('file', file);
        const response = await api<AttachmentResponse>(`/api/tasks/${taskId}/attachments`, { method: 'POST', body: formData });
        putData(response.data);
      }
        showToast('附件已上传');
      },
      async deleteAttachment(attachmentId) {
        if (!confirm('确认删除这个附件？')) return;
        const response = await api<DeleteResponse>(`/api/attachments/${attachmentId}`, { method: 'DELETE' });
        putData(response.data);
        showToast('附件已删除');
      },
      async saveProject(input, editingId) {
        const response = editingId
          ? await api<ProjectMutationResponse>(`/api/projects/${editingId}`, { method: 'PATCH', body: input })
          : await api<ProjectMutationResponse>('/api/projects', { method: 'POST', body: { ...input, sections: [{ name: '默认', order: 1 }] } });
        putData(response.data);
        dispatch({ type: 'SET_MODAL', modal: null });
        actionBag.navigate(`project/${editingId || response.project.id}`);
      },
      async archiveProject(projectId) {
        const response = await api<ProjectMutationResponse>(`/api/projects/${projectId}`, { method: 'PATCH', body: { archived: true } });
        putData(response.data);
        showToast('项目已归档');
      },
      async restoreProject(projectId) {
        const response = await api<ProjectMutationResponse>(`/api/projects/${projectId}`, { method: 'PATCH', body: { archived: false } });
        putData(response.data);
        showToast('项目已恢复');
      },
      async deleteProject(projectId) {
        if (!confirm('删除项目？确定后任务会移回收件箱。')) return;
        const response = await api<DeleteResponse>(`/api/projects/${projectId}`, { method: 'DELETE', body: { mode: 'move' } });
        putData(response.data);
        actionBag.navigate('projects');
      },
      async addSection(projectId, name) {
        const project = projectById(stateRef.current.data, projectId);
        if (!project) return;
        const sections = [...project.sections, { name, order: project.sections.length + 1 }];
        const response = await api<ProjectMutationResponse>(`/api/projects/${projectId}`, { method: 'PATCH', body: { sections } });
        putData(response.data);
      },
      async createTag(input) {
        const response = await api<TagMutationResponse>('/api/tags', { method: 'POST', body: input });
        putData(response.data);
        dispatch({ type: 'SET_MODAL', modal: null });
        actionBag.navigate(`tag/${response.tag.id}`);
      },
      async deleteTag(tagId) {
        if (!confirm('删除标签？任务不会被删除。')) return;
        const response = await api<DeleteResponse>(`/api/tags/${tagId}`, { method: 'DELETE' });
        putData(response.data);
      },
      async saveFilter(input, editingId) {
        const value = input.value === 'true' ? true : input.value === 'false' ? false : input.value;
        const body = {
          name: input.name,
          pinned: editingId ? undefined : true,
          conditions: [{ field: input.field, operator: 'is', value }],
          sort: 'dueDate',
          group: 'date',
        };
        const response = editingId
          ? await api<FilterMutationResponse>(`/api/filters/${editingId}`, { method: 'PATCH', body })
          : await api<FilterMutationResponse>('/api/filters', { method: 'POST', body });
        putData(response.data);
        dispatch({ type: 'SET_MODAL', modal: null });
        actionBag.navigate(`filter/${editingId || response.filter.id}`);
      },
      async duplicateFilter(filterId) {
        const filter = stateRef.current.data?.filters.find(item => item.id === filterId);
        if (!filter) return;
        const response = await api<FilterMutationResponse>('/api/filters', { method: 'POST', body: { ...filter, id: undefined, name: `${filter.name} 副本` } });
        putData(response.data);
      },
      async deleteFilter(filterId) {
        if (!confirm('删除这个智能过滤器？')) return;
        const response = await api<DeleteResponse>(`/api/filters/${filterId}`, { method: 'DELETE' });
        putData(response.data);
      },
      async updateSettings(patch) {
        const current = stateRef.current.data;
        if (!current) return;
        const response = await api<SettingsResponse>('/api/settings', { method: 'POST', body: patch });
        putData({ ...current, settings: response.settings });
      },
      async changePassword(currentPassword, newPassword) {
        await api('/api/account/password', { method: 'POST', body: { currentPassword, newPassword } });
        showToast('密码已更新');
      },
      async previewImport(file) {
        pendingImportFile.current = file;
        const formData = new FormData();
        formData.set('file', file);
        const response = await api<ImportPreviewResponse>('/api/import/preview', { method: 'POST', body: formData });
        dispatch({ type: 'SET_IMPORT_PREVIEW', preview: response.preview });
      },
      async confirmImport(file) {
        const target = file || pendingImportFile.current;
        if (!target || !confirm('确认替换当前任务数据？')) return;
        const formData = new FormData();
        formData.set('file', target);
        const response = await api<ImportDataResponse>('/api/import/data', { method: 'POST', body: formData });
        pendingImportFile.current = null;
        dispatch({ type: 'SET_IMPORT_PREVIEW', preview: null });
        putData(response.data);
        showToast('数据导入完成');
      },
      async importAttachmentZip(file) {
        const formData = new FormData();
        formData.set('file', file);
        const response = await api<{ ok: true; summary: { matched: number }; data: PublicData }>('/api/import/attachments', { method: 'POST', body: formData });
        putData(response.data);
        showToast(`附件匹配完成：${response.summary.matched} 个`);
      },
      async requestNotifications() {
        if (!('Notification' in window)) {
          showToast('浏览器不支持通知');
          return;
        }
        const permission = await Notification.requestPermission();
        await actionBag.updateSettings({ notificationsEnabled: permission === 'granted' });
      },
      testNotification() {
        if (!('Notification' in window)) {
          showToast('浏览器不支持通知');
          return;
        }
        if (Notification.permission !== 'granted') {
          showToast('请先开启通知权限');
          return;
        }
        new Notification('个人 TODO', { body: '测试通知已发送。' });
      },
      async installPwa() {
        showToast('当前浏览器暂未提供安装提示');
        await actionBag.updateSettings({ pwaInstallDismissed: true });
      },
    };
    return actionBag;
  }, [putData, showToast]);

  useEffect(() => {
    actions.loadData().catch((error: unknown) => {
      if (error instanceof UnauthorizedError) {
        dispatch({ type: 'LOGIN_REQUIRED', error: '请先登录' });
      } else {
        showToast(error instanceof Error ? error.message : '加载失败');
      }
    });
  }, [actions, showToast]);

  useEffect(() => {
    const onHashChange = () => dispatch({ type: 'SET_ROUTE', route: parseHashRoute(window.location.hash) });
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        dispatch({ type: 'SET_COMMAND_OPEN', open: true });
      }
      if (event.key === 'Escape') {
        dispatch({ type: 'SET_COMMAND_OPEN', open: false });
        dispatch({ type: 'SET_MODAL', modal: null });
        dispatch({ type: 'CLOSE_PANEL' });
      }
    };
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    applyTheme(state.data?.settings.theme || 'system');
  }, [state.data?.settings.theme]);

  if (!state.data) {
    return <LoginScreen state={state} actions={actions} dispatch={dispatch} />;
  }
  const readyState = state as ReadyState;

  return (
    <AppContext.Provider value={{ state: readyState, actions }}>
      <AppShell state={readyState} actions={actions} />
    </AppContext.Provider>
  );
}

function parseHashRoute(hash: string): RouteState {
  const normalized = hash.replace(/^#\/?/, '');
  const [rawName = 'today', rawId = null] = normalized.split('/');
  const validRoutes = new Set<RouteName>(navItems.map(item => item.id));
  const detailRoutes = new Set<RouteName>(['project', 'tag', 'filter']);
  const name = rawName as RouteName;
  if (detailRoutes.has(name)) return { name, id: rawId || null };
  if (validRoutes.has(name)) return { name, id: null };
  return { name: 'today', id: null };
}

function normalizeTaskPayload(values: Partial<Task> & { tagId?: string; tags?: string[] }) {
  return {
    title: values.title || '',
    projectId: values.projectId || null,
    sectionId: values.sectionId || null,
    startDate: values.startDate || null,
    dueDate: values.dueDate || null,
    reminderAt: values.reminderAt || null,
    reminderEndAt: values.reminderEndAt || null,
    priority: values.priority || 'none',
    urgent: Boolean(values.urgent),
    tags: [...new Set([...(values.tags || []), ...(values.tagId ? [values.tagId] : [])])],
  };
}

function applyTheme(theme: string) {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}

function LoginScreen({ state, actions, dispatch }: { state: ClientState; actions: AppActions; dispatch: React.Dispatch<ClientAction> }) {
  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={async event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        try {
          await actions.login(String(form.get('username') || ''), String(form.get('password') || ''));
        } catch (error) {
          dispatch({ type: 'SET_LOGIN_ERROR', loginError: error instanceof Error && error.message === 'invalid_credentials' ? '密码错误，请重新输入。' : '登录失败，请稍后重试。' });
        }
      }}>
        <div className="login-title">
          <span className="chip strong">Single User</span>
          <div className="login-brand">
            <div className="brand-mark">✓</div>
            <div>
              <h1>个人 TODO</h1>
              <p>单用户、自托管、服务重启后仍保留登录态。</p>
            </div>
          </div>
        </div>
        <div className="login-points">
          <div className="login-point"><strong>持续登录</strong><span>浏览器会保留当前登录，重启服务后刷新即可继续使用。</span></div>
          <div className="login-point"><strong>首次启动</strong><span>默认账号是 <code>self-hosted-user</code>，默认密码是 <code>todo123456</code>。</span></div>
        </div>
        <label className="field">
          <span>账号</span>
          <input className="input" name="username" defaultValue="self-hosted-user" autoComplete="username" autoCapitalize="off" spellCheck={false} />
        </label>
        <label className="field">
          <span>密码</span>
          <input className="input" name="password" type="password" autoComplete="current-password" required autoFocus />
        </label>
        {state.loginError ? <p className="chip danger">{state.loginError}</p> : null}
        <div className="login-actions">
          <button className="primary-add" type="submit">登录</button>
          <a className="quiet-button" href="/prototype/index.html">查看原型设计稿</a>
        </div>
      </form>
    </div>
  );
}

function AppShell({ state, actions }: { state: ReadyState; actions: AppActions }) {
  const selectedTask = taskById(state.data, state.selectedTaskId);
  const hasPanel = state.rightPanelMode === 'create' || (state.rightPanelMode === 'detail' && selectedTask);
  return (
    <>
      <div className="mobile-topbar">
        <div className="brand-row" style={{ padding: 0 }}>
          <div className="brand-mark">{routeIcon(state.route)}</div>
          <div className="brand-copy"><strong>{routeMeta(state.route)[1]}</strong><span>{openTasks(state.data).length} 项未完成</span></div>
        </div>
        <button className="icon-btn" type="button" onClick={() => actions.setCommandOpen(true)}>⌘</button>
      </div>
      <main className={`app-shell ${hasPanel ? 'has-right-panel' : ''} ${state.data.settings.dockDrawer ? 'right-panel-docked' : ''} ${state.data.settings.sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Sidebar state={state} actions={actions} />
        <section className="main-pane"><MainView state={state} actions={actions} /></section>
        {hasPanel ? <RightPanel state={state} actions={actions} task={selectedTask} /> : null}
      </main>
      <MobileBottom state={state} actions={actions} />
      <button className="fab" type="button" onClick={() => actions.openCreate()}>+</button>
      <ProjectModal state={state} actions={actions} />
      <TagModal state={state} actions={actions} />
      <FilterModal state={state} actions={actions} />
      <CommandModal state={state} actions={actions} />
      <div className={`toast ${state.toast ? 'show' : ''}`}>{state.toast}</div>
    </>
  );
}

function Sidebar({ state, actions }: { state: ReadyState; actions: AppActions }) {
  const counts = sidebarCounts(state.data, todayISO());
  const active = activeProjects(state.data);
  const archived = archivedProjects(state.data);
  const showArchived = state.archivedSidebarOpen || (state.route.name === 'project' && projectById(state.data, state.route.id)?.archived);
  const pinnedFilters = state.data.filters.filter(filter => filter.pinned).slice(0, 4);
  return (
    <aside className="sidebar">
      <div className="brand-row">
        <div className="brand-mark">✓</div>
        <div className="brand-copy"><strong>个人 TODO</strong><span>自托管工作台</span></div>
        <button className="icon-btn sidebar-collapse-btn" type="button" onClick={() => actions.updateSettings({ sidebarCollapsed: !state.data.settings.sidebarCollapsed })}>{state.data.settings.sidebarCollapsed ? '›' : '‹'}</button>
      </div>
      <button className="primary-add sidebar-add" type="button" onClick={() => actions.openCreate()}><span>+</span><span className="nav-label">新建任务</span></button>
      <NavBlock title="主要视图">
        {['today', 'inbox', 'upcoming', 'recent', 'calendar', 'matrix', 'reports'].map(id => {
          const item = navItems.find(nav => nav.id === id)!;
          return <NavButton key={id} active={state.route.name === id} icon={item.icon} label={item.label} count={counts[item.id as keyof typeof counts]} onClick={() => actions.navigate(item.id)} />;
        })}
      </NavBlock>
      <NavBlock title="组织">
        <NavButton active={state.route.name === 'tags' || state.route.name === 'tag'} icon="#" label="标签" count={counts.tags} onClick={() => actions.navigate('tags')} />
        <NavButton active={state.route.name === 'filters' || state.route.name === 'filter'} icon="⚑" label="智能过滤器" count={counts.filters} onClick={() => actions.navigate('filters')} />
        <NavButton active={state.route.name === 'completed'} icon="✓" label="已完成" count={counts.completed} onClick={() => actions.navigate('completed')} />
        <NavButton active={state.route.name === 'closed'} icon="⊘" label="已关闭" count={counts.closed} onClick={() => actions.navigate('closed')} />
      </NavBlock>
      <NavBlock title="项目">
        <NavButton active={state.route.name === 'projects'} icon="●" label="全部项目" count={counts.projects} onClick={() => actions.navigate('projects')} />
        {active.map(project => <ProjectNav key={project.id} data={state.data} project={project} selected={state.route.name === 'project' && state.route.id === project.id} onClick={() => actions.navigate(`project/${project.id}`)} />)}
      </NavBlock>
      <NavBlock title="归档项目">
        <button className={`nav-item nav-toggle ${showArchived ? 'active' : ''}`} type="button" onClick={() => actions.toggleArchivedSidebar()}>
          <span>{showArchived ? '▾' : '▸'}</span><span>归档项目</span><span className="nav-count">{archived.length}</span>
        </button>
        {showArchived ? archived.map(project => <ProjectNav key={project.id} data={state.data} project={project} selected={state.route.name === 'project' && state.route.id === project.id} archived onClick={() => actions.navigate(`project/${project.id}`)} />) : null}
      </NavBlock>
      <div className="sidebar-bottom">
        {pinnedFilters.map(filter => <NavButton key={filter.id} active={state.route.name === 'filter' && state.route.id === filter.id} icon="⚑" label={filter.name} count={filterTasks(state.data, filter).length} onClick={() => actions.navigate(`filter/${filter.id}`)} />)}
        <NavButton active={state.route.name === 'settings'} icon="⚙" label="设置" count="" onClick={() => actions.navigate('settings')} />
      </div>
    </aside>
  );
}

function NavBlock({ title, children }: { title: string; children: ReactNode }) {
  return <nav className="nav-block"><div className="nav-heading">{title}</div>{children}</nav>;
}

function NavButton({ active, icon, label, count, onClick }: { active: boolean; icon: string; label: string; count: string | number; onClick(): void }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} type="button" onClick={onClick}>
      <span>{icon}</span><span>{label}</span>{count === '' ? <span /> : <span className="nav-count">{count}</span>}
    </button>
  );
}

function ProjectNav({ data, project, selected, archived = false, onClick }: { data: PublicData; project: Project; selected: boolean; archived?: boolean; onClick(): void }) {
  return (
    <button className={`nav-item ${selected ? 'active' : ''}`} type="button" onClick={onClick}>
      <span className={`project-dot ${project.color || ''}`} /><span>{project.name}{archived ? ' · 已归档' : ''}</span><span className="nav-count">{countOpenByProject(data, project.id)}</span>
    </button>
  );
}

function MobileBottom({ state, actions }: { state: ReadyState; actions: AppActions }) {
  return (
    <nav className="mobile-bottom" aria-label="移动端导航">
      {navItems.filter(item => item.mobile).map(item => {
        const active = state.route.name === item.id || (item.id === 'projects' && state.route.name === 'project') || (item.id === 'settings' && ['settings', 'tags', 'filters', 'completed', 'closed', 'tag', 'filter'].includes(state.route.name));
        return <button key={item.id} className={active ? 'active' : ''} type="button" onClick={() => actions.navigate(item.id)}>{item.mobileLabel || item.label}</button>;
      })}
    </nav>
  );
}

function MainView({ state, actions }: { state: ReadyState; actions: AppActions }) {
  const data = state.data;
  switch (state.route.name) {
    case 'today':
      return <TaskListView state={state} actions={actions} eyebrow="TODAY · 今日执行" title="今日" subtitle={`${formatLongDate(todayISO())} · 今日承诺、逾期和提醒集中处理。`} stats={todayStats(data)} quickContext={{ dueDate: todayISO() }} placeholder="添加一个今天要处理的任务" groups={[
        group('已逾期', openTasks(data).filter(task => {
          const endDate = taskDateRange(task).endDate;
          return Boolean(endDate && endDate < todayISO());
        }), 'danger'),
        group('今天', openTasks(data).filter(task => taskCoversDate(task, todayISO())), 'success'),
        group('无提醒时间', openTasks(data).filter(task => taskCoversDate(task, todayISO()) && !task.reminderAt), 'muted'),
        group('今日已完成', data.tasks.filter(task => task.completed && isoDay(task.completedAt) === todayISO()), 'muted'),
      ]} />;
    case 'inbox':
      return <TaskListView state={state} actions={actions} eyebrow="INBOX · 默认捕获容器" title="收件箱" subtitle="没有指定项目的新任务会先进入这里。这个页面重点支持整理，而不是长期囤积。" stats={inboxStats(data)} quickContext={{ projectId: '', dueDate: '' }} placeholder="快速记录一个想法，默认无项目、无日期" groups={[group('未整理', openTasks(data).filter(task => !task.projectId), 'success')]} />;
    case 'upcoming':
      return <UpcomingView state={state} actions={actions} />;
    case 'recent':
      return <RecentView state={state} actions={actions} />;
    case 'calendar':
      return <CalendarView state={state} actions={actions} />;
    case 'matrix':
      return <MatrixView state={state} actions={actions} />;
    case 'reports':
      return <ReportsView state={state} actions={actions} />;
    case 'projects':
      return <ProjectsView state={state} actions={actions} />;
    case 'project':
      return <ProjectView state={state} actions={actions} />;
    case 'tags':
      return <TagsView state={state} actions={actions} />;
    case 'tag':
      return <TagView state={state} actions={actions} />;
    case 'filters':
      return <FiltersView state={state} actions={actions} />;
    case 'filter':
      return <FilterView state={state} actions={actions} />;
    case 'completed':
      return <TaskListView state={state} actions={actions} eyebrow="COMPLETED · 完成记录" title="已完成" subtitle="查看和恢复已完成任务。恢复后任务回到原项目和原日期。" stats={completedStats(data)} quickContext={{}} placeholder="添加任务" groups={[
        group('今天', data.tasks.filter(task => task.completed && isoDay(task.completedAt) === todayISO()), 'success'),
        group('本周', data.tasks.filter(task => task.completed && isoDay(task.completedAt) >= todayISO(-7) && isoDay(task.completedAt) !== todayISO()), ''),
        group('更早', data.tasks.filter(task => task.completed && isoDay(task.completedAt) < todayISO(-7)), 'muted'),
      ]} />;
    case 'closed':
      return <TaskListView state={state} actions={actions} eyebrow="CLOSED · 取消记录" title="已关闭" subtitle="关闭表示任务不再处理，不等于完成；恢复后任务会回到未完成视图。" stats={closedStats(data)} quickContext={{}} placeholder="添加任务" groups={[
        group('今天', closedTasks(data).filter(task => isoDay(task.closedAt) === todayISO()), 'warn'),
        group('本周', closedTasks(data).filter(task => isoDay(task.closedAt) >= todayISO(-7) && isoDay(task.closedAt) !== todayISO()), ''),
        group('更早', closedTasks(data).filter(task => isoDay(task.closedAt) < todayISO(-7)), 'muted'),
      ]} />;
    case 'settings':
      return <SettingsView state={state} actions={actions} />;
    default:
      return <EmptyState title="视图不存在" copy="已回到默认工作台。" />;
  }
}

function TaskListView({ state, actions, eyebrow, title, subtitle, stats, quickContext, placeholder, groups, extraActions }: {
  state: ReadyState;
  actions: AppActions;
  eyebrow: string;
  title: string;
  subtitle: string;
  stats: StatItem[];
  quickContext: Partial<CreateTaskDefaults>;
  placeholder: string;
  groups: ViewGroup[];
  extraActions?: ReactNode;
}) {
  return (
    <>
      <PageHeader state={state} actions={actions} eyebrow={eyebrow} title={title} subtitle={subtitle} extraActions={extraActions} />
      <Stats items={stats} />
      <QuickAdd actions={actions} placeholder={placeholder} context={quickContext} />
      <section className="task-board">
        {groups.map(item => <TaskGroup key={item.id || item.title} state={state} actions={actions} item={item} />)}
      </section>
    </>
  );
}

function PageHeader({ state, actions, eyebrow, title, subtitle, extraActions }: { state: ReadyState; actions: AppActions; eyebrow: string; title: string; subtitle: string; extraActions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <div className="page-title-row">
          <span className="page-icon">{routeIcon(state.route)}</span>
          <h1 className="page-title">{title}</h1>
          <span className="page-context">{eyebrow.split('·')[0].trim()}</span>
        </div>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      <div className="header-actions">
        <button className="quiet-button" type="button" onClick={() => actions.setCommandOpen(true)}>搜索 <span className="shortcut">⌘K</span></button>
        {extraActions}
        <button className="soft-button" type="button" onClick={() => actions.openCreate()}>新建任务</button>
      </div>
    </header>
  );
}

function Stats({ items }: { items: StatItem[] }) {
  return <div className="stat-strip">{items.map(item => <article className="stat-card" key={item.label}><strong>{item.value}</strong><span>{item.label}</span></article>)}</div>;
}

function QuickAdd({ actions, placeholder, context }: { actions: AppActions; placeholder: string; context: Partial<CreateTaskDefaults> }) {
  return (
    <form className="quick-add" onSubmit={async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const title = String(form.get('title') || '').trim();
      if (!title) return;
      await actions.createTask({
        title,
        projectId: context.projectId || null,
        sectionId: context.sectionId || null,
        tagId: context.tagId || '',
        dueDate: context.dueDate || null,
      }, 'close');
      event.currentTarget.reset();
    }}>
      <input name="title" autoComplete="off" placeholder={placeholder} />
      <span className="chip">{context.projectId ? '当前项目' : '收件箱'}</span>
      {context.dueDate ? <span className="chip">{shortDate(context.dueDate)}</span> : null}
      <button className="soft-button mobile-visible" type="submit">添加</button>
    </form>
  );
}

function TaskGroup({ state, actions, item }: { state: ReadyState; actions: AppActions; item: ViewGroup }) {
  return (
    <section className="group">
      <div className="group-header">
        <div className="group-title"><span className={`dot ${item.tone || ''}`} />{item.title}</div>
        <div className="group-meta">{item.tasks.length} 项</div>
      </div>
      <div className="task-list">
        {item.tasks.length ? item.tasks.map(task => <TaskRow key={task.id} state={state} actions={actions} task={task} />) : <EmptyCompact text="这里没有任务" />}
      </div>
    </section>
  );
}

function TaskRow({ state, actions, task }: { state: ReadyState; actions: AppActions; task: Task }) {
  const project = projectById(state.data, task.projectId);
  const tags = task.tags.map(id => tagById(state.data, id)).filter(Boolean) as Tag[];
  const priority = priorityMeta(task.priority);
  const dateStatus = getTaskDateStatus(task, todayISO());
  return (
    <button className={`task-row ${task.completed ? 'done' : ''} ${task.closed ? 'closed' : ''} ${state.selectedTaskId === task.id ? 'selected' : ''}`} type="button" onClick={() => actions.openDetail(task.id)}>
      <span className="check" onClick={event => { event.stopPropagation(); actions.toggleTask(task.id); }}>✓</span>
      <span className={`priority ${priority.key}`} />
      <span>
        <span className="task-title">{task.title}</span>
        <span className="task-meta">
          <span className={`mini-tag task-date-tag ${dateStatus.tone}`}>{taskDateLabel(task)}</span>
          {task.priority !== 'none' ? <span className={`mini-tag ${priority.tone}`}>{priority.shortLabel}</span> : null}
          {task.urgent ? <span className="mini-tag urgent">紧急</span> : null}
          {task.reminderAt ? <span className="mini-tag">{taskReminderLabel(task)}</span> : null}
          <span className="mini-tag">{project ? `${project.name}${project.archived ? ' · 已归档' : ''}` : '收件箱'}</span>
          {tags.map(tag => <span className="mini-tag" key={tag.id}>#{tag.name}</span>)}
          {task.attachments?.length ? <span className="mini-tag">{task.attachments.length} 个附件</span> : null}
        </span>
      </span>
      <span className="task-actions">
        <span className="tiny-action" onClick={event => { event.stopPropagation(); actions.updateTask(task.id, { dueDate: todayISO(1) }); }}>明天</span>
        <span className="tiny-action" onClick={event => { event.stopPropagation(); actions.toggleUrgent(task.id); }}>{task.urgent ? '取消紧急' : '标紧急'}</span>
        <span className="tiny-action" onClick={event => { event.stopPropagation(); actions.cyclePriority(task.id); }}>优先级</span>
        <span className="tiny-action" onClick={event => { event.stopPropagation(); task.closed ? actions.restoreTask(task.id) : actions.closeTask(task.id); }}>{task.closed ? '恢复' : '关闭'}</span>
      </span>
    </button>
  );
}

function taskDateLabel(task: Task) {
  const status = getTaskDateStatus(task, todayISO());
  const range = taskDateRange(task);
  const dateText = formatDateRange(range.startDate, range.endDate);
  if (status.key === 'overdue') return `已过期 · ${dateText}`;
  if (status.key === 'today') return range.startDate !== range.endDate ? dateText : '今天';
  if (status.key === 'future') return dateText;
  return '无日期';
}

function taskReminderLabel(task: Task) {
  if (!task.reminderAt) return '';
  const start = formatTime(task.reminderAt);
  const end = task.reminderEndAt ? formatTime(task.reminderEndAt) : '';
  return end ? `${start}-${end} 提醒` : `${start} 提醒`;
}

function group(title: string, tasks: Task[], tone: ViewGroup['tone'] = ''): ViewGroup {
  return { id: title, title, tasks: sortTasks(tasks), tone };
}

function EmptyCompact({ text }: { text: string }) {
  return <div className="empty-state compact-empty"><h2>空</h2><p>{text}</p></div>;
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return <div className="empty-state"><h2>{title}</h2><p>{copy}</p></div>;
}

function todayStats(data: PublicData): StatItem[] {
  return [
    { value: openTasks(data).filter(task => {
      const endDate = taskDateRange(task).endDate;
      return Boolean(endDate && endDate < todayISO());
    }).length, label: '已逾期' },
    { value: openTasks(data).filter(task => taskCoversDate(task, todayISO())).length, label: '今天待办' },
    { value: openTasks(data).filter(task => task.reminderAt).length, label: '有提醒' },
    { value: data.tasks.filter(task => task.completed && isoDay(task.completedAt) === todayISO()).length, label: '今日已完成' },
  ];
}

function inboxStats(data: PublicData): StatItem[] {
  const inbox = openTasks(data).filter(task => !task.projectId);
  return [
    { value: inbox.length, label: '未整理' },
    { value: inbox.filter(task => taskCoversDate(task, todayISO())).length, label: '建议今天处理' },
    { value: inbox.filter(task => !taskDateRange(task).endDate).length, label: '无日期' },
    { value: inbox.filter(task => task.attachments?.length).length, label: '含附件' },
  ];
}

function completedStats(data: PublicData): StatItem[] {
  const completed = data.tasks.filter(task => task.completed);
  return [
    { value: completed.length, label: '已完成总数' },
    { value: completed.filter(task => isoDay(task.completedAt) === todayISO()).length, label: '今天完成' },
    { value: completed.filter(task => isoDay(task.completedAt) >= todayISO(-7)).length, label: '本周完成' },
    { value: completed.filter(task => task.attachments?.length).length, label: '含附件' },
  ];
}

function closedStats(data: PublicData): StatItem[] {
  const closed = closedTasks(data);
  return [
    { value: closed.length, label: '已关闭总数' },
    { value: closed.filter(task => isoDay(task.closedAt) === todayISO()).length, label: '今天关闭' },
    { value: closed.filter(task => isoDay(task.closedAt) >= todayISO(-7)).length, label: '本周关闭' },
    { value: closed.filter(task => task.recurrence).length, label: '重复任务' },
  ];
}

function UpcomingView({ state, actions }: { state: ReadyState; actions: AppActions }) {
  const tasks = openTasks(state.data);
  return <TaskListView state={state} actions={actions} eyebrow="UPCOMING · 轻量计划" title="即将到来" subtitle="按日期分组查看未来任务，可用快捷按钮改期。" stats={[
    { value: tasks.filter(task => {
      const endDate = taskDateRange(task).endDate;
      return Boolean(endDate && endDate > todayISO());
    }).length, label: '未来任务' },
    { value: tasks.filter(task => taskCoversDate(task, todayISO(1))).length, label: '明天' },
    { value: tasks.filter(task => !taskDateRange(task).endDate).length, label: '无日期' },
  ]} quickContext={{ dueDate: todayISO(1) }} placeholder="添加一个未来任务" groups={[
    group('明天', tasks.filter(task => taskCoversDate(task, todayISO(1))), 'success'),
    group('本周', tasks.filter(task => {
      const endDate = taskDateRange(task).endDate;
      return Boolean(endDate && endDate <= todayISO(7) && endDate >= todayISO(2));
    }), 'warn'),
    group('以后', tasks.filter(task => {
      const endDate = taskDateRange(task).endDate;
      return Boolean(endDate && endDate > todayISO(7));
    }), 'muted'),
    group('无日期', tasks.filter(task => !taskDateRange(task).endDate), 'muted'),
  ]} />;
}

function RecentView({ state, actions }: { state: ReadyState; actions: AppActions }) {
  const tasks = recentTasks(state.data, todayISO());
  const days = Array.from({ length: 7 }, (_, index) => todayISO(index));
  return <TaskListView state={state} actions={actions} eyebrow="RECENT · 最近7天" title="最近7天" subtitle="显示所有逾期任务，以及今天起未来七天内的待办任务。" stats={[
    { value: tasks.length, label: '窗口任务' },
    { value: tasks.filter(task => getTaskDateStatus(task, todayISO()).key === 'overdue').length, label: '已逾期' },
    { value: tasks.filter(task => taskCoversDate(task, todayISO())).length, label: '今天' },
  ]} quickContext={{ dueDate: todayISO() }} placeholder="添加一个今天要处理的任务" groups={[
    group('已过期', tasks.filter(task => getTaskDateStatus(task, todayISO()).key === 'overdue'), 'danger'),
    group('今天', tasks.filter(task => taskCoversDate(task, todayISO())), 'success'),
    ...days.slice(1).map(day => group(shortDate(day), tasks.filter(task => taskCoversDate(task, day)), 'accent')),
  ].filter(item => item.tasks.length)} />;
}

function CalendarView({ state, actions }: { state: ReadyState; actions: AppActions }) {
  const monthDays = monthGridDays();
  const weekDays = Array.from({ length: 7 }, (_, index) => todayISO(index - 2));
  const selected = state.selectedCalendarDate || todayISO();
  const days = state.calendarMode === 'week' ? weekDays.map(date => ({ date, inMonth: true })) : monthDays;
  const dayDates = days.map(day => day.date);
  const tasks = openTasks(state.data);
  const limit = calendarDayLimit(state.data);
  const rangeTasks = tasks.filter(isTaskRange);
  const rangeRows = calendarRangeRowCount(rangeTasks, dayDates, limit);
  return (
    <>
      <PageHeader state={state} actions={actions} eyebrow="CALENDAR · 日期分布" title="日历" subtitle={`已选 ${formatLongDate(selected)}。点击日期后，新建任务默认带入这个日期。`} extraActions={<>
        <button className="quiet-button" type="button" onClick={() => actions.setSelectedCalendarDate(todayISO())}>今天</button>
        <div className="segmented">
          <button className={state.calendarMode === 'week' ? 'active' : ''} type="button" onClick={() => actions.setCalendarMode('week')}>周</button>
          <button className={state.calendarMode === 'month' ? 'active' : ''} type="button" onClick={() => actions.setCalendarMode('month')}>月</button>
        </div>
      </>} />
      <Stats items={[
        { value: openTasks(state.data).filter(task => taskDateRange(task).endDate).length, label: '有日期任务' },
        { value: openTasks(state.data).filter(task => taskCoversDate(task, todayISO())).length, label: '今天' },
        { value: openTasks(state.data).filter(task => task.reminderAt).length, label: '有提醒' },
        { value: openTasks(state.data).filter(task => task.recurrence).length, label: '重复任务' },
      ]} />
      <section className="calendar-shell">
        {state.calendarMode === 'month' ? <div className="month-weekdays">{monthWeekdayLabels().map(label => <span key={label}>{label}</span>)}</div> : null}
        <div className={`${state.calendarMode === 'week' ? 'week-grid' : 'month-grid'} calendar-range-grid`} style={{ '--range-rows': rangeRows } as React.CSSProperties}>
          {days.map((day, index) => <CalendarCell key={day.date} state={state} actions={actions} day={day} index={index} />)}
          <CalendarRangeLayer actions={actions} days={dayDates} limit={limit} rangeTasks={rangeTasks} />
        </div>
      </section>
    </>
  );
}

function CalendarCell({ state, actions, day, index }: { state: ReadyState; actions: AppActions; day: { date: string; inMonth: boolean }; index: number }) {
  const allDayTasks = openTasks(state.data).filter(task => taskCoversDate(task, day.date));
  const tasks = sortTasks(allDayTasks.filter(task => !isTaskRange(task)));
  const visible = tasks.slice(0, calendarDayLimit(state.data));
  const isMonth = state.calendarMode === 'month';
  const style = isMonth ? { gridColumn: (index % 7) + 1, gridRow: Math.floor(index / 7) + 1 } : { gridColumn: index + 1, gridRow: 1 };
  return (
    <article className={`${isMonth ? 'calendar-day' : 'day-column'} ${day.date === todayISO() ? 'today' : ''} ${day.date === state.selectedCalendarDate ? 'selected' : ''} ${day.inMonth ? '' : 'muted'}`} style={style} onClick={() => actions.setSelectedCalendarDate(day.date)}>
      <div className="day-head"><strong>{isMonth ? Number(day.date.slice(8, 10)) : weekdayName(day.date)}</strong><span>{isMonth ? allDayTasks.length : `${shortDate(day.date)} · ${allDayTasks.length}`}</span></div>
      {visible.map(task => <button className={`calendar-pill ${task.priority}`} type="button" key={task.id} onClick={event => { event.stopPropagation(); actions.openDetail(task.id); }}><strong>{task.title}</strong><span>{formatDateRange(task.startDate, task.dueDate)}</span></button>)}
      {tasks.length > visible.length ? <button className="tiny-action" type="button">还有 {tasks.length - visible.length} 项</button> : null}
      {!isMonth ? <button className="tiny-action" type="button" onClick={event => { event.stopPropagation(); actions.openCreate({ dueDate: day.date }); }}>+ 在这天新建</button> : null}
    </article>
  );
}

function CalendarRangeLayer({ actions, days, limit, rangeTasks }: { actions: AppActions; days: string[]; limit: number; rangeTasks: Task[] }) {
  const weeks = [];
  for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7));
  return (
    <>
      {weeks.map((week, rowIndex) => {
        const segments = sortCalendarSegments(buildTaskRangeSegments(rangeTasks, week));
        const visible = segments.slice(0, limit);
        const hidden = Math.max(0, segments.length - visible.length);
        return (
          <div className="calendar-range-layer" key={week[0] || rowIndex} style={{ '--week-row': rowIndex + 1, '--range-count': visible.length } as React.CSSProperties}>
            {visible.map((segment, segmentIndex) => <CalendarRangeBar actions={actions} key={`${segment.task.id}-${segment.visibleStart}`} segment={segment} row={segmentIndex + 1} />)}
            {hidden ? <button className="calendar-range-more tiny-action" type="button" style={{ '--range-row': visible.length + 1 } as React.CSSProperties} onClick={event => { event.stopPropagation(); actions.setSelectedCalendarDate(week[0]); }}>还有 {hidden} 项范围任务</button> : null}
          </div>
        );
      })}
    </>
  );
}

function CalendarRangeBar({ actions, segment, row }: { actions: AppActions; segment: TaskRangeSegment<Task>; row: number }) {
  const priority = priorityMeta(segment.task.priority).key;
  const className = [
    'calendar-range-bar',
    priority,
    segment.continuesBefore ? 'continues-before' : '',
    segment.continuesAfter ? 'continues-after' : ''
  ].filter(Boolean).join(' ');
  return (
    <button className={className} type="button" style={{ '--range-start': segment.startIndex + 1, '--range-span': segment.span, '--range-row': row } as React.CSSProperties} onClick={event => { event.stopPropagation(); actions.openDetail(segment.task.id); }}>
      <span>{segment.continuesBefore ? '‹ ' : ''}{segment.task.title}{segment.continuesAfter ? ' ›' : ''}</span>
      <small>{formatDateRange(segment.startDate, segment.endDate)}</small>
    </button>
  );
}

function calendarRangeRowCount(rangeTasks: Task[], days: string[], limit: number) {
  let max = 0;
  for (let index = 0; index < days.length; index += 7) {
    const week = days.slice(index, index + 7);
    max = Math.max(max, Math.min(limit, buildTaskRangeSegments(rangeTasks, week).length));
  }
  return max;
}

function sortCalendarSegments(segments: TaskRangeSegment<Task>[]) {
  return [...segments].sort((a, b) => {
    if (a.startIndex !== b.startIndex) return a.startIndex - b.startIndex;
    if (a.span !== b.span) return b.span - a.span;
    return priorityMeta(b.task.priority).weight - priorityMeta(a.task.priority).weight;
  });
}

function isTaskRange(task: Task) {
  const range = taskDateRange(task);
  return Boolean(range.startDate && range.endDate && range.startDate !== range.endDate);
}

function MatrixView({ state, actions }: { state: ReadyState; actions: AppActions }) {
  const quadrants = matrixQuadrants(state.data);
  return (
    <>
      <PageHeader state={state} actions={actions} eyebrow="MATRIX · 重要紧急" title="四象限" subtitle="根据任务优先级判断重要性，根据紧急标记判断紧急性。" />
      <Stats items={quadrants.map(item => ({ value: item.tasks.length, label: item.title }))} />
      <section className="matrix-grid">
        {quadrants.map(item => <TaskGroup key={item.key} state={state} actions={actions} item={{ id: item.key, title: item.title, tasks: item.tasks, tone: item.tone }} />)}
      </section>
    </>
  );
}

function ReportsView({ state, actions }: { state: ReadyState; actions: AppActions }) {
  const report = buildReportSummary(state.data, todayISO());
  return (
    <>
      <PageHeader state={state} actions={actions} eyebrow="REPORTS · 数据概览" title="统计" subtitle="用当前任务数据看今天压力、未来七天负载和项目分布，不做重型仪表盘。" extraActions={<button className="quiet-button" type="button" onClick={() => actions.navigate('calendar')}>查看日历</button>} />
      <Stats items={[
        { value: report.summary.open, label: '未完成' },
        { value: report.summary.overdue, label: '已逾期' },
        { value: report.summary.dueToday, label: '今天到期' },
        { value: report.summary.completedThisWeek, label: '本周完成' },
        { value: report.summary.closed, label: '已关闭' },
      ]} />
      <section className="reports-grid">
        <section className="group report-hero">
          <div className="group-header"><div className="group-title"><span className="dot accent" />执行快照</div><div className="group-meta">今日 / 本周</div></div>
          <div className="report-hero-body">
            <MetricCard value={report.summary.completedToday} label="今日完成" />
            <MetricCard value={report.insights.upcomingWeek} label="未来7天有日期任务" />
            <MetricCard value={report.insights.urgentOpen} label="当前紧急任务" />
            <MetricCard value={report.insights.inboxOpen} label="收件箱未整理" />
          </div>
        </section>
        <MetricPanel title="优先级分布" values={report.priorityBreakdown.map(item => ({ label: priorityLabel(item.key), value: item.count, tone: priorityMeta(item.key).key }))} />
        <MetricPanel title="未来7天负载" values={report.dueBuckets.map(item => ({ label: shortDate(item.day), value: item.count, tone: item.day === todayISO() ? 'success' : 'accent' }))} />
        <section className="group">
          <div className="group-header"><div className="group-title"><span className="dot warn" />状态桶</div><div className="group-meta">全部任务</div></div>
          <div className="report-chip-grid">{report.statusBuckets.map(item => <article className="report-chip-card" key={item.key}><strong>{item.count}</strong><span>{statusLabel(item.key)}</span></article>)}</div>
        </section>
        <section className="group report-projects">
          <div className="group-header"><div className="group-title"><span className="dot" />项目工作量</div><div className="group-meta">{report.projectBreakdown.length} 个项目</div></div>
          <div className="report-project-list">
            {report.projectBreakdown.map(project => <article className="report-project-row" key={project.id}><div><strong>{project.name}</strong><span>{project.overdue ? `${project.overdue} 项逾期` : '无逾期'}</span></div><div className="report-project-meta"><span className="mini-tag">{project.open} 未完成</span><span className="mini-tag">{project.completed} 已完成</span><span className="mini-tag">{project.closed} 已关闭</span></div></article>)}
          </div>
        </section>
      </section>
    </>
  );
}

function MetricCard({ value, label }: { value: string | number; label: string }) {
  return <article className="report-hero-metric"><strong>{value}</strong><span>{label}</span></article>;
}

function MetricPanel({ title, values }: { title: string; values: Array<{ label: string; value: number; tone?: string }> }) {
  const max = Math.max(...values.map(item => item.value), 1);
  return (
    <section className="group">
      <div className="group-header"><div className="group-title"><span className="dot success" />{title}</div><div className="group-meta">{values.reduce((sum, item) => sum + item.value, 0)} 项</div></div>
      <div className="report-list">{values.map(item => <div className="metric-bar" key={item.label}><div className="metric-bar-head"><span>{item.label}</span><strong>{item.value}</strong></div><div className="metric-bar-track"><span className={`metric-bar-fill ${item.tone || 'accent'}`} style={{ width: `${Math.max(8, Math.round((item.value / max) * 100))}%` }} /></div></div>)}</div>
    </section>
  );
}

function ProjectsView({ state, actions }: { state: ReadyState; actions: AppActions }) {
  const active = activeProjects(state.data);
  const archived = archivedProjects(state.data);
  return (
    <>
      <PageHeader state={state} actions={actions} eyebrow="PROJECTS · 任务组织" title="项目" subtitle="项目是任务的主要容器。每个任务只能属于一个项目，可在项目内继续分章节整理。" extraActions={<><button className="soft-button" type="button" onClick={() => actions.openProjectModal()}>新建项目</button><button className="quiet-button" type="button" onClick={() => actions.toggleProjectsArchived()}>{state.projectsShowArchived ? '隐藏已归档' : `显示已归档${archived.length ? ` (${archived.length})` : ''}`}</button></>} />
      <div className="project-grid">{active.map(project => <ProjectCard key={project.id} state={state} actions={actions} project={project} />)}</div>
      {state.projectsShowArchived ? <section className="project-section"><div className="project-section-head"><div><div className="eyebrow">ARCHIVED · 历史项目</div><h2>归档项目</h2></div><span className="chip">{archived.length} 个</span></div><div className="project-grid">{archived.map(project => <ProjectCard key={project.id} state={state} actions={actions} project={project} archived />)}</div></section> : null}
    </>
  );
}

function ProjectCard({ state, actions, project, archived = false }: { state: ReadyState; actions: AppActions; project: Project; archived?: boolean }) {
  const tasks = state.data.tasks.filter(task => task.projectId === project.id);
  const open = tasks.filter(task => !task.completed && !task.closed);
  const progress = projectProgress(tasks, project);
  return (
    <article className={`project-card ${archived ? 'is-archived' : ''}`}>
      <header><span className="chip strong"><span className={`project-dot ${project.color || ''}`} />{project.name}</span><span className="group-meta">{archived ? '已归档' : relativeDate(project.updatedAt)}</span></header>
      <h2>{project.name}</h2>
      <p>{project.description || '没有说明'}</p>
      <div className="stat-strip compact"><article><strong>{open.length}</strong><span>未完成</span></article><article><strong>{open.filter(task => taskCoversDate(task, todayISO())).length}</strong><span>今天到期</span></article><article><strong>{tasks.filter(task => task.closed).length}</strong><span>已关闭</span></article><article><strong>{project.sections.length}</strong><span>章节</span></article></div>
      <div className="progress-track" style={{ '--value': `${progress}%` } as React.CSSProperties}><span /></div>
      <footer className="header-actions">
        <button className="tiny-action" type="button" onClick={() => actions.navigate(`project/${project.id}`)}>打开项目</button>
        <button className="tiny-action" type="button" onClick={() => actions.openProjectModal(project.id)}>编辑</button>
        <button className="tiny-action" type="button" onClick={() => archived ? actions.restoreProject(project.id) : actions.archiveProject(project.id)}>{archived ? '恢复' : '归档'}</button>
      </footer>
    </article>
  );
}

function ProjectView({ state, actions }: { state: ReadyState; actions: AppActions }) {
  const project = projectById(state.data, state.route.id) || activeProjects(state.data)[0] || archivedProjects(state.data)[0];
  if (!project) return <EmptyState title="项目不存在" copy="可以先创建一个项目。" />;
  const isArchived = project.archived;
  const projectTasks = openTasks(state.data).filter(task => task.projectId === project.id);
  const sectionGroups = project.sections.map(section => group(section.name, projectTasks.filter(task => task.sectionId === section.id)));
  sectionGroups.push(group('无章节', projectTasks.filter(task => !task.sectionId), 'muted'));
  return (
    <>
      <PageHeader state={state} actions={actions} eyebrow="PROJECT · 项目详情" title={project.name} subtitle={isArchived ? `${project.description || '这个项目目前没有额外说明。'} 当前已归档，恢复后再继续添加新任务或章节。` : (project.description || '管理项目中的任务和章节。')} extraActions={isArchived ? <><span className="chip warn">已归档</span><button className="soft-button" type="button" onClick={() => actions.restoreProject(project.id)}>恢复项目</button><button className="quiet-button" type="button" onClick={() => actions.openProjectModal(project.id)}>编辑项目</button><button className="quiet-button danger-button" type="button" onClick={() => actions.deleteProject(project.id)}>删除项目</button></> : <><button className="soft-button" type="button" onClick={() => actions.openProjectModal(project.id)}>编辑项目</button><button className="quiet-button" type="button" onClick={() => { const name = prompt('章节名称'); if (name) actions.addSection(project.id, name); }}>新建章节</button><button className="quiet-button" type="button" onClick={() => actions.archiveProject(project.id)}>归档项目</button><button className="quiet-button danger-button" type="button" onClick={() => actions.deleteProject(project.id)}>删除项目</button></>} />
      {isArchived ? <div className="empty-note">已归档项目仍会保留现有任务和章节，并继续出现在任务视图中；恢复后再继续整理。</div> : <QuickAdd actions={actions} placeholder={`添加任务到 ${project.name}`} context={{ projectId: project.id, sectionId: project.sections[0]?.id || '' }} />}
      <section className="task-board">{sectionGroups.map(item => <TaskGroup key={item.title} state={state} actions={actions} item={item} />)}</section>
    </>
  );
}

function TagsView({ state, actions }: { state: ReadyState; actions: AppActions }) {
  return (
    <>
      <PageHeader state={state} actions={actions} eyebrow="TAGS · 横向组织" title="标签" subtitle="标签用于跨项目组织任务，颜色只用于小面积 chip，不喧宾夺主。" extraActions={<button className="soft-button" type="button" onClick={() => actions.openTagModal()}>新建标签</button>} />
      <div className="tag-grid">{state.data.tags.map(tag => <article className="tag-card" key={tag.id}><header><span className="chip strong">#{tag.name}</span><span className={`project-dot ${tag.color || ''}`} /></header><h2>{tag.name}</h2><p>{tagTasks(state.data, tag.id).length} 个未完成任务使用这个标签。</p><footer className="header-actions"><button className="tiny-action" type="button" onClick={() => actions.navigate(`tag/${tag.id}`)}>打开标签</button><button className="tiny-action" type="button" onClick={() => actions.deleteTag(tag.id)}>删除</button></footer></article>)}</div>
    </>
  );
}

function TagView({ state, actions }: { state: ReadyState; actions: AppActions }) {
  const tag = tagById(state.data, state.route.id) || state.data.tags[0];
  if (!tag) return <EmptyState title="标签不存在" copy="可以先创建一个标签。" />;
  return <TaskListView state={state} actions={actions} eyebrow="TAG · 标签详情" title={`#${tag.name}`} subtitle={`${tagTasks(state.data, tag.id).length} 项任务匹配这个标签。`} stats={[
    { value: tagTasks(state.data, tag.id).length, label: '未完成' },
    { value: state.data.tasks.filter(task => task.completed && task.tags.includes(tag.id)).length, label: '已完成' },
    { value: tagTasks(state.data, tag.id).filter(task => taskCoversDate(task, todayISO())).length, label: '今天' },
  ]} quickContext={{ tagId: tag.id }} placeholder={`添加带 #${tag.name} 标签的任务`} groups={[group(`#${tag.name}`, tagTasks(state.data, tag.id), 'success')]} />;
}

function FiltersView({ state, actions }: { state: ReadyState; actions: AppActions }) {
  return (
    <>
      <PageHeader state={state} actions={actions} eyebrow="FILTERS · 保存视图" title="智能过滤器" subtitle="保存常用筛选条件，快速切换工作视图。第一版使用友好的条件构建器，不暴露查询语言。" extraActions={<button className="soft-button" type="button" onClick={() => actions.openFilterModal()}>新建过滤器</button>} />
      <div className="filter-grid">{state.data.filters.map(filter => <article className="filter-card" key={filter.id}><header><span className="chip strong">⚑ {filter.name}</span><span className="group-meta">{filterTasks(state.data, filter).length} 项</span></header><h2>{filter.name}</h2><p>{filterSummary(state.data, filter)}</p><footer className="header-actions"><button className="tiny-action" type="button" onClick={() => actions.navigate(`filter/${filter.id}`)}>打开</button><button className="tiny-action" type="button" onClick={() => actions.duplicateFilter(filter.id)}>复制</button><button className="tiny-action" type="button" onClick={() => actions.deleteFilter(filter.id)}>删除</button></footer></article>)}</div>
    </>
  );
}

function FilterView({ state, actions }: { state: ReadyState; actions: AppActions }) {
  const filter = state.data.filters.find(item => item.id === state.route.id) || state.data.filters[0];
  if (!filter) return <EmptyState title="过滤器不存在" copy="可以先创建一个过滤器。" />;
  return <TaskListView state={state} actions={actions} eyebrow="FILTER · 过滤结果" title={filter.name} subtitle={filterSummary(state.data, filter)} stats={[
    { value: filterTasks(state.data, filter).length, label: '匹配任务' },
    { value: filter.conditions.length, label: '条件' },
    { value: sortLabel(filter.sort), label: '排序' },
    { value: groupLabel(filter.group), label: '分组' },
  ]} quickContext={{}} placeholder="添加任务" extraActions={<button className="soft-button" type="button" onClick={() => actions.openFilterModal(filter.id)}>编辑过滤器</button>} groups={groupedFilterTasks(state.data, filter).map(item => ({ id: item.id, title: item.title, tasks: item.tasks, tone: item.tone }))} />;
}

function SettingsView({ state, actions }: { state: ReadyState; actions: AppActions }) {
  const attachments = allAttachments(state.data);
  return (
    <>
      <PageHeader state={state} actions={actions} eyebrow="SETTINGS · 单用户配置" title="设置" subtitle="集中管理账号安全、外观、通知、数据导入导出和附件恢复。危险操作保留确认。" extraActions={<button className="quiet-button danger-button" type="button" onClick={() => actions.logout()}>退出登录</button>} />
      <section className="settings-grid">
        {SETTINGS_PANELS.map(id => <article className="settings-card" key={id}><header><span className={`chip ${state.settingsPanel === id ? 'strong' : ''}`}>{settingsPanelLabel(id)}</span><span className="group-meta">{settingsMeta(state, id, attachments)}</span></header><p>{settingsCopy(id)}</p><button className="tiny-action" type="button" onClick={() => actions.setSettingsPanel(id)}>进入设置</button></article>)}
      </section>
      <section className="section-list settings-detail">
        <nav className="section-tabs">{SETTINGS_PANELS.map(id => <button key={id} className={state.settingsPanel === id ? 'active' : ''} type="button" onClick={() => actions.setSettingsPanel(id)}>{settingsPanelLabel(id)}</button>)}</nav>
        {settingsPanel(state, actions, attachments)}
      </section>
    </>
  );
}

function settingsMeta(state: ReadyState, id: ClientState['settingsPanel'], attachments: { task: Task; attachment: Attachment }[]) {
  if (id === 'appearance') return themeLabel(state.data.settings.theme);
  if (id === 'data') return `${state.data.tasks.length} 个任务`;
  if (id === 'attachments') return `${attachments.length} 个附件`;
  if (id === 'uploadUrl') return state.data.settings.uploadUrlConfig.accessPrefix;
  if (id === 'about') return APP_VERSION;
  if (id === 'notifications') return notificationState();
  return state.data.user.username;
}

function settingsCopy(id: ClientState['settingsPanel']) {
  return {
    account: '当前账号、修改密码、会话信息和退出登录确认。',
    appearance: '主题模式、界面密度和侧边栏显示偏好，设置即时生效。',
    notifications: '浏览器通知权限、测试通知和默认提醒时间。',
    data: '导出 JSON、选择导入文件、预检冲突和确认导入。',
    attachments: '附件 ZIP 导出、元数据匹配和缺失附件恢复。',
    uploadUrl: '配置附件公开访问路径和外部 URL 查询参数。',
    about: '部署版本、离线状态、存储位置和浏览器支持说明。',
  }[id];
}

function settingsPanel(state: ReadyState, actions: AppActions, attachments: { task: Task; attachment: Attachment }[]) {
  const panel = state.settingsPanel;
  if (panel === 'account') return <section className="group"><div className="group-header"><div className="group-title"><span className="dot" />账号与安全</div><span className="group-meta">{state.data.user.username}</span></div><PasswordForm actions={actions} /></section>;
  if (panel === 'appearance') return <section className="group"><div className="group-header"><div className="group-title"><span className="dot success" />外观</div><span className="group-meta">即时生效</span></div><div className="panel"><div className="segmented">{(['system', 'light', 'dark'] as const).map(theme => <button key={theme} className={state.data.settings.theme === theme ? 'active' : ''} type="button" onClick={() => actions.updateSettings({ theme })}>{themeLabel(theme)}</button>)}</div><label className="field"><span>日历每日显示条数</span><select className="select" value={state.data.settings.calendarDayLimit} onChange={event => actions.updateSettings({ calendarDayLimit: Number(event.target.value) })}>{[1, 2, 3, 4, 5, 6].map(value => <option key={value} value={value}>{value} 条</option>)}</select></label>{switchRow('紧凑任务行', '桌面任务行更紧凑，适合高任务量。', state.data.settings.compactRows, () => actions.updateSettings({ compactRows: !state.data.settings.compactRows }))}{switchRow('收起左侧边栏', '桌面端只保留图标导航。', state.data.settings.sidebarCollapsed, () => actions.updateSettings({ sidebarCollapsed: !state.data.settings.sidebarCollapsed }))}{switchRow('固定右侧详情抽屉', '宽屏时保持详情常驻。', state.data.settings.dockDrawer, () => actions.updateSettings({ dockDrawer: !state.data.settings.dockDrawer }))}</div></section>;
  if (panel === 'notifications') return <section className="group"><div className="group-header"><div className="group-title"><span className="dot warn" />通知</div><span className="group-meta">{notificationState()}</span></div><div className="panel"><p className="page-subtitle">浏览器通知需要用户授权。已拒绝时需要到浏览器设置中手动恢复。</p><div className="header-actions"><button className="soft-button" type="button" onClick={() => actions.requestNotifications()}>开启通知</button><button className="quiet-button" type="button" onClick={() => actions.testNotification()}>发送测试通知</button></div><label className="field"><span>默认提醒时间</span><select className="select" value={state.data.settings.defaultReminderTime} onChange={event => actions.updateSettings({ defaultReminderTime: event.target.value })}>{['09:00', '12:00', '18:00', ''].map(value => <option key={value} value={value}>{value || '不自动设置'}</option>)}</select></label></div></section>;
  if (panel === 'data') return <section className="group"><div className="group-header"><div className="group-title"><span className="dot" />数据导入导出</div><span className="group-meta">任务、项目、标签、提醒、重复规则</span></div><div className="panel"><Stats items={[{ value: state.data.tasks.length, label: '任务' }, { value: state.data.projects.length, label: '项目' }, { value: state.data.tags.length, label: '标签' }, { value: state.data.filters.length, label: '过滤器' }]} /><a className="soft-button" href="/api/export/data">导出 JSON</a><input className="input" type="file" accept="application/json,.json" onChange={event => { const file = event.target.files?.[0]; if (file) actions.previewImport(file); }} />{state.importPreview ? <div className="panel"><div className="panel-title">预检结果</div><p className="page-subtitle">{state.importPreview.tasks} 任务 · {state.importPreview.projects} 项目 · 当前 {state.importPreview.currentTasks} 任务</p><button className="quiet-button danger-button" type="button" onClick={() => actions.confirmImport(null)}>确认导入</button></div> : null}</div></section>;
  if (panel === 'attachments') {
    const total = attachments.reduce((sum, item) => sum + item.attachment.size, 0);
    return <section className="group"><div className="group-header"><div className="group-title"><span className="dot success" />附件导入导出</div><span className="group-meta">{attachments.length} 个文件 · {formatBytes(total)}</span></div><div className="panel"><Stats items={[{ value: attachments.length, label: '附件' }, { value: formatBytes(total), label: '总大小' }, { value: attachments.filter(item => item.attachment.missing).length, label: '缺失附件' }]} /><a className="soft-button" href="/api/export/attachments">导出全部附件</a><input className="input" type="file" accept=".zip,application/zip" onChange={event => { const file = event.target.files?.[0]; if (file) actions.importAttachmentZip(file); }} /></div></section>;
  }
  if (panel === 'uploadUrl') return <UploadUrlConfigForm state={state} actions={actions} />;
  return <section className="group"><div className="group-header"><div className="group-title"><span className="dot muted" />应用信息</div><span className="group-meta">self-hosted</span></div><div className="panel"><div className="file-row"><span className="file-icon">VER</span><span><strong>应用版本</strong><span className="task-meta">前端缓存与 Service Worker 跟随发版版本更新</span></span><span className="chip strong">{APP_VERSION}</span></div><div className="file-row"><span className="file-icon">PWA</span><span><strong>PWA 可安装</strong><span className="task-meta">安装后仍使用同一服务端和登录会话</span></span><button className="tiny-action" type="button" onClick={() => actions.installPwa()}>安装</button></div><div className="file-row"><span className="file-icon">SRC</span><span><strong>原型设计稿</strong><span className="task-meta">保留在 /prototype/index.html 供评审对照</span></span><a className="tiny-action" href="/prototype/index.html">打开</a></div></div></section>;
}

function switchRow(title: string, copy: string, enabled: boolean, onClick: () => void) {
  return <div className="switch-row"><div><strong>{title}</strong><p className="page-subtitle">{copy}</p></div><button className={`switch ${enabled ? 'on' : ''}`} type="button" onClick={onClick} /></div>;
}

function UploadUrlConfigForm({ state, actions }: { state: ReadyState; actions: AppActions }) {
  const config = state.data.settings.uploadUrlConfig;
  return (
    <section className="group">
      <div className="group-header"><div className="group-title"><span className="dot success" />上传 URL 配置</div><span className="group-meta">{config.accessPrefix}</span></div>
      <form className="panel" onSubmit={async event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        await actions.updateSettings({
          uploadUrlConfig: {
            accessPrefix: normalizeClientAccessPrefix(String(form.get('accessPrefix') || '')),
            baseUrl: String(form.get('baseUrl') || '').trim(),
            paramKey: String(form.get('paramKey') || '').trim() || 'path',
          },
        });
        actions.toast('上传 URL 配置已保存');
      }}>
        <label className="field"><span>访问前缀路径</span><input className="input" name="accessPrefix" defaultValue={config.accessPrefix} placeholder="/uploads" required /></label>
        <label className="field"><span>URL</span><input className="input" name="baseUrl" defaultValue={config.baseUrl} placeholder="https://example.com/file" /></label>
        <label className="field"><span>URL 参数 key</span><input className="input" name="paramKey" defaultValue={config.paramKey} placeholder="path" /></label>
        <div className="file-row">
          <span className="file-icon">URL</span>
          <span><strong>生成规则</strong><span className="task-meta">{config.baseUrl && config.paramKey ? `${config.baseUrl}${config.baseUrl.includes('?') ? '&' : '?'}${config.paramKey}=${encodeURIComponent(`${config.accessPrefix}/26/06/18/a.mp4`)}` : `${config.accessPrefix}/26/06/18/a.mp4`}</span></span>
        </div>
        <button className="soft-button" type="submit">保存配置</button>
      </form>
    </section>
  );
}

function PasswordForm({ actions }: { actions: AppActions }) {
  return (
    <form className="panel" onSubmit={async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const currentPassword = String(form.get('currentPassword') || '');
      const newPassword = String(form.get('newPassword') || '');
      const confirmPassword = String(form.get('confirmPassword') || '');
      if (newPassword !== confirmPassword) return actions.toast('两次新密码不一致');
      if (newPassword.length < PASSWORD_MIN_LENGTH) return actions.toast(`新密码至少需要 ${PASSWORD_MIN_LENGTH} 位`);
      await actions.changePassword(currentPassword, newPassword);
      event.currentTarget.reset();
    }}>
      <label className="field"><span>当前密码</span><input className="input" name="currentPassword" type="password" autoComplete="current-password" maxLength={PASSWORD_MAX_LENGTH} required /></label>
      <label className="field"><span>新密码</span><input className="input" name="newPassword" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} required /><p className="form-hint">{PASSWORD_RULE_HINT}</p></label>
      <label className="field"><span>再次输入新密码</span><input className="input" name="confirmPassword" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} required /></label>
      <div className="header-actions"><button className="soft-button" type="submit">保存新密码</button><button className="quiet-button danger-button" type="button" onClick={() => actions.logout()}>退出登录</button></div>
    </form>
  );
}

function notificationState() {
  if (!('Notification' in window)) return '不支持';
  return Notification.permission === 'granted' ? '已开启' : '未开启';
}

function RightPanel({ state, actions, task }: { state: ReadyState; actions: AppActions; task: Task | null }) {
  if (state.rightPanelMode === 'create') return <CreateTaskPanel state={state} actions={actions} />;
  if (!task) return null;
  const project = projectById(state.data, task.projectId);
  return (
    <aside className="right-panel drawer open">
      <div className="drawer-toolbar"><button className="icon-btn" type="button" onClick={() => actions.closePanel()}>×</button><span className="save-state">已保存</span><button className="icon-btn" type="button" onClick={() => actions.updateSettings({ dockDrawer: !state.data.settings.dockDrawer })}>⌖</button><button className="icon-btn" type="button" onClick={() => actions.deleteTask(task.id)}>⌫</button></div>
      <div className="drawer-content">
        <textarea className="drawer-title" value={task.title} onChange={event => actions.updateTask(task.id, { title: event.target.value }, { silent: true })} />
        <div className="property-grid">
          <label className="property"><span className="property-label">完成</span><span className="property-value"><input type="checkbox" checked={task.completed} onChange={() => actions.toggleTask(task.id)} /> {task.completed ? '已完成' : '未完成'}</span></label>
          <div className="property"><span className="property-label">关闭</span><span className="property-value"><button className={`switch ${task.closed ? 'on' : ''}`} type="button" onClick={() => task.closed ? actions.restoreTask(task.id) : actions.closeTask(task.id)} />{task.closed ? '已关闭' : '未关闭'}</span></div>
          <label className="property"><span className="property-label">项目</span><select className="select" value={task.projectId || ''} onChange={event => actions.updateTask(task.id, { projectId: event.target.value || null, sectionId: null })}><option value="">收件箱</option>{activeProjects(state.data).concat(project?.archived ? [project] : []).map(item => <option key={item.id} value={item.id}>{item.name}{item.archived ? '（已归档）' : ''}</option>)}</select></label>
          <label className="property"><span className="property-label">章节</span><select className="select" value={task.sectionId || ''} onChange={event => actions.updateTask(task.id, { sectionId: event.target.value || null })}><option value="">无章节</option>{(project?.sections || []).map(section => <option key={section.id} value={section.id}>{section.name}</option>)}</select></label>
          <label className="property"><span className="property-label">开始</span><input className="input" type="date" value={task.startDate || ''} onChange={event => actions.updateTask(task.id, { startDate: event.target.value || null })} /></label>
          <label className="property"><span className="property-label">截止</span><input className="input" type="date" value={task.dueDate || ''} onChange={event => actions.updateTask(task.id, { dueDate: event.target.value || null })} /></label>
          <label className="property"><span className="property-label">优先级</span><select className="select" value={task.priority} onChange={event => actions.updateTask(task.id, { priority: event.target.value as Priority })}>{priorityOptions()}</select></label>
          <div className="property"><span className="property-label">紧急</span><span className="property-value"><button className={`switch ${task.urgent ? 'on' : ''}`} type="button" onClick={() => actions.toggleUrgent(task.id)} />{task.urgent ? '紧急' : '不紧急'}</span></div>
          <label className="property tag-property"><span className="property-label">标签</span><span className="property-value tag-picker">{state.data.tags.map(tag => <button key={tag.id} className={`tag-choice ${task.tags.includes(tag.id) ? 'active' : ''}`} type="button" onClick={() => actions.toggleTaskTag(task.id, tag.id)}>#{tag.name}</button>)}</span></label>
        </div>
        <section className="panel"><div className="panel-title">描述</div><textarea className="textarea" value={task.description || ''} onChange={event => actions.updateTask(task.id, { description: event.target.value }, { silent: true })} /></section>
        <ChecklistPanel task={task} actions={actions} />
        <AttachmentsPanel task={task} actions={actions} settings={state.data.settings} />
      </div>
    </aside>
  );
}

function priorityOptions() {
  return (['none', 'low', 'medium', 'high'] as Priority[]).map(item => <option key={item} value={item}>{priorityLabel(item)}</option>);
}

function ChecklistPanel({ task, actions }: { task: Task; actions: AppActions }) {
  const done = task.subtasks.filter(item => item.completed).length;
  return (
    <section className="panel checklist-panel">
      <div className="panel-title"><span>Checklist</span><span className="chip">{done}/{task.subtasks.length}</span></div>
      <form className="subtask-composer" onSubmit={async event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const batch = appendSubtasks(task.subtasks, String(form.get('title') || ''));
        if (!batch.createdCount) return;
        await actions.updateSubtasks(task.id, batch.subtasks);
        event.currentTarget.reset();
      }}>
        <textarea className="input subtask-input" name="title" rows={2} placeholder="添加检查项，支持粘贴多行内容" />
        <button className="tiny-action" type="submit">添加</button>
      </form>
      <div className="subtask-list">
        {task.subtasks.map(subtask => <div className={`subtask ${subtask.completed ? 'done' : ''}`} key={subtask.id || subtask.order}><input type="checkbox" checked={subtask.completed} onChange={() => actions.updateSubtasks(task.id, task.subtasks.map(item => item === subtask ? { ...item, completed: !item.completed } : item))} /><div className="subtask-body"><textarea className="subtask-title" value={subtask.title} onChange={event => actions.updateSubtasks(task.id, task.subtasks.map(item => item === subtask ? { ...item, title: event.target.value } : item))} /><div className="subtask-meta-row"><span className="mini-tag">{subtask.dueDate ? shortDate(subtask.dueDate) : '无日期'}</span><span className="mini-tag">{priorityLabel(subtask.priority)}</span></div></div><button className="tiny-action" type="button" onClick={() => actions.updateSubtasks(task.id, task.subtasks.filter(item => item !== subtask))}>删除</button></div>)}
      </div>
    </section>
  );
}

function AttachmentsPanel({ task, actions, settings }: { task: Task; actions: AppActions; settings: PublicData['settings'] }) {
  return (
    <section className="panel">
      <div className="panel-title">附件 <span className="chip">{task.attachments.length} 个</span></div>
      <label className="upload-dropzone"><input className="file-input" type="file" multiple onChange={event => event.target.files && actions.uploadAttachment(task.id, event.target.files)} /><span className="file-icon">UP</span><span><strong>上传附件</strong><span className="task-meta">支持多文件，单个文件最大 100MB</span></span><span className="tiny-action">选择文件</span></label>
      {task.attachments.map(file => {
        const relativePath = attachmentRelativePath(file, settings);
        const externalUrl = attachmentExternalUrl(file, settings);
        return <div className="file-row" key={file.id}><span className="file-icon">{fileExtension(file.originalName)}</span><span><strong>{file.originalName}</strong><span className="task-meta">{formatBytes(file.size)} · {shortDate(file.uploadedAt)}{file.missing ? ' · 文件缺失' : ''}</span>{relativePath ? <span className="task-meta attachment-url"><a href={relativePath} target="_blank" rel="noreferrer">{relativePath}</a>{externalUrl ? <a href={externalUrl} target="_blank" rel="noreferrer">{externalUrl}</a> : null}</span> : null}</span><span className="header-actions"><a className="tiny-action" href={`/api/attachments/${file.id}/download`}>下载</a><button className="tiny-action" type="button" onClick={() => actions.deleteAttachment(file.id)}>删除</button></span></div>;
      })}
    </section>
  );
}

function CreateTaskPanel({ state, actions }: { state: ReadyState; actions: AppActions }) {
  const defaults = resolvedCreateDefaults(state);
  return (
    <aside className="right-panel drawer open create-panel">
      <div className="drawer-toolbar"><button className="icon-btn" type="button" onClick={() => actions.closePanel()}>×</button><span className="save-state">新建任务</span><button className="icon-btn" type="button" onClick={() => actions.updateSettings({ dockDrawer: !state.data.settings.dockDrawer })}>⌖</button></div>
      <div className="drawer-content">
        <div className="panel-intro"><h2>新建任务</h2><p>使用当前视图上下文创建任务，连续新建会保留日期、项目和标签。</p></div>
        <form className="dialog-body panel-form" onSubmit={event => submitCreate(event, actions)}>
          <label className="field"><span>任务标题</span><input className="input" name="title" required autoFocus placeholder="例如：整理今天的任务" defaultValue={defaults.title} /></label>
          <label className="field"><span>项目</span><select className="select" name="projectId" defaultValue={defaults.projectId}><option value="">收件箱</option>{activeProjects(state.data).map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <label className="field"><span>截止日期</span><input className="input" name="dueDate" type="date" defaultValue={defaults.dueDate} /></label>
          <label className="field"><span>开始日期</span><input className="input" name="startDate" type="date" defaultValue={defaults.startDate} /></label>
          <label className="field"><span>优先级</span><select className="select" name="priority" defaultValue={defaults.priority}>{priorityOptions()}</select></label>
          <label className="check-field"><input type="checkbox" name="urgent" value="true" defaultChecked={defaults.urgent} /><span>标记为紧急</span></label>
          <input type="hidden" name="sectionId" value={defaults.sectionId} />
          <input type="hidden" name="tagId" value={defaults.tagId} />
          <div className="dialog-actions"><button className="soft-button" type="submit" name="submitMode" value="continue">创建并继续</button><button className="primary-add" type="submit" name="submitMode" value="close">创建后关闭</button></div>
        </form>
      </div>
    </aside>
  );
}

async function submitCreate(event: FormEvent<HTMLFormElement>, actions: AppActions) {
  event.preventDefault();
  const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
  const form = new FormData(event.currentTarget);
  await actions.createTask({
    title: String(form.get('title') || ''),
    projectId: String(form.get('projectId') || '') || null,
    sectionId: String(form.get('sectionId') || '') || null,
    startDate: String(form.get('startDate') || '') || null,
    dueDate: String(form.get('dueDate') || '') || null,
    priority: String(form.get('priority') || 'none') as Priority,
    urgent: form.get('urgent') === 'true',
    tagId: String(form.get('tagId') || ''),
  }, submitter?.value === 'continue' ? 'continue' : 'close');
}

function ProjectModal({ state, actions }: { state: ReadyState; actions: AppActions }) {
  if (state.modal !== 'project') return null;
  const editing = projectById(state.data, state.projectEditingId);
  return <Modal title={editing ? '编辑项目' : '新建项目'} onClose={actions.closeModals}><form className="dialog-body" onSubmit={async event => { event.preventDefault(); const form = new FormData(event.currentTarget); await actions.saveProject({ name: String(form.get('name') || ''), description: String(form.get('description') || ''), color: String(form.get('color') || 'blue') }, editing?.id || null); }}><label className="field"><span>项目名称</span><input className="input" name="name" required autoFocus defaultValue={editing?.name || ''} /></label><label className="field"><span>说明</span><textarea className="textarea" name="description" defaultValue={editing?.description || ''} /></label><label className="field"><span>颜色</span><select className="select" name="color" defaultValue={editing?.color || 'blue'}>{['blue', 'green', 'amber', 'red', 'violet'].map(color => <option key={color} value={color}>{color}</option>)}</select></label><button className="primary-add" type="submit">{editing ? '保存修改' : '创建项目'}</button></form></Modal>;
}

function TagModal({ state, actions }: { state: ReadyState; actions: AppActions }) {
  if (state.modal !== 'tag') return null;
  return <Modal title="新建标签" onClose={actions.closeModals}><form className="dialog-body" onSubmit={async event => { event.preventDefault(); const form = new FormData(event.currentTarget); await actions.createTag({ name: String(form.get('name') || ''), color: String(form.get('color') || 'blue') }); }}><label className="field"><span>标签名称</span><input className="input" name="name" required autoFocus /></label><label className="field"><span>颜色</span><select className="select" name="color" defaultValue="blue">{['blue', 'green', 'amber', 'red', 'violet'].map(color => <option key={color} value={color}>{color}</option>)}</select></label><button className="primary-add" type="submit">创建标签</button></form></Modal>;
}

function FilterModal({ state, actions }: { state: ReadyState; actions: AppActions }) {
  if (state.modal !== 'filter') return null;
  const editing = state.data.filters.find(filter => filter.id === state.filterEditingId) || null;
  const condition = editing?.conditions?.[0];
  return <Modal title={editing ? '编辑智能过滤器' : '智能过滤器'} onClose={actions.closeModals}><form className="dialog-body" onSubmit={async event => { event.preventDefault(); const form = new FormData(event.currentTarget); await actions.saveFilter({ name: String(form.get('name') || ''), field: String(form.get('field') || 'priority'), value: String(form.get('value') || '') }, editing?.id || null); }}><label className="field"><span>名称</span><input className="input" name="name" required autoFocus defaultValue={editing?.name || ''} /></label><label className="field"><span>字段</span><select className="select" name="field" defaultValue={condition?.field || 'priority'}>{['priority', 'projectId', 'tag', 'due', 'hasAttachment', 'hasReminder'].map(field => <option key={field} value={field}>{conditionFieldLabel(field)}</option>)}</select></label><label className="field"><span>值</span><input className="input" name="value" placeholder="high / 项目ID / 标签ID / today / upcoming / true" defaultValue={String(condition?.value ?? '')} /></label><button className="primary-add" type="submit">{editing ? '保存修改' : '保存过滤器'}</button></form></Modal>;
}

function CommandModal({ state, actions }: { state: ReadyState; actions: AppActions }) {
  if (!state.commandOpen) return null;
  return <Modal title="命令面板" onClose={() => actions.setCommandOpen(false)}><div className="dialog-body"><input className="input" placeholder="搜索任务、项目或动作" autoFocus /><div className="cmd-list"><button className="cmd-item active" type="button" onClick={() => actions.openCreate()}><span className="file-icon">+</span><span><strong>新建任务</strong><span className="task-meta">默认应用当前页面上下文</span></span><span className="shortcut">Enter</span></button>{navItems.slice(0, 10).map(item => <button className="cmd-item" type="button" key={item.id} onClick={() => actions.navigate(item.id)}><span className="file-icon">{item.icon}</span><span><strong>打开{item.label}</strong><span className="task-meta">视图</span></span><span className="shortcut">G</span></button>)}{openTasks(state.data).slice(0, 8).map(task => <button className="cmd-item" type="button" key={task.id} onClick={() => actions.openDetail(task.id)}><span className="file-icon">T</span><span><strong>{task.title}</strong><span className="task-meta">{taskMetaText(state.data, task)}</span></span><span className="shortcut">↵</span></button>)}</div></div></Modal>;
}

function Modal({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  return <div className="modal-layer open"><div className="dialog" role="dialog" aria-modal="true" aria-label={title}><div className="dialog-head"><h2 className="dialog-title">{title}</h2><button className="icon-btn" type="button" onClick={onClose}>×</button></div>{children}</div></div>;
}
