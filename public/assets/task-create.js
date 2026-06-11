export function resolveTaskModalDefaults(payload = {}, route = { name: 'today' }, selectedCalendarDate = '', fallbackDueDate = '') {
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
    priority: payload.priority || 'none',
    urgent: Boolean(payload.urgent),
    tags: Array.isArray(payload.tags) ? [...payload.tags] : []
  };
}

export function preserveTaskCreateContext(values = {}) {
  return {
    title: '',
    startDate: values.startDate || '',
    dueDate: values.dueDate || '',
    reminderAt: values.reminderAt || '',
    reminderEndAt: values.reminderEndAt || '',
    projectId: values.projectId || '',
    sectionId: values.sectionId || '',
    tagId: values.tagId || '',
    priority: values.priority || 'none',
    urgent: Boolean(values.urgent),
    tags: Array.isArray(values.tags) ? [...values.tags] : []
  };
}
