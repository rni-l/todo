import type { CreateTaskDefaults, Priority, RouteState } from '../types.ts';

export function resolveTaskModalDefaults(
  payload: Partial<CreateTaskDefaults> = {},
  route: Partial<RouteState> = { name: 'today' },
  selectedCalendarDate = '',
  fallbackDueDate = ''
): CreateTaskDefaults {
  const resolvedDate = payload.dueDate || (route?.name === 'calendar' ? selectedCalendarDate || '' : fallbackDueDate || '');
  return {
    title: payload.title || '',
    startDate: payload.startDate || '',
    dueDate: resolvedDate,
    reminderAt: payload.reminderAt || '',
    reminderEndAt: payload.reminderEndAt || '',
    projectId: payload.projectId || '',
    sectionId: payload.sectionId || '',
    tagId: payload.tagId || '',
    priority: (payload.priority || 'none') as Priority,
    urgent: Boolean(payload.urgent),
    tags: Array.isArray(payload.tags) ? [...payload.tags] : []
  };
}

export function preserveTaskCreateContext(values: Partial<CreateTaskDefaults> = {}): CreateTaskDefaults {
  return {
    title: '',
    startDate: values.startDate || '',
    dueDate: values.dueDate || '',
    reminderAt: values.reminderAt || '',
    reminderEndAt: values.reminderEndAt || '',
    projectId: values.projectId || '',
    sectionId: values.sectionId || '',
    tagId: values.tagId || '',
    priority: (values.priority || 'none') as Priority,
    urgent: Boolean(values.urgent),
    tags: Array.isArray(values.tags) ? [...values.tags] : []
  };
}
