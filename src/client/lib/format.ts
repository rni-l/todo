import type { Priority } from '../types';

export function priorityMeta(priority?: string | null) {
  const key = (['high', 'medium', 'low', 'none'].includes(priority || '') ? priority : 'none') as Priority;
  return {
    key,
    weight: { high: 3, medium: 2, low: 1, none: 0 }[key],
    tone: { high: 'danger', medium: 'warn', low: 'success', none: 'muted' }[key],
    label: { high: '高优先级', medium: '中优先级', low: '低优先级', none: '普通' }[key],
    shortLabel: { high: '高', medium: '中', low: '低', none: '普通' }[key]
  };
}

export function priorityLabel(priority?: string | null) {
  return priorityMeta(priority).label;
}

export function fileExtension(name?: string | null) {
  const extension = String(name || '').split('.').pop();
  return extension && extension !== name ? extension.slice(0, 3).toUpperCase() : 'FILE';
}

export function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function themeLabel(theme?: string) {
  return { system: '跟随系统', light: '浅色', dark: '深色' }[theme || ''] || theme || '跟随系统';
}

export function settingsPanelLabel(id: string) {
  return {
    account: '账号与安全',
    appearance: '外观',
    notifications: '通知',
    data: '数据导入导出',
    attachments: '附件导入导出',
    about: '应用信息'
  }[id] || id;
}

export function sortLabel(sort?: string) {
  return { dueDate: '截止日期', priority: '优先级', createdAt: '创建时间', updatedAt: '更新时间', manual: '手动' }[sort || ''] || '截止日期';
}

export function groupLabel(group?: string) {
  return {
    none: '不分组',
    date: '按日期',
    project: '按项目',
    tag: '按标签',
    priority: '按优先级',
    completion: '按完成状态'
  }[group || ''] || '不分组';
}
