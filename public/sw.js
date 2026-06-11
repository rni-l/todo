const CACHE_NAME = 'personal-todo-__APP_VERSION__';
const APP_SHELL = [
  '/',
  '/index.html',
  '/assets/app.css?v=__APP_VERSION__',
  '/assets/app.js?v=__APP_VERSION__',
  '/assets/reports.js?v=__APP_VERSION__',
  '/assets/subtasks.js?v=__APP_VERSION__',
  '/assets/task-date.js?v=__APP_VERSION__',
  '/assets/task-create.js?v=__APP_VERSION__',
  '/assets/icon.svg',
  '/manifest.webmanifest?v=__APP_VERSION__'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;
  event.respondWith(
    fetch(event.request).then(response => {
      if (event.request.method === 'GET' && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
