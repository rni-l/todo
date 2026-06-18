import { createContext, useContext } from 'react';
import type { CreateTaskDefaults, ImportPreview, PublicData, RouteName, RouteState, Task } from '../types.ts';
import { resolveTaskModalDefaults } from '../lib/taskCreate.ts';
import { todayISO } from '../lib/dates.ts';

export const navItems: Array<{ id: RouteName; label: string; icon: string; mobile?: boolean; mobileLabel?: string }> = [
  { id: 'today', label: '今日', icon: '✓', mobile: true },
  { id: 'inbox', label: '收件箱', icon: '□', mobile: true },
  { id: 'upcoming', label: '未来', icon: '→' },
  { id: 'recent', label: '最近7天', icon: '↺', mobile: true, mobileLabel: '近7天' },
  { id: 'calendar', label: '日历', icon: '▦', mobile: true },
  { id: 'matrix', label: '四象限', icon: '⊞', mobile: true },
  { id: 'reports', label: '统计', icon: '◫' },
  { id: 'projects', label: '项目', icon: '●', mobile: true },
  { id: 'tags', label: '标签', icon: '#' },
  { id: 'filters', label: '智能过滤器', icon: '⚑' },
  { id: 'completed', label: '已完成', icon: '✓' },
  { id: 'closed', label: '已关闭', icon: '⊘' },
  { id: 'settings', label: '设置', icon: '⚙', mobile: true, mobileLabel: '更多' }
];

export const routeTitles: Record<RouteName, [string, string]> = {
  today: ['TODAY · 今日执行', '今日'],
  inbox: ['INBOX · 快速收集', '收件箱'],
  upcoming: ['UPCOMING · 时间计划', '未来'],
  recent: ['RECENT · 7天窗口', '最近7天'],
  calendar: ['CALENDAR · 日期分布', '日历'],
  matrix: ['MATRIX · 重要紧急', '四象限'],
  reports: ['REPORTS · 数据概览', '统计'],
  projects: ['PROJECTS · 任务组织', '项目'],
  project: ['PROJECT · 项目详情', '项目详情'],
  tags: ['TAGS · 横向组织', '标签'],
  tag: ['TAG · 标签详情', '标签详情'],
  filters: ['FILTERS · 保存视图', '智能过滤器'],
  filter: ['FILTER · 过滤结果', '智能过滤器'],
  completed: ['COMPLETED · 完成记录', '已完成'],
  closed: ['CLOSED · 关闭记录', '已关闭'],
  settings: ['SETTINGS · 单用户配置', '设置']
};

const validRoutes = new Set<RouteName>(navItems.map(item => item.id));
const detailRoutes = new Set<RouteName>(['project', 'tag', 'filter']);

export function parseHashRoute(hash = typeof location === 'undefined' ? '' : location.hash): RouteState {
  const normalized = hash.replace(/^#\/?/, '');
  const [rawName = 'today', rawId = null] = normalized.split('/');
  const name = rawName as RouteName;
  if (detailRoutes.has(name)) return { name, id: rawId || null };
  if (validRoutes.has(name)) return { name, id: null };
  return { name: 'today', id: null };
}

export function routeToHash(route: string) {
  return `#/${route.replace(/^#\/?/, '')}`;
}

export type RightPanelMode = 'none' | 'detail' | 'create';
export type ModalName = 'project' | 'tag' | 'filter' | null;

export interface ClientState {
  status: 'loading' | 'login' | 'ready';
  data: PublicData | null;
  route: RouteState;
  selectedTaskId: string | null;
  rightPanelMode: RightPanelMode;
  commandOpen: boolean;
  modal: ModalName;
  projectEditingId: string | null;
  filterEditingId: string | null;
  archivedSidebarOpen: boolean;
  projectsShowArchived: boolean;
  calendarMode: 'week' | 'month';
  selectedCalendarDate: string;
  settingsPanel: 'account' | 'appearance' | 'notifications' | 'data' | 'attachments' | 'uploadUrl' | 'about';
  createDefaults: Partial<CreateTaskDefaults>;
  saveState: string;
  toast: string;
  loginError: string;
  importPreview: ImportPreview | null;
  deferredInstallPrompt: Event | null;
}

export function createInitialState(hash?: string): ClientState {
  return {
    status: 'loading',
    data: null,
    route: parseHashRoute(hash),
    selectedTaskId: null,
    rightPanelMode: 'none',
    commandOpen: false,
    modal: null,
    projectEditingId: null,
    filterEditingId: null,
    archivedSidebarOpen: false,
    projectsShowArchived: false,
    calendarMode: 'month',
    selectedCalendarDate: todayISO(),
    settingsPanel: 'account',
    createDefaults: {},
    saveState: '已保存',
    toast: '',
    loginError: '',
    importPreview: null,
    deferredInstallPrompt: null
  };
}

export type ClientAction =
  | { type: 'LOGIN_REQUIRED'; error?: string }
  | { type: 'LOAD_DATA'; data: PublicData }
  | { type: 'SET_DATA'; data: PublicData }
  | { type: 'SET_ROUTE'; route: RouteState }
  | { type: 'OPEN_CREATE'; defaults?: Partial<CreateTaskDefaults>; selectedDate?: string }
  | { type: 'OPEN_DETAIL'; taskId: string }
  | { type: 'CLOSE_PANEL' }
  | { type: 'SET_COMMAND_OPEN'; open: boolean }
  | { type: 'SET_MODAL'; modal: ModalName; projectEditingId?: string | null; filterEditingId?: string | null }
  | { type: 'SET_CALENDAR_MODE'; mode: 'week' | 'month' }
  | { type: 'SET_SELECTED_CALENDAR_DATE'; date: string }
  | { type: 'SET_SETTINGS_PANEL'; panel: ClientState['settingsPanel'] }
  | { type: 'SET_CREATE_DEFAULTS'; defaults: Partial<CreateTaskDefaults> }
  | { type: 'SET_SAVE_STATE'; saveState: string }
  | { type: 'SET_TOAST'; toast: string }
  | { type: 'SET_LOGIN_ERROR'; loginError: string }
  | { type: 'SET_IMPORT_PREVIEW'; preview: ImportPreview | null }
  | { type: 'SET_DEFERRED_INSTALL_PROMPT'; event: Event | null }
  | { type: 'TOGGLE_ARCHIVED_SIDEBAR' }
  | { type: 'TOGGLE_PROJECTS_ARCHIVED' };

export function appReducer(state: ClientState, action: ClientAction): ClientState {
  switch (action.type) {
    case 'LOGIN_REQUIRED':
      return { ...state, status: 'login', data: null, loginError: action.error || state.loginError, rightPanelMode: 'none' };
    case 'LOAD_DATA':
      return { ...state, status: 'ready', data: action.data, loginError: '' };
    case 'SET_DATA':
      return { ...state, data: action.data, status: 'ready' };
    case 'SET_ROUTE':
      return {
        ...state,
        route: action.route,
        commandOpen: false,
        calendarMode: action.route.name === 'calendar' ? state.calendarMode || 'month' : state.calendarMode
      };
    case 'OPEN_CREATE':
      return {
        ...state,
        selectedTaskId: null,
        rightPanelMode: 'create',
        commandOpen: false,
        createDefaults: action.defaults || {},
        selectedCalendarDate: action.selectedDate || state.selectedCalendarDate
      };
    case 'OPEN_DETAIL':
      return { ...state, selectedTaskId: action.taskId, rightPanelMode: 'detail', commandOpen: false };
    case 'CLOSE_PANEL':
      return { ...state, selectedTaskId: null, rightPanelMode: 'none', createDefaults: {} };
    case 'SET_COMMAND_OPEN':
      return { ...state, commandOpen: action.open };
    case 'SET_MODAL':
      return {
        ...state,
        modal: action.modal,
        projectEditingId: action.projectEditingId ?? null,
        filterEditingId: action.filterEditingId ?? null
      };
    case 'SET_CALENDAR_MODE':
      return { ...state, calendarMode: action.mode };
    case 'SET_SELECTED_CALENDAR_DATE':
      return { ...state, selectedCalendarDate: action.date };
    case 'SET_SETTINGS_PANEL':
      return { ...state, settingsPanel: action.panel };
    case 'SET_CREATE_DEFAULTS':
      return { ...state, createDefaults: action.defaults };
    case 'SET_SAVE_STATE':
      return { ...state, saveState: action.saveState };
    case 'SET_TOAST':
      return { ...state, toast: action.toast };
    case 'SET_LOGIN_ERROR':
      return { ...state, loginError: action.loginError };
    case 'SET_IMPORT_PREVIEW':
      return { ...state, importPreview: action.preview };
    case 'SET_DEFERRED_INSTALL_PROMPT':
      return { ...state, deferredInstallPrompt: action.event };
    case 'TOGGLE_ARCHIVED_SIDEBAR':
      return { ...state, archivedSidebarOpen: !state.archivedSidebarOpen };
    case 'TOGGLE_PROJECTS_ARCHIVED':
      return { ...state, projectsShowArchived: !state.projectsShowArchived };
    default:
      return state;
  }
}

export function routeIcon(route: RouteState) {
  if (route.name === 'project') return '●';
  if (route.name === 'tag') return '#';
  if (route.name === 'filter') return '⚑';
  return navItems.find(item => item.id === route.name)?.icon || '✓';
}

export function routeMeta(route: RouteState) {
  return routeTitles[route.name] || routeTitles.today;
}

export function resolvedCreateDefaults(state: ClientState) {
  return resolveTaskModalDefaults(state.createDefaults, state.route, state.selectedCalendarDate || todayISO(), todayISO());
}

export interface AppActions {
  navigate(route: string): void;
  loadData(): Promise<void>;
  login(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
  openCreate(defaults?: Partial<CreateTaskDefaults>): void;
  openDetail(taskId: string): void;
  closePanel(): void;
  setCommandOpen(open: boolean): void;
  closeModals(): void;
  openProjectModal(projectId?: string | null): void;
  openTagModal(): void;
  openFilterModal(filterId?: string | null): void;
  setCalendarMode(mode: ClientState['calendarMode']): void;
  setSelectedCalendarDate(date: string): void;
  setSettingsPanel(panel: ClientState['settingsPanel']): void;
  toggleArchivedSidebar(): void;
  toggleProjectsArchived(): void;
  toast(message: string): void;
  createTask(values: Partial<Task> & { tagId?: string; tags?: string[] }, submitMode?: 'continue' | 'close'): Promise<void>;
  updateTask(taskId: string, patch: Partial<Task>, options?: { silent?: boolean }): Promise<void>;
  deleteTask(taskId: string): Promise<void>;
  closeTask(taskId: string): Promise<void>;
  restoreTask(taskId: string): Promise<void>;
  toggleTask(taskId: string): Promise<void>;
  cyclePriority(taskId: string): Promise<void>;
  toggleUrgent(taskId: string): Promise<void>;
  toggleTaskTag(taskId: string, tagId: string): Promise<void>;
  updateSubtasks(taskId: string, subtasks: Task['subtasks']): Promise<void>;
  uploadAttachment(taskId: string, files: FileList | File[]): Promise<void>;
  deleteAttachment(attachmentId: string): Promise<void>;
  saveProject(input: { name: string; description: string; color: string }, editingId?: string | null): Promise<void>;
  archiveProject(projectId: string): Promise<void>;
  restoreProject(projectId: string): Promise<void>;
  deleteProject(projectId: string): Promise<void>;
  addSection(projectId: string, name: string): Promise<void>;
  createTag(input: { name: string; color: string }): Promise<void>;
  deleteTag(tagId: string): Promise<void>;
  saveFilter(input: { name: string; field: string; value: string | boolean }, editingId?: string | null): Promise<void>;
  duplicateFilter(filterId: string): Promise<void>;
  deleteFilter(filterId: string): Promise<void>;
  updateSettings(patch: Record<string, unknown>): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  previewImport(file: File): Promise<void>;
  confirmImport(file: File | null): Promise<void>;
  importAttachmentZip(file: File): Promise<void>;
  requestNotifications(): Promise<void>;
  testNotification(): void;
  installPwa(): Promise<void>;
}

export const AppContext = createContext<{ state: ClientState; actions: AppActions } | null>(null);

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppContext is missing');
  return value;
}
