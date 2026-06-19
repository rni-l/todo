import type { Task } from '../types.ts';

export interface TaskDateRange {
  startDate: string | null;
  endDate: string | null;
}

export interface TaskDateStatus extends TaskDateRange {
  key: 'overdue' | 'today' | 'future' | 'undated';
  tone: 'danger' | 'success' | 'accent' | 'muted';
  dueDate: string | null;
}

export interface MonthDay {
  date: string;
  inMonth: boolean;
}

export interface CalendarMonth {
  key: string;
  label: string;
  days: MonthDay[];
}

export interface TaskRangeSegment<T extends Partial<Task> = Task> {
  task: T;
  startDate: string;
  endDate: string;
  visibleStart: string;
  visibleEnd: string;
  startIndex: number;
  endIndex: number;
  span: number;
  isRange: boolean;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

export type CalendarTaskDragType = 'single' | 'range';

function addDaysISO(baseISO: string, offsetDays: number) {
  const date = new Date(`${baseISO}T12:00:00`);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function parseISODate(value: string) {
  const normalized = value.length === 7 ? `${value}-01` : value.slice(0, 10);
  return new Date(`${normalized}T12:00:00`);
}

export function addDays(baseISO: string, offsetDays: number) {
  return addDaysISO(baseISO, offsetDays);
}

export function todayISO(offsetDays = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function nextWeekdayISO(targetDay: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  const currentDay = date.getDay();
  let offset = (targetDay - currentDay + 7) % 7;
  if (offset === 0) offset = 7;
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function taskDateRange(task: Partial<Task> = {}): TaskDateRange {
  const startDate = task.startDate || task.dueDate || null;
  const endDate = task.dueDate || task.startDate || null;
  if (startDate && endDate && startDate > endDate) {
    return { startDate: endDate, endDate: startDate };
  }
  return { startDate, endDate };
}

export function taskCoversDate(task: Partial<Task>, day: string) {
  if (!day) return false;
  const { startDate, endDate } = taskDateRange(task);
  if (!startDate || !endDate) return false;
  return day >= startDate && day <= endDate;
}

export function getTaskDateStatus(task: Partial<Task>, today: string): TaskDateStatus {
  const { startDate, endDate } = taskDateRange(task);
  if (!startDate || !endDate) return { key: 'undated', tone: 'muted', dueDate: null, startDate: null, endDate: null };
  if (endDate < today) return { key: 'overdue', tone: 'danger', dueDate: endDate, startDate, endDate };
  if (today >= startDate && today <= endDate) return { key: 'today', tone: 'success', dueDate: endDate, startDate, endDate };
  return { key: 'future', tone: 'accent', dueDate: endDate, startDate, endDate };
}

export function getRecentWindowDays(today: string) {
  return Array.from({ length: 7 }, (_, index) => addDaysISO(today, index));
}

export function shouldShowInRecentView(task: Partial<Task>, today: string) {
  if (!task || task.completed || task.closed) return false;
  const { startDate, endDate } = taskDateRange(task);
  if (!startDate || !endDate) return false;
  if (endDate < today) return true;
  const recentWindow = getRecentWindowDays(today);
  return startDate <= recentWindow[recentWindow.length - 1] && endDate >= today;
}

export function buildTaskRangeSegments<T extends Partial<Task>>(tasks: T[] = [], days: string[] = []): TaskRangeSegment<T>[] {
  const dayIndex = new Map(days.map((day, index) => [day, index]));
  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  if (!firstDay || !lastDay) return [];

  return tasks
    .map(task => {
      const { startDate, endDate } = taskDateRange(task);
      if (!startDate || !endDate) return null;
      if (endDate < firstDay || startDate > lastDay) return null;
      const visibleStart = startDate < firstDay ? firstDay : startDate;
      const visibleEnd = endDate > lastDay ? lastDay : endDate;
      const startIndex = dayIndex.get(visibleStart);
      const endIndex = dayIndex.get(visibleEnd);
      if (startIndex === undefined || endIndex === undefined) return null;
      return {
        task,
        startDate,
        endDate,
        visibleStart,
        visibleEnd,
        startIndex,
        endIndex,
        span: endIndex - startIndex + 1,
        isRange: startDate !== endDate,
        continuesBefore: startDate < visibleStart,
        continuesAfter: endDate > visibleEnd
      };
    })
    .filter((segment): segment is TaskRangeSegment<T> => Boolean(segment));
}

export function dateInputDisplayValue(value?: string | null) {
  return value ? value.replace(/-/g, '/') : '';
}

export function parseDateInput(value: unknown, baseValue = todayISO()) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = raw
    .replace(/[年月.]/g, '/')
    .replace(/日/g, '')
    .replace(/-/g, '/')
    .replace(/\s+/g, '');
  const base = new Date(`${baseValue || todayISO()}T12:00:00`);
  let year = base.getFullYear();
  let month = base.getMonth() + 1;
  let day: number | null = null;

  if (/^\d{1,2}$/.test(normalized)) {
    day = Number(normalized);
  } else if (/^\d{1,2}\/\d{1,2}$/.test(normalized)) {
    const parts = normalized.split('/').map(Number);
    month = parts[0];
    day = parts[1];
  } else if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(normalized)) {
    const parts = normalized.split('/').map(Number);
    year = parts[0];
    month = parts[1];
    day = parts[2];
  } else if (/^\d{8}$/.test(normalized)) {
    year = Number(normalized.slice(0, 4));
    month = Number(normalized.slice(4, 6));
    day = Number(normalized.slice(6, 8));
  } else {
    return null;
  }

  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

export function monthKey(reference: Date | string = new Date()) {
  const base = typeof reference === 'string' ? parseISODate(reference) : new Date(reference);
  base.setDate(1);
  base.setHours(12, 0, 0, 0);
  return base.toISOString().slice(0, 7);
}

export function offsetMonthKey(baseKey: string, offsetMonths: number) {
  const base = parseISODate(`${baseKey}-01`);
  base.setMonth(base.getMonth() + offsetMonths, 1);
  base.setHours(12, 0, 0, 0);
  return base.toISOString().slice(0, 7);
}

export function monthLabel(key: string) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(parseISODate(`${key}-01`));
}

export function monthGridDays(reference: Date | string = new Date()): MonthDay[] {
  const base = typeof reference === 'string' ? parseISODate(reference.length === 7 ? `${reference}-01` : reference) : new Date(reference);
  base.setDate(1);
  base.setHours(12, 0, 0, 0);
  const currentMonth = base.getMonth();
  const start = new Date(base);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(base.getFullYear(), currentMonth + 1, 0, 12, 0, 0, 0);
  end.setDate(end.getDate() + (7 - ((end.getDay() + 6) % 7) - 1));
  const days: MonthDay[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    days.push({
      date: cursor.toISOString().slice(0, 10),
      inMonth: cursor.getMonth() === currentMonth
    });
  }
  const totalCells = days.length <= 35 ? 35 : 42;
  while (days.length < totalCells) {
    const lastDate = days[days.length - 1]?.date || base.toISOString().slice(0, 10);
    const nextDate = new Date(`${lastDate}T12:00:00`);
    nextDate.setDate(nextDate.getDate() + 1);
    days.push({
      date: nextDate.toISOString().slice(0, 10),
      inMonth: nextDate.getMonth() === currentMonth
    });
  }
  return days.slice(0, totalCells);
}

export function buildCalendarMonth(key: string): CalendarMonth {
  return {
    key,
    label: monthLabel(key),
    days: monthGridDays(key)
  };
}

export function buildCalendarMonthWindow(center: string = todayISO(), before = 1, after = 1): CalendarMonth[] {
  const centerKey = monthKey(center);
  return Array.from({ length: before + after + 1 }, (_, index) => buildCalendarMonth(offsetMonthKey(centerKey, index - before)));
}

export function extendCalendarMonthWindow(months: CalendarMonth[], direction: 'before' | 'after', count = 1): CalendarMonth[] {
  const keys = new Set(months.map(month => month.key));
  const anchor = direction === 'before' ? months[0]?.key : months[months.length - 1]?.key;
  if (!anchor) return buildCalendarMonthWindow(todayISO(), direction === 'before' ? count : 0, direction === 'after' ? count : 0);

  const additions = Array.from({ length: count }, (_, index) => {
    const offset = direction === 'before' ? -(count - index) : index + 1;
    return buildCalendarMonth(offsetMonthKey(anchor, offset));
  }).filter(month => !keys.has(month.key));

  return direction === 'before' ? [...additions, ...months] : [...months, ...additions];
}

export function shiftTaskDateRange(task: Partial<Task>, targetStartDate: string): TaskDateRange {
  const { startDate, endDate } = taskDateRange(task);
  if (!targetStartDate) return { startDate, endDate };
  if (!startDate || !endDate || startDate === endDate) {
    return { startDate: null, endDate: targetStartDate };
  }
  const start = parseISODate(startDate);
  const end = parseISODate(endDate);
  const durationDays = Math.round((end.getTime() - start.getTime()) / 86400000);
  return {
    startDate: targetStartDate,
    endDate: addDaysISO(targetStartDate, durationDays)
  };
}

export function calendarTaskDropPatch(task: Partial<Task>, targetDate: string, dragType: CalendarTaskDragType): Pick<Partial<Task>, 'startDate' | 'dueDate'> | null {
  const range = taskDateRange(task);
  if (dragType === 'range' && range.startDate && range.endDate && range.startDate !== range.endDate) {
    const shifted = shiftTaskDateRange(task, targetDate);
    if (shifted.startDate === range.startDate && shifted.endDate === range.endDate) return null;
    return { startDate: shifted.startDate, dueDate: shifted.endDate };
  }
  if (task.dueDate === targetDate) return null;
  return { dueDate: targetDate };
}

export function monthWeekdayLabels() {
  return ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
}

export function shortDate(value?: string | null) {
  if (!value) return '无日期';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  if (value === todayISO()) return '今天';
  if (value === todayISO(1)) return '明天';
  if (value === todayISO(-1)) return '昨天';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatLongDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(`${value}T12:00:00`));
}

export function weekdayName(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(new Date(`${value}T12:00:00`));
}

export function formatDateRange(startDate?: string | null, endDate?: string | null) {
  if (!startDate && !endDate) return '无日期';
  if (!startDate || !endDate || startDate === endDate) return shortDate(startDate || endDate || '');
  return `${shortDate(startDate)} - ${shortDate(endDate)}`;
}

export function formatTime(value?: string | null) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function localDatetime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export function localDateValue(value?: string | null) {
  return localDatetime(value).slice(0, 10);
}

export function localTimeValue(value?: string | null) {
  return localDatetime(value).slice(11, 16);
}

export function dateTimeLocalValue(date: string, time: string) {
  return date && time ? `${date}T${time}` : '';
}

export function reminderISO(date: string, time: string) {
  const value = dateTimeLocalValue(date, time);
  return value ? new Date(value).toISOString() : '';
}

export function normalizeReminderInput(value: unknown) {
  const raw = String(value || '');
  if (!raw) return '';
  return raw.length === 16 ? new Date(raw).toISOString() : raw;
}

export function relativeDate(value?: string | null) {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未知';
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return shortDate(date.toISOString().slice(0, 10));
}
