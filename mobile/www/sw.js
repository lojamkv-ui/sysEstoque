/* Service worker do Stoki SDY — permite instalar pelo link e abrir sem internet.
   Estratégia: primeiro o cache (o app é estático), atualizando em segundo plano. */
const VERSAO = 'stoki-sdy-v1';
const ARQUIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './vendor/html5-qrcode.min.js',
  './vendor/qrcode.js',
  './icone-64.png',
  './icone-192.png',
  './icone-512.png',
  './icone-512-maskable.png'
];

self.addEventListener('install', evento => {
  evento.waitUntil(
    caches.open(VERSAO)
      .then(cache => cache.addAll(ARQUIVOS).catch(() => Promise.all(
        ARQUIVOS.map(a => cache.add(a).catch(() => null))
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n !== VERSAO).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', evento => {
  const req = evento.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== location.origin) return;   /* não intercepta terceiros */
  evento.respondWith(
    caches.match(req, {ignoreSearch:true}).then(cacheado => {
      const rede = fetch(req).then(resp => {
        if(resp && resp.ok && resp.type === 'basic'){
          const copia = resp.clone();
          caches.open(VERSAO).then(c => c.put(req, copia)).catch(() => {});
        }
        return resp;
      }).catch(() => cacheado || caches.match('./index.html'));
      return cacheado || rede;
    })
  );
});
