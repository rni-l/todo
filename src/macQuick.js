import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

function localDay(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateRange(task) {
  const start = task.startDate || task.dueDate || null;
  const end = task.dueDate || task.startDate || null;
  return start && end && start > end ? [end, start] : [start, end];
}

function quickTask(task) {
  return {
    id: task.id,
    title: task.title,
    dueDate: task.dueDate,
    priority: task.priority
  };
}

export function macQuickSummary(data, today = localDay()) {
  const overdue = [];
  const todayTasks = [];
  for (const task of data.tasks) {
    if (task.completed || task.closed) continue;
    const [start, end] = dateRange(task);
    if (!start || !end) continue;
    if (end < today) overdue.push(task);
    else if (start <= today && today <= end) todayTasks.push(task);
  }
  const rank = { high: 3, medium: 2, low: 1, none: 0 };
  const sort = (a, b) => (rank[b.priority] || 0) - (rank[a.priority] || 0)
    || String(a.dueDate || '').localeCompare(String(b.dueDate || ''))
    || (a.order || 0) - (b.order || 0);
  overdue.sort(sort);
  todayTasks.sort(sort);
  return {
    date: today,
    updatedAt: data.updatedAt,
    overdueCount: overdue.length,
    todayCount: todayTasks.length,
    overdue: overdue.slice(0, 20).map(quickTask),
    today: todayTasks.slice(0, 20).map(quickTask)
  };
}

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export class MacQuickAccess {
  constructor({ runtime, token, stateDir }) {
    this.runtime = runtime;
    this.token = token || '';
    this.grantFile = path.join(stateDir, 'mac-quick-grant.json');
  }

  validToken(header = '') {
    if (!this.token || !header.startsWith('Bearer ')) return false;
    const supplied = Buffer.from(header.slice(7));
    const expected = Buffer.from(this.token);
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  }

  fingerprint() {
    return digest(JSON.stringify(this.runtime.store.data.auth.password));
  }

  async grant() {
    await fs.mkdir(path.dirname(this.grantFile), { recursive: true });
    await fs.writeFile(this.grantFile, JSON.stringify({
      authFingerprint: this.fingerprint(),
      tokenFingerprint: digest(this.token)
    }), { mode: 0o600 });
  }

  async revoke() {
    await fs.rm(this.grantFile, { force: true });
  }

  async authorized(header = '') {
    if (!this.validToken(header)) return false;
    try {
      const grant = JSON.parse(await fs.readFile(this.grantFile, 'utf8'));
      return grant.authFingerprint === this.fingerprint()
        && grant.tokenFingerprint === digest(this.token);
    } catch {
      return false;
    }
  }

  async summary() {
    await this.runtime.reload();
    return macQuickSummary(this.runtime.store.publicData());
  }

  async createToday(title) {
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle || cleanTitle.length > 500) {
      const error = new Error('invalid_title');
      error.status = 400;
      throw error;
    }
    await this.runtime.write(store => store.createTask({ title: cleanTitle, dueDate: localDay() }));
    return this.summary();
  }

  async complete(taskId) {
    const task = await this.runtime.write(store => store.updateTask(taskId, { completed: true }));
    if (!task) {
      const error = new Error('task_not_found');
      error.status = 404;
      throw error;
    }
    return this.summary();
  }
}
