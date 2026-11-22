/* 速记 · 英二 —— 离线缓存
   只有通过 https 或 localhost 打开时浏览器才会启用它；局域网 http 下自动跳过，
   不影响使用。改动 index.html 之后，请把 VERSION 改成新的值，否则已安装的
   副本会继续使用旧缓存。 */
const VERSION = 'v1-20261122';
const SCOPE = self.registration.scope;
const INDEX = new URL('index.html', SCOPE).href;

const EXTRA = [
  'manifest.webmanifest',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png'
].map(function (path) { return new URL(path, SCOPE).href; });

self.addEventListener('install', function (event) {
  event.waitUntil((async function () {
    const cache = await caches.open(VERSION);
    // 先确保主文件落地，其余资源失败也不算安装失败
    await cache.add(new Request(INDEX, { cache: 'reload' }));
    await Promise.allSettled(EXTRA.map(function (url) {
      return cache.add(url).catch(function () {});
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    const keys = await caches.keys();
    await Promise.all(keys.filter(function (key) { return key !== VERSION; })
      .map(function (key) { return caches.delete(key); }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  // 打开页面：永远给本地那份，秒开且离线可用
  if (request.mode === 'navigate') {
    event.respondWith((async function () {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(INDEX);
      if (hit) return hit;
      try { return await fetch(request); } catch (e) {
        return new Response('<h1>离线</h1><p>首次打开需要联网一次。</p>',
          { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  // 其他同源资源：缓存优先，顺手补进缓存
  event.respondWith((async function () {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const response = await fetch(request);
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    } catch (e) {
      return new Response('', { status: 504, statusText: 'offline' });
    }
  })());
});
