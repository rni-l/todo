import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createPasswordRecord,
  createSessionSecret,
  createSessionToken,
  validateNewPassword,
  verifyPassword,
  verifySessionToken
} from '../src/auth.js';
import { createZip, parseZip } from '../src/zip.js';
import { TodoStore } from '../src/storage.js';

test('password records verify the original password only', () => {
  const record = createPasswordRecord('correct horse battery staple');
  assert.equal(verifyPassword('correct horse battery staple', record), true);
  assert.equal(verifyPassword('wrong', record), false);
});

test('new password validation enforces shared password rules', () => {
  assert.equal(validateNewPassword('a1'), 'password_too_short');
  assert.equal(validateNewPassword('a'.repeat(129)), 'password_too_long');
  assert.equal(validateNewPassword('123'), 'password_missing_letter');
  assert.equal(validateNewPassword('abc'), 'password_missing_number');
  assert.equal(validateNewPassword('todo123456', { currentPassword: 'todo123456' }), 'password_same_as_current');
  assert.equal(validateNewPassword('a1b'), null);
});

test('session tokens survive restart when auth record is unchanged', () => {
  const record = createPasswordRecord('todo123456');
  const secret = createSessionSecret(record);
  const token = createSessionToken({
    username: 'self-hosted-user',
    expiresAt: Date.now() + 60_000
  }, secret);

  const verified = verifySessionToken(token, createSessionSecret(record));
  assert.deepEqual(verified?.username, 'self-hosted-user');
  assert.ok(verified?.expiresAt > Date.now());
});

test('session token verification rejects tampering and expiry', () => {
  const record = createPasswordRecord('todo123456');
  const secret = createSessionSecret(record, 'manual-secret');
  const valid = createSessionToken({
    username: 'self-hosted-user',
    expiresAt: Date.now() + 60_000
  }, secret);
  const [payload, signature] = valid.split('.');
  const tampered = `${payload}.broken${signature.slice(6)}`;
  const expired = createSessionToken({
    username: 'self-hosted-user',
    expiresAt: Date.now() - 60_000
  }, secret);

  assert.equal(verifySessionToken(tampered, secret), null);
  assert.equal(verifySessionToken(expired, secret), null);
});

test('zip helper round-trips stored attachment files', async () => {
  const zip = await createZip([
    { name: 'file_a.txt', buffer: Buffer.from('alpha') },
    { name: 'nested/file_b.txt', buffer: Buffer.from('beta') }
  ]);
  const entries = parseZip(zip);
  assert.deepEqual(entries.map(entry => entry.name), ['file_a.txt', 'nested/file_b.txt']);
  assert.equal(entries[0].content.toString('utf8'), 'alpha');
  assert.equal(entries[1].content.toString('utf8'), 'beta');
});

test('task update can clear optional fields', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-store-'));
  const store = new TodoStore({ dataDir });
  await store.init();
  const task = await store.createTask({
    title: 'clearable fields',
    projectId: 'proj_personal',
    dueDate: '2026-06-07',
    reminderAt: '2026-06-07T01:00:00.000Z',
    recurrence: { type: 'weekly', interval: 1 }
  });
  const updated = await store.updateTask(task.id, {
    projectId: null,
    dueDate: null,
    reminderAt: null,
    recurrence: null
  });
  assert.equal(updated.projectId, null);
  assert.equal(updated.dueDate, null);
  assert.equal(updated.reminderAt, null);
  assert.equal(updated.recurrence, null);
});

test('task urgent flag defaults false and can be updated', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-store-'));
  const store = new TodoStore({ dataDir });
  await store.init();

  const task = await store.createTask({ title: 'urgent marker' });
  assert.equal(task.urgent, false);

  const marked = await store.updateTask(task.id, { urgent: true });
  assert.equal(marked.urgent, true);

  const cleared = await store.updateTask(task.id, { urgent: false });
  assert.equal(cleared.urgent, false);
});

test('legacy payloads backfill calendar day limit and subtask metadata', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-store-'));
  const store = new TodoStore({ dataDir });
  await store.init();
  const filePath = path.join(dataDir, 'todo-data.json');
  const payload = JSON.parse(await fs.readFile(filePath, 'utf8'));
  delete payload.settings.calendarDayLimit;
  payload.tasks = [
    {
      ...payload.tasks[0],
      subtasks: [{ id: 'sub_legacy', title: 'Legacy subtask', completed: false, order: 1 }]
    }
  ];
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2));

  const migrated = new TodoStore({ dataDir });
  await migrated.init();

  assert.equal(migrated.data.settings.calendarDayLimit, 3);
  assert.deepEqual(migrated.data.tasks[0].subtasks[0], {
    id: 'sub_legacy',
    title: 'Legacy subtask',
    completed: false,
    order: 1,
    dueDate: null,
    priority: 'none'
  });
});

test('task update persists edited subtask metadata', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-store-'));
  const store = new TodoStore({ dataDir });
  await store.init();
  const task = await store.createTask({
    title: 'subtask edits',
    subtasks: [{ id: 'sub_keep', title: 'Before', completed: false, order: 1, dueDate: '2026-06-08', priority: 'low' }]
  });
  const updated = await store.updateTask(task.id, {
    subtasks: [{ id: 'sub_keep', title: 'After', completed: false, order: 1, dueDate: '2026-06-09', priority: 'high' }]
  });
  assert.equal(updated.subtasks.length, 1);
  assert.equal(updated.subtasks[0].id, 'sub_keep');
  assert.equal(updated.subtasks[0].title, 'After');
  assert.equal(updated.subtasks[0].dueDate, '2026-06-09');
  assert.equal(updated.subtasks[0].priority, 'high');
});

test('recurring copies preserve subtask date and priority metadata', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-store-'));
  const store = new TodoStore({ dataDir });
  await store.init();
  const task = await store.createTask({
    title: 'weekly review',
    dueDate: '2026-06-08',
    recurrence: { type: 'weekly', interval: 1 },
    subtasks: [{ id: 'sub_keep', title: 'Review notes', completed: true, order: 1, dueDate: '2026-06-09', priority: 'medium' }]
  });

  await store.updateTask(task.id, { completed: true });

  const copy = store.data.tasks.find(item => item.id !== task.id && item.title === 'weekly review' && !item.completed);
  assert.ok(copy);
  assert.equal(copy.dueDate, '2026-06-15');
  assert.deepEqual(copy.subtasks[0], {
    id: copy.subtasks[0].id,
    title: 'Review notes',
    completed: false,
    order: 1,
    dueDate: '2026-06-09',
    priority: 'medium'
  });
});

test('filter update preserves pinned state when omitted', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-store-'));
  const store = new TodoStore({ dataDir });
  await store.init();
  const filter = await store.createFilter({
    name: 'Pinned filter',
    pinned: true,
    conditions: [{ field: 'priority', operator: 'is', value: 'high' }]
  });
  const updated = await store.updateFilter(filter.id, {
    name: 'Edited pinned filter',
    conditions: [{ field: 'due', operator: 'is', value: 'today' }]
  });
  assert.equal(updated.name, 'Edited pinned filter');
  assert.equal(updated.pinned, true);
  assert.deepEqual(updated.conditions, [{ field: 'due', operator: 'is', value: 'today' }]);
});

test('project updates preserve existing sections when sections are omitted', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-store-'));
  const store = new TodoStore({ dataDir });
  await store.init();
  const project = await store.createProject({
    name: 'Editable project',
    color: 'blue',
    sections: [{ name: '默认', order: 1 }, { name: '复盘', order: 2 }]
  });

  const updated = await store.updateProject(project.id, {
    name: 'Edited project',
    description: 'Updated description',
    color: 'green'
  });

  assert.equal(updated.name, 'Edited project');
  assert.equal(updated.description, 'Updated description');
  assert.equal(updated.color, 'green');
  assert.equal(updated.sections.length, 2);
  assert.equal(updated.sections[0].name, '默认');
  assert.equal(updated.sections[1].name, '复盘');
});

test('project archive flag can be toggled on and off', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-store-'));
  const store = new TodoStore({ dataDir });
  await store.init();
  const project = await store.createProject({
    name: 'Archivable project',
    sections: [{ name: '默认', order: 1 }]
  });

  const archived = await store.updateProject(project.id, { archived: true });
  const restored = await store.updateProject(project.id, { archived: false });

  assert.equal(archived.archived, true);
  assert.equal(restored.archived, false);
});
