export type Priority = 'none' | 'low' | 'medium' | 'high';
export type Theme = 'system' | 'light' | 'dark';
export type Density = 'comfortable' | 'compact';

export type RouteName =
  | 'today'
  | 'inbox'
  | 'upcoming'
  | 'recent'
  | 'calendar'
  | 'matrix'
  | 'reports'
  | 'projects'
  | 'project'
  | 'tags'
  | 'tag'
  | 'filters'
  | 'filter'
  | 'completed'
  | 'closed'
  | 'settings';

export interface RouteState {
  name: RouteName;
  id: string | null;
}

export interface AppSettings {
  theme: Theme;
  density: Density;
  defaultReminderTime: string;
  notificationsEnabled: boolean;
  dockDrawer: boolean;
  sidebarCollapsed: boolean;
  compactRows: boolean;
  pwaInstallDismissed: boolean;
  calendarDayLimit: number;
  uploadUrlConfig: UploadUrlConfig;
}

export interface UploadUrlConfig {
  accessPrefix: string;
  baseUrl: string;
  paramKey: string;
}

export interface ProjectSection {
  id: string;
  name: string;
  order: number;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  description: string;
  archived: boolean;
  order: number;
  sections: ProjectSection[];
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface SmartFilterCondition {
  field: 'priority' | 'projectId' | 'tag' | 'due' | 'hasAttachment' | 'hasReminder' | 'completed' | string;
  operator?: string;
  value: string | boolean | null;
}

export interface SmartFilter {
  id: string;
  name: string;
  pinned: boolean;
  conditions: SmartFilterCondition[];
  sort: string;
  group: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  storageName: string;
  relativePath?: string;
  accessPath?: string;
  missing?: boolean;
}

export interface Subtask {
  id?: string;
  title: string;
  completed: boolean;
  order: number;
  dueDate: string | null;
  priority: Priority;
}

export interface Recurrence {
  type: 'daily' | 'weekly' | 'monthly' | 'workdays' | string;
  interval: number;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  completedAt: string | null;
  closed: boolean;
  closedAt: string | null;
  projectId: string | null;
  sectionId: string | null;
  startDate: string | null;
  dueDate: string | null;
  reminderAt: string | null;
  reminderEndAt: string | null;
  priority: Priority;
  urgent: boolean;
  tags: string[];
  recurrence: Recurrence | null;
  description: string;
  subtasks: Subtask[];
  attachments: Attachment[];
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicData {
  version: number;
  createdAt: string;
  updatedAt: string;
  user: { username: string };
  settings: AppSettings;
  projects: Project[];
  tags: Tag[];
  filters: SmartFilter[];
  tasks: Task[];
}

export interface TaskGroupModel {
  id: string;
  title: string;
  tone?: 'danger' | 'success' | 'warn' | 'muted' | 'accent' | '';
  tasks: Task[];
  dropProjectId?: string | null;
  dropSectionId?: string | null;
}

export interface CreateTaskDefaults {
  title: string;
  startDate: string;
  dueDate: string;
  reminderAt: string;
  reminderEndAt: string;
  projectId: string;
  sectionId: string;
  tagId: string;
  priority: Priority;
  urgent: boolean;
  tags: string[];
}

export interface ImportPreview {
  version: number;
  tasks: number;
  projects: number;
  tags: number;
  filters: number;
  attachmentMetadata: number;
  currentTasks: number;
  mode: string;
}
