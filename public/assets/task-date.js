function addDaysISO(baseISO, offsetDays) {
  const date = new Date(`${baseISO}T12:00:00`);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function taskDateRange(task = {}) {
  const startDate = task.startDate || task.dueDate || null;
  const endDate = task.dueDate || task.startDate || null;
  if (startDate && endDate && startDate > endDate) {
    return { startDate: endDate, endDate: startDate };
  }
  return { startDate, endDate };
}

export function taskCoversDate(task, day) {
  if (!day) return false;
  const { startDate, endDate } = taskDateRange(task);
  if (!startDate || !endDate) return false;
  return day >= startDate && day <= endDate;
}

export function getTaskDateStatus(task, today) {
  const { startDate, endDate } = taskDateRange(task);
  if (!startDate || !endDate) return { key: 'undated', tone: 'muted', dueDate: null, startDate: null, endDate: null };
  if (endDate < today) return { key: 'overdue', tone: 'danger', dueDate: endDate, startDate, endDate };
  if (today >= startDate && today <= endDate) return { key: 'today', tone: 'success', dueDate: endDate, startDate, endDate };
  return { key: 'future', tone: 'accent', dueDate: endDate, startDate, endDate };
}

export function getRecentWindowDays(today) {
  return Array.from({ length: 7 }, (_, index) => addDaysISO(today, index));
}

export function shouldShowInRecentView(task, today) {
  if (!task || task.completed || task.closed) return false;
  const { startDate, endDate } = taskDateRange(task);
  if (!startDate || !endDate) return false;
  if (endDate < today) return true;
  const recentWindow = getRecentWindowDays(today);
  return startDate <= recentWindow[recentWindow.length - 1] && endDate >= today;
}
