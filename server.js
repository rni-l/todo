import http from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSessionSecret, createSessionToken, validateNewPassword, verifySessionToken } from './src/auth.js';
import { TodoStore } from './src/storage.js';
import { createZip, parseZip } from './src/zip.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(await fs.readFile(path.join(__dirname, 'package.json'), 'utf8'));
const APP_VERSION = packageJson.version || '0.0.0';
const publicDir = path.join(__dirname, 'public');
const prototypeDir = __dirname;
const port = Number(process.env.PORT || 38887);
const maxJsonBytes = 12 * 1024 * 1024;
const maxUploadBytes = 110 * 1024 * 1024;
const sessionTtlMs = 1000 * 60 * 60 * 24 * 14;

const store = new TodoStore();
await store.init();

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.ico', 'image/x-icon'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8']
]);

const templatedFiles = new Set([
  path.join(publicDir, 'index.html'),
  path.join(publicDir, 'sw.js'),
  path.join(publicDir, 'assets', 'app.js')
]);

function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const index = part.indexOf('=');
        if (index < 0) return [part, ''];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function sessionSecret() {
  return createSessionSecret(store.data?.auth?.password, process.env.TODO_SESSION_SECRET || '');
}

function createSession(username) {
  return createSessionToken({
    username,
    expiresAt: Date.now() + sessionTtlMs
  }, sessionSecret());
}

function setSessionCookie(res, sessionId) {
  const secure = process.env.TODO_COOKIE_SECURE === '1' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `todo_session=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1209600${secure}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'todo_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

function json(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(body);
}

function text(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...headers
  });
  res.end(body);
}

function isTemplatedFile(filePath) {
  return templatedFiles.has(filePath);
}

function renderTemplate(content) {
  return content.replaceAll('__APP_VERSION__', APP_VERSION);
}

async function readBody(req, limit = maxJsonBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error('Request body too large');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req) {
  const body = await readBody(req);
  if (!body.length) return {};
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    const error = new Error('Invalid JSON body');
    error.status = 400;
    throw error;
  }
}

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies.todo_session;
  const value = verifySessionToken(token, sessionSecret());
  if (!value || value.username !== store.data.auth.username) {
    return { id: token, value: null };
  }
  return {
    id: token,
    value
  };
}

function requireAuth(req, res) {
  const session = getSession(req);
  if (!session.value) {
    json(res, 401, { error: 'unauthorized' });
    return null;
  }
  setSessionCookie(res, createSession(session.value.username));
  return session;
}

function routeParams(pattern, pathName) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathName.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

function getBoundary(contentType = '') {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return match?.[1] || match?.[2] || null;
}

function parseMultipart(buffer, contentType) {
  const boundary = getBoundary(contentType);
  if (!boundary) {
    const error = new Error('Missing multipart boundary');
    error.status = 400;
    throw error;
  }

  const delimiter = Buffer.from(`--${boundary}`);
  const parts = [];
  let cursor = buffer.indexOf(delimiter);
  if (cursor < 0) return parts;
  cursor += delimiter.length;

  while (cursor < buffer.length) {
    if (buffer[cursor] === 45 && buffer[cursor + 1] === 45) break;
    if (buffer[cursor] === 13 && buffer[cursor + 1] === 10) cursor += 2;

    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), cursor);
    if (headerEnd < 0) break;
    const headerText = buffer.subarray(cursor, headerEnd).toString('utf8');
    const headers = Object.fromEntries(
      headerText.split('\r\n').map(line => {
        const index = line.indexOf(':');
        if (index < 0) return [line.toLowerCase(), ''];
        return [line.slice(0, index).toLowerCase(), line.slice(index + 1).trim()];
      })
    );

    const nextBoundary = buffer.indexOf(delimiter, headerEnd + 4);
    if (nextBoundary < 0) break;
    let content = buffer.subarray(headerEnd + 4, nextBoundary);
    if (content.length >= 2 && content[content.length - 2] === 13 && content[content.length - 1] === 10) {
      content = content.subarray(0, content.length - 2);
    }

    const disposition = headers['content-disposition'] || '';
    const name = disposition.match(/name="([^"]+)"/)?.[1] || '';
    const filename = disposition.match(/filename="([^"]*)"/)?.[1] || '';
    parts.push({
      name,
      filename,
      contentType: headers['content-type'] || 'application/octet-stream',
      content
    });
    cursor = nextBoundary + delimiter.length;
  }

  return parts;
}

function firstFile(parts, name = 'file') {
  return parts.find(part => part.name === name && part.filename) || parts.find(part => part.filename);
}

function firstField(parts, name) {
  return parts.find(part => part.name === name && !part.filename)?.content.toString('utf8') || '';
}

function parseImportJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error('Invalid import JSON');
    error.status = 400;
    throw error;
  }
}

async function serveStatic(req, res, url) {
  const isPrototype = url.pathname.startsWith('/prototype/');
  const base = isPrototype ? prototypeDir : publicDir;
  const rawPath = isPrototype ? url.pathname.replace(/^\/prototype\/?/, '/') : url.pathname;
  const requestPath = rawPath === '/' ? '/index.html' : decodeURIComponent(rawPath);
  const normalized = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(base, normalized);
  const relative = path.relative(base, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    text(res, 403, 'Forbidden');
    return;
  }

  try {
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      const target = path.join(filePath, 'index.html');
      await sendFile(res, target);
      return;
    }
    await sendFile(res, filePath);
  } catch {
    if (!isPrototype && !path.extname(requestPath)) {
      await sendFile(res, path.join(publicDir, 'index.html'));
      return;
    }
    text(res, 404, 'Not found');
  }
}

async function sendFile(res, filePath, extraHeaders = {}) {
  const extension = path.extname(filePath);
  const type = mimeTypes.get(extension) || 'application/octet-stream';
  const stat = await fs.stat(filePath);
  const cacheControl = path.basename(filePath) === 'sw.js' || extension === '.html' ? 'no-cache' : 'public, max-age=3600';
  if (isTemplatedFile(filePath)) {
    const body = renderTemplate(await fs.readFile(filePath, 'utf8'));
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': cacheControl,
      ...extraHeaders
    });
    res.end(body);
    return;
  }
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Cache-Control': cacheControl,
    ...extraHeaders
  });
  fsSync.createReadStream(filePath).pipe(res);
}

async function sendDownload(res, filePath, filename, type = 'application/octet-stream') {
  const stat = await fs.stat(filePath);
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    'Cache-Control': 'no-store'
  });
  fsSync.createReadStream(filePath).pipe(res);
}

async function api(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/health') {
    json(res, 200, {
      ok: true,
      appVersion: APP_VERSION,
      dataVersion: store.data.version
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const body = await readJson(req);
    const username = String(body.username || store.data.auth.username);
    if (username !== store.data.auth.username || !store.verifyPassword(body.password || '')) {
      json(res, 401, { error: 'invalid_credentials' });
      return;
    }
    const sessionId = createSession(username);
    setSessionCookie(res, sessionId);
    json(res, 200, { ok: true, user: { username } });
    return;
  }

  const session = requireAuth(req, res);
  if (!session) return;

  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    clearSessionCookie(res);
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/me') {
    json(res, 200, { user: { username: session.value.username } });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/data') {
    json(res, 200, store.publicData());
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/export/data') {
    const body = JSON.stringify(store.exportData(), null, 2);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Content-Disposition': `attachment; filename="todo-data-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store'
    });
    res.end(body);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/import/preview') {
    const payload = await importPayload(req);
    json(res, 200, { preview: store.previewImport(payload) });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/import/data') {
    const payload = await importPayload(req);
    await store.importData(payload);
    json(res, 200, { ok: true, data: store.publicData() });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/settings') {
    const settings = await store.updateSettings(await readJson(req));
    json(res, 200, { settings });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/account/password') {
    const body = await readJson(req);
    if (!store.verifyPassword(body.currentPassword || '')) {
      json(res, 400, { error: 'current_password_incorrect' });
      return;
    }
    const passwordError = validateNewPassword(body.newPassword, {
      currentPassword: body.currentPassword || ''
    });
    if (passwordError) {
      json(res, 400, { error: passwordError });
      return;
    }
    await store.changePassword(body.newPassword);
    setSessionCookie(res, createSession(session.value.username));
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/tasks') {
    const task = await store.createTask(await readJson(req));
    json(res, 201, { task, data: store.publicData() });
    return;
  }

  let params = routeParams('/api/tasks/:id', url.pathname);
  if (params && req.method === 'PATCH') {
    const task = await store.updateTask(params.id, await readJson(req));
    if (!task) {
      json(res, 404, { error: 'task_not_found' });
      return;
    }
    json(res, 200, { task, data: store.publicData() });
    return;
  }
  if (params && req.method === 'DELETE') {
    const ok = await store.deleteTask(params.id);
    json(res, ok ? 200 : 404, ok ? { ok: true, data: store.publicData() } : { error: 'task_not_found' });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/projects') {
    const project = await store.createProject(await readJson(req));
    json(res, 201, { project, data: store.publicData() });
    return;
  }

  params = routeParams('/api/projects/:id', url.pathname);
  if (params && req.method === 'PATCH') {
    const project = await store.updateProject(params.id, await readJson(req));
    if (!project) {
      json(res, 404, { error: 'project_not_found' });
      return;
    }
    json(res, 200, { project, data: store.publicData() });
    return;
  }
  if (params && req.method === 'DELETE') {
    const body = url.searchParams.get('mode') ? { mode: url.searchParams.get('mode') } : await optionalJson(req);
    const ok = await store.deleteProject(params.id, body);
    json(res, ok ? 200 : 404, ok ? { ok: true, data: store.publicData() } : { error: 'project_not_found' });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/tags') {
    const tag = await store.createTag(await readJson(req));
    json(res, 201, { tag, data: store.publicData() });
    return;
  }

  params = routeParams('/api/tags/:id', url.pathname);
  if (params && req.method === 'PATCH') {
    const tag = await store.updateTag(params.id, await readJson(req));
    if (!tag) {
      json(res, 404, { error: 'tag_not_found' });
      return;
    }
    json(res, 200, { tag, data: store.publicData() });
    return;
  }
  if (params && req.method === 'DELETE') {
    const ok = await store.deleteTag(params.id);
    json(res, ok ? 200 : 404, ok ? { ok: true, data: store.publicData() } : { error: 'tag_not_found' });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/filters') {
    const filter = await store.createFilter(await readJson(req));
    json(res, 201, { filter, data: store.publicData() });
    return;
  }

  params = routeParams('/api/filters/:id', url.pathname);
  if (params && req.method === 'PATCH') {
    const filter = await store.updateFilter(params.id, await readJson(req));
    if (!filter) {
      json(res, 404, { error: 'filter_not_found' });
      return;
    }
    json(res, 200, { filter, data: store.publicData() });
    return;
  }
  if (params && req.method === 'DELETE') {
    const ok = await store.deleteFilter(params.id);
    json(res, ok ? 200 : 404, ok ? { ok: true, data: store.publicData() } : { error: 'filter_not_found' });
    return;
  }

  params = routeParams('/api/tasks/:id/attachments', url.pathname);
  if (params && req.method === 'POST') {
    const parts = parseMultipart(await readBody(req, maxUploadBytes), req.headers['content-type'] || '');
    const file = firstFile(parts);
    if (!file) {
      json(res, 400, { error: 'missing_file' });
      return;
    }
    if (file.content.length > 100 * 1024 * 1024) {
      json(res, 413, { error: 'file_too_large' });
      return;
    }
    const attachment = await store.addAttachment(params.id, file);
    if (!attachment) {
      json(res, 404, { error: 'task_not_found' });
      return;
    }
    json(res, 201, { attachment, data: store.publicData() });
    return;
  }

  params = routeParams('/api/attachments/:id/download', url.pathname);
  if (params && req.method === 'GET') {
    const found = store.findAttachment(params.id);
    if (!found) {
      json(res, 404, { error: 'attachment_not_found' });
      return;
    }
    try {
      const filePath = await store.attachmentPath(found.attachment);
      await sendDownload(res, filePath, found.attachment.originalName, found.attachment.mimeType);
    } catch {
      found.attachment.missing = true;
      await store.save();
      json(res, 404, { error: 'attachment_file_missing' });
    }
    return;
  }

  params = routeParams('/api/attachments/:id', url.pathname);
  if (params && req.method === 'DELETE') {
    const ok = await store.deleteAttachment(params.id);
    json(res, ok ? 200 : 404, ok ? { ok: true, data: store.publicData() } : { error: 'attachment_not_found' });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/export/attachments') {
    const files = [];
    for (const task of store.data.tasks) {
      for (const attachment of task.attachments) {
        try {
          const filePath = await store.attachmentPath(attachment);
          files.push({ path: filePath, name: attachment.storageName });
          attachment.missing = false;
        } catch {
          attachment.missing = true;
        }
      }
    }
    await store.save();
    const zip = await createZip(files);
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Length': zip.length,
      'Content-Disposition': `attachment; filename="todo-attachments-${new Date().toISOString().slice(0, 10)}.zip"`,
      'Cache-Control': 'no-store'
    });
    res.end(zip);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/import/attachments') {
    const parts = parseMultipart(await readBody(req, maxUploadBytes), req.headers['content-type'] || '');
    const file = firstFile(parts);
    if (!file) {
      json(res, 400, { error: 'missing_zip' });
      return;
    }
    const summary = await store.importAttachmentEntries(parseZip(file.content));
    json(res, 200, { ok: true, summary, data: store.publicData() });
    return;
  }

  json(res, 404, { error: 'not_found' });
}

async function optionalJson(req) {
  const body = await readBody(req);
  if (!body.length) return {};
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    return {};
  }
}

async function importPayload(req) {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    const parts = parseMultipart(await readBody(req, maxUploadBytes), contentType);
    const file = firstFile(parts);
    if (!file) {
      const raw = firstField(parts, 'payload');
      if (!raw) {
        const error = new Error('Missing import file');
        error.status = 400;
        throw error;
      }
      return parseImportJson(raw);
    }
    return parseImportJson(file.content.toString('utf8'));
  }
  return readJson(req);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      await api(req, res, url);
      return;
    }
    await serveStatic(req, res, url);
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error(error);
    json(res, status, { error: error.message || 'server_error' });
  }
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Start with another port, for example: PORT=38888 npm run dev`);
  } else if (error.code === 'EACCES' || error.code === 'EPERM') {
    console.error(`Cannot listen on port ${port}. Check local permissions or use another port.`);
  } else {
    console.error(error);
  }
  process.exit(1);
});

server.listen(port, () => {
  console.log(`Personal TODO is running at http://localhost:${port}`);
  console.log(`App version: ${APP_VERSION}`);
  console.log(`Runtime root: ${process.cwd()}`);
  console.log(`Data directory: ${store.dataDir}`);
  console.log(`Prototype reference is available at http://localhost:${port}/prototype/index.html`);
  if (!process.env.TODO_PASSWORD) {
    console.log('Default login password: todo123456');
  }
});
