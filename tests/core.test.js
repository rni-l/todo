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
import { parseMultipart } from '../src/multipart.js';
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

test('multipart parser preserves utf8 filenames and filename star values', () => {
  const boundary = 'todo-boundary';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="中文 文件.txt"\r\nContent-Type: text/plain\r\n\r\nhello\r\n`, 'utf8'),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file2"; filename="ignored.txt"; filename*=UTF-8''%E6%B5%8B%E8%AF%95.mp4\r\nContent-Type: video/mp4\r\n\r\nvideo\r\n`, 'utf8'),
    Buffer.from(`--${boundary}--\r\n`, 'utf8')
  ]);

  const parts = parseMultipart(body, `multipart/form-data; boundary=${boundary}`);

  assert.equal(parts[0].filename, '中文 文件.txt');
  assert.equal(parts[0].content.toString('utf8'), 'hello');
  assert.equal(parts[1].filename, '测试.mp4');
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

test('calendar adjacent day setting defaults off and persists updates', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-store-'));
  const store = new TodoStore({ dataDir });
  await store.init();

  assert.equal(store.publicData().settings.calendarShowAdjacentDays, false);

  const settings = await store.updateSettings({ calendarShowAdjacentDays: true });
  assert.equal(settings.calendarShowAdjacentDays, true);

  const reloaded = new TodoStore({ dataDir });
  await reloaded.init();
  assert.equal(reloaded.publicData().settings.calendarShowAdjacentDays, true);
});

test('attachments use configured access prefix, preserve utf8 names, and deduplicate files in dated directories', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-store-'));
  const store = new TodoStore({ dataDir });
  await store.init();
  await store.updateSettings({
    uploadUrlConfig: {
      accessPrefix: '/test',
      baseUrl: 'https://files.example.com/open',
      paramKey: 'file'
    }
  });
  const task = await store.createTask({ title: 'uploads' });

  const first = await store.addAttachment(task.id, {
    filename: '中文 文件.mp4',
    contentType: 'video/mp4',
    content: Buffer.from('one')
  });
  const second = await store.addAttachment(task.id, {
    filename: '中文 文件.mp4',
    contentType: 'video/mp4',
    content: Buffer.from('two')
  });
  const third = await store.addAttachment(task.id, {
    filename: '中文 文件.mp4',
    contentType: 'video/mp4',
    content: Buffer.from('three')
  });

  assert.equal(first.originalName, '中文 文件.mp4');
  assert.match(first.storageName, /^\d{2}\/\d{2}\/\d{2}\/中文 文件\.mp4$/);
  assert.match(first.relativePath, /^\/test\/\d{2}\/\d{2}\/\d{2}\/中文 文件\.mp4$/);
  assert.equal(second.storageName, first.storageName.replace('中文 文件.mp4', '中文 文件-1.mp4'));
  assert.equal(third.storageName, first.storageName.replace('中文 文件.mp4', '中文 文件-2.mp4'));
  assert.equal((await fs.readFile(await store.attachmentPath(second))).toString('utf8'), 'two');

  const publicPath = await store.publicUploadPath(first.relativePath);
  assert.equal((await fs.readFile(publicPath)).toString('utf8'), 'one');

  const publicData = store.publicData();
  const publicAttachment = publicData.tasks.find(item => item.id === task.id).attachments[0];
  assert.equal(publicAttachment.relativePath, first.relativePath);
});

test('legacy storageName-only attachments still download, delete, and export', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-store-'));
  const store = new TodoStore({ dataDir });
  await store.init();
  const task = await store.createTask({ title: 'legacy attachment' });
  const attachment = {
    id: 'file_legacy',
    originalName: 'legacy.txt',
    size: 6,
    mimeType: 'text/plain',
    uploadedAt: '2026-06-18T00:00:00.000Z',
    storageName: 'file_legacy.txt',
    missing: false
  };
  task.attachments.push(attachment);
  await fs.writeFile(path.join(store.uploadDir, attachment.storageName), 'legacy');
  await store.save();

  assert.equal((await fs.readFile(await store.attachmentPath(attachment))).toString('utf8'), 'legacy');
  const zip = await createZip([{ path: await store.attachmentPath(attachment), name: attachment.storageName }]);
  const entries = parseZip(zip);
  assert.equal(entries[0].name, 'file_legacy.txt');
  assert.equal(entries[0].content.toString('utf8'), 'legacy');

  assert.equal(await store.deleteAttachment(attachment.id), true);
  await assert.rejects(fs.access(path.join(store.uploadDir, attachment.storageName)));
});

test('attachment zip import restores dated storage paths', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-store-'));
  const store = new TodoStore({ dataDir });
  await store.init();
  const task = await store.createTask({ title: 'restore attachment' });
  const attachment = await store.addAttachment(task.id, {
    filename: 'a.mp4',
    contentType: 'video/mp4',
    content: Buffer.from('old')
  });
  await fs.rm(await store.attachmentPath(attachment));

  const summary = await store.importAttachmentEntries([
    { name: attachment.storageName, basename: path.basename(attachment.storageName), content: Buffer.from('restored') }
  ]);

  assert.equal(summary.matched, 1);
  assert.equal(summary.restored[0], attachment.id);
  assert.equal((await fs.readFile(await store.attachmentPath(attachment))).toString('utf8'), 'restored');
});

test('legacy payloads backfill layout settings, upload url config, calendar day limit, and subtask metadata', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-store-'));
  const store = new TodoStore({ dataDir });
  await store.init();
  const filePath = path.join(dataDir, 'todo-data.json');
  const payload = JSON.parse(await fs.readFile(filePath, 'utf8'));
  delete payload.settings.calendarShowAdjacentDays;
  delete payload.settings.calendarDayLimit;
  delete payload.settings.sidebarCollapsed;
  delete payload.settings.dockDrawer;
  delete payload.settings.uploadUrlConfig;
  payload.tasks = [
    {
      ...payload.tasks[0],
      subtasks: [{ id: 'sub_legacy', title: 'Legacy subtask', completed: false, order: 1 }]
    }
  ];
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2));

  const migrated = new TodoStore({ dataDir });
  await migrated.init();

  assert.equal(migrated.data.settings.calendarShowAdjacentDays, false);
  assert.equal(migrated.data.settings.calendarDayLimit, 3);
  assert.equal(migrated.data.settings.sidebarCollapsed, false);
  assert.equal(migrated.data.settings.dockDrawer, true);
  assert.deepEqual(migrated.data.settings.uploadUrlConfig, {
    accessPrefix: '/uploads',
    baseUrl: '',
    paramKey: 'path'
  });
  assert.deepEqual(migrated.data.tasks[0].subtasks[0], {
    id: 'sub_legacy',
    title: 'Legacy subtask',
    completed: false,
    order: 1,
    dueDate: null,
    priority: 'none'
  });
  assert.equal(migrated.data.tasks[0].closed, false);
  assert.equal(migrated.data.tasks[0].closedAt, null);
  assert.equal(migrated.data.tasks[0].startDate, null);
  assert.equal(migrated.data.tasks[0].reminderEndAt, null);
});

test('task close state is distinct from completion and can be restored', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-store-'));
  const store = new TodoStore({ dataDir });
  await store.init();
  const task = await store.createTask({ title: 'cancelled work', completed: true, completedAt: '2026-06-08T01:00:00.000Z' });

  const closed = await store.updateTask(task.id, { closed: true });
  assert.equal(closed.closed, true);
  assert.ok(closed.closedAt);
  assert.equal(closed.completed, false);
  assert.equal(closed.completedAt, null);

  const restored = await store.updateTask(task.id, { closed: false });
  assert.equal(restored.closed, false);
  assert.equal(restored.closedAt, null);
  assert.equal(restored.completed, false);
});

test('closing recurring task does not create recurring copy', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-store-'));
  const store = new TodoStore({ dataDir });
  await store.init();
  const task = await store.createTask({
    title: 'weekly cancelled',
    dueDate: '2026-06-08',
    recurrence: { type: 'weekly', interval: 1 }
  });

  await store.updateTask(task.id, { closed: true });

  const copies = store.data.tasks.filter(item => item.title === 'weekly cancelled');
  assert.equal(copies.length, 1);
  assert.equal(copies[0].closed, true);
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
