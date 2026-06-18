import type { Attachment, Project, PublicData, SmartFilter, SmartFilterCondition, Task, TaskGroupModel } from '../types.ts';
import { getTaskDateStatus, shouldShowInRecentView, taskCoversDate, taskDateRange, todayISO } from './dates.ts';
import { groupLabel, priorityLabel, priorityMeta, sortLabel } from './format.ts';

export function openTasks(data: PublicData) {
  return data.tasks.filter(task => !task.completed && !task.closed);
}

export function completedTasks(data: PublicData) {
  return data.tasks
    .filter(task => task.completed)
    .sort((a, b) => String(b.completedAt || '').localeCompare(String(a.completedAt || '')));
}

export function closedTasks(data: PublicData) {
  return data.tasks
    .filter(task => task.closed)
    .sort((a, b) => String(b.closedAt || '').localeCompare(String(a.closedAt || '')));
}

export function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
    if (priorityMeta(a.priority).weight !== priorityMeta(b.priority).weight) return priorityMeta(b.priority).weight - priorityMeta(a.priority).weight;
    if ((a.dueDate || '') !== (b.dueDate || '')) return String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'));
    return (a.order || 0) - (b.order || 0);
  });
}

export function recentTasks(data: PublicData, today = todayISO()) {
  return data.tasks.filter(task => shouldShowInRecentView(task, today));
}

export function activeProjects(data: PublicData) {
  return data.projects.filter(project => !project.archived).sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function archivedProjects(data: PublicData) {
  return data.projects.filter(project => project.archived).sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function taskById(data: PublicData | null, id?: string | null) {
  return data?.tasks.find(task => task.id === id) || null;
}

export function projectById(data: PublicData | null, id?: string | null) {
  return data?.projects.find(project => project.id === id) || null;
}

export function tagById(data: PublicData | null, id?: string | null) {
  return data?.tags.find(tag => tag.id === id) || null;
}

export function countOpenByProject(data: PublicData, id: string) {
  return openTasks(data).filter(task => task.projectId === id).length;
}

export function tagTasks(data: PublicData, id: string) {
  return openTasks(data).filter(task => task.tags.includes(id));
}

export function allAttachments(data: PublicData): { task: Task; attachment: Attachment }[] {
  return data.tasks.flatMap(task => (task.attachments || []).map(attachment => ({ task, attachment })));
}

export function isImportantTask(task: Task) {
  return ['high', 'medium'].includes(task.priority);
}

export function isUrgentTask(task: Task) {
  return Boolean(task.urgent);
}

export function matrixQuadrants(data: PublicData) {
  const tasks = openTasks(data);
  return [
    {
      key: 'important-urgent',
      title: '重要且紧急',
      subtitle: '现在处理',
      tone: 'danger' as const,
      tasks: tasks.filter(task => isImportantTask(task) && isUrgentTask(task))
    },
    {
      key: 'important-not-urgent',
      title: '重要不紧急',
      subtitle: '安排时间',
      tone: 'success' as const,
      tasks: tasks.filter(task => isImportantTask(task) && !isUrgentTask(task))
    },
    {
      key: 'not-important-urgent',
      title: '紧急不重要',
      subtitle: '快速处理或委托',
      tone: 'warn' as const,
      tasks: tasks.filter(task => !isImportantTask(task) && isUrgentTask(task))
    },
    {
      key: 'not-important-not-urgent',
      title: '不重要不紧急',
      subtitle: '稍后或删除',
      tone: 'muted' as const,
      tasks: tasks.filter(task => !isImportantTask(task) && !isUrgentTask(task))
    }
  ];
}

export function calendarDayLimit(data: PublicData | null) {
  const value = Number.parseInt(String(data?.settings?.calendarDayLimit || ''), 10);
  if (!Number.isFinite(value)) return 3;
  return Math.min(6, Math.max(1, value));
}

export function sidebarCounts(data: PublicData, today = todayISO()) {
  return {
    today: openTasks(data).filter(task => {
      const endDate = taskDateRange(task).endDate;
      return taskCoversDate(task, today) || Boolean(endDate && endDate < today);
    }).length,
    inbox: openTasks(data).filter(task => !task.projectId).length,
    upcoming: openTasks(data).filter(task => {
      const endDate = taskDateRange(task).endDate;
      return Boolean(endDate && endDate > today);
    }).length,
    recent: recentTasks(data, today).length,
    calendar: openTasks(data).filter(task => taskDateRange(task).endDate).length,
    matrix: openTasks(data).length,
    reports: '',
    projects: activeProjects(data).length,
    tags: data.tags.length,
    filters: data.filters.length,
    completed: completedTasks(data).length,
    closed: closedTasks(data).length
  };
}

export function matchCondition(data: PublicData, task: Task, condition: SmartFilterCondition, today = todayISO()) {
  const value = condition.value;
  if (condition.field === 'priority') return task.priority === value;
  if (condition.field === 'projectId') return task.projectId === value;
  if (condition.field === 'tag') return task.tags.includes(String(value));
  if (condition.field === 'due') {
    if (value === 'today') return taskCoversDate(task, today);
    if (value === 'upcoming') return Boolean(taskDateRange(task).endDate && taskDateRange(task).endDate! > today);
    if (value === 'none') return !taskDateRange(task).endDate;
    return taskCoversDate(task, String(value));
  }
  if (condition.field === 'hasAttachment') return Boolean(task.attachments?.length) === Boolean(value);
  if (condition.field === 'hasReminder') return Boolean(task.reminderAt) === Boolean(value);
  if (condition.field === 'completed') return Boolean(task.completed) === Boolean(value);
  return true;
}

export function filterTasks(data: PublicData, filter: SmartFilter, today = todayISO()) {
  const tasks = openTasks(data).filter(task => filter.conditions.every(condition => matchCondition(data, task, condition, today)));
  return sortTasks(tasks);
}

export function taskGroup(id: string, title: string, tasks: Task[], tone: TaskGroupModel['tone'] = ''): TaskGroupModel {
  return { id, title, tasks: sortTasks(tasks), tone };
}

export function groupedFilterTasks(data: PublicData, filter: SmartFilter, today = todayISO()): TaskGroupModel[] {
  const tasks = filterTasks(data, filter, today);
  if (filter.group === 'project') {
    const ids = [...new Set(tasks.map(task => task.projectId || ''))];
    return ids.map(id => taskGroup(`filter-project-${id || 'inbox'}`, id ? projectById(data, id)?.name || '未知项目' : '收件箱', tasks.filter(task => (task.projectId || '') === id), ''));
  }
  if (filter.group === 'priority') {
    return ['high', 'medium', 'low', 'none'].map(priority => taskGroup(`filter-priority-${priority}`, priorityLabel(priority), tasks.filter(task => task.priority === priority), priority === 'high' ? 'danger' : ''));
  }
  if (filter.group === 'date') {
    return [
      taskGroup('filter-date-today', '今天', tasks.filter(task => taskCoversDate(task, today)), 'success'),
      taskGroup('filter-date-future', '未来', tasks.filter(task => taskDateRange(task).endDate && taskDateRange(task).endDate! > today), ''),
      taskGroup('filter-date-none', '无日期', tasks.filter(task => !taskDateRange(task).endDate), 'muted')
    ];
  }
  return [taskGroup(`filter-${filter.id}`, filter.name, tasks, 'success')];
}

export function conditionFieldLabel(field: string) {
  return { priority: '优先级', projectId: '项目', tag: '标签', due: '日期', hasAttachment: '附件', hasReminder: '提醒', completed: '完成状态' }[field] || field;
}

export function conditionValueLabel(data: PublicData, condition: SmartFilterCondition) {
  if (condition.field === 'projectId') return projectById(data, String(condition.value))?.name || String(condition.value);
  if (condition.field === 'tag') return `#${tagById(data, String(condition.value))?.name || condition.value}`;
  if (condition.field === 'priority') return priorityLabel(String(condition.value));
  if (condition.field === 'due') return { today: '今天', upcoming: '未来', none: '无日期' }[String(condition.value)] || String(condition.value);
  return String(condition.value);
}

export function filterSummary(data: PublicData, filter: SmartFilter) {
  const conditionText = filter.conditions.map(condition => `${conditionFieldLabel(condition.field)} ${condition.operator || '是'} ${conditionValueLabel(data, condition)}`).join('，');
  return `${conditionText || '全部任务'} · 按${sortLabel(filter.sort)}排序 · ${groupLabel(filter.group)}`;
}

export function projectProgress(tasks: Task[], project: Project) {
  const projectTasks = tasks.filter(task => task.projectId === project.id);
  return projectTasks.length ? Math.round((projectTasks.filter(task => task.completed).length / projectTasks.length) * 100) : 0;
}

export function reminderCoversDate(task: Task, day: string) {
  const start = task.reminderAt?.slice(0, 10) || '';
  const end = task.reminderEndAt?.slice(0, 10) || start;
  return Boolean(start && day >= start && day <= end);
}

export function statusLabel(key: string) {
  return {
    overdue: '逾期',
    today: '今天',
    future: '未来',
    undated: '无日期',
    completed: '已完成',
    closed: '已关闭'
  }[key] || key;
}

export function taskMetaText(data: PublicData, task: Task) {
  const project = projectById(data, task.projectId);
  const projectName = project ? `${project.name}${project.archived ? '（已归档）' : ''}` : '收件箱';
  const range = taskDateRange(task);
  const status = getTaskDateStatus(task, todayISO());
  return `${projectName} · ${status.key === 'undated' ? '无日期' : `${range.startDate || ''}${range.endDate && range.endDate !== range.startDate ? ` - ${range.endDate}` : ''}`} · ${priorityLabel(task.priority)}`;
}
