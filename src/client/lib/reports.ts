import type { PublicData, Task } from '../types.ts';
import { getRecentWindowDays, getTaskDateStatus, taskCoversDate, taskDateRange } from './dates.ts';

function bucketStatus(task: Partial<Task>, today: string) {
  if (task.closed) return 'closed';
  if (task.completed) return 'completed';
  return getTaskDateStatus(task, today).key;
}

function startOfWeek(today: string) {
  const date = new Date(`${today}T12:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

export function buildReportSummary(data: Pick<PublicData, 'tasks' | 'projects'> | null | undefined, today: string) {
  const tasks = data?.tasks || [];
  const projects = data?.projects || [];
  const open = tasks.filter(task => !task.completed && !task.closed);
  const completed = tasks.filter(task => task.completed);
  const closed = tasks.filter(task => task.closed);
  const recentWindow = getRecentWindowDays(today);
  const recentEnd = recentWindow[recentWindow.length - 1];
  const weekStart = startOfWeek(today);

  const projectMap = new Map(projects.map(project => [project.id, project]));
  const datedOpen = open.filter(task => taskDateRange(task).endDate);

  const priorityBreakdown = ['high', 'medium', 'low', 'none'].map(key => ({
    key,
    count: open.filter(task => task.priority === key).length
  }));

  const projectBreakdown = [...projectMap.values()]
    .map(project => {
      const projectTasks = tasks.filter(task => task.projectId === project.id);
      const projectOpen = projectTasks.filter(task => !task.completed && !task.closed);
      const overdue = projectOpen.filter(task => {
        const { endDate } = taskDateRange(task);
        return endDate && endDate < today;
      }).length;
      return {
        id: project.id,
        name: project.name,
        open: projectOpen.length,
        completed: projectTasks.filter(task => task.completed).length,
        closed: projectTasks.filter(task => task.closed).length,
        overdue
      };
    })
    .filter(project => project.open || project.completed || project.closed)
    .sort((a, b) => b.open - a.open || b.overdue - a.overdue || a.name.localeCompare(b.name));

  const dueBuckets = recentWindow.map(day => ({
    day,
    count: open.filter(task => taskCoversDate(task, day)).length
  }));

  const statusBuckets = ['overdue', 'today', 'future', 'undated', 'completed', 'closed'].map(key => ({
    key,
    count: tasks.filter(task => bucketStatus(task, today) === key).length
  }));

  const completedToday = completed.filter(task => task.completedAt?.slice(0, 10) === today).length;
  const completedThisWeek = completed.filter(task => {
    const day = task.completedAt?.slice(0, 10);
    return day && day >= weekStart && day <= today;
  }).length;

  return {
    summary: {
      open: open.length,
      overdue: open.filter(task => {
        const { endDate } = taskDateRange(task);
        return endDate && endDate < today;
      }).length,
      dueToday: open.filter(task => taskCoversDate(task, today)).length,
      completedToday,
      completedThisWeek,
      closed: closed.length
    },
    priorityBreakdown,
    projectBreakdown,
    dueBuckets,
    statusBuckets,
    insights: {
      datedOpen: datedOpen.length,
      upcomingWeek: open.filter(task => {
        const { startDate, endDate } = taskDateRange(task);
        return startDate && endDate && startDate <= recentEnd && endDate >= today;
      }).length,
      inboxOpen: open.filter(task => !task.projectId).length,
      urgentOpen: open.filter(task => task.urgent).length
    }
  };
}
