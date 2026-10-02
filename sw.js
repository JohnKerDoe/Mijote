const V = 'mijote-v2';
const COQUILLE = ['./', './index.html', './manifest.json', './icone-192.png', './icone-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(COQUILLE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => ![V, 'partage', 'polices'].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);

  // Captures partagées depuis la galerie Android
  if (e.request.method === 'POST' && u.pathname.endsWith('/partage')) {
    e.respondWith(recevoirPartage(e.request));
    return;
  }
  if (e.request.method !== 'GET') return;

  // Fichiers de l'appli : réseau d'abord, cache si hors ligne
  if (u.origin === location.origin) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); }
          return r;
        })
        .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Polices : cache d'abord
  if (u.host === 'fonts.googleapis.com' || u.host === 'fonts.gstatic.com') {
    e.respondWith(caches.open('polices').then(async c => {
      const h = await c.match(e.request);
      if (h) return h;
      const r = await fetch(e.request);
      c.put(e.request, r.clone());
      return r;
    }));
  }
});

async function recevoirPartage(req) {
  const fd = await req.formData();
  const fichiers = fd.getAll('images').filter(f => f && f.size);
  const c = await caches.open('partage');
  for (const k of await c.keys()) await c.delete(k);
  let i = 0;
  for (const f of fichiers) {
    await c.put(new Request('./partage/' + (i++)), new Response(f, { headers: { 'content-type': f.type || 'image/jpeg' } }));
  }
  return Response.redirect(new URL('./?partage=' + i + '#/nouvelle', self.registration.scope).href, 303);
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(ws => ws[0] ? ws[0].focus() : clients.openWindow('./')));
});
