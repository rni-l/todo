function addDaysISO(baseISO, offsetDays) {
  const date = new Date(`${baseISO}T12:00:00`);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function getTaskDateStatus(task, today) {
  const dueDate = task?.dueDate || null;
  if (!dueDate) return { key: 'undated', tone: 'muted', dueDate: null };
  if (dueDate < today) return { key: 'overdue', tone: 'danger', dueDate };
  if (dueDate === today) return { key: 'today', tone: 'success', dueDate };
  return { key: 'future', tone: 'accent', dueDate };
}

export function getRecentWindowDays(today) {
  return Array.from({ length: 7 }, (_, index) => addDaysISO(today, index));
}

export function shouldShowInRecentView(task, today) {
  if (!task || task.completed) return false;
  const dueDate = task.dueDate || null;
  if (!dueDate) return false;
  if (dueDate < today) return true;
  const recentWindow = getRecentWindowDays(today);
  return dueDate >= today && dueDate <= recentWindow[recentWindow.length - 1];
}
