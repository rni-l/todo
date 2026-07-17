import fs from 'node:fs/promises';
import path from 'node:path';
import { TodoStore } from './storage.js';

const DEFAULT_LOCK_TIMEOUT_MS = 10_000;
const DEFAULT_STALE_LOCK_MS = 30_000;
const DEFAULT_RETRY_DELAY_MS = 40;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class TodoStoreRuntime {
  constructor({
    dataDir = process.env.TODO_DATA_DIR,
    lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS,
    staleLockMs = DEFAULT_STALE_LOCK_MS,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS
  } = {}) {
    this.store = new TodoStore(dataDir ? { dataDir } : undefined);
    this.lockDir = path.join(this.store.dataDir, '.todo-lock');
    this.lockTimeoutMs = lockTimeoutMs;
    this.staleLockMs = staleLockMs;
    this.retryDelayMs = retryDelayMs;
  }

  async init() {
    await this.store.init();
    return this;
  }

  async reload() {
    const raw = await fs.readFile(this.store.filePath, 'utf8');
    this.store.data = this.store.normalize(JSON.parse(raw), { preserveAuth: true });
    return this.store.data;
  }

  async read(fn) {
    await this.reload();
    return fn(this.store);
  }

  async write(fn) {
    const release = await this.acquireLock();
    try {
      await this.reload();
      return await fn(this.store);
    } finally {
      await release();
    }
  }

  async acquireLock() {
    const startedAt = Date.now();
    await fs.mkdir(this.store.dataDir, { recursive: true });

    while (true) {
      try {
        await fs.mkdir(this.lockDir);
        const owner = {
          pid: process.pid,
          createdAt: new Date().toISOString()
        };
        await fs.writeFile(path.join(this.lockDir, 'owner.json'), `${JSON.stringify(owner, null, 2)}\n`);
        return async () => {
          await fs.rm(this.lockDir, { recursive: true, force: true });
        };
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        await this.removeStaleLock();
        if (Date.now() - startedAt > this.lockTimeoutMs) {
          const lockError = new Error('todo_store_locked');
          lockError.status = 503;
          throw lockError;
        }
        await sleep(this.retryDelayMs);
      }
    }
  }

  async removeStaleLock() {
    try {
      const stats = await fs.stat(this.lockDir);
      if (Date.now() - stats.mtimeMs > this.staleLockMs) {
        await fs.rm(this.lockDir, { recursive: true, force: true });
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}
