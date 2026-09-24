import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { MacQuickAccess, macQuickSummary } from '../src/macQuick.js';
import { TodoStoreRuntime } from '../src/storeRuntime.js';

test('mac quick summary matches today and overdue date ranges without duplicates', () => {
  const data = {
    updatedAt: '2026-09-24T08:00:00.000Z',
    tasks: [
      { id: 'old', title: 'Old', dueDate: '2026-09-23', priority: 'high' },
      { id: 'today', title: 'Today', startDate: '2026-09-22', dueDate: '2026-09-25', priority: 'medium' },
      { id: 'done', title: 'Done', dueDate: '2026-09-24', completed: true },
      { id: 'later', title: 'Later', dueDate: '2026-09-25' },
      { id: 'no-date', title: 'No date' }
    ]
  };
  const summary = macQuickSummary(data, '2026-09-24');
  assert.deepEqual(summary.overdue.map(task => task.id), ['old']);
  assert.deepEqual(summary.today.map(task => task.id), ['today']);
  assert.equal(summary.overdueCount, 1);
  assert.equal(summary.todayCount, 1);
});

test('mac quick access requires a grant and invalidates it after password change', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-mac-quick-'));
  const runtime = new TodoStoreRuntime({ dataDir });
  await runtime.init();
  const access = new MacQuickAccess({ runtime, token: 'local-test-token', stateDir: path.join(dataDir, 'state') });
  assert.equal(await access.authorized('Bearer local-test-token'), false);
  await access.grant();
  assert.equal(await access.authorized('Bearer wrong'), false);
  assert.equal(await access.authorized('Bearer local-test-token'), true);

  const created = await access.createToday('A new task');
  assert.ok(created.today.some(task => task.title === 'A new task'));
  const task = created.today.find(item => item.title === 'A new task');
  const completed = await access.complete(task.id);
  assert.equal(completed.today.some(item => item.id === task.id), false);

  await runtime.write(store => store.changePassword('changed123'));
  assert.equal(await access.authorized('Bearer local-test-token'), false);
});

test('mac quick HTTP routes require local token and a prior login', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-mac-http-'));
  const stateDir = path.join(dataDir, 'app-state');
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      TODO_HOST: '127.0.0.1',
      TODO_DATA_DIR: dataDir,
      TODO_PASSWORD: 'macTest123',
      TODO_MAC_WIDGET_TOKEN: 'http-test-token',
      TODO_MAC_STATE_DIR: stateDir
    },
    stdio: 'ignore'
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    let healthy = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      if (child.exitCode !== null) break;
      try {
        healthy = (await fetch(`${base}/api/health`)).ok;
        if (healthy) break;
      } catch { }
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    assert.equal(healthy, true, 'isolated server started');

    const authHeader = { Authorization: 'Bearer http-test-token' };
    assert.equal((await fetch(`${base}/api/mac/quick`, { headers: authHeader })).status, 401);
    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'self-hosted-user', password: 'macTest123' })
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await fetch(`${base}/api/mac/quick`, { headers: authHeader })).status, 200);
    assert.equal((await fetch(`${base}/api/mac/quick`, { headers: { Authorization: 'Bearer wrong' } })).status, 401);
    assert.equal((await fetch(`${base}/api/mac/quick`, { headers: { ...authHeader, Origin: 'https://example.com' } })).status, 403);

    const created = await fetch(`${base}/api/mac/quick/tasks`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Quick HTTP task' })
    });
    assert.equal(created.status, 201);
    const summary = await created.json();
    const task = summary.today.find(item => item.title === 'Quick HTTP task');
    assert.ok(task);
    const completed = await fetch(`${base}/api/mac/quick/tasks/${task.id}/complete`, {
      method: 'POST', headers: authHeader
    });
    assert.equal(completed.status, 200);
    assert.equal((await completed.json()).today.some(item => item.id === task.id), false);

    const logout = await fetch(`${base}/api/auth/logout`, {
      method: 'POST', headers: { Cookie: cookie }
    });
    assert.equal(logout.status, 200);
    assert.equal((await fetch(`${base}/api/mac/quick`, { headers: authHeader })).status, 401);
  } finally {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise(resolve => child.once('exit', resolve));
    }
  }
});
