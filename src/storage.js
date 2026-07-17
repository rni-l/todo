import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createPasswordRecord, verifyPassword } from './auth.js';

const DATA_VERSION = 1;
const DEFAULT_USERNAME = process.env.TODO_USERNAME || 'self-hosted-user';
const DEFAULT_PASSWORD = process.env.TODO_PASSWORD || 'todo123456';
const DEFAULT_CALENDAR_DAY_LIMIT = 3;
const DEFAULT_UPLOAD_URL_CONFIG = Object.freeze({
  accessPrefix: '/uploads',
  baseUrl: '',
  paramKey: 'path'
});

export function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

export function todayISO(offsetDays = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function normalizeFileName(name) {
  return String(name || 'file')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160) || 'file';
}

export function normalizeAccessPrefix(value) {
  const raw = String(value || DEFAULT_UPLOAD_URL_CONFIG.accessPrefix).trim() || DEFAULT_UPLOAD_URL_CONFIG.accessPrefix;
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  const normalized = withSlash.replace(/\/+/g, '/').replace(/\/$/, '') || DEFAULT_UPLOAD_URL_CONFIG.accessPrefix;
  if (normalized === '/api' || normalized.startsWith('/api/')) return DEFAULT_UPLOAD_URL_CONFIG.accessPrefix;
  if (normalized === '/prototype' || normalized.startsWith('/prototype/')) return DEFAULT_UPLOAD_URL_CONFIG.accessPrefix;
  if (normalized === '/assets' || normalized === '/dist') return DEFAULT_UPLOAD_URL_CONFIG.accessPrefix;
  return normalized;
}

function normalizeUploadUrlConfig(input = {}, existing = {}) {
  return {
    accessPrefix: normalizeAccessPrefix(input.accessPrefix ?? existing.accessPrefix ?? DEFAULT_UPLOAD_URL_CONFIG.accessPrefix),
    baseUrl: String(input.baseUrl ?? existing.baseUrl ?? DEFAULT_UPLOAD_URL_CONFIG.baseUrl).trim(),
    paramKey: String(input.paramKey ?? existing.paramKey ?? DEFAULT_UPLOAD_URL_CONFIG.paramKey).trim() || DEFAULT_UPLOAD_URL_CONFIG.paramKey
  };
}

function normalizeRelativeUploadPath(value = '') {
  const normalized = path.posix.normalize(String(value || '').replaceAll('\\', '/')).replace(/^\/+/, '');
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized === '..') return null;
  return normalized;
}

function storagePathFromAccessPath(value = '', accessPrefix = DEFAULT_UPLOAD_URL_CONFIG.accessPrefix) {
  let raw = String(value || '').replaceAll('\\', '/');
  if (raw === accessPrefix || raw.startsWith(`${accessPrefix}/`)) {
    raw = raw.slice(accessPrefix.length).replace(/^\/+/, '');
  } else {
    raw = raw.replace(/^\/+/, '');
    const parts = raw.split('/').filter(Boolean);
    if (parts.length >= 5 && !/^\d{2}$/.test(parts[0]) && /^\d{2}$/.test(parts[1]) && /^\d{2}$/.test(parts[2]) && /^\d{2}$/.test(parts[3])) {
      raw = parts.slice(1).join('/');
    }
  }
  return normalizeRelativeUploadPath(raw);
}

function uploadDateParts(date = new Date()) {
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return [year, month, day];
}

function appendDuplicateSuffix(fileName, index) {
  if (!index) return fileName;
  const extension = path.extname(fileName);
  const base = extension ? fileName.slice(0, -extension.length) : fileName;
  return `${base}-${index}${extension}`;
}

function nowISO() {
  return new Date().toISOString();
}

function priorityWeight(priority) {
  return { high: 3, medium: 2, low: 1, none: 0 }[priority] || 0;
}

function normalizeCalendarDayLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_CALENDAR_DAY_LIMIT;
  return Math.min(6, Math.max(1, parsed));
}

function normalizeSubtask(input = {}, index = 0) {
  return {
    id: input.id || createId('sub'),
    title: String(input.title || '').trim() || '未命名子任务',
    completed: Boolean(input.completed),
    order: Number.isFinite(input.order) ? input.order : index + 1,
    dueDate: input.dueDate || null,
    priority: ['none', 'low', 'medium', 'high'].includes(input.priority) ? input.priority : 'none'
  };
}

function normalizeDateRange(input = {}, existing = {}) {
  const hasStartDate = Object.prototype.hasOwnProperty.call(input, 'startDate');
  const hasDueDate = Object.prototype.hasOwnProperty.call(input, 'dueDate');
  const startDate = hasStartDate ? input.startDate || null : existing.startDate || null;
  const dueDate = hasDueDate ? input.dueDate || null : existing.dueDate || null;
  if (startDate && dueDate && startDate > dueDate) {
    return { startDate: dueDate, dueDate: startDate };
  }
  return { startDate, dueDate };
}

function normalizeSettings(input = {}, existing = {}) {
  return {
    theme: input.theme ?? existing.theme ?? 'system',
    density: input.density ?? existing.density ?? 'comfortable',
    defaultReminderTime: input.defaultReminderTime ?? existing.defaultReminderTime ?? '09:00',
    notificationsEnabled: Boolean(input.notificationsEnabled ?? existing.notificationsEnabled ?? false),
    dockDrawer: Boolean(input.dockDrawer ?? existing.dockDrawer ?? true),
    sidebarCollapsed: Boolean(input.sidebarCollapsed ?? existing.sidebarCollapsed ?? false),
    compactRows: Boolean(input.compactRows ?? existing.compactRows ?? false),
    pwaInstallDismissed: Boolean(input.pwaInstallDismissed ?? existing.pwaInstallDismissed ?? false),
    calendarShowAdjacentDays: Boolean(
      input.calendarShowAdjacentDays ?? existing.calendarShowAdjacentDays ?? false
    ),
    calendarDayLimit: normalizeCalendarDayLimit(input.calendarDayLimit ?? existing.calendarDayLimit),
    uploadUrlConfig: normalizeUploadUrlConfig(input.uploadUrlConfig, existing.uploadUrlConfig)
  };
}

function seedData() {
  const createdAt = nowISO();
  const projects = [
    {
      id: 'proj_personal',
      name: '个人系统',
      color: 'blue',
      description: '数据、通知、账号安全和自托管维护。',
      archived: false,
      order: 1,
      sections: [
        { id: 'sec_core', name: '核心能力', order: 1 },
        { id: 'sec_ops', name: '部署维护', order: 2 },
        { id: 'sec_review', name: '回顾优化', order: 3 }
      ],
      createdAt,
      updatedAt: createdAt
    },
    {
      id: 'proj_design',
      name: 'Open Design',
      color: 'green',
      description: '原型评审、移动端状态和设计细节。',
      archived: false,
      order: 2,
      sections: [
        { id: 'sec_pages', name: '页面状态', order: 1 },
        { id: 'sec_mobile', name: '移动端', order: 2 }
      ],
      createdAt,
      updatedAt: createdAt
    },
    {
      id: 'proj_server',
      name: '服务器维护',
      color: 'amber',
      description: '附件目录备份、部署和运行检查。',
      archived: false,
      order: 3,
      sections: [{ id: 'sec_server', name: '维护清单', order: 1 }],
      createdAt,
      updatedAt: createdAt
    }
  ];

  const tags = [
    { id: 'tag_pwa', name: 'PWA', color: 'blue', createdAt, updatedAt: createdAt },
    { id: 'tag_import', name: '导入导出', color: 'amber', createdAt, updatedAt: createdAt },
    { id: 'tag_mobile', name: '移动端', color: 'green', createdAt, updatedAt: createdAt },
    { id: 'tag_attachment', name: '附件', color: 'violet', createdAt, updatedAt: createdAt },
    { id: 'tag_notify', name: '通知', color: 'red', createdAt, updatedAt: createdAt }
  ];

  const tasks = [
    taskSeed('把 PWA 安装提示写进设置页', { projectId: 'proj_personal', sectionId: 'sec_core', dueDate: todayISO(), priority: 'high', tags: ['tag_pwa'], reminderAt: `${todayISO()}T18:00:00.000Z`, order: 1 }),
    taskSeed('记录附件 ZIP 匹配不到元数据的错误状态', { projectId: 'proj_personal', sectionId: 'sec_core', dueDate: todayISO(), priority: 'medium', tags: ['tag_attachment', 'tag_import'], order: 2 }),
    taskSeed('给移动端更多页补设置入口顺序', { projectId: 'proj_design', sectionId: 'sec_mobile', dueDate: todayISO(1), priority: 'low', tags: ['tag_mobile'], order: 3 }),
    taskSeed('把智能过滤器条件编辑器做成行内组合控件', { projectId: 'proj_personal', sectionId: 'sec_review', dueDate: null, priority: 'medium', tags: [], order: 4 }),
    taskSeed('备份服务器附件目录', { projectId: 'proj_server', sectionId: 'sec_server', dueDate: todayISO(5), priority: 'none', tags: ['tag_attachment'], recurrence: { type: 'weekly', interval: 1 }, order: 5 }),
    taskSeed('复查本周完成任务归档', { projectId: 'proj_personal', sectionId: 'sec_review', dueDate: todayISO(6), priority: 'low', tags: [], order: 6 }),
    taskSeed('整理收件箱里的零散想法', { projectId: null, sectionId: null, dueDate: null, priority: 'none', tags: [], order: 7 }),
    taskSeed('完成第一版任务详情抽屉', { projectId: 'proj_personal', sectionId: 'sec_core', dueDate: todayISO(-1), priority: 'high', tags: ['tag_pwa'], order: 8 })
  ];

  tasks[tasks.length - 1].completed = true;
  tasks[tasks.length - 1].completedAt = nowISO();

  return {
    version: DATA_VERSION,
    createdAt,
    updatedAt: createdAt,
    auth: {
      username: DEFAULT_USERNAME,
      password: createPasswordRecord(DEFAULT_PASSWORD)
    },
    settings: {
      theme: 'system',
      density: 'comfortable',
      defaultReminderTime: '09:00',
      notificationsEnabled: false,
      dockDrawer: true,
      sidebarCollapsed: false,
      compactRows: false,
      pwaInstallDismissed: false,
      calendarShowAdjacentDays: false,
      calendarDayLimit: DEFAULT_CALENDAR_DAY_LIMIT,
      uploadUrlConfig: { ...DEFAULT_UPLOAD_URL_CONFIG }
    },
    projects,
    tags,
    filters: [
      {
        id: 'filter_high',
        name: '高优先级',
        pinned: true,
        conditions: [{ field: 'priority', operator: 'is', value: 'high' }],
        sort: 'dueDate',
        group: 'date',
        order: 1,
        createdAt,
        updatedAt: createdAt
      },
      {
        id: 'filter_reminders',
        name: '有提醒',
        pinned: true,
        conditions: [{ field: 'hasReminder', operator: 'is', value: true }],
        sort: 'dueDate',
        group: 'date',
        order: 2,
        createdAt,
        updatedAt: createdAt
      }
    ],
    tasks
  };
}

function taskSeed(title, input = {}) {
  const createdAt = nowISO();
  return {
    id: createId('task'),
    title,
    completed: false,
    completedAt: null,
    closed: false,
    closedAt: null,
    projectId: input.projectId ?? null,
    sectionId: input.sectionId ?? null,
    startDate: input.startDate ?? null,
    dueDate: input.dueDate ?? null,
    reminderAt: input.reminderAt ?? null,
    reminderEndAt: input.reminderEndAt ?? null,
    priority: input.priority ?? 'none',
    urgent: Boolean(input.urgent ?? false),
    tags: input.tags ?? [],
    recurrence: input.recurrence ?? null,
    description: input.description ?? '',
    subtasks: [
      normalizeSubtask({ title: '确认页面状态', completed: false, order: 1 }),
      normalizeSubtask({ title: '补齐移动端检查', completed: false, order: 2 }, 1)
    ],
    attachments: [],
    order: input.order ?? 0,
    createdAt,
    updatedAt: createdAt
  };
}

function normalizeTask(input, existing = {}) {
  const timestamp = nowISO();
  const has = key => Object.prototype.hasOwnProperty.call(input, key);
  const dateRange = normalizeDateRange({
    ...(has('startDate') ? { startDate: input.startDate } : {}),
    ...(has('dueDate') ? { dueDate: input.dueDate } : {})
  }, existing);
  return {
    id: existing.id || input.id || createId('task'),
    title: String(input.title ?? existing.title ?? '').trim() || '未命名任务',
    completed: Boolean(input.completed ?? existing.completed ?? false),
    completedAt: has('completedAt') ? input.completedAt || null : existing.completedAt ?? null,
    closed: Boolean(input.closed ?? existing.closed ?? false),
    closedAt: has('closedAt') ? input.closedAt || null : existing.closedAt ?? null,
    projectId: has('projectId') ? input.projectId || null : existing.projectId ?? null,
    sectionId: has('sectionId') ? input.sectionId || null : existing.sectionId ?? null,
    startDate: dateRange.startDate,
    dueDate: dateRange.dueDate,
    reminderAt: has('reminderAt') ? input.reminderAt || null : existing.reminderAt ?? null,
    reminderEndAt: has('reminderEndAt') ? input.reminderEndAt || null : existing.reminderEndAt ?? null,
    priority: ['none', 'low', 'medium', 'high'].includes(input.priority) ? input.priority : existing.priority || 'none',
    urgent: has('urgent') ? Boolean(input.urgent) : Boolean(existing.urgent ?? false),
    tags: has('tags') && Array.isArray(input.tags) ? input.tags : existing.tags || [],
    recurrence: has('recurrence') ? input.recurrence || null : existing.recurrence ?? null,
    description: has('description') ? input.description ?? '' : existing.description ?? '',
    subtasks: has('subtasks') && Array.isArray(input.subtasks)
      ? input.subtasks.map((subtask, index) => normalizeSubtask(subtask, index))
      : (existing.subtasks || []).map((subtask, index) => normalizeSubtask(subtask, index)),
    attachments: has('attachments') && Array.isArray(input.attachments) ? input.attachments : existing.attachments || [],
    order: Number.isFinite(input.order) ? input.order : existing.order ?? Date.now(),
    createdAt: existing.createdAt || input.createdAt || timestamp,
    updatedAt: timestamp
  };
}

function normalizeProject(input, existing = {}) {
  const timestamp = nowISO();
  return {
    id: existing.id || input.id || createId('proj'),
    name: String(input.name ?? existing.name ?? '').trim() || '未命名项目',
    color: input.color ?? existing.color ?? 'blue',
    description: input.description ?? existing.description ?? '',
    archived: Boolean(input.archived ?? existing.archived ?? false),
    order: Number.isFinite(input.order) ? input.order : existing.order ?? Date.now(),
    sections: Array.isArray(input.sections) ? input.sections.map((section, index) => ({
      id: section.id || createId('sec'),
      name: String(section.name || '').trim() || '未命名章节',
      order: Number.isFinite(section.order) ? section.order : index + 1
    })) : existing.sections || [],
    createdAt: existing.createdAt || input.createdAt || timestamp,
    updatedAt: timestamp
  };
}

function normalizeTag(input, existing = {}) {
  const timestamp = nowISO();
  return {
    id: existing.id || input.id || createId('tag'),
    name: String(input.name ?? existing.name ?? '').trim() || '未命名标签',
    color: input.color ?? existing.color ?? 'blue',
    createdAt: existing.createdAt || input.createdAt || timestamp,
    updatedAt: timestamp
  };
}

function normalizeFilter(input, existing = {}) {
  const timestamp = nowISO();
  return {
    id: existing.id || input.id || createId('filter'),
    name: String(input.name ?? existing.name ?? '').trim() || '未命名过滤器',
    pinned: Boolean(input.pinned ?? existing.pinned ?? false),
    conditions: Array.isArray(input.conditions) ? input.conditions : existing.conditions || [],
    sort: input.sort ?? existing.sort ?? 'dueDate',
    group: input.group ?? existing.group ?? 'none',
    order: Number.isFinite(input.order) ? input.order : existing.order ?? Date.now(),
    createdAt: existing.createdAt || input.createdAt || timestamp,
    updatedAt: timestamp
  };
}

export class TodoStore {
  constructor({ dataDir = process.env.TODO_DATA_DIR || path.join(process.cwd(), 'data') } = {}) {
    this.dataDir = path.resolve(dataDir);
    this.uploadDir = path.join(this.dataDir, 'uploads');
    this.filePath = path.join(this.dataDir, 'todo-data.json');
    this.data = null;
  }

  async init() {
    await fs.mkdir(this.uploadDir, { recursive: true });
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      this.data = this.normalize(JSON.parse(raw), { preserveAuth: true });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.data = seedData();
      await this.save();
    }
  }

  normalize(payload, { preserveAuth = false } = {}) {
    const currentAuth = preserveAuth ? payload.auth : this.data?.auth;
    const createdAt = payload.createdAt || nowISO();
    return {
      version: DATA_VERSION,
      createdAt,
      updatedAt: payload.updatedAt || nowISO(),
      auth: currentAuth || {
        username: DEFAULT_USERNAME,
        password: createPasswordRecord(DEFAULT_PASSWORD)
      },
      settings: normalizeSettings(payload.settings || {}),
      projects: Array.isArray(payload.projects) ? payload.projects.map(project => normalizeProject(project)) : [],
      tags: Array.isArray(payload.tags) ? payload.tags.map(tag => normalizeTag(tag)) : [],
      filters: Array.isArray(payload.filters) ? payload.filters.map(filter => normalizeFilter(filter)) : [],
      tasks: Array.isArray(payload.tasks) ? payload.tasks.map(task => normalizeTask(task)) : []
    };
  }

  async save() {
    this.data.updatedAt = nowISO();
    const tmp = `${this.filePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(this.data, null, 2));
    await fs.rename(tmp, this.filePath);
  }

  publicData() {
    return {
      version: DATA_VERSION,
      createdAt: this.data.createdAt,
      updatedAt: this.data.updatedAt,
      user: { username: this.data.auth.username },
      settings: this.data.settings,
      projects: this.data.projects,
      tags: this.data.tags,
      filters: this.data.filters,
      tasks: this.sortedTasks(this.data.tasks).map(task => this.publicTask(task))
    };
  }

  publicTask(task) {
    return {
      ...task,
      attachments: (task.attachments || []).map(attachment => ({
        ...attachment,
        relativePath: this.attachmentAccessPath(attachment) || attachment.relativePath || ''
      }))
    };
  }

  exportData() {
    const data = this.publicData();
    delete data.user;
    return {
      ...data,
      exportedAt: nowISO()
    };
  }

  importData(payload) {
    this.data = this.normalize({
      ...payload,
      auth: this.data.auth,
      createdAt: this.data.createdAt
    });
    return this.save();
  }

  previewImport(payload) {
    const normalized = this.normalize({ ...payload, auth: this.data.auth });
    const attachmentCount = normalized.tasks.reduce((sum, task) => sum + task.attachments.length, 0);
    return {
      version: normalized.version,
      tasks: normalized.tasks.length,
      projects: normalized.projects.length,
      tags: normalized.tags.length,
      filters: normalized.filters.length,
      attachmentMetadata: attachmentCount,
      currentTasks: this.data.tasks.length,
      mode: 'replace'
    };
  }

  sortedTasks(tasks) {
    return [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
      if (priorityWeight(a.priority) !== priorityWeight(b.priority)) return priorityWeight(b.priority) - priorityWeight(a.priority);
      return (a.order || 0) - (b.order || 0);
    });
  }

  verifyPassword(password) {
    return verifyPassword(password, this.data.auth.password);
  }

  async changePassword(newPassword) {
    this.data.auth.password = createPasswordRecord(newPassword);
    await this.save();
  }

  async createTask(input) {
    const task = normalizeTask(input);
    this.data.tasks.push(task);
    await this.save();
    return task;
  }

  async updateTask(id, patch) {
    const index = this.data.tasks.findIndex(task => task.id === id);
    if (index < 0) return null;
    const existing = this.data.tasks[index];
    const next = normalizeTask({ ...existing, ...patch }, existing);
    if (patch.completed !== undefined && Boolean(patch.completed) !== Boolean(existing.completed)) {
      next.completedAt = patch.completed ? nowISO() : null;
      if (patch.completed) {
        next.closed = false;
        next.closedAt = null;
      }
      if (patch.completed && next.recurrence?.type) {
        await this.createRecurringCopy(next);
      }
    }
    if (patch.closed !== undefined && Boolean(patch.closed) !== Boolean(existing.closed)) {
      next.closedAt = patch.closed ? nowISO() : null;
      if (patch.closed) {
        next.completed = false;
        next.completedAt = null;
      }
    }
    this.data.tasks[index] = next;
    await this.save();
    return next;
  }

  async createRecurringCopy(task) {
    const nextDate = nextRecurrenceDate(task.dueDate, task.recurrence);
    if (!nextDate) return null;
    const copy = normalizeTask({
      ...task,
      id: createId('task'),
      completed: false,
      completedAt: null,
      dueDate: nextDate,
      createdAt: nowISO(),
      attachments: [],
      subtasks: task.subtasks.map((subtask, index) => normalizeSubtask({ ...subtask, id: createId('sub'), completed: false }, index))
    });
    this.data.tasks.push(copy);
    return copy;
  }

  async deleteTask(id) {
    const before = this.data.tasks.length;
    this.data.tasks = this.data.tasks.filter(task => task.id !== id);
    if (before === this.data.tasks.length) return false;
    await this.save();
    return true;
  }

  async createProject(input) {
    const project = normalizeProject(input);
    this.data.projects.push(project);
    await this.save();
    return project;
  }

  async updateProject(id, patch) {
    const index = this.data.projects.findIndex(project => project.id === id);
    if (index < 0) return null;
    const project = normalizeProject({ ...this.data.projects[index], ...patch }, this.data.projects[index]);
    this.data.projects[index] = project;
    await this.save();
    return project;
  }

  async deleteProject(id, { mode = 'move' } = {}) {
    const before = this.data.projects.length;
    this.data.projects = this.data.projects.filter(project => project.id !== id);
    if (before === this.data.projects.length) return false;
    if (mode === 'deleteTasks') {
      this.data.tasks = this.data.tasks.filter(task => task.projectId !== id);
    } else {
      this.data.tasks = this.data.tasks.map(task => task.projectId === id ? { ...task, projectId: null, sectionId: null, updatedAt: nowISO() } : task);
    }
    await this.save();
    return true;
  }

  async createTag(input) {
    const tag = normalizeTag(input);
    this.data.tags.push(tag);
    await this.save();
    return tag;
  }

  async updateTag(id, patch) {
    const index = this.data.tags.findIndex(tag => tag.id === id);
    if (index < 0) return null;
    const tag = normalizeTag({ ...this.data.tags[index], ...patch }, this.data.tags[index]);
    this.data.tags[index] = tag;
    await this.save();
    return tag;
  }

  async deleteTag(id) {
    const before = this.data.tags.length;
    this.data.tags = this.data.tags.filter(tag => tag.id !== id);
    if (before === this.data.tags.length) return false;
    this.data.tasks = this.data.tasks.map(task => ({ ...task, tags: task.tags.filter(tagId => tagId !== id) }));
    await this.save();
    return true;
  }

  async createFilter(input) {
    const filter = normalizeFilter(input);
    this.data.filters.push(filter);
    await this.save();
    return filter;
  }

  async updateFilter(id, patch) {
    const index = this.data.filters.findIndex(filter => filter.id === id);
    if (index < 0) return null;
    const filter = normalizeFilter({ ...this.data.filters[index], ...patch }, this.data.filters[index]);
    this.data.filters[index] = filter;
    await this.save();
    return filter;
  }

  async deleteFilter(id) {
    const before = this.data.filters.length;
    this.data.filters = this.data.filters.filter(filter => filter.id !== id);
    if (before === this.data.filters.length) return false;
    await this.save();
    return true;
  }

  async updateSettings(patch) {
    this.data.settings = normalizeSettings({ ...this.data.settings, ...patch }, this.data.settings);
    await this.save();
    return this.data.settings;
  }

  findAttachment(id) {
    for (const task of this.data.tasks) {
      const attachment = task.attachments.find(item => item.id === id);
      if (attachment) return { task, attachment };
    }
    return null;
  }

  uploadAccessPath(relativePath) {
    const cleanRelative = normalizeRelativeUploadPath(relativePath);
    if (!cleanRelative) return null;
    return `${this.data.settings.uploadUrlConfig.accessPrefix}/${cleanRelative}`;
  }

  attachmentStoragePath(attachment) {
    const accessPrefix = this.data.settings.uploadUrlConfig.accessPrefix;
    return storagePathFromAccessPath(attachment.storageName || '', accessPrefix)
      || storagePathFromAccessPath(attachment.relativePath || '', accessPrefix);
  }

  attachmentAccessPath(attachment) {
    const storedPath = this.attachmentStoragePath(attachment);
    return storedPath ? this.uploadAccessPath(storedPath) : null;
  }

  async resolveAttachmentFilePath(attachment) {
    const storedPath = this.attachmentStoragePath(attachment);
    if (storedPath) {
      const cleanRelative = normalizeRelativeUploadPath(storedPath);
      if (!cleanRelative) throw new Error('Invalid attachment path');
      const filePath = path.join(this.uploadDir, ...cleanRelative.split('/'));
      const relative = path.relative(this.uploadDir, filePath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid attachment path');
      return filePath;
    }
    if (!attachment.storageName) throw new Error('Missing attachment storage name');
    return path.join(this.uploadDir, normalizeFileName(attachment.storageName));
  }

  async publicUploadPath(requestPath) {
    const accessPrefix = this.data.settings.uploadUrlConfig.accessPrefix;
    if (requestPath !== accessPrefix && !requestPath.startsWith(`${accessPrefix}/`)) return null;
    let rawRelative = '';
    try {
      rawRelative = decodeURIComponent(requestPath.slice(accessPrefix.length).replace(/^\/+/, ''));
    } catch {
      return null;
    }
    const cleanRelative = normalizeRelativeUploadPath(rawRelative);
    if (!cleanRelative) return null;
    const filePath = path.join(this.uploadDir, ...cleanRelative.split('/'));
    const relative = path.relative(this.uploadDir, filePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
    try {
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) return null;
    } catch {
      return null;
    }
    return filePath;
  }

  async uniqueAttachmentName(directory, originalName) {
    let suffix = 0;
    while (suffix < 10000) {
      const candidate = appendDuplicateSuffix(originalName, suffix);
      try {
        await fs.access(path.join(directory, candidate));
        suffix += 1;
      } catch (error) {
        if (error.code === 'ENOENT') return candidate;
        throw error;
      }
    }
    return `${createId('file')}-${originalName}`;
  }

  async addAttachment(taskId, file) {
    const task = this.data.tasks.find(item => item.id === taskId);
    if (!task) return null;
    const id = createId('file');
    const safeOriginal = normalizeFileName(file.filename);
    const dateParts = uploadDateParts();
    const dateDir = path.join(this.uploadDir, ...dateParts);
    await fs.mkdir(dateDir, { recursive: true });
    const storedName = await this.uniqueAttachmentName(dateDir, safeOriginal);
    const storageName = path.posix.join(...dateParts, storedName);
    const relativePath = this.uploadAccessPath(storageName);
    await fs.writeFile(path.join(dateDir, storedName), file.content);
    const attachment = {
      id,
      originalName: safeOriginal,
      size: file.content.length,
      mimeType: file.contentType || 'application/octet-stream',
      uploadedAt: nowISO(),
      storageName,
      relativePath,
      accessPath: relativePath,
      missing: false
    };
    task.attachments.push(attachment);
    task.updatedAt = nowISO();
    await this.save();
    return attachment;
  }

  async deleteAttachment(id) {
    const found = this.findAttachment(id);
    if (!found) return false;
    found.task.attachments = found.task.attachments.filter(item => item.id !== id);
    found.task.updatedAt = nowISO();
    await fs.rm(await this.resolveAttachmentFilePath(found.attachment), { force: true });
    await this.save();
    return true;
  }

  async attachmentPath(attachment) {
    const filePath = await this.resolveAttachmentFilePath(attachment);
    await fs.access(filePath);
    return filePath;
  }

  async importAttachmentEntries(entries) {
    const attachments = this.data.tasks.flatMap(task => task.attachments.map(attachment => ({ task, attachment })));
    const byStorageName = new Map(attachments.map(item => [item.attachment.storageName, item]));
    const byStoragePath = new Map(attachments.map(item => [this.attachmentStoragePath(item.attachment), item]).filter(([key]) => key));
    const byId = new Map(attachments.map(item => [item.attachment.id, item]));
    const summary = { matched: 0, unused: 0, restored: [] };

    for (const entry of entries) {
      const cleanName = normalizeFileName(entry.basename);
      const cleanEntryPath = normalizeRelativeUploadPath(entry.name);
      const idFromName = cleanName.split('.')[0];
      const match = byStorageName.get(cleanEntryPath) || byStoragePath.get(cleanEntryPath) || byStorageName.get(cleanName) || byId.get(idFromName);
      if (!match) {
        summary.unused += 1;
        continue;
      }
      const filePath = await this.resolveAttachmentFilePath(match.attachment);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, entry.content);
      match.attachment.size = entry.content.length;
      match.attachment.missing = false;
      match.task.updatedAt = nowISO();
      summary.matched += 1;
      summary.restored.push(match.attachment.id);
    }

    await this.save();
    return summary;
  }
}

function nextRecurrenceDate(dueDate, recurrence) {
  if (!dueDate || !recurrence?.type) return null;
  const date = new Date(`${dueDate}T12:00:00`);
  const interval = Number(recurrence.interval || 1);
  if (recurrence.type === 'daily') date.setDate(date.getDate() + interval);
  if (recurrence.type === 'weekly') date.setDate(date.getDate() + interval * 7);
  if (recurrence.type === 'monthly') date.setMonth(date.getMonth() + interval);
  if (recurrence.type === 'yearly') date.setFullYear(date.getFullYear() + interval);
  if (recurrence.type === 'workdays') {
    do {
      date.setDate(date.getDate() + 1);
    } while ([0, 6].includes(date.getDay()));
  }
  return date.toISOString().slice(0, 10);
}
