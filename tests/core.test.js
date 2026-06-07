import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createPasswordRecord, verifyPassword } from '../src/auth.js';
import { createZip, parseZip } from '../src/zip.js';
import { TodoStore } from '../src/storage.js';

test('password records verify the original password only', () => {
  const record = createPasswordRecord('correct horse battery staple');
  assert.equal(verifyPassword('correct horse battery staple', record), true);
  assert.equal(verifyPassword('wrong', record), false);
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
